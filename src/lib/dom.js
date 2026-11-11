// Small DOM + timing helpers shared by every module.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const coarse = matchMedia('(pointer: coarse)').matches;

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// Thrown inside a demo when a newer run has replaced it. Callers swallow it.
export class Cancel extends Error {}

/**
 * A cancellable async scope. Each demo calls `scope.begin()` when it starts;
 * any older run still awaiting `sleep()` or `wait()` is rejected with Cancel,
 * so two runs can never animate the same stage at once.
 */
export function scope() {
  let id = 0;
  return {
    begin() {
      const mine = ++id;
      const alive = () => mine === id;
      const check = () => { if (!alive()) throw new Cancel(); };
      const sleep = (ms) => new Promise((res, rej) => setTimeout(() => (alive() ? res() : rej(new Cancel())), ms));
      const wait = async (thenable) => { const v = await thenable; check(); return v; };
      return { alive, check, sleep, wait };
    },
    stop() { id++; },
  };
}

export async function run(fn) {
  try { return await fn(); } catch (e) { if (!(e instanceof Cancel)) throw e; }
}

// Type text into an <input>/<textarea> or an element, one character at a time.
export async function typeInto(el, text, s, { min = 22, max = 60 } = {}) {
  const isField = 'value' in el;
  if (isField) el.value = ''; else el.textContent = '';
  for (const ch of text) {
    if (isField) el.value += ch; else el.textContent += ch;
    if (isField) el.dispatchEvent(new Event('input', { bubbles: true }));
    await s.sleep(rand(min, max));
  }
}
