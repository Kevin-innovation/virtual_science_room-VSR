// Physical placement of objects: real footprints (no overlaps), gravity, and landing.
//
// Every object is measured from its actual meshes, so an item has a footprint and a
// height. Loose items (beakers, bottles, ...) can rest on each other; fixed fixtures
// (lamp, tripod, tubes, rack) block sideways but never act as a shelf.
import * as THREE from "three";
import { ROOM } from "./constants.js";

const GRAVITY = -9.8;
const SUPPORT_EPS = 0.02; // an item this close to a loose item's top counts as resting on it
const EDGE_GAP = 0.002;
const DOWN = new THREE.Vector3(0, -1, 0);

// Hidden parts (and anything under a hidden ancestor) do not take up room.
export function isShown(obj) {
  for (let o = obj; o; o = o.parent) if (!o.visible) return false;
  return true;
}

const _tmpBox = new THREE.Box3();
function accumulate(o, box) {
  if (!o.visible) return;
  if (o.isMesh && o.geometry) {
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    _tmpBox.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    box.union(_tmpBox);
  }
  for (const c of o.children) accumulate(c, box);
}

// World-space box of an object's visible meshes. Sprites (name labels) are skipped.
export function worldBox(root) {
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  accumulate(root, box);
  return box;
}

// The object's footprint, as offsets from its origin (its position).
export function footprintOf(root) {
  const b = worldBox(root);
  if (b.isEmpty()) return { minX: -0.05, maxX: 0.05, minY: 0, maxY: 0.1, minZ: -0.05, maxZ: 0.05 };
  const o = root.getWorldPosition(new THREE.Vector3());
  return {
    minX: b.min.x - o.x,
    maxX: b.max.x - o.x,
    minY: b.min.y - o.y,
    maxY: b.max.y - o.y,
    minZ: b.min.z - o.z,
    maxZ: b.max.z - o.z,
  };
}

