// "Let Stella drive": she takes the page, scrolls it, runs each demo and talks
// in the island. Any scroll, swipe or Esc hands control straight back.
import { $, $$, scope, run } from './lib/dom.js';
import { AgentCursor, AGENTS } from './lib/cursor.js';
import { island } from './lib/island.js';
import { audio } from './lib/audio.js';
import { scrollToEl } from './lib/scroll.js';
import { rooms } from './rooms/index.js';
import { galleryTravel } from './sections.js';

const STOPS = [
  { el: '#def', say: 'His name means “new”. He takes it personally.', hold: 3000 },
  { el: '#crew', say: 'The crew. Four agents, four platforms. I am first, obviously.', hold: 600, sweep: true },
  { el: '#stella', room: 'stella', say: 'This is me. I brief a team of AIs, read their code and run the tests.', wait: 10500 },
  { el: '#kavya', room: 'kavya', say: 'Kavya makes the phone calls. Real ones, on a real SIM.', wait: 17000 },
  { el: '#nacc', room: 'nacc', say: 'NACC does the marketing. Loud, but it works.', wait: 7500 },
  { el: '#leadscout', room: 'leadscout', say: 'LeadScout finds the customers. Thirty-five real leads in twenty-six seconds.', wait: 8500 },
  { el: '#tatva', room: 'tatva', say: 'Tatva is his component library. One sentence in, one website out.', wait: 9500 },
  { el: '#sms', room: 'sms', say: 'The SMS platform. Typed here, delivered there, in about four seconds.', wait: 9000 },
  { el: '#panel', room: 'panel', say: 'The WhatsApp panel. It chats, it sells, and it takes the payment.', wait: 9500 },
  { el: '#gallery', say: 'Seven websites. All live. Go on, check.', hold: 1200, centre: true, slide: true },
  { el: '#about', say: 'That is the human. He runs Arch. He will mention it.', hold: 3600 },
  { el: '#contact', say: 'That is the tour. He is better in person. Say hi.', hold: 3400, point: '#contactLinks a' },
];

const sc = scope();
let active = false;
let cursor = null;
const buttons = () => $$('#tourBtn, #tourBtnHero, #tourBtnFoot');

export const isTouring = () => active;

function paint() {
  document.body.classList.toggle('is-touring', active);
  const nav = $('#tourBtn');
  nav.classList.toggle('is-on', active);
  nav.querySelector('.pill__label').textContent = active ? 'Stop the tour' : 'Let Stella drive';
}

// Offset that puts an element in the middle of the screen (or just under the nav if it is tall).
const centreOffset = (el) => {
  const free = window.innerHeight - el.offsetHeight;
  return -Math.max(84, free / 2);
};

async function drive(s) {
  await s.wait(island.say('Hi. I am Stella. Sit back, I will drive.'));
  await s.sleep(1200);

  for (const stop of STOPS) {
    const el = $(stop.el);
    await s.wait(scrollToEl(el, { duration: 1.7, offset: stop.centre ? centreOffset(el) : 0 }));
    island.say(stop.say);

    if (stop.sweep) {
      // run down the crew list, lighting each row as she passes
      const rows = $$('.crew__list a');
      const list = $('.crew__list');
      await s.wait(scrollToEl(list, { duration: 1.2, offset: centreOffset(list) }));
      for (const row of rows) {
        await s.wait(cursor.to(row, { ax: 0.3, ay: 0.5, duration: 0.32, ease: 'power2.out' }));
        rows.forEach((r) => r.classList.toggle('is-hot', r === row));
        audio.tick();
        await s.sleep(170);
      }
      rows.forEach((r) => r.classList.remove('is-hot'));
    }

    if (stop.room) {
      const r = rooms[stop.room];
      await s.sleep(900);
      await s.wait(scrollToEl(r.stage, { duration: 1.3, offset: centreOffset(r.stage) }));
      await s.wait(cursor.to(r.stage, { ax: 0.5, ay: 0.02, duration: 0.6 }));
      cursor.click();
      r.played = true;
      // The room's own agent runs the demo; she watches, then moves on. In her
      // own room that agent is her, so the tour pointer steps aside.
      if (stop.room === 'stella') cursor.hide();
      await Promise.race([r.play({ brief: true }), s.sleep(stop.wait)]);
      s.check();
      if (r.stop) r.stop();
      if (stop.room === 'stella') { cursor.set(r.stage, 0.5, 0.02); cursor.show(); }
      await s.sleep(900);
    } else {
      if (stop.slide && galleryTravel() > 0) {
        // the strip is pinned here: scrolling on carries the six sites past
        await s.sleep(700);
        await s.wait(scrollToEl(window.scrollY + galleryTravel(), { duration: 5.5 }));
      }
      if (stop.point && $(stop.point)) {
        await s.sleep(800);
        await s.wait(cursor.to($(stop.point), { duration: 0.9 }));
        cursor.click();
      }
      await s.sleep(stop.hold);
    }
  }
}

function end() {
  if (!active) return;
  active = false;
  paint();
  if (cursor) cursor.hide();
  island.quiet();
}

export function stopTour(line = 'You took the wheel. Fine.') {
  if (!active) return;
  sc.stop();
  active = false;
  paint();
  if (cursor) cursor.hide();
  Object.values(rooms).forEach((r) => { if (r.stop) r.stop(); });
  island.say(line).then(() => setTimeout(() => { if (!active) island.quiet(); }, 1500));
}

export async function startTour() {
  if (active) { stopTour('Fine. You drive.'); return; }
  active = true;
  paint();
  audio.chime();
  if (!cursor) cursor = new AgentCursor($('#tourLayer'), AGENTS.stella);
  cursor.set({ x: window.innerWidth - 150, y: 110 });
  cursor.show();

  const s = sc.begin();
  await run(async () => {
    await drive(s);
    end();
  });
}

export function initTour() {
  buttons().forEach((b) => b.addEventListener('click', () => { audio.click(); startTour(); }));
  island.stop.addEventListener('click', () => stopTour('Fine. You drive.'));
  const takeOver = () => { if (active) stopTour(); };
  window.addEventListener('wheel', takeOver, { passive: true });
  window.addEventListener('touchmove', takeOver, { passive: true });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') takeOver(); });
}
