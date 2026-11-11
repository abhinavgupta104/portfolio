// 02 · A phone call with Kavya. The conversation is scripted (the real agent
// needs a SIM and a model), but its shape is true to her: she asks before
// sending anything, and she admits she is an AI when asked.
import { $, $$, h } from '../lib/dom.js';
import { audio } from '../lib/audio.js';
import { shell, enter, run } from './kit.js';

const SCRIPT = [
  { who: 'k', hi: 'Hello? Namaste, Kavya bol rahi hoon. Aapne WhatsApp automation ke baare mein poocha tha na?', en: 'Hello? Namaste, this is Kavya. You asked about WhatsApp automation, right?', ms: 2600 },
  { who: 'c', hi: 'Haan… par ek minute. Aap robot ho kya?', en: 'Yes… but one minute. Are you a robot?', ms: 1700 },
  { who: 'k', hi: 'Haha, pakdi gayi. Haan, main AI hoon. Par sawaal asli hain: aapka business kya hai?', en: 'Haha, caught. Yes, I am an AI. The questions are real though: what is your business?', ms: 2700, lat: 1.2 },
  { who: 'c', hi: 'Coaching centre hai, Noida mein.', en: 'A coaching centre, in Noida.', ms: 1400 },
  { who: 'k', hi: 'Badhiya. Admission ke time enquiries kahan zyada aati hain, call pe ya WhatsApp pe?', en: 'Nice. In admission season, where do more enquiries come: calls or WhatsApp?', ms: 2600, lat: 1.3 },
  { who: 'c', hi: 'Dono. Sambhalna mushkil ho jaata hai.', en: 'Both. It gets hard to keep up.', ms: 1500 },
  { who: 'k', hi: 'Samajh gayi. Details WhatsApp pe bhej doon? Team wahin aapse baat kar legi.', en: 'Got it. Shall I send the details on WhatsApp? The team will talk to you there.', ms: 2500, lat: 1.1 },
  { who: 'c', hi: 'Haan, bhej do.', en: 'Yes, send them.', ms: 1000 },
  { who: 'k', hi: 'Done. Thank you, aapka din achha rahe!', en: 'Done. Thank you, have a good day!', ms: 1700, lat: 1.2 },
];

// The lines kept in the short cut: greeting, "are you a robot?", the honest
// answer, the business, the WhatsApp ask, the yes, and the goodbye.
const BRIEF = [0, 1, 2, 3, 6, 7, 8];

const PHONE = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.37 2.3.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>';

