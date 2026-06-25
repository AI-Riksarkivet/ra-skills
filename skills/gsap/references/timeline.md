# GSAP Timelines

A timeline sequences tweens and gives you one handle to control the whole sequence. Prefer a
timeline over chaining `delay` values.

## Create & sequence

```js
const tl = gsap.timeline({ defaults: { duration: 0.5, ease: 'power2.out' } });
tl.to('.a', { x: 100 })   // appended
  .to('.b', { y: 50 })    // after .a
  .to('.c', { autoAlpha: 0 });
```

Child tweens are **appended** by default. Pass `defaults` so every child inherits duration/ease.

## Position parameter

The third argument places a tween in time:

| Value | Meaning |
|---|---|
| `1` | absolute — at 1 second |
| `"+=0.5"` / `"-=0.2"` | relative to the timeline's current end |
| `"<"` | at the **start** of the previous tween |
| `">"` | at the **end** of the previous tween (default) |
| `"<0.2"` | 0.2s after the previous tween's start |
| `"label"` / `"label+=0.3"` | at/after a label |

```js
tl.to('.a', { x: 100 }, 0)
  .to('.b', { y: 50 }, '<')      // same start as .a
  .to('.c', { scale: 2 }, '-=0.1');
```

## Labels

```js
tl.addLabel('intro', 0)
  .to('.a', { x: 100 }, 'intro')
  .addLabel('outro', '+=0.5')
  .to('.b', { autoAlpha: 0 }, 'outro');
tl.play('outro'); // jump to a label
```

## Constructor options

`paused: true` (start paused, then `.play()`), `repeat`, `yoyo`, `onComplete`/`onUpdate`,
`defaults`, and `scrollTrigger` (drive the timeline with scroll — see `scrolltrigger.md`).

> The timeline's duration is determined by its **children** — `duration` on the constructor is not
> a child duration.

## Nesting

```js
const master = gsap.timeline();
const intro = gsap.timeline().to('.a', { x: 100 }).to('.b', { y: 50 });
master.add(intro, 0).to('.c', { autoAlpha: 0 }, '+=0.2');
```

## Control

`tl.play()`, `tl.pause()`, `tl.reverse()`, `tl.restart()`, `tl.seek('outro')`, `tl.time(2)`,
`tl.progress(0.5)`, `tl.timeScale(2)`, `tl.kill()`.

## With ScrollTrigger

Put `scrollTrigger` on the **timeline** (or a top-level tween), never on a child tween:

```js
gsap.timeline({ scrollTrigger: { trigger: '.section', start: 'top top', end: '+=2000', scrub: 1, pin: true } })
	.to('.a', { x: 100 })
	.to('.b', { y: 50 });
```

In Svelte, build timelines inside `onMount`/`{@attach}` and revert via `gsap.context()` /
`gsap.matchMedia()` on destroy (see `svelte.md`).
