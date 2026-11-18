// Staged screenshot modes for VERANO HEAT, driven only by URL params.
// ?shot=cover|onfoot|mission|menu&seed=1 sets up deterministic real gameplay
// states using the game's own systems (no faked renders). Cars are staged on
// real road lanes and the camera is pre-framed so the first frames already
// read well; the live simulation takes over from there.
import * as THREE from 'three';
import { Car } from './cars.js';

export function parseShotParams() {
  const q = new URLSearchParams(location.search);
  return { shot: q.get('shot'), seed: Number(q.get('seed') || 1) || 1 };
}

function frameChaseCam(game, car) {
  const back = new THREE.Vector3(-Math.sin(car.heading), 0, -Math.cos(car.heading));
  game.camera.position.copy(car.pos).addScaledVector(back, 12.5);
  game.camera.position.y = 5.6;
  game.camera.lookAt(car.pos.x, 1.4, car.pos.z);
}

export function applyShot(game, name) {
  if (name === 'menu') {
    game.state = 'menu'; // start screen stays up over the live city
    game.hud.show();
    return;
  }
  game.startGame(false);
  if (name === 'onfoot') {
    game.player.pos.set(10, 0.22, 34);
    game.player.yaw = Math.PI * 0.9;
    game.hud.setObjective('<b>Free Roam</b> — Puerto Verano, on foot. Steal a car with <b>E</b>.');
  } else if (name === 'cover') {
    // Player driving a stolen car with a 3-star police chase active.
    game.missions.index = 0; game.missions.startNext();
    const car = game.missions.targetCar || game.traffic.cars[0];
    if (car) {
      car.pos.set(3.6, 0, -25); car.heading = 0; car.mesh.rotation.y = 0;
      game.player.enterCar(car); game.player.carSpeed = 17;
      frameChaseCam(game, car);
      // One patrol car head-on at the intersection ahead, one on the tail:
      // both are real Police entries driven by the normal pursuit update.
      const copA = new Car(game.scene, 1, -3.4, 14, Math.PI, { police: true });
      const copB = new Car(game.scene, 1, 8, -40, 0.2, { police: true });
      // Police entries expose .pos (the minimap reads it); car.pos is the live
      // mesh-position vector, so sharing the reference keeps it current.
      game.police.cars.push(
        { car: copA, flashT: 0, officer: null, pos: copA.pos },
        { car: copB, flashT: 2, officer: null, pos: copB.pos });
    }
    game.wanted.heat = 40; game.wanted.setForced(3); game.wanted.refresh();
    game.hud.setObjective('<b>First Wheels:</b> deliver the coupe to Solana Garage — lose the cops!');
    game.objectivePos = game.cityRef.garagePad; game.setBeacon(game.cityRef.garagePad);
    game.hud.showDialogue('Marisol “La Sol” Duarte', 'La Sol: “Three stars, Rico! DRIVE!”');
  } else if (name === 'mission') {
    // Mid mission 2: package picked up, timer running, marker at Hotel Coral.
    game.missions.index = 1; game.missions.startNext();
    game.missions.phase = 'deliver'; game.missions.timer = 47;
    const car = game.traffic.nearest(game.player.pos, 30) || game.traffic.cars[1];
    if (car) {
      car.pos.set(3.6, 0, 58); car.heading = Math.PI; car.mesh.rotation.y = Math.PI;
      game.player.enterCar(car); game.player.carSpeed = 13;
      frameChaseCam(game, car);
    }
    const { PLACES } = game.configPlaces;
    game.hud.setObjective('<b>Hot Package:</b> deliver to Hotel Coral — <span id="timer">⏱ 47s</span>');
    game.objectivePos = { x: PLACES.packageDrop.x, z: PLACES.packageDrop.z + 14 };
    game.setBeacon({ x: PLACES.packageDrop.x, y: 0, z: PLACES.packageDrop.z + 14 });
    game.hud.showDialogue('Eladio Paz', 'Eladio: “Forty-seven seconds, wheelman. The Coral — GO!”');
  }
}
