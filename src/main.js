import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { buildRoom } from "./room.js";
import { buildItems } from "./items.js";
import { createExperiment } from "./experiment.js";
import * as ui from "./ui.js";
import { SPAWN, PLAYER_RADIUS, REACH } from "./constants.js";

const app = document.getElementById("app");

// ---------- Scene / Camera / Renderer ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfeaf7);
scene.fog = new THREE.Fog(0xcfeaf7, 14, 30);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 100);
camera.position.set(SPAWN.x, SPAWN.y, SPAWN.z);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = false;
app.appendChild(renderer.domElement);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- World ----------
const roomInfo = buildRoom(scene);
const registry = buildItems(scene, roomInfo);

// register sink faucets (hit targets) into the shared registry for raycasting
roomInfo.sinks.forEach((sink, i) => {
  registry.set(sink.faucetHit.userData.id, sink.faucetHit);
});
const sinkWaterMeshes = {
  [roomInfo.sinks[0].faucetHit.userData.id]: roomInfo.sinks[0].waterMesh,
  [roomInfo.sinks[1].faucetHit.userData.id]: roomInfo.sinks[1].waterMesh,
};

const experiment = createExperiment(registry);

// ---------- Pointer lock controls ----------
const controls = new PointerLockControls(camera, renderer.domElement);
const blocker = document.getElementById("blocker");
const startBtn = document.getElementById("start-btn");

startBtn.addEventListener("click", () => controls.lock());
controls.addEventListener("lock", () => blocker.classList.add("hidden"));
controls.addEventListener("unlock", () => blocker.classList.remove("hidden"));

// ---------- Movement ----------
const keys = { w: false, a: false, s: false, d: false };
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = true;
});
window.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = false;
});

const MOVE_SPEED = 3.4;
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

function collides(x, z, radius) {
  for (const c of roomInfo.colliders) {
    if (x + radius > c.minX && x - radius < c.maxX && z + radius > c.minZ && z - radius < c.maxZ) {
      return true;
    }
  }
  return false;
}

function updateMovement(dt) {
  if (!controls.isLocked) return;
  camera.getWorldDirection(_forward);
  _forward.y = 0;
  _forward.normalize();
  _right.crossVectors(_forward, _up).normalize();

  let mx = 0;
  let mz = 0;
  if (keys.w) mz += 1;
  if (keys.s) mz -= 1;
  if (keys.d) mx += 1;
  if (keys.a) mx -= 1;
  if (mx !== 0 && mz !== 0) {
    const len = Math.sqrt(2);
    mx /= len;
    mz /= len;
  }

  const dx = (_forward.x * mz + _right.x * mx) * MOVE_SPEED * dt;
  const dz = (_forward.z * mz + _right.z * mx) * MOVE_SPEED * dt;

  const obj = controls.getObject();
  const newX = obj.position.x + dx;
  const newZ = obj.position.z + dz;

  if (!collides(newX, obj.position.z, PLAYER_RADIUS)) obj.position.x = newX;
  if (!collides(obj.position.x, newZ, PLAYER_RADIUS)) obj.position.z = newZ;
}

// ---------- Interaction (pickup / drop / rotate / tap) ----------
const raycaster = new THREE.Raycaster();
raycaster.far = REACH;
const centerNDC = new THREE.Vector2(0, 0);

let heldItem = null;

function allInteractables() {
  return Array.from(registry.values());
}

function findInteractable(obj) {
  let o = obj;
  let depth = 0;
  while (o && depth < 10) {
    if (o.userData && o.userData.id) return o;
    o = o.parent;
    depth++;
  }
  return null;
}

function raycastTarget(excludeItem) {
  raycaster.setFromCamera(centerNDC, camera);
  const candidates = allInteractables().filter((o) => o !== excludeItem);
  const hits = raycaster.intersectObjects(candidates, true);
  for (const h of hits) {
    const found = findInteractable(h.object);
    if (found && found !== excludeItem) return found;
  }
  return null;
}

