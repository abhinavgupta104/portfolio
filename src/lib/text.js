// Typography helpers: split a heading into words/characters for animation, and
// fit a display heading edge-to-edge by solving for the font's WIDTH axis.
import { $$ } from './dom.js';

const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
const graphemes = (str) => (seg ? [...seg.segment(str)].map((s) => s.segment) : [...str]);

/** <h2>Two words</h2> → words in .w (clipping masks), letters in .c. Keeps <br>. */
export function split(el) {
  if (el.dataset.splitDone) return $$('.c', el);
  const label = el.textContent.replace(/\s+/g, ' ').trim();
  const out = [];
  el.childNodes.forEach((node) => {
    if (node.nodeType === 3) {
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { out.push(' '); return; }
        out.push(`<span class="w">${graphemes(part).map((g) => `<span class="c">${g}</span>`).join('')}</span>`);
      });
    } else if (node.nodeName === 'BR') out.push('<br>');
    else out.push(node.outerHTML);
  });
  el.innerHTML = out.join('').trim();
  el.setAttribute('aria-label', label);
  $$('.w', el).forEach((w) => w.setAttribute('aria-hidden', 'true'));
  el.dataset.splitDone = '1';
  return $$('.c', el);
}

/**
 * Make a heading span `width` px. The Anek typeface has a width axis
 * (75–125 %), so instead of only scaling the type we first narrow or widen the
 * letters themselves, and scale the size only when the axis runs out. Result:
 * "NACC" and "WHATSAPP PANEL" both sit edge to edge at a similar height.
 */
export function fit(el, width, { max = 400, min = 30, wdthMax = 125, wdthMin = 75 } = {}) {
  const measure = () => {
    const kids = el.classList.contains('is-stack') ? $$('.w', el) : [el];
    return Math.max(...kids.map((k) => k.scrollWidth));
  };
  el.style.fontSize = max + 'px';
  el.style.setProperty('--wdth', wdthMax + '%');
  let w = measure();
  let wdth = wdthMax;
  if (w > width) {
    let lo = wdthMin;
    let hi = wdthMax;
    el.style.setProperty('--wdth', lo + '%');
    if (measure() > width) {
      wdth = lo;
    } else {
      for (let i = 0; i < 9; i++) {
        const mid = (lo + hi) / 2;
        el.style.setProperty('--wdth', mid + '%');
        if (measure() > width) hi = mid; else lo = mid;
      }
      wdth = lo;
    }
    el.style.setProperty('--wdth', wdth + '%');
    w = measure();
  }
  let size = max;
  if (w > width) size = Math.max(min, Math.floor(max * (width / w) * 0.995));
  el.style.fontSize = size + 'px';
  return { size, wdth };
}
