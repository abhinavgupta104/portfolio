// Smooth scrolling (Lenis) wired to GSAP's ScrollTrigger so both read one clock.
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { reduced } from './dom.js';

gsap.registerPlugin(ScrollTrigger);

export let lenis = null;

export function initScroll() {
  if (reduced) return;
  lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 1, anchors: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  window.__lenis = lenis; // handy for the screenshot script and for debugging
}

export const stopScroll = () => lenis?.stop();
export const startScroll = () => lenis?.start();

/** Scroll so `target` sits `offset` px below the top. Resolves when it arrives. */
export function scrollToEl(target, { duration = 1.4, offset = 0, immediate = false } = {}) {
  return new Promise((resolve) => {
    if (lenis) {
      // Lenis remembers how tall the page is and only re-checks a moment after a
      // change. Right after the layout settles (pinned gallery, fitted headings)
      // that memory can be too short, and it would stop early. Measure now.
      lenis.resize();
      lenis.scrollTo(target, { duration, offset, immediate, force: true, lock: false, easing: (t) => 1 - Math.pow(1 - t, 4), onComplete: resolve });
      if (immediate) resolve();
    } else {
      const y = typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY + offset;
      window.scrollTo(0, y);
      resolve();
    }
  });
}

export { gsap, ScrollTrigger };
