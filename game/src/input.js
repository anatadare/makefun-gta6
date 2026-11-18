// Keyboard and mouse, behind one binding table. Held keys drive movement
// and driving; one-shot presses (confirm, pause, enter a car, punch, swap
// weapon, skip time, mute, restart) queue a bit the loop takes once per
// frame, so a press that lands between frames is never lost. The mouse
// aims on foot and fires while held down.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export const ACTION_RESTART = 32;
export const ACTION_SWAP = 64;
export const ACTION_TIME = 128;

// code -> what it does. A 'hold' key sets a flag while it is down; a 'tap'
// key queues an action bit on the first press (key repeats ignored).
const BINDINGS = {
  ArrowUp: { hold: 'up' },
  KeyW: { hold: 'up' },
  ArrowDown: { hold: 'down' },
  KeyS: { hold: 'down' },
  ArrowLeft: { hold: 'left' },
  KeyA: { hold: 'left' },
  ArrowRight: { hold: 'right' },
  KeyD: { hold: 'right' },
  ShiftLeft: { hold: 'sprint' },
  ShiftRight: { hold: 'sprint' },
  Space: { hold: 'handbrake', tap: ACTION_CONFIRM },
  Enter: { tap: ACTION_CONFIRM },
  KeyP: { tap: ACTION_PAUSE },
  Escape: { tap: ACTION_PAUSE },
  KeyE: { tap: ACTION_ENTER },
  KeyF: { tap: ACTION_PUNCH },
  KeyQ: { tap: ACTION_SWAP },
  KeyN: { tap: ACTION_TIME },
  KeyM: { tap: ACTION_MUTE },
  KeyR: { tap: ACTION_RESTART },
};

export function createInput(target) {
  const held = {
    up: false, down: false, left: false, right: false,
    sprint: false, handbrake: false,
  };
  const mouse = { x: 0, y: 0, down: false };
  let queued = 0;

  function trackPointer(event) {
    const rect = target.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }

  // Losing focus lets go of everything: no stuck keys after alt-tab.
  function releaseAll() {
    for (const name of Object.keys(held)) held[name] = false;
    mouse.down = false;
  }

  function onKeyDown(event) {
    const binding = BINDINGS[event.code];
    if (!binding) return;
    if (binding.hold) held[binding.hold] = true;
    if (binding.tap && !event.repeat) queued |= binding.tap;
    event.preventDefault();
  }

  function onKeyUp(event) {
    const binding = BINDINGS[event.code];
    if (binding && binding.hold) held[binding.hold] = false;
  }

  function onPointerDown(event) {
    trackPointer(event);
    mouse.down = true;
    queued |= ACTION_CONFIRM;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', releaseAll);
  window.addEventListener('pointerup', () => { mouse.down = false; });
  target.addEventListener('pointermove', trackPointer);
  target.addEventListener('pointerdown', onPointerDown);

  return {
    mouse,
    // A unit vector in the direction the movement keys point, or zero.
    move() {
      const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      const y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      const len = Math.hypot(x, y) || 1;
      return { x: x / len, y: y / len };
    },
    throttle() {
      return (held.up ? 1 : 0) - (held.down ? 1 : 0);
    },
    steer() {
      return (held.right ? 1 : 0) - (held.left ? 1 : 0);
    },
    sprint() {
      return held.sprint;
    },
    handbrake() {
      return held.handbrake;
    },
    // Take the queued one-shot actions and clear them.
    takeActions() {
      const taken = queued;
      queued = 0;
      return taken;
    },
  };
}