export function createWorld({ scene, registry, roomInfo }) {
  const falling = []; // { obj, vy, fp, startBottom, breakable }
  const downRay = new THREE.Raycaster();

  // Everything on the scene that an item could bump into or rest on.
  function obstacles(exclude) {
    const list = [];
    for (const o of registry.values()) {
      if (o === exclude || o.parent !== scene || !isShown(o) || o.userData.busy) continue;
      const box = worldBox(o);
      if (box.isEmpty()) continue;
      list.push({ obj: o, box, carryable: !!o.userData.carryable });
    }
    return list;
  }

  function clampToRoom(item, fp) {
    const cx = item.position.x + (fp.minX + fp.maxX) / 2;
    const cz = item.position.z + (fp.minZ + fp.maxZ) / 2;
    const hx = (fp.maxX - fp.minX) / 2 + 0.05;
    const hz = (fp.maxZ - fp.minZ) / 2 + 0.05;
    const nx = THREE.MathUtils.clamp(cx, ROOM.minX + hx, ROOM.maxX - hx);
    const nz = THREE.MathUtils.clamp(cz, ROOM.minZ + hz, ROOM.maxZ - hz);
    item.position.x += nx - cx;
    item.position.z += nz - cz;
  }

  // Push the item sideways out of any obstacle it overlaps (minimum-distance push).
  function pushOut(item, fp, obs) {
    for (let pass = 0; pass < 4; pass++) {
      let moved = false;
      const bottom = item.position.y + fp.minY;
      for (const ob of obs) {
        // a loose item we are standing on or above is not a sideways obstacle
        if (ob.carryable && bottom >= ob.box.max.y - SUPPORT_EPS) continue;
        const x0 = item.position.x + fp.minX;
        const x1 = item.position.x + fp.maxX;
        const z0 = item.position.z + fp.minZ;
        const z1 = item.position.z + fp.maxZ;
        const ox = Math.min(x1, ob.box.max.x) - Math.max(x0, ob.box.min.x);
        const oz = Math.min(z1, ob.box.max.z) - Math.max(z0, ob.box.min.z);
        if (ox <= EDGE_GAP || oz <= EDGE_GAP) continue;
        if (ox < oz) {
          const dir = (x0 + x1) / 2 < (ob.box.min.x + ob.box.max.x) / 2 ? -1 : 1;
          item.position.x += dir * (ox + 0.002);
        } else {
          const dir = (z0 + z1) / 2 < (ob.box.min.z + ob.box.max.z) / 2 ? -1 : 1;
          item.position.z += dir * (oz + 0.002);
        }
        moved = true;
      }
      if (!moved) break;
    }
  }

  // Highest surface under the item's footprint that it has reached. `fromBottom` is the
  // item's bottom at the start of this step, so a top passed through during the step counts.
  function groundBelow(item, fp, obs, fromBottom = item.position.y + fp.minY) {
    const bottom = item.position.y + fp.minY;
    const x0 = item.position.x + fp.minX;
    const x1 = item.position.x + fp.maxX;
    const z0 = item.position.z + fp.minZ;
    const z1 = item.position.z + fp.maxZ;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;

    let y = 0; // room floor
    // the renderer only refreshes world matrices once a frame, and we also settle at startup
    for (const m of roomInfo.groundMeshes) m.updateWorldMatrix(true, false);
    downRay.set(new THREE.Vector3(cx, bottom + 0.3, cz), DOWN);
    downRay.far = 20;
    const hits = downRay.intersectObjects(roomInfo.groundMeshes, false);
    if (hits.length) y = hits[0].point.y;

    for (const ob of obs) {
      if (!ob.carryable) continue; // fixed fixtures do not support anything
      if (ob.box.max.y > fromBottom + SUPPORT_EPS) continue; // was below it, not above
      if (ob.box.max.y <= y) continue;
      const overlaps =
        Math.min(x1, ob.box.max.x) - Math.max(x0, ob.box.min.x) > EDGE_GAP &&
        Math.min(z1, ob.box.max.z) - Math.max(z0, ob.box.min.z) > EDGE_GAP;
      if (overlaps) y = ob.box.max.y;
    }
    return y;
  }

  // Let go of an item above the crosshair point: its footprint centre goes exactly
  // under the crosshair, then it falls.
  function dropAt(item, x, z) {
    const fp = footprintOf(item);
    item.position.x = x - (fp.minX + fp.maxX) / 2;
    item.position.z = z - (fp.minZ + fp.maxZ) / 2;
    clampToRoom(item, fp);
    falling.push({
      obj: item,
      vy: 0,
      fp,
      startBottom: item.position.y + fp.minY,
      breakable: !!item.userData.breakable,
    });
  }

  function cancelFall(item) {
    const i = falling.findIndex((f) => f.obj === item);
    if (i !== -1) falling.splice(i, 1);
  }

  // Put an item down where it is (no fall): resting on what is below, then clear of others.
  function settle(item) {
    const fp = footprintOf(item);
    const obs = obstacles(item);
    const g = groundBelow(item, fp, obs);
    item.position.y = g - fp.minY;
    pushOut(item, fp, obs);
    clampToRoom(item, fp);
  }

  function respawn(item, spawnPos) {
    item.position.copy(spawnPos);
    settle(item);
  }

  // onLand(item, fallDistance) is called once an item comes to rest.
  function update(dt, onLand) {
    for (let i = falling.length - 1; i >= 0; i--) {
      const f = falling[i];
      const item = f.obj;
      const prevBottom = item.position.y + f.fp.minY;
      f.vy += GRAVITY * dt;
      item.position.y += f.vy * dt;
      const obs = obstacles(item);
      // Check for landing before pushing sideways: a fast item can drop past a loose
      // item's top within one frame, and must land on it rather than be pushed aside.
      const bottom = item.position.y + f.fp.minY;
      const g = groundBelow(item, f.fp, obs, Math.max(prevBottom, bottom));
      if (bottom <= g) {
        item.position.y = g - f.fp.minY;
        pushOut(item, f.fp, obs);
        clampToRoom(item, f.fp);
        falling.splice(i, 1);
        if (onLand) onLand(item, f.startBottom - g);
      } else {
        pushOut(item, f.fp, obs);
      }
    }
  }

  // Put every loose item that starts on the supply table where it truly rests.
  function settleAll() {
    for (const o of registry.values()) {
      if (o.userData.carryable && o.parent === scene) settle(o);
    }
  }

  return { dropAt, cancelFall, settle, respawn, update, settleAll };
}
