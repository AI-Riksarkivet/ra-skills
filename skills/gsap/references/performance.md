# GSAP Performance

Keep animation on the compositor and off the layout/paint path.

## Animate transforms & opacity, not layout

- Use **`x`/`y`/`scale`/`rotation`** (transform aliases) instead of `top`/`left`/`width`/`height`/
  `margin`. Transforms are GPU-composited; layout props force reflow every frame.
- Use **`autoAlpha`** instead of `opacity` when the element should also be non-interactive at 0.
- To resize, animate `scaleX/scaleY` and correct children, rather than `width`/`height`.

## `will-change` sparingly

Hint the browser only for elements actively animating (`will-change: transform`), and remove it when
done — leaving it on everything wastes memory. GSAP sets compositor-friendly transforms already; add
`will-change` only if you measure jank.

## Many elements: batch

For dozens of scroll-revealed elements use **`ScrollTrigger.batch()`** (see `scrolltrigger.md`)
rather than one ScrollTrigger each — it groups callbacks and staggers them together.

## ScrollTrigger specifics

- **Scrub smoothing:** `scrub: 0.5–1` adds a catch-up lag that also smooths jank.
- **`fastScrollEnd`** / **`preventOverlaps`** help when many triggers fire in quick succession.
- Avoid animating **pinned** elements directly — pin a wrapper, animate children.
- Call **`ScrollTrigger.refresh()`** after layout shifts (not per frame) so positions are correct.

## Stagger instead of N tweens

One tween with `stagger` is cheaper and easier to control than many separate tweens/timeouts.

## SvelteKit / SSR

- All GSAP work is client-only (`onMount`/`$effect`/`{@attach}`) — it never runs during SSR, so it
  never blocks first paint. See `svelte.md`.
- Lazy-import rarely-used plugins so they stay out of the initial bundle (`plugins.md`).
- Keyed `{#each}` prevents GSAP from animating nodes Svelte recycled.

## Accessibility is a performance budget too

Gate motion behind `gsap.matchMedia()` `(prefers-reduced-motion: no-preference)` — reduced motion
means **less work** as well as a better experience for those users.

## Quick checklist

- [ ] transforms + autoAlpha, not layout props
- [ ] `stagger` / `ScrollTrigger.batch()` for many elements
- [ ] `ease: 'none'` on scrubbed tweens
- [ ] revert on destroy (no orphaned ScrollTriggers)
- [ ] `refresh()` after layout changes, not every frame
- [ ] reduced-motion gate
- [ ] no `markers: true` in production
