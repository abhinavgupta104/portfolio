// The hero and its opening.
//
// The page loads as a plain 1990s home page. Then, in about ten seconds:
//   1. Stella selects the name. A design-tool inspector shows its properties
//      changing live as she swaps the typeface and drags it bigger, while the
//      rest of the crew clear the old page off the desk.
//   2. She tries pink, thinks better of it, and switches the lights off.
//   3. Her dev team (ChatGPT, Gemini, Claude, DeepSeek, Grok) joins the five
//      agents and ten cursors build the real hero at once: a layout grid draws
//      in, every element is first dragged out as a sized box and then snaps in
//      with alignment guides, the surname is stamped, the colour rolled in, the
//      tagline typed, the type measured, and Stella straightens what is crooked.
// After that the team leaves and the five agents wander. Any scroll, tap or key skips it.
import gsap from 'gsap';
import { $, $$, h, rand, pick, reduced, coarse, scope, run } from './lib/dom.js';
import { AgentCursor, AGENTS } from './lib/cursor.js';
import { fit } from './lib/text.js';
import { initFlow } from './lib/flow.js';
import { island } from './lib/island.js';
import { audio } from './lib/audio.js';
import { stopScroll, startScroll, scrollToEl, ScrollTrigger } from './lib/scroll.js';

const hero = $('#top');
const stage = $('#heroStage');
const nameEl = $('#heroName');
const lines = $$('.hero__line', nameEl);
const letters = $$('.hero__line span', nameEl);
const surname = $$('span', lines[1]);
const knock = $('.hero__knock');
const draft = $('#draft');
const dName = $('#draftName');
const sel = $('#draftSel');
const dim = $('#draftDim');
const tools = $('#draftTools');
const insp = $('#insp');
const docKids = [...$('.draft__doc').children];
const docLinks = $$('.draft__doc li');
const agentsLayer = $('#heroAgents');
// the pieces of the finished hero that the crew put in place
const say = $('#heroSay');
const sayText = say.textContent;
const rot = $('#rot');
const rotW = $('.rot__w');
const cta = $$('.hero__cta .btn');
const metaL = $('.hero__meta--l');
const metaR = $('.hero__meta--r');
const pitch = $('.hero__pitch');
const def = $('.hero__def');
const navBits = [$('.nav__mark'), $('#soundBtn'), $('#tourBtn')];

// Stella's dev team: they only appear for the build, then leave.
const TEAM = {
  chatgpt: { name: 'ChatGPT', color: '#f3efe6' },
  gemini: { name: 'Gemini', color: '#38d6f5' },
  claude: { name: 'Claude', color: '#ff8a5c' },
  deepseek: { name: 'DeepSeek', color: '#ff5a6e', ink: '#ffffff' },
  grok: { name: 'Grok', color: '#c6ff3d' },
};

const sc = scope();
const cursors = {};
const team = {};
const proxies = []; // tweens of plain objects (name growth, paint, boxes), so a skip can stop them
let buildLayer = null; // grid, boxes, guides and measurements, drawn over the hero during the build
let flow = { start() {}, stop() {}, kick() {}, paint() {}, split() {} };
let done = false;
let roaming = false;
let nudgeTimer = null;

const inIntro = () => document.body.classList.contains('is-intro');

/* ───────── layout ───────── */
function fitHero() {
  const ui = $('.hero__ui');
  const cs = getComputedStyle(ui);
  const pad = parseFloat(cs.paddingLeft) || 24;
  const width = hero.clientWidth - pad * 2;
  // keep the name clear of the labels above it and the pitch below it
  const top = parseFloat(cs.paddingTop) + $('.hero__meta').offsetHeight * (window.innerWidth <= 760 ? 2 : 1) + 18;
  const bottom = $('.hero__foot').offsetHeight + parseFloat(cs.paddingBottom) + 22;
  knock.style.paddingTop = top + 'px';
  knock.style.paddingBottom = bottom + 'px';
  const cap = (hero.clientHeight - top - bottom) / 2 / 0.82;
  // each line is set edge to edge; on a phone the letters go tall and narrow
  // so the name still fills the screen
  const phone = window.innerWidth <= 760;
  const a = fit(lines[0], width, { max: Math.min(width * (phone ? 0.46 : 0.3), cap) });
  fit(lines[1], width, { max: Math.min(a.size * 1.25, cap * 1.2) });
  dName.style.fontSize = a.size + 'px';
  dName.style.setProperty('--wdth', a.wdth + '%');
  dName.dataset.wdth = Math.round(a.wdth);
  const r1 = lines[0].getBoundingClientRect();
  const r2 = lines[1].getBoundingClientRect();
  const hr = hero.getBoundingClientRect();
  dName.style.left = r1.left - hr.left + 'px';
  dName.style.top = r1.top - hr.top + 'px';
  // tell the shader where line one ends and line two begins (measured from the bottom)
  flow.split(1 - ((r1.bottom + r2.top) / 2 - hr.top) / hr.height);
}

