// Car factory + traffic for VERANO HEAT: original procedural car meshes,
// parked cars, and simple lane AI that follows the road grid.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { makeRng, pick, range } from './rng.js';
import { hitsBuilding } from './city.js';

const CAR_STYLES = [
  { name: 'Solana Coupe', color: 0xff4d6d, len: 4.2, wid: 1.9, cab: 0.55 },
  { name: 'Verano Sedan', color: 0x2ec4b6, len: 4.6, wid: 1.95, cab: 0.6 },
  { name: 'Palmera Pickup', color: 0xffb703, len: 4.9, wid: 2.0, cab: 0.4 },
  { name: 'Coral Hatch', color: 0x74c0fc, len: 3.8, wid: 1.8, cab: 0.65 },
  { name: 'Duna Buggy', color: 0xb5e7a0, len: 3.6, wid: 1.85, cab: 0.3 },
  { name: 'Noche Van', color: 0x9d6bc9, len: 5.0, wid: 2.0, cab: 0.85 },
];
const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14181c });
const glassMat = new THREE.MeshPhongMaterial({ color: 0x2f5d75, shininess: 90 });

export function makeCarMesh(styleIdx, colorOverride = null, isPolice = false) {
  const st = CAR_STYLES[styleIdx % CAR_STYLES.length];
  const g = new THREE.Group();
  const bodyColor = isPolice ? 0xf4f4f4 : (colorOverride ?? st.color);
  const bodyMat = new THREE.MeshPhongMaterial({ color: bodyColor, shininess: 60 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(st.wid, 0.62, st.len), bodyMat);
  body.position.y = 0.62; g.add(body);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(st.wid * 0.92, 0.3, st.len * 0.22), bodyMat);
  hood.position.set(0, 0.82, st.len * 0.36); g.add(hood);
  const cabLen = st.len * st.cab;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(st.wid * 0.84, 0.55, cabLen), glassMat);
  cab.position.set(0, 1.18, -st.len * 0.05); g.add(cab);
  if (isPolice) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(st.wid + 0.04, 0.3, st.len * 0.9), new THREE.MeshLambertMaterial({ color: 0x123a5c }));
    stripe.position.y = 0.62; g.add(stripe);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2244 }));
    bar.position.set(0, 1.56, -st.len * 0.05); bar.name = 'lightbar'; g.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    bar2.position.set(0.45, 1.56, -st.len * 0.05); bar2.name = 'lightbar2'; g.add(bar2);
  }
  const hl = new THREE.Mesh(new THREE.BoxGeometry(st.wid * 0.8, 0.16, 0.08), new THREE.MeshBasicMaterial({ color: 0xfff6b0 }));
  hl.position.set(0, 0.66, st.len / 2 + 0.02); g.add(hl);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(st.wid * 0.8, 0.14, 0.08), new THREE.MeshBasicMaterial({ color: 0xff3344 }));
  tl.position.set(0, 0.7, -st.len / 2 - 0.02); g.add(tl);
  const wheels = [];
  for (const [wx, wz] of [[-st.wid / 2, st.len * 0.32], [st.wid / 2, st.len * 0.32], [-st.wid / 2, -st.len * 0.32], [st.wid / 2, -st.len * 0.32]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.36, wz); g.add(w); wheels.push(w);
  }
  g.userData.wheels = wheels; g.userData.styleName = st.name;
  return g;
}

export class Car {
  constructor(scene, styleIdx, x, z, heading, opts = {}) {
    this.mesh = makeCarMesh(styleIdx, opts.color ?? null, !!opts.police);
    this.mesh.position.set(x, 0, z); this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.pos = this.mesh.position; this.heading = heading;
    this.speed = 0; this.steer = 0; this.occupied = false; this.police = !!opts.police;
    this.styleIdx = styleIdx; this.dead = false; this.health = 100;
    this.ai = opts.ai || null; // {axis:'x'|'z', dir, lane, wait}
    this.name = CAR_STYLES[styleIdx % CAR_STYLES.length].name;
  }
  syncWheels(dt) {
    for (const w of this.mesh.userData.wheels) w.rotation.x += (this.speed * dt) / 0.36;
  }
  forward() { return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)); }
}

