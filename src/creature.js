// Criaturas com esqueleto hierárquico + MALHA ORGÂNICA (loft por seções,
// ver src/lib/loft.js) — a Forja ronda 3 aposentou o boneco de caixas
// (Lego lia "brinquedo"; loft afina/curva como músculo de verdade).
// biped: pelve→tronco→cabeça, braços com arma; quad: corpo+4 patas+cauda.
// api: makeBiped/makeQuad -> { group, parts, anim(state, t, dt) }
import * as THREE from 'three';
import { loft, countershade } from './lib/loft.js';

/* materiais memoizados (Forja ronda 1: 15 draw calls por boneco) */
const _mc = new Map();
const M = (color, opts = {}) => {
  const key = color + JSON.stringify(opts);
  if (!_mc.has(key)) _mc.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return _mc.get(key);
};
const VC = (opts = {}) => { const key = 'vc' + JSON.stringify(opts); if (!_mc.has(key)) _mc.set(key, new THREE.MeshLambertMaterial({ vertexColors: true, ...opts })); return _mc.get(key); };
/* fator humano: o esqueleto nasce ~2.66m; 0.68 assenta em 1.80m (Forja) */
const HUMAN = 0.68;

function eye(x, y, z) {
  const e = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.05), M(0x14100e));
  e.position.set(x, y, z);
  return e;
}
/** membro orgânico: espinha 3 pontos, raio afila na ponta (o "loft"
    substitui a coxa-caixa+canela-caixa por UMA superfície contínua) */
function organicLeg(len, r0, r1, taper = 0.55, seg = 7) {
  const bend = len * 0.22;
  const geo = loft([
    { p: [0, 0, 0], rx: r0 },
    { p: [0, -len * 0.55, bend * 0.3], rx: r1 },
    { p: [0, -len, bend * 0.15], rx: r1 * taper },
  ], { seg });
  return geo;
}

export function makeBiped({ tint = 0x9a7a5a, skin = 0xd8b090, gnoll = false, scale = 1, weapon = 'sword', hair = null } = {}) {
  const g = new THREE.Group();
  const parts = {};
  const cloth = M(tint), flesh = M(skin);

  const pelvis = new THREE.Group(); pelvis.position.y = 0.95; g.add(pelvis); parts.pelvis = pelvis;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), cloth);
  torso.position.y = 0.42; pelvis.add(torso); parts.torso = torso;
  /* ombreiras: achatadas (Forja ronda 4 — esfera 0.17 virou bola de praia
     flutuando quando o braço emagreceu pro loft; agora é uma cunha que
     cobre a JUNTA ombro->braço, não um adorno solto) */
  for (const s of [-1, 1]) {
    const sh = new THREE.Mesh(new THREE.SphereGeometry(0.135, 7, 5), M(0x6a5a48));
    sh.scale.set(1.15, 0.8, 1.05);
    sh.position.set(s * 0.4, 0.4, 0.01); torso.add(sh);
  }
  /* pescoço: sem isso a cabeça ficava a 0.98 flutuando sobre o topo do
     tronco (0.36) — um vão de 0.62 sem nenhuma malha ali (achado a olho,
     Forja ronda 6; o crítico não pegava pq setFromObject soma os
     descendentes na bbox do pai, então cabeça "dentro" do tronco sempre
     "tocava" nele mesmo boiando) */
  const neckGeo = loft([
    { p: [0, 0.34, 0.02], rx: 0.15, rz: 0.13 },
    { p: [0, 0.8, 0.05], rx: 0.11, rz: 0.1 },
  ], { seg: 6, color: skin });
  torso.add(new THREE.Mesh(neckGeo, VC()));
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
  // braços: loft contínuo braço->antebraço (Forja ronda 4 — era caixa+caixa
  // com uma quina reta no cotovelo; agora afina como músculo de verdade)
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.42, 0.4, 0);
    torso.add(arm);
    const upperGeo = loft([
      { p: [0, 0.02, 0], rx: 0.105 },
      { p: [0, -0.2, 0.01], rx: 0.085 },
      { p: [0, -0.4, 0], rx: 0.07 },
    ], { seg: 6, color: tint });
    arm.add(new THREE.Mesh(upperGeo, VC()));
    const fore = new THREE.Group(); fore.position.y = -0.42; arm.add(fore);
    const foreGeo = loft([
      { p: [0, 0.02, 0], rx: 0.068 },
      { p: [0, -0.18, 0], rx: 0.058 },
      { p: [0, -0.38, 0.01], rx: 0.045 },
    ], { seg: 6, color: skin });
    fore.add(new THREE.Mesh(foreGeo, VC()));
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
  // pernas: mesmo loft contínuo (coxa->canela) das mãos/braços
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.17, 0.08, 0);
    pelvis.add(leg);
    const thighGeo = loft([
      { p: [0, 0.02, 0], rx: 0.13, rz: 0.14 },
      { p: [0, -0.22, 0.015], rx: 0.105 },
      { p: [0, -0.44, 0], rx: 0.085 },
    ], { seg: 6, color: 0x4a3c30 });
    leg.add(new THREE.Mesh(thighGeo, VC()));
    const shin = new THREE.Group(); shin.position.y = -0.46; leg.add(shin);
    const shinGeo = loft([
      { p: [0, 0.02, 0], rx: 0.082 },
      { p: [0, -0.2, 0], rx: 0.062 },
      { p: [0, -0.4, 0.01], rx: 0.05 },
    ], { seg: 6, color: 0x3a3028 });
    shin.add(new THREE.Mesh(shinGeo, VC()));
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.32), M(0x2c241e));
    foot.position.set(0, -0.46, 0.06); shin.add(foot);
    parts[s === 1 ? 'legR' : 'legL'] = leg;
    parts[s === 1 ? 'shinR' : 'shinL'] = shin;
  }
  g.scale.setScalar(scale * HUMAN);
  return { group: g, parts, kind: 'biped' };
}

