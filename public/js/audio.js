// Tiny WebAudio synth: no sound files needed.
let ctx = null;

function tone(freq, dur, { type = 'sine', vol = 0.12, to, delay = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const audio = {
  /** Must be called from a user gesture. */
  init() {
    try {
      ctx ??= new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
    } catch {}
  },

  moo(vol = 1, pitch = 1) {
    if (!ctx || vol <= 0.02) return;
    const t = ctx.currentTime;
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass';
    f.Q.value = 5;
    f.frequency.setValueAtTime(350, t);
    f.frequency.linearRampToValueAtTime(950, t + 0.3);
    f.frequency.linearRampToValueAtTime(380, t + 1.0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22 * vol, t + 0.1);
    g.gain.setValueAtTime(0.22 * vol, t + 0.7);
    g.gain.linearRampToValueAtTime(0, t + 1.05);
    f.connect(g).connect(ctx.destination);
    for (const detune of [0, 7]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.detune.value = detune;
      o.frequency.setValueAtTime(92 * pitch, t);
      o.frequency.linearRampToValueAtTime(150 * pitch, t + 0.2);
      o.frequency.linearRampToValueAtTime(118 * pitch, t + 1.0);
      o.connect(f);
      o.start(t);
      o.stop(t + 1.1);
    }
  },

  blip(step = 0) {
    tone(520 * Math.pow(1.06, Math.min(step, 12)), 0.14, { type: 'triangle', vol: 0.14 });
  },
  fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, { type: 'triangle', vol: 0.14, delay: i * 0.11 }));
  },
  munch() {
    for (let i = 0; i < 3; i++) tone(180, 0.07, { type: 'square', vol: 0.05, to: 90, delay: i * 0.13 });
  },
  peep() {
    tone(1800, 0.09, { vol: 0.08, to: 2600 });
    tone(2000, 0.09, { vol: 0.08, to: 2800, delay: 0.12 });
  },
  bonk() {
    tone(140, 0.2, { type: 'triangle', vol: 0.25, to: 50 });
  },
  caw() {
    tone(700, 0.18, { type: 'sawtooth', vol: 0.06, to: 450 });
    tone(680, 0.18, { type: 'sawtooth', vol: 0.06, to: 420, delay: 0.2 });
  },
};
