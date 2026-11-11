// A named, coloured pointer for an agent — the way collaborators show up in a
// design tool. Positions are relative to `host`, so a cursor lives inside the
// stage it works on and scrolls with it.
import gsap from 'gsap';
import { h, clamp } from './dom.js';

const ARROW = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 2.6 19.6 10.9l-7 1.9-2.6 7z" fill="currentColor" stroke="rgba(0,0,0,.45)" stroke-width="1" stroke-linejoin="round"/></svg>';

export class AgentCursor {
  constructor(host, { name, color, ink = '#08080b' }) {
    this.host = host;
    this.name = name;
    this.x = 0; this.y = 0;
    this.el = h(`<div class="cur" style="--c:${color};--ci:${ink}"><span class="cur__ring"></span><span class="cur__arrow">${ARROW}</span><span class="cur__tag">${name}</span></div>`);
    this.tag = this.el.querySelector('.cur__tag');
    this.arrow = this.el.querySelector('.cur__arrow');
    this.ring = this.el.querySelector('.cur__ring');
    host.appendChild(this.el);
    gsap.set(this.el, { x: 0, y: 0, autoAlpha: 0 });
    // The host's width is remembered (not re-read every frame) so the name tag
    // can swap to the pointer's left side before it would run off the right edge.
    this.hostW = host.clientWidth;
    window.addEventListener('resize', () => { this.hostW = host.clientWidth; });
  }

  /** Keep the name tag on screen: hang it to the left when the pointer is near the right edge. */
  side(x) {
    if (this.hostW) this.el.classList.toggle('is-flip', x > this.hostW - 150);
  }

  /** Resolve an element (or a point) to coordinates inside the host. */
  point(target, ax = 0.5, ay = 0.5) {
    if (target instanceof Element) {
      const r = target.getBoundingClientRect();
      const hr = this.host.getBoundingClientRect();
      return { x: r.left - hr.left + r.width * ax, y: r.top - hr.top + r.height * ay };
    }
    return target;
  }

  set(target, ax, ay) {
    const p = this.point(target, ax, ay);
    this.x = p.x; this.y = p.y;
    this.side(p.x);
    gsap.set(this.el, { x: p.x, y: p.y });
    return this;
  }

  show() { return gsap.to(this.el, { autoAlpha: 1, duration: 0.25, overwrite: 'auto' }); }
  hide() { return gsap.to(this.el, { autoAlpha: 0, duration: 0.3, overwrite: 'auto' }); }

  /**
   * Glide to a target. Duration scales with distance so it never feels robotic.
   * With `arc`, x and y ease differently, so the pointer travels in a curve the
   * way a hand moves a mouse instead of along a ruler-straight line.
   */
  to(target, { ax, ay, duration, ease = 'power3.inOut', arc = false } = {}) {
    const p = this.point(target, ax, ay);
    const dist = Math.hypot(p.x - this.x, p.y - this.y);
    const d = duration ?? clamp(dist / 900, 0.4, 1.05);
    this.x = p.x; this.y = p.y;
    this.side(p.x);
    if (!arc) return gsap.to(this.el, { x: p.x, y: p.y, duration: d, ease, overwrite: 'auto' });
    gsap.to(this.el, { x: p.x, duration: d, ease: 'power2.inOut', overwrite: 'auto' });
    return gsap.to(this.el, { y: p.y, duration: d, ease: 'power3.out', overwrite: 'auto' });
  }

  /** Press: the arrow dips and an outlined ring expands, like watch mode. */
  click() {
    gsap.fromTo(this.ring, { scale: 0.3, opacity: 0.95 }, { scale: 1.6, opacity: 0, duration: 0.55, ease: 'power2.out', overwrite: true });
    return gsap.fromTo(this.arrow, { scale: 1 }, { scale: 0.78, duration: 0.09, yoyo: true, repeat: 1, ease: 'power1.inOut', overwrite: true });
  }

  /** Swap the name tag for a short remark, then put the name back. */
  quip(text, ms = 1500) {
    clearTimeout(this._q);
    this.tag.textContent = text;
    this._q = setTimeout(() => { this.tag.textContent = this.name; }, ms);
  }
}

export const AGENTS = {
  stella: { name: 'Stella', color: '#ffb21a' },
  kavya: { name: 'Kavya', color: '#ff3f8e' },
  nacc: { name: 'NACC', color: '#4f74ff', ink: '#ffffff' },
  leadscout: { name: 'LeadScout', color: '#22d47e' },
  tatva: { name: 'Tatva', color: '#a47aff' },
  sms: { name: 'Portal', color: '#ff7a45' },
  panel: { name: 'Bot', color: '#17d3bd' },
};
