// Keyboard and mouse, as one binding table. Held keys drive movement and
// driving; one-shot presses (start, pause, enter a car, punch, mute) set a
// bit that the loop takes once per frame, so a press between frames is never
// lost. The mouse aims on foot and fires while held.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export const ACTION_RESTART = 32;

// code -> what it does. 'hold' keys set a flag while down; 'tap' keys queue
// an action bit on the first press (repeats ignored).
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
  KeyM: { tap: ACTION_MUTE },
  KeyR: { tap: ACTION_RESTART },
};

export function createInput(target) {
  const held = { up: false, down: false, left: false, right: false, sprint: false, handbrake: false };
  const mouse = { x: 0, y: 0, down: false };
  let actions = 0;

  function trackPointer(event) {
    const rect = target.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }

  function releaseAll() {
    for (const key of Object.keys(held)) held[key] = false;
    mouse.down = false;
  }

  window.addEventListener('keydown', (event) => {
    const binding = BINDINGS[event.code];
    if (!binding) return;
    if (binding.hold) held[binding.hold] = true;
    if (binding.tap && !event.repeat) actions |= binding.tap;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    const binding = BINDINGS[event.code];
    if (binding && binding.hold) held[binding.hold] = false;
  });
  window.addEventListener('blur', releaseAll);
  target.addEventListener('pointermove', trackPointer);
  target.addEventListener('pointerdown', (event) => {
    trackPointer(event);
    mouse.down = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });

  return {
    mouse,
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
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
