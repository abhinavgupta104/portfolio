// 05 · Tatva: one sentence in, a website out. Components fly from the tray
// into a wireframe, then one style pass turns the grey boxes into a brand.
// The three shops are invented; the build times are from real runs.
import gsap from 'gsap';
import { $, $$, h, typeInto } from '../lib/dom.js';
import { audio } from '../lib/audio.js';
import { shell, enter, run, handOver } from './kit.js';

const KINDS = {
  cafe: {
    say: 'a website for a coffee shop', name: 'Brew Lab', url: 'brew-lab.preview', secs: 153,
    title: 'Coffee worth the detour.', sub: 'Small-batch roasts, slow mornings, fast Wi-Fi.', btn: 'See the menu',
    cards: [['Flat white', '₹180'], ['Cold brew', '₹220'], ['Almond croissant', '₹160']],
    hours: 'Every day · 8 am to 10 pm', cta: 'Save a table', act: 'WhatsApp us',
  },
  salon: {
    say: 'a website for a salon', name: 'Glow Studio', url: 'glow-studio.preview', secs: 99,
    title: 'Leave lighter.', sub: 'Hair, skin, and an hour that is only yours.', btn: 'Book a slot',
    cards: [['Haircut', '₹600'], ['Hair spa', '₹1,400'], ['Facial', '₹1,200']],
    hours: 'Tue to Sun · 10 am to 8 pm', cta: 'Your chair is free', act: 'Book now',
  },
  gym: {
    say: 'a website for a gym', name: 'Iron Den', url: 'iron-den.preview', secs: 94,
    title: 'Train like you mean it.', sub: 'Free weights, real coaches, zero excuses.', btn: 'Start a trial',
    cards: [['Monthly', '₹1,999'], ['Quarterly', '₹4,999'], ['Personal coach', '₹6,000']],
    hours: 'Every day · 5 am to 11 pm', cta: 'First day is free', act: 'Claim it',
  },
};
const PARTS = [['nav', 'Navbar'], ['hero', 'Hero'], ['cards', 'Price cards'], ['split', 'Hours + map'], ['cta', 'Call to action'], ['foot', 'Footer']];