export function mount(stage) {
  const { body, cursor, replayBtn, sc } = shell(stage, { title: 'Live call · SIM over Bluetooth', replay: 'Call again', who: 'kavya' });
  body.classList.add('kv');
  body.innerHTML = `
    <div class="phone">
      <div class="phone__screen">
        <div class="phone__top"><span class="kv__time">9:41</span><span>5G ▂▄▆</span></div>
        <div class="kv__who">
          <div class="kv__avatar"><span lang="hi">का</span><i></i><i></i><i></i></div>
          <b class="kv__name">Kavya</b>
          <span class="kv__state">AI voice agent · tap to call</span>
        </div>
        <canvas class="kv__wave" aria-hidden="true"></canvas>
        <div class="kv__lines"></div>
        <div class="kv__ctl"><button class="kv__call" type="button" aria-label="Call Kavya" data-you="call her">${PHONE}</button></div>
      </div>
    </div>
    <div class="kv__side">
      <div class="kv__meter">
        <span class="lbl">Her reply time</span>
        <b class="kv__lat">—</b>
        <div class="kv__bars" aria-hidden="true"></div>
      </div>
      <div class="seg" role="group" aria-label="Transcript language">
        <button type="button" class="is-on" data-lang="hi">Hinglish</button><button type="button" data-lang="en">English</button>
      </div>
      <div class="kv__sum">
        <span class="lbl">What she wrote after the call</span>
        <p>Coaching centre in Noida. Enquiries come by call and WhatsApp and are hard to keep up with.</p>
        <ul><li>Asked if I was a robot. Told the truth.</li><li>Agreed to details on WhatsApp</li><li>Outcome: follow-up by the team</li></ul>
      </div>
    </div>`;

  const call = $('.kv__call', body);
  const state = $('.kv__state', body);
  const lines = $('.kv__lines', body);
  const lat = $('.kv__lat', body);
  const bars = $('.kv__bars', body);
  const sum = $('.kv__sum', body);
  const canvas = $('.kv__wave', body);
  const ctx = canvas.getContext('2d');
  let lang = 'hi';
  let speaker = null; // 'k' | 'c' | null
  let live = false;
  let raf = 0;
  let t0 = 0;
  const levels = new Array(28).fill(0.04);

  const now = new Date();
  $('.kv__time', body).textContent = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

  function draw() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const hgt = canvas.clientHeight;
    if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = hgt * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hgt);
    const gap = w / levels.length;
    ctx.fillStyle = speaker === 'c' ? 'rgba(255,255,255,.85)' : '#ff3f8e';
    levels.forEach((v, i) => {
      const edge = 1 - Math.abs(i - levels.length / 2) / (levels.length / 2) * 0.55;
      const target = speaker ? (0.12 + Math.random() * 0.88) * edge : 0.04;
      levels[i] += (target - v) * (speaker ? 0.28 : 0.12);
      const bh = Math.max(2, levels[i] * hgt);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(i * gap + gap * 0.22, (hgt - bh) / 2, gap * 0.56, bh, 2);
      else ctx.rect(i * gap + gap * 0.22, (hgt - bh) / 2, gap * 0.56, bh);
      ctx.fill();
    });
    if (live) state.textContent = `on call · ${fmt((performance.now() - t0) / 1000)}`;
    raf = requestAnimationFrame(draw);
  }
  const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

  function bubble(line) {
    const main = lang === 'hi' ? line.hi : line.en;
    const sub = lang === 'hi' ? line.en : line.hi;
    const b = h(`<div class="kv__b ${line.who === 'k' ? 'me' : ''}">${main}<small>${sub}</small></div>`);
    b._line = line;
    lines.appendChild(b);
    while (lines.children.length > 3) lines.firstElementChild.remove();
  }
  function relabel() {
    $$('.kv__b', lines).forEach((b) => {
      const l = b._line;
      b.innerHTML = `${lang === 'hi' ? l.hi : l.en}<small>${lang === 'hi' ? l.en : l.hi}</small>`;
    });
  }

  function reset() {
    cancelAnimationFrame(raf);
    audio.ringStop();
    live = false; speaker = null;
    body.classList.remove('is-ringing', 'is-live');
    lines.innerHTML = '';
    bars.innerHTML = '';
    lat.textContent = '—';
    sum.classList.remove('is-show');
    state.textContent = 'AI voice agent · tap to call';
    call.setAttribute('aria-label', 'Call Kavya');
  }

  // `brief` is the shorter cut of the same call, used when Stella is giving the tour
  async function dial({ auto = false, brief = false } = {}) {
    const script = brief ? SCRIPT.filter((_, i) => BRIEF.includes(i)) : SCRIPT;
    $('p', sum).textContent = brief
      ? 'Coaching centre in Noida. Wants the details on WhatsApp.'
      : 'Coaching centre in Noida. Enquiries come by call and WhatsApp and are hard to keep up with.';
    const s = sc.begin();
    reset();
    await run(async () => {
      if (auto) {
        enter(cursor, stage, 'br');
        await s.wait(cursor.to(call));
        cursor.click();
      }
      audio.click();
      body.classList.add('is-ringing');
      call.setAttribute('aria-label', 'End the call');
      state.textContent = 'ringing…';
      raf = requestAnimationFrame(draw);
      audio.ringStart();
      if (auto) cursor.to(lat, { ax: 0.8, ay: 0.5, duration: 0.9 });
      await s.sleep(1700);
      audio.ringStop();
      audio.pop();
      body.classList.replace('is-ringing', 'is-live');
      live = true; t0 = performance.now();
      await s.sleep(450);

      for (const line of script) {
        if (line.lat) {
          // the gap before she answers is the thing I measured on real calls
          speaker = null;
          await s.sleep(line.lat * 420);
          lat.innerHTML = `${line.lat.toFixed(1)}<small>s</small>`;
          const bar = document.createElement('i');
          bar.style.setProperty('--h', `${Math.round((line.lat / 1.5) * 100)}%`);
          bars.appendChild(bar);
        } else {
          await s.sleep(260);
        }
        speaker = line.who;
        bubble(line);
        await s.sleep(line.ms * 0.8);
      }
      speaker = null;
      await s.sleep(350);
      hangUp(true);
      if (auto) cursor.hide();
    });
  }

  function hangUp(natural) {
    sc.stop();
    const secs = live ? (performance.now() - t0) / 1000 : 0;
    cancelAnimationFrame(raf);
    audio.ringStop();
    audio.hang();
    live = false; speaker = null;
    body.classList.remove('is-ringing', 'is-live');
    call.setAttribute('aria-label', 'Call Kavya');
    state.textContent = natural ? `she hung up · ${fmt(secs)}` : 'call ended';
    if (natural) sum.classList.add('is-show');
  }

  call.addEventListener('click', () => {
    cursor.hide();
    if (body.classList.contains('is-ringing') || body.classList.contains('is-live')) hangUp(false);
    else dial();
  });
  $$('.seg button', body).forEach((b) => b.addEventListener('click', () => {
    lang = b.dataset.lang;
    $$('.seg button', body).forEach((x) => x.classList.toggle('is-on', x === b));
    relabel();
  }));
  replayBtn.addEventListener('click', () => { cursor.hide(); dial(); });

  return {
    play: (opts = {}) => dial({ auto: true, brief: !!opts.brief }),
    trigger: call,
    stop: () => { if (live || body.classList.contains('is-ringing')) hangUp(false); },
  };
}
