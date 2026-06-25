// $lib/attachments.ts
// Reusable GSAP attachments for Svelte 5's {@attach} directive (Svelte 5.29+).
// Each factory returns an Attachment — `(node) => cleanup` — so it sets the
// animation up when the element mounts and reverts it when the element is removed.
//
//   <section {@attach reveal()}> … </section>
//   <div {@attach reveal({ stagger: 0.1 })}> {#each items as i}<Card />{/each} </div>
//   <img {@attach parallax(80)} … />
//
// Why {@attach} over `use:` actions or a per-component onMount?
//   • runs per element, co-located with the markup it animates
//   • re-runs automatically when its arguments change (`use:` does not)
//   • the returned cleanup reverts the tween + its ScrollTrigger — no leaks
import type { Attachment } from 'svelte/attachments';
import { gsap } from '$lib/gsap';

type RevealOptions = {
	/** distance (px) the element rises from */
	y?: number;
	duration?: number;
	/** ScrollTrigger `start`, e.g. "top 85%" */
	start?: string;
	/** if set, stagger the element's *children* instead of the element itself */
	stagger?: number;
};

/** Fade + rise into view on scroll. Respects prefers-reduced-motion. */
export function reveal(options: RevealOptions = {}): Attachment {
	const { y = 24, duration = 0.6, start = 'top 85%', stagger } = options;
	return (node) => {
		// gsap.matchMedia() gives us reduced-motion handling AND auto-revert on cleanup:
		// when the query stops matching (or .revert() is called) every animation and
		// ScrollTrigger created inside the callback is killed and inline styles restored.
		const mm = gsap.matchMedia();
		mm.add('(prefers-reduced-motion: no-preference)', () => {
			gsap.from(stagger ? node.children : node, {
				y,
				autoAlpha: 0,
				duration,
				stagger,
				scrollTrigger: { trigger: node, start }
			});
		});
		return () => mm.revert();
	};
}

/** Parallax drift tied to scroll position (`amount` px over the element's travel). */
export function parallax(amount = 100): Attachment {
	return (node) => {
		const mm = gsap.matchMedia();
		mm.add('(prefers-reduced-motion: no-preference)', () => {
			gsap.to(node, {
				y: amount,
				ease: 'none', // linear so movement tracks scroll 1:1
				scrollTrigger: { trigger: node, start: 'top bottom', end: 'bottom top', scrub: true }
			});
		});
		return () => mm.revert();
	};
}
