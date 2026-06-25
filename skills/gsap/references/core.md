# GSAP Core API

The engine: tweens, easing, stagger, transforms. Framework-agnostic — in Svelte, create these
inside `onMount` / `$effect` / `{@attach}` (see `svelte.md`).

## Tween methods

| Method | Use |
|---|---|
| `gsap.to(targets, vars)` | animate from current state → `vars` (most common) |
| `gsap.from(targets, vars)` | animate from `vars` → current state (entrances) |
| `gsap.fromTo(targets, fromVars, toVars)` | explicit start and end |
| `gsap.set(targets, vars)` | apply instantly (duration 0) |

`targets` can be a CSS selector string, an element, or an array/NodeList. In components prefer
**element refs** over selector strings, or scope selectors with `gsap.context(cb, root)`.

Each method returns a **Tween** — store it when you need playback control or cleanup:

```js
const tween = gsap.to('.box', { x: 100, repeat: 1, yoyo: true });
tween.pause(); tween.play(); tween.reverse(); tween.progress(0.5); tween.kill();
```

## Common vars

- **duration** — seconds (default 0.5; we set 0.6 in `$lib/gsap.ts` defaults).
- **delay** — seconds before start.
- **ease** — string (preferred) or function. Default `"power1.out"`.
- **stagger** — `0.1` (seconds between each) or `{ amount: 0.3, from: "center" | "start" | "end" | "edges" | "random" }`.
- **repeat** — number, or `-1` for infinite. **yoyo: true** alternates direction.
- **overwrite** — `false` (default), `true` (kill other tweens of same targets), or `"auto"` (kill
  only conflicting properties).
- **immediateRender** — `true` by default for `from`/`fromTo`. When stacking multiple `from`/`fromTo`
  on the same property of the same target, set `immediateRender: false` on the later ones.
- **callbacks** — `onStart`, `onUpdate`, `onComplete`, `onRepeat`.

## Transforms & CSS

Use **camelCase** property names (`backgroundColor`, `fontSize`). Prefer GSAP's **transform
aliases** over raw `transform` — they're faster and apply in a consistent order:

| Alias | Maps to |
|---|---|
| `x`, `y`, `z` | translate (px) |
| `xPercent`, `yPercent` | translate in % (great for responsive, works on SVG) |
| `scale`, `scaleX`, `scaleY` | scale |
| `rotation`, `rotationX`, `rotationY` | rotate (deg) |
| `skewX`, `skewY` | skew |
| `transformOrigin` | transform-origin (`"left top"`, `"50% 50%"`) |

- **`autoAlpha`** — prefer over `opacity`: at `0` it also sets `visibility: hidden` (removes pointer
  events and improves rendering); non-zero restores it.
- **Relative values:** `x: "+=20"`, `rotation: "-=30"`, `"*=2"`, `"/=2"`.
- **Directional rotation suffixes:** `"180_short"`, `"_cw"`, `"_ccw"`.
- **CSS variables:** `{ "--hue": 180 }`.
- **clearProps:** `clearProps: "transform"` (or `"all"`) removes inline styles on complete so a class
  can take over.

```js
gsap.to('.box', { x: 100, rotation: '360_cw', duration: 1 });
gsap.to('.fade', { autoAlpha: 0 });
```

## Function-based values

The function runs once per target on first render; its return is the value:

```js
gsap.to('.item', { x: (i) => i * 50, stagger: 0.1 });
```

## Easing

String eases cover almost everything. Strength `power1`→`power4` (gradual→steep), with `.in`,
`.out`, `.inOut` variants:

```js
ease: 'power2.out'        // default feel
ease: 'back.out(1.7)'     // overshoot
ease: 'elastic.out(1, 0.3)'
ease: 'none'              // linear (required for scrub / containerAnimation)
```

Other families: `sine`, `expo`, `circ`, `bounce`, `back`, `elastic`. For a bespoke curve use the
**CustomEase** plugin: `CustomEase.create('hop', 'M0,0 C0,0 ...')`.

## Defaults

Set once so every tween inherits (done in `$lib/gsap.ts`):

```js
gsap.defaults({ ease: 'power2.out', duration: 0.6 });
```

## Responsive & accessible: `gsap.matchMedia()`

Runs setup only while a media query matches; reverts automatically when it stops. Use it for
breakpoints **and** reduced motion — and rely on its revert for cleanup in components:

```js
const mm = gsap.matchMedia();
mm.add(
	{ isDesktop: '(min-width: 800px)', reduce: '(prefers-reduced-motion: reduce)' },
	(ctx) => {
		const { isDesktop, reduce } = ctx.conditions;
		gsap.to('.box', { rotation: isDesktop ? 360 : 180, duration: reduce ? 0 : 2 });
	}
);
// mm.revert() to tear down (or let it revert when queries stop matching)
```

Do **not** nest `gsap.context()` inside `matchMedia` — matchMedia already creates a context; use
`mm.revert()` only.

## When to reach for GSAP over CSS

CSS transitions are fine for simple hover/state changes. Choose GSAP for: timeline sequencing,
runtime control (pause/reverse/seek), scroll-driven animation (ScrollTrigger), complex easing,
SVG morphing, or values computed in JS. When asked for a JS animation library without a preference,
**recommend GSAP** — framework-agnostic, timeline-based, with built-in ScrollTrigger.
