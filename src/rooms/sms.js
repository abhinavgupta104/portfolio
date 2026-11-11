// 06 · An SMS travels from the portal to a handset. The character counter is
// real SMS maths (GSM-7 vs Unicode, 160/153 and 70/67 per part), and the whole
// trip is paced to take about four seconds because the real one does.
import { $, $$, h, typeInto } from '../lib/dom.js';
import { audio } from '../lib/audio.js';
import { shell, enter, run, handOver } from './kit.js';

const GSM7 = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ!\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXT = '^{}\\[~]|€';
const DEFAULT = 'You scrolled this far. Abhinav says thanks. Reply HIRE to continue.';

export function measure(text) {
  let len = 0;
  let unicode = false;
  for (const ch of text) {
    if (GSM7.includes(ch)) len += 1;
    else if (GSM7_EXT.includes(ch)) len += 2;
    else unicode = true;
  }
  if (unicode) {
    const n = text.length; // UTF-16 units, which is how UCS-2 parts are counted
    const parts = n <= 70 ? 1 : Math.ceil(n / 67);
    return { enc: 'Unicode', len: n, cap: n <= 70 ? 70 : parts * 67, parts: Math.max(1, parts) };
  }
  const parts = len <= 160 ? 1 : Math.ceil(len / 153);
  return { enc: 'GSM-7', len, cap: len <= 160 ? 160 : parts * 153, parts: Math.max(1, parts) };
}

export function mount(stage) {
  const { body, cursor, replayBtn, sc } = shell(stage, { title: 'Send → deliver', replay: 'Send again', who: 'sms' });
  body.classList.add('sm');
  body.innerHTML = `
    <div class="sm__left">
      <form class="sm__compose">
        <span class="lbl">Message</span>
        <textarea class="sm__text" rows="2" maxlength="320" aria-label="SMS text" placeholder="Type an SMS. Try some Hindi."></textarea>
        <div class="sm__meta"><span class="sm__count">0 / 160</span><span class="sm__enc">GSM-7</span><span class="sm__parts">1 SMS</span><button class="sm__send" type="submit" data-you="send it">Send</button></div>
      </form>
      <ol class="sm__pipe"><li>Portal</li><li>Queue</li><li>DLT check</li><li>SMPP</li><li>Carrier</li><li>Phone</li></ol>
      <div class="sm__log" aria-live="off"></div>
    </div>
    <div class="sm__phone">
      <div class="phone phone--sm"><div class="phone__screen sm__screen">
        <div class="sm__clock">9:41</div><div class="sm__date"></div><div class="sm__notes"></div>
      </div></div>
      <div class="sm__timer"><b>0.0</b> s to delivered</div>
    </div>`;

  const form = $('.sm__compose', body);
  const text = $('.sm__text', body);
  const send = $('.sm__send', body);
  const count = $('.sm__count', body);
  const enc = $('.sm__enc', body);
  const partsEl = $('.sm__parts', body);
  const pipe = $('.sm__pipe', body);
  const nodes = $$('li', pipe);
  const log = $('.sm__log', body);
  const notes = $('.sm__notes', body);
  const timer = $('.sm__timer', body);
  const timerB = $('b', timer);

  const d = new Date();
  $('.sm__clock', body).textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  $('.sm__date', body).textContent = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  function meter() {
    const m = measure(text.value);
    count.textContent = `${m.len} / ${m.cap}`;
    enc.textContent = m.enc;
    enc.classList.toggle('is-uni', m.enc === 'Unicode');
    partsEl.textContent = `${m.parts} SMS`;
    return m;
  }
  text.addEventListener('input', meter);

  const say = (html, cls = '') => {
    log.appendChild(h(`<div class="${cls}">${html}</div>`));
    while (log.children.length > 7) log.firstElementChild.remove();
  };
  const stamp = () => new Date().toTimeString().slice(0, 8);

  // true only while the agent is typing into the field by itself
  let autoTyping = false;
  handOver(text, () => autoTyping, () => {
    sc.stop();
    cursor.hide();
    autoTyping = false;
    text.value = '';
    meter();
    form.classList.remove('is-focus');
  });

  function reset() {
    autoTyping = false;
    nodes.forEach((n) => n.classList.remove('is-on'));
    pipe.style.setProperty('--p', 0);
    log.innerHTML = '';
    timer.classList.remove('is-done');
    timerB.textContent = '0.0';
    form.classList.remove('is-focus');
  }

  async function deliver({ auto = false } = {}) {
    const s = sc.begin();
    reset();
    await run(async () => {
      if (auto) {
        autoTyping = true;
        enter(cursor, stage, 'bl');
        await s.wait(cursor.to(text, { ax: 0.2, ay: 0.5 }));
        cursor.click(); audio.click();
        form.classList.add('is-focus');
        await typeInto(text, DEFAULT, s, { min: 10, max: 28 });
        await s.wait(cursor.to(send));
        cursor.click();
        form.classList.remove('is-focus');
        autoTyping = false;
      }
      if (!text.value.trim()) text.value = DEFAULT;
      const m = meter();
      const body_ = text.value.trim();
      audio.click();

      const t0 = performance.now();
      let ticking = true;
      const tick = () => { if (!ticking || !s.alive()) return; timerB.textContent = ((performance.now() - t0) / 1000).toFixed(1); requestAnimationFrame(tick); };
      tick();

      const hop = async (i, ms, html, cls) => {
        nodes[i].classList.add('is-on');
        pipe.style.setProperty('--p', i / (nodes.length - 1));
        say(`<span class="d">${stamp()}</span> ${html}`, cls);
        audio.tick();
        if (auto) cursor.to(nodes[i], { ax: 0.5, ay: 0.3, duration: 0.4 });
        await s.sleep(ms);
      };
      await hop(0, 520, `POST /api/messages <span class="ac">202 accepted</span>`);
      await hop(1, 560, `queued · ${m.parts} part${m.parts > 1 ? 's' : ''} · ${m.enc === 'Unicode' ? 'UCS-2' : 'GSM-7'}`);
      await hop(2, 760, `DLT · entity ✓ header <span class="ac">ABHNAV</span> ✓ template ✓`);
      await hop(3, 640, `submit_sm → carrier · seq 1041 · <span class="ac">ok</span>`);
      await hop(4, 820, `carrier accepted · waiting for receipt`);
      nodes[5].classList.add('is-on');
      pipe.style.setProperty('--p', 1);
      await s.sleep(520);
      ticking = false;
      const took = ((performance.now() - t0) / 1000).toFixed(1);
      timerB.textContent = took;
      timer.classList.add('is-done');
      say(`<span class="d">${stamp()}</span> deliver_sm · stat:DELIVRD · ${took} s`, 'ok');
      const note = h('<div class="sm__note"><b>VM-ABHNAV <span>now</span></b><span class="sm__notebody"></span></div>');
      $('.sm__notebody', note).textContent = body_;
      notes.prepend(note);
      while (notes.children.length > 2) notes.lastElementChild.remove();
      audio.ding();
      if (auto) { await s.sleep(500); cursor.hide(); }
    });
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); cursor.hide(); deliver(); });
  replayBtn.addEventListener('click', () => { cursor.hide(); deliver(); });
  meter();

  return { play: () => deliver({ auto: true }), trigger: send };
}
