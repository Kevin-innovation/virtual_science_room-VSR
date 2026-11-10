import * as THREE from "three";
import { buildRoom } from "./room.js";
import { buildItems, setLevel } from "./items.js";
import { createExperiment } from "./experiment.js";
import { createEffects } from "./effects.js";
import { createWorld, isShown } from "./world.js";
import { createControls } from "./controls.js";
import { moveAxes, turnAxis, tiltAxis, isRunning } from "./input.js";
import { setupTouch, isLefty } from "./touch.js";
import * as ui from "./ui.js";
import { SPAWN, PLAYER_RADIUS, REACH, SHOWER } from "./constants.js";

const app = document.getElementById("app");

// ---------- Scene / camera / renderer ----------
// PART_5: white lighting. A pale background, and a fog that only softens the far scenery.
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f8fb);
scene.fog = new THREE.Fog(0xf4f8fb, 22, 70);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 100);
camera.position.set(0, SPAWN.y, 0);

// The player rig holds the yaw; the camera holds the pitch and eye height. The camera
// must be in the scene graph, otherwise objects parented to it (held items) are never drawn.
const rig = new THREE.Group();
rig.position.set(SPAWN.x, 0, SPAWN.z);
rig.add(camera);
scene.add(rig);

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

// the one faucet is a hit target; its water stream and fill pose come along with it
const sinkInfo = {};
roomInfo.sinks.forEach((sink) => {
  const id = sink.faucetHit.userData.id;
  registry.set(id, sink.faucetHit);
  sinkInfo[id] = { stream: sink.waterMesh, fillPose: sink.fillPose };
});
registry.set("shower_button", roomInfo.showerButton);

const world = createWorld({ scene, registry, roomInfo });
world.settleAll();
const experiment = createExperiment(registry);
const fx = createEffects({ scene, registry });

// ---------- Controls ----------
const blocker = document.getElementById("blocker");
const startBtn = document.getElementById("start-btn");

function onLockChange(locked) {
  blocker.classList.toggle("hidden", locked);
}

const controls = createControls({ canvas: renderer.domElement, rig, camera, onLockChange });
startBtn.addEventListener("click", () => controls.start());

// ---------- Hands: items held in the right hand (mirrored in left-handed mode) ----------
const HAND_POS = new THREE.Vector3(0.3, -0.42, -0.62); // relative to the camera
const HAND_STEP = new THREE.Vector3(-0.14, 0, -0.06); // each extra item fans out
const heldItems = []; // everything in hand, in pickup order
let heldItem = null; // the last one picked up; wheel, Q/E and the use action act on it

const handRoot = new THREE.Object3D();
camera.add(handRoot);

// First-person arms, drawn at the bottom of the view
const skinMat = new THREE.MeshStandardMaterial({ color: 0xf1c7a0, roughness: 0.7 });
const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x3f7fd6, roughness: 0.8 });
function makeFpArm() {
  const pivot = new THREE.Group();
  const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.1), sleeveMat);
  forearm.position.y = -0.21;
  pivot.add(forearm);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.12), skinMat);
  hand.position.y = -0.46;
  pivot.add(hand);
  pivot.rotation.x = 0.6;
  return pivot;
}
const fpArmR = makeFpArm();
const fpArmL = makeFpArm();
camera.add(fpArmR, fpArmL);

function handSide() {
  return isLefty() ? -1 : 1;
}

function layoutHand() {
  const side = handSide();
  heldItems.forEach((it, i) => {
    if (!it.userData.slot) it.userData.slot = new THREE.Vector3();
    it.userData.slot.copy(HAND_POS).addScaledVector(HAND_STEP, i);
    it.userData.slot.x *= side;
  });
}

function applyHandSide() {
  const s = handSide();
  fpArmR.position.set(0.34 * s, -0.14, -0.18);
  fpArmL.position.set(-0.34 * s, -0.14, -0.18);
  layoutHand();
}

