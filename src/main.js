// NÓS-Craft — main: renderer, câmera clássica, controles, combate, quests.
import * as THREE from 'three';
import { buildTerrain, tickWater, heightAt, POI, WORLD_HALF, WATER_Y } from './terrain.js';
import { buildSky, tickSky } from './sky.js';
import { plantForest, scatterRocks, buildVillage, buildBridge, buildGnollCamp, buildBanner, buildCave, buildPortal, COLLIDERS } from './props.js';
import { makeBiped, animate } from './creature.js';
import { mobs, npcs, spawnMobs, spawnNpcs, updateMobs, damageMob, nearestNpc, markerTexture } from './entities.js';
import { PLAYER_BASE, ABILITIES, LOOT, ITEMS, STRINGS, QUESTS } from './data.js';
import { playerStats, rollAuto, rollAbility, xpForKill, grantXp, canUse, abilitiesAt } from './combat.js';
import * as Q from './quests.js';
import * as UI from './ui.js';
import { initAudio, sfx } from './audio.js';
import { saveGame, loadGame } from './save.js';
import { mulberry32 } from './rng.js';

// ---------- cena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('game').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.3, 1400);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const terrain = buildTerrain(scene);
const sky = buildSky(scene);
plantForest(scene);
scatterRocks(scene);
buildVillage(scene);
buildBridge(scene);
const campFire = buildGnollCamp(scene);
const banner = buildBanner(scene);
buildCave(scene);
const portal = buildPortal(scene);

// ---------- jogador ----------
const combatRnd = mulberry32((Date.now() % 100000) | 1);
const player = {
  x: POI.portal.x + 6, z: POI.portal.z + 4, y: 0, vy: 0, yaw: 2.2,
  level: 1, xp: 0, coins: 0, equipAttack: 0, buffAtk: 0, buffUntil: 0,
  rage: 0, hp: 60, hpMax: 60, dead: false, title: null, attuned: false,
  inCombatUntil: 0, autoTimer: 0, cooldowns: {}, moving: false,
  mapAngle: 0,
};
const questState = { active: {}, completed: [], items: {} };
const pc = makeBiped({ tint: 0x5a2c22, skin: 0xd8b090, hair: 0x3a2a1a, weapon: 'sword' });
scene.add(pc.group);
let attackAnimT = -1;

function refreshStats() {
  const s = playerStats(player.level, player.equipAttack, player.buffAtk);
  const pct = player.hpMax ? player.hp / player.hpMax : 1;
  player.hpMax = s.hpMax;
  player.hp = Math.min(player.hpMax, Math.max(1, Math.round(player.hpMax * pct)));
  player.attack = s.attack;
}
refreshStats();
player.hp = player.hpMax;

// save carregado?
const saved = loadGame();
if (saved) {
  Object.assign(player, {
    level: saved.level, xp: saved.xp, coins: saved.coins,
    equipAttack: saved.equipAttack, title: saved.title, attuned: saved.attuned,
    x: saved.pos.x, z: saved.pos.z,
  });
  Object.assign(questState, saved.quests);
  refreshStats();
  player.hp = player.hpMax;
}

// ---------- entidades ----------
spawnMobs(scene);
spawnNpcs(scene);

// ---------- câmera clássica ----------
let camYaw = player.yaw + Math.PI, camPitch = 0.32, camDist = 9;
let dragL = false, dragR = false, lastMx = 0, lastMy = 0;

// ---------- input ----------
const keys = {};
let target = null;
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === 'Tab') { e.preventDefault(); cycleTarget(); }
  if (e.code.startsWith('Digit')) {
    const i = Number(e.code.slice(5)) - 1;
    const ab = Object.values(ABILITIES)[i];
    if (ab) useAbility(ab.id);
  }
  if (e.code === 'KeyE') tryInteract();
  if (e.code === 'Escape') { target = null; UI.closeDialog(); UI.dom.portalPanel.style.display = 'none'; }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.button === 0) { dragL = true; pick(e); }
  if (e.button === 2) dragR = true;
  lastMx = e.clientX; lastMy = e.clientY;
});
addEventListener('mouseup', (e) => { if (e.button === 0) dragL = false; if (e.button === 2) dragR = false; });
addEventListener('mousemove', (e) => {
  if (!dragL && !dragR) return;
  const dx = (e.clientX - lastMx) * 0.0065, dy = (e.clientY - lastMy) * 0.005;
  lastMx = e.clientX; lastMy = e.clientY;
  camYaw -= dx;
  camPitch = Math.min(1.2, Math.max(-0.15, camPitch + dy));
  if (dragR) player.yaw = camYaw + Math.PI; // botão direito: o corpo segue a câmera
});
addEventListener('wheel', (e) => { camDist = Math.min(17, Math.max(3.5, camDist + Math.sign(e.deltaY) * 1.1)); });

