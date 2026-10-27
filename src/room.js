import * as THREE from "three";
import { ROOM, DESK_A, DESK_B, SUPPLY_TABLE, SINK_A, SINK_B, SHOWER } from "./constants.js";

const SKY_BLUE = 0xaedcf0;
const FLOOR_MAIN = 0xe7ebee;
const FLOOR_SUPPLY = 0xd8d2c2;
const WOOD = 0x8a6240;
const COUNTER = 0xd7dde1;
const STEEL = 0xb0bec5;

function box(w, h, d, color, opts = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...opts });
  return new THREE.Mesh(geo, mat);
}

export function buildRoom(scene) {
  const colliders = [];
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

  const floorSupply = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.maxX - ROOM.materialsRoomStartX, ROOM.maxZ - ROOM.minZ),
    new THREE.MeshStandardMaterial({ color: FLOOR_SUPPLY, roughness: 0.9 })
  );
  floorSupply.rotation.x = -Math.PI / 2;
  floorSupply.position.set((ROOM.materialsRoomStartX + ROOM.maxX) / 2, 0, 0);
  group.add(floorSupply);

  // ---- Ceiling ----
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.maxX - ROOM.minX, ROOM.maxZ - ROOM.minZ),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set((ROOM.minX + ROOM.maxX) / 2, ROOM.wallHeight, 0);
  group.add(ceiling);

  // ---- Outer walls (sky blue) ----
  const wallMat = new THREE.MeshStandardMaterial({ color: SKY_BLUE, roughness: 0.95 });
  const wallThickness = 0.3;
  const totalWidth = ROOM.maxX - ROOM.minX;
  const totalDepth = ROOM.maxZ - ROOM.minZ;
  const centerX = (ROOM.minX + ROOM.maxX) / 2;

  function addWallCollider(minX, maxX, minZ, maxZ) {
    colliders.push({ minX, maxX, minZ, maxZ });
  }

  // North (back) wall - will carve windows visually by layering frames on top, but keep as solid panel
  const northWall = box(totalWidth, ROOM.wallHeight, wallThickness, SKY_BLUE);
  northWall.position.set(centerX, ROOM.wallHeight / 2, ROOM.minZ);
  group.add(northWall);
  addWallCollider(ROOM.minX, ROOM.maxX, ROOM.minZ - wallThickness, ROOM.minZ + 0.2);

  // South (front) wall
  const southWall = box(totalWidth, ROOM.wallHeight, wallThickness, SKY_BLUE);
  southWall.position.set(centerX, ROOM.wallHeight / 2, ROOM.maxZ);
  group.add(southWall);
  addWallCollider(ROOM.minX, ROOM.maxX, ROOM.maxZ - 0.2, ROOM.maxZ + wallThickness);

  // West wall
  const westWall = box(wallThickness, ROOM.wallHeight, totalDepth, SKY_BLUE);
  westWall.position.set(ROOM.minX, ROOM.wallHeight / 2, 0);
  group.add(westWall);
  addWallCollider(ROOM.minX - wallThickness, ROOM.minX + 0.2, ROOM.minZ, ROOM.maxZ);

  // East wall
  const eastWall = box(wallThickness, ROOM.wallHeight, totalDepth, SKY_BLUE);
  eastWall.position.set(ROOM.maxX, ROOM.wallHeight / 2, 0);
  group.add(eastWall);
  addWallCollider(ROOM.maxX - 0.2, ROOM.maxX + wallThickness, ROOM.minZ, ROOM.maxZ);

  // ---- Rectangular windows on the back wall ----
  function addWindow(x) {
    const frame = box(1.8, 1.4, 0.12, 0xffffff);
    frame.position.set(x, 2.5, ROOM.minZ + 0.02);
    group.add(frame);
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.1),
      new THREE.MeshStandardMaterial({
        color: 0xcdeeff,
        transparent: true,
        opacity: 0.55,
        roughness: 0.1,
        metalness: 0.2,
        emissive: 0x9fdcff,
        emissiveIntensity: 0.25,
      })
    );
    glass.position.set(x, 2.5, ROOM.minZ + 0.09);
    group.add(glass);
  }
  addWindow(-6.2);
  addWindow(0.4);

  // ---- Sinks (counter + basin + faucet) ----
  function addSink(cfg, id) {
    const counter = box(1.6, 0.9, 0.7, COUNTER);
    counter.position.set(cfg.x, 0.45, cfg.z + 0.45);
    group.add(counter);
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
    faucetHit.userData = { id: `sink_${id}_faucet`, name: "수도꼭지", carryable: false, interactType: "faucet" };
    group.add(faucetHit);

    return { faucetHit, waterMesh: water, basinPos: new THREE.Vector3(cfg.x, 0.9, cfg.z + 0.45) };
  }
  const sinkA = addSink(SINK_A, "a");
  const sinkB = addSink(SINK_B, "b");

  // ---- Emergency shower ----
  const showerPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 2.6, 8),
    new THREE.MeshStandardMaterial({ color: 0xc62828, metalness: 0.6, roughness: 0.4 })
  );
  showerPole.position.set(SHOWER.x, 1.5, SHOWER.z);
  group.add(showerPole);
  const showerHead = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.1, 16),
    new THREE.MeshStandardMaterial({ color: 0xb0bec5, metalness: 0.7, roughness: 0.3 })
  );
  showerHead.position.set(SHOWER.x, 2.8, SHOWER.z);
  group.add(showerHead);
  const showerHandle = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.025, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xc62828 })
  );
  showerHandle.rotation.x = Math.PI / 2;
  showerHandle.position.set(SHOWER.x, 1.9, SHOWER.z + 0.1);
  group.add(showerHandle);
  const showerSign = box(0.5, 0.3, 0.03, 0xffeb3b, { emissive: 0x443300, emissiveIntensity: 0.3 });
  showerSign.position.set(SHOWER.x, 2.2, SHOWER.z - 0.15);
  group.add(showerSign);

  // ---- Desks ----
  function addDesk(cfg) {
    const top = box(cfg.w, 0.08, cfg.d, WOOD);
    top.position.set(cfg.x, cfg.h, cfg.z);
    group.add(top);
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

  // ---- Materials room sign ----
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
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.6),
    new THREE.MeshBasicMaterial({ map: signTex })
  );
  sign.position.set(ROOM.materialsRoomStartX + 1.5, 3.2, 0);
  sign.rotation.y = Math.PI / 2;
  group.add(sign);

  // ---- Lighting ----
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.85);
  scene.add(hemi);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
  dirLight.position.set(5, 8, 3);
  scene.add(dirLight);

  function addCeilingLamp(x, z) {
    const fixture = new THREE.PointLight(0xfff6e0, 0.9, 10, 2);
    fixture.position.set(x, ROOM.wallHeight - 0.2, z);
    scene.add(fixture);
    const bulb = box(0.6, 0.06, 0.6, 0xffffff, { emissive: 0xffffcc, emissiveIntensity: 0.8 });
    bulb.position.set(x, ROOM.wallHeight - 0.1, z);
    group.add(bulb);
  }
  addCeilingLamp(-4, 0);
  addCeilingLamp(4, 0);
  addCeilingLamp(12, 0);

  return {
    colliders,
    deskA,
    deskB,
    supplyTop,
    sinks: [sinkA, sinkB],
  };
}