function pickUp(item) {
  const worldPos = new THREE.Vector3();
  item.getWorldPosition(worldPos);
  const worldQuat = new THREE.Quaternion();
  item.getWorldQuaternion(worldQuat);

  scene.remove(item);
  camera.add(item);
  item.position.set(0.32, -0.28, -0.75);
  item.quaternion.identity();
  heldItem = item;
}

function disableInteraction(obj) {
  obj.visible = false;
  obj.traverse((o) => {
    o.raycast = () => {};
  });
}

function dropAtWorld(item, worldPos) {
  camera.remove(item);
  scene.add(item);
  item.position.copy(worldPos);
}

const SINK_COUNTER_TOP = 0.9;
function restHeightOverride(target) {
  if (target && target.userData.interactType === "faucet") return SINK_COUNTER_TOP;
  return null;
}

function forwardDropPoint() {
  // simple floor-projected drop point in front of the player
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const dist = 1.3;
  const p = camera.position.clone().add(dir.multiplyScalar(dist));
  p.y = Math.max(0.05, Math.min(p.y, 1.4));
  return p;
}

renderer.domElement.addEventListener("mousedown", (e) => {
  if (e.button !== 0 || !controls.isLocked) return;
  const target = raycastTarget(heldItem);
  if (!target) return;

  if (!heldItem) {
    if (target.userData.carryable) {
      pickUp(target);
    } else {
      // direct tap action (faucet, test tube observe)
      const res = experiment.tryTap(target.userData.id);
      if (res.handled && res.water === "on") {
        const mesh = sinkWaterMeshes[res.sink];
        if (mesh) mesh.visible = true;
      }
    }
  }
});

renderer.domElement.addEventListener("mouseup", (e) => {
  if (e.button !== 0 || !controls.isLocked) return;
  if (!heldItem) return;

  const item = heldItem;
  const target = raycastTarget(item);
  const result = experiment.tryUse(item.userData.id, target ? target.userData.id : null);
  heldItem = null;

  if (result.handled) {
    if (target && result.targetConsume) {
      disableInteraction(target);
    }
    if (result.heldConsume) {
      camera.remove(item);
      disableInteraction(item);
    } else if (result.snapWorldPosition) {
      dropAtWorld(item, result.snapWorldPosition);
    } else if (target) {
      const worldPos = new THREE.Vector3();
      target.getWorldPosition(worldPos);
      const override = restHeightOverride(target);
      worldPos.y = override !== null ? override : worldPos.y + 0.02;
      worldPos.x += (Math.random() - 0.5) * 0.15;
      worldPos.z += (Math.random() - 0.5) * 0.15;
      dropAtWorld(item, worldPos);
    } else {
      dropAtWorld(item, forwardDropPoint());
    }
  } else {
    dropAtWorld(item, forwardDropPoint());
  }
});

renderer.domElement.addEventListener(
  "wheel",
  (e) => {
    if (!heldItem || !controls.isLocked) return;
    e.preventDefault();
    heldItem.rotation.y += e.deltaY * 0.0025;
  },
  { passive: false }
);

// prevent context menu interfering with click-hold on right click drag etc (not used, but keep clean)
renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());

// ---------- Hover tooltip ----------
function updateTooltip() {
  if (!controls.isLocked) {
    ui.setTooltip("");
    return;
  }
  if (heldItem) {
    const target = raycastTarget(heldItem);
    ui.setTooltip(target ? `내려놓기 → ${target.userData.name}` : "");
    return;
  }
  const target = raycastTarget(null);
  if (!target) {
    ui.setTooltip("");
    return;
  }
  const verb = target.userData.carryable ? "집기" : "상호작용";
  ui.setTooltip(`${target.userData.name} [${verb}]`);
}

// ---------- Flame flicker ----------
function animateFlame(t) {
  const lamp = registry.get("alcohol_lamp");
  const flame = lamp.getObjectByName("flame");
  if (flame && flame.visible) {
    const s = 1 + Math.sin(t * 20) * 0.08;
    flame.scale.set(s, 1 + Math.sin(t * 13) * 0.12, s);
  }
}

// ---------- Main loop ----------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  updateMovement(dt);
  experiment.update(dt);
  animateFlame(t);
  updateTooltip();

  renderer.render(scene, camera);
}
animate();
