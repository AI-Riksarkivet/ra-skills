<!--
  Reveal.svelte — golden-path component pattern for imperative GSAP in Svelte 5.
  Use this shape when you need a real timeline / refs (for {@attach} one-liners,
  prefer $lib/attachments.ts instead).

  The three laws this template encodes:
    1. CLEANUP   — revert on destroy (onMount's return) or you leak ScrollTriggers.
    2. SCOPE     — query inside the component root, never with global selectors.
    3. A11Y      — matchMedia() skips animation under prefers-reduced-motion.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import { gsap } from '$lib/gsap';

	// Svelte 5: a bound DOM ref is just $state, assigned via bind:this.
	let root = $state<HTMLDivElement>();
	let { children }: { children?: Snippet } = $props();

	onMount(() => {
		// matchMedia → reduced-motion + responsive handling + automatic revert.
		const mm = gsap.matchMedia();
		mm.add('(prefers-reduced-motion: no-preference)', () => {
			if (!root) return;
			// Scope the query to this component's root — never a global selector.
			const items = root.querySelectorAll('[data-reveal]');
			gsap
				.timeline({ scrollTrigger: { trigger: root, start: 'top 80%' } })
				.from(items, { y: 24, autoAlpha: 0, duration: 0.6, stagger: 0.1 });
		});
		// onMount's return runs on destroy — revert every tween + ScrollTrigger.
		return () => mm.revert();
	});
</script>

<div bind:this={root}>
	{@render children?.()}
</div>
