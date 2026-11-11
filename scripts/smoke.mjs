// Smoke test: opens the site, uses every demo the way a visitor would, and
// fails if anything throws or a result does not show up.
//   pnpm dev   (in another terminal)
//   pnpm smoke
import puppeteer from 'puppeteer-core';

const base = process.env.URL || 'http://127.0.0.1:5190/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const errors = [];
const ok = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: ['--no-sandbox', '--hide-scrollbars', '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=gl-egl', '--ozone-platform=headless', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => errors.push('request failed: ' + r.url()));

const show = async (sel) => {
  await page.evaluate((q) => {
    const el = document.querySelector(q);
    const r = el.getBoundingClientRect();
    const y = r.top + scrollY - Math.max(84, (innerHeight - r.height) / 2);
    window.__lenis ? window.__lenis.scrollTo(y, { immediate: true, force: true }) : scrollTo(0, y);
  }, sel);
  await sleep(700);
};
const text = (sel) => page.$eval(sel, (el) => el.textContent.trim());
const has = (sel) => page.$(sel).then(Boolean);
const until = (fn, arg, timeout = 15000) => page.waitForFunction(fn, { timeout }, arg).then(() => true, () => false);

await page.goto(base + '?nointro', { waitUntil: 'networkidle2' });
await sleep(1200);