/* ───────── the opening: helpers ───────── */

/** Animate a plain number from 0 to 1 and report it every frame. */
function drive(duration, ease, onUpdate) {
  const o = { p: 0 };
  const t = gsap.to(o, { p: 1, duration, ease, onUpdate: () => onUpdate(o.p) });
  proxies.push(t);
  return t;
}

/** Position of an element's box inside the hero. */
function boxOf(el, pad = 0) {
  if (!(el instanceof Element)) return { x: el.x - pad, y: el.y - pad, w: el.w + pad * 2, h: el.h + pad * 2 };
  const r = el.getBoundingClientRect();
  const hr = hero.getBoundingClientRect();
  return { x: r.left - hr.left - pad, y: r.top - hr.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 };
}

/** The design-tool inspector on the old page: set a value, with a flash when it changes. */
function inspect(key, value) {
  const dd = $(`[data-k="${key}"]`, insp);
  if (!dd) return;
  const span = $('span', dd) || dd;
  if (span.textContent === String(value)) return;
  span.textContent = value;
  if (key === 'page') dd.style.setProperty('--page', value);
  if (key !== 'size') {
    dd.classList.remove('is-hot');
    void dd.offsetWidth; // restart the flash
    dd.classList.add('is-hot');
  }
}

/**
 * The old page's name, as Stella resizes it. Its box is worked out with
 * arithmetic from one measurement instead of being re-measured every frame,
 * which keeps the growth smooth.
 */
function nameRig(from) {
  let base;
  const full = () => parseFloat(dName.style.fontSize);
  const measure = () => { base = { left: dName.offsetLeft, top: dName.offsetTop, w: dName.offsetWidth, h: dName.offsetHeight }; };
  /** p = 0 is the small line on the old page, p = 1 is full size and in place. */
  const at = (p, withCursor) => {
    const scale = from.scale + (1 - from.scale) * p;
    const x = from.x * (1 - p);
    const y = from.y * (1 - p);
    gsap.set(dName, { x, y, scale });
    const box = { x: base.left + x, y: base.top + y, w: base.w * scale, h: base.h * scale };
    gsap.set(sel, { x: box.x, y: box.y, width: box.w, height: box.h });
    dim.textContent = `${Math.round(box.w)} × ${Math.round(box.h)}`;
    inspect('size', Math.round(full() * scale));
    if (withCursor) cursors.stella.set({ x: box.x + box.w, y: box.y + box.h });
  };
  measure();
  return { measure, at };
}

/* ── the build kit: grid, boxes, guides, measurements ── */

/** A 12-column layout grid that draws itself down the hero. */
function drawGrid() {
  const g = h(`<div class="bgrid">${'<i></i>'.repeat(12)}</div>`);
  buildLayer.appendChild(g);
  gsap.fromTo(g.children, { scaleY: 0 }, { scaleY: 1, duration: 0.4, stagger: 0.025, ease: 'power2.out', transformOrigin: '50% 0%' });
  return g;
}

/** A smart guide: a thin line across the whole hero that flashes when something snaps to it. */
function guide(axis, pos) {
  const g = h(`<div class="bguide bguide--${axis}"></div>`);
  gsap.set(g, axis === 'x' ? { x: pos } : { y: pos });
  buildLayer.appendChild(g);
  gsap.fromTo(g, { opacity: 1 }, { opacity: 0, duration: 0.5, delay: 0.15, onComplete: () => g.remove() });
}

/** A labelled guide line that stays a moment (baselines, cap heights). */
function rule(y, label, delay = 0) {
  const g = h(`<div class="brule"><span class="mono">${label}</span></div>`);
  gsap.set(g, { y });
  buildLayer.appendChild(g);
  gsap.fromTo(g, { scaleX: 0 }, { scaleX: 1, duration: 0.35, delay, ease: 'power2.out', transformOrigin: '0% 50%' });
  gsap.to(g, { opacity: 0, duration: 0.4, delay: delay + 1.1, onComplete: () => g.remove() });
}

/** A dimension line between two points with its length written on it. */
function measure(x1, y1, x2, y2) {
  const vertical = Math.abs(x2 - x1) < Math.abs(y2 - y1);
  const len = Math.round(vertical ? Math.abs(y2 - y1) : Math.abs(x2 - x1));
  const m = h(`<div class="bmeasure bmeasure--${vertical ? 'v' : 'h'}"><span class="mono">${len}</span></div>`);
  if (vertical) gsap.set(m, { x: x1, y: Math.min(y1, y2), height: len });
  else gsap.set(m, { x: Math.min(x1, x2), y: y1, width: len });
  buildLayer.appendChild(m);
  gsap.fromTo(m, { [vertical ? 'scaleY' : 'scaleX']: 0 }, { [vertical ? 'scaleY' : 'scaleX']: 1, duration: 0.3, ease: 'power2.out' });
  gsap.to(m, { opacity: 0, duration: 0.4, delay: 1.2, onComplete: () => m.remove() });
}

