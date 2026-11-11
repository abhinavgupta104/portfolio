// The pill at the top centre. Idle: it names the section and shows scroll
// progress. On tour: it grows into Stella's subtitle bar.
import { $ } from './dom.js';
import { audio } from './audio.js';

const el = $('#island');
const text = $('#islandText');
const stop = $('#islandStop');
let label = 'Portfolio';
let saying = false;
let typeTimer = null;

// Width can't transition to `auto`, so measure the new content off-screen first.
function widthFor(str, say) {
  const probe = el.cloneNode(true);
  probe.removeAttribute('id');
  probe.style.cssText = 'position:absolute;visibility:hidden;width:auto;transition:none;pointer-events:none';
  probe.classList.toggle('is-say', say);
  probe.querySelector('.island__text').textContent = str;
  probe.querySelector('.island__stop').hidden = !say;
  el.parentNode.appendChild(probe);
  const w = Math.ceil(probe.getBoundingClientRect().width) + 2;
  probe.remove();
  return w;
}

function paint(str, say) {
  el.style.width = widthFor(str, say) + 'px';
}

export const island = {
  el, stop,
  setLabel(str) {
    label = str;
    if (saying) return;
    text.textContent = str;
    paint(str, false);
  },
  progress(p) { el.style.setProperty('--p', p.toFixed(4)); },
  /** Stella speaks: the island expands and the line types itself out. */
  say(str, { speed = 16 } = {}) {
    saying = true;
    clearInterval(typeTimer);
    el.classList.add('is-say');
    stop.hidden = false;
    paint(str, true);
    text.textContent = '';
    return new Promise((resolve) => {
      let i = 0;
      typeTimer = setInterval(() => {
        i += 1;
        text.textContent = str.slice(0, i);
        if (i % 3 === 0) audio.key();
        if (i >= str.length) { clearInterval(typeTimer); resolve(); }
      }, speed);
    });
  },
  quiet() {
    saying = false;
    clearInterval(typeTimer);
    el.classList.remove('is-say');
    stop.hidden = true;
    text.textContent = label;
    paint(label, false);
  },
};