export class Traffic {
  constructor(scene, colliders, seed = 1) {
    this.cars = []; this.colliders = colliders;
    const rng = makeRng(seed * 331 + 7);
    // Moving traffic on road lines.
    for (let i = 0; i < 14; i++) {
      const axis = rng() > 0.5 ? 'z' : 'x';
      const line = pick(rng, WORLD.roadLines);
      const dir = rng() > 0.5 ? 1 : -1;
      const lane = dir * 3.6;
      const along = range(rng, -190, 190);
      const x = axis === 'z' ? line + lane : along;
      const z = axis === 'z' ? along : line - lane;
      const heading = axis === 'z' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      const car = new Car(scene, i % CAR_STYLES.length, x, z, heading, { ai: { axis, dir, lane, wait: 0, cruise: range(rng, 8, 13) } });
      this.cars.push(car);
    }
    // Parked cars along curbs.
    for (let i = 0; i < 16; i++) {
      const line = pick(rng, WORLD.roadLines);
      const vertical = rng() > 0.5;
      const along = range(rng, -185, 185);
      const off = (WORLD.roadWidth / 2 - 2.2) * (rng() > 0.5 ? 1 : -1);
      const x = vertical ? line + off : along;
      const z = vertical ? along : line + off;
      if (hitsBuilding(colliders, x, z, 3)) continue;
      const heading = vertical ? (off > 0 ? 0 : Math.PI) : (off > 0 ? Math.PI / 2 : -Math.PI / 2);
      this.cars.push(new Car(scene, Math.floor(rng() * CAR_STYLES.length), x, z, heading, {}));
    }
  }
  update(dt, playerPos, playerSpeeding) {
    for (const car of this.cars) {
      if (car.occupied || car.dead || !car.ai) continue;
      const ai = car.ai;
      if (ai.wait > 0) { ai.wait -= dt; car.speed = 0; continue; }
      // Stop if player or another car is right ahead.
      const fwd = car.forward();
      const ahead = car.pos.clone().addScaledVector(fwd, 6);
      let blocked = false;
      if (playerPos && ahead.distanceTo(playerPos) < 4.5) blocked = true;
      if (!blocked) for (const other of this.cars) {
        if (other === car || other.dead) continue;
        if (ahead.distanceTo(other.pos) < 4) { blocked = true; break; }
      }
      car.speed = blocked ? 0 : ai.cruise;
      car.pos.addScaledVector(fwd, car.speed * dt);
      // At an intersection, sometimes wait, sometimes turn.
      const nearLine = WORLD.roadLines.find((l) => Math.abs((ai.axis === 'z' ? car.pos.z : car.pos.x) - l) < 1.2);
      if (nearLine !== undefined && Math.random() < 0.012) {
        if (Math.random() < 0.35) ai.wait = 1 + Math.random() * 2;
        else if (Math.random() < 0.5) this.turn(car);
      }
      if (car.pos.x > 208 || car.pos.x < -208) { car.pos.x *= -0.96; this.flip(car); }
      if (car.pos.z > 208 || car.pos.z < -208) { car.pos.z *= -0.96; this.flip(car); }
      car.mesh.rotation.y = car.heading; car.syncWheels(dt);
    }
  }
  turn(car) {
    const ai = car.ai; if (!ai) return;
    ai.axis = ai.axis === 'z' ? 'x' : 'z';
    if (Math.random() < 0.5) ai.dir *= -1;
    ai.lane = ai.dir * 3.6;
    const line = ai.axis === 'z' ? car.pos.x : car.pos.z;
    const snapped = WORLD.roadLines.reduce((a, b) => (Math.abs(b - line) < Math.abs(a - line) ? b : a), WORLD.roadLines[0]);
    if (ai.axis === 'z') { car.pos.x = snapped + ai.lane; car.heading = ai.dir > 0 ? 0 : Math.PI; }
    else { car.pos.z = snapped - ai.lane; car.heading = ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
  }
  flip(car) {
    const ai = car.ai; if (!ai) return;
    ai.dir *= -1; ai.lane = ai.dir * 3.6;
    if (ai.axis === 'z') car.heading = ai.dir > 0 ? 0 : Math.PI;
    else car.heading = ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  nearest(pos, maxDist) {
    let best = null, bd = maxDist;
    for (const c of this.cars) { if (c.dead) continue; const d = c.pos.distanceTo(pos); if (d < bd) { bd = d; best = c; } }
    return best;
  }
}
