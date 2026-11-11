// Entry point. Order matters: fonts first (the layout is measured against
// them), then scroll, then every section, and the hero's opening last.
import '@fontsource-variable/anek-latin/wdth.css';
import '@fontsource-variable/jetbrains-mono/index.css';
import './css/base.css';
import './css/hero.css';
import './css/sections.css';
import './css/rooms.css';

import { $ } from './lib/dom.js';
import { initScroll, ScrollTrigger } from './lib/scroll.js';
import { initAudio } from './lib/audio.js';
import { initSections } from './sections.js';
import { initRooms } from './rooms/index.js';
import { initTour, isTouring } from './tour.js';
import { initAbout, initContact } from './about.js';
import { initHero } from './hero.js';

async function fonts() {
  if (!document.fonts || !document.fonts.load) return;
  const wanted = [
    document.fonts.load('800 80px "Anek Latin Variable"'),
    document.fonts.load('400 18px "Anek Latin Variable"'),
    document.fonts.load('800 80px "Anek Devanagari Variable"', 'अभिनव'),
    document.fonts.load('500 12px "JetBrains Mono Variable"'),
  ];
  // never let a slow font hold the page hostage
  await Promise.race([Promise.all(wanted), new Promise((r) => setTimeout(r, 2500))]);
}

async function boot() {
  window.__alive = true; // tells the failsafe in index.html that the script is running
  await fonts();
  initScroll();
  initAudio($('#soundBtn'));
  initContact();
  initSections();
  initRooms({ isTouring });
  initTour();
  initAbout();
  // The gallery pins and adds scroll length, so everything below it has to be
  // measured after it: sort the triggers top-to-bottom, then measure once.
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
  // (not while the opening is playing: re-measuring the whole page mid-animation
  // would cost a visible hitch, and the opening re-measures when it ends anyway)
  window.addEventListener('load', () => { if (!document.body.classList.contains('is-intro')) ScrollTrigger.refresh(); });
  await initHero();

  console.log('%cअभिनव', 'font-size:42px;font-weight:800;color:#ffb21a');
  console.log('%cYou opened the console. Good instinct.\nThere is a terminal further down the page — try `sudo hire abhinav`.', 'font-size:13px;color:#888');
}

boot();
