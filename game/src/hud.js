// HUD for VERANO HEAT: health, money, wanted stars, speed, objective banner,
// dialogue box, interaction prompt, and the live 2D-canvas minimap.
import { WORLD, PLACES } from './config.js';

export class Hud {
  constructor() {
    this.el = (id) => document.getElementById(id);
    this.root = this.el('hud'); this.moneyEl = this.el('money'); this.starsEl = this.el('stars');
    this.healthEl = this.el('healthBar'); this.objEl = this.el('objective');
    this.speedEl = this.el('speedo'); this.promptEl = this.el('prompt');
    this.dialogueEl = this.el('dialogue'); this.modeEl = this.el('modeLabel');
    this.flashEl = this.el('damageFlash');
    this.map = this.el('minimap'); this.mctx = this.map.getContext('2d');
    this.dialogueT = 0; this.objectiveHTML = '';
  }
  show() { this.root.classList.remove('hidden'); }
  setObjective(html) { if (html !== this.objectiveHTML) { this.objectiveHTML = html; this.objEl.innerHTML = html; } }
  setTimer(sec) {
    const t = document.getElementById('timer');
    if (t) t.textContent = `⏱ ${Math.max(0, sec).toFixed(0)}s`;
    else if (sec !== undefined) this.objEl.innerHTML = this.objectiveHTML + ` <span id="timer">⏱ ${Math.max(0, sec).toFixed(0)}s</span>`;
  }
  showDialogue(who, text, dur = 7) {
    this.dialogueEl.innerHTML = `<b>${who}:</b> ${text}`;
    this.dialogueEl.classList.remove('hidden'); this.dialogueT = dur;
  }
  setPrompt(text) {
    if (text) { this.promptEl.textContent = text; this.promptEl.classList.remove('hidden'); }
    else this.promptEl.classList.add('hidden');
  }
  damageFlash() { this.flashEl.style.opacity = '1'; setTimeout(() => { this.flashEl.style.opacity = '0'; }, 120); }
  update(dt, game) {
    const p = game.player;
    this.moneyEl.textContent = `$${game.money}`;
    const s = game.wanted.stars;
    this.starsEl.textContent = '★'.repeat(s) + '☆'.repeat(5 - s);
    this.starsEl.style.color = s > 0 ? '#ffd23c' : '#8a97a3';
    this.healthEl.style.width = `${Math.max(0, p.health)}%`;
    this.modeEl.textContent = p.mode === 'car' ? `DRIVING · ${p.car ? p.car.name : ''}` : 'ON FOOT';
    if (p.mode === 'car') { this.speedEl.classList.remove('hidden'); this.speedEl.textContent = `${p.speedKmh} km/h`; }
    else this.speedEl.classList.add('hidden');
    if (this.dialogueT > 0) { this.dialogueT -= dt; if (this.dialogueT <= 0) this.dialogueEl.classList.add('hidden'); }
    this.drawMinimap(game);
  }
  drawMinimap(game) {
    const ctx = this.mctx, W = 190, H = 190;
    const toMap = (x, z) => [((x + 220) / 440) * W, ((z + 220) / 480) * H];
    ctx.fillStyle = '#d9c9a3'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1e9bb5'; const [, wy] = toMap(0, 232); ctx.fillRect(0, wy, W, H - wy);
    ctx.strokeStyle = '#3a3f44'; ctx.lineWidth = 5;
    for (const l of WORLD.roadLines) {
      const [vx] = toMap(l, 0); ctx.beginPath(); ctx.moveTo(vx, 0); ctx.lineTo(vx, H); ctx.stroke();
      const [, hz] = toMap(0, l); ctx.beginPath(); ctx.moveTo(0, hz); ctx.lineTo(W, hz); ctx.stroke();
    }
    ctx.fillStyle = '#2ec4b6';
    for (const place of [PLACES.garage, PLACES.hideout]) { const [x, y] = toMap(place.x, place.z + 16); ctx.fillRect(x - 3, y - 3, 6, 6); }
    // Police blips (red/blue).
    ctx.fillStyle = '#ff2244';
    for (const cop of game.police.cars) { const [x, y] = toMap(cop.pos.x, cop.pos.z); ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 7); ctx.fill(); }
    // Gang blips.
    ctx.fillStyle = '#8d0801';
    for (const m of game.combat.gang) { if (m.dead) continue; const [x, y] = toMap(m.pos.x, m.pos.z); ctx.fillRect(x - 2.5, y - 2.5, 5, 5); }
    // Objective marker (gold, pulsing).
    if (game.objectivePos) {
      const [x, y] = toMap(game.objectivePos.x, game.objectivePos.z);
      ctx.fillStyle = '#ffd23c'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, 5 + Math.sin(performance.now() / 200) * 1.2, 0, 7); ctx.fill(); ctx.stroke();
    }
    // Player arrow.
    const p = game.player; const [px, py] = toMap(p.pos.x, p.pos.z);
    const ang = p.mode === 'car' && p.car ? p.car.heading : p.mesh.rotation.y;
    ctx.save(); ctx.translate(px, py);
    // World heading 0 faces +Z, which points down on the map (z grows downward
    // on screen), so the up-drawn arrow rotates by PI - heading.
    ctx.rotate(Math.PI - ang);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.4, 5); ctx.lineTo(0, 2.4); ctx.lineTo(-4.4, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}
