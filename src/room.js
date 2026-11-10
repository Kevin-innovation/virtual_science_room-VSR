import * as THREE from "three";
import { ROOM, DESK_A, DESK_B, SUPPLY_TABLE, SINK, SHOWER, scaleX } from "./constants.js";

// PART_5: bright, white lighting; the walls are a pale white-blue.
const WALL = 0xf1f6fa;
const FLOOR_MAIN = 0xf3f4f5;
const FLOOR_SUPPLY = 0xe9e4d8;
const WOOD = 0xa07c55;
const COUNTER = 0xf4f6f8;
const STEEL = 0xcfd8dc;

const WINDOW_XS = [scaleX(-6.2), scaleX(0.4)];
const WINDOW_W = 1.5;
const WINDOW_H = 1.1;
const WINDOW_CY = 2.5;

function box(w, h, d, color, opts = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...opts });
  return new THREE.Mesh(geo, mat);
}

// Outdoor scenery seen through the north windows (outside the room, behind the wall).
function addScenery(group) {
  const outside = new THREE.Group();
  group.add(outside);

  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 90),
    new THREE.MeshStandardMaterial({ color: 0x9ed98c, roughness: 1 })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(0, -0.02, -45);
  outside.add(grass);

  const hillMat = new THREE.MeshStandardMaterial({ color: 0x7fbf76, roughness: 1 });
  [[-14, -20, 6], [-4, -26, 9], [6, -21, 7], [15, -28, 10], [-22, -24, 8]].forEach(([x, z, r]) => {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 12), hillMat);
    hill.scale.y = 0.35;
    hill.position.set(x, 0, z);
    outside.add(hill);
  });

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.9 });
  [[-10, -9], [-6.5, -11], [-2, -10], [1.5, -12.5], [5, -9.5], [9, -11.5], [12.5, -9.2], [-13, -12.5]].forEach(([x, z], i) => {
    const h = 1.6 + (i % 3) * 0.35;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, h, 8), trunkMat);
    trunk.position.set(x, h / 2, z);
    outside.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.5, 10), leafMat);
    crown.position.set(x, h + 0.55, z);
    outside.add(crown);
  });

  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.3 });
  [[-8, 9, -18], [3, 10.5, -22], [11, 8.5, -16]].forEach(([x, y, z]) => {
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), cloudMat);
    cloud.scale.set(1.8, 0.7, 1);
    cloud.position.set(x, y, z);
    outside.add(cloud);
  });
}

