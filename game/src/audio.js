// Sound, synthesized live with WebAudio: no files, no network. An engine
// hum that follows the car's speed, a two-tone siren for nearby cop cars, a
// bass groove with a sparse lead line for cruising, and short blips for
// shots, crashes, pickups, paydays and the sting when the heat rises.
// Everything waits for the first user gesture, as browsers require.

export function createAudio() {
  return {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenLfo: null,
    muted: false,
    musicTimer: null,
    musicStep: 0,
  };
}

// A decaying noise buffer of `dur` seconds, reused by every noise sound.
function noiseBuffer(audio, dur) {
  const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
  const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  return buffer;
}

function playNoise(audio, dur, vol, filterType, filterFreq, q) {
  if (!audio.ctx) return;
  try {
    const src = audio.ctx.createBufferSource();
    src.buffer = noiseBuffer(audio, dur);
    const filter = audio.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    if (q) filter.Q.value = q;
    const gain = audio.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    src.start(audio.ctx.currentTime);
  } catch {
    // Sound is garnish: never let it break the game.
  }
}

function blip(audio, freq, dur, type, vol, slideTo, delay) {
  if (!audio.ctx) return;
  try {
    const t = audio.ctx.currentTime + (delay || 0);
    const osc = audio.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const gain = audio.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  } catch {
    // Sound is garnish.
  }
}

export function unlockAudio(audio) {
  if (audio.ctx) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
    return;
  }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audio.ctx = new Ctx();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = audio.muted ? 0 : 0.5;
    audio.master.connect(audio.ctx.destination);

    // Engine: a low sawtooth through a lowpass, pitch follows speed.
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 55;
    const engineFilter = audio.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0;
    audio.engineOsc.connect(engineFilter);
    engineFilter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();

    // Siren: a sine whose pitch wobbles between two tones.
    audio.sirenOsc = audio.ctx.createOscillator();
    audio.sirenOsc.type = 'sine';
    audio.sirenOsc.frequency.value = 820;
    audio.sirenLfo = audio.ctx.createOscillator();
    audio.sirenLfo.type = 'square';
    audio.sirenLfo.frequency.value = 1.4;
    const lfoGain = audio.ctx.createGain();
    lfoGain.gain.value = 140;
    audio.sirenLfo.connect(lfoGain);
    lfoGain.connect(audio.sirenOsc.frequency);
    audio.sirenGain = audio.ctx.createGain();
    audio.sirenGain.gain.value = 0;
    audio.sirenOsc.connect(audio.sirenGain);
    audio.sirenGain.connect(audio.master);
    audio.sirenOsc.start();
    audio.sirenLfo.start();
    startMusic(audio);
  } catch {
    audio.ctx = null;
  }
}

// A laid-back groove at 100 BPM, on a 32-step loop: a bass line that walks
// down the neck, hats on the off-beats, and a sparse lead that only speaks
// every other bar. Quiet by design; M mutes everything.
const BASS_LINE = [55, 0, 0, 55, 0, 0, 65.41, 0, 49, 0, 0, 49, 0, 58.27, 0, 0, 55, 0, 0, 55, 0, 0, 65.41, 0, 82.41, 0, 0, 73.42, 0, 65.41, 0, 0];
const LEAD_LINE = [440, 0, 0, 0, 0, 0, 523.25, 0, 0, 0, 0, 0, 0, 0, 0, 0, 392, 0, 0, 0, 0, 0, 493.88, 0, 0, 0, 0, 0, 0, 0, 0, 0];
function startMusic(audio) {
  if (audio.musicTimer) return;
  audio.musicTimer = setInterval(() => {
    if (!audio.ctx || audio.muted) return;
    const step = audio.musicStep % 32;
    const bass = BASS_LINE[step];
    if (bass) blip(audio, bass, 0.28, 'triangle', 0.1);
    const lead = LEAD_LINE[step];
    if (lead) blip(audio, lead, 0.4, 'sine', 0.05);
    if (step % 2 === 1) playNoise(audio, 0.03, 0.05, 'highpass', 6000);
    audio.musicStep += 1;
  }, 300);
}

export function setEngine(audio, speed01, driving) {
  if (!audio.ctx || !audio.engineOsc) return;
  const t = audio.ctx.currentTime;
  audio.engineOsc.frequency.setTargetAtTime(50 + speed01 * 150, t, 0.08);
  audio.engineGain.gain.setTargetAtTime(driving ? 0.05 + speed01 * 0.05 : 0, t, 0.1);
}

export function setSiren(audio, closeness) {
  if (!audio.ctx || !audio.sirenGain) return;
  audio.sirenGain.gain.setTargetAtTime(closeness * 0.06, audio.ctx.currentTime, 0.2);
}

export function playShot(audio) {
  playNoise(audio, 0.12, 0.5, 'lowpass', 2800);
}

export function playCrash(audio, strength) {
  playNoise(audio, 0.18, Math.min(0.7, 0.2 + strength * 0.001), 'lowpass', 500);
}

// A wreck: a deep boom (a sine falling fast) under a burst of noise.
export function playExplosion(audio) {
  if (!audio.ctx) return;
  blip(audio, 120, 0.5, 'sine', 0.6, 35);
  playNoise(audio, 0.4, 0.5, 'lowpass', 300);
}

// Tires screaming: a short burst of bright, band-passed noise.
export function playSkid(audio) {
  playNoise(audio, 0.18, 0.12, 'bandpass', 900, 2);
}

export function playPickup(audio) {
  blip(audio, 660, 0.09, 'sine', 0.3);
  blip(audio, 990, 0.12, 'sine', 0.3, null, 0.07);
}

export function playPayday(audio) {
  const notes = [523, 659, 784, 1047];
  notes.forEach((n, i) => blip(audio, n, 0.16, 'triangle', 0.3, null, i * 0.11));
}

// The sting when the wanted level climbs: two rising notes.
export function playWanted(audio) {
  blip(audio, 392, 0.14, 'triangle', 0.3);
  blip(audio, 587, 0.22, 'triangle', 0.3, null, 0.13);
}

// A short jingle for the end screens: down for wasted, flat for busted.
export function playEnd(audio, kind) {
  const notes = kind === 'busted' ? [330, 330, 262] : [392, 330, 262, 196];
  notes.forEach((n, i) => blip(audio, n, 0.22, 'triangle', 0.3, null, i * 0.16));
}

export function playClick(audio) {
  blip(audio, 880, 0.06, 'sine', 0.2);
}

export function playSirenBlip(audio) {
  blip(audio, 700, 0.1, 'sine', 0.2, 950);
}

export function toggleMute(audio) {
  audio.muted = !audio.muted;
  if (audio.ctx && audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
  return audio.muted;
}
