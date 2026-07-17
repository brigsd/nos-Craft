// Criaturas low-poly com "ossos" hierárquicos e animação procedural.
// biped: pelve→tronco→cabeça, braços com arma; quad: corpo+4 patas+cauda.
// api: makeBiped/makeQuad -> { group, parts, anim(state, t, dt) }
import * as THREE from 'three';

/* materiais memoizados (Forja ronda 1: 15 draw calls por boneco) */
const _mc = new Map();
const M = (color, opts = {}) => {
  const key = color + JSON.stringify(opts);
  if (!_mc.has(key)) _mc.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return _mc.get(key);
};
/* fator humano: o esqueleto nasce ~2.66m; 0.68 assenta em 1.80m (Forja) */
const HUMAN = 0.68;

function eye(x, y, z) {
  const e = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.05), M(0x14100e));
  e.position.set(x, y, z);
  return e;
}

export function makeBiped({ tint = 0x9a7a5a, skin = 0xd8b090, gnoll = false, scale = 1, weapon = 'sword', hair = null } = {}) {
  const g = new THREE.Group();
  const parts = {};
  const cloth = M(tint), flesh = M(skin);

  const pelvis = new THREE.Group(); pelvis.position.y = 0.95; g.add(pelvis); parts.pelvis = pelvis;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), cloth);
  torso.position.y = 0.42; pelvis.add(torso); parts.torso = torso;
  // ombreiras (o exagero clássico)
  for (const s of [-1, 1]) {
    const sh = new THREE.Mesh(new THREE.SphereGeometry(0.17, 6, 5), M(0x6a5a48));
    sh.position.set(s * 0.38, 0.72, 0); torso.add(sh);
  }
  const head = new THREE.Group(); head.position.y = 0.98; torso.add(head); parts.head = head;
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.4), flesh);
  head.add(skull);
  skull.add(eye(-0.1, 0.04, 0.21), eye(0.1, 0.04, 0.21));
  if (gnoll) {
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.26), flesh);
    snout.position.set(0, -0.06, 0.3); skull.add(snout);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 4), flesh);
      ear.position.set(s * 0.17, 0.3, 0); ear.rotation.z = -s * 0.3; skull.add(ear);
    }
  } else if (hair !== null) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.16, 0.44), M(hair));
    h.position.y = 0.24; skull.add(h);
  }
  // braços
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.42, 0.6, 0);
    torso.add(arm);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.16), cloth);
    upper.position.y = -0.21; arm.add(upper);
    const fore = new THREE.Group(); fore.position.y = -0.44; arm.add(fore);
    const foreM = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.4, 0.14), flesh);
    foreM.position.y = -0.2; fore.add(foreM);
    parts[s === 1 ? 'armR' : 'armL'] = arm;
    parts[s === 1 ? 'foreR' : 'foreL'] = fore;
  }
  // arma na mão direita
  if (weapon) {
    const w = new THREE.Group();
    if (weapon === 'axe') {
      const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 5), M(0x5a4330));
      haft.position.y = -0.2; w.add(haft);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.06), M(0xb9c2cc));
      blade.position.set(0.16, 0.14, 0); w.add(blade);
    } else {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.85, 0.03), M(0xc9d2dc));
      blade.position.y = 0.28; w.add(blade);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.06), M(0x8a6a2a));
      guard.position.y = -0.13; w.add(guard);
    }
    w.position.set(0, -0.42, 0.06);
    parts.foreR.add(w);
    parts.weapon = w;
  }
  // pernas
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.17, 0.06, 0);
    pelvis.add(leg);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.46, 0.22), M(0x4a3c30));
    thigh.position.y = -0.23; leg.add(thigh);
    const shin = new THREE.Group(); shin.position.y = -0.48; leg.add(shin);
    const shinM = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.44, 0.2), M(0x3a3028));
    shinM.position.y = -0.22; shin.add(shinM);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.32), M(0x2c241e));
    foot.position.set(0, -0.46, 0.06); shin.add(foot);
    parts[s === 1 ? 'legR' : 'legL'] = leg;
    parts[s === 1 ? 'shinR' : 'shinL'] = shin;
  }
  g.scale.setScalar(scale * HUMAN);
  return { group: g, parts, kind: 'biped' };
}

