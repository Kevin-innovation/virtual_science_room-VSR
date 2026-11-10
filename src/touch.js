// On-screen controls for touch devices: joystick (move), drag (look), and action buttons.
// Left-handed mode mirrors the layout so the joystick and buttons swap sides.
import { joy, hold, runToggle } from "./input.js";

const LEFTY_KEY = "vsr-lefty-mode";
const JOY_RADIUS = 55;
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
  const btn = document.getElementById("lefty-btn");
  if (btn) btn.textContent = `왼손잡이 모드: ${lefty ? "ON" : "OFF"}`;
}

export function setupTouch({ controls, onPrimary, onSecondary, onView, onLeftyChange }) {
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  controls.setTouch(isTouch);
  document.body.classList.toggle("is-touch", isTouch);
  applyLefty();
  if (!isTouch) return { isTouch };

  document.getElementById("touch-ui").classList.remove("hidden");
  document.getElementById("lefty-row").classList.remove("hidden");

  const runBtn = document.querySelector('[data-act="run"]');

  // Action buttons fire on press (not on release) so they respond immediately.
  for (const btn of document.querySelectorAll("[data-act]")) {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      switch (btn.dataset.act) {
        case "primary":
          onPrimary();
          break;
        case "secondary":
          onSecondary();
          break;
        case "view":
          onView();
          break;
        case "run":
          runToggle.on = !runToggle.on;
          runBtn.classList.toggle("on", runToggle.on);
          break;
        case "lefty":
          lefty = !lefty;
          saveLefty();
          applyLefty();
          onLeftyChange();
          break;
        default:
          break;
      }
    });
  }

  // Hold buttons (turn / tilt) act only while pressed.
  for (const btn of document.querySelectorAll("[data-hold]")) {
    const key = btn.dataset.hold;
    const release = () => {
      hold[key] = false;
      btn.classList.remove("on");
    };
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      hold[key] = true;
      btn.classList.add("on");
      btn.setPointerCapture?.(e.pointerId);
    });
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointercancel", release);
    btn.addEventListener("lostpointercapture", release);
  }

  // Joystick: the knob follows the thumb, clamped to the ring.
  const stick = document.getElementById("joystick");
  const knob = document.getElementById("joy-knob");
  let stickId = null;
  let cx = 0;
  let cy = 0;
  const moveKnob = (e) => {
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > JOY_RADIUS) {
      dx *= JOY_RADIUS / len;
      dy *= JOY_RADIUS / len;
    }
    joy.x = dx / JOY_RADIUS;
    joy.y = -dy / JOY_RADIUS; // screen up is forward
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  };
  stick.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    stickId = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    const r = stick.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    moveKnob(e);
  });
  stick.addEventListener("pointermove", (e) => {
    if (e.pointerId === stickId) moveKnob(e);
  });
  const endStick = (e) => {
    if (e.pointerId !== stickId) return;
    stickId = null;
    joy.x = 0;
    joy.y = 0;
    knob.style.transform = "translate(-50%, -50%)";
  };
  stick.addEventListener("pointerup", endStick);
  stick.addEventListener("pointercancel", endStick);

  // Dragging anywhere else on the view turns the camera.
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

  // Left-handed toggle on the start screen
  document.getElementById("lefty-btn").addEventListener("click", () => {
    lefty = !lefty;
    saveLefty();
    applyLefty();
    onLeftyChange();
  });

  return { isTouch };
}
