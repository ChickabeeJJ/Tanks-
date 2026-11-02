// Tiny synthesized sound effects (no audio files to download).
import { SDK } from './sdk.js';

let ctx = null;
let master = null;
let volume = 0.7;
const last = {};

function ensure() {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.connect(ctx.destination);
    apply();
  } catch { ctx = null; }
  return ctx;
}
function apply() {
  if (master) master.gain.value = SDK.muted ? 0 : volume;
}
SDK.onAudioChange(apply);

function tone(freq, dur, type = 'sine', vol = 0.2, slide = 0, delay = 0) {
  const c = ensure();
  if (!c || SDK.muted || volume <= 0) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, vol = 0.2, freq = 1200) {
  const c = ensure();
  if (!c || SDK.muted || volume <= 0) return;
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start();
}

function throttle(key, ms) {
  const now = performance.now();
  if (last[key] && now - last[key] < ms) return false;
  last[key] = now;
  return true;
}

export const Audio = {
  unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); },
  setVolume(v) { volume = v; apply(); },
  shoot() { if (throttle('shoot', 70)) { tone(320, 0.08, 'square', 0.05, -180); noise(0.05, 0.05, 900); } },
  pop(big) { if (throttle('pop', 40)) { tone(big ? 300 : 620, 0.12, 'triangle', 0.12, big ? -150 : 300); } },
  hit() { if (throttle('hit', 90)) noise(0.08, 0.1, 500); },
  boom() { if (throttle('boom', 80)) { noise(0.35, 0.25, 400); tone(90, 0.3, 'sine', 0.2, -50); } },
  click() { tone(660, 0.06, 'triangle', 0.08, 120); },
  error() { tone(200, 0.15, 'square', 0.06, -60); },
  upgrade() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.1, 0, i * 0.07)); },
  level() { [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'sine', 0.12, 0, i * 0.08)); },
  reward() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.2, 'sine', 0.1, 0, i * 0.06)); },
  death() { tone(400, 0.6, 'sawtooth', 0.08, -320); noise(0.4, 0.15, 600); },
  kill() { [660, 880, 1320].forEach((f, i) => tone(f, 0.14, 'square', 0.06, 0, i * 0.06)); },
  tick() { tone(1200, 0.03, 'square', 0.03); },
};
