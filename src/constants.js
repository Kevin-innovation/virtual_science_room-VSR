// Shared room layout constants (hand-drawn reference: Main_Room.png)
// Long open room (main lab) on the west side, materials room (재료실) on the east side.

export const ROOM = {
  minX: -9.3,
  maxX: 16.3,
  minZ: -5.3,
  maxZ: 5.3,
  wallHeight: 4,
  materialsRoomStartX: 9, // zone boundary (no physical wall, open room)
};

export const DESK_A = { x: -5.5, z: 1.6, w: 2.2, d: 1.0, h: 0.9 }; // heating desk
export const DESK_B = { x: -2.2, z: -1.6, w: 2.2, d: 1.0, h: 0.9 }; // test tube desk

export const SUPPLY_TABLE = { x: 11.5, z: 0, w: 7.5, d: 1.1, h: 0.9 };

export const SINK_A = { x: -7.2, z: -5.3 };
export const SINK_B = { x: 2.0, z: -5.3 };

export const SHOWER = { x: 8.2, z: -4.9 };

export const SPAWN = { x: -3, y: 1.6, z: 4 };

export const PLAYER_RADIUS = 0.35;
export const REACH = 3.2;