const ray = new THREE.Raycaster();
function pick(e) {
  ray.setFromCamera({ x: (e.clientX / innerWidth) * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1 }, camera);
  let best = null, bd = 1e9;
  for (const m of mobs) {
    if (m.dead) continue;
    const p = m.cre.group.position;
    const d2 = ray.ray.distanceSqToPoint(new THREE.Vector3(p.x, p.y + 1, p.z));
    const dCam = camera.position.distanceTo(p);
    if (d2 < 1.6 && dCam < bd) { bd = dCam; best = m; }
  }
  if (best) target = best;
}
function cycleTarget() {
  const cands = mobs.filter((m) => !m.dead && Math.hypot(m.cre.group.position.x - player.x, m.cre.group.position.z - player.z) < 32)
    .sort((a, b) => dist2(a) - dist2(b));
  if (!cands.length) return;
  const i = cands.indexOf(target);
  target = cands[(i + 1) % cands.length];
  function dist2(m) { const p = m.cre.group.position; return (p.x - player.x) ** 2 + (p.z - player.z) ** 2; }
}

// ---------- combate ----------
function inCombat() { return tNow < player.inCombatUntil; }
let tNow = 0;

function screenOf(x, y, z) {
  const v = new THREE.Vector3(x, y, z).project(camera);
  return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
}
function mobScreen(m) {
  const p = m.cre.group.position;
  return screenOf(p.x, p.y + 1.6, p.z);
}

function dealToTarget(m, dmg, crit, kind = '') {
  const s = mobScreen(m);
  UI.floatText(String(dmg), s.x, s.y, crit ? 'crit' : '');
  sfx.hit(crit);
  player.inCombatUntil = tNow + 5;
  const died = damageMob(m, dmg, tNow, hooks);
  if (!died) UI.setTargetFrame(m, player.level);
}

function useAbility(id) {
  const ab = ABILITIES[id];
  if (!ab || player.dead) return;
  if (player.level < ab.level) return;
  const st = {
    rage: player.rage, cooldowns: player.cooldowns,
    hasTarget: !!(target && !target.dead),
    targetDist: target && !target.dead ? Math.hypot(target.cre.group.position.x - player.x, target.cre.group.position.z - player.z) : 1e9,
    targetHpPct: target && !target.dead ? target.hp / target.hpMax : 1,
  };
  const r = canUse(ab, st);
  if (!r.ok) {
    const reasons = { rage: STRINGS.noRage, target: STRINGS.noTarget, far: STRINGS.tooFar, close: STRINGS.tooClose, exec: STRINGS.execFail, cd: 'Recarregando…' };
    UI.msg(reasons[r.reason], 'sys');
    return;
  }
  player.cooldowns[id] = ab.cd;
  player.rage -= ab.rage;
  attackAnimT = 0;
  if (id === 'golpe' || id === 'execucao') {
    const roll = rollAbility(ab, player.attack, combatRnd);
    dealToTarget(target, roll.dmg, roll.crit);
    facePoint(target.cre.group.position.x, target.cre.group.position.z);
  } else if (id === 'investida') {
    sfx.charge();
    const p = target.cre.group.position;
    const d = Math.hypot(p.x - player.x, p.z - player.z);
    const k = Math.max(0, (d - 1.8) / d);
    player.x += (p.x - player.x) * k;
    player.z += (p.z - player.z) * k;
    player.rage = Math.min(PLAYER_BASE.rageMax, player.rage + ab.rageGain);
    facePoint(p.x, p.z);
    player.inCombatUntil = tNow + 5;
    damageMob(target, 1, tNow, hooks); // cutucão: puxa aggro
  } else if (id === 'grito') {
    sfx.shout();
    player.buffAtk = ab.buffAtk;
    player.buffUntil = tNow + ab.buffDur;
    refreshStats();
    UI.msg(`Grito de Batalha: +${ab.buffAtk} de Ataque por ${ab.buffDur}s.`, 'sys');
  } else if (id === 'redemoinho') {
    sfx.whirl();
    let hit = 0;
    for (const m of mobs) {
      if (m.dead) continue;
      const p = m.cre.group.position;
      if (Math.hypot(p.x - player.x, p.z - player.z) <= ab.aoe) {
        const roll = rollAbility(ab, player.attack, combatRnd);
        dealToTarget(m, roll.dmg, roll.crit);
        hit++;
      }
    }
    if (!hit) UI.msg('O redemoinho corta o ar.', 'sys');
  }
}

