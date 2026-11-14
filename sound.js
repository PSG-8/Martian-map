/* =====================================================================
   sound.js  ·  Martian Map · MR_PSG / Team Starseekers
   Quiet, calm sound made live with the Web Audio API (no audio files):
     - Mars wind: soft filtered noise that rises and falls slowly
     - a very low, warm pad under it
     - footsteps of the SINBAD suit (muffled: thin CO2 air carries little sound)
     - a low motor hum for the RAHHAL and QAFILA rovers while they drive
     - a soft two-tone warning when the route enters difficult (red) ground
     - a gentle chime on arrival
     - Omani frame-drum rhythms (kasir / rahmani style) under al-Bar'ah and al-Razha
   Everything is mixed low, and one button mutes it all (remembered on this device).
   ===================================================================== */
const KEY = 'mm-sound';

export class MarsSound {
  constructor() {
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { /* storage blocked */ }
    this.enabled = saved === null ? true : saved === '1';
    this.ctx = null;
    this.listeners = [];
    this.drumMode = null; this.drumStart = 0; this.drumNext = 0; this.drumTimer = null;
    this.lastAlert = 0;
  }
  onChange(fn) { this.listeners.push(fn); }
  _emit() { for (const f of this.listeners) f(this.enabled); }

  /* must be called from a user gesture the first time (browser autoplay rules) */
  unlock() {
    if (!this.enabled) return;
    if (!this.ctx) this._build();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  toggle() {
    this.enabled = !this.enabled;
    try { localStorage.setItem(KEY, this.enabled ? '1' : '0'); } catch (e) { /* ignore */ }
    if (this.enabled) { this.unlock(); if (this.master) this._ramp(this.master.gain, 0.9, 0.6); }
    else if (this.master) this._ramp(this.master.gain, 0, 0.3);
    this._emit();
  }
  _ramp(param, v, sec) {
    const t = this.ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(v, t + sec);
  }
  _build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -24; comp.ratio.value = 3;
    comp.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.gain.value = 0;
    this.master.connect(comp);
    this._ramp(this.master.gain, 0.9, 2.5);                      // fade in gently

    // brown noise buffer, shared by wind, steps and drums
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    this.noise = buf;

    // wind
    const wind = ctx.createBufferSource(); wind.buffer = buf; wind.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 380; bp.Q.value = 0.6;
    const wg = ctx.createGain(); wg.gain.value = 0.11;
    wind.connect(bp).connect(wg).connect(this.master);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 170;
    lfo.connect(lfoAmt).connect(bp.frequency);
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.031;
    const lfo2Amt = ctx.createGain(); lfo2Amt.gain.value = 0.05;
    lfo2.connect(lfo2Amt).connect(wg.gain);
    wind.start(); lfo.start(); lfo2.start();

    // warm pad: A1 + E2 + A2, slightly detuned sines through a low-pass
    const pad = ctx.createGain(); pad.gain.value = 0.018;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    pad.connect(lp).connect(this.master);
    for (const [f, dt] of [[55, 0], [82.4, 3], [110, -4], [164.8, 2]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.detune.value = dt;
      o.connect(pad); o.start();
    }
    const padLfo = ctx.createOscillator(); padLfo.frequency.value = 0.05;
    const padAmt = ctx.createGain(); padAmt.gain.value = 0.008;
    padLfo.connect(padAmt).connect(pad.gain); padLfo.start();

    // rover motor hum (silent until a rover drives)
    this.hum = ctx.createGain(); this.hum.gain.value = 0;
    const hlp = ctx.createBiquadFilter(); hlp.type = 'lowpass'; hlp.frequency.value = 240;
    this.hum.connect(hlp).connect(this.master);
    this.humOsc = [];
    for (const [type, f] of [['sawtooth', 48], ['triangle', 96.5]]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.connect(this.hum); o.start(); this.humOsc.push(o);
    }
  }

  /* rover hum while driving: speed 0..1 */
  motor(on, speed = 0.5) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    this.hum.gain.setTargetAtTime(on ? 0.022 + 0.018 * speed : 0, t, 0.25);
    this.humOsc[0].frequency.setTargetAtTime(44 + 22 * speed, t, 0.3);
    this.humOsc[1].frequency.setTargetAtTime(90 + 40 * speed, t, 0.3);
  }
  _burst(t, { gain = 0.1, freq = 200, q = 1, dur = 0.12, type = 'lowpass' } = {}) {
    const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 3, dur + 0.05);
  }
  _tone(t, f0, f1, dur, gain, type = 'sine') {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  /* one muffled boot step on Martian regolith */
  step(slip = 0) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    this._burst(t, { gain: 0.07 + slip * 0.05, freq: 170 + Math.random() * 40, q: 0.7, dur: 0.16 });
    this._burst(t + 0.02, { gain: 0.02 + slip * 0.04, freq: 900, q: 0.8, dur: 0.09, type: 'bandpass' });   // grit
  }
  /* soft warning: entering red ground (at most every 4 s) */
  alert() {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    if (now - this.lastAlert < 4) return;
    this.lastAlert = now;
    this._tone(now, 660, 655, 0.22, 0.05);
    this._tone(now + 0.26, 523, 520, 0.32, 0.05);
  }
  /* arrival chime: a calm pentatonic arpeggio */
  chime() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    [523.3, 659.3, 784, 1046.5].forEach((f, i) => { this._tone(t + i * 0.14, f, f, 1.4, 0.035); this._tone(t + i * 0.14, f * 2.01, f * 2, 0.6, 0.008); });
  }

  /* Omani frame-drum rhythms. mode: 'baraa' | 'razha' | null. start: AudioContext-independent seconds
     (performance.now()/1000) when the dance section began, so beats line up with the dancer. */
  drums(mode, startPerf, beat) {
    if (!this.ctx || !this.enabled) mode = null;
    if (mode === this.drumMode && Math.abs(startPerf - this.drumStartPerf) < 0.01) return;
    this.drumMode = mode; this.drumStartPerf = startPerf; this.drumBeat = beat;
    clearInterval(this.drumTimer); this.drumTimer = null;
    if (!mode) return;
    const offset = this.ctx.currentTime - performance.now() / 1000;   // perf time -> audio time
    this.drumT0 = startPerf + offset;
    this.drumIdx = Math.max(0, Math.ceil((this.ctx.currentTime - this.drumT0) / (beat / 2)));
    // patterns in half-beats: D = low "dum" (rahmani), T = slap "tak" (kasir), d = soft dum
    const pat = mode === 'baraa' ? 'D.T.DdT.D.T.DTT.' : 'D...T.d.D.D.T...';
    const tick = () => {
      const horizon = this.ctx.currentTime + 0.25;
      for (;;) {
        const t = this.drumT0 + this.drumIdx * beat / 2;
        if (t > horizon) break;
        const c = pat[this.drumIdx % pat.length];
        if (t >= this.ctx.currentTime - 0.02) {
          if (c === 'D') { this._tone(t, 120, 52, 0.42, 0.09); this._burst(t, { gain: 0.03, freq: 160, dur: 0.1 }); }
          else if (c === 'd') this._tone(t, 110, 55, 0.3, 0.045);
          else if (c === 'T') this._burst(t, { gain: 0.06, freq: 1800, q: 1.4, dur: 0.07, type: 'bandpass' });
        }
        this.drumIdx++;
      }
    };
    tick();
    this.drumTimer = setInterval(tick, 90);
  }
}
