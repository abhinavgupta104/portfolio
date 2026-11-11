// Visual check: opens the site in headless Chrome and saves screenshots.
//   node scripts/shoot.mjs intro  [out] [WxH]      frames of the opening
//   node scripts/shoot.mjs page   [out] [WxH]      every section, demos mid-run
//   node scripts/shoot.mjs one    [out] [WxH] <selector> [waitMs,waitMs...]
//   node scripts/shoot.mjs tour   [out] [WxH] [everyMs]   frames of the whole Stella tour
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const [mode = 'page', out = 'shots-out', size = '1440x900', sel = '', waits = '2500'] = process.argv.slice(2);
const [width, height] = size.split('x').map(Number);
const base = process.env.URL || 'http://127.0.0.1:5190/';
mkdirSync(out, { recursive: true });
const tag = `${width}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: ['--no-sandbox', '--hide-scrollbars', '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=gl-egl', '--ozone-platform=headless', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => errors.push('failed: ' + r.url()));

const shot = (name) => page.screenshot({ path: `${out}/${name}-${tag}.png` });
const goTo = (y) => page.evaluate((yy) => { if (window.__lenis) window.__lenis.scrollTo(yy, { immediate: true, force: true }); else window.scrollTo(0, yy); }, y);
const topOf = (q, centre) => page.evaluate((qq, c) => {
  const el = document.querySelector(qq);
  const r = el.getBoundingClientRect();
  const y = r.top + window.scrollY;
  return c ? y - Math.max(84, (innerHeight - r.height) / 2) : y;
}, q, centre);

if (mode === 'intro') {
  // optional: number of frames and the gap between them, e.g. `intro out 1440x900 32 300`
  const count = Number(sel) || 14;
  const gap = process.argv[7] ? Number(waits) : 560;
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < count; i++) { await sleep(gap); await shot(`intro-${String(i).padStart(2, '0')}`); }
} else if (mode === 'tour') {
  // press "Let Stella drive" and take a frame every few seconds for the whole tour
  await page.goto(base + '?nointro', { waitUntil: 'networkidle2' });
  await sleep(1200);
  await page.click('#tourBtnHero');
  const every = Number(sel) || 4000;
  for (let i = 0; i < 400; i++) {
    await sleep(every);
    await shot(`tour-${String(i).padStart(2, '0')}`);
    const on = await page.evaluate(() => document.body.classList.contains('is-touring'));
    if (!on) { console.log('tour ended after', ((i + 1) * every) / 1000, 's at scrollY', await page.evaluate(() => Math.round(scrollY)), 'of', await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)); break; }
  }
} else if (mode === 'one') {
  await page.goto(base + '?nointro', { waitUntil: 'networkidle2' });
  await sleep(1200);
  await goTo(await topOf(sel, true));
  let i = 0;
  for (const w of waits.split(',').map(Number)) { await sleep(w); await shot(`${sel.replace(/[^a-z0-9]/gi, '')}-${i++}`); }
} else {
  await page.goto(base + '?nointro', { waitUntil: 'networkidle2' });
  await sleep(1500);
  await shot('00-hero');
  const plan = [
    ['#def', false, 1600], ['#crew', false, 1600],
    ['#stella', false, 1500], ['[data-stage="stella"]', true, 5200],
    ['#kavya', false, 1500], ['[data-stage="kavya"]', true, 7000],
    ['#nacc', false, 1500], ['[data-stage="nacc"]', true, 6500],
    ['#leadscout', false, 1500], ['[data-stage="leadscout"]', true, 6500],
    ['#tatva', false, 1500], ['[data-stage="tatva"]', true, 8500],
    ['#sms', false, 1500], ['[data-stage="sms"]', true, 7500],
    ['#panel', false, 1500], ['[data-stage="panel"]', true, 8000],
    ['#sites', false, 1600], ['#gallery', true, 1600],
    ['#about', false, 3500], ['#contact', false, 1800],
  ];
  let n = 1;
  for (const [q, centre, wait] of plan) {
    await goTo(await topOf(q, centre));
    await sleep(wait);
    await shot(`${String(n++).padStart(2, '0')}-${q.replace(/[^a-z0-9]/gi, '')}`);
  }
}

console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
