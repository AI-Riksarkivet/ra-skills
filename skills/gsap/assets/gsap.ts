// $lib/gsap.ts
// Single place to import GSAP and register plugins for the whole SvelteKit app.
// In components, do `import { gsap, ScrollTrigger } from '$lib/gsap'` instead of
// calling gsap.registerPlugin() in every component.
//
// GSAP — and every plugin — is 100% free since Webflow's acquisition of GreenSock.
// Install the public `gsap` package: `bun add gsap`. No Club membership, no auth
// token, no private registry / .npmrc required.
import { browser } from '$app/environment';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Importing the modules above is SSR-safe; *using* a plugin touches window/document,
// so register + configure on the client only.
if (browser) {
	gsap.registerPlugin(ScrollTrigger);

	// Project-wide tween defaults — every gsap.to()/from() inherits these.
	gsap.defaults({ ease: 'power2.out', duration: 0.6 });
}

// Add more plugins here as you adopt them, e.g.:
//   import { Flip } from 'gsap/Flip';
//   import { SplitText } from 'gsap/SplitText';
//   if (browser) gsap.registerPlugin(Flip, SplitText);

export { gsap, ScrollTrigger };
