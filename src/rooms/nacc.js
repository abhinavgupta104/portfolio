// 03 · NACC makes a post. The three brands are invented test businesses; the
// steps (brand kit, hook, layout, logo check, schedule) are how the real agent works.
import gsap from 'gsap';
import { $, $$, pick, typeInto } from '../lib/dom.js';
import { audio } from '../lib/audio.js';
import { shell, enter, run } from './kit.js';

const BRANDS = {
  coaching: {
    brand: 'Apex Classes', kick: 'Admissions 2027', hooks: ["Seats don't wait.", 'Toppers start early.', "Marks don't lie."],
    sub: 'New JEE and NEET batches from 1 December. Sector 62, Noida.', cta: 'Book a free demo class',
    ask: 'Admissions post for Apex Classes. New batches start 1 Dec.', when: 'Scheduled · Mon 8:00',
  },
  clinic: {
    brand: 'Smile Dental', kick: 'Now on WhatsApp', hooks: ['Skip the queue.', 'Book. Smile. Done.', 'Your slot awaits.'],
    sub: 'Book your appointment in 20 seconds. No calls, no hold music.', cta: 'Message to book',
    ask: 'Post for Smile Dental: patients can now book on WhatsApp.', when: 'Scheduled · Tue 9:00',
  },
  gym: {
    brand: 'Iron Den', kick: 'This week only', hooks: ['Day one or one day?', "Excuses don't lift.", 'Show up. Show off.'],
    sub: 'Join before Sunday and your first month is half price.', cta: 'Claim the offer',
    ask: 'Offer post for Iron Den gym: first month half price this week.', when: 'Scheduled · Fri 18:30',
  },
};

export function mount(stage) {
  const { body, cursor, replayBtn, sc } = shell(stage, { title: 'Post studio', replay: 'New post', who: 'nacc' });
  body.classList.add('nc');
  body.innerHTML = `
    <div class="nc__left">
      <span class="lbl">Who is it for?</span>
      <div class="chips">
        <button class="chip is-on" type="button" data-kind="coaching">Coaching</button>
        <button class="chip" type="button" data-kind="clinic">Clinic</button>
        <button class="chip" type="button" data-kind="gym">Gym</button>
      </div>
      <div class="nc__brief"><span class="lbl">WhatsApp → NACC</span><p class="nc__msg"><span class="nc__typed"></span><i class="caret"></i></p></div>
      <button class="nc__make" type="button" data-you="make it">Make the post</button>
      <ul class="checks"><li>Brand kit loaded</li><li>Hook written</li><li>Layout chosen</li><li>Logo checked</li><li>Scheduled</li></ul>
    </div>
    <div class="nc__right">
      <div class="poster" data-kind="coaching">
        <div class="po__bg"></div><div class="po__shape"></div>
        <span class="po__kick"></span>
        <h4 class="po__hook"></h4>
        <p class="po__sub"></p>
        <span class="po__cta"></span>
        <span class="po__logo"><i></i><b></b></span>
      </div>
      <span class="nc__stamp mono"></span>
    </div>`;

  const chips = $$('.chip', body);
  const typed = $('.nc__typed', body);
  const make = $('.nc__make', body);
  const checks = $$('.checks li', body);
  const poster = $('.poster', body);
  const P = (q) => $(q, poster);
  const stamp = $('.nc__stamp', body);
  let kind = 'coaching';
  let lastHook = '';

  function reset() {
    checks.forEach((c) => c.classList.remove('is-done'));
    gsap.killTweensOf([P('.po__bg'), P('.po__shape'), P('.po__kick'), P('.po__sub'), P('.po__cta'), P('.po__logo'), stamp]);
    gsap.set(P('.po__bg'), { clipPath: 'inset(0 100% 0 0)' });
    gsap.set([P('.po__shape'), P('.po__kick'), P('.po__sub'), P('.po__cta'), P('.po__logo')], { opacity: 0 });
    gsap.set(stamp, { scale: 0, rotate: 5 });
    P('.po__hook').innerHTML = '';
  }

  const tick = (i) => { checks[i].classList.add('is-done'); audio.tick(); };

  async function build({ auto = false, typeIt = true } = {}) {
    const s = sc.begin();
    const b = BRANDS[kind];
    reset();
    poster.dataset.kind = kind;
    chips.forEach((c) => c.classList.toggle('is-on', c.dataset.kind === kind));
    let hook = pick(b.hooks);
    if (hook === lastHook) hook = b.hooks[(b.hooks.indexOf(hook) + 1) % b.hooks.length];
    lastHook = hook;

    await run(async () => {
      if (auto) {
        enter(cursor, stage, 'bl');
        await s.wait(cursor.to(chips.find((c) => c.dataset.kind === kind)));
        cursor.click(); audio.click();
      }
      if (typeIt) await typeInto(typed, b.ask, s, { min: 12, max: 34 });
      else typed.textContent = b.ask;
      if (auto) {
        await s.wait(cursor.to(make));
        cursor.click(); audio.click();
        cursor.to(poster, { ax: 0.86, ay: 0.2, duration: 0.9 });
      }
      await s.sleep(250);

      // brand kit → background and shape
      tick(0);
      P('.po__kick').textContent = b.kick;
      P('.po__sub').textContent = b.sub;
      P('.po__cta').textContent = b.cta;
      P('.po__logo b').textContent = b.brand;
      await s.wait(gsap.to(P('.po__bg'), { clipPath: 'inset(0 0% 0 0)', duration: 0.7, ease: 'power3.inOut' }));
      gsap.fromTo(P('.po__shape'), { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.9, ease: 'expo.out' });

      // hook → words drop in
      tick(1);
      gsap.to(P('.po__kick'), { opacity: 1, duration: 0.3 });
      P('.po__hook').innerHTML = hook.split(' ').map((w) => `<span>${w}</span>`).join(' ');
      await s.wait(gsap.fromTo($$('span', P('.po__hook')), { yPercent: 70, opacity: 0, rotate: 4 }, { yPercent: 0, opacity: 1, rotate: 0, duration: 0.7, stagger: 0.09, ease: 'back.out(1.6)' }));

      // layout → supporting line and button
      tick(2);
      gsap.fromTo(P('.po__sub'), { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 });
      await s.wait(gsap.fromTo(P('.po__cta'), { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: 'back.out(2)' }));

      // logo check → the mark snaps into its corner
      await s.wait(gsap.fromTo(P('.po__logo'), { scale: 2.2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'power4.out' }));
      tick(3);
      audio.pop();
      await s.sleep(380);

      // schedule
      tick(4);
      stamp.textContent = b.when;
      gsap.to(stamp, { scale: 1, duration: 0.6, ease: 'back.out(2.4)' });
      audio.chime();
      if (auto) cursor.hide();
    });
  }

  chips.forEach((c) => c.addEventListener('click', () => { kind = c.dataset.kind; cursor.hide(); build(); }));
  make.addEventListener('click', () => { cursor.hide(); build({ typeIt: false }); });
  replayBtn.addEventListener('click', () => {
    const order = Object.keys(BRANDS);
    kind = order[(order.indexOf(kind) + 1) % order.length];
    cursor.hide(); build();
  });

  reset();
  return { play: () => build({ auto: true }), trigger: make };
}
