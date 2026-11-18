// VERANO HEAT — bootstrap and main loop. Puerto Verano, an original
// open-world crime game: city, traffic, peds, police, combat, story missions.
import * as THREE from 'three';
import { PLACES } from './config.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { buildCity } from './city.js';
import { Traffic } from './cars.js';
import { PedCrowd } from './peds.js';
import { Player } from './player.js';
import { Wanted, Police } from './police.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { Hud } from './hud.js';
import { loadSave, storeSave, clearSave } from './save.js';
import { parseShotParams, applyShot } from './shots.js';

const { shot, seed } = parseShotParams();
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(20, 10, 50);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const cityRef = buildCity(scene, seed);
const traffic = new Traffic(scene, cityRef.colliders, seed);
const crowd = new PedCrowd(scene, seed);
const player = new Player(scene);
const wanted = new Wanted();
const police = new Police(scene, cityRef.colliders);
const audio = new GameAudio();
const combat = new Combat(scene, audio);
const hud = new Hud();
const input = new Input(canvas);

const game = {
  scene, camera, player, wanted, police, combat, hud, audio, traffic,
  cityRef, configPlaces: { PLACES },
  money: 250, state: 'menu', objectivePos: null, missions: null,
  setObjective(html) { hud.setObjective(html); },
  setBeacon(pos) {
    if (!pos) { cityRef.beacon.visible = false; return; }
    cityRef.beacon.visible = true;
    cityRef.beacon.position.set(pos.x, 15, pos.z);
  },
  persist() {
    storeSave({ money: this.money, missionIndex: this.missions ? this.missions.index : 0,
      x: player.pos.x, z: player.pos.z, health: player.health });
  },
  onStoryComplete() {
    hud.setObjective('<b>★ STORY COMPLETE ★</b> — Free roam Puerto Verano. The city is yours.');
    document.getElementById('storyScreen').classList.remove('hidden');
    this.state = 'story';
  },
  startGame(useSave) {
    audio.ensure(); audio.startMusic();
    const save = useSave ? loadSave() : null;
    if (save) {
      this.money = save.money ?? 250;
      player.pos.set(save.x ?? PLACES.spawn.x, 0.22, save.z ?? PLACES.spawn.z);
      player.health = save.health ?? 100;
      this.missions.index = save.missionIndex ?? 0;
    } else {
      this.money = 250; player.health = 100; this.missions.index = 0;
      player.pos.set(PLACES.spawn.x, 0.22, PLACES.spawn.z);
    }
    wanted.clear(); police.reset(); combat.clearGang();
    document.getElementById('startScreen').classList.add('hidden');
    hud.show(); this.state = 'play';
    if (this.missions.done) hud.setObjective('<b>Free Roam</b> — story complete. Explore Puerto Verano!');
    else if (!this.missions.active) {
      hud.setObjective(`<b>Next job:</b> ${this.missions.currentDef().title} — press <b>N</b> to start`);
      hud.showDialogue(this.missions.currentDef().giver, '“Ready when you are, Rico. Press N for the job.”', 6);
    }
  },
};
game.missions = new Missions(game);
const missions = game.missions;

// --- UI wiring -------------------------------------------------------------
const $ = (id) => document.getElementById(id);
$('btnContinue').style.display = loadSave() ? '' : 'none';
$('btnNew').addEventListener('click', () => { audio.ensure(); audio.click(); clearSave(); game.startGame(false); });
$('btnContinue').addEventListener('click', () => { audio.ensure(); audio.click(); game.startGame(true); });
$('btnResume').addEventListener('click', () => { $('pauseScreen').classList.add('hidden'); game.state = 'play'; });
$('btnRestart').addEventListener('click', () => { clearSave(); $('pauseScreen').classList.add('hidden'); game.startGame(false); });
$('btnBustedOk').addEventListener('click', () => { $('bustedScreen').classList.add('hidden'); respawn(150); });
$('btnWastedOk').addEventListener('click', () => { $('wastedScreen').classList.add('hidden'); respawn(200); });
$('btnStoryOk').addEventListener('click', () => { $('storyScreen').classList.add('hidden'); game.state = 'play'; });

function respawn(fee) {
  game.money = Math.max(0, game.money - fee);
  if (player.mode === 'car') player.exitCar();
  player.health = 100; player.pos.set(PLACES.spawn.x, 0.22, PLACES.spawn.z);
  wanted.clear(); police.reset(); combat.clearGang(); game.state = 'play'; game.persist();
}
function endRun(kind) {
  game.state = kind; audio.stopSiren(); audio.stopEngine();
  $(kind === 'busted' ? 'bustedScreen' : 'wastedScreen').classList.remove('hidden');
  document.exitPointerLock?.();
}

// --- Per-frame logic ---------------------------------------------------------
let shootHeld = false;
function crimes() { /* crime helpers bound to wanted + witnesses */
  return {
    steal(seen) { wanted.crime(seen ? 12 : 6, null, null); },
    shot() { wanted.crime(6, null, null); },
    hitPed() { wanted.crime(16, null, null); },
    hitCar() { wanted.crime(4, null, null); },
  };
}
const crime = crimes();
let wasDriving = false;

