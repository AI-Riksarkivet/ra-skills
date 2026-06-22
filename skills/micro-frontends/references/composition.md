# Composition techniques

Every integration technique for assembling a page from independently shipped slices, and how to choose. The driving question is **where composition happens** — build-time, by **routing** whole apps, server-side, or client-side runtime. Pick the *latest* stage that still meets your isolation, SEO, and deploy-independence constraints; earlier stages are simpler but couple releases.

> **Routing-based composition (zones).** A fourth option sits between build-time and server-side: keep each slice a **standalone deployed app** and route *whole pages* to it by URL path at an edge/proxy layer (Vercel Microfrontends' `microfrontends.json`, Next.js Multi-Zones, or a plain reverse proxy). Boundaries are page-level, not fragment-level — the coarsest and simplest independent-deploy model, with **no shared runtime**. Its mechanics (config-driven path routing, asset prefixes, lockstep-free rollout, the local dev proxy) live in [routing-and-orchestration.md](routing-and-orchestration.md); compare it in the **Routing / zones** row of the decision matrix below.

## Contents

1. [Build-time composition](#1-build-time-composition)
2. [Server-side composition](#2-server-side-composition)
3. [Client-side runtime — web components / Shadow DOM (default)](#3-client-side-runtime--web-components--shadow-dom-default)
4. [Client-side runtime — iframes](#4-client-side-runtime--iframes)
5. [Client-side runtime — import maps](#5-client-side-runtime--import-maps)
6. [Module Federation](#6-module-federation)
7. [Decision matrix](#7-decision-matrix)

---

## 1. Build-time composition

Each slice ships as a versioned npm package (or a workspace member in a monorepo); the shell imports it and bundles everything together at build time.

```jsonc
// shell/package.json — slices pinned as deps; one webpack/Vite pass bundles them
{
  "dependencies": { "@team-checkout/cart": "2.4.1", "@team-search/box": "1.9.0" }
}
```

- **Win:** strong cross-slice types, tree-shaking, and a single optimized bundle (one set of vendor chunks, no duplicate framework). Best runtime performance of any technique.
- **Cost — coupled releases:** a slice change is only live once the shell re-installs, re-bundles, and redeploys. With pinned versions the shell can lag a slice by N versions, but there is **no independent deploy** — this is the defining tradeoff. A monorepo removes the publish step but not the shared-rebuild step.
- **Pick when:** type safety + bundle performance matter more than per-slice deploy cadence, and a small number of teams can coordinate a shared release train. This is the **recommended starting point** — adopt runtime techniques only when release coordination becomes the bottleneck.

---

## 2. Server-side composition

The server (or edge) stitches HTML fragments before the browser sees them. Gives an SEO-friendly, fast-first-paint baseline; client interactivity is layered on top afterward.

### SSI (Server-Side Includes, e.g. nginx)

```nginx
# nginx: enable SSI processing, then pull each team's fragment by URL at request time
location / {
    ssi on;
    ssi_silent_errors on;   # a failed include emits nothing, not an error page (see fallback below)
}
```

```html
<!-- shell template: nginx replaces this with the team's rendered HTML -->
<!--#include virtual="/team-checkout/fragment/cart" -->
```

### ESI (Edge-Side Includes)

Same model as SSI but evaluated at a CDN/edge (Varnish, Akamai, Fastly), so each fragment can be cached with its own TTL independently of the page. Use when fragments have very different cache lifetimes (a slow-changing header vs. a per-request cart).

```html
<!-- edge fetches + caches this fragment on its own TTL, independent of the page -->
<esi:include src="/team-checkout/fragment/cart" />
```

> **Edge support varies.** Varnish implements only `src` (no `alt`/`onerror` fallback — handle a failed fragment in VCL); Akamai and Fastly support `alt` + `onerror="continue"` for inline fallbacks. Confirm your edge before relying on ESI fallback attributes.

### Podium / Tailor (Node composition layer)

`ssi`/`esi` are declarative but dumb. **Podium** (FINN.no) and **Tailor** (Zalando) are Node libraries that fetch fragments (called *podlets* / *fragments*) over HTTP in parallel, inject per-fragment CSS/JS asset links, and expose explicit timeout + fallback hooks. Reach for these over raw SSI when you need parallel fetch, asset registration, or programmatic fallbacks.

### Universal (isomorphic) rendering

Each slice renders its HTML on the server for the **first paint** (SEO crawlers and slow devices get real content), then the same component **hydrates** in the browser to attach interactivity. This is server-side composition for the initial response plus client-side runtime composition for subsequent navigation — the two layers are complementary, not exclusive.

### Timeouts + fallbacks (resilience — required, not optional)

A server include is a synchronous dependency on another team's service. Without a timeout, one slow slice blocks the whole page. Always wrap an include with a bounded timeout and a static stub:

```nginx
# Bound how long the page waits on a slice, and substitute a stub when it is slow or down.
location /team-checkout/fragment/ {
    proxy_pass http://checkout-upstream;
    proxy_read_timeout 300ms;          # budget: the slice must answer fast or be skipped
    proxy_intercept_errors on;
    error_page 502 504 = /fallbacks/cart-stub.html;   # served instead of a hang or 5xx
}
```

The stub should be a usable degraded state (e.g. a "View cart" link that hard-navigates to the slice's own page), so the rest of the page renders even when one slice is unavailable. This realizes the skill's **resilient page** principle at the composition layer.

---

## 3. Client-side runtime — web components / Shadow DOM (default)

**Recommended default for runtime composition.** A team wraps its slice — whatever framework built it — in a [custom element](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements). The shell treats every slice as a plain HTML tag and stays framework-agnostic; the browser's element lifecycle is the integration contract, so no shared runtime is needed.

```js
// team-checkout/cart-element.js — one team's slice as a native custom element
class CheckoutCart extends HTMLElement {
  // inputs the shell can pass via attributes; changes re-trigger attributeChangedCallback
  static observedAttributes = ['sku', 'qty'];

  connectedCallback() {
    // Shadow DOM => the slice's CSS can't leak out and the page's CSS can't leak in
    this.shadow = this.attachShadow({ mode: 'open' });
    this.render();
  }
  attributeChangedCallback(name, _old, value) {
    // props-down: shell sets el.setAttribute('qty', '3') and the slice reacts
    if (this.shadow) this.render();
  }
  disconnectedCallback() {
    // MANDATORY cleanup: tear down framework root / listeners / timers, or you leak on route change
    this.app?.unmount?.();
  }
  render() {
    this.shadow.innerHTML = `<style>:host{display:block}</style>
      <button>${this.getAttribute('qty') ?? 1}× in cart</button>`;
  }
}
customElements.define('checkout-cart', CheckoutCart); // team-prefixed tag — never collides
```

```html
<!-- shell: composition is just markup -->
<checkout-cart sku="A-17" qty="2"></checkout-cart>
```

- **Style isolation tradeoff:** Shadow DOM blocks *all* outside CSS — including your shared design-system styles. Pass global design tokens **in** as inherited CSS custom properties (they pierce shadow boundaries):

  ```css
  /* shell defines tokens at :root; they cross every shadow boundary because custom props inherit */
  :root { --ds-color-accent: #0b5; }
  /* inside the slice's shadow root */
  button { background: var(--ds-color-accent); }
  ```

  Use `mode: 'open'` (not `'closed'`) so tooling, tests, and the shell can still reach `el.shadowRoot`; `closed` buys almost no real security and costs debuggability.
- **Events up:** dispatch a team-prefixed `CustomEvent` with `{ bubbles: true, composed: true }` so it crosses the shadow boundary to the shell (`checkout:item-added`). `composed: true` is required or the event stops at the shadow root.
- **Pick when:** teams use different frameworks (or want to upgrade independently) and you need style isolation without iframe costs. This covers most runtime cases.

---

## 4. Client-side runtime — iframes

The only technique giving **hard** CSS, JS-global, and security isolation — separate document, separate `window`, enforced by the browser. Reach for it **only when that isolation is mandatory** (embedding untrusted third-party slices, or strict PCI/regulatory separation).

Costs, all significant:

- **No shared DOM:** the slice can't participate in page layout (no overlays/tooltips/modals escaping the frame); sizing needs manual height syncing.
- **`postMessage`-only communication** — no shared objects, no direct calls; everything serializes across the boundary.
- **SEO, a11y, and UX damage:** content is harder for crawlers, focus/tab order and screen-reader flow break across frames, deep-linking and the back button don't compose, and each frame reloads its own framework (duplicated bytes).

If you only need *style* isolation, use Shadow DOM (§3) instead — it costs none of the above.

---

## 5. Client-side runtime — import maps

A native browser feature mapping bare specifiers to URLs, so the shell can load a slice's ES module by name without a bundler's federation plugin. Pairs naturally with web components: the import map resolves the module, the custom element is the mount point.

```html
<!-- native: 'import "checkout"' resolves to the team's independently deployed, versioned URL -->
<script type="importmap">
{ "imports": {
    "checkout": "https://cdn.example.com/checkout/v2.4.1/element.js",
    "vue":      "https://cdn.example.com/vendor/vue/3.4.21/vue.runtime.js"
}}
</script>
<script type="module">import 'checkout';</script> <!-- registers <checkout-cart> -->
```

- **Independent deploy** = repoint a slice (or shared-vendor) URL in the map and redeploy only the shell's map, not the slice's consumers.
- **Shared singletons** without a bundler: map `vue`/`react` to one URL so every slice resolves the *same* module instance (this is how you get a framework singleton the plain-import-maps way; Module Federation §6 automates the same goal).
- **Gotcha:** the map must precede the first **module** script and is static per page load; dynamic per-route maps need an injection step or the [`es-module-shims`](https://github.com/guybedford/es-module-shims) polyfill for older targets.

---

## 6. Module Federation

Webpack 5 / Rspack runtime that lets a host load code from independently built remotes and negotiate **shared dependency singletons** at load time — the bundler-native answer to "independent deploy + don't ship three copies of React."

→ Full host/remote/`exposes`/`remotes`/`shared` config and dynamic-remote loading: **[module-federation.md](module-federation.md)** (not duplicated here).

---

## 7. Decision matrix

| Technique | Style isolation | SEO | Independent deploy | Shared deps | Complexity |
|---|---|---|---|---|---|
| **Build-time** (npm / monorepo) | none (shared CSS scope) | yes (if SSR'd) | **no** — coupled rebuild | **best** — one bundle, dedup'd | low |
| **Routing / zones** (edge/proxy by path) | per-app, full reload at zone edges | **yes** (each zone SSRs its page) | **yes — fully independent deploys** | none (each zone ships its own) | low–med (asset prefixes, rollout) |
| **SSI / ESI** | none | **yes** (server HTML) | yes (per fragment URL) | duplicated per fragment | low–med (needs server/edge) |
| **Podium / Tailor** | none | **yes** | yes | per fragment, asset-registered | medium |
| **Universal rendering** | per framework | **yes** (first paint) | yes | shared via vendor bundle | high |
| **Web components / Shadow DOM** | **hard (CSS)** | partial (needs SSR/hydrate) | yes | manual (import map / federation) | medium |
| **iframes** | **hardest (CSS+JS+security)** | **poor** | yes | none (each frame reloads) | low to set up, high UX cost |
| **Import maps** | via paired web component | partial | yes (repoint URL) | yes (map to one vendor URL) | low–med |
| **Module Federation** | via paired web component | partial | yes | **automatic singletons** | medium–high |

**How to read it:** scan top-to-bottom and stop at the first row that satisfies your hard constraints (SEO? mandatory CSS/security isolation? framework mix?). Combine freely — universal rendering for first paint, web components + import maps (or Module Federation) for runtime hydration and shared singletons is the common production stack.
