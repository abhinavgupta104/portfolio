// Scroll choreography for everything that is not a demo: headings that rise,
// numbers that count, the island label, the gallery, and the "you" tag.
import gsap from 'gsap';
import { $, $$, reduced, coarse } from './lib/dom.js';
import { split, fit } from './lib/text.js';
import { island } from './lib/island.js';
import { audio } from './lib/audio.js';
import { ScrollTrigger, scrollToEl } from './lib/scroll.js';

/* ───────── room titles: edge to edge ───────── */
function fitRoomNames() {
  $$('.room__name').forEach((el) => {
    const wrap = el.closest('.wrap');
    const cs = getComputedStyle(wrap);
    const width = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const words = $$('.w', el).length;
    el.classList.toggle('is-stack', words > 1 && window.innerWidth < 760);
    fit(el, width, { max: Math.min(width * 0.3, window.innerHeight * 0.42) });
  });
  // the Hindi word in the definition gets the same treatment
  const word = $('#defWord');
  const wrap = word.closest('.wrap');
  const cs = getComputedStyle(wrap);
  const width = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  fit(word, width, { max: Math.min(width * 0.42, window.innerHeight * 0.44) });
  word.parentElement.style.fontSize = word.style.fontSize; // so the line box matches the word
}

function headings() {
  $$('[data-split]').forEach((el) => {
    const chars = split(el);
    if (reduced) return;
    gsap.set(chars, { yPercent: 115 });
    ScrollTrigger.create({
      trigger: el, start: 'top 88%', once: true,
      onEnter: () => gsap.to(chars, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: { each: 0.028, from: 'start' } }),
    });
  });
}

