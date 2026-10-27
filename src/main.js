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
// The camera must be part of the scene graph, otherwise objects parented to
// it (held items) are never visited by the renderer's traversal and render
// as invisible even though they have a valid parent/transform.
scene.add(camera);

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
  // cancel any in-progress fall if the player catches it off a surface
  const fallIdx = fallingItems.findIndex((f) => f.obj === item);
  if (fallIdx !== -1) fallingItems.splice(fallIdx, 1);

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

// ---------- Gravity / falling / breaking ----------
const fallingItems = []; // { obj, vy, startY, breakable }
const GRAVITY = -9.8;
const BREAK_FALL_HEIGHT = 0.5;
const downRaycaster = new THREE.Raycaster();
const DOWN = new THREE.Vector3(0, -1, 0);

function findGroundY(x, z, fromY) {
  downRaycaster.set(new THREE.Vector3(x, fromY + 0.3, z), DOWN);
  downRaycaster.far = 20;
  const hits = downRaycaster.intersectObjects(roomInfo.groundMeshes, false);
  if (hits.length) return hits[0].point.y;
  return 0; // fall back to the room floor
}

function breakItem(item) {
  const name = item.userData.name;
  ui.toast(`${name}이(가) 바닥에 떨어져 깨졌습니다!`);
  scene.remove(item);
  disableInteraction(item);

  const spawnPos = item.userData.spawnPosition;
  if (!spawnPos) return;
  setTimeout(() => {
    item.traverse((o) => delete o.raycast);
    if (item.userData.kind === "beaker") {
      item.userData.hasCabbage = false;
      item.userData.hasWater = false;
      item.userData.isExtract = false;
      const bits = item.getObjectByName("cabbageBits");
      if (bits) bits.visible = false;
      const liquid = item.getObjectByName("liquid");
      if (liquid) liquid.visible = false;
    }
    if (item.userData.kind === "bottle" && item.userData.id === "indicator_bottle") {
      item.userData.filled = false;
      const liquid = item.getObjectByName("liquid");
      if (liquid) liquid.visible = false;
    }
    item.position.copy(spawnPos);
    item.rotation.set(0, 0, 0);
    item.visible = true;
    scene.add(item);
    ui.toast(`${name}이(가) 재료실에 새로 준비되었습니다.`);
  }, 1500);
}

function startFalling(item, breakable) {
  fallingItems.push({ obj: item, vy: 0, startY: item.position.y, breakable });
}

function updateFalling(dt) {
  for (let i = fallingItems.length - 1; i >= 0; i--) {
    const f = fallingItems[i];
    f.vy += GRAVITY * dt;
    f.obj.position.y += f.vy * dt;
    const groundY = findGroundY(f.obj.position.x, f.obj.position.z, f.obj.position.y);
    if (f.obj.position.y <= groundY) {
      f.obj.position.y = groundY;
      const fallDist = f.startY - groundY;
      fallingItems.splice(i, 1);
      if (f.breakable && fallDist > BREAK_FALL_HEIGHT) {
        breakItem(f.obj);
      }
    }
  }
}

function releaseHeld() {
  if (!heldItem) return;
  const item = heldItem;
  const target = raycastTarget(item);
  const result = experiment.tryUse(item.userData.id, target ? target.userData.id : null);
  heldItem = null;

  const worldPos = new THREE.Vector3();
  item.getWorldPosition(worldPos);
  camera.remove(item);
  scene.add(item);
  item.position.copy(worldPos);

  if (result.handled && target && result.targetConsume) {
    disableInteraction(target);
  }
  if (result.handled && result.heldConsume) {
    disableInteraction(item);
    return;
  }
  if (result.handled && result.snapWorldPosition) {
    // precise, intentional placement (e.g. beaker onto the tripod) — no physics
    item.position.copy(result.snapWorldPosition);
    return;
  }

  if (target) {
    const tp = new THREE.Vector3();
    target.getWorldPosition(tp);
    item.position.x = tp.x;
    item.position.z = tp.z;
  } else {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const dropPoint = camera.position.clone().add(dir.multiplyScalar(1.3));
    item.position.x = dropPoint.x;
    item.position.z = dropPoint.z;
  }
  startFalling(item, !!item.userData.breakable);
}

renderer.domElement.addEventListener("mousedown", (e) => {
  if (!controls.isLocked) return;

  if (e.button === 0) {
    // left click: pick up a carryable item, or tap a fixed one (faucet, test tube)
    if (heldItem) return;
    const target = raycastTarget(null);
    if (!target) return;
    if (target.userData.carryable) {
      pickUp(target);
    } else {
      const res = experiment.tryTap(target.userData.id);
      if (res.handled && res.water === "on") {
        const mesh = sinkWaterMeshes[res.sink];
        if (mesh) mesh.visible = true;
      }
    }
  } else if (e.button === 2) {
    // right click: drop / use the held item on whatever is targeted
    releaseHeld();
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

// right-click drops instead of opening the browser context menu
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

// ---------- Burn hazard ----------
const BURN_RADIUS = 1.3;
const BURN_COOLDOWN = 2.0;
let lastBurnTime = -Infinity;
function updateBurnCheck(t) {
  if (!experiment.state.lampLit) return;
  const lamp = registry.get("alcohol_lamp");
  const dist = camera.position.distanceTo(lamp.position);
  if (dist < BURN_RADIUS && t - lastBurnTime > BURN_COOLDOWN) {
    lastBurnTime = t;
    ui.toast("뜨거워요! 화상을 입었습니다. 불에서 떨어지세요!");
    ui.flashBurn();
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
  updateFalling(dt);
  animateFlame(t);
  updateBurnCheck(t);
  updateTooltip();

  renderer.render(scene, camera);
}
animate();
