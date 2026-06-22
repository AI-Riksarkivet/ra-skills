# Routing and orchestration

How navigation works across slices: who maps a URL to which slice, who owns history, and which orchestrator runs the lifecycle. The recurring rule: **one router owns the URL and `window.history`; slices request navigation, they never write history directly.**

## Contents

- [Server-side routing (reverse proxy)](#server-side-routing-reverse-proxy)
- [Edge / zones routing (config-driven, independently deployed)](#edge--zones-routing-config-driven-independently-deployed)
- [Client-side app-shell routing (flat vs two-level)](#client-side-app-shell-routing-flat-vs-two-level)
- [single-spa orchestration](#single-spa-orchestration)
- [Cross-cutting hazards](#cross-cutting-hazards)
- [Which to pick](#which-to-pick)

## Server-side routing (reverse proxy)

Each team owns a **path namespace** and ships an app/upstream behind it. A reverse proxy (nginx, Envoy, Traefik, a CDN/edge worker) maps `URL path -> owning upstream` by **longest-prefix-first**. No client-side JS framework is involved in the routing decision — the browser does a full document load per team boundary, and each team renders a complete page (header/footer come from a shared layout fragment composed via SSI/ESI, see composition.md).

```nginx
# Each location is a team-owned path namespace; longest prefix wins.
# Order matters: nginx picks the most specific prefix match.
location /checkout/ { proxy_pass http://checkout-team:3000; }  # checkout team
location /product/  { proxy_pass http://catalog-team:3000;  }  # catalog team
location /          { proxy_pass http://home-team:3000;     }  # default / landing
```

Properties:
- **Strongest isolation** — a full navigation discards the previous team's JS/CSS entirely; no shared runtime, no version skew, no leaked globals.
- **Best SEO + first paint** — each response is a real server-rendered document; deep-linking is free (the URL *is* the route).
- **Cost** — a hard reload at every team boundary (no SPA-style soft transition), so shared in-page state is lost across boundaries. Mitigate by keeping cross-team state in the URL or a cookie, not in memory.

Use this when teams are content-heavy, want zero shared client runtime, and a full reload at team boundaries is acceptable. It's the most resilient option: a team being down returns a 502 for *its* paths only, not a blank SPA.

## Edge / zones routing (config-driven, independently deployed)

The reverse-proxy idea, productized. Each slice is its **own standalone deployment** (its own pipeline, often its own domain), and a **config file** — not hand-written proxy rules — declares which URL paths each slice owns. An edge/routing layer reads that config on every request and forwards *whole pages* to the owning deployment. One slice is the **default app** (ships the config and serves unmatched paths); the rest are **child apps** that declare path patterns. This is Vercel Microfrontends (`microfrontends.json`) and Next.js **Multi-Zones**; the generic name is *zones*.

```jsonc
// microfrontends.json — lives with the default app; each slice owns path patterns, the rest falls through.
{
  "applications": {
    "web":  { "development": { "fallback": "web.vercel.app" } },  // default app: serves '/' + anything unmatched
    "docs": { "routing": [{ "paths": ["/docs/:path*"] }] }        // child app: owns /docs/**, deployed separately
  }
}
```

**Pick it for** the lowest-ceremony independent deploy: no Module Federation, no single-spa, no shared runtime — each slice is a normal app in any framework, shipped on its own cadence. **Cost:** boundaries are whole pages (a cross-zone link is a hard navigation — see below), and the shell/layout is duplicated per zone unless shared via a package or a shared header fragment.

### Asset prefixes (mandatory)

Independently-deployed apps serve static assets (`/_next/...`, `/assets/...`) from the **same** customer domain, so their URLs collide. Give each slice a unique **asset prefix** that namespaces its asset URLs (Vercel auto-generates `vc-ap-<hash>`; or set one explicitly). This is the [team-prefix principle](principles.md#establish-team-prefixes) applied to static assets — without it, two slices' bundles fight over `/assets/main.js`. Changing a prefix after deploy is not backward-compatible: route the new prefix in production *before* switching the field, or in-flight pages 404 their chunks.

### Rollout safety — deployments are not in lockstep

A routing-config change and the target slice's deploy ship **separately**, so:

- **Never route to a path the target can't serve yet.** Deploy the slice that handles `/new-section` *first*, confirm it's live, then merge the config that routes there — reversed, users hit 404s.
- **Gate risky routes behind a flag.** Instead of routing a path unconditionally, route it to the default app, which decides per request (in middleware, via a feature flag) whether to forward to the new slice — so you ramp 1% → 100% and **instant-rollback** by flipping the flag, no redeploy.

```ts
// default-app middleware: a flag decides whether '/checkout-v2' routes to the new slice yet.
const res = await runMicrofrontendsMiddleware({
  request,
  flagValues: { 'checkout-v2': async () => isEnabled(request) }, // any async () => boolean
});
```

### Soften cross-zone navigation

A link from one zone to another is a full document load (new app, new framework instance) — the price of page-level boundaries. **Prefetch** the destination on hover/viewport so the jump feels instant, and keep genuinely shared, high-frequency state (auth, cart count) in a cookie or the URL so it survives the reload.

### Local development — proxy + production fallback

Work on one slice without running every team's app: a **local dev proxy** reads the same routing config and stitches the page — requests for the slice you're running go to your local dev server; everything else **falls back to the deployed production** version. (`@vercel/microfrontends`' proxy auto-starts under `turbo run dev`; each app's dev server binds an auto-assigned port via `microfrontends port`; unmatched or not-yet-running slices resolve to their production `fallback`.)

## Client-side app-shell routing (flat vs two-level)

A persistent **shell** (host) loads once, owns the single `history` router, and swaps the active slice into a content region on route change — soft transitions, shared in-page state, no full reload. Two routing topologies (naltatis ch. 7):

**FLAT (single level)** — the shell maps *every* concrete path directly to a slice. One router, one routing table.

```js
// Shell owns the only router; each entry mounts one slice. Flat = exhaustive table.
const routes = {
  '/':                 () => mount('home',     '#content'),
  '/product/:id':      () => mount('catalog',  '#content'),  // catalog slice
  '/checkout':         () => mount('checkout', '#content'),  // checkout slice
  '/checkout/payment': () => mount('checkout', '#content'),  // still checkout
};
```

**TWO-LEVEL / two-tier** — the shell routes only on the **first path segment** to a team app, then *delegates*: the slice runs its **own internal router** for everything below. The shell knows `/checkout/**` belongs to checkout; it does not know or enumerate checkout's sub-routes.

```js
// Shell matches only the namespace; the slice owns everything under it.
const teams = {
  '/product': 'catalog',   // catalog slice routes /product/:id, /product/:id/reviews, ...
  '/checkout': 'checkout', // checkout slice routes /checkout, /checkout/payment, ...
};
function onNavigate(path) {
  const ns = '/' + path.split('/')[1];
  mount(teams[ns] ?? 'home', '#content');  // slice's internal router reads the full path
}
```

**When to pick which:**
- **Flat** — few routes, the shell legitimately needs to know all of them (e.g. for prefetch, breadcrumbs, analytics on every transition). Downside: every new sub-route a team adds requires a shell change → couples deploys. Violates "team owns its slice end to end" at scale.
- **Two-level (default for autonomy)** — a team adds/removes sub-routes inside `/checkout/**` and ships **without touching the shell**. This is the recommended split: the shell owns the *namespace boundary*, the slice owns its *interior*. The cost is two routers in play — see history ownership below, the **slice's router must not write `history` directly**, it must go through the shell's navigation API.

## single-spa orchestration

[single-spa](https://single-spa.js.org/) is a framework-agnostic **orchestrator**: a tiny root-config registers slices and runs their lifecycle as the URL changes. It does not do composition itself — it decides *which* registered app is active and calls its lifecycle functions. Pair it with import maps or Module Federation for the actual code loading (see composition.md / module-federation.md).

**Registration** — `registerApplication` takes the app's name, a loader, an `activeWhen` predicate, and `customProps` passed into every lifecycle call:

```js
// root-config: register each slice; single-spa mounts/unmounts on URL change.
import { registerApplication, start } from 'single-spa';

registerApplication({
  name: '@org/checkout',
  app: () => import('@org/checkout'),              // native dynamic import (resolved via import map / MF), lazy-loaded
  activeWhen: (location) => location.pathname.startsWith('/checkout'),  // namespace = two-level
  customProps: { authToken: () => store.token },   // shell-owned data injected into the slice
});
start();  // begin reacting to route changes; nothing mounts until called
```

**The lifecycle contract** — every registered app exports three async functions. single-spa calls them as `activeWhen` flips:
- `bootstrap()` — once, before first mount (one-time init).
- `mount(props)` — render into the DOM; called every time the app becomes active.
- `unmount(props)` — tear down + remove from the DOM; called every time it becomes inactive.

You rarely hand-write these — **adapters** generate them from a framework root component: `single-spa-react`, `single-spa-vue`, `single-spa-svelte`, `single-spa-angular`.

```jsx
// A slice's entry: the adapter turns a React tree into the bootstrap/mount/unmount triplet.
import singleSpaReact from 'single-spa-react';
import ReactDOMClient from 'react-dom/client';
import Root from './Root';

const lifecycles = singleSpaReact({ React, ReactDOMClient, rootComponent: Root });
export const { bootstrap, mount, unmount } = lifecycles;  // single-spa imports these
```

**Parcels** — framework-agnostic components mounted **off-route**, imperatively, anywhere (a modal, a cart widget in another team's header). Same `mount/unmount` contract but you control placement and timing instead of `activeWhen` — the escape hatch for "slice content that isn't a whole page."

**The layout engine** (`single-spa-layout`) — declares the page regions (header / main / footer) and which applications live where, in one HTML-ish template, so the shell isn't manual DOM-swapping. Use it once you have more than a couple of regions.

## Cross-cutting hazards

These bite specifically because *multiple* routers/slices coexist. The fix is always: **the shell owns the URL and history; slices request navigation.**

- **History ownership (the big one).** Exactly one router writes `window.history`. In two-level/single-spa setups a slice with its own router (React Router, vue-router, SvelteKit) must run in a mode where it **reads** `location` but **delegates writes** to the shell's navigate API (e.g. expose `props.navigate(path)` via `customProps`, or have the slice dispatch a `CustomEvent('shell:navigate', { detail: { path } })`). Two routers both calling `history.pushState` fight — duplicated entries, back button skipping or looping. Configure slice routers in "memory/controlled" mode where the framework allows.
- **Deep-linking.** A user can land on `/checkout/payment` cold (refresh, bookmark, shared link). The shell must resolve the *full* path to the right slice on initial load, then the slice must hydrate its own internal route from the same `location` — not assume it was navigated to from `/checkout`. Test every slice with a hard reload on a deep sub-route.
- **Shared layout.** Header/footer/nav are a shell concern, rendered once and persisted across slice swaps — never re-mounted per slice (re-mounting drops focus, scroll, and open menus). Slices render only into their content region.
- **Back/forward.** Because one router owns history, back/forward Just Work across slices *only if* slices never pushed their own entries behind its back. A soft transition between slices should produce exactly one history entry.
- **Scroll restoration.** SPA soft-navigation does **not** restore scroll for free (the browser only auto-restores on real document loads). Set `history.scrollRestoration = 'manual'` in the shell and restore scroll position per history entry yourself on `popstate`; otherwise back/forward lands mid-page. single-spa does not do this for you.

## Which to pick

Use **server-side routing** (reverse proxy + per-team path namespaces) when content/SEO and first paint dominate and you want server composition with zero shared client runtime — it's the most resilient and the cheapest to reason about, at the cost of a full reload per team boundary. Use **client-side app-shell routing** when you're building one cohesive SPA you control and want soft transitions + shared in-page state — and within it default to **two-level** routing so each team owns its sub-routes without touching the shell. Reach for **single-spa** when you need a framework-agnostic orchestrator to compose *several existing SPAs* (mixed React/Vue/Angular/Svelte) behind one shell — it gives you the lifecycle contract, adapters, parcels, and a layout engine that you'd otherwise hand-roll. In all three, keep history single-owned by the shell.
