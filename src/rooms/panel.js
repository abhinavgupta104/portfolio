// 07 · A chatbot flow that takes a payment. The chat on the right is a small
// state machine; the flow on the left lights up the block the customer is in.
// Visitors can tap the quick replies and take any branch.
import { $, $$, h } from '../lib/dom.js';
import { audio } from '../lib/audio.js';
import { shell, enter, run } from './kit.js';

const NODES = [
  ['start', 'Trigger', 'Customer says “Hi”'],
  ['menu', 'Menu', 'Three buttons'],
  ['demo', 'Booking', 'Pick a slot'],
  ['pay', 'Collect payment', '₹499 · Razorpay'],
  ['human', 'Hand over', 'Shared inbox'],
  ['paid', 'Paid', 'Send the pass'],
  ['unpaid', 'Not paid', 'Remind in 1 hour'],
  ['owner', 'Notify', 'Tell the owner'],
];
const EDGES = [['start', 'menu'], ['menu', 'demo'], ['menu', 'pay'], ['menu', 'human'], ['pay', 'paid'], ['pay', 'unpaid'], ['paid', 'owner']];

export function mount(stage) {
  const { body, cursor, replayBtn, sc } = shell(stage, { title: 'Flow builder · payments in chat', replay: 'Restart', who: 'panel' });
  body.classList.add('pn');
  body.innerHTML = `
    <div class="pn__flow">
      <svg class="pn__wires" aria-hidden="true"></svg>
      ${NODES.map(([k, label, text]) => `<div class="node" data-node="${k}"><span>${label}</span><b>${text}</b></div>`).join('')}
    </div>
    <div class="pn__chat">
      <div class="pn__head"><i>B</i><div><b>Brew Lab</b><span>business account · bot</span></div></div>
      <div class="pn__msgs" aria-live="polite"></div>
      <div class="pn__quick"></div>
    </div>`;

  const flow = $('.pn__flow', body);
  const svg = $('.pn__wires', body);
  const node = (k) => $(`.node[data-node="${k}"]`, flow);
  const msgs = $('.pn__msgs', body);
  const quick = $('.pn__quick', body);
  const wires = {};
  let at = null;

  function drawWires() {
    const f = flow.getBoundingClientRect();
    svg.innerHTML = '';
    EDGES.forEach(([a, b]) => {
      const ra = node(a).getBoundingClientRect();
      const rb = node(b).getBoundingClientRect();
      const x1 = ra.left - f.left + ra.width / 2;
      const y1 = ra.bottom - f.top;
      const x2 = rb.left - f.left + rb.width / 2;
      const y2 = rb.top - f.top;
      const ym = (y1 + y2) / 2;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M${x1} ${y1} V${ym} H${x2} V${y2}`);
      const old = wires[`${a}>${b}`];
      if (old) path.setAttribute('class', old.getAttribute('class') || '');
      svg.appendChild(path);
      wires[`${a}>${b}`] = path;
    });
  }
  new ResizeObserver(drawWires).observe(flow);

  function go(k) {
    if (at) {
      node(at).classList.replace('is-on', 'is-past');
      const w = wires[`${at}>${k}`];
      $$('path', svg).forEach((p) => { if (p.classList.contains('is-on')) p.setAttribute('class', 'is-past'); });
      if (w) w.setAttribute('class', 'is-on');
    }
    node(k).classList.remove('is-past');
    node(k).classList.add('is-on');
    at = k;
    audio.tick();
  }

  function add(html, cls = '') {
    const m = h(`<div class="msg ${cls}">${html}</div>`);
    msgs.appendChild(m);
    while (msgs.children.length > 7) msgs.firstElementChild.remove();
    audio.pop();
    return m;
  }
  function offer(options) {
    quick.innerHTML = '';
    options.forEach(([label, fn], i) => {
      const b = h(`<button type="button" data-you="tap">${label}</button>`);
      b.style.animationDelay = `${i * 60}ms`;
      b.addEventListener('click', () => { cursor.hide(); take(fn, label); });
      quick.appendChild(b);
    });
    return $$('button', quick);
  }

  function reset() {
    msgs.innerHTML = '';
    quick.innerHTML = '';
    at = null;
    $$('.node', flow).forEach((n) => n.classList.remove('is-on', 'is-past'));
    $$('path', svg).forEach((p) => p.removeAttribute('class'));
  }

  // every branch is a small async step that ends by offering the next choices
  const steps = {
    async hello(s) {
      add('Hi', 'me'); go('start');
      await s.sleep(600);
      go('menu');
      add('Hi! Welcome to Brew Lab ☕ What can I get you?');
      await s.sleep(250);
      return offer([['See prices', 'prices'], ['Book a table', 'book'], ['Talk to a human', 'human']]);
    },
    async prices(s) {
      go('pay');
      await s.sleep(500);
      add('Our weekend brunch pass is ₹499 for two.');
      await s.sleep(650);
      const card = add('<span>Brew Lab · via Razorpay</span><b>Brunch pass · ₹499</b><em>Pay now</em>', 'msg--pay');
      card.dataset.card = '1';
      await s.sleep(250);
      return offer([['Pay ₹499', 'pay'], ['Maybe later', 'later']]);
    },
    async pay(s) {
      const card = $('[data-card]', msgs);
      await s.sleep(700);
      if (card) { card.classList.add('is-paid'); $('em', card).textContent = 'Paid ✓'; }
      audio.ding();
      add('payment received · webhook signature verified', 'msg--sys');
      await s.sleep(650);
      go('paid');
      add('Payment received! Your pass is on its way.');
      await s.sleep(750);
      go('owner');
      add('owner notified on WhatsApp', 'msg--sys');
      await s.sleep(300);
      return offer([['Start over', 'restart']]);
    },
    async later(s) {
      go('unpaid');
      await s.sleep(500);
      add('No problem. I will nudge you once, in an hour.');
      return offer([['Start over', 'restart']]);
    },
    async book(s) {
      go('demo');
      await s.sleep(500);
      add('Sure. Tonight at 7 pm or 8:30 pm?');
      return offer([['7 pm', 'slot'], ['8:30 pm', 'slot']]);
    },
    async slot(s) {
      await s.sleep(500);
      add('Booked. See you tonight!');
      return offer([['Start over', 'restart']]);
    },
    async human(s) {
      go('human');
      await s.sleep(500);
      add('Connecting you to the team…');
      await s.sleep(600);
      add('assigned to a person · shared inbox', 'msg--sys');
      return offer([['Start over', 'restart']]);
    },
  };

  function take(fn, label) {
    if (fn === 'restart') { start(); return; }
    const s = sc.begin();
    quick.innerHTML = '';
    if (label && fn !== 'hello') add(label, 'me');
    run(() => steps[fn](s));
  }

  function start() {
    const s = sc.begin();
    reset();
    return run(async () => {
      await s.sleep(250);
      await steps.hello(s);
    });
  }

  async function demo() {
    const s = sc.begin();
    reset();
    drawWires();
    await run(async () => {
      enter(cursor, stage, 'br');
      await s.sleep(300);
      let btns = await steps.hello(s);
      await s.sleep(500);
      for (const [fn, idx, label] of [['prices', 0, 'See prices'], ['pay', 0, 'Pay ₹499']]) {
        await s.wait(cursor.to(btns[idx]));
        cursor.click();
        quick.innerHTML = '';
        add(label, 'me');
        cursor.to(node(fn === 'prices' ? 'pay' : 'paid'), { ax: 0.85, ay: 0.6, duration: 0.8 });
        btns = await steps[fn](s);
        await s.sleep(650);
      }
      cursor.hide();
    });
  }

  replayBtn.addEventListener('click', () => { cursor.hide(); start(); });
  drawWires();
  offer([['Say “Hi”', 'hello']]);

  return { play: demo, trigger: quick };
}
