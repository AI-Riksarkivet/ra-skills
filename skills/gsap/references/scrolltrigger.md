# ScrollTrigger

Scroll-linked animation: trigger, scrub, pin. A plugin — register it once (done in
[`../assets/gsap.ts`](../assets/gsap.ts)):

```js
import { gsap, ScrollTrigger } from '$lib/gsap'; // already registered there
```

## Basic trigger

```js
gsap.to('.box', {
	x: 500,
	scrollTrigger: {
		trigger: '.box',
		start: 'top center',   // trigger-top hits viewport-center
		end: 'bottom center',
		toggleActions: 'play none none reverse'
	}
});
```

**start/end** are `"triggerPos viewportPos"` (`"top 85%"`, `"center center"`), a pixel number, or a
function. Relative: `"+=300"`, `"+=100%"`, `"max"`. Wrap in `clamp(...)` (v3.12+) to keep within
page bounds: `start: 'clamp(top 85%)'`.

## Key options

| Option | Meaning |
|---|---|
| `trigger` | element whose position drives the trigger (required, or use shorthand `scrollTrigger: '.sel'`) |
| `start` / `end` | enter/leave thresholds (defaults `"top bottom"` / `"bottom top"`) |
| `scrub` | `true` = tie progress to scroll; number = seconds of catch-up lag |
| `toggleActions` | onEnter/onLeave/onEnterBack/onLeaveBack, e.g. `"play none none reverse"` |
| `pin` | `true` pins the trigger while active (pin a wrapper, animate children) |
| `pinSpacing` | default `true` (adds spacer); `false` to manage layout yourself |
| `markers` | `true` for dev markers — **remove in production** |
| `scroller` | scroll container if not the viewport |
| `once` | kill the trigger after it completes once |
| `snap` | snap progress to increments / labels / array |
| `containerAnimation` | tie to a horizontal tween (fake horizontal scroll) |
| `onEnter`/`onLeave`/`onUpdate`/`onToggle` | callbacks receiving the ScrollTrigger instance |

Use **`scrub` OR `toggleActions`**, not both (scrub wins).

## Standalone

```js
ScrollTrigger.create({
	trigger: '#section',
	start: 'top top',
	end: 'bottom 50%',
	onUpdate: (self) => console.log(self.progress.toFixed(2), self.direction)
});
```

## `ScrollTrigger.batch()` — many elements, few triggers

Great for "reveal each card as it enters". Batched callbacks receive **arrays**:

```js
ScrollTrigger.batch('.card', {
	start: 'top 85%',
	onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, stagger: 0.1, overwrite: true }),
	onLeaveBack: (els) => gsap.set(els, { autoAlpha: 0, y: 50, overwrite: true })
});
```

(The `reveal({ stagger })` attachment in [`../assets/attachments.ts`](../assets/attachments.ts) is
the per-container version of this.)

## Pinning & scrub

```js
scrollTrigger: { trigger: '.section', start: 'top top', end: '+=1000', pin: true, scrub: 1 }
```

## Fake horizontal scroll (`containerAnimation`)

Pin a section; scrolling vertically moves content horizontally. The horizontal tween **must** use
`ease: 'none'` or scroll position and content position won't line up:

```js
const sections = gsap.utils.toArray('.panel');
const scrollTween = gsap.to(sections, {
	xPercent: -100 * (sections.length - 1),
	ease: 'none',
	scrollTrigger: { trigger: '.track', pin: true, scrub: 1, end: '+=3000' }
});
// triggers based on horizontal movement reference the container animation:
gsap.from('.panel .title', {
	autoAlpha: 0,
	scrollTrigger: { containerAnimation: scrollTween, trigger: '.panel .title', start: 'left center' }
});
```

Pinning and snapping are not available on `containerAnimation` triggers.

## Refresh & cleanup (critical in SvelteKit)

- **`ScrollTrigger.refresh()`** recomputes positions after layout changes. Call it in
  `afterNavigate` and after async content settles (after `await tick()`). Resize is auto-handled.
- **Cleanup:** a ScrollTrigger that outlives its element keeps firing on a detached node. In Svelte,
  create triggers inside `gsap.context()` / `gsap.matchMedia()` and `revert()` on destroy — the
  templates do this. To kill manually:

```js
ScrollTrigger.getAll().forEach((t) => t.kill());
ScrollTrigger.getById('my-id')?.kill();
```

## Best practices

- Register once; put `scrollTrigger` on timelines/top-level tweens, never on child tweens.
- `ease: 'none'` for any scrubbed or `containerAnimation` tween.
- Create triggers top-to-bottom in page order, or set `refreshPriority` so they refresh in order.
- Never leave `markers: true` in production.