function reveals() {
  if (reduced) return;
  const groups = [
    ...$$('.room').map((r) => [r, $$('.kicker, .room__lead, .room__copy > p:not(.room__lead), .facts li, .stack, .note', r)]),
    [$('#def'), $$('.def__pron, [data-reveal]', $('#def'))],
    [$('#crew'), $$('.crew__head > *, .crew__list li', $('#crew'))],
    [$('#about'), $$('.about__copy > p', $('#about'))],
    // the footer is left out on purpose: it sits at the very end of the page and
    // can never scroll far enough up to trigger a reveal
    [$('#contact'), $$('.kicker, .contact__lead, .contact__links', $('#contact'))],
  ];
  groups.forEach(([root, els]) => {
    els.forEach((el) => {
      gsap.set(el, { y: 26, opacity: 0 });
      ScrollTrigger.create({
        trigger: el, start: 'top 92%', once: true,
        onEnter: () => gsap.to(el, { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out', clearProps: 'transform,opacity' }),
      });
    });
    void root;
  });

  // demo stages and the terminal rise as one piece
  $$('.stage, .term').forEach((el) => {
    gsap.set(el, { y: 60, opacity: 0, scale: 0.97 });
    ScrollTrigger.create({
      trigger: el, start: 'top 90%', once: true,
      onEnter: () => gsap.to(el, { y: 0, opacity: 1, scale: 1, duration: 1.2, ease: 'expo.out', clearProps: 'transform,opacity' }),
    });
  });

  // the Devanagari word rises out of its line
  const word = $('.def__word span');
  gsap.set(word, { yPercent: 105 });
  ScrollTrigger.create({ trigger: '.def__word', start: 'top 90%', once: true, onEnter: () => gsap.to(word, { yPercent: 0, duration: 1.3, ease: 'expo.out' }) });

  // outlined Hindi ghosts drift against the scroll
  $$('.room__ghost').forEach((g) => {
    gsap.fromTo(g, { yPercent: 18 }, { yPercent: -28, ease: 'none', scrollTrigger: { trigger: g.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // each section sinks a little as the next one slides over it
  $$('.sheet > section').forEach((sec) => {
    const next = sec.nextElementSibling;
    const inner = $('.wrap', sec);
    if (!next || !inner) return;
    gsap.to(inner, { y: 70, ease: 'none', scrollTrigger: { trigger: next, start: 'top bottom', end: 'top top', scrub: true } });
  });
}

function counters() {
  $$('[data-count]').forEach((el) => {
    const to = Number(el.dataset.count);
    if (reduced) return;
    el.textContent = '0';
    ScrollTrigger.create({
      trigger: el, start: 'top 90%', once: true,
      onEnter: () => {
        const o = { v: 0 };
        gsap.to(o, { v: to, duration: 1.4, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(o.v); } });
      },
    });
  });
}

/* ───────── island: where am I ───────── */
function labels() {
  $$('[data-label]').forEach((sec) => {
    ScrollTrigger.create({
      trigger: sec, start: 'top 55%', end: 'bottom 55%',
      onToggle: (self) => { if (self.isActive) island.setLabel(sec.dataset.label); },
    });
  });
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => island.progress(self.progress) });
  island.setLabel('Hello');
}

/* ───────── gallery: sideways while you scroll down ───────── */
/** How far the strip of sites has to travel sideways; 0 when it scrolls natively. */
export function galleryTravel() {
  const wrap = $('#gallery');
  if (wrap.classList.contains('is-native')) return 0;
  return Math.max(0, $('#galleryTrack').scrollWidth - window.innerWidth);
}

function gallery() {
  const wrap = $('#gallery');
  const track = $('#galleryTrack');
  // The screenshots are lazy so they don't slow the first paint, but the cards
  // off to the right would otherwise load late and pop in mid-slide. Fetch all
  // six once the section is a couple of screens away.
  ScrollTrigger.create({
    trigger: '#sites', start: 'top 300%', once: true,
    onEnter: () => $$('img', track).forEach((img) => { img.loading = 'eager'; }),
  });
  if (coarse || reduced || window.innerWidth < 860) {
    wrap.classList.add('is-native');
    return;
  }
  // Desktop: the strip holds in the middle of the screen while the six sites
  // slide past, then lets go. Vertical scrolling becomes horizontal travel.
  gsap.to(track, {
    x: () => -galleryTravel(), ease: 'none',
    scrollTrigger: {
      trigger: wrap, pin: wrap, start: 'center center', end: () => '+=' + galleryTravel(),
      scrub: 0.5, invalidateOnRefresh: true, anticipatePin: 1,
    },
  });
}

/* ───────── a tag that follows the visitor's pointer ───────── */
function youTag() {
  const you = $('#you');
  if (coarse) return;
  const x = gsap.quickTo(you, 'x', { duration: 0.35, ease: 'power3.out' });
  const y = gsap.quickTo(you, 'y', { duration: 0.35, ease: 'power3.out' });
  let px = -1;
  let py = -1;
  let queued = false;
  // what is under the pointer right now? (asked again on scroll, because the
  // page can move under a pointer that is holding still)
  const label = () => {
    queued = false;
    const el = document.elementFromPoint(px, py);
    const hot = el && el.closest ? el.closest('[data-you]') : null;
    you.textContent = hot ? hot.dataset.you : 'you';
    you.classList.toggle('is-hot', !!hot);
  };
  window.addEventListener('pointermove', (e) => {
    px = e.clientX; py = e.clientY;
    you.classList.add('is-on');
    x(px + 16); y(py + 18);
    label();
  }, { passive: true });
  window.addEventListener('scroll', () => {
    if (px < 0 || queued) return;
    queued = true;
    requestAnimationFrame(label);
  }, { passive: true });
  document.addEventListener('pointerleave', () => you.classList.remove('is-on'));
}

function crew() {
  $$('.crew__list a').forEach((a) => {
    a.addEventListener('pointerenter', () => audio.tick());
  });
}

/* in-page links glide instead of jumping */
function anchors() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const target = $(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    audio.click();
    scrollToEl(target, { duration: 1.5 });
    history.replaceState(null, '', a.getAttribute('href'));
  });
}

export function initSections() {
  headings();
  fitRoomNames();
  reveals();
  counters();
  labels();
  gallery();
  youTag();
  crew();
  anchors();
  let rz;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => { fitRoomNames(); ScrollTrigger.refresh(); }, 150);
  });
}