function updateHand(dt, t) {
  const k = 1 - Math.exp(-dt * 14);
  for (const it of heldItems) it.position.lerp(it.userData.slot, k);

  // hands rubbing under the water while the shower runs
  const washing = fx.state.washing > 0 || fx.state.showering > 0;
  if (washing) {
    handRoot.position.set(Math.sin(t * 16) * 0.035, Math.cos(t * 16) * 0.02, 0);
    fpArmR.rotation.x = 0.9 + Math.sin(t * 16) * 0.25;
    fpArmL.rotation.x = 0.9 + Math.sin(t * 16 + Math.PI) * 0.25;
  } else {
    handRoot.position.set(0, 0, 0);
    fpArmR.rotation.x = 0.6;
    fpArmL.rotation.x = 0.6;
  }
}

const _eyeTarget = new THREE.Vector3();
function updateView(dt, t) {
  // first person only; a small sway while the shower runs
  _eyeTarget.set(0, SPAWN.y, 0);
  if (fx.state.showering > 0) _eyeTarget.x += Math.sin(t * 6) * 0.03;
  camera.position.lerp(_eyeTarget, 1 - Math.exp(-dt * 10));
}

// ---------- Movement ----------
const MOVE_SPEED = 3.4;
const RUN_SPEED = 6.0;
let moving = false;

function collides(x, z, radius) {
  for (const c of roomInfo.colliders) {
    if (x + radius > c.minX && x - radius < c.maxX && z + radius > c.minZ && z - radius < c.maxZ) {
      return true;
    }
  }
  return false;
}

function updateMovement(dt) {
  moving = false;
  if (!controls.isLocked()) return;
  const { x: sx, y: sy } = moveAxes();
  const len = Math.hypot(sx, sy);
  if (len < 0.01) return;
  moving = true;

  const mag = Math.min(len, 1);
  const dirR = sx / len;
  const dirF = sy / len;
  const yaw = controls.yaw;
  const fX = -Math.sin(yaw);
  const fZ = -Math.cos(yaw);
  const rX = Math.cos(yaw);
  const rZ = -Math.sin(yaw);
  const speed = (isRunning() ? RUN_SPEED : MOVE_SPEED) * mag * dt;
  const dx = (fX * dirF + rX * dirR) * speed;
  const dz = (fZ * dirF + rZ * dirR) * speed;

  const nx = rig.position.x + dx;
  const nz = rig.position.z + dz;
  if (!collides(nx, rig.position.z, PLAYER_RADIUS)) rig.position.x = nx;
  if (!collides(rig.position.x, nz, PLAYER_RADIUS)) rig.position.z = nz;
}

// Running while carrying two or more bottles/beakers trips the player: they all fall and break.
let tripTimer = 0;
const TRIP_SECONDS = 0.6;
function updateTrip(dt) {
  const fragile = heldItems.filter((i) => i.userData.breakable).length;
  if (moving && isRunning() && fragile >= 2) {
    tripTimer += dt;
    if (tripTimer > TRIP_SECONDS) {
      tripTimer = 0;
      trip();
    }
  } else {
    tripTimer = Math.max(0, tripTimer - dt);
  }
}

function trip() {
  const items = heldItems.slice();
  ui.toast("넘어졌습니다! 들고 있던 물건이 모두 깨졌습니다.");
  for (const it of items) {
    removeFromHand(it);
    putInWorld(it);
    world.dropAt(it, it.position.x, it.position.z);
  }
}

// ---------- Pick up / hold ----------
const raycaster = new THREE.Raycaster();
const centerNDC = new THREE.Vector2(0, 0);