function facePoint(x, z) { player.yaw = Math.atan2(x - player.x, z - player.z); }

const hooks = {
  onMobSwing(m) {
    if (player.dead) return;
    const roll = rollAuto(m.def.attack, combatRnd);
    player.hp = Math.max(0, player.hp - roll.dmg);
    player.rage = Math.min(PLAYER_BASE.rageMax, player.rage + PLAYER_BASE.ragePerTaken);
    player.inCombatUntil = tNow + 5;
    sfx.hurt();
    const s = screenOf(player.x, player.y + 1.6, player.z);
    UI.floatText(`-${roll.dmg}`, s.x, s.y, 'taken');
    if (player.hp <= 0) die();
  },
  onMobKilled(m) {
    sfx.mobDie();
    if (target === m) target = null;
    // xp
    const gained = xpForKill(player.level, m.type);
    if (gained > 0) {
      const s = mobScreen(m);
      UI.floatText(`+${gained} XP`, s.x, s.y + 24, 'xp');
      const r = grantXp(player.level, player.xp, gained);
      player.xp = r.xp;
      for (const lv of r.leveled) levelUp(lv);
    }
    // quests de matar
    for (const up of Q.onKill(m.type, questState)) {
      UI.msg(STRINGS.questProgress(up.label, up.n, up.total), 'qst');
      if (Q.isComplete(up.quest, questState)) UI.msg(`${up.quest.name}: pronta para entregar!`, 'qst');
    }
    // loot
    for (const drop of (LOOT[m.type] ?? [])) {
      if (drop.coins) {
        const n = drop.coins[0] + Math.floor(combatRnd() * (drop.coins[1] - drop.coins[0] + 1));
        player.coins += n;
        sfx.coin();
        UI.msg(`+${n} moedas`, 'sys');
      } else if (drop.item) {
        const it = ITEMS[drop.item];
        const isQuestDrop = !it.equip && !it.quest;
        if (isQuestDrop && !Q.questDropWanted(drop.item, questState)) continue;
        if (combatRnd() < drop.chance) {
          Q.addItem(drop.item, questState, 1);
          UI.msg(`Recebido: ${it.name}`, 'qst');
          if (it.equip) {
            player.equipAttack = Math.max(player.equipAttack, it.equip.attack);
            refreshStats();
            UI.announce(`${it.name} equipado! (+${it.equip.attack} Ataque)`);
          }
        }
      }
    }
    UI.renderTracker(questState);
    persist();
  },
  onEvade() { UI.msg('O inimigo desiste e volta, curando-se.', 'sys'); },
  onHpChange(m) { if (m === target) UI.setTargetFrame(m, player.level); },
  onAggro(m) { if (!target) target = m; },
};

function levelUp(lv) {
  player.level = lv;
  refreshStats();
  player.hp = player.hpMax;
  sfx.levelUp();
  UI.announce(STRINGS.levelUp(lv));
  for (const ab of abilitiesAt(lv)) {
    if (ab.level === lv) setTimeout(() => UI.announce(STRINGS.newAbility(ab.name)), 1400);
  }
  persist();
}

function die() {
  player.dead = true;
  sfx.death();
  UI.showDeath(true);
  target = null;
  setTimeout(() => {
    player.x = POI.santuario.x; player.z = POI.santuario.z;
    player.hp = player.hpMax; player.rage = 0;
    player.dead = false;
    UI.showDeath(false);
    UI.msg(STRINGS.respawned, 'sys');
  }, 3800);
}

// ---------- interação (NPCs, estandarte, portal) ----------
function tryInteract() {
  // estandarte da quest?
  if (questState.active.acampamento && (questState.items.estandarte ?? 0) < 1) {
    const b = banner.position;
    if (Math.hypot(b.x - player.x, b.z - player.z) < 4) {
      Q.addItem('estandarte', questState);
      banner.visible = false;
      UI.msg('Você arranca o Estandarte da Matilha.', 'qst');
      UI.renderTracker(questState);
      persist();
      return;
    }
  }
  // portal?
  if (Math.hypot(POI.portal.x - player.x, POI.portal.z - player.z) < 7) {
    sfx.portal();
    UI.openPortalPanel(player.attuned);
    return;
  }
  const npc = nearestNpc(player.x, player.z);
  if (npc) talkTo(npc);
}

