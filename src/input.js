// One shared input state for keyboard and touch, so both drive the same actions.
const keys = Object.create(null);

// Touch: the virtual joystick (movement) and the rotation stick (held item).
export const joy = { x: 0, y: 0 }; // x: right(+)/left(-), y: forward(+)/back(-), each -1..1
export const rotStick = { x: 0, y: 0 }; // x: left(-)/right(+) turns, y: up(+)/down(-) tilts
export const runToggle = { on: false }; // on-screen "달리기" button

const MOVE_KEYS = {
  w: [0, 1],
  s: [0, -1],
  a: [-1, 0],
  d: [1, 0],
  arrowup: [0, 1],
  arrowdown: [0, -1],
  arrowleft: [-1, 0],
  arrowright: [1, 0],
};

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (k.startsWith("arrow") || k === " ") e.preventDefault();
});
window.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});
// Releasing keys while the window is unfocused would otherwise leave them stuck on.
window.addEventListener("blur", () => {
  for (const k in keys) keys[k] = false;
});

const clamp1 = (v) => Math.max(-1, Math.min(1, v));

// Keyboard + joystick movement, as a combined axis pair.
export function moveAxes() {
  let x = joy.x;
  let y = joy.y;
  for (const k in MOVE_KEYS) {
    if (keys[k]) {
      x += MOVE_KEYS[k][0];
      y += MOVE_KEYS[k][1];
    }
  }
  return { x: clamp1(x), y: clamp1(y) };
}

// +1 turns the held item left (Q), -1 turns it right (E). The rotation stick is analog.
export function turnAxis() {
  let t = 0;
  if (keys.q) t += 1;
  if (keys.e) t -= 1;
  return clamp1(t - rotStick.x);
}

// +1 tilts the held item up, -1 tilts it down (keys: wheel-equivalent for keyboard users).
export function tiltAxis() {
  return clamp1(rotStick.y);
}

export function isRunning() {
  return !!keys.shift || runToggle.on;
}
