// Shared scaffolding for the demo stages.
import { $, scope, run, reduced } from '../lib/dom.js';
import { AgentCursor, AGENTS } from '../lib/cursor.js';

/** Fill a .stage with its title bar and an empty body; return the pieces. */
export function shell(stage, { title, replay, who }) {
  stage.innerHTML = `
    <div class="stage__bar"><span>${title}</span><button class="stage__replay" type="button" data-you="replay">${replay} ↺</button></div>
    <div class="stage__body"></div>`;
  const body = $('.stage__body', stage);
  const cursor = new AgentCursor(stage, AGENTS[who]);
  return { body, cursor, replayBtn: $('.stage__replay', stage), sc: scope() };
}

/** Park the cursor just outside a corner, ready to glide in. */
export function enter(cursor, stage, from = 'br') {
  const w = stage.clientWidth;
  const hgt = stage.clientHeight;
  const p = { br: { x: w - 40, y: hgt - 30 }, tr: { x: w - 40, y: 60 }, bl: { x: 40, y: hgt - 30 } }[from];
  cursor.set(p);
  cursor.show();
}

/**
 * If the visitor clicks or types in a field while the agent is still
 * auto-typing into it, the agent lets go at once and the field is emptied, so
 * two "typists" never scramble each other's text. `isAuto` says whether the
 * agent is typing right now; `release` stops it.
 */
export function handOver(field, isAuto, release) {
  const take = () => { if (isAuto()) release(); };
  // The agent never focuses the field or sends real input events, so any of
  // these means a person. `beforeinput` matters most: phone keyboards, Hindi
  // input methods and paste all fire it, often without a usable `keydown`.
  ['pointerdown', 'focus', 'keydown', 'beforeinput'].forEach((type) => field.addEventListener(type, take));
}

export { run, reduced };
