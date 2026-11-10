// Shared room layout constants (hand-drawn reference: Main_Room.png)
// Long open room (main lab) on the west side, materials room (재료실) on the east side.
//
// PART_5: the room is 55% as wide as the original 25.6m layout (was 65%) and the
// furniture is packed closer together. There is one sink, placed next to the
// heating desk and the tube desk, and the emergency shower sits right beside it.

const ORIGINAL_MIN_X = -9.3;
const ORIGINAL_MAX_X = 16.3;
const LAB_WIDTH_SCALE = 0.55;

export function scaleX(x) {
  return ORIGINAL_MIN_X + (x - ORIGINAL_MIN_X) * LAB_WIDTH_SCALE;
}

export const ROOM = {
  minX: ORIGINAL_MIN_X,
  maxX: scaleX(ORIGINAL_MAX_X),
  minZ: -5.3,
  maxZ: 5.3,
  wallHeight: 4,
  materialsRoomStartX: scaleX(8), // zone boundary (no physical wall, open room)
};

export const DESK_A = { x: scaleX(-5.5), z: 1.6, w: 2.2, d: 1.0, h: 0.9 }; // heating desk
export const DESK_B = { x: scaleX(-2.2), z: -1.6, w: 2.2, d: 1.0, h: 0.9 }; // test tube desk

// centred in the materials room
export const SUPPLY_TABLE = {
  x: (ROOM.materialsRoomStartX + ROOM.maxX) / 2,
  z: 0,
  w: 2.5,
  d: 1.1,
  h: 0.9,
};

// the one sink, between the two desks and the back wall
export const SINK = { x: -6.3, z: -5.3 };

// the emergency shower, beside the sink (must be walked to and switched on)
export const SHOWER = { x: -4.4, z: -4.9 };

export const SPAWN = { x: scaleX(-3), y: 1.6, z: 4 };

export const PLAYER_RADIUS = 0.35;
export const REACH = 3.2;
