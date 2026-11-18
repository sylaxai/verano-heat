// VERANO HEAT — world constants for Puerto Verano.
export const WORLD = {
  roadLines: [-150, -75, 0, 75, 150],
  roadWidth: 16,
  sidewalk: 5,
  cityHalf: 190,
  beachZ: 196,
  waterZ: 232,
  blockGap: 59,
};
export const PLACES = {
  garage: { x: -150, z: -150, label: 'Solana Garage' },
  hideout: { x: 75, z: -150, label: 'Calle Luna Hideout' },
  marina: { x: 150, z: 205, label: 'Marina Azul' },
  packagePickup: { x: -75, z: 75, label: 'Mercado Central' },
  packageDrop: { x: 150, z: -75, label: 'Hotel Coral' },
  spawn: { x: 8, z: 20 },
  missionCar: { x: -75, z: -8, label: 'Target Coupe' },
};
export const COLORS = {
  sky: 0x87ceeb, sun: 0xffe3a3, fog: 0xf2d8a7,
  road: 0x3a3f44, sidewalk: 0xcbb99a, sand: 0xe8d193, water: 0x1e9bb5,
  grass: 0x7fbf5f,
};
export const ECONOMY = { m1: 400, m2: 600, m3: 800, m4: 1500 };
export const PLAYER = { walk: 7, sprint: 12, health: 100, carAccel: 26, carMax: 34, carReverse: 10 };