export function makeQuad({ tint = 0x8a8f96, snout = false, scale = 1 } = {}) {
  const g = new THREE.Group();
  const parts = {};
  const fur = M(tint);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 1.1), fur);
  body.position.y = 0.62; g.add(body); parts.body = body;
  const head = new THREE.Group(); head.position.set(0, 0.72, 0.62); g.add(head); parts.head = head;
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.38), fur); head.add(skull);
  skull.add(eye(-0.09, 0.05, 0.2), eye(0.09, 0.05, 0.2));
  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.26), M(snout ? 0x5a4636 : tint));
  muzzle.position.set(0, -0.04, 0.28); skull.add(muzzle);
  if (snout) { // presas de javali
    for (const s of [-1, 1]) {
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 4), M(0xe8e2ce));
      tusk.position.set(s * 0.09, -0.1, 0.38); tusk.rotation.x = -0.7; skull.add(tusk);
    }
  } else {
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 4), fur);
      ear.position.set(s * 0.12, 0.22, -0.02); skull.add(ear);
    }
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.42), fur);
  tail.position.set(0, 0.72, -0.66); tail.rotation.x = 0.5; g.add(tail); parts.tail = tail;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(sx * 0.2, 0.42, sz * 0.4);
    g.add(leg);
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.46, 0.15), fur);
    l.position.y = -0.2; leg.add(l);
    parts[`leg${sx > 0 ? 'R' : 'L'}${sz > 0 ? 'F' : 'B'}`] = leg;
  }
  g.scale.setScalar(scale * 0.82);
  return { group: g, parts, kind: 'quad' };
}

/**
 * Animação procedural. state: {mode:'idle'|'run'|'attack'|'dead', attackT, speed}
 * t = tempo global; retorna nada (muta rotations).
 */
export function animate(cre, state, t, dt) {
  const p = cre.parts;
  if (state.mode === 'dead') {
    // tomba de lado
    cre.group.rotation.z = THREE.MathUtils.lerp(cre.group.rotation.z, Math.PI / 2 * 0.92, Math.min(1, dt * 6));
    cre.group.position.y += (0.3 - cre.group.position.y) * Math.min(1, dt * 6) * 0.4;
    return;
  }
  cre.group.rotation.z *= 0.8;
  if (cre.kind === 'biped') {
    const run = state.mode === 'run' ? 1 : 0;
    const w = t * 9.5;
    const swing = Math.sin(w) * 0.85 * run;
    p.legL.rotation.x = swing;
    p.legR.rotation.x = -swing;
    p.shinL.rotation.x = Math.max(0, -Math.sin(w)) * 0.9 * run;
    p.shinR.rotation.x = Math.max(0, Math.sin(w)) * 0.9 * run;
    p.armL.rotation.x = -swing * 0.8;
    if (state.mode !== 'attack') p.armR.rotation.x = swing * 0.8;
    p.pelvis.position.y = 0.95 + Math.abs(Math.sin(w)) * 0.06 * run + Math.sin(t * 2.2) * 0.012 * (1 - run);
    p.torso.rotation.y = Math.sin(w) * 0.06 * run;
    // ataque: braço direito arma um arco por cima (attackT 0..1)
    if (state.mode === 'attack') {
      const at = state.attackT;
      const wind = at < 0.35 ? at / 0.35 : 1;
      const strike = at < 0.35 ? 0 : Math.min(1, (at - 0.35) / 0.3);
      p.armR.rotation.x = -2.4 * wind + 3.1 * strike;
      p.armR.rotation.z = -0.5 * wind + 0.4 * strike;
      p.foreR.rotation.x = -0.8 * wind + 0.9 * strike;
      p.torso.rotation.y = 0.35 * wind - 0.5 * strike;
    } else {
      p.armR.rotation.z *= 0.7; p.foreR.rotation.x *= 0.7;
    }
  } else {
    const run = state.mode === 'run' ? 1 : 0;
    const w = t * 11;
    const gallop = Math.sin(w) * 0.9 * run;
    p.legLF.rotation.x = gallop; p.legRB.rotation.x = gallop;
    p.legRF.rotation.x = -gallop; p.legLB.rotation.x = -gallop;
    p.body.position.y = 0.62 + Math.abs(Math.sin(w)) * 0.05 * run + Math.sin(t * 2.6) * 0.01;
    p.tail.rotation.x = 0.5 + Math.sin(t * 3.1) * 0.2;
    if (state.mode === 'attack') {
      const at = state.attackT;
      const lunge = at < 0.4 ? at / 0.4 : Math.max(0, 1 - (at - 0.4) / 0.5);
      p.head.rotation.x = 0.55 * lunge;
      p.body.rotation.x = 0.16 * lunge;
    } else {
      p.head.rotation.x *= 0.7; p.body.rotation.x *= 0.7;
    }
  }
}