/**
 * Drag a selection box out over an element, the way you draw a frame in a
 * design tool: press at the top-left corner, drag to the bottom-right while the
 * size readout counts up. Resolves with the box (still on screen).
 */
async function marquee(s, c, el, { pad = 6, dur = 0.26 } = {}) {
  const b = boxOf(el, pad);
  await s.wait(c.to({ x: b.x, y: b.y }, { duration: 0.24, arc: true }));
  c.click(); audio.tick();
  const box = h('<div class="bbox"><span class="bbox__dim mono"></span></div>');
  const readout = box.firstChild;
  buildLayer.appendChild(box);
  gsap.set(box, { x: b.x, y: b.y, width: 0, height: 0 });
  await s.wait(drive(dur, 'power2.inOut', (p) => {
    const w = b.w * p;
    const hgt = b.h * p;
    box.style.width = w + 'px';
    box.style.height = hgt + 'px';
    readout.textContent = `${Math.round(w)} × ${Math.round(hgt)}`;
    c.set({ x: b.x + w, y: b.y + hgt });
  }));
  return box;
}

/** The box fills in, guides flash along its edges, then it fades away. */
function snapIn(box, el, from) {
  const b = boxOf(el);
  box.classList.add('is-done');
  guide('x', b.x);
  guide('y', b.y);
  gsap.fromTo(el, { opacity: 0, ...from }, { opacity: 1, x: 0, y: 0, duration: 0.45, ease: 'back.out(1.8)' });
  gsap.to(box, { opacity: 0, duration: 0.3, delay: 0.2, onComplete: () => box.remove() });
  audio.pop();
}

/** Marquee an element, then snap it in. */
async function frame(s, c, el, from = { y: -14 }, word) {
  const box = await marquee(s, c, el);
  snapIn(box, el, from);
  if (word) c.quip(word, 900);
}

/** Everything the crew will build starts hidden, underneath the white page. */
function prepStage() {
  flow.paint(0);
  flow.start(); // already running under the page, so "lights off" is never its first frame
  gsap.set(surname, { opacity: 0 });
  say.innerHTML = [...sayText].map((ch) => `<span class="ch">${ch}</span>`).join('');
  gsap.set(pitch, { opacity: 1 });
  gsap.set(rot, { opacity: 0 });
  cta.forEach((b) => b.classList.add('is-wire'));
  gsap.set(cta, { opacity: 0 });
}

/** The crew throw the old page's contents off the desk while Stella works. */
async function clearDesk(s, W, H) {
  const { tatva: T, kavya: K, leadscout: L, nacc: N } = cursors;
  const [title, rule1, welcome, , best] = docKids;
  const fly = (els, to) => gsap.to(els, { ...to, opacity: 0, duration: 0.5, ease: 'power2.in' });
  const grab = async (c, start, target, els, to, delay, word) => {
    await s.sleep(delay);
    c.set(start);
    c.show();
    await s.wait(c.to(target, { ax: 0.25, ay: 0.5, duration: 0.36, arc: true }));
    c.click(); audio.tick();
    c.quip(word, 900);
    fly(els, to);
    await s.wait(c.to({ x: c.x + to.x * 0.3, y: c.y + to.y * 0.3 }, { duration: 0.42, ease: 'power2.out' }));
  };
  const links = async () => {
    await s.sleep(200);
    L.set({ x: W * 0.72, y: H + 30 });
    L.show();
    for (const [i, li] of docLinks.entries()) {
      await s.wait(L.to(li, { ax: 0.3, ay: 0.5, duration: i ? 0.12 : 0.34, arc: !i }));
      L.click(); audio.tick();
      fly([li], { x: W * 0.4, y: -30 + i * 16, rotation: 8 });
    }
    L.quip('cleared.', 900);
  };
  await Promise.all([
    grab(T, { x: W * 0.55, y: -30 }, title, [title, rule1], { x: 0, y: -140, rotation: -3 }, 40, 'old.'),
    grab(K, { x: -40, y: H * 0.3 }, welcome, [welcome], { x: -W * 0.5, y: -20, rotation: -6 }, 120, 'bye.'),
    links(),
    grab(N, { x: W * 0.3, y: H + 30 }, best, [best], { x: 40, y: H * 0.5, rotation: 12 }, 300, 'dated.'),
  ]);
}

/** While Stella handles the lights, the others drift to where they will start work. */
function takePlaces() {
  const { tatva: T, kavya: K, leadscout: L, nacc: N } = cursors;
  const go = (c, el, ax, ay) => c.to(el, { ax, ay, duration: 1.3, ease: 'sine.inOut' });
  go(T, lines[1], 0.02, 1.02);
  go(N, lines[0], -0.02, 0.2);
  go(K, say, 0.2, 1.6);
  go(L, metaL, 0.5, 2.4);
}

