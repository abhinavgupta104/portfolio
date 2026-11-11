// The hero and its opening.
//
// The page loads as a plain 1990s home page. Then, in about ten seconds:
//   1. Stella selects the name, swaps the typeface and drags it bigger, while
//      the rest of the crew clear the old page off the desk.
//   2. She tries pink, thinks better of it, and switches the lights off.
//   3. All five agents build the real hero at the same time: Tatva stamps the
//      surname and drops the buttons, NACC rolls the colour in, Kavya types
//      the tagline, LeadScout pins the labels, Stella straightens what is crooked.
// After that the cursors stay and wander. Any scroll, tap or key skips it.
import gsap from 'gsap';
import { $, $$, rand, pick, reduced, coarse, scope, run } from './lib/dom.js';
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

const sc = scope();
const cursors = {};
const proxies = []; // tweens of plain objects (name growth, paint), so a skip can stop them
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
  const r1 = lines[0].getBoundingClientRect();
  const r2 = lines[1].getBoundingClientRect();
  const hr = hero.getBoundingClientRect();
  dName.style.left = r1.left - hr.left + 'px';
  dName.style.top = r1.top - hr.top + 'px';
  // tell the shader where line one ends and line two begins (measured from the bottom)
  flow.split(1 - ((r1.bottom + r2.top) / 2 - hr.top) / hr.height);
}

/* ───────── the opening: helpers ───────── */

/**
 * The old page's name, as Stella resizes it. Its box is worked out with
 * arithmetic from one measurement instead of being re-measured every frame,
 * which keeps the growth smooth.
 */
function nameRig(from) {
  let base;
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
    if (withCursor) cursors.stella.set({ x: box.x + box.w, y: box.y + box.h });
  };
  measure();
  return { measure, at };
}

