// Mobs e NPCs: spawn determinístico, IA (vagar/aggro/perseguir/atacar/
// resetar/morrer/renascer) e placas de nome. main.js injeta os hooks.
import * as THREE from 'three';
import { makeBiped, makeQuad, animate } from './creature.js';
import { heightAt, POI } from './terrain.js';
import { MOB_TYPES, NPCS } from './data.js';
import { mulberry32 } from './rng.js';
import { diffColor } from './combat.js';

export const mobs = [];
export const npcs = [];

// ---------- placas de nome (canvas sprite) ----------
function plateTexture(name, sub, color = '#ffd100', hpPct = null) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 22px Georgia, serif';
  g.textAlign = 'center';
  g.shadowColor = '#000'; g.shadowBlur = 4;
  g.fillStyle = color;
  g.fillText(name, 128, 24);
  if (sub) { g.font = '15px Georgia, serif'; g.fillStyle = '#d8d8c8'; g.fillText(sub, 128, 42); }
  if (hpPct !== null) {
    g.shadowBlur = 0;
    g.fillStyle = '#201410'; g.fillRect(48, 50, 160, 9);
    g.fillStyle = '#2fbf3a'; g.fillRect(49, 51, 158 * hpPct, 7);
    g.strokeStyle = '#000'; g.strokeRect(48.5, 50.5, 159, 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function makePlate(name, sub, color, withHp) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: plateTexture(name, sub, color, withHp ? 1 : null), transparent: true, depthTest: false }));
  sp.scale.set(3.4, 0.85, 1);
  sp.renderOrder = 5;
  return sp;
}

// ---------- spawns ----------
const SPAWNS = [
  { type: 'lobo', n: 7, at: POI.campoLobos, r: 26 },
  { type: 'loboUiv', n: 4, at: POI.campoLobos, r: 30 },
  { type: 'javali', n: 7, at: POI.javalis, r: 24 },
  { type: 'batedor', n: 6, at: { x: POI.colinaGnoll.x - 18, z: POI.colinaGnoll.z + 22 }, r: 26 },
  { type: 'bruto', n: 3, at: POI.colinaGnoll, r: 12 },
  { type: 'chefe', n: 1, at: POI.gruta, r: 2 },
];

export function spawnMobs(scene) {
  const rnd = mulberry32(20260717);
  for (const s of SPAWNS) {
    for (let i = 0; i < s.n; i++) {
      const def = MOB_TYPES[s.type];
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * s.r;
      const hx = s.at.x + Math.cos(a) * d, hz = s.at.z + Math.sin(a) * d;
      const cre = def.kind === 'quad'
        ? makeQuad({ tint: def.tint, snout: !!def.snout, scale: def.scale })
        : makeBiped({ tint: def.tint, skin: 0xb99a6a, gnoll: true, scale: def.scale, weapon: def.elite ? 'axe' : 'sword' });
      cre.group.position.set(hx, heightAt(hx, hz), hz);
      scene.add(cre.group);
      const plate = makePlate(def.name, def.elite ? '« Chefe »' : null, '#ffd100', true);
      plate.position.y = def.kind === 'quad' ? 1.6 * def.scale : 2.5 * def.scale;
      cre.group.add(plate);
      mobs.push({
        id: `${s.type}-${i}`, type: s.type, def, cre, plate,
        home: { x: hx, z: hz }, hp: def.hp, hpMax: def.hp,
        state: 'idle', tState: rnd() * 3, wander: null,
        attackTimer: 0, attackAnim: -1, dead: false, respawnAt: 0,
        threat: false,
      });
    }
  }
}

export function spawnNpcs(scene) {
  const places = {
    serra: { x: POI.vila.x + 3, z: POI.vila.z - 2, rot: 2.6 },
    lenho: { x: POI.vila.x - 7, z: POI.vila.z + 7, rot: -0.6 },
    broa:  { x: POI.taverna.x + 2.5, z: POI.taverna.z + 4.6, rot: 3.1 },
    ponte: { x: POI.ponte.x + 3.5, z: POI.ponte.z - 1.5, rot: -1.8 },
  };
  for (const [id, def] of Object.entries(NPCS)) {
    const p = places[id];
    const cre = makeBiped({ tint: def.tint, skin: 0xd8b090, hair: def.hair, weapon: id === 'serra' || id === 'ponte' ? 'sword' : null });
    cre.group.position.set(p.x, heightAt(p.x, p.z), p.z);
    cre.group.rotation.y = p.rot;
    scene.add(cre.group);
    const plate = makePlate(def.name, def.title, '#8fdc60', false);
    plate.position.y = 2.5;
    cre.group.add(plate);
    // marcador de quest (! / ?) — sprite trocável
    const marker = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
    marker.scale.set(1.0, 1.0, 1);
    marker.position.y = 3.1;
    marker.renderOrder = 6;
    marker.visible = false;
    cre.group.add(marker);
    npcs.push({ id, def, cre, plate, marker, pos: p });
  }
}

