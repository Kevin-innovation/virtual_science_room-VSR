// Shared room layout constants (hand-drawn reference: Main_Room.png)
// Long open room (main lab) on the west side, materials room (재료실) on the east side.
//
// The room is 65% as wide as the original 25.6m layout. Every X position below is
// remapped from the original design so the furniture keeps its relative placement.

const ORIGINAL_MIN_X = -9.3;
const ORIGINAL_MAX_X = 16.3;
const LAB_WIDTH_SCALE = 0.65;

export function scaleX(x) {
  return ORIGINAL_MIN_X + (x - ORIGINAL_MIN_X) * LAB_WIDTH_SCALE;
}

export const ROOM = {
  minX: ORIGINAL_MIN_X,
  maxX: scaleX(ORIGINAL_MAX_X),
  minZ: -5.3,
  maxZ: 5.3,
  wallHeight: 4,
  materialsRoomStartX: scaleX(9), // zone boundary (no physical wall, open room)
};

export const DESK_A = { x: scaleX(-5.5), z: 1.6, w: 2.2, d: 1.0, h: 0.9 }; // heating desk
export const DESK_B = { x: scaleX(-2.2), z: -1.6, w: 2.2, d: 1.0, h: 0.9 }; // test tube desk

// 33% of the original 7.5m, centred in the materials room
export const SUPPLY_TABLE = {
  x: (ROOM.materialsRoomStartX + ROOM.maxX) / 2,
  z: 0,
  w: 2.5,
  d: 1.1,
  h: 0.9,
};

export const SINK_A = { x: scaleX(-7.2), z: -5.3 };
export const SINK_B = { x: scaleX(2.0), z: -5.3 };

export const SHOWER = { x: scaleX(8.2), z: -4.9 };

export const SPAWN = { x: scaleX(-3), y: 1.6, z: 4 };

export const PLAYER_RADIUS = 0.35;
export const REACH = 3.2;
