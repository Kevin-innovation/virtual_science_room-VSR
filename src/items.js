import * as THREE from "three";
import { DESK_A, DESK_B, SUPPLY_TABLE } from "./constants.js";

function glassMat(opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.28,
    roughness: 0.1,
    metalness: 0.05,
    ...opts,
  });
}

function makeLabel(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(0,0,0,0.0)";
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "rgba(0,0,0,0.9)";
  ctx.lineWidth = 4;
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeText(text, 128, 32);
  ctx.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(0.7, 0.18, 1);
  sprite.position.y = 0.4;
  sprite.renderOrder = 10;
  return sprite;
}

function tagRoot(group, id, name, carryable, extra = {}) {
  group.userData = { id, name, carryable, ...extra };
  group.traverse((o) => (o.userData.rootId = id));
  return group;
}

// ---------- individual item builders ----------

function buildBeaker(id, name) {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.32, 24, 1, true), glassMat());
  glass.position.y = 0.16;
  g.add(glass);
  const bottom = new THREE.Mesh(
    new THREE.CircleGeometry(0.14, 24),
    glassMat({ side: THREE.DoubleSide })
  );
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = 0.001;
  g.add(bottom);

  const liquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.13, 0.01, 24),
    new THREE.MeshStandardMaterial({ color: 0x9fe6a0, transparent: true, opacity: 0.85 })
  );
  liquid.position.y = 0.01;
  liquid.visible = false;
  liquid.name = "liquid";
  g.add(liquid);

  const cabbageBits = new THREE.Group();
  cabbageBits.name = "cabbageBits";
  cabbageBits.visible = false;
  for (let i = 0; i < 6; i++) {
    const bit = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.025, 0),
      new THREE.MeshStandardMaterial({ color: 0x6a3e86 })
    );
    bit.position.set((Math.random() - 0.5) * 0.18, 0.05 + Math.random() * 0.08, (Math.random() - 0.5) * 0.18);
    cabbageBits.add(bit);
  }
  g.add(cabbageBits);

  g.add(makeLabel(name));
  tagRoot(g, id, name, true, {
    kind: "beaker",
    hasCabbage: false,
    hasWater: false,
    isExtract: false,
    breakable: true,
  });
  return g;
}

function buildTestTube(id, index, deskPos) {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.22, 16, 1, true), glassMat());
  glass.position.y = 0.11;
  g.add(glass);
  const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.033, 16, 8), glassMat());
  bottom.position.y = 0.0;
  g.add(bottom);

  const liquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.028, 0.01, 16),
    new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })
  );
  liquid.position.y = 0.02;
  liquid.visible = false;
  liquid.name = "liquid";
  g.add(liquid);

  g.add(makeLabel(`시험관 ${index}`));
  tagRoot(g, id, `시험관 ${index}`, false, {
    kind: "testtube",
    solution: null,
    hasIndicator: false,
    observed: false,
    slotIndex: index,
  });
  return g;
}

function buildDropperBottle(id, name, liquidColor, prefilled) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.16, 16),
    new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, roughness: 0.2 })
  );
  body.position.y = 0.08;
  g.add(body);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.025, 0.1, 12),
    new THREE.MeshStandardMaterial({ color: 0x455a64 })
  );
  cap.position.y = 0.21;
  g.add(cap);

  const liquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.1, 16),
    new THREE.MeshStandardMaterial({ color: liquidColor })
  );
  liquid.position.y = 0.06;
  liquid.visible = !!prefilled;
  liquid.name = "liquid";
  g.add(liquid);

  g.add(makeLabel(name));
  tagRoot(g, id, name, true, { kind: "bottle", filled: !!prefilled, liquidColor, breakable: true });
  return g;
}

function buildScissors(id) {
  const g = new THREE.Group();
  const blade1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.18, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xcfd8dc, metalness: 0.8, roughness: 0.2 })
  );
  blade1.position.set(-0.02, 0.1, 0);
  blade1.rotation.z = 0.15;
  g.add(blade1);
  const blade2 = blade1.clone();
  blade2.position.x = 0.02;
  blade2.rotation.z = -0.15;
  g.add(blade2);
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.035, 0.012, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xff7043 })
  );
  handle.position.set(-0.03, 0.02, 0);
  g.add(handle);
  const handle2 = handle.clone();
  handle2.position.x = 0.03;
  g.add(handle2);
  g.add(makeLabel("가위"));
  tagRoot(g, id, "가위", true, { kind: "tool" });
  return g;
}

