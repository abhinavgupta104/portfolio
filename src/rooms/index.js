// Mounts every demo and plays each one once, the first time it scrolls into view.
import { $$, reduced } from '../lib/dom.js';
import * as stella from './stella.js';
import * as kavya from './kavya.js';
import * as nacc from './nacc.js';
import * as leadscout from './leadscout.js';
import * as tatva from './tatva.js';
import * as sms from './sms.js';
import * as panel from './panel.js';

const MODS = { stella, kavya, nacc, leadscout, tatva, sms, panel };
export const rooms = {};

export function initRooms({ isTouring }) {
  $$('.stage[data-stage]').forEach((stage) => {
    const key = stage.dataset.stage;
    rooms[key] = { ...MODS[key].mount(stage), stage, played: false };
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const r = rooms[e.target.dataset.stage];
      if (e.isIntersecting && e.intersectionRatio >= 0.4) {
        if (!r.played && !reduced && !isTouring()) { r.played = true; r.play(); }
      } else if (!e.isIntersecting && r.stop && !isTouring()) {
        r.stop(); // e.g. hang up Kavya's call when the visitor scrolls away
      }
    });
  }, { threshold: [0, 0.4] });
  Object.values(rooms).forEach((r) => io.observe(r.stage));
}