/** Ten cursors, two waves of work, all at once. */
async function build(s, W, H) {
  const { stella: S, kavya: K, nacc: N, leadscout: L, tatva: T } = cursors;
  const { chatgpt: G, gemini: Ge, claude: C, deepseek: D, grok: X } = team;
  const l1 = boxOf(lines[0]);
  const l2 = boxOf(lines[1]);

  // the team flies in from the edges
  const arrive = (c, from, to, delay) => {
    c.set(from);
    gsap.delayedCall(delay, () => { c.show(); c.to(to, { duration: 0.45, arc: true }); });
  };
  arrive(G, { x: W + 40, y: H * 0.12 }, { x: W * 0.8, y: H * 0.14 }, 0.02);
  arrive(Ge, { x: W + 40, y: H * 0.86 }, { x: W * 0.84, y: H * 0.8 }, 0.06);
  arrive(C, { x: W * 0.95, y: -40 }, { x: W * 0.9, y: 30 }, 0.1);
  arrive(D, { x: -40, y: H * 0.5 }, { x: W * 0.06, y: H * 0.52 }, 0.04);
  arrive(X, { x: W * 0.5, y: H + 40 }, { x: W * 0.5, y: H * 0.45 }, 0.08);
  await s.sleep(120);
  const grid = drawGrid();

  /** Select a whole line, spread its letters, then pull them in tight: a tracking pass. */
  const track = async (c, line, word) => {
    const box = await marquee(s, c, line, { pad: 4, dur: 0.3 });
    box.classList.add('is-done');
    c.quip(word, 1000);
    const ls = $$('span', line);
    const mid = (ls.length - 1) / 2;
    audio.whoosh();
    await s.wait(gsap.timeline()
      .to(ls, { x: (i) => (i - mid) * 8, duration: 0.18, ease: 'power2.out' })
      .to(ls, { x: 0, duration: 0.5, ease: 'back.out(2.2)' }));
    guide('y', boxOf(line).y + boxOf(line).h * 0.9);
    gsap.to(box, { opacity: 0, duration: 0.25, onComplete: () => box.remove() });
  };

  // Tatva stamps the surname letter by letter (the last one lands crooked),
  // frames the two buttons, then tightens the tracking of the first name.
  const tatva = async () => {
    T.quip('surname.', 900);
    for (const [i, l] of surname.entries()) {
      await s.wait(T.to(l, { ax: 0.5, ay: 0.55, duration: i ? 0.1 : 0.22, ease: 'power2.out' }));
      T.click(); audio.tick();
      const crooked = i === surname.length - 1;
      gsap.fromTo(l, { opacity: 0, yPercent: 40, scale: 0.6, rotation: 0 },
        { opacity: 1, yPercent: crooked ? 5 : 0, scale: 1, rotation: crooked ? -8 : 0, duration: 0.4, ease: 'back.out(2.4)' });
    }
    T.quip('close enough.', 900);
    gsap.set(cta, { opacity: 1 });
    for (const b of cta) {
      const box = await marquee(s, T, b, { pad: 4, dur: 0.22 });
      box.classList.add('is-done');
      guide('x', boxOf(b).x);
      b.classList.remove('is-wire');
      gsap.fromTo(b, { scale: 0.88 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.5)' });
      gsap.to(box, { opacity: 0, duration: 0.25, delay: 0.12, onComplete: () => box.remove() });
      audio.pop();
    }
    T.quip('buttons.', 900);
    await s.sleep(120);
    await track(T, lines[0], 'tracking −1');
  };

  // NACC rolls the colour in like a paint roller: across the first line, back along the second.
  const nacc = async () => {
    const x1 = l1.x - 8;
    const x2 = l1.x + l1.w + 12;
    const y1 = l1.y + l1.h * 0.5;
    const y2 = l2.y + l2.h * 0.5;
    await s.sleep(220);
    await s.wait(N.to({ x: x1, y: y1 }, { duration: 0.26, ease: 'power2.out' }));
    N.click();
    N.quip('colour.', 1600);
    audio.whoosh();
    await s.wait(drive(0.8, 'power2.inOut', (p) => {
      const x = x1 + (x2 - x1) * p;
      N.set({ x, y: y1 + Math.sin(p * Math.PI * 3) * 14 });
      flow.paint((x + 26) / W, 0);
    }));
    await s.wait(N.to({ x: x2, y: y2 }, { duration: 0.14, ease: 'power2.inOut' }));
    audio.whoosh();
    await s.wait(drive(0.8, 'power2.inOut', (p) => {
      const x = x2 + (x1 - x2) * p;
      N.set({ x, y: y2 + Math.sin(p * Math.PI * 3) * 14 });
      flow.paint(1, 1 - (x - 26) / W);
    }));
    flow.paint(1);
    flow.kick(0.6);
    N.quip('louder.', 900);
  };

  // Kavya types the tagline, drops the rotating word in, then frames the whole pitch.
  const kavya = async () => {
    const chars = $$('.ch', say);
    await s.sleep(160);
    await s.wait(K.to(say, { ax: 0, ay: 0.7, duration: 0.26, ease: 'power2.out' }));
    K.click();
    K.quip('words.', 1100);
    K.to(say, { ax: 1, ay: 1.15, duration: chars.length * 0.026, ease: 'none' });
    for (const [i, ch] of chars.entries()) {
      ch.classList.add('is-on', 'is-caret');
      if (i) chars[i - 1].classList.remove('is-caret');
      if (i % 2 === 0) audio.key();
      await s.sleep(26);
    }
    chars[chars.length - 1].classList.remove('is-caret');
    gsap.set(rot, { opacity: 1 });
    gsap.fromTo(rotW, { yPercent: 110 }, { yPercent: 0, duration: 0.5, ease: 'power3.out' });
    guide('x', boxOf(say).x);
    await s.sleep(500);
    const box = await marquee(s, K, $('.hero__tag'), { pad: 6, dur: 0.3 });
    box.classList.add('is-done');
    K.quip('copy.', 900);
    guide('x', boxOf(say).x);
    gsap.to(box, { opacity: 0, duration: 0.25, delay: 0.25, onComplete: () => box.remove() });
  };

  // LeadScout frames the left label and the logo, then measures under the tagline.
  const leadscout = async () => {
    await s.sleep(60);
    await frame(s, L, metaL, { y: -14 }, 'pinned.');
    await frame(s, L, navBits[0], { y: -14 }, 'logo.');
    await s.sleep(700);
    const r = boxOf(rotW);
    const b = boxOf(cta[0]);
    const x = b.x + b.w * 0.5;
    await s.wait(L.to({ x, y: r.y + r.h }, { duration: 0.3, arc: true }));
    L.click();
    measure(x, r.y + r.h, x, b.y);
    L.quip('gap.', 900);
  };

  // ChatGPT frames the clock and the sound switch, then the rotating word.
  const chatgpt = async () => {
    await s.sleep(260);
    await frame(s, G, metaR, { y: -14 }, 'clock.');
    await frame(s, G, navBits[1], { y: -14 }, 'sound.');
    await s.sleep(420);
    const box = await marquee(s, G, rotW, { pad: 4, dur: 0.26 });
    box.classList.add('is-done');
    G.quip('word.', 900);
    gsap.to(box, { opacity: 0, duration: 0.25, delay: 0.2, onComplete: () => box.remove() });
  };

  // Gemini frames the definition, then measures the right margin.
  const gemini = async () => {
    await s.sleep(300);
    await frame(s, Ge, def, { x: 24 }, 'meaning.');
    await s.sleep(500);
    const y = l1.y + l1.h * 0.5;
    await s.wait(Ge.to({ x: l1.x + l1.w, y }, { duration: 0.32, arc: true }));
    Ge.click();
    measure(l1.x + l1.w, y, W, y);
    Ge.quip('margin.', 900);
  };

  // Claude frames the tour button, then tightens the surname's tracking.
  const claude = async () => {
    await s.sleep(340);
    await frame(s, C, navBits[2], { y: -14 }, 'drive.');
    await s.sleep(900);
    await track(C, lines[1], 'kerning.');
  };

  // DeepSeek measures the spacing: under the name, and the left margin.
  const deepseek = async () => {
    await s.sleep(700);
    const t = boxOf(say);
    const mx = t.x + t.w * 0.6;
    await s.wait(D.to({ x: mx, y: l2.y + l2.h }, { duration: 0.3, arc: true }));
    D.click();
    measure(mx, l2.y + l2.h, mx, t.y);
    D.quip('spacing.', 900);
    await s.sleep(250);
    await s.wait(D.to({ x: 0, y: l2.y + l2.h * 0.5 }, { duration: 0.3, arc: true }));
    D.click();
    measure(0, l2.y + l2.h * 0.5, l2.x, l2.y + l2.h * 0.5);
    D.quip('margin.', 900);
  };

  // Grok draws the cap height and the baseline of the first line, then of the second.
  const grok = async () => {
    await s.sleep(380);
    await s.wait(X.to({ x: l1.x + l1.w * 0.4, y: l1.y }, { duration: 0.3, arc: true }));
    X.click();
    rule(l1.y + l1.h * 0.12, 'cap');
    rule(l1.y + l1.h * 0.9, 'base', 0.08);
    X.quip('baseline.', 900);
    await s.sleep(700);
    await s.wait(X.to({ x: l2.x + l2.w * 0.3, y: l2.y + l2.h * 0.9 }, { duration: 0.3, arc: true }));
    X.click();
    rule(l2.y + l2.h * 0.12, 'cap');
    rule(l2.y + l2.h * 0.9, 'base', 0.08);
    X.quip('aligned.', 900);
  };

  // Stella reviews, then fixes Tatva's crooked letter.
  const stella = async () => {
    await s.sleep(260);
    await s.wait(S.to({ x: l1.x + l1.w * 0.5, y: l1.y - 10 }, { duration: 0.35, arc: true }));
    S.quip('reviewing.', 1100);
    await s.sleep(820);
    const last = surname[surname.length - 1];
    await s.wait(S.to(last, { ax: 0.5, ay: 0.5, duration: 0.36, arc: true }));
    S.click(); audio.click();
    S.quip('fixed.', 1100);
    gsap.to(last, { rotation: 0, yPercent: 0, duration: 0.8, ease: 'elastic.out(1.1, 0.4)' });
    guide('y', boxOf(last).y + boxOf(last).h * 0.9);
  };

  await Promise.all([tatva(), nacc(), kavya(), leadscout(), chatgpt(), gemini(), claude(), deepseek(), grok(), stella()]);

  // Stella selects the whole composition: one last look, then it ships.
  const a = boxOf(metaL);
  const z = boxOf(def);
  island.say('Ship it.');
  const all = await marquee(s, S, { x: a.x, y: a.y, w: z.x + z.w - a.x, h: z.y + z.h - a.y }, { pad: 10, dur: 0.42 });
  all.classList.add('is-done', 'is-all');
  S.quip('ship it.', 1100);
  audio.ding();
  gsap.to(all, { opacity: 0, duration: 0.45, delay: 0.35, onComplete: () => all.remove() });

  // the grid lifts and the team leaves the way they came
  gsap.to(grid, { opacity: 0, duration: 0.5, onComplete: () => grid.remove() });
  const leave = (c, to, d) => gsap.delayedCall(d, () => { c.quip('done.', 600); c.to(to, { duration: 0.55, ease: 'power2.in' }).then(() => c.hide()); });
  leave(G, { x: W + 60, y: H * 0.1 }, 0);
  leave(Ge, { x: W + 60, y: H * 0.9 }, 0.05);
  leave(C, { x: W * 0.95, y: -60 }, 0.1);
  leave(D, { x: -60, y: H * 0.5 }, 0.15);
  leave(X, { x: W * 0.5, y: H + 60 }, 0.2);
}

/* ───────── the opening: the sequence ───────── */
async function play(s) {
  const S = cursors.stella;
  const hr = hero.getBoundingClientRect();
  const W = hr.width;
  const H = hr.height;
  window.__introStart = performance.now();
  prepStage();

  // 1. The name starts as a small bold line at the end of the old page.
  dName.classList.add('is-plain');
  const doc = $('.draft__doc').getBoundingClientRect();
  const rig = nameRig({
    x: doc.left - hr.left - dName.offsetLeft,
    y: doc.bottom - hr.top + 4 - dName.offsetTop,
    scale: 30 / parseFloat(dName.style.fontSize),
  });
  rig.at(0);
  gsap.set(dName, { opacity: 1 });
  S.set({ x: W + 30, y: H * 0.32 });
  island.say('Stella is redesigning this page.');
  await s.sleep(450);

  // 2. She selects it; the inspector opens. Then a real typeface.
  S.show();
  await s.wait(S.to(dName, { ax: 0.6, ay: 0.55, duration: 0.7, arc: true }));
  S.click(); audio.click();
  gsap.to(sel, { opacity: 1, duration: 0.12 });
  gsap.fromTo(insp, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' });
  await s.sleep(240);
  dName.classList.remove('is-plain');
  inspect('font', 'Anek Latin');
  await s.sleep(60);
  inspect('weight', '800');
  await s.sleep(60);
  inspect('width', `${dName.dataset.wdth || 125}%`);
  rig.measure();
  rig.at(0);
  audio.pop();
  island.say('Too plain.');
  await s.wait(S.to(dName, { ax: 1, ay: 1, duration: 0.28, ease: 'power2.out' }));
  await s.sleep(160);

  // 3. She drags it to full size while the others clear the desk.
  island.say('Bigger. Clear the desk.');
  audio.whoosh();
  const desk = clearDesk(s, W, H);
  desk.catch(() => {}); // if the visitor skips mid-way, this stops quietly
  await s.wait(drive(1.0, 'power3.inOut', (p) => rig.at(p, true)));
  await s.wait(desk);
  gsap.to(sel, { opacity: 0, duration: 0.18 });

  // 4. Pink? No. Lights off: the finished hero floods out from the swatch she clicks.
  gsap.to(tools, { opacity: 1, duration: 0.22 });
  const pink = $('#draftPink');
  const dark = $('#draftDark');
  takePlaces();
  await s.wait(S.to(pink, { duration: 0.5, arc: true }));
  S.click(); audio.click();
  draft.classList.add('is-pink');
  inspect('page', '#FF3F8E');
  island.say('Pink?');
  await s.sleep(560);
  island.say('No.');
  await s.wait(S.to(dark, { duration: 0.2, ease: 'power2.out' }));
  S.click(); audio.click();
  inspect('page', '#08080B');
  island.say('Lights off.');
  await s.sleep(80);
  const p = S.point(dark);
  const R = Math.hypot(Math.max(p.x, W - p.x), Math.max(p.y, H - p.y)) + 40;
  flow.kick(1);
  audio.whoosh();
  draft.style.setProperty('--mx', p.x + 'px');
  draft.style.setProperty('--my', p.y + 'px');
  await s.wait(gsap.fromTo(draft, { '--mr': '0px' }, { '--mr': R + 'px', duration: 1.1, ease: 'power2.inOut' }));
  draft.classList.add('is-gone');

  // 5. Everyone builds, with the team.
  island.say('Team, build it. Fast.');
  await s.wait(build(s, W, H));

  // 6. Done: one wave through the letters.
  await s.sleep(380);
  island.say('There. Much better.');
  audio.chime();
  flow.kick(0.9);
  gsap.to(letters, {
    keyframes: [{ yPercent: -8, duration: 0.14, ease: 'power2.out' }, { yPercent: 0, duration: 0.75, ease: 'elastic.out(1, 0.4)' }],
    stagger: 0.03, overwrite: 'auto',
  });
  await s.sleep(1400);
}

/** Put every piece in its finished state, however far the opening got. */
function settle() {
  proxies.forEach((t) => t.kill());
  proxies.length = 0;
  const built = [...letters, ...$$('[data-carry]'), ...cta, ...navBits, rot, rotW];
  gsap.killTweensOf([dName, draft, tools, sel, insp, ...docKids, ...docLinks, ...built]);
  Object.values(cursors).forEach((c) => gsap.killTweensOf(c.el));
  Object.values(team).forEach((c) => { gsap.killTweensOf(c.el); gsap.set(c.el, { autoAlpha: 0 }); });
  if (buildLayer) { gsap.killTweensOf(buildLayer.querySelectorAll('*')); buildLayer.innerHTML = ''; }
  say.textContent = sayText;
  cta.forEach((b) => b.classList.remove('is-wire'));
  gsap.set(built, { clearProps: 'all' });
  flow.paint(1);
  draft.classList.add('is-gone');
}

function finish() {
  if (done) return;
  done = true;
  sc.stop();
  settle();
  document.body.classList.remove('is-intro');
  window.__booted = true;
  flow.start();
  // "reduce motion" visitors get the colour field as a still picture
  if (reduced) setTimeout(() => flow.stop(), 150);
  startScroll();
  island.quiet();
  letterLift(); // set up only now: settle() above clears every tween on the letters
  startRoaming();
  ScrollTrigger.refresh();
}

/* ───────── after the opening: the crew wander ───────── */
const ZONES = {
  stella: [[0.62, 0.92], [0.16, 0.42]],
  nacc: [[0.08, 0.4], [0.16, 0.36]],
  kavya: [[0.34, 0.6], [0.62, 0.86]],
  leadscout: [[0.6, 0.9], [0.56, 0.8]],
  tatva: [[0.1, 0.34], [0.44, 0.62]],
};
const QUIPS = {
  stella: ['kerning.', 'hold still.', 'mine.'],
  nacc: ['bolder.', 'louder.', 'post this.'],
  kavya: ['hello?', 'ringing…', 'namaste.'],
  leadscout: ['found one.', 'scanning…', '+1 lead'],
  tatva: ['component.', 'reusable.', 'snap.'],
};

function wander(who) {
  const c = cursors[who];
  const [zx, zy] = ZONES[who];
  const step = () => {
    if (!roaming || c.busy) return;
    const w = hero.clientWidth;
    const hgt = hero.clientHeight;
    c.to({ x: rand(zx[0], zx[1]) * w, y: rand(zy[0], zy[1]) * hgt }, { duration: rand(1.8, 3.4), ease: 'sine.inOut' })
      .then(() => { c.timer = setTimeout(step, rand(400, 2400)); });
  };
  step();
}

async function nudge() {
  if (!roaming) return;
  const who = pick(Object.keys(cursors));
  const c = cursors[who];
  if (c.busy) return;
  c.busy = true;
  clearTimeout(c.timer);
  const letter = pick(letters);
  await c.to(letter, { ax: rand(0.3, 0.7), ay: rand(0.35, 0.7), duration: 0.9 });
  if (roaming) {
    c.click();
    c.quip(pick(QUIPS[who]));
    audio.tick();
    flow.kick(0.35);
    gsap.timeline()
      .to(letter, { yPercent: -7, rotate: rand(-5, 5), duration: 0.18, ease: 'power2.out' })
      .to(letter, { yPercent: 0, rotate: 0, duration: 1.1, ease: 'elastic.out(1, 0.35)' });
  }
  await new Promise((r) => setTimeout(r, 900));
  c.busy = false;
  wander(who);
}

function startRoaming() {
  if (roaming || reduced) return;
  roaming = true;
  const w = hero.clientWidth;
  const hgt = hero.clientHeight;
  Object.entries(cursors).forEach(([who, c]) => {
    const [zx, zy] = ZONES[who];
    // a cursor that is already on screen carries on from where it stands
    if (gsap.getProperty(c.el, 'opacity') < 0.5) c.set({ x: rand(zx[0], zx[1]) * w, y: rand(zy[0], zy[1]) * hgt });
    c.show();
    c.busy = false;
    c.timer = setTimeout(() => wander(who), rand(200, 1400));
  });
  nudgeTimer = setInterval(nudge, 3800);
}

function stopRoaming() {
  roaming = false;
  clearInterval(nudgeTimer);
  Object.values(cursors).forEach((c) => { clearTimeout(c.timer); gsap.killTweensOf(c.el, 'x,y'); });
}

/* ───────── small living details ───────── */
function rotateWords() {
  const words = ['pick up the phone.', 'drive the laptop.', 'write the code.', 'find the leads.', 'send the SMS.', 'make the post.', 'take the payment.'];
  if (reduced) return;
  let i = 0;
  setInterval(() => {
    if (document.hidden || inIntro() || hero.classList.contains('is-off')) return;
    i = (i + 1) % words.length;
    gsap.to(rotW, {
      yPercent: -110, duration: 0.4, ease: 'power3.in',
      onComplete: () => { rotW.textContent = words[i]; gsap.fromTo(rotW, { yPercent: 110 }, { yPercent: 0, duration: 0.65, ease: 'power3.out' }); },
    });
  }, 2300);
}

function clock() {
  const el = $('#clock');
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const tick = () => { el.textContent = fmt.format(new Date()); };
  tick();
  setInterval(tick, 1000);
}

function letterLift() {
  if (coarse || reduced) return;
  const setters = letters.map((l) => gsap.quickTo(l, 'y', { duration: 0.5, ease: 'power3.out' }));
  hero.addEventListener('pointermove', (e) => {
    letters.forEach((l, i) => {
      const r = l.getBoundingClientRect();
      const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
      setters[i](-22 * Math.max(0, 1 - d / 320));
    });
  }, { passive: true });
  hero.addEventListener('pointerleave', () => setters.forEach((s) => s(0)));
}

function scrollAway() {
  // The page slides over the hero; the hero falls back and dims as it is covered.
  gsap.to(stage, {
    scale: 0.9, opacity: 0.25, borderRadius: 36, ease: 'none',
    scrollTrigger: { trigger: '#def', start: 'top bottom', end: 'top top', scrub: true },
  });
  gsap.to(agentsLayer, {
    opacity: 0, ease: 'none',
    scrollTrigger: { trigger: '#def', start: 'top bottom', end: 'top 60%', scrub: true },
  });
  ScrollTrigger.create({
    trigger: '#def', start: 'top top',
    onEnter: () => { hero.classList.add('is-off'); flow.stop(); stopRoaming(); },
    onLeaveBack: () => { hero.classList.remove('is-off'); if (!reduced) flow.start(); startRoaming(); },
  });
}

/* ───────── entry point ───────── */
export async function initHero() {
  flow = initFlow($('#flow'));
  ['stella', 'kavya', 'nacc', 'leadscout', 'tatva'].forEach((who) => { cursors[who] = new AgentCursor(agentsLayer, AGENTS[who]); });
  Object.entries(TEAM).forEach(([who, spec]) => { team[who] = new AgentCursor(agentsLayer, spec); });
  buildLayer = h('<div class="build" aria-hidden="true"></div>');
  hero.insertBefore(buildLayer, agentsLayer);
  fitHero();
  clock();
  rotateWords();
  scrollAway();

  let rz;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(fitHero, 120); });

  // The opening plays on every visit and every refresh, always from the top.
  // It is skipped only for `?nointro`, for visitors who ask for reduced motion,
  // and for someone arriving on a link to a section (…/#kavya), who should land
  // on that section. Refreshing such a link drops the #part and replays.
  const params = new URLSearchParams(location.search);
  const nav = performance.getEntriesByType('navigation')[0];
  if (nav && nav.type === 'reload' && location.hash) history.replaceState(null, '', location.pathname + location.search);
  const sectionLink = location.hash.length > 1;
  // (!inIntro(): the failsafe in index.html already gave up waiting and showed the page)
  if (reduced || sectionLink || params.has('nointro') || !inIntro()) {
    finish();
    // The browser jumped to the section before the page had its final layout
    // (fitted headings, the pinned gallery), so go there again now that it has.
    const target = sectionLink && document.getElementById(location.hash.slice(1));
    if (target) requestAnimationFrame(() => scrollToEl(target, { immediate: true }));
    return;
  }

  scrollToEl(0, { immediate: true });
  stopScroll();
  const skip = () => finish();
  const opts = { once: true, passive: true };
  window.addEventListener('wheel', skip, opts);
  window.addEventListener('touchmove', skip, opts);
  window.addEventListener('keydown', skip, opts);
  window.addEventListener('pointerdown', skip, opts);

  await run(() => play(sc.begin()));
  finish();
}

export const heroCursors = cursors;