function allInteractables() {
  return Array.from(registry.values()).filter((o) => !heldItems.includes(o));
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

// PART_5: the name only appears when the pointer is on a real object, so only meshes count
// (name labels are sprites and never a target).
function raycastTarget(excludeItem) {
  raycaster.setFromCamera(centerNDC, camera);
  raycaster.far = REACH;
  const candidates = allInteractables().filter((o) => o !== excludeItem);
  const hits = raycaster.intersectObjects(candidates, true);
  for (const h of hits) {
    if (!h.object.isMesh || !isShown(h.object)) continue;
    const found = findInteractable(h.object);
    if (found && found !== excludeItem) return found;
  }
  return null;
}

function pickUp(item) {
  if (item.userData.busy) return;
  if (item.userData.id === "beaker1" && experiment.state.heating) {
    ui.toast("가열 중에는 비커를 옮길 수 없습니다.");
    return;
  }
  world.cancelFall(item);
  handRoot.attach(item); // keeps its world position; then it flies to its slot
  item.rotation.set(0, 0, 0);
  heldItems.push(item);
  heldItem = item;
  layoutHand();
}

function removeFromHand(item) {
  heldItems.splice(heldItems.indexOf(item), 1);
  heldItem = heldItems[heldItems.length - 1] ?? null;
  layoutHand();
}

// Back into the world, standing upright (PART_5: no more tilted drops).
function putInWorld(item) {
  scene.attach(item);
  item.rotation.x = 0;
  item.rotation.z = 0;
}

// Where the crosshair meets a surface: the item's bottom centre goes exactly there.
const AIM_RANGE = 6;
const aimRaycaster = new THREE.Raycaster();
const _camPos = new THREE.Vector3();
const _camDir = new THREE.Vector3();
function aimPoint() {
  aimRaycaster.setFromCamera(centerNDC, camera);
  aimRaycaster.far = AIM_RANGE;
  const candidates = [...roomInfo.groundMeshes];
  for (const o of registry.values()) {
    if (o.parent === scene && !o.userData.busy && isShown(o)) candidates.push(o);
  }
  for (const h of aimRaycaster.intersectObjects(candidates, true)) {
    if (h.object.isMesh && isShown(h.object)) return { x: h.point.x, z: h.point.z };
  }
  // nothing under the crosshair: take the floor point along the view, or 1.3 m ahead
  camera.getWorldPosition(_camPos);
  camera.getWorldDirection(_camDir);
  if (_camDir.y < -0.05) {
    const t = -_camPos.y / _camDir.y;
    if (t <= AIM_RANGE) return { x: _camPos.x + _camDir.x * t, z: _camPos.z + _camDir.z * t };
  }
  return { x: _camPos.x + _camDir.x * 1.3, z: _camPos.z + _camDir.z * 1.3 };
}

function disableRaycast(obj) {
  obj.traverse((o) => {
    o.raycast = () => {};
  });
}

function enableRaycast(obj) {
  obj.traverse((o) => {
    delete o.raycast;
  });
}

function consumeTarget(target) {
  disableRaycast(target);
  fx.vanish(target, 0.6);
}

// Play the motion for an action, then finish the item's placement.
function runMotion(item, target, m, aim) {
  const info = target ? sinkInfo[target.userData.id] : undefined;
  fx.run(m, { item, target, sinkMesh: info?.stream, fillPose: info?.fillPose }, () => {
    if (item) finishPlacement(item, m, aim);
  });
}

function finishPlacement(item, m, aim) {
  if (m.after === "drop") world.dropAt(item, aim.x, aim.z);
  else if (m.after === "settle") world.settle(item);
  // "stay": the motion left the item where it should be
}

// Right click / 사용: use the held item on what the crosshair is on, or let it drop.
function releaseHeld() {
  if (!heldItem) return;
  const item = heldItem;
  const target = raycastTarget(item);
  if (target && target.userData.busy) {
    ui.toast("잠시만 기다려 주세요.");
    return;
  }
  const aim = aimPoint();
  const result = experiment.tryUse(item.userData.id, target ? target.userData.id : null);
  removeFromHand(item);
  putInWorld(item);

  if (result.handled && result.targetConsume && target) consumeTarget(target);
  if (result.handled && result.motion) {
    runMotion(item, target, result.motion, aim);
    return;
  }
  world.dropAt(item, aim.x, aim.z);
}

// Left click / 집기: pick up a loose item (more can be added to the hand), or press a fixed
// one (faucet, test tube, shower button).
function primaryAction() {
  if (!controls.isLocked()) return;
  const target = raycastTarget(null);
  if (!target) return;
  if (target.userData.carryable) {
    pickUp(target);
    return;
  }
  if (target.userData.id === "shower_button") {
    pressShowerButton();
    return;
  }
  if (heldItem || target.userData.busy) return; // hands are full for taps
  const res = experiment.tryTap(target.userData.id);
  if (res.handled && res.motion) runMotion(null, target, res.motion, null);
}

function secondaryAction() {
  if (!controls.isLocked()) return;
  releaseHeld();
}

// Touch: one button does both. Holding -> use/drop; not holding -> pick/press.
function actionButton() {
  if (heldItem) secondaryAction();
  else primaryAction();
}

// Touch: a long press while holding adds the item under the crosshair to the hand.
function longPressAction() {
  if (!controls.isLocked() || !heldItem) return;
  const target = raycastTarget(null);
  if (target && target.userData.carryable) pickUp(target);
}

renderer.domElement.addEventListener("mousedown", (e) => {
  if (!controls.isLocked()) return;
  if (e.button === 0) primaryAction();
  else if (e.button === 2) secondaryAction();
});

renderer.domElement.addEventListener(
  "wheel",
  (e) => {
    if (!heldItem || !controls.isLocked()) return;
    e.preventDefault();
    heldItem.rotation.x += e.deltaY * 0.0025;
  },
  { passive: false }
);

// right-click drops instead of opening the browser context menu
renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());