// hero
ok('hero name fills the width', await page.evaluate(() => {
  const w = document.querySelector('.hero__ui').clientWidth - 2 * parseFloat(getComputedStyle(document.querySelector('.hero__ui')).paddingLeft);
  return [...document.querySelectorAll('.hero__line')].every((l) => l.getBoundingClientRect().width <= w + 1 && l.getBoundingClientRect().width > w * 0.9);
}));
ok('no sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));

// sound toggle
await page.click('#soundBtn');
ok('sound turns on', (await text('#soundBtn .pill__label')) === 'Sound on');
await page.click('#soundBtn');

// Stella: a custom job is labelled as a simulation
await show('[data-stage="stella"]');
await sleep(400);
await page.$eval('[data-stage="stella"] .cmd__input', (el) => { el.value = ''; });
await page.type('[data-stage="stella"] .cmd__input', 'build a recipe app');
await page.click('[data-stage="stella"] .cmd__go');
ok('Stella ships a custom job', await until(() => document.querySelector('[data-stage="stella"] .st__result.is-show'), null));
ok('custom job says simulated', (await text('[data-stage="stella"] .st__result span')).includes('simulated'));
await page.click('[data-stage="stella"] .chip[data-job="todo"]');
ok('Stella preset shows real numbers', await until(() => /52\/52/.test(document.querySelector('[data-stage="stella"] .st__result span').textContent) && document.querySelector('[data-stage="stella"] .st__result.is-show'), null));

// Kavya: call, switch language, hang up, call through to the summary
await show('[data-stage="kavya"]');
await sleep(300);
if (await page.$eval('[data-stage="kavya"] .stage__body', (b) => b.classList.contains('is-live') || b.classList.contains('is-ringing'))) await page.click('.kv__call');
await sleep(300);
await page.click('.kv__call');
ok('Kavya picks up', await until(() => document.querySelector('.kv__b'), null, 8000));
await page.click('.seg button[data-lang="en"]');
ok('transcript switches to English', (await page.$eval('.kv__b', (b) => b.firstChild.textContent)).startsWith('Hello? Namaste, this is'));
await page.click('.kv__call');
ok('hanging up ends the call', (await text('.kv__state')) === 'call ended');
await page.click('[data-stage="kavya"] .stage__replay');
ok('full call ends with her summary', await until(() => document.querySelector('.kv__sum.is-show'), null, 30000));

// NACC
await show('[data-stage="nacc"]');
await page.click('[data-stage="nacc"] .chip[data-kind="gym"]');
ok('NACC schedules a gym post', await until(() => document.querySelectorAll('[data-stage="nacc"] .checks .is-done').length === 5 && document.querySelector('.po__logo b').textContent === 'Iron Den', null));

// LeadScout: preset is real, a custom search is labelled simulated
await show('[data-stage="leadscout"]');
await page.click('[data-stage="leadscout"] .chip[data-p="gyms"]');
ok('LeadScout finds 100 gyms', await until(() => document.querySelector('.ls__count').textContent === '100' && document.querySelector('.ls__export.is-on'), null));
ok('preset is marked as a real run', (await text('.ls__time')).includes('real run'));
await page.$eval('[data-stage="leadscout"] .cmd__input', (el) => { el.value = ''; });
await page.type('[data-stage="leadscout"] .cmd__input', 'dentists in Delhi');
await page.click('[data-stage="leadscout"] .cmd__go');
ok('custom search is marked simulated', await until(() => document.querySelector('.ls__time').textContent === 'simulated', null));

// Tatva
await show('[data-stage="tatva"]');
await page.click('[data-stage="tatva"] .chip[data-kind="gym"]');
ok('Tatva builds the gym site', await until(() => !document.querySelector('.tv__browser').classList.contains('is-wire') && document.querySelector('.tv__url').textContent === 'iron-den.preview', null));

// SMS: Hindi switches the counter to Unicode, and the message arrives
await show('[data-stage="sms"]');
// the agent starts typing by itself; a visitor who types over it must win cleanly
const agentTyping = await until(() => document.querySelector('.sm__text').value.length >= 5, null, 6000);
await page.type('.sm__text', 'नमस्ते from the portfolio');
ok('typing over the agent takes the field cleanly', agentTyping && (await page.$eval('.sm__text', (el) => el.value)) === 'नमस्ते from the portfolio');
ok('Hindi text counts as Unicode', (await text('.sm__enc')) === 'Unicode' && (await text('.sm__count')).endsWith('/ 70'));
await page.click('.sm__send');
ok('SMS is delivered to the phone', await until(() => document.querySelector('.sm__timer.is-done') && document.querySelector('.sm__notebody') && document.querySelector('.sm__notebody').textContent.startsWith('नमस्ते'), null));
const took = parseFloat(await text('.sm__timer b'));
ok('delivery takes about four seconds', took > 3 && took < 5, `${took} s`);

// WhatsApp panel: take the "not paid" branch by hand
await show('[data-stage="panel"]');
await page.click('[data-stage="panel"] .stage__replay');
const tap = async (label) => {
  await until((l) => [...document.querySelectorAll('.pn__quick button')].some((b) => b.textContent === l), label);
  await page.evaluate((l) => [...document.querySelectorAll('.pn__quick button')].find((b) => b.textContent === l).click(), label);
};
await tap('See prices');
await tap('Maybe later');
ok('panel follows the not-paid branch', await until(() => document.querySelector('.node[data-node="unpaid"]').classList.contains('is-on'), null));
await tap('Start over');
await tap('See prices');
await tap('Pay ₹499');
ok('panel takes the payment and tells the owner', await until(() => document.querySelector('.node[data-node="owner"]').classList.contains('is-on') && document.querySelector('.msg--pay.is-paid'), null));

// gallery: all seven screenshots are loaded before the strip starts to slide
await show('#sites');
ok('seven live sites are linked and loaded', await until(() => [...document.querySelectorAll('.shot')].filter((x) => x.href.startsWith('https://') && x.querySelector('img').complete && x.querySelector('img').naturalWidth > 0).length === 7, null, 15000));

// terminal
await show('#term');
await until(() => document.querySelector('#termBody').textContent.includes('This one is real'), null);
const run = async (cmd) => { await page.type('#termIn', cmd); await page.keyboard.press('Enter'); await sleep(700); };
await run('ls');
ok('terminal lists the projects', (await text('#termBody')).includes('leadscout/'));
await run('make coffee');
ok('terminal rejects unknown commands', (await text('#termBody')).includes('command not found: make'));
await run('<img src=x onerror=alert(1)>');
ok('terminal does not inject typed HTML', !(await has('#termBody img')));
await run('sudo hire abhinav');
await sleep(2600);
ok('sudo hire abhinav scrolls to contact', await page.evaluate(() => Math.abs(document.querySelector('#contact').getBoundingClientRect().top) < 80));
ok('footer is visible at the end', await page.evaluate(() => { scrollTo(0, 1e9); const f = document.querySelector('.foot'); return getComputedStyle(f).opacity === '1'; }));

// tour: starts, speaks, and hands back control on scroll
await page.evaluate(() => (window.__lenis ? window.__lenis.scrollTo(0, { immediate: true, force: true }) : scrollTo(0, 0)));
await sleep(600);
await page.click('#tourBtn');
ok('tour starts and Stella speaks', await until(() => document.body.classList.contains('is-touring') && document.querySelector('#island').classList.contains('is-say'), null, 5000));
await sleep(2500);
await page.mouse.move(700, 500);
await page.mouse.wheel({ deltaY: 200 });
ok('scrolling takes the wheel back', await until(() => !document.body.classList.contains('is-touring'), null, 3000));

// the opening: skipping at any moment must leave a finished, correct hero
for (const [when, label] of [[1900, 'while the desk is cleared'], [4300, 'during lights off'], [6400, 'while the crew builds'], [7800, 'during the second wave']]) {
  const fresh = await browser.newPage();
  await fresh.setViewport({ width: 1440, height: 900 });
  fresh.on('pageerror', (e) => errors.push(`pageerror (skip ${label}): ` + e.message));
  await fresh.goto(base, { waitUntil: 'domcontentloaded' });
  await fresh.waitForFunction(() => typeof window.__introStart === 'number', { timeout: 20000 });
  await sleep(when);
  await fresh.keyboard.press('ArrowDown');
  await sleep(900);
  ok(`skipping ${label} leaves a finished hero`, await fresh.evaluate(() => {
    const vis = (el) => { const cs = getComputedStyle(el); return cs.opacity === '1' && cs.visibility === 'visible' && (cs.transform === 'none' || cs.transform === 'matrix(1, 0, 0, 1, 0, 0)'); };
    return !document.body.classList.contains('is-intro')
      && getComputedStyle(document.querySelector('#draft')).display === 'none'
      && document.querySelector('#heroSay').textContent === 'I build AI agents that' && !document.querySelector('#heroSay .ch')
      && !document.querySelector('.btn.is-wire')
      && [...document.querySelectorAll('.hero__line span, .hero__cta .btn, [data-carry], .nav__mark, #soundBtn, #tourBtn, #rot')].every(vis)
      // nothing from the build is left on screen: no grid, frames, guides, and Stella's team has gone
      && document.querySelector('.build').children.length === 0
      && [...document.querySelectorAll('.cur')].filter((c) => /^(ChatGPT|Gemini|Claude|DeepSeek|Grok)$/.test(c.querySelector('.cur__tag').textContent)).every((c) => getComputedStyle(c).visibility === 'hidden');
  }));
  await fresh.close();
}
// ...and left alone, it plays to the end by itself
{
  const fresh = await browser.newPage();
  await fresh.setViewport({ width: 1440, height: 900 });
  fresh.on('pageerror', (e) => errors.push('pageerror (full opening): ' + e.message));
  await fresh.goto(base, { waitUntil: 'domcontentloaded' });
  const ended = await fresh.waitForFunction(() => window.__booted === true, { timeout: 25000 }).then(() => true, () => false);
  const secs = ended ? await fresh.evaluate(() => (performance.now() - window.__introStart) / 1000) : 0;
  ok('the opening plays to the end by itself', ended && secs > 9 && secs < 14, `${secs.toFixed(1)} s`);
  await fresh.close();
}

// a refresh replays the opening from the top, wherever the visitor had scrolled to
{
  const fresh = await browser.newPage();
  await fresh.setViewport({ width: 1440, height: 900 });
  fresh.on('pageerror', (e) => errors.push('pageerror (refresh): ' + e.message));
  const playing = () => fresh.waitForFunction(() => typeof window.__introStart === 'number' && document.body.classList.contains('is-intro'), { timeout: 10000 }).then(() => true, () => false);
  await fresh.goto(base, { waitUntil: 'domcontentloaded' });
  await playing();
  await fresh.keyboard.press('ArrowDown');
  await fresh.waitForFunction(() => window.__booted === true, { timeout: 10000 });
  await fresh.evaluate(() => (window.__lenis ? window.__lenis.scrollTo(3000, { immediate: true, force: true }) : scrollTo(0, 3000)));
  await sleep(500);
  const before = await fresh.evaluate(() => Math.round(scrollY));
  await fresh.reload({ waitUntil: 'domcontentloaded' });
  ok('a refresh replays the opening from the top', before > 2000 && (await playing()) && (await fresh.evaluate(() => scrollY === 0)), `was at ${before} px`);
  await fresh.reload({ waitUntil: 'domcontentloaded' });
  ok('and so does the refresh after that', await playing());

  await fresh.close();

  // a link to a section, opened in a new tab, skips the opening and lands on the section...
  const linked = await browser.newPage();
  await linked.setViewport({ width: 1440, height: 900 });
  linked.on('pageerror', (e) => errors.push('pageerror (section link): ' + e.message));
  // (#about sits below the pinned gallery, the hardest place to land exactly)
  await linked.goto(base + '#about', { waitUntil: 'domcontentloaded' });
  await linked.waitForFunction(() => window.__booted === true, { timeout: 10000 });
  await sleep(900);
  const landed = await linked.evaluate(() => ({ played: window.__introStart !== undefined, top: Math.round(document.querySelector('#about').getBoundingClientRect().top) }));
  ok('a section link skips the opening and lands exactly there', !landed.played && Math.abs(landed.top) < 6, `opening played: ${landed.played}, section top at ${landed.top} px`);
  // ...and refreshing that still replays
  await linked.reload({ waitUntil: 'domcontentloaded' });
  const again = await linked.waitForFunction(() => typeof window.__introStart === 'number' && document.body.classList.contains('is-intro'), { timeout: 10000 }).then(() => true, () => false);
  ok('refreshing a section link replays the opening', again && (await linked.evaluate(() => location.hash === '' && scrollY === 0)));
  await linked.close();
}

// "reduce motion": no opening, nothing hidden waiting for an animation, demos wait to be pressed
const calm = await browser.newPage();
await calm.setViewport({ width: 1440, height: 900 });
await calm.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
calm.on('pageerror', (e) => errors.push('pageerror (reduced motion): ' + e.message));
await calm.goto(base, { waitUntil: 'networkidle2' });
await sleep(1200);
ok('reduced motion skips the opening', await calm.evaluate(() => !document.body.classList.contains('is-intro') && getComputedStyle(document.querySelector('#draft')).display === 'none'));
ok('reduced motion leaves no text hidden', await calm.evaluate(() => [...document.querySelectorAll('.c, .room__lead, .facts li, .stage, .def__word span, .crew__list li')].every((el) => {
  const cs = getComputedStyle(el);
  return cs.opacity === '1' && (cs.transform === 'none' || cs.transform === 'matrix(1, 0, 0, 1, 0, 0)');
})));
await calm.close();

ok('no page errors', errors.length === 0, errors.slice(0, 4).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
