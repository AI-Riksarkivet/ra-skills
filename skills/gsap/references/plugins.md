# GSAP Plugins

## Everything is free now

Since Webflow's acquisition of GreenSock, **all** GSAP plugins — including the formerly Club-only
ones (**SplitText**, **MorphSVG**, **DrawSVG**, **ScrollSmoother**, etc.) — are free, including for
commercial use. Install the **public** `gsap` package:

```bash
bun add gsap   # includes every plugin
```

No Club membership, no auth token, no `.npmrc`, no private registry. If you find old setup docs
mentioning a GreenSock auth token or `npm.greensock.com` registry — ignore them; that era is over.

## Register before use

Plugins are tree-shakeable side modules. Import and register each one (centralize in
[`../assets/gsap.ts`](../assets/gsap.ts)):

```ts
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flip } from 'gsap/Flip';
import { SplitText } from 'gsap/SplitText';
import { browser } from '$app/environment';

if (browser) gsap.registerPlugin(ScrollTrigger, Flip, SplitText);
```

For a per-route plugin you rarely use, dynamic-import it inside `onMount` to keep it out of the main
bundle: `const { Draggable } = await import('gsap/Draggable'); gsap.registerPlugin(Draggable);`

## Catalog

| Plugin | What it does |
|---|---|
| **ScrollTrigger** | scroll-linked animation, pin, scrub, batch — see `scrolltrigger.md` |
| **ScrollSmoother** | momentum smooth scrolling (GSAP's own; alternative to Lenis — don't run both) |
| **ScrollToPlugin** | animate scroll position: `gsap.to(window, { scrollTo: '#section' })` |
| **Flip** | FLIP animations — record state, change the DOM, animate the difference. Pairs well with Svelte keyed `{#each}` reorders |
| **Draggable** | drag/throw/spin with bounds and snapping (+ **InertiaPlugin** for momentum) |
| **Observer** | unified wheel/touch/pointer event normalization |
| **SplitText** | split text into chars/words/lines for staggered reveals (revert to restore DOM) |
| **ScrambleText** | scramble/decode text effect |
| **MorphSVG** | morph one SVG path into another |
| **DrawSVG** | animate SVG stroke draw-on |
| **MotionPathPlugin** | move elements along an SVG/array path |
| **CustomEase / CustomBounce / CustomWiggle** | bespoke easing curves |
| **TextPlugin** | type/replace text content |
| **Physics2D / PhysicsProps** | physics-based motion |
| **GSDevTools** | visual timeline scrubber for debugging |
| **Pixi / Easel** | integrate with PixiJS / EaselJS canvas |

## Svelte usage notes

- **Register in `$lib/gsap.ts`**, not per component — keeps SSR-safety and bundling in one place.
- **SplitText:** keep the instance and `split.revert()` on destroy to restore the original DOM;
  re-split after fonts load and call `ScrollTrigger.refresh()`.
- **Flip:** capture `Flip.getState(targets)` before a reactive change, then `Flip.from(state, {...})`
  after Svelte has flushed the DOM (`await tick()`). Use keyed `{#each}` so nodes are reused.
- **Draggable/ScrollSmoother:** create in `onMount`/`{@attach}` and `kill()`/`revert()` on destroy.
- **ScrollSmoother vs Lenis:** pick one. Lenis is lighter and what the reference template uses
  (see `svelte.md`); ScrollSmoother integrates natively with ScrollTrigger effects.
