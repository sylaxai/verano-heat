// Puerto Verano city builder: roads, sidewalks, buildings, props, beach + ocean.
// Exposes colliders (AABBs), road data for traffic, and named places.
import * as THREE from 'three';
import { WORLD, PLACES, COLORS } from './config.js';
import { makeRng, pick, range } from './rng.js';

function canvasTexture(draw, w = 128, h = 128) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildingTexture(base, rng) {
  return canvasTexture((g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 8; y += 16) for (let x = 8; x < w - 8; x += 14) {
      g.fillStyle = rng() > 0.35 ? '#ffe9a8' : '#274b5c';
      g.fillRect(x, y, 8, 10);
      g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x, y, 8, 3);
    }
  });
}
const PASTELS = ['#f7c8a0', '#f9e2ae', '#a8d8ea', '#f6a6c1', '#b5e7a0', '#ffe5b4', '#cdb4f0', '#ffb4a2', '#9be7c4', '#f4f1de'];

export function buildCity(scene, seed = 1) {
  const rng = makeRng(seed * 7919 + 13);
  const colliders = []; // {minX,maxX,minZ,maxZ}
  const group = new THREE.Group(); scene.add(group);
  scene.background = new THREE.Color(COLORS.sky);
  scene.fog = new THREE.Fog(COLORS.fog, 180, 520);
  const sun = new THREE.DirectionalLight(COLORS.sun, 2.6);
  sun.position.set(90, 140, 60); scene.add(sun);
  scene.add(new THREE.AmbientLight(0xfff2d9, 1.1));
  const hemi = new THREE.HemisphereLight(0xbfe8ff, 0xe8d193, 0.7); scene.add(hemi);

  const groundMat = new THREE.MeshLambertMaterial({ color: 0xd9c9a3 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; group.add(ground);

  // Roads: asphalt strips + dashed centre lines + sidewalks.
  const roadMat = new THREE.MeshLambertMaterial({ color: COLORS.road });
  const walkMat = new THREE.MeshLambertMaterial({ color: COLORS.sidewalk });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffd23c });
  const extent = 215;
  for (const v of WORLD.roadLines) {
    for (const alongZ of [true, false]) {
      const len = extent * 2;
      const road = new THREE.Mesh(new THREE.PlaneGeometry(alongZ ? WORLD.roadWidth : len, alongZ ? len : WORLD.roadWidth), roadMat);
      road.rotation.x = -Math.PI / 2; road.position.set(alongZ ? v : 0, 0.01, alongZ ? 0 : v); group.add(road);
      for (const side of [-1, 1]) {
        const w = WORLD.sidewalk;
        const walk = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? w : len, 0.22, alongZ ? len : w), walkMat);
        walk.position.set(alongZ ? v + side * (WORLD.roadWidth / 2 + w / 2) : 0, 0.11, alongZ ? 0 : v + side * (WORLD.roadWidth / 2 + w / 2));
        group.add(walk);
      }
      for (let d = -extent + 8; d < extent; d += 14) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(alongZ ? 0.5 : 5, alongZ ? 5 : 0.5), lineMat);
        dash.rotation.x = -Math.PI / 2; dash.position.set(alongZ ? v : d, 0.03, alongZ ? d : v); group.add(dash);
      }
    }
  }
  // Beach sand + ocean water plane.
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(560, 60), new THREE.MeshLambertMaterial({ color: COLORS.sand }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.02, WORLD.beachZ + 22); group.add(sand);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(560, 130), new THREE.MeshPhongMaterial({ color: COLORS.water, shininess: 120, transparent: true, opacity: 0.92 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, 0.12, WORLD.waterZ + 55); water.name = 'ocean'; group.add(water);
  // Marina pier.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(46, 1, 26), pierMat);
  pier.position.set(PLACES.marina.x, 0.5, PLACES.marina.z + 8); group.add(pier);
  colliders.push({ minX: PLACES.marina.x - 23, maxX: PLACES.marina.x + 23, minZ: PLACES.marina.z - 6, maxZ: PLACES.marina.z + 4 });

  // Buildings inside each block between roads.
  const edges = [-215, ...WORLD.roadLines, 215];
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x8d6e63 });
  for (let bi = 0; bi < edges.length - 1; bi++) for (let bj = 0; bj < edges.length - 1; bj++) {
    const x0 = edges[bi] + WORLD.roadWidth / 2 + WORLD.sidewalk + 2, x1 = edges[bi + 1] - WORLD.roadWidth / 2 - WORLD.sidewalk - 2;
    const z0 = edges[bj] + WORLD.roadWidth / 2 + WORLD.sidewalk + 2, z1 = edges[bj + 1] - WORLD.roadWidth / 2 - WORLD.sidewalk - 2;
    if (x1 - x0 < 16 || z1 - z0 < 16) continue;
    if (z0 > WORLD.beachZ - 10) continue;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (Math.abs(cx - PLACES.garage.x) < 26 && Math.abs(cz - PLACES.garage.z) < 26) continue;
    if (Math.abs(cx - PLACES.hideout.x) < 26 && Math.abs(cz - PLACES.hideout.z) < 26) continue;
    const n = rng() > 0.5 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const wdt = range(rng, 13, Math.min(24, (x1 - x0) / n));
      const dep = range(rng, 13, 22); const hgt = range(rng, 10, 42);
      const bx = n === 1 ? cx : x0 + (k + 0.5) * ((x1 - x0) / n);
      const bz = cz + range(rng, -3, 3);
      const tex = buildingTexture(pick(rng, PASTELS), rng);
      const mat = new THREE.MeshLambertMaterial({ map: tex });
      const b = new THREE.Mesh(new THREE.BoxGeometry(wdt, hgt, dep), [mat, mat, roofMat, roofMat, mat, mat]);
      b.position.set(bx, hgt / 2, bz); group.add(b);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(wdt + 1, 1.2, dep + 1), new THREE.MeshLambertMaterial({ color: 0xff7a3c }));
      trim.position.set(bx, hgt + 0.4, bz); group.add(trim);
      colliders.push({ minX: bx - wdt / 2, maxX: bx + wdt / 2, minZ: bz - dep / 2, maxZ: bz + dep / 2 });
    }
  }
  // Garage + hideout landmark boxes with neon signs.
  function landmark(place, color, signText) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(20, 7, 16), new THREE.MeshLambertMaterial({ color }));
    base.position.set(place.x, 3.5, place.z); group.add(base);
    colliders.push({ minX: place.x - 10, maxX: place.x + 10, minZ: place.z - 8, maxZ: place.z + 8 });
    const signTex = canvasTexture((g, w, h) => {
      g.fillStyle = '#101820'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffd23c'; g.font = 'bold 17px Verdana'; g.textAlign = 'center';
      g.fillText(signText, w / 2, h / 2 + 6);
    }, 256, 48);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(18, 3.4), new THREE.MeshBasicMaterial({ map: signTex }));
    sign.position.set(place.x, 8.2, place.z + 8.2); group.add(sign);
    const pad = new THREE.Mesh(new THREE.CircleGeometry(7, 24), new THREE.MeshBasicMaterial({ color: 0x2ec4b6, transparent: true, opacity: 0.35 }));
    pad.rotation.x = -Math.PI / 2; pad.position.set(place.x, 0.06, place.z + 16); group.add(pad);
    return { padPos: new THREE.Vector3(place.x, 0, place.z + 16) };
  }
  const garageInfo = landmark(PLACES.garage, 0xffe5b4, 'SOLANA GARAGE');
  const hideoutInfo = landmark(PLACES.hideout, 0xa8d8ea, 'CALLE LUNA');

  // Props: palms, lamps, benches.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e9e4f });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x37474f });
  const lampGlow = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x6d4c41 });
  function palm(x, z) {
    const p = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 5.4, 6), trunkMat);
    trunk.position.y = 2.7; trunk.rotation.z = range(rng, -0.08, 0.08); p.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.4, 4), leafMat);
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.2, 5.6, Math.sin(a) * 1.2);
      leaf.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1); p.add(leaf);
    }
    p.position.set(x, 0, z); group.add(p);
    colliders.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5 });
  }
  function lamp(x, z) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 6), lampMat);
    pole.position.set(x, 2.5, z); group.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 8), lampGlow);
    bulb.position.set(x, 5.1, z); group.add(bulb);
  }
  function bench(x, z, rotY) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.8), benchMat);
    b.position.set(x, 0.6, z); b.rotation.y = rotY; group.add(b);
  }
  for (const v of WORLD.roadLines) for (let d = -200; d <= 200; d += 40) {
    const off = WORLD.roadWidth / 2 + WORLD.sidewalk / 2;
    if (rng() > 0.3) palm(v + off + range(rng, -1, 1), d + range(rng, -4, 4));
    if (rng() > 0.4) lamp(v - off, d + 18);
    if (rng() > 0.55) bench(d + 10, v + off, rng() * 3);
  }
  for (let x = -200; x <= 200; x += 26) palm(x + range(rng, -4, 4), WORLD.beachZ + range(rng, 2, 10));

  // Objective beacon (moved by missions).
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 30, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }));
  beacon.position.set(PLACES.garage.x, 15, PLACES.garage.z + 16); beacon.visible = false; group.add(beacon);

  return { group, colliders, water, beacon, garagePad: garageInfo.padPos, hideoutPad: hideoutInfo.padPos };
}

// AABB collision resolve: push a point (with radius) out of every collider.
export function collide(colliders, pos, radius = 0.7) {
  for (const c of colliders) {
    if (pos.x > c.minX - radius && pos.x < c.maxX + radius && pos.z > c.minZ - radius && pos.z < c.maxZ + radius) {
      const dxl = pos.x - (c.minX - radius), dxr = (c.maxX + radius) - pos.x;
      const dzl = pos.z - (c.minZ - radius), dzr = (c.maxZ + radius) - pos.z;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) pos.x = c.minX - radius; else if (m === dxr) pos.x = c.maxX + radius;
      else if (m === dzl) pos.z = c.minZ - radius; else pos.z = c.maxZ + radius;
    }
  }
  pos.x = Math.max(-212, Math.min(212, pos.x));
  pos.z = Math.max(-212, Math.min(268, pos.z));
  return pos;
}
export function hitsBuilding(colliders, x, z, r = 1) {
  for (const c of colliders) if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return true;
  return false;
}
