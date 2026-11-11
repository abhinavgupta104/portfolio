// Records the portfolio as a perfectly smooth video, frame by frame.
//
//   node scripts/record.mjs <out.mp4> [--size 1920x1080] [--scale 1] [--fps 60] [--test 4] [--url https://…]
//
// --size is the browser window in CSS pixels, so it decides the layout
// (phone layout below 760 wide). --scale multiplies the pixels in the video:
// `--size 390x844 --scale 2.75` is a phone-shaped video about 1072×2320.
//
// Real-time screen recording drops frames whenever the machine is busy. This
// doesn't: it freezes the page's clock, then for every video frame moves time
// forward by exactly 1/fps, lets every timer, animation frame and CSS animation
// run, takes a picture, and hands it to ffmpeg. Capture can be slow; the video
// still plays at a steady 60 fps.
//
// What it records: the opening, a short pause, then "Let Stella drive" — her
// guided tour of every section and demo — until it ends at the contact section.
// --test N records only the first N seconds of the opening.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith('--') && !/^\d/.test(a)) || 'portfolio.mp4';
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const [W, H] = opt('size', '1920x1080').split('x').map(Number);
const SCALE = Number(opt('scale', 1));
const PHONE = W < 760;
const FPS = Number(opt('fps', 60));
const TEST = opt('test', null) ? Number(opt('test')) : null;
const URL = opt('url', 'https://portfolio.banadiyabhai.online/');
const STEP = 1000 / FPS;
const nap = (ms) => new Promise((r) => setTimeout(r, ms)); // real time, on this side only

// Installed in the page before any of its own scripts run.
function freezeTime() {
  const realNow = performance.now.bind(performance);
  const RealDate = Date;
  const t0 = realNow();
  const d0 = RealDate.now();
  let vt = 0; // virtual milliseconds since the page started

  // timers
  let seq = 1;
  const timers = new Map();
  window.setTimeout = (fn, ms = 0, ...a) => { const id = seq++; timers.set(id, { at: vt + Math.max(0, Number(ms) || 0), fn, a, every: 0 }); return id; };
  window.setInterval = (fn, ms = 0, ...a) => { const id = seq++; const every = Math.max(1, Number(ms) || 0); timers.set(id, { at: vt + every, fn, a, every }); return id; };
  window.clearTimeout = window.clearInterval = (id) => { timers.delete(id); };

  // animation frames
  let rafSeq = 1;
  let rafs = new Map();
  window.requestAnimationFrame = (fn) => { const id = rafSeq++; rafs.set(id, fn); return id; };
  window.cancelAnimationFrame = (id) => { rafs.delete(id); };

  // clocks
  performance.now = () => t0 + vt;
  class VDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(d0 + vt); }
    static now() { return d0 + vt; }
  }
  RealDate.now = VDate.now;
  window.Date = VDate;

  const call = (fn, a) => { try { if (typeof fn === 'function') fn(...a); } catch (e) { console.error(e); } };

  /** Move time forward by ms: due timers in order, then one animation frame, then CSS animations. */
  window.__advance = async (ms) => {
    const target = vt + ms;
    for (let guard = 0; guard < 2000; guard++) {
      let id = null;
      let next = null;
      for (const [k, t] of timers) if (t.at <= target && (!next || t.at < next.at)) { id = k; next = t; }
      if (!next) break;
      vt = Math.max(vt, next.at);
      if (next.every) next.at += next.every; else timers.delete(id);
      call(next.fn, next.a);
      await Promise.resolve(); // let promise chains started by the timer continue
      await Promise.resolve();
    }
    vt = target;
    const due = rafs;
    rafs = new Map();
    for (const fn of due.values()) call(fn, [t0 + vt]);
    await Promise.resolve();
    // CSS animations and transitions follow the same clock
    for (const an of document.getAnimations()) {
      if (!an.__frozen) { an.__frozen = true; an.pause(); an.__t = an.currentTime || 0; }
      an.__t += ms;
      an.currentTime = an.__t;
    }
    return vt;
  };
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: ['--no-sandbox', '--hide-scrollbars', '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=gl-egl', '--ozone-platform=headless', `--window-size=${W},${H}`],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: SCALE, isMobile: PHONE, hasTouch: PHONE });
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.evaluateOnNewDocument(freezeTime);
const cdp = await page.createCDPSession();

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 90000 });
// the opening starts once fonts are in; with time frozen it waits at its first frame
for (let i = 0; i < 300; i++) {
  if (await page.evaluate(() => typeof window.__introStart === 'number')) break;
  await nap(100);
}

const ff = spawn('ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-y',
  '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  // H.264 needs even dimensions; a scaled phone size can come out odd
  '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart', out,
], { stdio: ['pipe', 'inherit', 'inherit'] });
const write = (buf) => new Promise((res) => { if (ff.stdin.write(buf)) res(); else ff.stdin.once('drain', res); });

let frames = 0;
const started = Date.now();
async function frame() {
  await page.evaluate((ms) => window.__advance(ms), STEP);
  // the clip's scale is what makes --scale real: without it the shot comes back at CSS pixels
  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'jpeg', quality: 93, optimizeForSpeed: false,
    clip: { x: 0, y: 0, width: W, height: H, scale: SCALE },
  });
  await write(Buffer.from(data, 'base64'));
  frames++;
  if (frames % 300 === 0) {
    const real = (Date.now() - started) / 1000;
    console.log(`${(frames / FPS).toFixed(0)} s of video recorded (${frames} frames) in ${real.toFixed(0)} s`);
  }
}
const seconds = async (s) => { for (let i = 0; i < Math.round(s * FPS); i++) await frame(); };
const until = async (test, max) => {
  for (let i = 0; i < Math.round(max * FPS); i++) {
    await frame();
    if (i % 15 === 0 && (await page.evaluate(test))) return true;
  }
  return false;
};

if (TEST) {
  await seconds(TEST);
} else {
  console.log('recording the opening…');
  await until(() => window.__booted === true, 20);
  await seconds(1.6);
  console.log('starting the tour…');
  await page.evaluate(() => document.querySelector('#tourBtnHero').click());
  await seconds(1);
  const ended = await until(() => !document.body.classList.contains('is-touring'), 240);
  if (!ended) console.log('warning: the tour did not end within 4 minutes');
  await seconds(3);
}

ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await browser.close();
console.log(`done: ${out}, ${(frames / FPS).toFixed(1)} s, ${frames} frames, captured in ${((Date.now() - started) / 1000).toFixed(0)} s`);
