// Touch controls (PART_5): a compact set of round buttons so the view stays draggable.
//   - move joystick (bottom, one side)
//   - rotation stick: drag left/right to turn the held item, up/down to tilt it
//   - action button: 집기/놓기 (tap). Long-press while holding to add one more item.
//   - run toggle
//   - top-right: left-handed mode (mirrors the joystick and buttons to the other side)
// Every control is its own round element, so each one's touch area is exactly its circle.
import { joy, rotStick, runToggle } from "./input.js";

const LEFTY_KEY = "vsr-lefty-mode";
const JOY_RADIUS = 48;
const ROT_RADIUS = 40;
const LONG_PRESS_MS = 450;
const TOUCH_LOOK_SENS = 0.006;

let lefty = false;
try {
  lefty = localStorage.getItem(LEFTY_KEY) === "1";
} catch {
  // storage can be unavailable (private mode); the default layout still works
}

export function isLefty() {
  return lefty;
}

function saveLefty() {
  try {
    localStorage.setItem(LEFTY_KEY, lefty ? "1" : "0");
  } catch {
    // ignore: the choice just won't be remembered
  }
}

export function applyLefty() {
  document.body.classList.toggle("lefty", lefty);
  const label = `왼손잡이 모드: ${lefty ? "ON" : "OFF"}`;
  const top = document.getElementById("lefty-top");
  if (top) top.textContent = lefty ? "왼손 ON" : "왼손";
  const btn = document.getElementById("lefty-btn");
  if (btn) btn.textContent = label;
}

// Drag a round knob inside its ring; writes the normalised position into `out`.
function bindStick(baseEl, knobEl, radius, out, onMove) {
  let id = null;
  let cx = 0;
  let cy = 0;
  const move = (e) => {
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > radius) {
      dx *= radius / len;
      dy *= radius / len;
    }
    out.x = dx / radius;
    out.y = -dy / radius; // screen up is positive
    knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    if (onMove) onMove();
  };
  baseEl.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    id = e.pointerId;
    baseEl.setPointerCapture(e.pointerId);
    const r = baseEl.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    move(e);
  });
  baseEl.addEventListener("pointermove", (e) => {
    if (e.pointerId === id) move(e);
  });
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    out.x = 0;
    out.y = 0;
    knobEl.style.transform = "translate(-50%, -50%)";
  };
  baseEl.addEventListener("pointerup", end);
  baseEl.addEventListener("pointercancel", end);
}

export function setupTouch({ controls, onTap, onLongPress, onLeftyChange }) {
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  controls.setTouch(isTouch);
  document.body.classList.toggle("is-touch", isTouch);
  applyLefty();
  if (!isTouch) return { isTouch };

  document.getElementById("touch-ui").classList.remove("hidden");
  document.getElementById("lefty-row").classList.remove("hidden");

  const toggleLefty = () => {
    lefty = !lefty;
    saveLefty();
    applyLefty();
    onLeftyChange();
  };
  document.getElementById("lefty-top").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    toggleLefty();
  });
  document.getElementById("lefty-btn").addEventListener("click", toggleLefty);

  // move joystick
  bindStick(document.getElementById("joystick"), document.getElementById("joy-knob"), JOY_RADIUS, joy);

  // rotation stick: the item's turn/tilt is read every frame from rotStick
  bindStick(document.getElementById("rot-stick"), document.getElementById("rot-knob"), ROT_RADIUS, rotStick);

  // action button: tap = 집기/놓기; long press = pick up one more item while holding
  const act = document.getElementById("act-btn");
  let actId = null;
  let actTimer = null;
  let actLong = false;
  act.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    actId = e.pointerId;
    actLong = false;
    act.setPointerCapture(e.pointerId);
    act.classList.add("on");
    actTimer = setTimeout(() => {
      actLong = true;
      onLongPress();
    }, LONG_PRESS_MS);
  });
  const endAct = (e, fire) => {
    if (e.pointerId !== actId) return;
    clearTimeout(actTimer);
    act.classList.remove("on");
    actId = null;
    if (fire && !actLong) onTap();
  };
  act.addEventListener("pointerup", (e) => endAct(e, true));
  act.addEventListener("pointercancel", (e) => endAct(e, false));

  // run toggle
  const run = document.getElementById("run-btn");
  run.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    runToggle.on = !runToggle.on;
    run.classList.toggle("on", runToggle.on);
  });

  // camera drag: anywhere on the view that no button covers
  const look = document.getElementById("touch-look");
  let lookId = null;
  let lx = 0;
  let ly = 0;
  look.addEventListener("pointerdown", (e) => {
    if (!controls.isLocked()) return;
    lookId = e.pointerId;
    lx = e.clientX;
    ly = e.clientY;
    look.setPointerCapture(e.pointerId);
  });
  look.addEventListener("pointermove", (e) => {
    if (e.pointerId !== lookId) return;
    controls.look(e.clientX - lx, e.clientY - ly, TOUCH_LOOK_SENS);
    lx = e.clientX;
    ly = e.clientY;
  });
  const endLook = (e) => {
    if (e.pointerId === lookId) lookId = null;
  };
  look.addEventListener("pointerup", endLook);
  look.addEventListener("pointercancel", endLook);

  return { isTouch };
}
