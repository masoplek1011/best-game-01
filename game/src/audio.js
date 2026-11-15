// All sound is synthesised here with WebAudio: short oscillator bursts for the
// effects and a small step-sequenced bass + pluck loop for the music. No audio
// file is loaded. The context is created lazily on the first user gesture, so a
// silent screenshot run never touches audio at all.

function tone(ctx, destination, { type, from, to, seconds, volume, when = 0 }) {
  const start = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, from), start);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + seconds);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  osc.connect(gain).connect(destination);
  osc.start(start);
  osc.stop(start + seconds + 0.02);
}

function noiseBurst(ctx, destination, { seconds, volume, lowpass }) {
  const start = ctx.currentTime;
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  source.connect(filter).connect(gain).connect(destination);
  source.start(start);
}

// A minor-key bassline that walks under the whole run; the pluck answers it.
const BASS_STEPS = [55, 0, 55, 65.41, 0, 55, 49, 58.27, 55, 0, 55, 65.41, 82.41, 0, 73.42, 65.41];
const PLUCK_STEPS = [220, 0, 261.63, 0, 329.63, 0, 261.63, 0, 196, 0, 246.94, 0, 293.66, 329.63, 0, 0];
const STEP_SECONDS = 0.21;

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicTimer = null;
  let step = 0;
  let nextTime = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      return true;
    } catch {
      return false;
    }
  }

  function scheduleMusic() {
    if (!ctx || muted) return;
    while (nextTime < ctx.currentTime + 0.35) {
      const bass = BASS_STEPS[step % BASS_STEPS.length];
      const pluck = PLUCK_STEPS[step % PLUCK_STEPS.length];
      if (bass) tone(ctx, musicGain, { type: 'triangle', from: bass, to: bass, seconds: STEP_SECONDS * 0.95, volume: 0.9, when: nextTime - ctx.currentTime });
      if (pluck && step % 2 === 0) tone(ctx, musicGain, { type: 'sine', from: pluck, to: pluck, seconds: 0.3, volume: 0.35, when: nextTime - ctx.currentTime });
      step += 1;
      nextTime += STEP_SECONDS;
    }
  }

  return {
    /** Call from any user gesture; safe to call repeatedly. */
    unlock() { ensure(); },
    get isMuted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.02);
      return muted;
    },
    startMusic() {
      if (!ensure() || musicTimer) return;
      nextTime = ctx.currentTime + 0.05;
      musicTimer = window.setInterval(scheduleMusic, 90);
    },
    stopMusic() {
      if (musicTimer) { window.clearInterval(musicTimer); musicTimer = null; }
    },
    shoot() { if (ensure() && !muted) tone(ctx, master, { type: 'square', from: 880, to: 320, seconds: 0.07, volume: 0.1 }); },
    enemyShoot() { if (ensure() && !muted) tone(ctx, master, { type: 'sawtooth', from: 220, to: 140, seconds: 0.12, volume: 0.06 }); },
    hitEnemy() { if (ensure() && !muted) tone(ctx, master, { type: 'triangle', from: 520, to: 700, seconds: 0.05, volume: 0.12 }); },
    explode() {
      if (!ensure() || muted) return;
      noiseBurst(ctx, master, { seconds: 0.28, volume: 0.35, lowpass: 900 });
      tone(ctx, master, { type: 'sine', from: 160, to: 40, seconds: 0.3, volume: 0.3 });
    },
    hurt() {
      if (!ensure() || muted) return;
      tone(ctx, master, { type: 'sawtooth', from: 200, to: 60, seconds: 0.25, volume: 0.25 });
      noiseBurst(ctx, master, { seconds: 0.15, volume: 0.2, lowpass: 500 });
    },
    pickup() {
      if (!ensure() || muted) return;
      tone(ctx, master, { type: 'sine', from: 660, to: 660, seconds: 0.09, volume: 0.18 });
      tone(ctx, master, { type: 'sine', from: 990, to: 990, seconds: 0.14, volume: 0.18, when: 0.08 });
    },
    dash() { if (ensure() && !muted) noiseBurst(ctx, master, { seconds: 0.12, volume: 0.14, lowpass: 2400 }); },
    waveClear() {
      if (!ensure() || muted) return;
      [523.25, 659.25, 783.99].forEach((freq, i) => tone(ctx, master, { type: 'sine', from: freq, to: freq, seconds: 0.16, volume: 0.16, when: i * 0.09 }));
    },
    victory() {
      if (!ensure() || muted) return;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => tone(ctx, master, { type: 'triangle', from: freq, to: freq, seconds: 0.3, volume: 0.18, when: i * 0.13 }));
    },
    gameOver() {
      if (!ensure() || muted) return;
      [392, 311.13, 233.08, 155.56].forEach((freq, i) => tone(ctx, master, { type: 'triangle', from: freq, to: freq * 0.94, seconds: 0.34, volume: 0.18, when: i * 0.17 }));
    },
  };
}
