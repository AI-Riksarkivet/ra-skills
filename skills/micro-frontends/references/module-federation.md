# Module Federation (Webpack 5 / Rspack)

The concrete tooling for **client-side runtime composition**: a shell loads a slice's
JavaScript over HTTP at runtime and shares dependency singletons with it, so two
independently built bundles run as one app without duplicating the framework. Reach
for it when teams share a bundler and want to share runtime singletons; prefer plain
web components when teams must stay bundler-agnostic (see composition.md).

## Contents

- [Host vs remote roles](#host-vs-remote-roles)
- [Remote config (the slice)](#remote-config-the-slice)
- [Host config (the shell)](#host-config-the-shell)
- [Dynamic remotes — load by config at runtime](#dynamic-remotes--load-by-config-at-runtime)
- [Consuming a remote](#consuming-a-remote)
- [The shared-singleton pitfalls](#the-shared-singleton-pitfalls)
- [Tooling notes](#tooling-notes)

## Host vs remote roles

| Role | Owns | In config | Analogy |
|---|---|---|---|
| **Remote** | a slice; `exposes` modules over `remoteEntry.js` | `exposes` | the library |
| **Host** (shell) | composition; `remotes` it pulls in; top-level routing/layout | `remotes` | the app |

Roles are per-build, not exclusive — a slice can be a **remote** to the shell *and* a
**host** that consumes a shared `design-system` remote (bidirectional federation, which MF
supports). Prefer a shallow graph anyway: deep or circular remote chains make share-scope
init order and version negotiation hard to reason about.

## Remote config (the slice)

Expose **components AND plain functions/apis**, not just UI — a framework-agnostic
contract (a `mount(el, props)` function, a data API) lets a non-React shell consume the
slice. Exposing only a React element forces every host onto React.

```js
// checkout/rspack.config.js (or webpack.config.js — identical plugin API)
const { ModuleFederationPlugin } = require('@module-federation/enhanced/rspack');
const { dependencies } = require('./package.json');

module.exports = {
  output: { publicPath: 'auto' }, // 'auto' derives the URL from where remoteEntry loaded — never hardcode the host's domain
  plugins: [
    new ModuleFederationPlugin({
      name: 'checkout',                  // the share-scope id; matches the host's `checkout@...` key
      filename: 'remoteEntry.js',        // the manifest the host fetches; keep this name stable — it's the public contract
      exposes: {
        './Cart': './src/Cart',          // a UI component
        './mount': './src/mount',        // framework-agnostic: mount(el, props) -> unmount()
        './api': './src/cart-api',       // plain functions — no framework needed to consume
      },
      shared: {
        // singleton: forbid a 2nd copy at runtime; requiredVersion: refuse a wrong major
        react: { singleton: true, requiredVersion: dependencies.react },
        'react-dom': { singleton: true, requiredVersion: dependencies['react-dom'] },
      },
    }),
  ],
};
```

`requiredVersion` reads from `package.json` so the constraint can't drift from what you
actually build against. Omit `eager` on a remote — a remote should lazy-init its share
scope, not force it into the initial chunk.

## Host config (the shell)

```js
// shell/rspack.config.js
const { ModuleFederationPlugin } = require('@module-federation/enhanced/rspack');
const { dependencies } = require('./package.json');

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'shell',
      remotes: {
        // local-alias: 'scope-name@url-to-remoteEntry.js'
        checkout: 'checkout@https://checkout.example.com/remoteEntry.js',
      },
      shared: {
        // eager: true ONLY in the host — the shell boots the share scope before any remote loads.
        react: { singleton: true, eager: true, requiredVersion: dependencies.react },
        'react-dom': { singleton: true, eager: true, requiredVersion: dependencies['react-dom'] },
      },
    }),
  ],
};
```

The URL in `remotes` is a build-time string. Hardcoding it couples the shell's release
to each slice's domain — fine for a fixed topology, but use **dynamic remotes** below
when the slice list comes from config/env or you add slices without rebuilding the shell.

## Dynamic remotes — load by config at runtime

Drop the static `remotes` entry; fetch `remoteEntry.js`, init the share scope, then
`get()` the module. This is the low-level dance `@module-federation/enhanced` wraps, but
knowing it explains every share-scope error.

```js
// shell/src/loadRemote.js — resolve a slice chosen at runtime (from an API/env), not baked into the build
async function loadRemote({ url, scope, module }) {
  await __webpack_init_sharing__('default');           // create the host's 'default' share scope
  await new Promise((res, rej) => {                    // inject remoteEntry.js as a <script>
    const s = document.createElement('script');
    s.src = url; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  const container = window[scope];                     // the global the remote registered (name: 'checkout')
  await container.init(__webpack_share_scopes__.default); // hand the remote the host's shared singletons
  const factory = await container.get(module);         // e.g. './mount'
  return factory();                                    // the exposed module's exports
}

// const { mount } = await loadRemote({ url, scope: 'checkout', module: './mount' });
```

Order is load-bearing: `__webpack_init_sharing__` **then** `container.init` **then**
`get`. Calling `get` before `init` skips singleton negotiation and silently loads a
second framework copy. With `@module-federation/enhanced` this collapses to one
`loadRemote('checkout/mount')` call — prefer it; hand-rolling is only for understanding.

## Consuming a remote

A remote module loads asynchronously, so consumption is always async — render a fallback
while the chunk arrives, and an error boundary so one slice can't blank the page.

```jsx
// React: lazy + Suspense + an error boundary = a resilient slice mount
import { lazy, Suspense } from 'react';
const Cart = lazy(() => import('checkout/Cart')); // 'checkout/Cart' = remote scope / exposed key

<SliceErrorBoundary fallback={<CartUnavailable />}>  {/* one slice down ≠ page down */}
  <Suspense fallback={<CartSkeleton />}>
    <Cart />
  </Suspense>
</SliceErrorBoundary>
```

```js
// Non-React shell: consume the framework-agnostic export — no React in the host at all
const { mount } = await import('checkout/mount');
const unmount = mount(document.getElementById('cart-slot'), { sku });
// call unmount() on route change so the slice tears down its own listeners
```

This is why the remote exposes `./mount` and `./api` alongside `./Cart`: the shell stays
framework-agnostic, matching the principle *shell owns layout, slices own their content area*.

## The shared-singleton pitfalls

Sharing exists to avoid two copies of a stateful library at runtime. Two failure modes:

- **Duplicate framework instances** — without `singleton: true`, host and remote each load
  their own React. Hooks throw *"Invalid hook call"*, context reads return `undefined`,
  `instanceof` checks fail across the boundary. Cause: any library with module-level state
  must be a single instance.
- **Version-mismatch runtime errors** — `singleton: true` forces one instance, but if the
  versions are incompatible Module Federation logs a warning and uses the highest loaded —
  which can break the slice built against the other major. Set `requiredVersion` to fail
  loudly (or `strictVersion: true` to hard-error) instead of limping on a wrong version.

**Mark as `singleton` every library that holds module-level state shared across the
boundary**, not just the framework:

- the framework (`react`/`react-dom`, `vue`, `@angular/core`)
- the **router** (`react-router-dom`, `vue-router`) — two router instances fight over `history`
- any **context/provider/store** lib crossing slices (`@tanstack/react-query`, `redux`,
  `styled-components`/`emotion` — duplicate emotion = duplicate `<style>` + class hash drift)
- i18n / theme providers whose context the slices read

Leaf utilities with no shared state (`lodash`, `date-fns`) need no `singleton` — let each
slice bundle its own; forcing a singleton there just adds version-negotiation failure
surface for no benefit.

<details>
<summary>Tooling notes</summary>

- **`@module-federation/enhanced`** — an enhanced layer over the built-in Webpack
  `ModuleFederationPlugin`. Adds a typed runtime (`loadRemote`/`registerRemotes`),
  dynamic remotes without the manual `__webpack_init_sharing__` dance, a generated
  `mf-manifest.json`, runtime plugins (retry, fallback), and TypeScript types for remotes
  (`@module-federation/dts-plugin`). Prefer it when you want that typed runtime + dynamic
  remotes instead of hand-rolling the share-scope dance.
- **Rspack** is a drop-in: same `ModuleFederationPlugin` API, import from
  `@module-federation/enhanced/rspack`. Federation configs port across Webpack and Rspack
  unchanged — only the bundler binary differs.
- **Vite** uses **`@originjs/vite-plugin-federation`** (community). Caveat: Vite serves
  native ESM in dev, so federation works smoothly only against a **built** remote
  (`vite build` + preview) — `vite dev` for a *consumed* remote is rough. `shared` semantics
  match but are less battle-tested than Webpack/Rspack; for heavy cross-slice sharing, host
  on Rspack.
- `@module-federation/enhanced` ships a **standalone federation runtime** (the
  `mf-manifest.json` + runtime plugins) layered over the original Webpack-bundled design —
  that runtime is what enables manifest-driven dynamic remotes and runtime retry/fallback.
</details>
