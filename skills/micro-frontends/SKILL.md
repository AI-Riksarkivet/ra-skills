---
name: micro-frontends
description: Composing one web UI from independently built and deployed frontends owned by separate teams. Covers the integration techniques (build-time, server-side, client-side runtime — iframes, web components, Module Federation, import maps), routing and orchestration (single-spa, app shell), cross-app communication, and the when-to-use tradeoffs. Use when splitting a frontend across teams, choosing between Module Federation / single-spa / server-side composition, integrating fragments from multiple apps, or migrating a frontend monolith incrementally.
---

# Micro-frontends

Micro-frontends extend microservices to the browser: each team owns a vertical slice (UI down to API) and ships it independently, then the slices compose into one page. You trade build-time simplicity for team autonomy — only worth it past a certain organizational scale.

## When to use this skill

- Deciding **whether** to adopt micro-frontends, or which composition technique fits.
- Wiring **Module Federation**, **single-spa**, **import maps**, or server-side fragment composition.
- Designing **cross-app communication** (events, shared state, URL) or a **shell/host** app.
- Migrating a frontend monolith incrementally (strangler-fig).

## The core decision: where does composition happen?

This choice drives everything else. Pick the latest stage that meets your constraints.

| Where | Techniques | Pick when | Cost |
|---|---|---|---|
| **Build-time** | npm packages, monorepo imports | strong type safety + one optimized bundle matter more than independent deploy | releases are coupled — every change redeploys the host |
| **Routing-based (zones)** | edge/proxy path routing — `microfrontends.json`, Next.js Multi-Zones, reverse proxy | each team deploys a *whole app* behind a URL path; you want the simplest independent deploy with **no shared runtime** and page-level boundaries are fine | hard nav between zones (soften with prefetch), duplicated shell/layout, asset-prefix collisions to manage |
| **Server-side** | SSI/ESI, Podium/Tailor, universal rendering | SEO + fast first paint are critical; you need **fragment**-level (sub-page) composition | needs server/edge infra; client interactivity layered on top |
| **Client-side (runtime)** | iframes, **web components**, **Module Federation**, import maps | true independent deploy + tech-stack freedom + fine-grained in-page composition | runtime overhead, larger aggregate bundle, harder shared deps |

**Defaults:** start build-time (a monorepo) and only move down when team-coordination pain justifies it. The simplest independent-deploy step up is **routing-based (zones)** — each app stays a standalone deployment and an edge/proxy stitches them by URL path; reach for server-side or runtime composition only when you need *fragment*- or *component*-level composition rather than whole-page boundaries. For runtime, prefer **web components** for framework-agnostic isolation (Shadow DOM) and **Module Federation** when teams share a bundler and want dependency singletons; use **iframes** only when hard security/CSS isolation outweighs their UX cost. See [composition.md](references/composition.md).

## Integration techniques → where to read

| Need | Read |
|---|---|
| All composition techniques compared (server-side, web components, iframes, import maps) + how to choose | [composition.md](references/composition.md) |
| Module Federation config: host/remote, `exposes`/`remotes`, `shared` singletons, dynamic remotes | [module-federation.md](references/module-federation.md) |
| Routing across apps: server-side reverse proxy, client-side app-shell, single-spa orchestration | [routing-and-orchestration.md](references/routing-and-orchestration.md) |
| Talking between apps: events up, props down, broadcast, shared event bus, URL-as-state | [communication.md](references/communication.md) |
| Principles + best practices: team ownership, prefixes, native-over-custom, resilience, governance | [principles.md](references/principles.md) |

## Non-negotiable principles (details in principles.md)

- **One team owns one slice, end to end.** Boundaries follow teams (Conway's Law), not technical layers.
- **Namespace everything with a team prefix** — custom-element tags, CSS classes, events, storage keys (`checkout:item-added`, not `item-added`) — so independently shipped slices never collide.
- **Favor native browser features over a custom framework** (custom elements, `CustomEvent`, the URL) — they survive framework churn and need no shared runtime.
- **A shell/host owns layout, auth, and top-level routing; slices own only their content area.**
- **Govern with a shared design system.** Team autonomy ≠ visual chaos.
- **Build a resilient page**: server-render a baseline, then hydrate; one slice failing must not blank the page (error boundaries + fallbacks).

## When NOT to use micro-frontends

- A single team owns the whole frontend, or the app is small-to-medium.
- A well-organized monorepo with code-splitting already solves it.
- You lack independent build/deploy/integration-test infrastructure.

Micro-frontends are an **organizational** solution. With one or two teams they add cost without the autonomy payoff — start with a monolith.

## Sources

Adapted from `Tyler-R-Kendrick/agent-skills` (MIT) and grounded in [Micro Frontends in Action](https://github.com/naltatis/micro-frontends-in-action-code) (M. Geers, MIT), [micro-frontends.org](https://micro-frontends.org/), and [Martin Fowler — Micro Frontends](https://martinfowler.com/articles/micro-frontends.html).