function buildCabbage(id) {
  const g = new THREE.Group();
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x8e3b78, roughness: 0.6 })
  );
  head.scale.set(1, 0.85, 1);
  g.add(head);
  g.add(makeLabel("붉은 양배추"));
  tagRoot(g, id, "붉은 양배추", true, { kind: "cabbage" });
  return g;
}

function buildIgniter(id) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.12, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xff5722 })
  );
  body.position.y = 0.06;
  g.add(body);
  const nozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.06, 8),
    new THREE.MeshStandardMaterial({ color: 0x9e9e9e, metalness: 0.7 })
  );
  nozzle.rotation.z = Math.PI / 2;
  nozzle.position.set(0.04, 0.12, 0);
  g.add(nozzle);
  g.add(makeLabel("점화기"));
  tagRoot(g, id, "점화기", true, { kind: "tool" });
  return g;
}

function buildSieve(id) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.09, 0.012, 8, 20),
    new THREE.MeshStandardMaterial({ color: 0xb0bec5, metalness: 0.6 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.1;
  g.add(ring);
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.085, 20),
    new THREE.MeshStandardMaterial({ color: 0xcfd8dc, wireframe: true })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.09;
  g.add(mesh);
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.14, 8),
    new THREE.MeshStandardMaterial({ color: 0x8d6e63 })
  );
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0.14, 0.1, 0);
  g.add(handle);
  g.add(makeLabel("체"));
  tagRoot(g, id, "체", true, { kind: "tool" });
  return g;
}

function buildGloveLike(id, name, color) {
  const g = new THREE.Group();
  const palm = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.02, 0.14),
    new THREE.MeshStandardMaterial({ color })
  );
  palm.position.y = 0.03;
  g.add(palm);
  g.add(makeLabel(name));
  tagRoot(g, id, name, true, { kind: "wearable" });
  return g;
}

function buildGoggles(id) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(
    new THREE.TorusGeometry(0.045, 0.012, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0x263238 })
  );
  frame.position.set(-0.05, 0.05, 0);
  g.add(frame);
  const frame2 = frame.clone();
  frame2.position.x = 0.05;
  g.add(frame2);
  const bridge = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.012, 0.012),
    new THREE.MeshStandardMaterial({ color: 0x263238 })
  );
  bridge.position.set(0, 0.05, 0);
  g.add(bridge);
  g.add(makeLabel("보안경"));
  tagRoot(g, id, "보안경", true, { kind: "wearable" });
  return g;
}

// ---------- fixed heating-station items ----------

function buildAlcoholLamp(id, topY) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.08, 0.12, 16),
    new THREE.MeshStandardMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.55 })
  );
  body.position.y = 0.06;
  g.add(body);
  const wickCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.03, 0.03, 12),
    new THREE.MeshStandardMaterial({ color: 0x37474f })
  );
  wickCap.position.y = 0.13;
  g.add(wickCap);

  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.025, 0.08, 8),
    new THREE.MeshStandardMaterial({ color: 0xff9800, emissive: 0xff6f00, emissiveIntensity: 1.2 })
  );
  flame.position.y = 0.2;
  flame.visible = false;
  flame.name = "flame";
  g.add(flame);

  const flameLight = new THREE.PointLight(0xff9800, 0, 1.5, 2);
  flameLight.position.y = 0.2;
  flameLight.name = "flameLight";
  g.add(flameLight);

  g.position.set(DESK_A.x, topY, DESK_A.z);
  g.add(makeLabel("알코올램프"));
  tagRoot(g, id, "알코올램프", false, { kind: "lamp", lit: false, interactType: "lamp" });
  return g;
}

