# Cross-app communication

How independently-deployed slices talk to each other and to the shell.

## Contents

- [The core rule](#the-core-rule)
- [Parent/shell → child: attributes and props](#parentshell--child-attributes-and-props)
- [Child → parent: bubbling CustomEvent](#child--parent-bubbling-customevent)
- [Fragment ↔ fragment: window broadcast](#fragment--fragment-window-broadcast)
- [Shared event bus / observable](#shared-event-bus--observable)
- [URL as shared state](#url-as-shared-state)
- [Cross-origin: iframes and postMessage](#cross-origin-iframes-and-postmessage)
- [Choosing a pattern](#choosing-a-pattern)
- [Event contracts are public API](#event-contracts-are-public-api)

## The core rule

Slices are **built and deployed independently**. At runtime they share only one thing: the page. So they must not share in-memory state or import each other's runtime modules for data — a slice cannot reach into another slice's store, call its functions, or assume its objects exist, because either side can redeploy a different version at any moment.

Communicate **only through the platform** — the surfaces the browser guarantees both sides see identically:

- **DOM** — attributes/props (down), bubbling `CustomEvent` (up), `window` events (broadcast).
- **URL** — search params, the most decoupled shared state.
- **Storage** — `localStorage`/`sessionStorage` + the `storage` event, for persistence and cross-tab.

Every message across a slice boundary is a **versioned, typed contract**. Default to native browser events and the URL; reach for a shared package only for genuinely cross-cutting state (auth, theme). Mirrors the principle in SKILL.md: *favor native browser features over a custom framework*.

## Parent/shell → child: attributes and props

The shell passes inputs **down** as HTML attributes (or properties on a custom-element instance). The child re-renders when an observed attribute changes — this is the native input channel, no framework required.

```js
// In the child slice's custom element. Declare which attributes to watch...
class CheckoutBuyButton extends HTMLElement {
	// ...only names listed here trigger attributeChangedCallback
	static observedAttributes = ['sku', 'currency'];

	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue === newValue) return; // skip no-op writes
		this.render(); // re-render with the new input
	}
}
```

```html
<!-- Shell writes the input; changing the attr re-renders the child -->
<checkout-buy-button sku="t_porsche" currency="EUR"></checkout-buy-button>
```

Use attributes for **scalar inputs that change over time** (the current SKU, a locale). Two gotchas:

- HTML attributes are **strings only**. For arrays/objects, either set a DOM **property** (`el.cart = [...]`) instead of an attribute, or pass a JSON string and parse it — but a large JSON blob in an attribute is a smell; prefer a property or an event.
- `observedAttributes` is read **once** when the element is defined; it cannot be made dynamic.

For a server-composed page the same idea applies at the markup level: the shell renders the child's tag with attributes, and the child's script upgrades it in place.

## Child → parent: bubbling CustomEvent

The child emits **up** with a `CustomEvent` that bubbles; the shell (or an ancestor slice) listens. This is the inverse of attributes-down and the native answer to "callback props" across a boundary.

```js
// Child announces something happened. Name is TEAM-PREFIXED...
this.dispatchEvent(
	new CustomEvent('checkout:item-added', {
		bubbles: true, // travel up the DOM tree to the shell
		composed: true, // cross Shadow DOM boundaries (omit if not using shadow root)
		detail: { sku: 'porsche', qty: 1 } // the typed payload
	})
);
```

```js
// Shell listens once, high in the tree — catches events from any checkout slice
document.addEventListener('checkout:item-added', (e) => {
	miniCart.update(e.detail.sku, e.detail.qty);
});
```

- **Team-prefix the event name** (`checkout:item-added`, never bare `item-added`) so two independently-shipped slices never collide on a name.
- `bubbles: true` is what lets the parent listen at a single high-up node instead of binding to each child.
- Put the payload in `detail` and **type it** (see [contracts](#event-contracts-are-public-api)).

## Fragment ↔ fragment: window broadcast

Two slices that are **siblings** (no ancestor relationship) can't use bubbling-up / props-down. Broadcast on `window`: a pub-sub where any slice publishes and any slice subscribes, with no direct reference between them.

```js
// Publisher fragment (the product page) announces a change
window.dispatchEvent(
	new CustomEvent('checkout:item-added', { detail: { sku: 'porsche' } })
	// no bubbles needed — window is already the shared root
);
```

```js
// Subscriber fragment (the minicart), in a SEPARATE slice, listens
window.addEventListener('checkout:item-added', (e) => {
	minicart.add(e.detail.sku); // re-fetch its own count / re-render
});
```

This is the **minicart pattern** (Geers, *Micro Frontends in Action*, ch. 6): the product fragment owns "add to cart"; the minicart fragment, deployed separately, just listens on `window` and re-renders — neither imports the other. The two are coupled **only** by the event name and `detail` shape, which is exactly the contract you version.

For more than a couple of cross-slice events, wrap the same mechanism in a tiny shared bus so subscription/teardown is uniform:

```js
// A ~10-line shared bus — still just window events underneath
export const bus = {
	emit: (type, detail) => window.dispatchEvent(new CustomEvent(type, { detail })),
	on: (type, fn) => {
		const h = (e) => fn(e.detail);
		window.addEventListener(type, h);
		return () => window.removeEventListener(type, h); // return unsubscribe
	}
};
```

Always return and call an **unsubscribe** on teardown — slices mount/unmount on client-side route changes, and leaked `window` listeners accumulate across navigations.

## Shared event bus / observable

You can publish a richer bus — or an observable holding current state (e.g. an RxJS `BehaviorSubject` that replays the latest value to new subscribers) — as a **shared package** that every slice imports.

```js
// shared-auth package: a BehaviorSubject replays the current user to late subscribers
import { BehaviorSubject } from 'rxjs';
export const currentUser$ = new BehaviorSubject(null); // seeded null = "unknown yet"
```

This works, but understand the trade: a shared package is a **shared build/runtime dependency**, which is the one thing the [core rule](#the-core-rule) avoids. It couples slices to a version of the bus and (for module-singleton observables) requires every slice to resolve to the **same instance** (a `shared` singleton under Module Federation, or one import-map entry) — load two copies and the bus silently splits.

Use it **sparingly and only for cross-cutting state that genuinely all slices need**: auth/session, theme, feature flags. For everything domain-specific, prefer stateless `window` events or the URL. A `BehaviorSubject`'s replay-latest is the main reason to choose it over raw events: a slice that mounts *after* login still gets the current user.

**Auth/session propagation:** the **shell owns the token** (it handles login) and pushes identity *down* — as a prop/attribute, via single-spa `customProps` (see [routing-and-orchestration.md](routing-and-orchestration.md)), or as the sole writer of a `currentUser$` like the one above. Slices read it; they never run their own login or fetch their own session, so there is exactly one source of truth and one place to refresh/expire it.

## URL as shared state

The URL is the **most decoupled** shared-state channel: it's global, the browser owns it, it survives reloads, and it's deep-linkable. Make **search params the single source of truth** for shared, navigable state; the shell and every slice read and write them, and each reacts to changes independently.

```js
// Any slice writes shared state — no import of another slice required
const url = new URL(location.href);
url.searchParams.set('region', 'EU'); // shared selection lives in the URL
history.pushState({}, '', url); // update without a full reload
window.dispatchEvent(new PopStateEvent('popstate')); // nudge listeners to re-read
```

```js
// Any other slice reads the same source of truth and reacts
function syncFromUrl() {
	const region = new URL(location.href).searchParams.get('region');
	priceList.setRegion(region); // re-render from URL, not from a shared store
}
window.addEventListener('popstate', syncFromUrl); // re-read on every navigation
syncFromUrl(); // and once on mount
```

Wins: **deep-linkable** (paste the URL, get the same state), shareable, back/forward "just works", and no shared dependency. Constraints: it's a flat string namespace, so **team-prefix keys** when collision is possible (`checkout.step`), keep it small (URL length limits), and put **nothing secret** in it. This is the natural fit for routing-level state — see [routing-and-orchestration.md](routing-and-orchestration.md) for two-level routing where the shell owns the path and a slice owns its sub-route.

## Cross-origin: iframes and postMessage

When a slice runs in an **iframe** (hard isolation — see [composition.md](composition.md)), DOM events don't cross the boundary. Use `postMessage`, and **always check `origin`** on receipt — without the check, any page that frames you (or that you frame) can inject messages.

```js
// Shell → framed slice: target a specific origin, never '*'
iframe.contentWindow.postMessage(
	{ type: 'checkout:set-currency', currency: 'EUR' },
	'https://checkout.example.com' // explicit target origin, not '*'
);
```

```js
// Framed slice → shell: validate the sender before trusting the data
window.addEventListener('message', (e) => {
	if (e.origin !== 'https://shell.example.com') return; // reject foreign senders
	if (e.data?.type === 'checkout:set-currency') applyCurrency(e.data.currency);
});
```

Same contract discipline as `CustomEvent`: team-prefixed `type`, typed payload. The only additions are the origin allow-list on both ends and a target origin (never `'*'`) when sending.

## Choosing a pattern

| Pattern | Coupling | Use when |
|---|---|---|
| **Attributes / props down** | Low — DOM only | Shell feeds a child changing scalar inputs (SKU, locale). |
| **Bubbling `CustomEvent` up** | Low — DOM + name | Child tells an ancestor/shell something happened. **Default for child→parent.** |
| **`window` broadcast** | Low — name + payload | Sibling fragments, no DOM ancestry. **Default for fragment↔fragment.** |
| **Shared bus / observable** | High — shared package + singleton | Only cross-cutting current-state (auth, theme) where replay-latest matters. |
| **URL search params** | Lowest — platform-owned | Navigable, deep-linkable, shareable state. **Default for routing-level state.** |
| **`postMessage`** | Low — origin + name | Cross-origin / iframe boundaries only. |

Default to **events + URL**. Treat a shared bus as an exception you justify, not a baseline. Across the whole skill: **shell owns layout and top-level routing; slices own only their content**, so the shell is the natural hub for up-events and URL writes.

## Event contracts are public API

An event name and its `detail` shape are a **public, versioned contract** between teams — change them like you'd change a REST endpoint.

- **Type the payload** and ship the type so consumers can depend on it:

```ts
// Publish from the owning slice; subscribers import the type, not the runtime
export interface CheckoutItemAdded {
	sku: string;
	qty: number;
}
declare global {
	// Augment the surfaces you actually listen on: window for broadcasts, document for bubbled events.
	interface WindowEventMap { 'checkout:item-added': CustomEvent<CheckoutItemAdded>; }
	interface DocumentEventMap { 'checkout:item-added': CustomEvent<CheckoutItemAdded>; }
}
```

- **Namespace the name** with the owning team's prefix; the part before `:` says who owns the contract.
- **Version additively**: add optional fields, don't repurpose existing ones. For a breaking change, emit a **new event name** (`checkout:item-added.v2`) and dual-publish until consumers migrate — you cannot coordinate a synchronized deploy across independently-shipped slices.
- **Document every event a slice emits/consumes** as that slice's integration surface, the same way a service documents its API.

<details>
<summary>Legacy: the deprecated DOM <code>Event</code> constructors</summary>

Older code creates custom events via `document.createEvent('CustomEvent')` + `initCustomEvent(...)`. Both are deprecated — use the `new CustomEvent(type, { detail, bubbles })` constructor shown throughout this file. Framework `$emit`/synthetic-event systems (e.g. a component framework's own event layer) generally do **not** cross slice boundaries; emit a real DOM `CustomEvent` at the boundary instead.

</details>
