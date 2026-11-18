// Combat for VERANO HEAT: hitscan shooting with tracer + muzzle flash,
// plus rival gang members (Los Brasa crew) who shoot back during jobs.
import * as THREE from 'three';
import { makeFigure, animateFigure, toppleFigure } from './peds.js';

export class Combat {
  constructor(scene, audio) {
    this.scene = scene; this.audio = audio;
    this.tracers = []; this.cooldown = 0;
    this.flash = new THREE.PointLight(0xffcc66, 0, 18);
    scene.add(this.flash);
    this.gang = []; // {mesh, health, dead, shootT, pos}
  }
  spawnGangMember(x, z) {
    const mesh = makeFigure(0x8d0801, 0x1a1a1a, 0xc68642);
    mesh.position.set(x, 0.22, z); this.scene.add(mesh);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.4, 1.15, 0.3); mesh.add(gun);
    const m = { mesh, health: 40, dead: false, shootT: 1 + Math.random() * 2, pos: mesh.position, walkT: Math.random() * 5 };
    this.gang.push(m); return m;
  }
  clearGang() { for (const m of this.gang) this.scene.remove(m.mesh); this.gang = []; }
  gangAlive() { return this.gang.filter((m) => !m.dead).length; }
  // Returns what was hit: {kind:'ped'|'gang'|'car'|'none', target}
  shoot(origin, dir, targets) {
    if (this.cooldown > 0) return { kind: 'none' };
    this.cooldown = 0.16;
    this.audio?.gunshot();
    this.flash.position.copy(origin).addScaledVector(dir, 1.2); this.flash.intensity = 26;
    let best = null, bestD = 60;
    const test = (pos, radius, kind, ref) => {
      const to = pos.clone().sub(origin); const along = to.dot(dir);
      if (along < 0 || along > bestD) return;
      const closest = origin.clone().addScaledVector(dir, along);
      if (closest.distanceTo(pos) < radius) { bestD = along; best = { kind, ref, dist: along }; }
    };
    for (const p of targets.peds || []) if (!p.dead) test(p.pos.clone().setY(1.1), 0.75, 'ped', p);
    for (const m of this.gang) if (!m.dead) test(m.pos.clone().setY(1.1), 0.8, 'gang', m);
    for (const c of targets.cars || []) if (!c.dead) test(c.pos.clone().setY(0.9), 2.1, 'car', c);
    const end = origin.clone().addScaledVector(dir, best ? bestD : 45);
    const geo = new THREE.BufferGeometry().setFromPoints([origin.clone().addScaledVector(dir, 0.8), end]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.95 }));
    this.scene.add(line); this.tracers.push({ line, life: 0.07 });
    if (!best) return { kind: 'none' };
    if (best.kind === 'ped') { best.ref.health -= 30; if (best.ref.health <= 0) best.ref.kill(); }
    if (best.kind === 'gang') { best.ref.health -= 25; this.audio?.hit(); if (best.ref.health <= 0 && !best.ref.dead) { best.ref.dead = true; toppleFigure(best.ref.mesh); } }
    if (best.kind === 'car') { best.ref.health -= 8; this.audio?.hit(); }
    return best;
  }
  update(dt, player, onPlayerHit) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.flash.intensity = Math.max(0, this.flash.intensity - dt * 300);
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i]; t.life -= dt;
      if (t.life <= 0) { this.scene.remove(t.line); t.line.geometry.dispose(); this.tracers.splice(i, 1); }
    }
    // Gang AI: strafe toward cover range and shoot back.
    for (const m of this.gang) {
      if (m.dead) continue;
      m.walkT += dt;
      const toP = player.pos.clone().sub(m.pos); toP.y = 0; const d = toP.length();
      m.mesh.rotation.y = Math.atan2(toP.x, toP.z);
      if (d > 16) { toP.normalize(); m.pos.addScaledVector(toP, 3.2 * dt); animateFigure(m.mesh, m.walkT, 1); }
      m.shootT -= dt;
      if (m.shootT <= 0 && d < 34) {
        m.shootT = 1.1 + Math.random() * 1.4;
        this.audio?.gunshot();
        const from = m.pos.clone().setY(1.3);
        const to = player.pos.clone().setY(1.1);
        const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff8866, transparent: true, opacity: 0.8 }));
        this.scene.add(line); this.tracers.push({ line, life: 0.07 });
        const hitChance = Math.max(0.12, 0.5 - d * 0.008);
        if (Math.random() < hitChance) onPlayerHit(6 + Math.random() * 6);
      }
    }
  }
}