export function buildRoom(scene) {
  const colliders = [];
  const groundMeshes = [];
  const group = new THREE.Group();
  scene.add(group);

  // ---- Floor (two tones: main lab / materials room) ----
  const floorMain = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.materialsRoomStartX - ROOM.minX, ROOM.maxZ - ROOM.minZ),
    new THREE.MeshStandardMaterial({ color: FLOOR_MAIN, roughness: 0.9 })
  );
  floorMain.rotation.x = -Math.PI / 2;
  floorMain.position.set((ROOM.minX + ROOM.materialsRoomStartX) / 2, 0, 0);
  group.add(floorMain);
  groundMeshes.push(floorMain);

  const floorSupply = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.maxX - ROOM.materialsRoomStartX, ROOM.maxZ - ROOM.minZ),
    new THREE.MeshStandardMaterial({ color: FLOOR_SUPPLY, roughness: 0.9 })
  );
  floorSupply.rotation.x = -Math.PI / 2;
  floorSupply.position.set((ROOM.materialsRoomStartX + ROOM.maxX) / 2, 0, 0);
  group.add(floorSupply);
  groundMeshes.push(floorSupply);

  // ---- Ceiling ----
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.maxX - ROOM.minX, ROOM.maxZ - ROOM.minZ),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set((ROOM.minX + ROOM.maxX) / 2, ROOM.wallHeight, 0);
  group.add(ceiling);

  // ---- Walls ----
  const wallThickness = 0.3;
  const totalWidth = ROOM.maxX - ROOM.minX;
  const totalDepth = ROOM.maxZ - ROOM.minZ;
  const centerX = (ROOM.minX + ROOM.maxX) / 2;

  function addWallCollider(minX, maxX, minZ, maxZ) {
    colliders.push({ minX, maxX, minZ, maxZ });
  }

  // North (back) wall: solid stretches with two window openings cut into it
  const wallH = ROOM.wallHeight;
  const openings = WINDOW_XS.map((x) => ({ x0: x - WINDOW_W / 2, x1: x + WINDOW_W / 2 }));
  const winBottom = WINDOW_CY - WINDOW_H / 2;
  const winTop = WINDOW_CY + WINDOW_H / 2;
  const addPiece = (x0, x1, y0, y1, z, color = WALL) => {
    if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return;
    const m = box(x1 - x0, y1 - y0, wallThickness, color);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
    group.add(m);
  };
  let xs = ROOM.minX;
  for (const o of openings) {
    addPiece(xs, o.x0, 0, wallH, ROOM.minZ);
    xs = o.x1;
  }
  addPiece(xs, ROOM.maxX, 0, wallH, ROOM.minZ);
  for (const o of openings) {
    addPiece(o.x0, o.x1, 0, winBottom, ROOM.minZ);
    addPiece(o.x0, o.x1, winTop, wallH, ROOM.minZ);
  }
  addWallCollider(ROOM.minX, ROOM.maxX, ROOM.minZ - wallThickness, ROOM.minZ + 0.2);

  // South (front) wall
  const southWall = box(totalWidth, wallH, wallThickness, WALL);
  southWall.position.set(centerX, wallH / 2, ROOM.maxZ);
  group.add(southWall);
  addWallCollider(ROOM.minX, ROOM.maxX, ROOM.maxZ - 0.2, ROOM.maxZ + wallThickness);

  // West wall
  const westWall = box(wallThickness, wallH, totalDepth, WALL);
  westWall.position.set(ROOM.minX, wallH / 2, 0);
  group.add(westWall);
  addWallCollider(ROOM.minX - wallThickness, ROOM.minX + 0.2, ROOM.minZ, ROOM.maxZ);

  // East wall
  const eastWall = box(wallThickness, wallH, totalDepth, WALL);
  eastWall.position.set(ROOM.maxX, wallH / 2, 0);
  group.add(eastWall);
  addWallCollider(ROOM.maxX - 0.2, ROOM.maxX + wallThickness, ROOM.minZ, ROOM.maxZ);

  // ---- Windows: frame, glass, and the view outside ----
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xdff4ff,
    transparent: true,
    opacity: 0.3,
    roughness: 0.1,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  for (const x of WINDOW_XS) {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(WINDOW_W, WINDOW_H), glassMat);
    glass.position.set(x, WINDOW_CY, ROOM.minZ + 0.02);
    group.add(glass);
    const fz = ROOM.minZ + 0.06;
    const t = 0.07;
    const top = box(WINDOW_W + t, t, t, 0xffffff, { roughness: 0.6 });
    top.position.set(x, winTop, fz);
    const bottom = top.clone();
    bottom.position.set(x, winBottom, fz);
    const left = box(t, WINDOW_H, t, 0xffffff, { roughness: 0.6 });
    left.position.set(x - WINDOW_W / 2, WINDOW_CY, fz);
    const right = left.clone();
    right.position.set(x + WINDOW_W / 2, WINDOW_CY, fz);
    const mullion = box(t * 0.7, WINDOW_H, t * 0.7, 0xffffff, { roughness: 0.6 });
    mullion.position.set(x, WINDOW_CY, fz);
    group.add(top, bottom, left, right, mullion);
  }
  addScenery(group);

  // ---- Sink: one counter, basin, faucet ----
  function addSink(cfg, id) {
    const counter = box(1.6, 0.9, 0.7, COUNTER);
    counter.position.set(cfg.x, 0.45, cfg.z + 0.45);
    group.add(counter);
    groundMeshes.push(counter);
    addWallCollider(cfg.x - 0.8, cfg.x + 0.8, cfg.z, cfg.z + 0.9);

    const basin = box(1.1, 0.15, 0.45, 0xeceff1);
    basin.position.set(cfg.x, 0.85, cfg.z + 0.45);
    group.add(basin);

    const faucetBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8),
      new THREE.MeshStandardMaterial({ color: STEEL, metalness: 0.8, roughness: 0.3 })
    );
    faucetBase.position.set(cfg.x, 1.15, cfg.z + 0.15);
    group.add(faucetBase);

    const faucetSpout = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.35, 8),
      new THREE.MeshStandardMaterial({ color: STEEL, metalness: 0.8, roughness: 0.3 })
    );
    faucetSpout.rotation.z = Math.PI / 2;
    faucetSpout.position.set(cfg.x, 1.38, cfg.z + 0.32);
    group.add(faucetSpout);

    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6),
      new THREE.MeshStandardMaterial({ color: 0x61c3ff, transparent: true, opacity: 0.8 })
    );
    water.position.set(cfg.x, 1.0, cfg.z + 0.48);
    water.visible = false;
    group.add(water);

    const faucetHit = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    faucetHit.position.set(cfg.x, 1.3, cfg.z + 0.35);
    faucetHit.userData = { id, name: "수도꼭지", carryable: false, interactType: "faucet" };
    group.add(faucetHit);

    return {
      faucetHit,
      waterMesh: water,
      basinPos: new THREE.Vector3(cfg.x, 0.9, cfg.z + 0.45),
      // where a beaker stands while water from this faucet falls into it
      fillPose: new THREE.Vector3(cfg.x, 0.925, cfg.z + 0.48),
    };
  }
  const sink = addSink(SINK, "sink_faucet");

  // ---- Emergency shower: pole, head, curtain, and the yellow switch on the pole ----
  const showerPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 2.6, 8),
    new THREE.MeshStandardMaterial({ color: 0xc62828, metalness: 0.6, roughness: 0.4 })
  );
  showerPole.position.set(SHOWER.x, 1.3, SHOWER.z);
  group.add(showerPole);
  const showerHead = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.1, 16),
    new THREE.MeshStandardMaterial({ color: 0xb0bec5, metalness: 0.7, roughness: 0.3 })
  );
  showerHead.position.set(SHOWER.x, 2.6, SHOWER.z);
  group.add(showerHead);

  // Curtain: a open-front cylinder around the shower; the opening faces +Z (the room)
  const curtain = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 0.85, 2.5, 28, 1, true, Math.PI * 0.3, Math.PI * 1.4),
    new THREE.MeshStandardMaterial({
      color: 0xe3f2fd,
      transparent: true,
      opacity: 0.6,
      roughness: 0.4,
      side: THREE.DoubleSide,
    })
  );
  curtain.position.set(SHOWER.x, 1.25, SHOWER.z);
  group.add(curtain);

  // Round yellow switch: the player presses it to turn the shower on (see main.js)
  const showerButton = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.04, 20),
    new THREE.MeshStandardMaterial({ color: 0xffd600, emissive: 0x443300, emissiveIntensity: 0.4 })
  );
  showerButton.rotation.x = Math.PI / 2;
  showerButton.position.set(SHOWER.x + 0.12, 1.3, SHOWER.z + 0.1);
  showerButton.userData = { id: "shower_button", name: "샤워기 버튼", carryable: false, interactType: "shower" };
  group.add(showerButton);

  // ---- Desks ----
  function addDesk(cfg) {
    const top = box(cfg.w, 0.08, cfg.d, WOOD);
    top.position.set(cfg.x, cfg.h, cfg.z);
    group.add(top);
    groundMeshes.push(top);
    const legGeo = new THREE.CylinderGeometry(0.05, 0.05, cfg.h, 8);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x4e342e });
    const offsets = [
      [cfg.w / 2 - 0.1, cfg.d / 2 - 0.1],
      [-(cfg.w / 2 - 0.1), cfg.d / 2 - 0.1],
      [cfg.w / 2 - 0.1, -(cfg.d / 2 - 0.1)],
      [-(cfg.w / 2 - 0.1), -(cfg.d / 2 - 0.1)],
    ];
    offsets.forEach(([ox, oz]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(cfg.x + ox, cfg.h / 2, cfg.z + oz);
      group.add(leg);
    });
    colliders.push({
      minX: cfg.x - cfg.w / 2,
      maxX: cfg.x + cfg.w / 2,
      minZ: cfg.z - cfg.d / 2,
      maxZ: cfg.z + cfg.d / 2,
    });
    return { topY: cfg.h + 0.04 };
  }
  const deskA = addDesk(DESK_A);
  const deskB = addDesk(DESK_B);

  // ---- Supply table (materials room) ----
  const supplyTop = addDesk(SUPPLY_TABLE);

  // ---- Materials room sign: one face per direction, so it reads from both sides ----
  const signCanvas = document.createElement("canvas");
  signCanvas.width = 256;
  signCanvas.height = 96;
  const ctx = signCanvas.getContext("2d");
  ctx.fillStyle = "#123a52";
  ctx.fillRect(0, 0, 256, 96);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 44px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("재료실", 128, 50);
  const signTex = new THREE.CanvasTexture(signCanvas);
  const signGeo = new THREE.PlaneGeometry(1.6, 0.6);
  const signMat = new THREE.MeshBasicMaterial({ map: signTex });
  for (const rotY of [Math.PI / 2, -Math.PI / 2]) {
    const face = new THREE.Mesh(signGeo, signMat);
    face.position.set(ROOM.materialsRoomStartX + 1.5, 3.2, 0);
    face.rotation.y = rotY;
    group.add(face);
  }

  // ---- Lighting: white ----
  const hemi = new THREE.HemisphereLight(0xffffff, 0xf2f6fa, 1.7);
  scene.add(hemi);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
  dirLight.position.set(5, 8, 3);
  scene.add(dirLight);

  function addCeilingLamp(x, z) {
    const fixture = new THREE.PointLight(0xffffff, 1.6, 12, 2);
    fixture.position.set(x, ROOM.wallHeight - 0.2, z);
    scene.add(fixture);
    const bulb = box(0.6, 0.06, 0.6, 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.9 });
    bulb.position.set(x, ROOM.wallHeight - 0.1, z);
    group.add(bulb);
  }
  addCeilingLamp(scaleX(-4), 0);
  addCeilingLamp(scaleX(4), 0);
  addCeilingLamp(scaleX(12), 0);

  return {
    colliders,
    groundMeshes,
    deskA,
    deskB,
    supplyTop,
    sinks: [sink],
    showerButton,
  };
}
