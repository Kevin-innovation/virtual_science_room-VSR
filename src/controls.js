// First-person look. Desktop uses mouse pointer lock; touch screens use drag (see touch.js).
// The yaw lives on the player rig and the pitch on the camera.
const PITCH_LIMIT = Math.PI / 2 - 0.08;
const MOUSE_SENS = 0.002;

export function createControls({ canvas, rig, camera, onLockChange }) {
  let yaw = 0;
  let pitch = 0;
  let touch = false;
  let started = false;

  function apply() {
    rig.rotation.y = yaw;
    camera.rotation.x = pitch;
  }

  function look(dx, dy, sens) {
    yaw -= dx * sens;
    pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch - dy * sens));
    apply();
  }

  document.addEventListener("pointerlockchange", () => {
    if (touch) return;
    onLockChange(document.pointerLockElement === canvas);
  });
  document.addEventListener("mousemove", (e) => {
    if (!touch && document.pointerLockElement === canvas) look(e.movementX, e.movementY, MOUSE_SENS);
  });

  return {
    get yaw() {
      return yaw;
    },
    look,
    setTouch(v) {
      touch = v;
    },
    isLocked() {
      return touch ? started : document.pointerLockElement === canvas;
    },
    start() {
      if (touch) {
        started = true;
        onLockChange(true);
      } else {
        canvas.requestPointerLock();
      }
    },
  };
}
