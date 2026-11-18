// Story missions for VERANO HEAT: a 4-job chain for Rico Vega in Puerto Verano.
// Characters: Marisol "La Sol" Duarte (fixer), Eladio Paz (dock boss),
// Captain R. Ortega (Verano PD), and the rival Los Brasa crew.
import * as THREE from 'three';
import { PLACES, ECONOMY } from './config.js';

export const MISSION_DEFS = [
  {
    id: 1, title: 'First Wheels', giver: 'Marisol “La Sol” Duarte',
    intro: 'La Sol: “Rico, welcome to Puerto Verano. A coral Solana Coupe near Mercado is unlocked and warm. Take it. Bring it to Solana Garage — and smile for Captain Ortega’s cameras.”',
    objective: 'Steal the marked Solana Coupe',
  },
  {
    id: 2, title: 'Hot Package', giver: 'Eladio Paz',
    intro: 'Eladio: “A package waits at Mercado Central. Drive it to Hotel Coral before the ice melts — ninety seconds, wheelman. The clock is the real police.”',
    objective: 'Pick up the package at Mercado Central',
  },
  {
    id: 3, title: 'Three-Star Sunset', giver: 'Marisol “La Sol” Duarte',
    intro: 'La Sol: “Ortega raided my courier. I need every patrol looking at YOU for two minutes. Make noise, earn three stars, then vanish to the Calle Luna hideout.”',
    objective: 'Reach 3 wanted stars, then escape to Calle Luna',
  },
  {
    id: 4, title: 'Marina Azul', giver: 'Eladio Paz',
    intro: 'Eladio: “Los Brasa took my marina and my boat money. Go to Marina Azul, clear their crew out, then run to Calle Luna. Verano is ours tonight.”',
    objective: 'Drive to Marina Azul',
  },
];

