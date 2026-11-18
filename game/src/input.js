// input.js — keyboard and mouse state. The game reads `keys` for held keys
// and `pressed` for the single frame a key went down, so taps (interact,
// weapon swap, time skip) never repeat while the key is held.

export function createInput() {
  const keys = {};
  const pressed = {};
  const mouse = { x: 0, y: 0, down: false, clicked: false, canvasX: 0, canvasY: 0 };

  function onKeyDown(e) {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!keys[k]) pressed[k] = true;
    keys[k] = true;
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
    }
  }

  function onKeyUp(e) {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    keys[k] = false;
  }

  function onMouseMove(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }

  function onMouseDown(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (e.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  }

  function onMouseUp(e) {
    if (e.button === 0) mouse.down = false;
  }

  function onBlur() {
    for (const k of Object.keys(keys)) keys[k] = false;
  }

  return {
    keys,
    pressed,
    mouse,
    attach() {
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('blur', onBlur);
    },
    detach() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('blur', onBlur);
    },
    // Call once per frame, after the update, to clear the edge triggers.
    endFrame() {
      for (const k of Object.keys(pressed)) delete pressed[k];
      mouse.clicked = false;
    },
    isDown(...names) {
      return names.some((n) => keys[n]);
    },
    wasPressed(...names) {
      return names.some((n) => pressed[n]);
    },
    // A normalized movement vector from WASD or the arrow keys.
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.a || keys.ArrowLeft) x -= 1;
      if (keys.d || keys.ArrowRight) x += 1;
      if (keys.w || keys.ArrowUp) y -= 1;
      if (keys.s || keys.ArrowDown) y += 1;
      if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      return { x, y };
    },
  };
}
