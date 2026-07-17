// Sons sintetizados (WebAudio puro): golpes, acertos, quest, level-up, ambiente.
let ctx = null, master = null, started = false;

export function initAudio() {
  if (started) return;
  started = true;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  ambient();
}
const now = () => ctx.currentTime;

function env(g, t0, a, d, peak = 1) {
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + a + d);
}
function tone(freq, type, a, d, peak = 0.3, when = 0, slide = 0) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, now() + when);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), now() + when + a + d);
  env(g, now() + when, a, d, peak);
  o.connect(g); g.connect(master);
  o.start(now() + when); o.stop(now() + when + a + d + 0.05);
}
function noise(dur, peak = 0.25, freq = 800, when = 0) {
  if (!ctx) return;
  const n = ctx.sampleRate * dur;
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = ctx.createGain();
  env(g, now() + when, 0.01, dur, peak);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(now() + when);
}

export const sfx = {
  swing: () => noise(0.12, 0.14, 1600),
  hit: (crit) => { noise(0.08, crit ? 0.34 : 0.2, 700); tone(crit ? 180 : 140, 'square', 0.005, 0.1, crit ? 0.22 : 0.12); },
  hurt: () => tone(110, 'sawtooth', 0.005, 0.16, 0.16, 0, -40),
  mobDie: () => { tone(160, 'sawtooth', 0.01, 0.4, 0.16, 0, -120); noise(0.3, 0.12, 400); },
  levelUp: () => { [392, 523, 659, 784].forEach((f, i) => tone(f, 'triangle', 0.01, 0.5, 0.22, i * 0.11)); },
  questAccept: () => { tone(440, 'triangle', 0.01, 0.2, 0.2); tone(587, 'triangle', 0.01, 0.3, 0.2, 0.12); },
  questDone: () => { [523, 659, 784].forEach((f, i) => tone(f, 'triangle', 0.01, 0.35, 0.22, i * 0.1)); tone(1046, 'triangle', 0.01, 0.6, 0.18, 0.3); },
  coin: () => tone(1200, 'square', 0.002, 0.09, 0.07),
  charge: () => noise(0.35, 0.2, 900),
  shout: () => { tone(200, 'square', 0.01, 0.3, 0.2); tone(150, 'square', 0.01, 0.35, 0.18, 0.05); },
  whirl: () => { noise(0.4, 0.2, 1200); },
  death: () => { [220, 174, 146, 110].forEach((f, i) => tone(f, 'sawtooth', 0.01, 0.5, 0.16, i * 0.22)); },
  portal: () => { [392, 494, 587, 740, 880].forEach((f, i) => tone(f, 'sine', 0.02, 0.7, 0.16, i * 0.09)); },
};

function ambient() {
  // vento: loop de ruído filtrado bem baixo
  const n = ctx.sampleRate * 3;
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  let v = 0;
  for (let i = 0; i < n; i++) { v = v * 0.98 + (Math.random() * 2 - 1) * 0.02; ch[i] = v * 6; }
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
  const g = ctx.createGain(); g.gain.value = 0.11;
  src.connect(f); f.connect(g); g.connect(master);
  src.start();
  // passarinhos ocasionais
  const chirp = () => {
    if (Math.random() < 0.6) {
      const f0 = 2200 + Math.random() * 1400;
      tone(f0, 'sine', 0.01, 0.07, 0.05);
      tone(f0 * 1.25, 'sine', 0.01, 0.06, 0.045, 0.09);
      if (Math.random() < 0.5) tone(f0 * 0.9, 'sine', 0.01, 0.08, 0.04, 0.18);
    }
    setTimeout(chirp, 3500 + Math.random() * 9000);
  };
  setTimeout(chirp, 2500);
}
