// 04 · LeadScout sweeps an area. Business names here are generated samples;
// the lead counts and timings on the preset searches are from real runs.
import gsap from 'gsap';
import { $, $$, h, rand, pick, typeInto } from '../lib/dom.js';
import { audio } from '../lib/audio.js';
import { shell, enter, run, handOver } from './kit.js';

const PRESETS = {
  cafes: { q: 'cafes in Noida', n: 35, time: '26 s', kind: 'cafe', suffix: ['Cafe', 'Coffee House', 'Bakes & Brews'] },
  gyms: { q: 'gyms in Noida', n: 100, time: '2 m 40 s', kind: 'gym', suffix: ['Fitness', 'Gym', 'Strength Club'] },
  coaching: { q: 'coaching in Noida and Ghaziabad', n: 40, time: '2 m 05 s', kind: 'coaching', suffix: ['Classes', 'Academy', 'Tutorials'] },
};
const PREFIX = ['Sunrise', 'Green Leaf', 'Royal', 'City', 'Metro', 'Golden', 'Blue Bird', 'Lotus', 'Skyline', 'Maple', 'Urban', 'Classic', 'Silver Oak', 'Nova', 'Pearl', 'Orbit'];
const AREAS = ['Sector 18', 'Sector 62', 'Sector 15', 'Sector 76', 'Sector 137', 'Sector 50', 'Sector 104', 'Sector 22', 'Indirapuram', 'Vaishali'];
const FOUND = ['☎ ✉', '☎', '☎ ✉ ◎', '☎ ◎', '✉'];