export class Missions {
  constructor(game) {
    this.game = game; // {player, wanted, combat, hud, audio, traffic, city, scene}
    this.index = 0; // next mission to run (0-based)
    this.active = null; this.phase = 'idle'; this.timer = 0; this.needStars = false;
    this.targetCar = null; this.gangSpawned = false;
  }
  get done() { return this.index >= MISSION_DEFS.length; }
  currentDef() { return MISSION_DEFS[this.index] || null; }
  startNext() {
    const def = this.currentDef(); if (!def) return;
    const g = this.game;
    this.active = def; this.gangSpawned = false;
    g.hud.showDialogue(def.giver, def.intro);
    g.audio.chime();
    if (def.id === 1) {
      this.phase = 'steal';
      // The marked target coupe near Mercado.
      const car = g.traffic.nearest(new THREE.Vector3(PLACES.missionCar.x, 0, PLACES.missionCar.z), 60)
        || g.traffic.cars[0];
      this.targetCar = car;
      g.setObjective(`<b>${def.title}:</b> steal the marked ${car ? car.name : 'coupe'} (gold beacon)`);
      g.setBeacon(new THREE.Vector3(PLACES.missionCar.x, 0, PLACES.missionCar.z));
      g.objectivePos = car ? car.pos : new THREE.Vector3(PLACES.missionCar.x, 0, PLACES.missionCar.z);
    } else if (def.id === 2) {
      this.phase = 'pickup'; this.timer = 0;
      g.setObjective(`<b>${def.title}:</b> pick up the package at Mercado Central`);
      g.setBeacon(new THREE.Vector3(PLACES.packagePickup.x, 0, PLACES.packagePickup.z + 14));
      g.objectivePos = new THREE.Vector3(PLACES.packagePickup.x, 0, PLACES.packagePickup.z + 14);
    } else if (def.id === 3) {
      this.phase = 'heat'; this.needStars = true;
      g.wanted.crime(34, null, null); // staged heat so the job can start hot
      g.setObjective(`<b>${def.title}:</b> hold 3 stars, then reach Calle Luna hideout`);
      g.setBeacon(g.cityRef.hideoutPad); g.objectivePos = g.cityRef.hideoutPad;
    } else if (def.id === 4) {
      this.phase = 'marina';
      g.setObjective(`<b>${def.title}:</b> drive to Marina Azul and clear Los Brasa`);
      g.setBeacon(new THREE.Vector3(PLACES.marina.x, 0, PLACES.marina.z));
      g.objectivePos = new THREE.Vector3(PLACES.marina.x, 0, PLACES.marina.z);
    }
  }
  complete(reward, text) {
    const g = this.game;
    g.money += reward; g.audio.chime();
    g.hud.showDialogue('Job Done', `${text} <b>+$${reward}</b>`);
    this.index++; this.active = null; this.phase = 'idle'; this.timer = 0;
    g.setBeacon(null); g.objectivePos = null;
    g.wanted.clearForced();
    if (this.done) g.onStoryComplete();
    else g.setObjective(`<b>Next job:</b> ${this.currentDef().title} — press <b>N</b> when ready`);
    g.persist();
  }
  fail(text) {
    const g = this.game;
    g.hud.showDialogue('Job Failed', text + ' Press <b>N</b> to try again.');
    this.active = null; this.phase = 'idle'; this.timer = 0;
    g.combat.clearGang(); g.setBeacon(null); g.objectivePos = null; g.wanted.clearForced();
    g.setObjective(`<b>Job failed.</b> Press <b>N</b> to retry: ${this.currentDef()?.title || ''}`);
  }
  update(dt) {
    const g = this.game; if (!this.active) return;
    const p = g.player;
    if (this.active.id === 1) {
      if (this.phase === 'steal') {
        if (this.targetCar) g.objectivePos = this.targetCar.pos;
        if (p.mode === 'car' && p.car === this.targetCar) {
          this.phase = 'deliver';
          g.setObjective(`<b>First Wheels:</b> deliver the coupe to Solana Garage`);
          g.setBeacon(g.cityRef.garagePad); g.objectivePos = g.cityRef.garagePad;
          g.hud.showDialogue('Marisol “La Sol” Duarte', 'La Sol: “Beautiful. Now the garage, Rico — Ortega is already sniffing around.”');
        }
      } else if (this.phase === 'deliver') {
        if (p.pos.distanceTo(g.cityRef.garagePad) < 8) this.complete(ECONOMY.m1, 'The coupe purrs into Solana Garage. La Sol wires your cut.');
      }
    } else if (this.active.id === 2) {
      if (this.phase === 'pickup') {
        const spot = new THREE.Vector3(PLACES.packagePickup.x, 0, PLACES.packagePickup.z + 14);
        if (p.pos.distanceTo(spot) < 7) {
          this.phase = 'deliver'; this.timer = 90; g.audio.pickup();
          g.setObjective(`<b>Hot Package:</b> deliver to Hotel Coral — <span id="timer"></span>`);
          g.setBeacon(new THREE.Vector3(PLACES.packageDrop.x, 0, PLACES.packageDrop.z + 14));
          g.objectivePos = new THREE.Vector3(PLACES.packageDrop.x, 0, PLACES.packageDrop.z + 14);
          g.hud.showDialogue('Eladio Paz', 'Eladio: “Clock’s running, wheelman. Ninety seconds. GO.”');
        }
      } else if (this.phase === 'deliver') {
        this.timer -= dt;
        g.hud.setTimer(this.timer);
        const drop = new THREE.Vector3(PLACES.packageDrop.x, 0, PLACES.packageDrop.z + 14);
        if (p.pos.distanceTo(drop) < 8) this.complete(ECONOMY.m2, 'Package delivered ice-cold. Eladio is impressed.');
        else if (this.timer <= 0) this.fail('The ice melted and so did the deal.');
      }
    } else if (this.active.id === 3) {
      if (g.wanted.stars >= 3) this.needStars = false;
      g.setObjective(this.needStars
        ? `<b>Three-Star Sunset:</b> raise your wanted level to 3 stars (now ${g.wanted.stars}★)`
        : `<b>Three-Star Sunset:</b> LOSE the heat at Calle Luna hideout!`);
      if (!this.needStars && p.pos.distanceTo(g.cityRef.hideoutPad) < 8 && g.wanted.stars <= 3) {
        g.wanted.clear();
        this.complete(ECONOMY.m3, 'You vanish into Calle Luna as the sirens fade. Textbook, Rico.');
      }
    } else if (this.active.id === 4) {
      if (this.phase === 'marina') {
        const spot = new THREE.Vector3(PLACES.marina.x, 0, PLACES.marina.z);
        if (p.pos.distanceTo(spot) < 16) {
          this.phase = 'fight'; this.gangSpawned = true;
          g.combat.spawnGangMember(PLACES.marina.x - 8, PLACES.marina.z + 2);
          g.combat.spawnGangMember(PLACES.marina.x + 7, PLACES.marina.z - 3);
          g.combat.spawnGangMember(PLACES.marina.x + 2, PLACES.marina.z + 9);
          g.combat.spawnGangMember(PLACES.marina.x - 3, PLACES.marina.z - 9);
          g.wanted.crime(20, null, null);
          g.setObjective(`<b>Marina Azul:</b> clear the Los Brasa crew (4 armed)!`);
          g.hud.showDialogue('Los Brasa Leader', '“Wrong marina, wheelman!” — guns out. Click to shoot, keep moving!');
          g.setBeacon(null);
        }
      } else if (this.phase === 'fight') {
        const left = g.combat.gangAlive();
        g.setObjective(`<b>Marina Azul:</b> Los Brasa remaining: ${left}`);
        if (left <= 0) {
          this.phase = 'escape'; g.wanted.setForced(3);
          g.setObjective(`<b>Marina Azul:</b> crew cleared! Escape to Calle Luna!`);
          g.setBeacon(g.cityRef.hideoutPad); g.objectivePos = g.cityRef.hideoutPad;
          g.hud.showDialogue('Eladio Paz', 'Eladio: “The marina is ours! Now RUN — Ortega is coming with everything.”');
        }
      } else if (this.phase === 'escape') {
        if (p.pos.distanceTo(g.cityRef.hideoutPad) < 8) { g.wanted.clear(); this.complete(ECONOMY.m4, 'Marina money secured. Puerto Verano belongs to Rico Vega.'); }
      }
    }
  }
}
