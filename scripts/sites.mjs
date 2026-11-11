// Refreshes the six website screenshots used in the gallery.
//   node scripts/sites.mjs            → writes public/shots/<domain>.webp (needs ImageMagick)
// It waits for each page to settle and dismisses the law firm's disclaimer.
import puppeteer from 'puppeteer-core';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SITES = ['nucleusai.si', 'riteshhng.com', 'anilanandassociates.com', 'houskeys.co.in', 'xshootsms.com', 'divyarudra.com', 'poojahawan.com'];
// nucleusai.si opens on an almost empty particle field; its logo forms about 2,400 px in.
const STORY = { 'nucleusai.si': [250, 250, 300, 400, 500, 700] };
const only = process.argv.slice(2);
const out = 'public/shots';
const tmp = join(tmpdir(), 'portfolio-shots');
mkdirSync(out, { recursive: true });
mkdirSync(tmp, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: ['--no-sandbox', '--hide-scrollbars', '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=gl-egl', '--ozone-platform=headless'],
});

for (const domain of SITES.filter((d) => !only.length || only.includes(d))) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  try {
    await page.goto(`https://${domain}`, { waitUntil: 'networkidle2', timeout: 45000 });
  } catch { /* a slow tracker should not stop the shot */ }
  await sleep(2500);
  // Some sites navigate again after loading (a redirect, a language switch);
  // let that settle instead of failing on the old page.
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 15000 }).catch(() => {});
  // dismiss consent / disclaimer dialogs (buttons only: a matching link could leave the page)
  await page.evaluate(() => {
    const want = /^(i agree|agree|accept|accept all|got it|ok)$/i;
    [...document.querySelectorAll('button')].filter((b) => want.test((b.textContent || '').trim())).forEach((b) => b.click());
  }).catch(() => {});
  await page.mouse.move(700, 450);
  if (STORY[domain]) {
    // a scroll-told hero: walk into it until the picture has formed
    for (const step of STORY[domain]) { await page.mouse.wheel({ deltaY: step }); await sleep(2200); }
  } else {
    // nudge scroll-driven intros, then come back to the top
    await page.mouse.wheel({ deltaY: 300 });
    await sleep(900);
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
    await page.mouse.wheel({ deltaY: -600 });
    await sleep(4500);
  }
  const png = join(tmp, `${domain}.png`);
  await page.screenshot({ path: png });
  execFileSync('magick', [png, '-resize', '1200x', '-crop', '1200x750+0+0', '+repage', '-quality', '82', `${out}/${domain}.webp`]);
  console.log('saved', domain);
  await page.close();
}
await browser.close();