const GREET = {
  serra: 'Aço em punho, viajante. O Vale precisa de braços — e os teus parecem servir.',
  lenho: 'Chegou pelo portal, foi? Vi pela poeira. Senta, que história aqui não falta.',
  broa: 'Bem-vindo à Estalagem do Vau! Broa quente, banco firme e fofoca fresca.',
  ponte: 'Alto lá! …ah, és dos nossos. Cruza logo, que os gnolls andam atiçados.',
};
function talkTo(npc) {
  const offered = Q.offeredBy(npc.id, questState, player.level);
  const turnable = Q.turnableTo(npc.id, questState);
  UI.openDialog(npc, offered, turnable, GREET[npc.id], {
    accept(q) {
      Q.accept(q, questState);
      sfx.questAccept();
      UI.msg(STRINGS.questAccepted(q.name), 'qst');
      UI.closeDialog();
      UI.renderTracker(questState);
      persist();
    },
    turnIn(q) {
      UI.showQuestDone(q, () => {
        const rw = Q.turnIn(q, questState);
        sfx.questDone();
        player.coins += rw.coins;
        const r = grantXp(player.level, player.xp, rw.xp);
        player.xp = r.xp;
        for (const lv of r.leveled) levelUp(lv);
        if (rw.title) { player.title = rw.title; player.attuned = true; UI.announce(`Título recebido: «${rw.title}»`); portal.veil.material.opacity = 0.85; }
        UI.msg(STRINGS.questDone(q.name), 'qst');
        UI.closeDialog();
        UI.renderTracker(questState);
        persist();
      });
    },
  });
}

// marcadores ! ? sobre NPCs
function refreshMarkers() {
  for (const n of npcs) {
    const turnable = Q.turnableTo(n.id, questState).length > 0;
    const offered = Q.offeredBy(n.id, questState, player.level).length > 0;
    n.marker.visible = turnable || offered;
    if (turnable) n.marker.material.map = markerTexture('?', '#ffd100');
    else if (offered) n.marker.material.map = markerTexture('!', '#ffd100');
    if (n.marker.material.map) n.marker.material.needsUpdate = true;
  }
}

// ---------- persistência ----------
let saveTimer = 0;
function persist() { saveGame(player, questState); }

// ---------- colisão simples (cilindros + água funda) ----------
function collidePlayer(nx, nz) {
  for (const c of COLLIDERS) {
    const d = Math.hypot(nx - c.x, nz - c.z);
    if (d < c.r + 0.45) {
      const push = (c.r + 0.45 - d) || 0.01;
      nx += ((nx - c.x) / (d || 1)) * push;
      nz += ((nz - c.z) / (d || 1)) * push;
    }
  }
  nx = Math.max(-WORLD_HALF + 4, Math.min(WORLD_HALF - 4, nx));
  nz = Math.max(-WORLD_HALF + 4, Math.min(WORLD_HALF - 4, nz));
  return [nx, nz];
}

// ---------- intro ----------
let running = false;
UI.initUI((id) => useAbility(id));
UI.setMinimapSource(terrain.colormapCanvas);
UI.dom.introGo.onclick = () => {
  initAudio();
  UI.dom.intro.style.display = 'none';
  running = true;
  UI.msg(STRINGS.welcome, 'sys');
  refreshMarkers();
  UI.renderTracker(questState);
  if (player.attuned) portal.veil.material.opacity = 0.85;
};