function step(dt) {
  if (game.state !== 'play') return;
  // Mission start key.
  if (input.pressed('KeyN') && !missions.active && !missions.done) missions.startNext();
  if (input.pressed('KeyM')) { audio.ensure(); }
  if (input.pressed('Escape') || input.pressed('KeyP')) {
    $('pauseStats').innerHTML = `Money: $${game.money} · Jobs done: ${missions.index}/4 · Wanted record heat: ${Math.round(wanted.heat)}`;
    $('pauseScreen').classList.remove('hidden'); game.state = 'pause'; return;
  }
  player.update(dt, input, camera, cityRef.colliders);
  const driving = player.mode === 'car';
  if (driving && !wasDriving) audio.startEngine();
  if (!driving && wasDriving) audio.stopEngine();
  wasDriving = driving;
  if (driving) audio.setEngine(player.carSpeed / 34);

  // Enter / exit cars.
  const nearCar = player.mode === 'foot' ? traffic.nearest(player.pos, 3.6) : null;
  const nearCop = player.mode === 'foot' ? police.cars.map((c) => c.car).find((c) => c.pos.distanceTo(player.pos) < 3.6) : null;
  if (player.mode === 'foot') {
    const target = nearCar || nearCop;
    hud.setPrompt(target ? `Press E to steal the ${target.name}` : null);
    if (target && input.pressed('KeyE')) {
      const witnesses = crowd.nearestAlive(player.pos, 22);
      player.enterCar(target);
      crime.steal(!!witnesses);
      audio.pickup();
      hud.showDialogue('Rico Vega', witnesses ? '“Someone saw that. Heat’s coming…”' : '“Clean take. Nobody saw a thing.”', 3.5);
      // Hitting the mission target car check happens in missions.update.
    }
  } else {
    hud.setPrompt('Press E / F to exit');
    if (input.pressed('KeyE') || input.pressed('KeyF')) { player.exitCar(); game.persist(); }
    // Running over a pedestrian is a serious crime.
    for (const ped of crowd.peds) {
      if (!ped.dead && Math.abs(player.carSpeed) > 4 && ped.pos.distanceTo(player.pos) < 1.9) {
        ped.kill(); crime.hitPed(); player.health -= 2; hud.damageFlash(); audio.hit();
        hud.showDialogue('Rico Vega', '“Oh no — I hit someone!”', 3);
      }
    }
    // Car-on-car bumps.
    for (const other of [...traffic.cars, ...police.cars.map((c) => c.car)]) {
      if (other === player.car || other.dead) continue;
      if (other.pos.distanceTo(player.pos) < 2.6 && Math.abs(player.carSpeed) > 5) {
        other.health -= 10; crime.hitCar(); player.carSpeed *= 0.6; audio.hit();
        if (other.health <= 0) other.dead = true;
      }
    }
  }

  traffic.update(dt, player.pos, Math.abs(player.carSpeed) > 18);
  crowd.update(dt);
  // Peds flee speeding cars.
  if (Math.abs(player.carSpeed) > 16) crowd.panic(player.pos, 14);

  // Shooting (on foot, mouse click, pointer-locked aim or plain click).
  if (player.mode === 'foot' && input.mouseDown && !shootHeld) {
    shootHeld = true;
    const origin = camera.position.clone();
    const dir = player.aimDirection(camera);
    const hit = combat.shoot(origin, dir, { peds: crowd.peds, cars: [...traffic.cars, ...police.cars.map((c) => c.car)] });
    crime.shot(); crowd.panic(player.pos, 26);
    if (hit.kind === 'ped') crime.hitPed();
  }
  if (!input.mouseDown) shootHeld = false;
  combat.update(dt, player, (dmg) => {
    player.health -= dmg; hud.damageFlash(); audio.hurt();
  });

  const pol = police.update(dt, wanted, player, audio);
  wanted.update(dt, pol.seen);
  missions.update(dt);
  hud.update(dt, game);
  if (cityRef.water) cityRef.water.position.y = 0.12 + Math.sin(performance.now() / 900) * 0.05;

  if (pol.busted) { endRun('busted'); return; }
  if (player.health <= 0) { endRun('wasted'); return; }
  if (player.mode === 'car' && player.car && player.car.health <= 0) {
    player.car.dead = true; player.exitCar(); player.health -= 25; hud.damageFlash();
    hud.showDialogue('Rico Vega', '“The car’s wrecked! On foot now…”', 4);
  }
}

// --- Boot ----------------------------------------------------------------------
if (shot) applyShot(game, shot);
else {
  hud.show(); // minimap/city visible behind the start screen
  game.state = 'menu';
}
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (game.state === 'menu' || game.state === 'story') {
    // Slow cinematic orbit behind menus.
    const t = now / 14000;
    camera.position.set(Math.sin(t) * 62 + 6, 30, Math.cos(t) * 62 + 6);
    camera.lookAt(0, 4, 0);
    traffic.update(dt, null, false); crowd.update(dt);
    if (game.state === 'menu') hud.update(0, game);
  } else if (game.state === 'play') step(dt);
  renderer.render(scene, camera);
  input.endFrame();
}
requestAnimationFrame(loop);
window.__verano = game; // lets automated play-tests verify live state
export { game };