const markerCache = {};
export function markerTexture(sym, color) {
  const key = sym + color;
  if (markerCache[key]) return markerCache[key];
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 52px Georgia, serif';
  g.textAlign = 'center';
  g.shadowColor = '#000'; g.shadowBlur = 5;
  g.fillStyle = color;
  g.fillText(sym, 32, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  markerCache[key] = t;
  return t;
}

// ---------- IA ----------
const V = new THREE.Vector3();
export function updateMobs(dt, t, player, hooks) {
  for (const m of mobs) {
    if (m.dead) {
      if (t > m.respawnAt && Math.hypot(player.x - m.home.x, player.z - m.home.z) > 26) {
        m.dead = false;
        m.hp = m.hpMax;
        m.cre.group.visible = true;
        m.cre.group.rotation.z = 0;
        m.cre.group.position.set(m.home.x, heightAt(m.home.x, m.home.z), m.home.z);
        m.state = 'idle';
      } else {
        animate(m.cre, { mode: 'dead' }, t, dt);
        if (t > m.corpseUntil) m.cre.group.visible = false;
      }
      continue;
    }
    const gx = m.cre.group.position.x, gz = m.cre.group.position.z;
    const dPlayer = Math.hypot(player.x - gx, player.z - gz);
    const dHome = Math.hypot(gx - m.home.x, gz - m.home.z);

    // aggro: raio do tipo (0 = passivo) + já ameaçado por dano
    if (m.state === 'idle' || m.state === 'wander') {
      if (!player.dead && ((m.def.aggroR > 0 && dPlayer < m.def.aggroR) || m.threat)) {
        m.state = 'chase';
        hooks.onAggro?.(m);
      }
    }
    if (player.dead && (m.state === 'chase' || m.state === 'attack')) { m.state = 'reset'; m.threat = false; }

    let mode = 'idle';
    if (m.state === 'idle') {
      m.tState -= dt;
      if (m.tState <= 0) {
        const rnd = Math.random;
        const a = rnd() * Math.PI * 2, r = 3 + rnd() * 7;
        m.wander = { x: m.home.x + Math.cos(a) * r, z: m.home.z + Math.sin(a) * r };
        m.state = 'wander';
      }
    } else if (m.state === 'wander') {
      const d = Math.hypot(m.wander.x - gx, m.wander.z - gz);
      if (d < 0.6) { m.state = 'idle'; m.tState = 2 + Math.random() * 4; }
      else { stepToward(m, m.wander.x, m.wander.z, m.def.moveSpeed * 0.45, dt); mode = 'run'; }
    } else if (m.state === 'chase') {
      if (dHome > 34) { m.state = 'reset'; m.threat = false; hooks.onEvade?.(m); }
      else if (dPlayer < 2.1) { m.state = 'attack'; m.attackTimer = 0.4; }
      else { stepToward(m, player.x, player.z, m.def.moveSpeed, dt); mode = 'run'; }
    } else if (m.state === 'attack') {
      faceToward(m, player.x, player.z, dt);
      if (dPlayer > 2.8) m.state = 'chase';
      else {
        m.attackTimer -= dt;
        if (m.attackTimer <= 0) {
          m.attackTimer = m.def.attackSpeed;
          m.attackAnim = 0;
          hooks.onMobSwing?.(m); // main aplica o dano no ponto do golpe
        }
      }
    } else if (m.state === 'reset') {
      if (dHome < 1.2) { m.state = 'idle'; m.hp = m.hpMax; hooks.onHpChange?.(m); }
      else { stepToward(m, m.home.x, m.home.z, m.def.moveSpeed * 1.15, dt); mode = 'run'; }
    }

    if (m.attackAnim >= 0) {
      m.attackAnim += dt / 0.6;
      if (m.attackAnim >= 1) m.attackAnim = -1;
      mode = 'attack';
    }
    animate(m.cre, { mode, attackT: Math.max(0, m.attackAnim) }, t + m.tState * 7, dt);
    // placa: hp + cor por nível vs jogador; esconder longe
    const show = dPlayer < 42;
    m.plate.visible = show;
    if (show && (m.plateHp !== m.hp || m.plateLvl !== player.level)) {
      m.plateHp = m.hp; m.plateLvl = player.level;
      m.plate.material.map = plateTexture(`[${m.def.level}] ${m.def.name}`, m.def.elite ? '« Chefe »' : null, diffColor(player.level, m.def.level), m.hp / m.hpMax);
      m.plate.material.needsUpdate = true;
    }
  }
}

function stepToward(m, x, z, speed, dt) {
  const g = m.cre.group.position;
  const dx = x - g.x, dz = z - g.z;
  const d = Math.hypot(dx, dz) || 1;
  g.x += (dx / d) * speed * dt;
  g.z += (dz / d) * speed * dt;
  g.y = heightAt(g.x, g.z);
  m.cre.group.rotation.y = Math.atan2(dx, dz);
}
function faceToward(m, x, z) {
  const g = m.cre.group.position;
  m.cre.group.rotation.y = Math.atan2(x - g.x, z - g.z);
}

/** dano no mob; retorna true se morreu agora */
export function damageMob(m, dmg, t, hooks) {
  if (m.dead) return false;
  m.hp = Math.max(0, m.hp - dmg);
  m.threat = true;
  if (m.state === 'idle' || m.state === 'wander') m.state = 'chase';
  if (m.hp <= 0) {
    m.dead = true;
    m.state = 'dead';
    m.respawnAt = t + 26;
    m.corpseUntil = t + 14;
    m.threat = false;
    m.plate.visible = false;
    hooks.onMobKilled?.(m);
    return true;
  }
  hooks.onHpChange?.(m);
  return false;
}

export function nearestNpc(px, pz, maxD = 4.2) {
  let best = null, bd = maxD;
  for (const n of npcs) {
    const d = Math.hypot(n.cre.group.position.x - px, n.cre.group.position.z - pz);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}
