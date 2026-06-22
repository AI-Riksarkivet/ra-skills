# Principles and best practices

The [micro-frontends.org](https://micro-frontends.org/) principles plus hard-won practices from shipping composed pages. These are the rules that keep independently built and deployed slices from colliding, bloating, or blanking the page. The single technique that prevents most production incidents is **team prefixes** — read that section even if you skip the rest.

## Contents

- [Be team-first](#be-team-first)
- [Tech-agnostic but governed](#tech-agnostic-but-governed)
- [Isolate team code](#isolate-team-code)
- [Establish team prefixes](#establish-team-prefixes)
- [Favor native browser features](#favor-native-browser-features)
- [Build a resilient page](#build-a-resilient-page)
- [Shell owns layout, auth, top-level routing](#shell-owns-layout-auth-top-level-routing)
- [Start with a monolith](#start-with-a-monolith)
- [Monitor aggregate bundle size](#monitor-aggregate-bundle-size)
- [Integration-test the composed page](#integration-test-the-composed-page)
- [Observe per slice](#observe-per-slice)
- [Versioned contracts between slices](#versioned-contracts-between-slices)

## Be team-first

Organize by **team / business domain**, not by technical layer. A slice is a vertical cut — its own UI down to its own API — owned end to end by one team (`checkout`, `search`, `product`). The horizontal split (one team owns "all the React", another "all the CSS", a third "the API") is the anti-pattern micro-frontends exist to replace: every feature then needs three teams to coordinate.

- **Why:** Conway's Law — your architecture will mirror your org chart whether you plan for it or not. Make the boundaries match the teams *deliberately* so a feature ships within one team's four walls.
- **Decision criterion:** if a typical feature touches more than one slice, your boundaries are wrong — they're cutting across a domain instead of along it.

## Tech-agnostic but governed

Each team picks its own stack (framework, build tool, test runner) so they can upgrade and hire independently. Autonomy stops at the **user experience**: a single page assembled from five frameworks must still look and feel like one product.

- Govern UX with a **shared design system**: a versioned component library *plus* design tokens exposed as CSS custom properties, so a slice in any framework consumes the same primitives.

```css
/* tokens.css — loaded once by the shell; every slice reads these, framework-agnostic */
:root {
  --brand-color-primary: #0b5fff;
  --brand-space-md: 0.75rem;   /* one spacing scale, not five */
  --brand-radius: 4px;
}
```

- **Why:** tokens-as-CSS-variables are the lowest-common-denominator contract — a React, Svelte, or vanilla-web-component slice all honor `var(--brand-color-primary)` with zero shared JavaScript runtime. Ship the component library as web components when teams disagree on framework; ship it as per-framework packages when they don't.
- **Tradeoff:** total framework freedom multiplies aggregate bundle size (see [Monitor aggregate bundle size](#monitor-aggregate-bundle-size)). "Govern the *number* of allowed frameworks" is a legitimate constraint — agnostic-in-principle does not mean unbounded-in-practice.

## Isolate team code

A slice must not depend on another slice's runtime or leak into the global scope. No reaching into another team's DOM, no shared mutable globals, no assuming load order.

- **No global leakage:** scope CSS (Shadow DOM, CSS Modules, or a prefix — see below); never attach to `window.X` for another slice to read. Communicate through explicit channels ([Versioned contracts](#versioned-contracts-between-slices)), not shared globals.
- **Lazy- and duplicate-safe:** a slice may be instantiated zero, one, or many times on a page, and may load before or after its siblings. Initialization must be idempotent and must not assume a sibling is already present.
- **Why:** independent deploy means you cannot know at build time which version of which sibling is on the page. Any cross-slice assumption becomes a production-only race condition that no slice's own test suite catches.

## Establish team prefixes

**This is the practice that prevents collisions.** Agree up front — before the first slice ships — on a per-team prefix and apply it to every global-ish name a slice introduces:

| Surface | Convention | Example (team `checkout`) |
|---|---|---|
| Custom-element tags | `team-*` | `<checkout-cart>`, `<checkout-button>` |
| CSS classes | `.team-*` | `.checkout-summary` |
| CSS custom properties | `--team-*` | `--checkout-accent` |
| Events | `team:*` | `checkout:item-added` |
| localStorage / cookies | `team:*` | `checkout:session` |
| Static-asset URLs | `/team-*` (or `vc-ap-<hash>`) | `/checkout-assets/main.js` |

```js
// A slice dispatches a namespaced event — no other team can collide on this name.
window.dispatchEvent(new CustomEvent('checkout:item-added', { detail: { sku, qty } }));
```

- **Why:** the global namespaces — custom-element registry, CSS cascade, `window` event names, storage keys — are shared by every slice on the page and have **no scoping mechanism of their own**. A prefix is the only thing standing between two teams that both, reasonably, wanted to call something `item-added` or `.button`. Custom-element names *must* contain a hyphen anyway (per the spec), so `checkout-` costs nothing.
- **Make it mechanical:** put the prefix in a lint rule (a custom ESLint/Stylelint rule, or a CI grep) so a violation fails the build rather than surfacing as a render glitch in production.

## Favor native browser features

Prefer platform primitives over a bespoke framework or message protocol: **custom elements** for embedding, **`CustomEvent`** for communication, and **the URL** for shared state.

- **Why:** native features need no shared runtime — every slice already has the DOM, regardless of its framework or version. A custom orchestration framework becomes a shared dependency that every team must upgrade in lockstep, recreating the coupling micro-frontends were meant to remove.
- **The URL is shared state you already have:** put cross-slice state (current product id, search query, selected tab) in the URL/query string. Every slice can read it on load, it survives refresh, it's deep-linkable, and it requires no JS bus.

```html
<!-- The shell embeds a slice declaratively; attributes are the input contract, events the output. -->
<checkout-cart sku="A123" locale="sv-SE"></checkout-cart>
```

- **Escape hatch:** reach for Module Federation `shared` singletons or an import map only when teams have *already* standardized on a bundler/framework and the duplicate-React cost is measured and real — not by default.

## Build a resilient page

A slice's JavaScript *will* fail to load, error, or arrive slowly. The page must still work, or degrade gracefully, when it does.

- **Universal rendering + progressive enhancement:** server-render a working baseline (links and forms that function without JS), then hydrate to enhance. A slice whose JS never arrives still shows server-rendered content.
- **Server-side composition needs per-fragment timeouts and fallbacks:** when the shell assembles fragments server-side (SSI/ESI, Podium/Tailor), give each fragment a timeout and a fallback snippet. One slow upstream must not hold the whole response hostage.

```nginx
# ESI include with a timeout + alt fallback — a slow/failed slice degrades instead of blanking the page.
<esi:include src="/fragments/recommendations" alt="/fragments/recommendations-fallback" onerror="continue" />
```

  (`alt`/`onerror` are Akamai/Fastly; Varnish honors only `src` — handle a failed fragment in VCL there.)

- **Client-side composition needs error boundaries:** wrap each mounted slice so its crash is contained to its own region, never propagating to blank sibling slices or the shell.
- **Why:** with N independently deployed slices, the probability that *all* are healthy on any given request is the product of N availabilities — it only goes down as you add teams. Resilience is not optional at scale; it is the cost of independence.

## Shell owns layout, auth, top-level routing

The **shell** (host) is itself a small, owned application. Its job is strictly the frame: global layout (header, nav, footer regions), authentication/session, and **top-level routing** — deciding which slice owns the current URL and mounting it. Slices own only the content area handed to them.

- **Two-level routing:** the shell routes to a slice; the slice routes *within* its own area. Keep these levels distinct — the shell must not know a slice's internal routes, and a slice must not rewrite the shell's chrome.
- **Why:** a clear shell/slice contract is what lets slices deploy without redeploying the shell. Blur it — let a slice paint the header, or the shell deep-link into slice internals — and you have recreated the coupling you were trying to escape.

## Start with a monolith

Build a single deployable frontend first. Extract a slice only when you hit **real organizational pain**, not anticipated pain.

- **Extract when you observe:** release coordination overhead (teams blocked waiting on each other's merges/deploys), frequent merge conflicts in shared files, or one team's bug repeatedly breaking another's feature.
- **Why:** micro-frontends are an *organizational* solution with a real runtime and tooling tax (aggregate bundle, cross-slice integration tests, a shell, contract versioning). With one or two teams you pay the tax and collect none of the autonomy. A code-split monorepo solves the technical problem; only the *people* problem justifies the split.

## Monitor aggregate bundle size

Measure the size of the **composed page**, not each slice in isolation. The failure mode of runtime composition is shipping the same framework N times — five slices each bundling their own copy of React is five copies over the wire.

- **Shared-vendor strategy (Geers ch. 11):** publish common heavy dependencies (the framework, a date library) as a **shared vendor bundle** the slices reference rather than bundle, so it's downloaded and cached once. With Module Federation, the equivalent is declaring those deps as `shared` **singletons** so exactly one copy loads at runtime.

```js
// Module Federation: load React once across all slices, fail loudly on version drift.
shared: {
  react: { singleton: true, requiredVersion: '^18.2.0', strictVersion: true },
  'react-dom': { singleton: true, requiredVersion: '^18.2.0' },
}
```

- **Why:** independent deploy makes duplicate vendors *invisible* in any single slice's metrics — each slice looks fine alone, while the assembled page ships megabytes of redundant framework. Set a budget on the composed page and alert in CI when it regresses.
- **Tradeoff:** a shared singleton reintroduces a coupling — all sharers must tolerate one framework version. That is the deliberate, bounded coupling you accept in exchange for not shipping the framework five times.

## Integration-test the composed page

Test slices **assembled together**, not only in isolation. A slice's own green test suite proves nothing about its behavior next to siblings it has never seen.

- **What only composition tests catch:** prefix collisions, duplicate custom-element registration, event-name mismatches, CSS bleed across slices, broken cross-slice navigation — every failure mode that exists *because* of integration.
- **Provide a local-dev story (Geers ch. 14):** a developer working on one slice must be able to run it inside a realistic shell without standing up every other team's service. Provide either a **sandbox shell per slice** (the slice plus a thin host), **mocked siblings** (static stand-ins for adjacent fragments), or — for routing/zones setups — a **local proxy that falls back to production** (run only your slice; the proxy serves the rest of the page from the live deployment, see [routing-and-orchestration.md](routing-and-orchestration.md#edge--zones-routing-config-driven-independently-deployed)).
- **Why:** without a local composition harness, the *only* place slices meet is production, and integration bugs are found by users. The harness moves that meeting point left to the developer's machine.

## Observe per slice

A composed page fails in production *per slice*, and a generic error report can't say *which* team's slice broke. Attribute observability the way you attribute everything else — by team prefix.

- **Tag client errors and RUM with the owning team** (a `team` dimension on every error/metric), so an alert names the slice, not just "the page" — and routes to the team that can fix it.
- **The shell reports slice-mount failures.** When a slice's bundle fails to load or its mount throws, the shell (which caught it in an error boundary / `<script onerror>`) is the only party that can log *which* slice failed and that it fell back. No slice can report its own failure-to-load.
- **Why:** independent deploy means failures are localized to a slice but invisible in aggregate page metrics; per-slice attribution is what turns "the page is slow/broken" into an actionable, owned alert.

## Versioned contracts between slices

Every cross-slice interface — event names + `detail` payloads, custom-element attribute/property APIs, Module Federation `exposes` — is a **public, versioned API**. Because slices deploy independently, a producer and consumer are never guaranteed to run the same version, so a change carries the same backward-compatibility obligation as a REST endpoint: additive only; a breaking change gets a new name + a deprecation window. Keep a small reviewed registry (a shared types package or a contract doc) of every published event/attribute/module so a break is a visible PR, not a silent production failure.

→ Typing, the dual-publish pattern, and worked examples: [communication.md → Event contracts are public API](communication.md#event-contracts-are-public-api).
