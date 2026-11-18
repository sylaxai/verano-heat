// Pedestrians + shared low-poly human figure builder for VERANO HEAT.
// Peds stroll sidewalks, flee gunfire and speeding cars, and fall when shot.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { makeRng, pick, range } from './rng.js';

const SHIRTS = [0xff6b6b, 0x4dabf7, 0xffd43b, 0x69db7c, 0xf783ac, 0xffa94d, 0xe599f7, 0x63e6be];
const SKINS = [0xf1c27d, 0xe0ac69, 0x8d5524, 0xffdbac, 0xc68642];

export function makeFigure(shirt = 0x4dabf7, pants = 0x2b3a4a, skin = 0xf1c27d) {
  const g = new THREE.Group();
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skinMat); head.position.y = 1.62; g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.12, 10), shirtMat); cap.position.y = 1.82; g.add(cap);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.66, 0.3), shirtMat); torso.position.y = 1.12; g.add(torso);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), pantsMat); legL.position.set(-0.15, 0.45, 0); legL.name = 'legL'; g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.15; legR.name = 'legR'; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.58, 0.16), shirtMat); armL.position.set(-0.37, 1.14, 0); armL.name = 'armL'; g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.37; armR.name = 'armR'; g.add(armR);
  g.userData.parts = { legL, legR, armL, armR, head, torso };
  return g;
}
export function animateFigure(fig, t, speedRatio = 1) {
  const p = fig.userData.parts; if (!p) return;
  const s = Math.sin(t * 9) * 0.5 * speedRatio;
  p.legL.rotation.x = s; p.legR.rotation.x = -s; p.armL.rotation.x = -s * 0.8; p.armR.rotation.x = s * 0.8;
}
export function toppleFigure(fig) { fig.rotation.x = -Math.PI / 2; fig.position.y = 0.25; }

export class Ped {
  constructor(scene, rng) {
    this.mesh = makeFigure(pick(rng, SHIRTS), pick(rng, [0x2b3a4a, 0x5c3d2e, 0x37474f, 0xffffff]), pick(rng, SKINS));
    // Walk along a sidewalk: pick a road line and an offset side.
    this.axis = rng() > 0.5 ? 'z' : 'x';
    this.line = pick(rng, WORLD.roadLines);
    this.side = (rng() > 0.5 ? 1 : -1) * (WORLD.roadWidth / 2 + 2.4);
    this.along = range(rng, -195, 195);
    this.dir = rng() > 0.5 ? 1 : -1;
    this.speed = range(rng, 1.2, 2.1);
    this.state = 'walk'; this.fleeT = 0; this.dead = false; this.health = 30;
    this.walkT = Math.random() * 10;
    this.syncPos(); scene.add(this.mesh);
  }
  syncPos() {
    if (this.axis === 'z') this.mesh.position.set(this.line + this.side, 0.22, this.along);
    else this.mesh.position.set(this.along, 0.22, this.line + this.side);
    this.mesh.rotation.y = this.axis === 'z' ? (this.dir > 0 ? 0 : Math.PI) : (this.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  }
  get pos() { return this.mesh.position; }
  flee(fromPos, dur = 4) { if (!this.dead) { this.state = 'flee'; this.fleeT = dur; this.fleeFrom = fromPos.clone(); } }
  update(dt) {
    if (this.dead) return;
    this.walkT += dt;
    let sp = this.speed;
    if (this.state === 'flee') {
      sp = 5.2; this.fleeT -= dt;
      const away = this.mesh.position.clone().sub(this.fleeFrom || this.mesh.position); away.y = 0;
      if (away.lengthSq() > 0.01) {
        away.normalize();
        this.mesh.position.addScaledVector(away, sp * dt);
        this.mesh.rotation.y = Math.atan2(away.x, away.z);
        animateFigure(this.mesh, this.walkT, 1.6);
        if (this.fleeT <= 0) this.state = 'walk';
        return;
      }
      if (this.fleeT <= 0) this.state = 'walk';
    }
    this.along += this.dir * sp * dt;
    if (this.along > 200) { this.along = 200; this.dir = -1; }
    if (this.along < -200) { this.along = -200; this.dir = 1; }
    if (Math.random() < 0.002) { // switch street at an intersection sometimes
      const cross = WORLD.roadLines.find((l) => Math.abs(this.along - l) < 1);
      if (cross !== undefined) { const old = this.along; this.along = this.line + this.side; this.line = cross; this.axis = this.axis === 'z' ? 'x' : 'z'; this.along = old; }
    }
    this.syncPos(); animateFigure(this.mesh, this.walkT, sp / 2);
  }
  kill() { this.dead = true; toppleFigure(this.mesh); }
}

export class PedCrowd {
  constructor(scene, seed = 1, count = 26) {
    this.peds = []; const rng = makeRng(seed * 977 + 3);
    for (let i = 0; i < count; i++) this.peds.push(new Ped(scene, rng));
    this.scene = scene;
  }
  update(dt) { for (const p of this.peds) p.update(dt); }
  panic(center, radius = 26) { for (const p of this.peds) if (p.pos.distanceTo(center) < radius) p.flee(center); }
  nearestAlive(pos, maxDist) {
    let best = null, bd = maxDist;
    for (const p of this.peds) { if (p.dead) continue; const d = p.pos.distanceTo(pos); if (d < bd) { bd = d; best = p; } }
    return best;
  }
}