export function mount(stage) {
  const { body, cursor, replayBtn, sc } = shell(stage, { title: 'Composer · one sentence in', replay: 'Build again', who: 'tatva' });
  body.classList.add('tv');
  body.innerHTML = `
    <form class="cmd tv__cmd">
      <span class="tv__spark" aria-hidden="true">✦</span>
      <input class="cmd__input" type="text" maxlength="44" placeholder="describe the website…" aria-label="Describe the website">
      <button class="cmd__go" type="submit" data-you="build it">Build it</button>
    </form>
    <div class="chips">
      <button class="chip" type="button" data-kind="cafe">coffee shop</button>
      <button class="chip" type="button" data-kind="salon">salon</button>
      <button class="chip" type="button" data-kind="gym">gym</button>
    </div>
    <div class="tv__main">
      <ul class="tv__parts mono">
        ${PARTS.map(([k, label]) => `<li data-part="${k}">${label}</li>`).join('')}
        <li class="tv__count" style="border:0;border-top:1px solid var(--s-line);border-radius:0"><b>0</b> of 91 parts used</li>
      </ul>
      <div class="tv__browser is-wire" data-kind="cafe">
        <div class="tv__chrome mono"><i></i><i></i><i></i><span class="tv__url">new-site.preview</span><em class="tv__timer">0 s</em></div>
        <div class="tv__page">
          <div class="tvs tvs--nav" data-part="nav"><b data-t="name"></b><span>Menu</span><span>Visit</span><span>About</span><em data-t="act"></em></div>
          <div class="tvs tvs--hero" data-part="hero"><div><h5 data-t="title"></h5><p data-t="sub"></p><em data-t="btn"></em></div><figure></figure></div>
          <div class="tvs tvs--cards" data-part="cards"><div><i></i><b></b><span></span></div><div><i></i><b></b><span></span></div><div><i></i><b></b><span></span></div></div>
          <div class="tvs tvs--split" data-part="split"><div><b>Hours</b><span data-t="hours"></span></div><div class="map"></div></div>
          <div class="tvs tvs--cta" data-part="cta"><b data-t="cta"></b><em data-t="act"></em></div>
          <div class="tvs tvs--foot" data-part="foot"><span data-t="name"></span><span>Made with Tatva/ui</span></div>
        </div>
      </div>
    </div>`;

  const form = $('.tv__cmd', body);
  const input = $('.cmd__input', body);
  const go = $('.cmd__go', body);
  const chips = $$('.chip', body);
  const tray = $$('.tv__parts li[data-part]', body);
  const used = $('.tv__count b', body);
  const browser = $('.tv__browser', body);
  const timer = $('.tv__timer', body);
  const url = $('.tv__url', body);
  const secs = (k) => $(`.tvs[data-part="${k}"]`, body);

  function fill(k) {
    $$('[data-t]', browser).forEach((el) => { el.textContent = k[el.dataset.t]; });
    $$('.tvs--cards > div', browser).forEach((card, i) => {
      $('b', card).textContent = k.cards[i][0];
      $('span', card).textContent = k.cards[i][1];
    });
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
    browser.classList.add('is-wire');
    $$('.tvs', browser).forEach((el) => el.classList.remove('is-in'));
    tray.forEach((li) => li.classList.remove('is-on'));
    used.textContent = '0';
    timer.textContent = '0 s';
    url.textContent = 'new-site.preview';
    form.classList.remove('is-focus');
    $$('.tv__fly', body).forEach((f) => f.remove());
  }

  function fly(li, target) {
    const b = body.getBoundingClientRect();
    const a = li.getBoundingClientRect();
    const z = target.getBoundingClientRect();
    const ghost = h('<div class="tv__fly"></div>');
    body.appendChild(ghost);
    gsap.set(ghost, { x: a.left - b.left, y: a.top - b.top, width: a.width, height: a.height });
    return gsap.to(ghost, {
      x: z.left - b.left, y: z.top - b.top, width: z.width, height: z.height,
      duration: 0.5, ease: 'power3.inOut', onComplete: () => ghost.remove(),
    });
  }

  async function build(key, { auto = false, sentence } = {}) {
    const s = sc.begin();
    const k = KINDS[key];
    reset();
    browser.dataset.kind = key;
    fill(k);
    chips.forEach((c) => c.classList.toggle('is-on', c.dataset.kind === key && !sentence));
    await run(async () => {
      if (auto) {
        autoTyping = true;
        enter(cursor, stage, 'tr');
        await s.wait(cursor.to(input, { ax: 0.25 }));
        cursor.click(); audio.click();
        form.classList.add('is-focus');
        await typeInto(input, k.say, s);
        await s.wait(cursor.to(go));
        cursor.click(); audio.click();
        form.classList.remove('is-focus');
        autoTyping = false;
      } else {
        input.value = sentence || k.say;
      }

      // the clock runs to the real build time while the page assembles
      const clock = { v: 0 };
      gsap.to(clock, { v: k.secs, duration: 4.6, ease: 'none', onUpdate: () => { if (s.alive()) timer.textContent = `${Math.round(clock.v)} s`; } });

      for (let i = 0; i < PARTS.length; i++) {
        const [part] = PARTS[i];
        const li = tray[i];
        const target = secs(part);
        if (auto) cursor.to(li, { ax: 0.8, duration: 0.35 });
        li.classList.add('is-on');
        audio.tick();
        if (auto) fly(li, target), await s.wait(cursor.to(target, { ax: 0.5, ay: 0.5, duration: 0.5 }));
        else await s.wait(fly(li, target));
        target.classList.add('is-in');
        used.textContent = i + 1;
        await s.sleep(120);
      }

      // style pass: grey boxes become a brand
      await s.sleep(450);
      browser.classList.remove('is-wire');
      url.textContent = k.url;
      audio.chime();
      await s.sleep(900);
      timer.textContent = sentence ? 'sample layout' : `${k.secs} s real · sped up`;
      if (auto) cursor.hide();
    });
  }

  const guess = (text) => (/gym|fit|train/i.test(text) ? 'gym' : /salon|hair|beaut|spa/i.test(text) ? 'salon' : 'cafe');
  chips.forEach((c) => c.addEventListener('click', () => { cursor.hide(); build(c.dataset.kind); }));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) { input.focus(); return; }
    cursor.hide();
    const key = guess(text);
    build(key, { sentence: text === KINDS[key].say ? undefined : text });
  });
  replayBtn.addEventListener('click', () => {
    const order = Object.keys(KINDS);
    cursor.hide();
    build(order[(order.indexOf(browser.dataset.kind) + 1) % order.length], { auto: true });
  });

  fill(KINDS.cafe);
  return { play: () => build('cafe', { auto: true }), trigger: go };
}