// ---------- loop ----------
let last = performance.now();
function loop(nowMs) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (nowMs - last) / 1000);
  last = nowMs;
  tNow = nowMs / 1000;

  if (running && !player.dead) {
    // movimento
    const fwd = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    const strafe = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    player.moving = fwd !== 0 || strafe !== 0;
    if (player.moving) {
      const dir = Math.atan2(
        Math.sin(camYaw + Math.PI) * fwd + Math.cos(camYaw) * strafe,
        Math.cos(camYaw + Math.PI) * fwd - Math.sin(camYaw) * strafe,
      );
      player.yaw = dir;
      let nx = player.x + Math.sin(dir) * PLAYER_BASE.moveSpeed * dt;
      let nz = player.z + Math.cos(dir) * PLAYER_BASE.moveSpeed * dt;
      [nx, nz] = collidePlayer(nx, nz);
      // água funda barra (nada de nadar no v1)
      if (heightAt(nx, nz) > WATER_Y - 1.1) { player.x = nx; player.z = nz; }
    }
    if (keys.Space && player.vy === 0) player.vy = 5.2;
  }
  // gravidade / chão
  const ground = heightAt(player.x, player.z);
  player.vy -= 14 * dt;
  player.y += player.vy * dt;
  if (player.y <= ground) { player.y = ground; player.vy = 0; }

  // fúria decai fora de combate; buff expira
  if (!inCombat() && player.rage > 0) player.rage = Math.max(0, player.rage - PLAYER_BASE.rageDecay * dt * 10);
  if (player.buffAtk && tNow > player.buffUntil) { player.buffAtk = 0; refreshStats(); UI.msg('Grito de Batalha expirou.', 'sys'); }
  // cooldowns
  for (const k of Object.keys(player.cooldowns)) player.cooldowns[k] = Math.max(0, player.cooldowns[k] - dt);

  // auto-attack
  if (running && !player.dead && target && !target.dead) {
    const p = target.cre.group.position;
    const d = Math.hypot(p.x - player.x, p.z - player.z);
    if (d < 2.6) {
      facePoint(p.x, p.z);
      player.autoTimer -= dt;
      if (player.autoTimer <= 0) {
        player.autoTimer = PLAYER_BASE.attackSpeed;
        attackAnimT = 0;
        sfx.swing();
        const roll = rollAuto(player.attack, combatRnd);
        dealToTarget(target, roll.dmg, roll.crit);
        player.rage = Math.min(PLAYER_BASE.rageMax, player.rage + PLAYER_BASE.ragePerHit);
      }
    } else {
      player.autoTimer = Math.min(player.autoTimer, 0.4);
    }
  }
  // regen fora de combate
  if (!inCombat() && !player.dead && player.hp < player.hpMax) {
    player.hp = Math.min(player.hpMax, player.hp + player.hpMax * 0.035 * dt);
  }

  // anima jogador
  pc.group.position.set(player.x, player.y, player.z);
  pc.group.rotation.y = player.yaw;
  if (attackAnimT >= 0) { attackAnimT += dt / 0.55; if (attackAnimT >= 1) attackAnimT = -1; }
  animate(pc, {
    mode: player.dead ? 'dead' : attackAnimT >= 0 ? 'attack' : player.moving ? 'run' : 'idle',
    attackT: Math.max(0, attackAnimT),
  }, tNow, dt);

  // mobs / mundo
  if (running) updateMobs(dt, tNow, player, hooks);
  tickWater(terrain.water, tNow);
  tickSky(sky, dt);
  campFire.getObjectByName('flame').scale.setScalar(0.9 + Math.sin(tNow * 9) * 0.15);
  portal.veil.rotation.z = tNow * 0.9;
  if (player.attuned) portal.veil.material.opacity = 0.7 + Math.sin(tNow * 2.2) * 0.15;

  // câmera orbital com colisão de chão
  const cx = player.x + Math.sin(camYaw) * Math.cos(camPitch) * camDist;
  const cz = player.z + Math.cos(camYaw) * Math.cos(camPitch) * camDist;
  let cy = player.y + 1.6 + Math.sin(camPitch) * camDist;
  cy = Math.max(cy, heightAt(cx, cz) + 0.7);
  camera.position.set(cx, cy, cz);
  camera.lookAt(player.x, player.y + 1.7, player.z);
  player.mapAngle = -camYaw + Math.PI;

  // HUD
  UI.setPlayerFrame(player);
  UI.setTargetFrame(target, player.level);
  UI.updateHotbar(player, target, player.cooldowns);
  UI.drawMinimap(player, mobs, npcs);
  // dica de interação
  if (running && !player.dead) {
    const npc = nearestNpc(player.x, player.z);
    const nearPortal = Math.hypot(POI.portal.x - player.x, POI.portal.z - player.z) < 7;
    const nearBanner = questState.active.acampamento && (questState.items.estandarte ?? 0) < 1 &&
      Math.hypot(banner.position.x - player.x, banner.position.z - player.z) < 4;
    UI.interactTip(nearBanner ? '[E] Arrancar o Estandarte' : npc ? `[E] Falar com ${npc.def.name}` : nearPortal ? `[E] ${STRINGS.portalUse}` : null);
  }
  refreshMarkersThrottled(dt);

  // autosave de posição
  saveTimer -= dt;
  if (saveTimer <= 0) { saveTimer = 6; persist(); }

  renderer.render(scene, camera);
}
let markerT = 0;
function refreshMarkersThrottled(dt) {
  markerT -= dt;
  if (markerT <= 0) { markerT = 1.2; refreshMarkers(); }
}
requestAnimationFrame(loop);

// QA hooks (janela): screenshots/testes headless
window.__NC_QA__ = {
  player, questState, mobs, npcs,
  tp(x, z) { player.x = x; player.z = z; player.y = heightAt(x, z); player.vy = 0; },
  cam(yaw, pitch, dist) { camYaw = yaw; camPitch = pitch; camDist = dist; },
  start() { UI.dom.introGo.onclick(); },
  setTarget(i) { target = mobs[i]; },
  use: useAbility,
};
