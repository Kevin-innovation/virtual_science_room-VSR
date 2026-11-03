import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { buildRoom } from "./room.js";
import { buildItems } from "./items.js";
import { createExperiment } from "./experiment.js";
import * as ui from "./ui.js";
import { ROOM, SPAWN, PLAYER_RADIUS, REACH } from "./constants.js";

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
const keys = { w: false, a: false, s: false, d: false, q: false, e: false, shift: false };
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = true;
});
window.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = false;
});

const MOVE_SPEED = 3.4;
const RUN_SPEED = 6.0;
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

  const speed = keys.shift ? RUN_SPEED : MOVE_SPEED;
  const dx = (_forward.x * mz + _right.x * mx) * speed * dt;
  const dz = (_forward.z * mz + _right.z * mx) * speed * dt;

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

let heldItem = null; // active item: the last one picked up; wheel, Q/E and right-click act on it
const heldItems = []; // everything in hand, in pickup order
const wornItems = []; // equipped with F

function allInteractables() {
  return Array.from(registry.values()).filter((o) => !heldItems.includes(o) && !wornItems.includes(o));
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
  // an item mid-pour belongs to the animation until it lands
  if (pours.some((p) => p.item === item)) return;
  // cancel any in-progress fall if the player catches it off a surface
  const fallIdx = fallingItems.findIndex((f) => f.obj === item);
  if (fallIdx !== -1) fallingItems.splice(fallIdx, 1);

  scene.remove(item);
  camera.add(item);
  item.quaternion.identity();
  heldItems.push(item);
  heldItem = item;
  layoutHand();
}

// items in hand fan out to the right, each one a step further left and back
const HAND_POS = new THREE.Vector3(0.32, -0.28, -0.75);
const HAND_STEP = new THREE.Vector3(-0.14, 0, -0.06);
function layoutHand() {
  heldItems.forEach((it, i) => it.position.copy(HAND_POS).addScaledVector(HAND_STEP, i));
}

function removeFromHand(item) {
  heldItems.splice(heldItems.indexOf(item), 1);
  heldItem = heldItems[heldItems.length - 1] ?? null;
  layoutHand();
}

// Wearables are carried until F puts them on. Worn items sit fixed in view.
const WORN_POSE = {
  goggles: [0, 0.02, -0.25],
  coated_gloves: [-0.3, -0.3, -0.5],
  lab_gloves: [-0.18, -0.3, -0.5],
};
function wearHeld() {
  if (!controls.isLocked || !heldItem || heldItem.userData.kind !== "wearable") return;
  const item = heldItem;
  removeFromHand(item);
  const [x, y, z] = WORN_POSE[item.userData.id] ?? [0, 0, -0.3];
  item.position.set(x, y, z);
  item.quaternion.identity();
  wornItems.push(item);
  ui.toast(`${item.userData.name}을(를) 착용했습니다.`);
}
window.addEventListener("keydown", (e) => {
  if (!e.repeat && e.key.toLowerCase() === "f") wearHeld();
});

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
// Fixed fixtures (lamp, tripod, tubes, sink, rack) have no ground surface, so a
// straight drop onto them would fall right through. Land just in front instead.
const FIXTURE_DROP_OFFSET = 0.2;
const DROP_MARGIN = PLAYER_RADIUS;

function clampToRoom(pos) {
  pos.x = THREE.MathUtils.clamp(pos.x, ROOM.minX + DROP_MARGIN, ROOM.maxX - DROP_MARGIN);
  pos.z = THREE.MathUtils.clamp(pos.z, ROOM.minZ + DROP_MARGIN, ROOM.maxZ - DROP_MARGIN);
}
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

// ---------- Pour animation (solution / indicator into a test tube) ----------
const pours = []; // { item, target, t, from, rot0, pose, tp }
const POUR_IN = 0.25; // seconds to move over the tube
const POUR_HOLD = 0.8; // seconds of tilting
const POUR_TILT = 0.5; // radians
const POUR_REACH = 0.25; // bottle mouth height above its origin
const POUR_OUT = 0.35; // seconds to stand the bottle back up beside the tube
const DRIP_INTERVAL = 0.12; // seconds between droplets while tilted
const DROP_FALL_TIME = 0.35;
const dropGeo = new THREE.SphereGeometry(0.012, 8, 6);
const drops = []; // { mesh, t, from, to }

function startPour(item, target) {
  const tp = new THREE.Vector3();
  target.getWorldPosition(tp);
  // tilt the bottle so its mouth (not its base) ends up above the tube
  const pose = new THREE.Vector3(tp.x + POUR_REACH * Math.sin(POUR_TILT), tp.y + 0.3, tp.z);
  // where the bottle is finally set down: on the desk, beside the tube
  const setDown = new THREE.Vector3(tp.x, tp.y - 0.03, tp.z + FIXTURE_DROP_OFFSET);
  pours.push({ item, t: 0, from: item.position.clone(), rot0: item.rotation.z, pose, setDown, tp });
}

