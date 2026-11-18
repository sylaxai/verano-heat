// Player controller for VERANO HEAT: on-foot movement with mouse-orbit camera,
// sprint, entering/stealing cars, and arcade driving with a chase camera.
import * as THREE from 'three';
import { PLAYER, PLACES } from './config.js';
import { collide } from './city.js';
import { makeFigure, animateFigure } from './peds.js';

export class Player {
  constructor(scene) {
    this.mesh = makeFigure(0xff7a3c, 0x1d3557, 0xf1c27d);
    this.mesh.position.set(PLACES.spawn.x, 0.22, PLACES.spawn.z);
    scene.add(this.mesh);
    this.pos = this.mesh.position;
    this.yaw = Math.PI; this.pitch = 0.32; this.health = PLAYER.health;
    this.mode = 'foot'; // 'foot' | 'car'
    this.car = null; this.carSpeed = 0; this.carSteer = 0;
    this.walkT = 0; this.dead = false;
  }
  get speedKmh() { return Math.round(Math.abs(this.carSpeed) * 3.6); }
  enterCar(car) {
    this.mode = 'car'; this.car = car; car.occupied = true; this.carSpeed = 0;
    this.mesh.visible = false;
  }
  exitCar() {
    if (!this.car) return null;
    const car = this.car; car.occupied = false;
    const side = new THREE.Vector3(Math.cos(car.heading), 0, -Math.sin(car.heading));
    this.pos.copy(car.pos).addScaledVector(side, 2.6); this.pos.y = 0.22;
    this.mesh.visible = true; this.mode = 'foot'; this.car = null; this.carSpeed = 0;
    return car;
  }
  update(dt, input, camera, colliders) {
    if (this.mode === 'foot') this.updateFoot(dt, input, colliders);
    else this.updateCar(dt, input, colliders);
    this.updateCamera(camera);
  }
  updateFoot(dt, input, colliders) {
    this.yaw -= input.mouseDX * 0.0032;
    this.pitch = Math.max(0.05, Math.min(1.1, this.pitch + input.mouseDY * 0.0026));
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const sp = sprint ? PLAYER.sprint : PLAYER.walk;
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const move = new THREE.Vector3();
    if (input.down('KeyW') || input.down('ArrowUp')) move.add(f);
    if (input.down('KeyS') || input.down('ArrowDown')) move.sub(f);
    if (input.down('KeyD') || input.down('ArrowRight')) move.add(r);
    if (input.down('KeyA') || input.down('ArrowLeft')) move.sub(r);
    if (move.lengthSq() > 0) {
      move.normalize();
      this.pos.addScaledVector(move, sp * dt);
      this.mesh.rotation.y = Math.atan2(move.x, move.z);
      this.walkT += dt * (sprint ? 1.5 : 1);
      animateFigure(this.mesh, this.walkT, sprint ? 1.4 : 1);
      this.moving = true;
    } else this.moving = false;
    collide(colliders, this.pos, 0.7); this.pos.y = 0.22;
  }
  updateCar(dt, input, colliders) {
    const car = this.car; if (!car) return;
    const accel = input.down('KeyW') || input.down('ArrowUp');
    const brake = input.down('KeyS') || input.down('ArrowDown');
    if (accel) this.carSpeed += PLAYER.carAccel * dt;
    else if (brake) this.carSpeed -= (this.carSpeed > 0.5 ? 30 : 12) * dt;
    else this.carSpeed -= this.carSpeed * 0.7 * dt;
    this.carSpeed = Math.max(-PLAYER.carReverse, Math.min(PLAYER.carMax, this.carSpeed));
    let steer = 0;
    if (input.down('KeyA') || input.down('ArrowLeft')) steer = 1;
    if (input.down('KeyD') || input.down('ArrowRight')) steer = -1;
    this.carSteer += (steer - this.carSteer) * Math.min(1, dt * 8);
    if (Math.abs(this.carSpeed) > 0.2) {
      car.heading += this.carSteer * dt * 1.7 * Math.sign(this.carSpeed) * Math.min(1, Math.abs(this.carSpeed) / 8);
    }
    const fwd = car.forward();
    const next = car.pos.clone().addScaledVector(fwd, this.carSpeed * dt);
    // Building collision for cars: stop dead on impact.
    const probe = next.clone(); const before = probe.clone();
    collide(colliders, probe, 1.6);
    if (probe.distanceToSquared(next) > 0.04 && Math.abs(this.carSpeed) > 6) this.carSpeed *= -0.25;
    else if (probe.distanceToSquared(next) > 0.04) this.carSpeed = 0;
    car.pos.copy(probe); car.pos.y = 0;
    void before;
    car.mesh.rotation.y = car.heading; car.speed = this.carSpeed; car.syncWheels(dt);
    this.pos.copy(car.pos);
    this.yaw = car.heading + Math.PI;
  }
  updateCamera(camera) {
    if (this.mode === 'car' && this.car) {
      const back = new THREE.Vector3(-Math.sin(this.car.heading), 0, -Math.cos(this.car.heading));
      const target = this.car.pos.clone().addScaledVector(back, 12.5); target.y = 5.6;
      camera.position.lerp(target, 0.12);
      camera.lookAt(this.car.pos.x, 1.4, this.car.pos.z);
    } else {
      const dist = 8.5;
      const cx = this.pos.x + Math.sin(this.yaw) * Math.cos(this.pitch) * dist;
      const cz = this.pos.z + Math.cos(this.yaw) * Math.cos(this.pitch) * dist;
      const cy = this.pos.y + Math.sin(this.pitch) * dist + 1.2;
      camera.position.set(cx, Math.max(1.2, cy), cz);
      camera.lookAt(this.pos.x, this.pos.y + 1.4, this.pos.z);
    }
  }
  aimDirection(camera) {
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir); return dir;
  }
}