// Q/E turn the held item left/right (around Y); the wheel and the rotation stick tilt it (around X)
const HELD_TURN_SPEED = 2.5; // radians per second
const HELD_TILT_SPEED = 1.6;
function updateHeldRotation(dt) {
  if (!heldItem) return;
  const turn = turnAxis();
  if (turn) heldItem.rotation.y += turn * HELD_TURN_SPEED * dt;
  const tilt = tiltAxis();
  if (tilt) heldItem.rotation.x += tilt * HELD_TILT_SPEED * dt;
}

// ---------- Falling / breaking ----------
const BREAK_FALL_HEIGHT = 0.5;

function onLand(item, fallDistance) {
  if (item.userData.breakable && fallDistance > BREAK_FALL_HEIGHT) breakItem(item);
}

function resetContents(item) {
  if (item.userData.kind === "beaker") {
    item.userData.hasCabbage = false;
    item.userData.hasWater = false;
    item.userData.isExtract = false;
    const bits = item.getObjectByName("cabbageBits");
    if (bits) bits.visible = false;
    const liquid = item.getObjectByName("liquid");
    if (liquid) setLevel(liquid, 0);
  }
  if (item.userData.id === "indicator_bottle") {
    item.userData.filled = false;
    const liquid = item.getObjectByName("liquid");
    if (liquid) setLevel(liquid, 0);
  }
}

// After a rewind (experiment.handleBreak): bring the cabbage back and empty the containers,
// so the experiment can be run again from the beginning.
function restoreAfterRewind() {
  const cabbage = registry.get("cabbage");
  if (!cabbage.visible) {
    enableRaycast(cabbage);
    cabbage.visible = true;
    cabbage.scale.setScalar(1);
    world.respawn(cabbage, cabbage.userData.spawnPosition);
    fx.appear(cabbage, 0.4);
  }
  for (let i = 1; i <= 6; i++) {
    const liquid = registry.get(`tube${i}`).getObjectByName("liquid");
    if (liquid) {
      setLevel(liquid, 0);
      liquid.material.color.set(0xffffff);
    }
  }
  resetContents(registry.get("beaker1"));
  resetContents(registry.get("indicator_bottle"));
}

// ---------- Emergency shower ----------
const SHOWER_RANGE = 1.6; // how close the player must stand to the shower
const SHOWER_SECONDS = 6; // how long one press of the yellow button runs the water
const WASH_SECONDS = 3; // time under the water needed to finish washing
let showerNeeded = false; // set by a burn or a broken bottle
let showerLeft = 0; // seconds of water left
let washProgress = 0;