export function mount(stage) {
  const { body, cursor, replayBtn, sc } = shell(stage, { title: 'LeadScout · live extraction', replay: 'Scan again', who: 'leadscout' });
  body.classList.add('ls');
  body.innerHTML = `
    <form class="cmd ls__q">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <input class="cmd__input" type="text" maxlength="40" placeholder="who are you looking for?" aria-label="What kind of business to find">
      <button class="cmd__go" type="submit" data-you="scan">Find leads</button>
    </form>
    <div class="chips">
      <button class="chip" type="button" data-p="cafes">cafes</button>
      <button class="chip" type="button" data-p="gyms">gyms</button>
      <button class="chip" type="button" data-p="coaching">coaching</button>
    </div>
    <div class="ls__main">
      <div class="ls__map">
        <canvas aria-hidden="true"></canvas>
        <div class="ls__hud mono"><b class="ls__count">0</b> leads <span class="ls__time">0 s</span></div>
        <div class="ls__src mono"><span>Google Maps</span><span>Justdial</span><span>Their websites</span></div>
      </div>
      <div class="ls__list">
        <div class="ls__rows"></div>
        <div class="ls__foot mono"><span>sample names</span><span class="ls__export">leads.xlsx ↓</span></div>
      </div>
    </div>`;

  const form = $('.ls__q', body);
  const input = $('.cmd__input', body);
  const go = $('.cmd__go', body);
  const chips = $$('.chip', body);
  const canvas = $('canvas', body);
  const ctx = canvas.getContext('2d');
  const count = $('.ls__count', body);
  const time = $('.ls__time', body);
  const srcs = $$('.ls__src span', body);
  const rows = $('.ls__rows', body);
  const exp = $('.ls__export', body);

  /* ── the map ── */
  let W = 0, H = 0, dpr = 1;
  let base = null;         // pre-rendered streets
  let pins = [];           // {x,y,t}
  let sweeping = false;
  let angle = -Math.PI / 2;
  let raf = 0;
  let visible = false;

  function buildBase() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    base = document.createElement('canvas');
    base.width = canvas.width; base.height = canvas.height;
    const b = base.getContext('2d');
    b.scale(dpr, dpr);
    b.fillStyle = '#07110c'; b.fillRect(0, 0, W, H);
    // a seeded street grid so it looks the same on every visit
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    b.lineCap = 'round';
    for (let x = -20; x < W + 40; x += 34 + rnd() * 22) {
      b.strokeStyle = `rgba(34,212,126,${rnd() > 0.72 ? 0.2 : 0.085})`;
      b.lineWidth = rnd() > 0.72 ? 2.2 : 1;
      b.beginPath(); b.moveTo(x + rnd() * 10, -10); b.lineTo(x + (rnd() - 0.5) * 46, H + 10); b.stroke();
    }
    for (let y = -20; y < H + 40; y += 30 + rnd() * 24) {
      b.strokeStyle = `rgba(34,212,126,${rnd() > 0.72 ? 0.2 : 0.085})`;
      b.lineWidth = rnd() > 0.72 ? 2.2 : 1;
      b.beginPath(); b.moveTo(-10, y + rnd() * 10); b.lineTo(W + 10, y + (rnd() - 0.5) * 40); b.stroke();
    }
    b.strokeStyle = 'rgba(34,212,126,.3)'; b.lineWidth = 5;
    b.beginPath(); b.moveTo(-10, H * 0.82); b.bezierCurveTo(W * 0.3, H * 0.6, W * 0.55, H * 0.5, W + 10, H * 0.12); b.stroke();
    b.fillStyle = 'rgba(233,255,244,.34)'; b.font = '500 9px "JetBrains Mono Variable", monospace';
    [['SEC 18', 0.16, 0.3], ['SEC 62', 0.66, 0.24], ['SEC 137', 0.7, 0.78], ['SEC 50', 0.3, 0.66]].forEach(([t, x, y]) => b.fillText(t, x * W, y * H));
  }

  function frame(now) {
    if (!visible) { raf = 0; return; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(base, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = W / 2, cy = H / 2, R = Math.hypot(W, H) / 2;
    // range rings
    ctx.strokeStyle = 'rgba(34,212,126,.14)'; ctx.lineWidth = 1;
    [0.22, 0.44, 0.66].forEach((f) => { ctx.beginPath(); ctx.arc(cx, cy, R * f, 0, Math.PI * 2); ctx.stroke(); });
    if (sweeping) {
      angle += 0.045;
      const g = ctx.createConicGradient(angle - 1.1, cx, cy);
      g.addColorStop(0, 'rgba(34,212,126,0)');
      g.addColorStop(0.175, 'rgba(34,212,126,.34)');
      g.addColorStop(0.176, 'rgba(34,212,126,0)');
      g.addColorStop(1, 'rgba(34,212,126,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(160,255,210,.9)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(angle) * R, cy + Math.sin(angle) * R); ctx.stroke();
    }
    pins.forEach((p) => {
      const age = (now - p.t) / 1000;
      if (age < 0.9) {
        ctx.strokeStyle = `rgba(34,212,126,${1 - age / 0.9})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3 + age * 22, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = '#22d47e'; ctx.beginPath(); ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#07110c'; ctx.beginPath(); ctx.arc(p.x, p.y, 1.1, 0, Math.PI * 2); ctx.fill();
    });
    raf = requestAnimationFrame(frame);
  }
  const wake = () => { if (!raf && visible) raf = requestAnimationFrame(frame); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) { if (!base || canvas.clientWidth !== W) buildBase(); wake(); } }, { threshold: 0.05 }).observe(canvas);
  window.addEventListener('resize', () => { if (visible) buildBase(); });

  function addPin() {
    // drop the pin just behind the sweep line so the radar seems to find it
    const a = angle - rand(0.05, 0.5);
    const r = rand(0.12, 0.92) * Math.min(W, H) / 2;
    pins.push({ x: W / 2 + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r, t: performance.now() });
  }
  function addRow(p) {
    const row = h(`<div class="ls__row"><b>${pick(PREFIX)} ${pick(p.suffix)}</b><span>${pick(AREAS)} · ${p.kind}</span><em>${pick(FOUND)}</em></div>`);
    rows.prepend(row);
    while (rows.children.length > 12) rows.lastElementChild.remove();
  }

  // true only while the agent is typing into the field by itself
  let autoTyping = false;
  handOver(input, () => autoTyping, () => {
    sc.stop();
    cursor.hide();
    autoTyping = false;
    input.value = '';
    form.classList.remove('is-focus');
  });

  function reset() {
    autoTyping = false;
    pins = []; sweeping = false;
    rows.innerHTML = '';
    count.textContent = '0'; time.textContent = '0 s';
    srcs.forEach((x) => x.classList.remove('is-on'));
    exp.classList.remove('is-on');
    form.classList.remove('is-focus');
  }

  async function scan(p, { auto = false } = {}) {
    const s = sc.begin();
    reset();
    chips.forEach((c) => c.classList.toggle('is-on', PRESETS[c.dataset.p] === p));
    await run(async () => {
      if (auto) {
        autoTyping = true;
        enter(cursor, stage, 'br');
        await s.wait(cursor.to(input, { ax: 0.25 }));
        cursor.click(); audio.click();
        form.classList.add('is-focus');
        await typeInto(input, p.q, s);
        await s.wait(cursor.to(go));
        cursor.click(); audio.click();
        form.classList.remove('is-focus');
        autoTyping = false;
        cursor.to(canvas, { ax: 0.5, ay: 0.5, duration: 0.9 });
      } else {
        input.value = p.q;
      }
      if (!base) buildBase();
      sweeping = true; wake();
      audio.whoosh();
      const total = p.n;
      const dur = 4200;
      const start = performance.now();
      let made = 0;
      while (made < total) {
        const t = Math.min(1, (performance.now() - start) / dur);
        const want = Math.round(t * total);
        while (made < want) {
          made += 1;
          addPin();
          if (made % Math.ceil(total / 14) === 0 || made === total) addRow(p);
          count.textContent = made;
        }
        srcs[0].classList.add('is-on');
        if (t > 0.3) srcs[1].classList.add('is-on');
        if (t > 0.55) srcs[2].classList.add('is-on');
        time.textContent = p.real ? 'searching…' : 'simulating…';
        if (made % 5 === 0) audio.tick();
        await s.sleep(60);
      }
      sweeping = false;
      time.textContent = p.real ? `in ${p.time} · real run` : 'simulated';
      await s.sleep(300);
      exp.classList.add('is-on');
      audio.chime();
      if (auto) cursor.hide();
    });
  }

  const preset = (k) => Object.assign(PRESETS[k], { real: true });
  chips.forEach((c) => c.addEventListener('click', () => { cursor.hide(); scan(preset(c.dataset.p)); }));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) { input.focus(); return; }
    const key = Object.keys(PRESETS).find((k) => PRESETS[k].q === q);
    cursor.hide();
    scan(key ? preset(key) : { q, n: Math.round(rand(18, 42)), kind: q.split(' ')[0].toLowerCase(), suffix: ['& Co.', 'Point', 'Hub', 'Centre'], real: false });
  });
  replayBtn.addEventListener('click', () => { cursor.hide(); scan(preset('cafes'), { auto: true }); });

  return { play: () => scan(preset('cafes'), { auto: true }), trigger: go };
}
