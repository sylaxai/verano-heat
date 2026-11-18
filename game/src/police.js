// Wanted system + police pursuit for VERANO HEAT.
// Stars 1-5 rise with crimes, decay out of sight; police cars chase and ram,
// officers on foot close in and bust the player when they stay in reach.
import * as THREE from 'three';
import { Car } from './cars.js';
import { makeFigure, animateFigure } from './peds.js';
import { collide } from './city.js';

export class Wanted {
  constructor() { this.stars = 0; this.heat = 0; this.hiddenTime = 0; this.forced = 0; }
  crime(points, witnessPos, playerPos) {
    // Crimes count fully when a witness (ped/police) is near, half otherwise.
    const seen = !witnessPos || !playerPos || witnessPos.distanceTo(playerPos) < 40;
    this.heat += seen ? points : points * 0.5;
    this.hiddenTime = 0;
    this.refresh();
  }
  refresh() {
    const base = this.heat >= 90 ? 5 : this.heat >= 55 ? 4 : this.heat >= 32 ? 3 : this.heat >= 16 ? 2 : this.heat >= 5 ? 1 : 0;
    this.stars = Math.max(base, this.forced);
  }
  setForced(n) { this.forced = n; this.refresh(); }
  clearForced() { this.forced = 0; this.refresh(); }
  update(dt, playerSeen) {
    if (this.stars <= 0) return;
    if (playerSeen) this.hiddenTime = 0;
    else {
      this.hiddenTime += dt;
      if (this.hiddenTime > 7) { // decay while hidden
        this.heat = Math.max(0, this.heat - dt * 2.2);
        if (this.forced > 0 && this.hiddenTime > 16) this.forced = Math.max(0, this.forced - 1);
        this.refresh();
      }
    }
  }
  clear() { this.stars = 0; this.heat = 0; this.forced = 0; this.hiddenTime = 0; }
}

class CopCar {
  constructor(scene, x, z) {
    this.car = new Car(scene, 1, x, z, 0, { police: true });
    this.flashT = Math.random() * 2;
  }
  get pos() { return this.car.pos; }
}

export class Police {
  constructor(scene, colliders) {
    this.scene = scene; this.colliders = colliders;
    this.cars = []; this.officers = []; this.maxCars = 0; this.seen = false;
    this.bustMeter = 0;
  }
  spawnPos(playerPos) {
    const a = Math.random() * Math.PI * 2; const d = 55 + Math.random() * 20;
    return new THREE.Vector3(
      Math.max(-205, Math.min(205, playerPos.x + Math.sin(a) * d)), 0,
      Math.max(-205, Math.min(205, playerPos.z + Math.cos(a) * d)));
  }
  update(dt, wanted, player, audio) {
    const want = wanted.stars;
    this.maxCars = want === 0 ? 0 : want === 1 ? 1 : want === 2 ? 2 : want === 3 ? 3 : want === 4 ? 4 : 5;
    while (this.cars.length < this.maxCars) {
      const p = this.spawnPos(player.pos);
      this.cars.push(new CopCar(this.scene, p.x, p.z));
    }
    while (this.cars.length > this.maxCars) {
      const c = this.cars.pop(); this.scene.remove(c.car.mesh);
    }
    this.seen = false;
    const driving = player.mode === 'car';
    for (const cop of this.cars) {
      const car = cop.car;
      const toPlayer = player.pos.clone().sub(car.pos); toPlayer.y = 0;
      const dist = toPlayer.length();
      if (dist < 70) this.seen = true;
      const targetHeading = Math.atan2(toPlayer.x, toPlayer.z);
      let diff = targetHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff * 2.4 * dt * 3));
      const chaseSpeed = driving ? 30 : 17;
      const desired = dist > 4 ? chaseSpeed : 0;
      car.speed += (desired - car.speed) * Math.min(1, dt * 1.6);
      const fwd = car.forward();
      car.pos.addScaledVector(fwd, car.speed * dt);
      collide(this.colliders, car.pos, 1.6); car.pos.y = 0;
      car.mesh.rotation.y = car.heading; car.syncWheels(dt);
      // Flashing light bar.
      cop.flashT += dt * 7;
      const on = Math.sin(cop.flashT) > 0;
      const bar = car.mesh.getObjectByName('lightbar'); const bar2 = car.mesh.getObjectByName('lightbar2');
      if (bar) bar.material.color.setHex(on ? 0xff2244 : 0x551122);
      if (bar2) bar2.material.color.setHex(on ? 0x113366 : 0x2266ff);
      // Ram: contact damages the player's car / shoves the player.
      if (driving && player.car && dist < 3.4) {
        player.car.health -= 14 * dt * 10 * 0.1;
        if (audio && Math.random() < dt * 2) audio.hit();
      }
      // On foot: an officer steps out when close and gives chase.
      if (!driving && dist < 9 && !cop.officer) {
        const fig = makeFigure(0x123a5c, 0x101820, 0xe0ac69);
        fig.position.copy(car.pos); this.scene.add(fig);
        cop.officer = fig; this.officers.push(fig);
      }
    }
    // Officers chase on foot; standing close fills the bust meter.
    let closeCops = 0;
    for (const cop of this.cars) {
      if (!cop.officer) continue;
      const fig = cop.officer;
      if (driving || wanted.stars === 0) { // back to the car
        fig.position.lerp(cop.car.pos, 0.1);
        if (fig.position.distanceTo(cop.car.pos) < 1.5) { this.scene.remove(fig); cop.officer = null; }
        continue;
      }
      const toP = player.pos.clone().sub(fig.position); toP.y = 0;
      const d = toP.length();
      if (d > 1.6) {
        toP.normalize(); fig.position.addScaledVector(toP, 5.6 * dt);
        fig.position.y = 0.22; fig.rotation.y = Math.atan2(toP.x, toP.z);
        animateFigure(fig, performance.now() / 1000, 1.5);
        collide(this.colliders, fig.position, 0.6);
      } else closeCops++;
    }
    this.officers = this.officers.filter((f) => f.parent);
    if (!driving && want > 0 && closeCops > 0) this.bustMeter += dt * closeCops;
    else this.bustMeter = Math.max(0, this.bustMeter - dt * 1.5);
    if (want > 0) audio?.startSiren(); else audio?.stopSiren();
    return { seen: this.seen, busted: this.bustMeter >= 2.2 };
  }
  reset() { for (const c of this.cars) this.scene.remove(c.car.mesh); this.cars = []; this.bustMeter = 0; }
}
