// Lógica de combate PURA (sem DOM/three) — testável em Node.
// O motor 3D consome via callbacks/eventos.
import { PLAYER_BASE, ABILITIES, XP_CURVE, MAX_LEVEL, MOB_TYPES } from './data.js';
import { clamp } from './rng.js';

export function playerStats(level, equipAttack = 0, buffAtk = 0) {
  return {
    hpMax: PLAYER_BASE.hp + PLAYER_BASE.hpPerLevel * (level - 1),
    attack: PLAYER_BASE.attack + PLAYER_BASE.attackPerLevel * (level - 1) + equipAttack + buffAtk,
  };
}

/** dano de golpe automático: base ±20%, chance de crítico 8% (x1.7) */
export function rollAuto(attack, rnd) {
  const varr = 0.8 + rnd() * 0.4;
  const crit = rnd() < 0.08;
  return { dmg: Math.max(1, Math.round(attack * varr * (crit ? 1.7 : 1))), crit };
}

export function rollAbility(ab, attack, rnd) {
  const base = attack * (ab.dmgMul ?? 1) + (ab.dmgFlat ?? 0);
  const varr = 0.9 + rnd() * 0.2;
  const crit = rnd() < 0.12;
  return { dmg: Math.max(1, Math.round(base * varr * (crit ? 1.7 : 1))), crit };
}

/** xp de um kill com cor de dificuldade clássica (cinza não dá xp) */
export function xpForKill(playerLevel, mobType) {
  const mob = MOB_TYPES[mobType];
  const diff = mob.level - playerLevel;
  if (diff <= -3) return 0;                        // cinza
  const mul = diff >= 2 ? 1.25 : diff >= 0 ? 1 : diff === -1 ? 0.8 : 0.55;
  return Math.round(mob.xp * mul);
}
export function diffColor(playerLevel, mobLevel) {
  const d = mobLevel - playerLevel;
  if (d >= 3) return '#ff2020';
  if (d >= 1) return '#ff8830';
  if (d >= -1) return '#ffd100';
  if (d >= -2) return '#40bf40';
  return '#909090';
}

/** aplica xp; retorna { level, xp, leveled: [níveis alcançados] } */
export function grantXp(level, xp, gained) {
  let total = xp + gained;
  const leveled = [];
  while (level < MAX_LEVEL && total >= XP_CURVE[level]) {
    level++;
    leveled.push(level);
  }
  return { level, xp: total, leveled };
}
export function xpIntoLevel(level, xpTotal) {
  const floor = level <= 1 ? 0 : XP_CURVE[level - 1];
  const ceil = XP_CURVE[level] === Infinity ? floor + 1 : XP_CURVE[level];
  return { cur: xpTotal - floor, need: ceil - floor, pct: clamp((xpTotal - floor) / (ceil - floor), 0, 1) };
}

/** habilidades destravadas num nível */
export function abilitiesAt(level) {
  return Object.values(ABILITIES).filter((a) => a.level <= level);
}

/**
 * Valida o uso de uma habilidade. Retorna { ok } ou { ok:false, reason }.
 * state: { rage, cooldowns: {id: tRestante}, targetDist, targetHpPct, hasTarget }
 */
export function canUse(ab, state) {
  if ((state.cooldowns[ab.id] ?? 0) > 0.01) return { ok: false, reason: 'cd' };
  if (ab.rage > state.rage) return { ok: false, reason: 'rage' };
  const needsTarget = ab.range > 0;
  if (needsTarget) {
    if (!state.hasTarget) return { ok: false, reason: 'target' };
    if (state.targetDist > ab.range) return { ok: false, reason: 'far' };
    if (ab.minRange && state.targetDist < ab.minRange) return { ok: false, reason: 'close' };
    if (ab.execThreshold && state.targetHpPct > ab.execThreshold) return { ok: false, reason: 'exec' };
  }
  return { ok: true };
}
