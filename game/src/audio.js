// audio.js — every sound is synthesized with WebAudio: no audio files, no
// network. An engine hum follows the car's speed, a two-tone siren wails
// when the police are near, and one-shots cover shots, punches and menus.
// The context starts on the first user gesture, as browsers require.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let muted = false;
  let noiseBuffer = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      const len = ctx.sampleRate * 0.5;
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      return true;
    } catch (e) {
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  return {
    get muted() {
      return muted;
    },
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    shot() {
      noise(0.16, 0.5, 900);
      blip(120, 0.12, 'square', 0.25, 40);
    },
    punch() {
      noise(0.08, 0.3, 500);
      blip(90, 0.08, 'sine', 0.3, 50);
    },
    crash() {
      noise(0.25, 0.4, 700);
      blip(70, 0.2, 'sawtooth', 0.2, 30);
    },
    pickup() {
      blip(660, 0.09, 'sine', 0.25);
      setTimeout(() => blip(990, 0.12, 'sine', 0.25), 70);
    },
    cash() {
      blip(880, 0.08, 'triangle', 0.25);
      setTimeout(() => blip(1174, 0.14, 'triangle', 0.25), 80);
    },
    uiClick() {
      blip(520, 0.06, 'sine', 0.18);
    },
    denied() {
      blip(180, 0.15, 'square', 0.15, 120);
    },
    missionStart() {
      blip(392, 0.12, 'triangle', 0.25);
      setTimeout(() => blip(523, 0.12, 'triangle', 0.25), 110);
      setTimeout(() => blip(659, 0.18, 'triangle', 0.25), 220);
    },
    missionDone() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((n, i) => setTimeout(() => blip(n, 0.18, 'triangle', 0.25), i * 110));
    },
    wasted() {
      blip(330, 0.3, 'sawtooth', 0.2, 110);
      setTimeout(() => blip(220, 0.4, 'sawtooth', 0.2, 80), 250);
    },
    horn() {
      blip(370, 0.18, 'square', 0.12);
      blip(466, 0.18, 'square', 0.1);
    },
    // The engine loop: call every frame with speed 0..1 while driving.
    engine(speed01, driving) {
      if (!ensure()) return;
      if (!driving || muted) {
        if (engineGain) engineGain.gain.value = 0;
        return;
      }
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 600;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      engineOsc.frequency.value = 55 + speed01 * 130;
      engineGain.gain.value = 0.05 + speed01 * 0.06;
    },
    // The siren loop: call every frame; wails while any cop is near.
    siren(active, dt) {
      if (!ensure()) return;
      if (!active || muted) {
        if (sirenGain) sirenGain.gain.value = 0;
        return;
      }
      if (!sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'triangle';
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
      }
      sirenTimer += dt;
      if (sirenTimer > 0.45) {
        sirenTimer = 0;
        sirenHigh = !sirenHigh;
      }
      sirenOsc.frequency.value = sirenHigh ? 880 : 660;
      sirenGain.gain.value = 0.045;
    },
  };
}
