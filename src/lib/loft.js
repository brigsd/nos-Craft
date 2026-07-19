// A FORJA · loft — malha orgânica por SEÇÕES ao longo de uma ESPINHA.
// A primitiva que tira a Forja do mundo das caixas: membro, tronco,
// focinho, cauda, casco — tudo é "espinha + raios por seção".
//
//   loft([{ p:[x,y,z], rx, rz?, roll? }, ...], { seg: 8, caps: true })
//
// - p: ponto da espinha (a ordem define o fluxo da malha)
// - rx/rz: raios da elipse da seção (rz = rx se omitido)
// - frames por transporte paralelo (sem torção acumulada)
// - normais SUAVES ao longo (o gradiente que lê orgânico) — arestas duras
//   só onde você quebrar o loft em dois.
import * as THREE from 'three';
import { clamp, lerp } from '../rng.js';

export function loft(sections, { seg = 8, caps = true, capStart, capEnd, capSmooth = true, color = null } = {}) {
  const doCapStart = capStart ?? caps, doCapEnd = capEnd ?? caps;
  const n = sections.length;
  if (n < 2) throw new Error('loft precisa de >=2 seções');
  const pts = sections.map((s) => new THREE.Vector3(...s.p));
  // tangentes
  const tans = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    return b.clone().sub(a).normalize();
  });
  // transporte paralelo do frame (normal inicial: qualquer ⊥ à tangente)
  const normals = [];
  let prevN = Math.abs(tans[0].y) < 0.93 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  prevN = prevN.sub(tans[0].clone().multiplyScalar(prevN.dot(tans[0]))).normalize();
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      const axis = tans[i - 1].clone().cross(tans[i]);
      const ang = Math.asin(clamp(axis.length(), -1, 1));
      if (axis.lengthSq() > 1e-10) prevN = prevN.clone().applyAxisAngle(axis.normalize(), ang);
      // re-ortogonaliza (deriva numérica)
      prevN.sub(tans[i].clone().multiplyScalar(prevN.dot(tans[i]))).normalize();
    }
    normals.push(prevN.clone());
  }
  // vértices anel a anel
  const pos = [], idx = [];
  for (let i = 0; i < n; i++) {
    const s = sections[i];
    const rx = s.rx ?? s.r ?? 0.1, rz = s.rz ?? rx;
    const roll = s.roll ?? 0;
    const N = normals[i].clone().applyAxisAngle(tans[i], roll);
    const B = tans[i].clone().cross(N).normalize();
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      const v = pts[i].clone()
        .add(N.clone().multiplyScalar(Math.cos(a) * rx))
        .add(B.clone().multiplyScalar(Math.sin(a) * rz));
      pos.push(v.x, v.y, v.z);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * seg + j, b = i * seg + ((j + 1) % seg);
      const c = a + seg, d = b + seg;
      idx.push(a, c, b, b, c, d);
    }
  }
  // tampas: leque no centro de cada ponta. capSmooth puxa o centro para
  // FORA (uma "tampa de bala" rasa) em vez de um ponto único — um leque
  // raso não gera normais radiais malucas que estouram brilho puro
  // (achado da Forja ronda 3: a v1 acendia "pontas brancas" na cabeça/cauda).
  if (doCapStart || doCapEnd) {
    const cap = (i0, flip) => {
      const c = pts[i0].clone().add(tans[i0].clone().multiplyScalar(flip * (sections[i0].rx ?? 0.1) * (capSmooth ? 0.55 : 0)));
      const ci = pos.length / 3;
      pos.push(c.x, c.y, c.z);
      const base = i0 === 0 ? 0 : (n - 1) * seg;
      for (let j = 0; j < seg; j++) {
        if (flip > 0) idx.push(ci, base + ((j + 1) % seg), base + j);
        else idx.push(ci, j, (j + 1) % seg);
      }
    };
    /* pontas SEM tampa (capStart/capEnd:false) são de propósito: a seção
       fica escondida dentro de outra peça (coxa->pélvis) ou encostada na
       peça vizinha (coxa->canela) — tampar ali só desperdiça triângulo e,
       pior, cria a "ponta de cone"/anel-losango vistos isolando a perna
       (Forja ronda 7). Ver docs/FORJA.md, fluxo micro/macro. */
    if (doCapStart) cap(0, -1);
    if (doCapEnd) cap(n - 1, 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals(); // suaves — o gradiente orgânico
  if (color) {
    const col = new THREE.Color(color);
    const cols = new Float32Array((pos.length / 3) * 3);
    for (let i = 0; i < pos.length / 3; i++) { cols[i * 3] = col.r; cols[i * 3 + 1] = col.g; cols[i * 3 + 2] = col.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  }
  return geo;
}

/**
 * Achata tudo abaixo de minY na altura da sola e refaz as normais.
 * Pra pé/casco/base: o loft é sempre um tubo de seção elíptica — por baixo
 * ele arredonda, e sola arredondada lia como "sabonete" (Forja ronda 7,
 * achado do ideador com foto de referência). Clampar os vértices de baixo
 * dá o plano de apoio que um pé de verdade tem, mantendo o dorso curvo.
 */
export function clampBelow(geo, minY) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < minY) p.setY(i, minY);
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** membro: tubo afilado com "cotovelo" — espinha em 3 pontos + raios que afinam */
export function limb(from, mid, to, r0, r1, r2, seg = 7) {
  return loft([
    { p: from, rx: r0 },
    { p: mid, rx: r1 },
    { p: to, rx: r2 },
  ], { seg });
}

/**
 * Pinta o loft com gradiente ventre/dorso + AO nas dobras: barriga mais
 * clara, dorso saturado — o padrão de contra-sombreamento dos bichos.
 */
export function countershade(geo, dorsal, ventral, { axis = 'y' } = {}) {
  const p = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const cd = new THREE.Color(dorsal), cv = new THREE.Color(ventral);
  const cols = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const ny = axis === 'y' ? nrm.getY(i) : nrm.getZ(i);
    const t = clamp(ny * 0.5 + 0.5, 0, 1);           // normal pra cima = dorso
    c.copy(cv).lerp(cd, t);
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return geo;
}
