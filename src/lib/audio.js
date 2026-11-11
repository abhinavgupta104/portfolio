// Every sound is synthesised in the browser: no audio files to download.
// Off by default; the visitor turns it on from the nav.
let ctx = null;
let master = null;
let on = false;
let ringTimer = null;
let ringNodes = [];

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  return ctx;
}

function tone(freq, { dur = 0.08, type = 'sine', vol = 0.12, at = 0, slide = 0 } = {}) {
  if (!on || !ensure()) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.03);
}

export const audio = {
  get on() { return on; },
  set(v) {
    on = v;
    if (on) { ensure(); ctx?.resume(); this.chime(); } else this.ringStop();
    try { localStorage.setItem('sound', on ? '1' : '0'); } catch {}
  },
  tick() { tone(1900, { dur: 0.025, type: 'square', vol: 0.025 }); },
  click() { tone(520, { dur: 0.06, type: 'triangle', vol: 0.11, slide: -220 }); },
  key() { tone(1250 + Math.random() * 300, { dur: 0.02, type: 'square', vol: 0.018 }); },
  pop() { tone(740, { dur: 0.09, vol: 0.1, slide: 380 }); },
  whoosh() { tone(180, { dur: 0.5, type: 'sawtooth', vol: 0.035, slide: 900 }); },
  ding() { tone(1318, { dur: 0.5, vol: 0.12 }); tone(1975, { dur: 0.6, vol: 0.07, at: 0.09 }); },
  chime() { [587, 740, 880, 1175].forEach((f, i) => tone(f, { dur: 0.5, vol: 0.08, at: i * 0.07 })); },
  hang() { tone(480, { dur: 0.16, vol: 0.09 }); tone(380, { dur: 0.22, vol: 0.09, at: 0.18 }); },
  // Indian ringback: 400 Hz with a 25 Hz warble, 0.4 s on / 0.2 s off / 0.4 s on / 2 s off.
  ringStart() {
    if (!on || !ensure()) return;
    this.ringStop();
    const burst = () => {
      [0, 0.6].forEach((at) => {
        const t = ctx.currentTime + at;
        const o = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        const g = ctx.createGain();
        o.frequency.value = 400; lfo.frequency.value = 25; lg.gain.value = 0.05;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.07, t + 0.02);
        g.gain.setValueAtTime(0.07, t + 0.38);
        g.gain.linearRampToValueAtTime(0.0001, t + 0.4);
        lfo.connect(lg).connect(g.gain);
        o.connect(g).connect(master);
        o.start(t); lfo.start(t); o.stop(t + 0.42); lfo.stop(t + 0.42);
        ringNodes.push(o, lfo);
      });
    };
    burst();
    ringTimer = setInterval(burst, 3000);
  },
  ringStop() {
    clearInterval(ringTimer); ringTimer = null;
    ringNodes.forEach((n) => { try { n.stop(); } catch {} });
    ringNodes = [];
  },
};

export function initAudio(btn) {
  const paint = () => {
    btn.setAttribute('aria-pressed', String(on));
    btn.querySelector('.pill__label').textContent = on ? 'Sound on' : 'Sound off';
  };
  btn.addEventListener('click', () => { audio.set(!on); paint(); });
  paint();
}
