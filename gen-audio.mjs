// Generates music.wav (soft lo-fi bed) and sfx.wav (synced sound effects). No dependencies.
import fs from 'fs';
const SR = 44100, DUR = 31.0, N = Math.floor(SR * DUR);
const music = new Float32Array(N), sfx = new Float32Array(N);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
let seed = 12345; const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function add(buf, t0, dur, fn, gain = 1) { const s0 = Math.max(0, Math.floor(t0 * SR)), s1 = Math.min(N, Math.floor((t0 + dur) * SR));
  for (let i = s0; i < s1; i++) { const t = i / SR - t0; buf[i] += fn(t) * gain; } }

/* ---------- music: 96 BPM, Am - F - C - G ---------- */
const BPM = 96, BEAT = 60 / BPM, BAR = BEAT * 4;
const chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const roots = [45, 41, 48, 43];
const musicEnv = t => clamp(t / 1.2) * (1 - clamp((t - (DUR - 1.4)) / 1.4));
for (let bar = 0; bar * BAR < DUR; bar++) {
  const t0 = bar * BAR, ch = chords[bar % 4];
  // pad: detuned soft saw-ish via few harmonics, slow attack
  for (const m of ch) for (const det of [-0.08, 0.08]) {
    const f = mtof(m + 12) * (1 + det / 100);
    add(music, t0, BAR + 0.3, t => { const env = clamp(t / 0.5) * (1 - clamp((t - BAR) / 0.3));
      return env * (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(4 * Math.PI * f * t) + 0.12 * Math.sin(6 * Math.PI * f * t)); }, 0.018);
  }
  // pluck arpeggio (eighths) from 3.85s on
  for (let k = 0; k < 8; k++) { const tt = t0 + k * BEAT / 2; if (tt < 3.85 || tt > 28.2) continue;
    const m = ch[[0, 1, 2, 1, 0, 2, 1, 2][k]] + 24, f = mtof(m);
    add(music, tt, 0.35, t => Math.exp(-t * 9) * Math.sin(2 * Math.PI * f * t) * (1 + 0.3 * Math.sin(2 * Math.PI * f * 2 * t)), 0.05); }
  // bass on beats 1 and 3
  for (const b of [0, 2]) { const tt = t0 + b * BEAT; if (tt < 3.85) continue; const f = mtof(roots[bar % 4]);
    add(music, tt, BEAT * 1.6, t => Math.exp(-t * 2.2) * clamp(t / 0.01) * Math.sin(2 * Math.PI * f * t), 0.16); }
  // drums
  for (let b = 0; b < 4; b++) { const tt = t0 + b * BEAT; if (tt < 3.85 || tt > 28.4) continue;
    add(music, tt, 0.35, t => { const f = 45 + 90 * Math.exp(-t * 28); return Math.exp(-t * 9) * Math.sin(2 * Math.PI * f * t); }, 0.42); // kick
    if (b === 1 || b === 3) add(music, tt, 0.18, t => Math.exp(-t * 22) * rand(), 0.07); // soft snare
    add(music, tt + BEAT / 2, 0.05, t => Math.exp(-t * 90) * rand(), 0.045); // hat
  }
}
for (let i = 0; i < N; i++) music[i] *= musicEnv(i / SR);

/* ---------- SFX ---------- */
function whoosh(t0, g = 0.35) { let lp = 0; add(sfx, t0 - 0.25, 0.6, t => { const p = t / 0.6, env = Math.sin(Math.PI * p) ** 2; const a = 0.02 + 0.25 * p; lp += a * (rand() - lp); return env * lp * 3; }, g); }
function ping(t0, g = 0.25) { for (const [d, a] of [[0, 1], [0.28, 0.45], [0.56, 0.2]]) add(sfx, t0 + d, 1.0, t => Math.exp(-t * 5) * Math.sin(2 * Math.PI * 1320 * t) * clamp(t / 0.004), g * a); }
function blip(t0, f0 = 700, f1 = 1300, g = 0.18) { add(sfx, t0, 0.12, t => { const f = f0 + (f1 - f0) * (t / 0.12); return Math.exp(-t * 25) * Math.sin(2 * Math.PI * f * t); }, g); }
function sonar(t0, g = 0.12) { add(sfx, t0, 0.5, t => Math.exp(-t * 6) * Math.sin(2 * Math.PI * (2400 - 1400 * clamp(t / 0.5)) * t), g); }
function beep(t0, g = 0.06) { add(sfx, t0, 0.08, t => (Math.sin(2 * Math.PI * 1000 * t) > 0 ? 1 : -1) * clamp(t / 0.003) * (1 - clamp((t - 0.07) / 0.01)), g); }
function bell(t0, f, g = 0.16) { add(sfx, t0, 1.2, t => Math.exp(-t * 4) * (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-t * 6)), g); }
function click(t0, g = 0.05) { add(sfx, t0, 0.02, t => Math.exp(-t * 400) * rand(), g); }

ping(0.15, 0.22);
for (const t of [3.85, 10.25, 14.15, 17.82, 24.42, 26.3, 28.2]) whoosh(t);
[2.517, 2.617, 2.717, 2.817].forEach((t, i) => blip(t, 600 + i * 120, 1100 + i * 150));
sonar(6.6); sonar(7.02); sonar(9.5);
blip(11.95, 400, 220, 0.2); // sensor lands on servo
// buzzer beeps (same timing as the picture)
{ let t = 15.9; while (t < 17.75) { beep(t); const c = clamp((t - 15.3) / (17.2 - 15.3)); t += 0.5 + (0.16 - 0.5) * c; } }
bell(20.462, mtof(84)); bell(21.529, mtof(88)); bell(22.852, mtof(79), 0.2); bell(22.852 + 0.12, mtof(79), 0.14);
for (let t = 24.6; t < 25.9; t += 0.09) click(t);
bell(25.95, mtof(84), 0.12); bell(26.05, mtof(88), 0.12); bell(26.15, mtof(91), 0.14);
ping(26.35, 0.18);
bell(29.12, mtof(81), 0.12); bell(29.12, mtof(85), 0.1); bell(29.12, mtof(88), 0.1);

function writeWav(path, buf) {
  const b = Buffer.alloc(44 + N * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + N * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(N * 2, 40);
  let peak = 0; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(buf[i]));
  const k = peak > 0.95 ? 0.95 / peak : 1;
  for (let i = 0; i < N; i++) b.writeInt16LE(Math.round(clamp(buf[i] * k, -1, 1) * 32767), 44 + i * 2);
  fs.writeFileSync(path, b);
}
writeWav('music.wav', music); writeWav('sfx.wav', sfx);
console.log('audio ok');