/** Animate a plain number from 0 to 1 and report it every frame. */
function drive(duration, ease, onUpdate) {
  const o = { p: 0 };
  const t = gsap.to(o, { p: 1, duration, ease, onUpdate: () => onUpdate(o.p) });
  proxies.push(t);
  return t;
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
  const [title, rule, welcome, , best] = docKids;
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
    grab(T, { x: W * 0.55, y: -30 }, title, [title, rule], { x: 0, y: -140, rotation: -3 }, 40, 'old.'),
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

/** Five agents, five jobs, all at once. */
async function build(s, W) {
  const { stella: S, kavya: K, nacc: N, leadscout: L, tatva: T } = cursors;
  const hr = hero.getBoundingClientRect();
  const drop = (el, from) => gsap.fromTo(el, { opacity: 0, ...from }, { opacity: 1, x: 0, y: 0, duration: 0.5, ease: 'back.out(1.8)' });
  const navDrop = async (c, el, word) => {
    await s.wait(c.to(el, { duration: 0.34, arc: true }));
    c.click(); audio.pop();
    c.quip(word, 900);
    drop(el, { y: -18 });
  };

  // Tatva stamps the surname letter by letter (the last one lands crooked), then the buttons.
  const tatva = async () => {
    T.quip('surname.', 1000);
    for (const [i, l] of surname.entries()) {
      await s.wait(T.to(l, { ax: 0.5, ay: 0.55, duration: i ? 0.11 : 0.24, ease: 'power2.out' }));
      T.click(); audio.tick();
      const crooked = i === surname.length - 1;
      gsap.fromTo(l, { opacity: 0, yPercent: 40, scale: 0.6, rotation: 0 },
        { opacity: 1, yPercent: crooked ? 5 : 0, scale: 1, rotation: crooked ? -8 : 0, duration: 0.45, ease: 'back.out(2.4)' });
    }
    T.quip('close enough.', 1000);
    await s.sleep(300);
    await s.wait(T.to(cta[0], { duration: 0.42, arc: true }));
    gsap.to(cta, { opacity: 1, duration: 0.14 });
    await s.sleep(200);
    for (const [i, b] of cta.entries()) {
      if (i) await s.wait(T.to(b, { duration: 0.16 }));
      T.click(); audio.pop();
      b.classList.remove('is-wire');
      gsap.fromTo(b, { scale: 0.88 }, { scale: 1, duration: 0.55, ease: 'elastic.out(1, 0.5)' });
      await s.sleep(110);
    }
    T.quip('buttons.', 1000);
  };

  // NACC rolls the colour in like a paint roller: across the first line, back along the second.
  const nacc = async () => {
    const a = lines[0].getBoundingClientRect();
    const b = lines[1].getBoundingClientRect();
    const x1 = a.left - hr.left - 8;
    const x2 = a.right - hr.left + 12;
    const y1 = a.top - hr.top + a.height * 0.5;
    const y2 = b.top - hr.top + b.height * 0.5;
    await s.sleep(380);
    await s.wait(N.to({ x: x1, y: y1 }, { duration: 0.3, ease: 'power2.out' }));
    N.click();
    N.quip('colour.', 1600);
    audio.whoosh();
    await s.wait(drive(0.8, 'power2.inOut', (p) => {
      const x = x1 + (x2 - x1) * p;
      N.set({ x, y: y1 + Math.sin(p * Math.PI * 3) * 14 });
      flow.paint((x + 26) / W, 0);
    }));
    await s.wait(N.to({ x: x2, y: y2 }, { duration: 0.16, ease: 'power2.inOut' }));
    audio.whoosh();
    await s.wait(drive(0.8, 'power2.inOut', (p) => {
      const x = x2 + (x1 - x2) * p;
      N.set({ x, y: y2 + Math.sin(p * Math.PI * 3) * 14 });
      flow.paint(1, 1 - (x - 26) / W);
    }));
    flow.paint(1);
    await navDrop(N, navBits[2], 'drive.');
  };

  // Kavya types the tagline, then drops in the sound switch.
  const kavya = async () => {
    const chars = $$('.ch', say);
    await s.sleep(240);
    await s.wait(K.to(say, { ax: 0, ay: 0.7, duration: 0.3, ease: 'power2.out' }));
    K.click();
    K.quip('words.', 1200);
    K.to(say, { ax: 1, ay: 1.15, duration: chars.length * 0.03, ease: 'none' });
    for (const [i, ch] of chars.entries()) {
      ch.classList.add('is-on', 'is-caret');
      if (i) chars[i - 1].classList.remove('is-caret');
      if (i % 2 === 0) audio.key();
      await s.sleep(30);
    }
    chars[chars.length - 1].classList.remove('is-caret');
    gsap.set(rot, { opacity: 1 });
    gsap.fromTo(rotW, { yPercent: 110 }, { yPercent: 0, duration: 0.55, ease: 'power3.out' });
    await s.sleep(260);
    await navDrop(K, navBits[1], 'sound.');
  };

  // LeadScout pins the two labels, then the logo.
  const leadscout = async () => {
    await s.sleep(100);
    for (const [el, ax] of [[metaL, 0.08], [metaR, 0.92]]) {
      await s.wait(L.to(el, { ax, ay: 0.5, duration: 0.36, arc: true }));
      L.click(); audio.pop();
      drop(el, { y: -16 });
    }
    L.quip('pinned.', 1000);
    await s.sleep(160);
    await navDrop(L, navBits[0], 'logo.');
  };

  // Stella places the definition, then goes back to fix Tatva's crooked letter.
  const stella = async () => {
    await s.sleep(320);
    await s.wait(S.to(def, { ax: 0.4, ay: 0.4, duration: 0.4, arc: true }));
    S.click(); audio.pop();
    drop(def, { x: 28 });
    await s.sleep(560);
    const last = surname[surname.length - 1];
    await s.wait(S.to(last, { ax: 0.5, ay: 0.5, duration: 0.42, arc: true }));
    S.click(); audio.click();
    S.quip('fixed.', 1100);
    gsap.to(last, { rotation: 0, yPercent: 0, duration: 0.8, ease: 'elastic.out(1.1, 0.4)' });
  };

  await Promise.all([tatva(), nacc(), kavya(), leadscout(), stella()]);
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

  // 2. She selects it and gives it a real typeface.
  S.show();
  await s.wait(S.to(dName, { ax: 0.6, ay: 0.55, duration: 0.7, arc: true }));
  S.click(); audio.click();
  gsap.to(sel, { opacity: 1, duration: 0.12 });
  await s.sleep(240);
  dName.classList.remove('is-plain');
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
  island.say('Pink?');
  await s.sleep(560);
  island.say('No.');
  await s.wait(S.to(dark, { duration: 0.2, ease: 'power2.out' }));
  S.click(); audio.click();
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

  // 5. Everyone builds.
  island.say('Now build.');
  await s.wait(build(s, W));

  // 6. Done: one wave through the letters.
  await s.sleep(180);
  island.say('There. Much better.');
  audio.chime();
  flow.kick(0.9);
  gsap.to(letters, {
    keyframes: [{ yPercent: -8, duration: 0.14, ease: 'power2.out' }, { yPercent: 0, duration: 0.75, ease: 'elastic.out(1, 0.4)' }],
    stagger: 0.03, overwrite: 'auto',
  });
  await s.sleep(1500);
}

/** Put every piece in its finished state, however far the opening got. */
function settle() {
  proxies.forEach((t) => t.kill());
  proxies.length = 0;
  const built = [...letters, ...$$('[data-carry]'), ...cta, ...navBits, rot, rotW];
  gsap.killTweensOf([dName, draft, tools, sel, ...docKids, ...docLinks, ...built]);
  Object.values(cursors).forEach((c) => gsap.killTweensOf(c.el));
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
