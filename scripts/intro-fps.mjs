// Measures how smooth the opening is: records every animation frame from page
// load until the opening ends, then reports its length and any slow frames.
//   node scripts/intro-fps.mjs [WxH] [runs]
import puppeteer from 'puppeteer-core';

const [size = '1440x900', runs = '3'] = process.argv.slice(2);
const [width, height] = size.split('x').map(Number);
const base = process.env.URL || 'http://127.0.0.1:5190/';

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: ['--no-sandbox', '--hide-scrollbars', '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=gl-egl', '--ozone-platform=headless'],
});

for (let run = 1; run <= Number(runs); run++) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, isMobile: width < 600, hasTouch: width < 600 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.evaluateOnNewDocument(() => {
    window.__frames = [];
    const tick = (t) => { window.__frames.push(t); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__booted === true, { timeout: 40000 });
  const r = await page.evaluate(() => {
    const f = window.__frames;
    // the opening starts when the island first speaks; ignore loading before that
    const start = window.__introStart || f[0];
    const frames = f.filter((t) => t >= start);
    const gaps = frames.slice(1).map((t, i) => t - frames[i]);
    const total = frames[frames.length - 1] - frames[0];
    // when each slow frame happened, in seconds into the opening
    const slow = gaps.map((g, i) => [g, (frames[i] - frames[0]) / 1000]).filter(([g]) => g > 25).map(([g, at]) => `${Math.round(g)} ms at ${at.toFixed(1)} s`);
    return {
      seconds: +(total / 1000).toFixed(2),
      fps: +(gaps.length / (total / 1000)).toFixed(1),
      over25: gaps.filter((g) => g > 25).length,
      over50: gaps.filter((g) => g > 50).length,
      worst: +Math.max(...gaps).toFixed(0),
      slow,
    };
  });
  console.log(`run ${run}: ${r.seconds} s, ${r.fps} fps, frames over 25 ms: ${r.over25}, over 50 ms: ${r.over50}, worst ${r.worst} ms${r.slow.length ? '  [' + r.slow.join(', ') + ']' : ''}${errors.length ? '  ERRORS: ' + errors.join(' | ') : ''}`);
  await page.close();
}
await browser.close();