function nearShower() {
  return Math.hypot(rig.position.x - SHOWER.x, rig.position.z - SHOWER.z) < SHOWER_RANGE;
}

// PART_5: the shower only works at the shower itself, by pressing its yellow button.
function pressShowerButton() {
  if (!nearShower()) {
    ui.toast("샤워기 가까이 가서 노란 버튼을 누르세요.");
    return;
  }
  if (showerLeft > 0) return;
  showerLeft = SHOWER_SECONDS;
  fx.shower(SHOWER_SECONDS);
  ui.toast(showerNeeded ? "물이 나옵니다. 샤워기 아래에서 씻으세요." : "샤워기가 작동합니다.");
}

function updateShower(dt) {
  if (showerLeft <= 0) {
    washProgress = 0;
    return;
  }
  showerLeft -= dt;
  if (showerNeeded && nearShower()) {
    washProgress += dt;
    if (washProgress >= WASH_SECONDS) {
      showerNeeded = false;
      washProgress = 0;
      ui.toast("씻기 완료! 사고 처리가 끝났습니다.");
    }
  }
}

function breakItem(item) {
  const name = item.userData.name;
  const isBottle = item.userData.kind === "bottle";
  const at = item.getWorldPosition(new THREE.Vector3());

  fx.shatter(at, 0xdde9ef);
  disableRaycast(item);
  fx.vanish(item, 0.25);

  // a broken ingredient rewinds the experiment (see experiment.handleBreak)
  const rewound = experiment.handleBreak(item.userData.id);
  resetContents(item);
  if (rewound) restoreAfterRewind();

  if (isBottle) {
    showerNeeded = true;
    ui.toast(`${name}이(가) 깨졌습니다! 샤워기로 가서 노란 버튼을 누르세요.`);
  } else if (!rewound) {
    ui.toast(`${name}이(가) 바닥에 떨어져 깨졌습니다!`);
  }

  const spawnPos = item.userData.spawnPosition;
  if (!spawnPos) return;
  setTimeout(() => {
    enableRaycast(item);
    item.visible = true;
    item.rotation.set(0, 0, 0);
    world.respawn(item, spawnPos);
    fx.appear(item, 0.4);
    ui.toast(`${name}이(가) 재료실에 새로 준비되었습니다.`);
  }, 1500);
}

// ---------- Hover tooltip ----------
function updateTooltip() {
  const locked = controls.isLocked();
  const hover = locked ? raycastTarget(null) : null;
  updateLabels(hover);
  if (!locked) {
    ui.setTooltip("");
    return;
  }
  if (heldItem) {
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

// ---------- Burn hazard ----------
// PART_5: a small area around the lamp (was 1.3 m, far too wide)
const BURN_RADIUS = 0.7;
const BURN_COOLDOWN = 2.0;
let lastBurnTime = -Infinity;
function updateBurnCheck(t) {
  if (!experiment.state.lampLit) return;
  const lamp = registry.get("alcohol_lamp");
  const dist = Math.hypot(rig.position.x - lamp.position.x, rig.position.z - lamp.position.z);
  if (dist < BURN_RADIUS && t - lastBurnTime > BURN_COOLDOWN) {
    lastBurnTime = t;
    showerNeeded = true;
    ui.toast("뜨거워요! 화상을 입었습니다. 샤워기로 가서 노란 버튼을 누르세요.");
    ui.flashBurn();
  }
}

// ---------- Touch ----------
setupTouch({
  controls,
  onTap: actionButton,
  onLongPress: longPressAction,
  onLeftyChange: applyHandSide,
});
applyHandSide();

// ---------- Main loop ----------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  updateMovement(dt);
  updateTrip(dt);
  updateHeldRotation(dt);
  updateHand(dt, t);
  updateView(dt, t);
  experiment.update(dt);
  world.update(dt, onLand);
  fx.update(dt, t);
  updateShower(dt);
  updateBurnCheck(t);
  updateTooltip();

  renderer.render(scene, camera);
}
animate();

