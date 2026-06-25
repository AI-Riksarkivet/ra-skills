<!--
  Root +layout.svelte — register GSAP plugins once and (optionally) wire up Lenis
  smooth scrolling. Importing $lib/gsap registers plugins on the client.

  Fixes two bugs from the common copy-paste template:
    • keeps a stable rAF callback so gsap.ticker.remove() actually removes it;
    • uses Lenis autoRaf:false so GSAP's ticker is the single rAF loop (no double-drive).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { gsap, ScrollTrigger } from '$lib/gsap'; // importing registers plugins (client-only)
	import Lenis from 'lenis';

	let { children }: { children: Snippet } = $props();

	onMount(() => {
		// Optional smooth scroll. Drive Lenis from GSAP's ticker (one rAF loop) and
		// let ScrollTrigger read Lenis' scroll position so triggers stay in sync.
		const lenis = new Lenis({ autoRaf: false });
		lenis.on('scroll', ScrollTrigger.update);

		// Stable reference so we can remove THIS exact callback on destroy.
		const raf = (time: number) => lenis.raf(time * 1000);
		gsap.ticker.add(raf);
		gsap.ticker.lagSmoothing(0);

		return () => {
			gsap.ticker.remove(raf);
			lenis.destroy();
		};
	});

	// SPA navigation swaps the DOM — recompute every trigger's start/end positions.
	afterNavigate(() => ScrollTrigger.refresh());
</script>

{@render children()}