function buildTripodAndMesh(topY) {
  const g = new THREE.Group();
  const legMat = new THREE.MeshStandardMaterial({ color: 0x616161, metalness: 0.7, roughness: 0.4 });
  for (let i = 0; i < 3; i++) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.22, 6), legMat);
    const ang = (i / 3) * Math.PI * 2;
    leg.position.set(Math.cos(ang) * 0.09, 0.11, Math.sin(ang) * 0.09);
    leg.rotation.x = Math.sin(ang) * 0.3;
    leg.rotation.z = -Math.cos(ang) * 0.3;
    g.add(leg);
  }
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.1, 0.008, 8, 16),
    legMat
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.22;
  g.add(ring);
  const wireMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.1, 16),
    new THREE.MeshStandardMaterial({ color: 0x9e9e9e, wireframe: true })
  );
  wireMesh.rotation.x = -Math.PI / 2;
  wireMesh.position.y = 0.225;
  g.add(wireMesh);

  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 16), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.23;
  g.add(hit);

  const restPoint = new THREE.Object3D();
  restPoint.name = "restPoint";
  restPoint.position.y = 0.235;
  g.add(restPoint);

  g.position.set(DESK_A.x, topY, DESK_A.z);
  tagRoot(g, "wire_mesh", "삼발이 / 쇠그물", false, { kind: "tripod", interactType: "tripod" });
  return g;
}

function buildTestTubeRack(topY) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.03, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x6d4c41 })
  );
  base.position.y = 0.015;
  g.add(base);
  g.position.set(DESK_B.x, topY, DESK_B.z);
  g.userData = { id: "tube_rack", name: "시험관대", carryable: false };
  return g;
}

export function buildItems(scene, roomInfo) {
  const registry = new Map();
  const add = (obj, pos) => {
    if (pos) {
      obj.position.copy(pos);
      obj.userData.spawnPosition = pos.clone();
    }
    scene.add(obj);
    registry.set(obj.userData.id, obj);
    return obj;
  };

  const deskATop = roomInfo.deskA.topY;
  const deskBTop = roomInfo.deskB.topY;
  const supplyTop = roomInfo.supplyTop.topY;

  // Fixed heating station on Desk A
  const lamp = buildAlcoholLamp("alcohol_lamp", deskATop);
  scene.add(lamp);
  registry.set(lamp.userData.id, lamp);

  const tripod = buildTripodAndMesh(deskATop);
  scene.add(tripod);
  registry.set(tripod.userData.id, tripod);

  // Test tube rack + 6 tubes on Desk B
  const rack = buildTestTubeRack(deskBTop);
  scene.add(rack);
  registry.set(rack.userData.id, rack);

  const tubeXs = [-0.2, -0.12, -0.04, 0.04, 0.12, 0.2];
  for (let i = 0; i < 6; i++) {
    const tube = buildTestTube(`tube${i + 1}`, i + 1, DESK_B);
    tube.position.set(DESK_B.x + tubeXs[i], deskBTop + 0.03, DESK_B.z);
    scene.add(tube);
    registry.set(tube.userData.id, tube);
  }

  // Supply table row of carryable items (materials room)
  const supplyItems = [
    buildBeaker("beaker1", "비커 1"),
    buildBeaker("beaker2", "비커 2"),
    buildScissors("scissors"),
    buildCabbage("cabbage"),
    buildIgniter("igniter"),
    buildSieve("sieve"),
    buildGloveLike("coated_gloves", "반코팅 면장갑", 0xd7ccc8),
    buildGloveLike("lab_gloves", "실험용 장갑", 0xeceff1),
    buildGoggles("goggles"),
    buildDropperBottle("indicator_bottle", "점적병(지시약-빈병)", 0xffffff, false),
    buildDropperBottle("sol_vinegar", "식초", 0xfff176, true),
    buildDropperBottle("sol_cider", "사이다", 0xfff9c4, true),
    buildDropperBottle("sol_soap", "빨랫비누 물", 0xe1f5fe, true),
    buildDropperBottle("sol_limewater", "석회수", 0xf5f5f5, true),
    buildDropperBottle("sol_hcl", "묽은 염산", 0xffffff, true),
    buildDropperBottle("sol_naoh", "묽은 수산화나트륨", 0xffffff, true),
  ];
  // Center the row under the supply table (keep margin so nothing hangs off
  // the table edge or pokes through the east wall beyond it).
  const ITEM_SPACING = 0.4;
  const rowSpan = (supplyItems.length - 1) * ITEM_SPACING;
  const startX = SUPPLY_TABLE.x - rowSpan / 2;
  supplyItems.forEach((item, i) => {
    add(item, new THREE.Vector3(startX + i * ITEM_SPACING, supplyTop, SUPPLY_TABLE.z));
  });

  return registry;
}