export function makeQuad({ tint = 0x8a8f96, snout = false, scale = 1, dark = 0x4a4640 } = {}) {
  /* Forja ronda 3: o quadrúpede era 3 caixas + patas-caixa (lia como
     brinquedo de plástico). Agora: TRONCO em loft afilando ventre/dorso
     com contra-sombreado, patas em loft-cone real (coxa->casco), focinho
     e cauda como espinhas próprias. Ganho: silhueta lê "animal" parado. */
  const g = new THREE.Group();
  const parts = {};
  const fur = M(tint);

  // TRONCO: barril orgânico — mais largo no meio, afunilando pro peito/anca
  const torsoGeo = loft([
    { p: [0, 0.62, -0.58], rx: 0.24, rz: 0.28 },
    { p: [0, 0.66, -0.28], rx: 0.32, rz: 0.36 },
    { p: [0, 0.66, 0.1], rx: 0.34, rz: 0.38 },
    { p: [0, 0.62, 0.42], rx: 0.28, rz: 0.32 },
    { p: [0, 0.56, 0.62], rx: 0.2, rz: 0.24 },
  ], { seg: 8 });
  /* contraste ventre/dorso mais SUAVE — a v1 ia até 0x2a2622 (quase preto)
     e com a luz de estúdio lavava pra um branco->preto duro; agora é um
     degradê dentro da MESMA família de cor do pelo (Forja ronda 3) */
  const dk = new THREE.Color(tint).multiplyScalar(0.6).getHex();
  countershade(torsoGeo, tint, dk);
  const body = new THREE.Mesh(torsoGeo, VC());
  g.add(body); parts.body = body;

  // PESCOÇO+CABEÇA: continuação do loft do tronco até o crânio
  const head = new THREE.Group(); head.position.set(0, 0.7, 0.6); g.add(head); parts.head = head;
  const skullGeo = loft([
    { p: [0, 0, -0.06], rx: 0.19, rz: 0.2 },
    { p: [0, 0.02, 0.08], rx: 0.17, rz: 0.18 },
    { p: [0, 0, 0.2], rx: snout ? 0.13 : 0.1, rz: 0.13 },
  ], { seg: 7, color: tint });
  const skull = new THREE.Mesh(skullGeo, VC()); head.add(skull);
  skull.add(eye(-0.1, 0.05, 0.16), eye(0.1, 0.05, 0.16));
  // focinho: espinha própria, afila até a trufa escura
  const muzzleGeo = loft([
    { p: [0, -0.01, 0.16], rx: 0.1, rz: 0.11 },
    { p: [0, -0.03, 0.34], rx: snout ? 0.11 : 0.06, rz: snout ? 0.1 : 0.07 },
    { p: [0, -0.03, snout ? 0.42 : 0.4], rx: snout ? 0.1 : 0.04, rz: snout ? 0.09 : 0.045 },
  ], { seg: 6, color: snout ? 0x5a4636 : tint });
  skull.add(new THREE.Mesh(muzzleGeo, VC()));
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), M(0x18120e));
  nose.position.set(0, -0.03, snout ? 0.47 : 0.44); skull.add(nose);
  if (snout) {
    for (const s of [-1, 1]) {
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.16, 5), M(0xe8e2ce));
      tusk.position.set(s * 0.09, -0.11, 0.4); tusk.rotation.x = -0.7; skull.add(tusk);
    }
  } else {
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.19, 4), fur);
      ear.position.set(s * 0.12, 0.2, -0.02); ear.rotation.z = s * 0.15; skull.add(ear);
    }
  }

  // CAUDA: espinha que farpa na ponta (a v2 era um cilindro reto)
  const tailGeo = loft([
    { p: [0, 0.68, -0.58], rx: 0.09 },
    { p: [0, 0.6, -0.86], rx: 0.06 },
    { p: [0, 0.48, -1.06], rx: 0.032 },
  ], { seg: 6, color: tint });
  const tail = new THREE.Mesh(tailGeo, VC());
  g.add(tail); parts.tail = tail;

  // PATAS: loft coxa->casco por perna — a v2 era 2 caixas empilhadas
  const legDark = M(0x2c2824);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Group();
    /* topo da pata SOBE pra dentro do tronco (achado da Forja ronda 3: o
       vão entre a barriga e a pata lia como boneco flutuando) */
    leg.position.set(sx * 0.22, 0.64, sz * 0.42);
    g.add(leg);
    const legGeo = loft([
      { p: [0, 0.08, 0], rx: 0.15, rz: 0.17 },
      { p: [0, -0.08, 0], rx: 0.13, rz: 0.15 },
      { p: [sx * 0.02, -0.28, sz * 0.03], rx: 0.095 },
      { p: [sx * 0.01, -0.48, 0], rx: 0.06 },
      { p: [0, -0.56, 0.02], rx: 0.055 },
    ], { seg: 6, color: tint });
    const legMesh = new THREE.Mesh(legGeo, VC());
    leg.add(legMesh);
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.05, 0.09, 6), legDark);
    hoof.position.y = -0.5; leg.add(hoof);
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
