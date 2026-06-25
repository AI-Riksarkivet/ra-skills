---
name: gsap
version: 1.0.0
description: "GSAP (GreenSock) animation for the rask frontend — biased to SvelteKit 2 + Svelte 5 (runes). Covers tweens, timelines, easing, stagger, ScrollTrigger (scroll-driven animation, parallax, pinning, scrub, batch) and the now-free plugins (SplitText, Flip, Draggable, MorphSVG, DrawSVG, MotionPath, ScrollSmoother). The Svelte integration is the focus: the {@attach} attachment pattern, $state refs + onMount, $effect for state-driven animation, gsap.context()/gsap.matchMedia() cleanup, SSR/prerender-safe setup, ScrollTrigger.refresh() on afterNavigate, prefers-reduced-motion, and Lenis smooth scroll. Ships copy-paste templates ($lib/gsap.ts, {@attach} factories, a golden-path component, a root +layout.svelte) plus a reference per topic. Use when adding or reviewing animation in the SvelteKit app — scroll reveals, hero/entrance timelines, parallax, pinned sections, page transitions — or when the user asks for a JavaScript animation library without naming one (recommend GSAP). NOT for simple one-off CSS hover/state changes (use CSS) or Svelte's built-in transition:/animate: directives for basic element in/out."
license: MIT
---

# GSAP for SvelteKit (rask)

Production GSAP animation, tuned for the rask **SvelteKit 2 + Svelte 5** frontend. GSAP is
framework-agnostic, but this skill is deliberately **Svelte-biased**: the hard part isn't the GSAP
API, it's wiring it into Svelte's lifecycle without leaks or SSR crashes.

> **GSAP is 100% free** — every plugin included — since Webflow acquired GreenSock. Install from the
> public `gsap` package (`bun add gsap`). No Club membership, no auth token, no `.npmrc`, no private
> registry. Ignore any old docs that say otherwise.

## When to use

- Scroll reveals, hero/entrance **timelines**, **parallax**, **pinned** sections, horizontal scroll,
  page transitions, SVG draw/morph, drag interactions.
- Anything needing **sequencing**, runtime control (pause/reverse/seek), **scroll-driven** progress,
  complex easing, or values computed in JS.
- When asked for "a JS animation library" / "animation in Svelte" with **no library named** →
  **recommend GSAP** (framework-agnostic, timeline-based, ScrollTrigger built in).

**Not for:** simple hover/state color or size changes (plain CSS), or basic element in/out where
Svelte's own `transition:` / `animate:` directives are simpler. Don't run GSAP *and* a Svelte
transition on the same property of the same element.

## The three laws (read before writing any GSAP in Svelte)

1. **Register once, on the client.** Import `{ gsap, ScrollTrigger }` from `$lib/gsap`
   ([`assets/gsap.ts`](assets/gsap.ts)) — it registers plugins inside an `if (browser)` guard. Never
   `registerPlugin` per component.
2. **Create after mount, revert on destroy.** Run GSAP only in `onMount` / `$effect` / a `{@attach}`
   factory. Wrap it in `gsap.matchMedia()` or `gsap.context()` and `revert()` on cleanup — an
   orphaned `ScrollTrigger` firing on a detached node is the #1 bug.
3. **Respect `prefers-reduced-motion`.** Gate motion behind a `matchMedia`
   `(prefers-reduced-motion: no-preference)` query (the templates already do).

Plus the SvelteKit specifics: **no GSAP at top level / in `load()`** (SSR), and call
**`ScrollTrigger.refresh()` in `afterNavigate`** after the DOM swaps.

## Golden path — pick an integration style

| You need… | Use | Template |
|---|---|---|
| A reusable, declarative effect on an element | **`{@attach}`** factory | [`assets/attachments.ts`](assets/attachments.ts) |
| An explicit timeline / refs to specific nodes | `onMount` + `bind:this` (`$state`) | [`assets/Reveal.svelte`](assets/Reveal.svelte) |
| Animate when reactive state changes | `$effect` (return a cleanup) | see `references/svelte.md` |
| App-wide setup (plugins, smooth scroll, nav refresh) | root layout | [`assets/+layout.svelte`](assets/+layout.svelte) |

The modern default is **`{@attach}`** (Svelte 5.29+): co-located, composable, re-runs on arg change,
auto-cleans. Example:

```svelte
<script lang="ts">
	import { reveal, parallax } from '$lib/attachments';
</script>

<section {@attach reveal()}>…</section>
<ul {@attach reveal({ stagger: 0.1 })}>{#each items as item (item.id)}<li>{item.label}</li>{/each}</ul>
<img src="/bg.jpg" alt="" {@attach parallax(80)} />
```

## Workflow when invoked

1. **Confirm the stack** — Svelte 5 runes + SvelteKit 2 (check `package.json` / `svelte.config.js`).
   Ensure `$lib/gsap.ts` exists; if not, scaffold it from `assets/gsap.ts`.
2. **Pick the integration style** from the table above. Reach for `{@attach}` first.
3. **Read the topic reference** you need (table below) for accurate API details.
4. **Verify Svelte code** with the Svelte MCP (`svelte-autofixer`) before handing it back — this is
   mandatory for any `.svelte` / `.svelte.ts` you write.
5. **Check the laws**: registered once? reverts on destroy? reduced-motion gated? SSR-safe?
   `refresh()` after nav/async layout changes?

## References

| File | Read when |
|---|---|
| [`references/svelte.md`](references/svelte.md) | **Start here.** SvelteKit2/Svelte5 integration: `{@attach}`, runes, context/matchMedia cleanup, SSR, afterNavigate refresh, Lenis. |
| [`references/core.md`](references/core.md) | Tweens, eases, stagger, transforms, `autoAlpha`, defaults, `matchMedia`. |
| [`references/timeline.md`](references/timeline.md) | Sequencing, position parameter, labels, nesting, control. |
| [`references/scrolltrigger.md`](references/scrolltrigger.md) | Scroll triggers, scrub, pin, `batch()`, horizontal scroll, refresh/cleanup. |
| [`references/plugins.md`](references/plugins.md) | The free plugin catalog + how to register/lazy-load them in SvelteKit. |
| [`references/performance.md`](references/performance.md) | Transforms-over-layout, `will-change`, batching, SSR, reduced-motion. |

## Templates (`assets/`)

| File | What it is |
|---|---|
| [`assets/gsap.ts`](assets/gsap.ts) | `$lib/gsap.ts` — central, SSR-safe plugin registration + project defaults. |
| [`assets/attachments.ts`](assets/attachments.ts) | `$lib/attachments.ts` — `{@attach}` factories (`reveal`, `parallax`) with cleanup + reduced-motion. |
| [`assets/Reveal.svelte`](assets/Reveal.svelte) | Golden-path component: `$state` ref + `onMount` + `matchMedia` + revert. |
| [`assets/+layout.svelte`](assets/+layout.svelte) | Root layout: register once, Lenis smooth scroll, `ScrollTrigger.refresh()` on nav. |

---

*Original work for the rask platform. GSAP API knowledge credits the official MIT-licensed
[GreenSock GSAP Skills](https://github.com/greensock/gsap-skills); the SvelteKit project structure
credits the MIT [svelte-gsap-template](https://github.com/YusufCeng1z/svelte-gsap-template). GSAP is
a trademark of GreenSock, Inc.; this skill is not affiliated with or endorsed by GreenSock. See
[`LICENSE`](LICENSE).*