function spawnDrop(p) {
  const color = p.item.getObjectByName("liquid")?.material.color.getHex() ?? 0xffffff;
  const mesh = new THREE.Mesh(dropGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.2 }));
  // the tilted bottle's mouth is directly over the tube
  mesh.position.set(p.tp.x, p.tp.y + 0.3 + POUR_REACH * Math.cos(POUR_TILT), p.tp.z);
  scene.add(mesh);
  drops.push({ mesh, t: 0, from: mesh.position.y, to: p.tp.y + 0.2 });
}

function updateDrops(dt) {
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.t += dt;
    const k = Math.min(d.t / DROP_FALL_TIME, 1);
    d.mesh.position.y = d.from + (d.to - d.from) * k * k; // accelerates like gravity
    if (k >= 1) {
      scene.remove(d.mesh);
      d.mesh.material.dispose();
      drops.splice(i, 1);
    }
  }
}

function updatePours(dt) {
  for (let i = pours.length - 1; i >= 0; i--) {
    const p = pours[i];
    p.t += dt;
    if (p.t < POUR_IN) {
      const k = p.t / POUR_IN;
      p.item.position.lerpVectors(p.from, p.pose, k);
      p.item.rotation.z = p.rot0 + (POUR_TILT - p.rot0) * k;
    } else if (p.t < POUR_IN + POUR_HOLD) {
      p.item.position.copy(p.pose);
      p.item.rotation.z = POUR_TILT + Math.sin((p.t - POUR_IN) * 12) * 0.12;
      p.dripTimer = (p.dripTimer ?? 0) - dt;
      if (p.dripTimer <= 0) {
        spawnDrop(p);
        p.dripTimer += DRIP_INTERVAL;
      }
    } else if (p.t < POUR_IN + POUR_HOLD + POUR_OUT) {
      // stand the bottle back up beside the tube, without dropping it
      const k = (p.t - POUR_IN - POUR_HOLD) / POUR_OUT;
      p.item.position.lerpVectors(p.pose, p.setDown, k);
      p.item.rotation.z = POUR_TILT * (1 - k);
    } else {
      pours.splice(i, 1);
      p.item.position.copy(p.setDown);
      p.item.rotation.z = 0;
    }
  }
  updateDrops(dt);
}

// Q/E turn the held item left/right (around Y); scroll tilts it up/down (around X)
const HELD_TURN_SPEED = 2.5; // radians per second
function updateHeldRotation(dt) {
  if (!heldItem) return;
  if (keys.q) heldItem.rotation.y += HELD_TURN_SPEED * dt;
  if (keys.e) heldItem.rotation.y -= HELD_TURN_SPEED * dt;
}

function releaseHeld() {
  if (!heldItem) return;
  const item = heldItem;
  const target = raycastTarget(item);
  const result = experiment.tryUse(item.userData.id, target ? target.userData.id : null);
  removeFromHand(item);

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
  if (result.handled && result.pour && target) {
    startPour(item, target);
    return;
  }

  if (target) {
    const tp = new THREE.Vector3();
    target.getWorldPosition(tp);
    item.position.x = tp.x;
    // non-carryable targets have no surface to land on; drop in front of them
    item.position.z = target.userData.carryable ? tp.z : tp.z + FIXTURE_DROP_OFFSET;
  } else {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const dropPoint = camera.position.clone().add(dir.multiplyScalar(1.3));
    item.position.x = dropPoint.x;
    item.position.z = dropPoint.z;
  }
  clampToRoom(item.position);
  startFalling(item, !!item.userData.breakable);
}

renderer.domElement.addEventListener("mousedown", (e) => {
  if (!controls.isLocked) return;

  if (e.button === 0) {
    // left click: pick up a carryable item (more can be added to hand), or tap a fixed one (faucet, test tube)
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
    heldItem.rotation.x += e.deltaY * 0.0025;
  },
  { passive: false }
);

// right-click drops instead of opening the browser context menu
renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());

// ---------- Hover tooltip ----------
function updateTooltip() {
  const hover = controls.isLocked ? raycastTarget(null) : null;
  updateLabels(hover);
  if (!controls.isLocked) {
    ui.setTooltip("");
    return;
  }
  if (heldItem) {
    if (heldItem.userData.kind === "wearable") {
      ui.setTooltip(`${heldItem.userData.name} [F 착용]`);
      return;
    }
    ui.setTooltip(hover ? `내려놓기 → ${hover.userData.name}` : "");
    return;
  }
  if (!hover) {
    ui.setTooltip("");
    return;
  }
  const verb = hover.userData.carryable ? "집기" : "상호작용";
  ui.setTooltip(`${hover.userData.name} [${verb}]`);
}

// supply items sit close together, so their name labels only show on the item being looked at
function updateLabels(hover) {
  for (const o of registry.values()) {
    if (!o.userData.carryable) continue;
    const label = o.getObjectByName("label");
    if (label) label.visible = o === hover;
  }
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
  updateHeldRotation(dt);
  experiment.update(dt);
  updatePours(dt);
  updateFalling(dt);
  animateFlame(t);
  updateBurnCheck(t);
  updateTooltip();

  renderer.render(scene, camera);
}
animate();
