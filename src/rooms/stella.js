// 01 · Stella briefs her AI dev team. The numbers for the three preset jobs
// are the real ones from her runs; anything typed by a visitor is a simulation
// and says so.
import gsap from 'gsap';
import { $, $$, rand, typeInto } from '../lib/dom.js';
import { audio } from '../lib/audio.js';
import { shell, enter, run, handOver } from './kit.js';

const JOBS = {
  crm: { text: 'build a CRM for my studio', name: 'CRM', tasks: 14, tests: 81, parts: ['contacts API', 'deals pipeline', 'dashboard charts', 'login + auth', 'activity log'] },
  todo: { text: 'build a to-do app', name: 'TaskPilot', tasks: 11, tests: 52, parts: ['lists API', 'task CRUD', 'filters', 'dashboard counts', 'login + auth'] },
  leads: { text: 'build a lead extractor', name: 'LeadScout', tasks: 14, tests: 110, parts: ['Maps source', 'de-dupe', 'leads explorer', 'export', 'job queue'] },
};
const DEVS = ['ChatGPT', 'Gemini', 'Claude', 'DeepSeek', 'Grok'];

export function mount(stage) {
  const { body, cursor, replayBtn, sc } = shell(stage, { title: "Workspace 9 · Stella's desk", replay: 'Replay', who: 'stella' });
  body.classList.add('st');
  body.innerHTML = `
    <svg class="st__beams" aria-hidden="true"></svg>
    <form class="cmd st__cmd">
      <span class="orb" aria-hidden="true"></span>
      <input class="cmd__input" type="text" maxlength="44" placeholder="Give Stella a job…" aria-label="Give Stella a job">
      <button class="cmd__go" type="submit" data-you="brief the team">Brief the team</button>
    </form>
    <div class="chips">
      <button class="chip" type="button" data-job="crm">a CRM</button>
      <button class="chip" type="button" data-job="todo">a to-do app</button>
      <button class="chip" type="button" data-job="leads">a lead extractor</button>
    </div>
    <div class="st__grid">
      ${DEVS.map((d) => `<article class="win" data-dev="${d}"><header><b>${d}</b><span class="win__state">idle</span></header><div class="win__code"></div><footer class="win__task">waiting for a task</footer></article>`).join('')}
      <article class="win win--qa" data-dev="qa"><header><b>Stella · QA</b><span class="win__state">idle</span></header><div class="win__code"></div><footer class="win__task">plan, review, test</footer></article>
    </div>
    <ol class="steps"><li>Plan</li><li>Build</li><li>Review</li><li>Test</li><li>Ship</li></ol>
    <div class="st__result" aria-live="polite"><b>Shipped.</b><span></span></div>`;

  const form = $('.st__cmd', body);
  const input = $('.cmd__input', body);
  const go = $('.cmd__go', body);
  const svg = $('.st__beams', body);
  const wins = $$('.win:not(.win--qa)', body);
  const qa = $('.win--qa', body);
  const steps = $$('.steps li', body);
  const result = $('.st__result', body);
  const chips = $$('.chip', body);

  const setState = (win, cls, text) => {
    win.classList.remove('is-work', 'is-ok', 'is-warn');
    if (cls) win.classList.add(cls);
    $('.win__state', win).textContent = text;
  };
  const addLine = (win, kind = '') => {
    const code = $('.win__code', win);
    if (code.children.length >= 6) code.firstElementChild.remove();
    const i = document.createElement('i');
    i.className = kind;
    i.style.setProperty('--w', rand(28, 96).toFixed(0) + '%');
    code.appendChild(i);
  };
  const step = (n) => steps.forEach((li, i) => { li.classList.toggle('is-done', i < n); li.classList.toggle('is-on', i === n); });

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
    svg.innerHTML = '';
    result.classList.remove('is-show');
    [...wins, qa].forEach((w) => { setState(w, '', 'idle'); $('.win__code', w).innerHTML = ''; });
    wins.forEach((w) => { $('.win__task', w).textContent = 'waiting for a task'; });
    $('.win__task', qa).textContent = 'plan, review, test';
    steps.forEach((li) => li.classList.remove('is-on', 'is-done'));
    form.classList.remove('is-focus');
  }

  function beams() {
    const b = body.getBoundingClientRect();
    const f = form.getBoundingClientRect();
    const x1 = f.left - b.left + f.width / 2;
    const y1 = f.bottom - b.top;
    svg.innerHTML = '';
    wins.forEach((w, i) => {
      const r = w.getBoundingClientRect();
      const x2 = r.left - b.left + r.width / 2;
      const y2 = r.top - b.top;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M${x1} ${y1} C${x1} ${y1 + 34}, ${x2} ${y2 - 34}, ${x2} ${y2}`);
      svg.appendChild(path);
      const len = path.getTotalLength();
      gsap.fromTo(path, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.55, delay: i * 0.07, ease: 'power2.out' });
      gsap.to(path, { opacity: 0, duration: 0.5, delay: 0.9 + i * 0.07 });
    });
  }

  async function brief(job, { typed = true } = {}) {
    const s = sc.begin();
    reset();
    chips.forEach((c) => c.classList.toggle('is-on', c.dataset.job === job.key));
    await run(async () => {
      if (typed) {
        autoTyping = true;
        enter(cursor, stage, 'br');
        await s.wait(cursor.to(input, { ax: 0.2 }));
        cursor.click(); audio.click();
        form.classList.add('is-focus');
        await typeInto(input, job.text, s);
        await s.sleep(200);
        await s.wait(cursor.to(go));
        cursor.click(); audio.click();
        form.classList.remove('is-focus');
        autoTyping = false;
        cursor.to(qa, { ax: 0.8, ay: 0.7, duration: 0.8 });
      }

      // Plan
      step(0);
      setState(qa, 'is-work', 'planning');
      for (let i = 0; i < 3; i++) { addLine(qa, 'k'); await s.sleep(170); }
      $('.win__task', qa).textContent = `plan: ${job.tasks} tasks`;
      await s.sleep(380);

      // Build: the brief fans out, every AI gets a task
      step(1);
      setState(qa, '', 'watching');
      beams();
      audio.whoosh();
      wins.forEach((w, i) => {
        setState(w, 'is-work', 'writing');
        $('.win__task', w).textContent = `T${String(i + 2).padStart(2, '0')} · ${job.parts[i]}`;
      });
      for (let n = 0; n < 7; n++) {
        wins.forEach((w) => { if (Math.random() > 0.25) addLine(w, Math.random() > 0.72 ? 'k' : ''); });
        if (n % 2 === 0) audio.key();
        await s.sleep(230);
      }

      // Review: each change is read by another AI; the size guard stops one
      step(2);
      wins.forEach((w, i) => setState(w, 'is-work', `review: ${DEVS[(i + 2) % DEVS.length]}`));
      cursor.to(wins[4], { ax: 0.7, ay: 0.5, duration: 0.7 });
      await s.sleep(650);
      setState(wins[4], 'is-warn', 'rewrote too much');
      $('.win__task', wins[4]).textContent = 'size guard: change refused';
      audio.hang();
      await s.sleep(850);
      setState(wins[4], 'is-work', 'second try');
      $('.win__task', wins[4]).textContent = `T06 · ${job.parts[4]}, smaller change`;
      for (let n = 0; n < 3; n++) { addLine(wins[4], 'k'); await s.sleep(160); }
      for (const w of wins) { setState(w, 'is-ok', 'merged ✓'); audio.tick(); await s.sleep(110); }

      // Test
      step(3);
      cursor.to(qa, { ax: 0.7, ay: 0.6, duration: 0.6 });
      setState(qa, 'is-work', 'testing');
      $('.win__code', qa).innerHTML = '';
      const o = { v: 0 };
      await s.wait(gsap.to(o, {
        v: job.tests, duration: 1.3, ease: 'power1.inOut',
        onUpdate: () => {
          $('.win__task', qa).textContent = `tests ${Math.round(o.v)}/${job.tests}`;
          if (Math.random() > 0.72) addLine(qa, 'g');
        },
      }));
      setState(qa, 'is-ok', job.real ? `${job.tests}/${job.tests} ✓` : 'green ✓');

      // Ship
      step(4);
      await s.sleep(260);
      step(5);
      $('span', result).textContent = job.real
        ? `${job.name} · ${job.tasks} tasks · ${job.tests}/${job.tests} tests · numbers from her real run`
        : `“${job.name}” · simulated here · the real one needs my laptop`;
      result.classList.add('is-show');
      audio.chime();
      cursor.hide();
    });
  }

  const preset = (key) => ({ ...JOBS[key], key, real: true });
  const custom = (text) => ({ key: '', text, name: text, tasks: Math.round(rand(8, 14)), tests: Math.round(rand(40, 90)), parts: ['data model', 'API routes', 'main screens', 'login + auth', 'polish'], real: false });

  chips.forEach((c) => c.addEventListener('click', () => { input.value = JOBS[c.dataset.job].text; brief(preset(c.dataset.job), { typed: false }); }));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) { input.focus(); return; }
    const key = Object.keys(JOBS).find((k) => JOBS[k].text === text);
    cursor.hide();
    brief(key ? preset(key) : custom(text), { typed: false });
  });
  replayBtn.addEventListener('click', () => brief(preset('crm')));

  return { play: () => brief(preset('crm')), trigger: go };
}
