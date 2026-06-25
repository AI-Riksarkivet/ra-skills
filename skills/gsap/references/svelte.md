# GSAP with SvelteKit 2 + Svelte 5

The heart of this skill. Everything here assumes **Svelte 5 (runes)** and **SvelteKit 2**.
GSAP is framework-agnostic, so there is no `@gsap/react`-style package for Svelte — you use
GSAP's own primitives (`gsap.context()`, `gsap.matchMedia()`) plus Svelte's lifecycle and the
`{@attach}` directive.

## Install

```bash
npm i gsap            # the whole library + every plugin, free, no auth token
npm i lenis           # optional: smooth scrolling (see "Smooth scroll" below)
```

GSAP and all plugins are free since Webflow acquired GreenSock — install from the **public** npm
package. No Club membership, no `.npmrc`, no private registry. See `plugins.md`.

## The one rule that matters: register once, clean up always

1. **Register plugins once**, on the client, in a shared module — `$lib/gsap.ts`
   (see [`../assets/gsap.ts`](../assets/gsap.ts)). Import `{ gsap, ScrollTrigger }` from there.
2. **Create** animations after the DOM exists (in `onMount`, `$effect`, or a `{@attach}` factory).
3. **Revert** them when the element/component is destroyed. A `ScrollTrigger` that outlives its
   element is the #1 GSAP-in-SPA bug: it keeps firing on a detached node.

`gsap.matchMedia()` and `gsap.context()` both give you that revert for free — prefer them over
hand-killing tweens.

## Three ways to wire GSAP into a component

### 1. `{@attach}` — the modern, idiomatic choice (Svelte 5.29+)

An *attachment* is a function `(node) => cleanup`. Put reusable animations in `$lib/attachments.ts`
(see [`../assets/attachments.ts`](../assets/attachments.ts)) and drop them onto any element:

```svelte
<script lang="ts">
	import { reveal, parallax } from '$lib/attachments';
</script>

<section {@attach reveal()}>…</section>
<ul {@attach reveal({ stagger: 0.1 })}>
	{#each items as item (item.id)}<li>{item.label}</li>{/each}
</ul>
<img src="/bg.jpg" alt="" {@attach parallax(80)} />
```

Why `{@attach}` beats `use:` actions and ad-hoc `onMount`:

- **Co-located** with the markup it animates, and **composable** (stack several on one element).
- **Re-runs when its arguments change** — `use:` actions do not. `{@attach reveal({ y })}` re-syncs
  if `y` changes.
- Returns a **cleanup** that you wire to `mm.revert()` / `ctx.revert()` — no leaks.
- Passes through wrapper components when you spread `{...props}`.

Convert a legacy `use:` action with `fromAction` from `svelte/attachments` if you have one.

### 2. `onMount` + `bind:this` — for timelines and refs

When you need an explicit timeline or references to specific nodes, use the imperative pattern in
[`../assets/Reveal.svelte`](../assets/Reveal.svelte). In Svelte 5 a DOM ref is just `$state`:

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { gsap } from '$lib/gsap';

	let root = $state<HTMLDivElement>();

	onMount(() => {
		const mm = gsap.matchMedia();
		mm.add('(prefers-reduced-motion: no-preference)', () => {
			if (!root) return;
			gsap
				.timeline({ scrollTrigger: { trigger: root, start: 'top 80%' } })
				.from(root.querySelectorAll('[data-reveal]'), { y: 24, autoAlpha: 0, stagger: 0.1 });
		});
		return () => mm.revert(); // onMount's return runs on destroy
	});
</script>

<div bind:this={root}> … </div>
```

### 3. `$effect` — when the animation depends on reactive state

Use `$effect` to (re)play an animation when a rune changes. `$effect` runs only in the browser and
re-runs when its tracked dependencies change; return a cleanup to revert.

```svelte
<script lang="ts">
	import { gsap } from '$lib/gsap';
	let open = $state(false);
	let panel = $state<HTMLDivElement>();

	$effect(() => {
		if (!panel) return;
		const tween = gsap.to(panel, { height: open ? 'auto' : 0, autoAlpha: open ? 1 : 0 });
		return () => tween.kill();
	});
</script>
```

Prefer `$effect` only for **state-driven** animation. For one-shot entrances and scroll reveals,
`{@attach}` or `onMount` is cleaner (no dependency tracking needed).

## SSR / prerendering (the SvelteKit trap)

GSAP runs in the browser only. SvelteKit renders components on the server (and at build time when
`prerender = true`), so:

- **Never** call `gsap.*` or `ScrollTrigger.*` at the top level of a `<script>` or in `load()`.
- Keep all GSAP calls inside `onMount` / `$effect` / `{@attach}` — these never run during SSR.
- In shared modules, guard side effects with `import { browser } from '$app/environment'`
  (that is why `$lib/gsap.ts` registers plugins inside `if (browser)`).
- Importing GSAP modules at the top level is fine — GSAP itself is import-safe; only *calling* into
  it during SSR breaks.

## Refresh after navigation and dynamic content

`ScrollTrigger` caches element positions. After the DOM changes it must recompute them:

- **Client-side navigation** swaps the page DOM → call `ScrollTrigger.refresh()` in `afterNavigate`
  (see [`../assets/+layout.svelte`](../assets/+layout.svelte)).
- **Async content** (data loaded, images/fonts) that shifts layout → call `ScrollTrigger.refresh()`
  after it settles. Use `await tick()` (from `svelte`) to wait for Svelte to flush DOM updates first.

Viewport resize is auto-handled (debounced 200ms); navigation and async content are not.

## Accessibility — `prefers-reduced-motion`

Wrap motion in `gsap.matchMedia()` with `(prefers-reduced-motion: no-preference)` so users who ask
for reduced motion get none, and you still get automatic cleanup. The attachments and component
templates already do this. Never ship large scroll/parallax motion that ignores this setting.

## Smooth scroll (Lenis) — optional

The community standard pairs GSAP with [Lenis](https://github.com/darkroomengineering/lenis). Wire
it in the root layout ([`../assets/+layout.svelte`](../assets/+layout.svelte)):

- Drive Lenis from **`gsap.ticker`** (`autoRaf: false`) so there is a single rAF loop.
- `lenis.on('scroll', ScrollTrigger.update)` so triggers track Lenis' position.
- Keep a **stable** rAF reference so `gsap.ticker.remove(raf)` actually removes it on destroy.

GSAP's own **ScrollSmoother** plugin is an alternative (also free now) — don't run both. See
`plugins.md`.

## Gotchas

- **`bind:this` ref is `undefined` until mount.** Guard with `if (!ref) return` inside callbacks.
- **Don't fight Svelte transitions.** Use GSAP *or* `transition:`/`animate:` on a given element,
  not both on the same property.
- **Keyed `{#each}`** (`{#each items as i (i.id)}`) so GSAP doesn't animate recycled nodes.
- **Event handlers that create tweens** (e.g. an `onclick` that runs `gsap.to`) live *outside* any
  context — kill those tweens yourself, or recreate them inside a `{@attach}`/`$effect` cleanup
  scope. (This is the Svelte equivalent of React's `contextSafe`.)
- **One registration module.** Registering the same plugin twice is harmless but scattering plugin
  imports across components bloats bundles and invites SSR mistakes — centralize in `$lib/gsap.ts`.

## Verified stack

This skill targets the versions in the reference template: **SvelteKit ^2.57, Svelte ^5.55,
gsap ^3.15, lenis ^1.3**, with `runes: true`. Patterns hold for any Svelte 5 / SvelteKit 2 project.
