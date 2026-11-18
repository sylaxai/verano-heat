// Procedural WebAudio sound for VERANO HEAT — no audio files, all synthesized.
export class GameAudio {
  constructor() { this.ctx = null; this.master = null; this.musicTimer = null; this.sirenNodes = null; this.engineOsc = null; }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }
  tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  noise(dur, vol = 0.3, freq = 1200) {
    if (!this.ctx) return;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
  }
  click() { this.tone(700, 0.06, 'square', 0.08); }
  chime() { this.tone(660, 0.15, 'sine', 0.2); this.tone(880, 0.2, 'sine', 0.2, null, 0.12); this.tone(1320, 0.3, 'sine', 0.15, null, 0.24); }
  gunshot() { this.noise(0.12, 0.5, 900); this.tone(140, 0.1, 'square', 0.25, 50); }
  hit() { this.noise(0.08, 0.3, 500); this.tone(90, 0.12, 'triangle', 0.3, 40); }
  pickup() { this.tone(520, 0.1, 'sine', 0.2); this.tone(780, 0.14, 'sine', 0.2, null, 0.08); }
  hurt() { this.tone(200, 0.15, 'sawtooth', 0.2, 90); }
  startEngine() {
    if (!this.ctx || this.engineOsc) return;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 55; g.gain.value = 0.05;
    o.connect(g); g.connect(this.master); o.start(); this.engineOsc = { o, g };
  }
  setEngine(speedRatio) { if (this.engineOsc) this.engineOsc.o.frequency.value = 50 + Math.abs(speedRatio) * 90; }
  stopEngine() { if (this.engineOsc) { try { this.engineOsc.o.stop(); } catch { /* done */ } this.engineOsc = null; } }
  startSiren() {
    if (!this.ctx || this.sirenNodes) return;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = 'triangle'; g.gain.value = 0.035;
    const lfo = this.ctx.createOscillator(); const lg = this.ctx.createGain();
    lfo.frequency.value = 0.7; lg.gain.value = 180; o.frequency.value = 750;
    lfo.connect(lg); lg.connect(o.frequency); o.connect(g); g.connect(this.master);
    o.start(); lfo.start(); this.sirenNodes = { o, lfo };
  }
  stopSiren() { if (this.sirenNodes) { try { this.sirenNodes.o.stop(); this.sirenNodes.lfo.stop(); } catch { /* done */ } this.sirenNodes = null; } }
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [55, 55, 65.4, 49, 55, 55, 82.4, 73.4];
    let step = 0;
    this.musicTimer = setInterval(() => {
      if (!this.ctx) return;
      const f = bass[step % bass.length];
      this.tone(f, 0.32, 'triangle', 0.16); this.tone(f * 2, 0.2, 'sine', 0.05);
      if (step % 4 === 0) this.tone(220, 0.1, 'sine', 0.04);
      step++;
    }, 340);
  }
  stopMusic() { if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; } }
}
