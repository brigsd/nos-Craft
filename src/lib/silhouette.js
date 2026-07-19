// A FORJA · silhueta-primeiro — o algoritmo de apoio pro coder-IA.
//
// Diagnóstico do ideador (ronda 8): autorar coordenadas 3D cruas é usar a
// IA na sua fraqueza (chutar o efeito espacial de um float) e ignorar a
// força (raciocinar sobre FORMAS em 2D). Aqui a peça nasce de DOIS perfis
// 2D — a vista lateral (z×y) e a vista de cima (z×x), exatamente como uma
// ficha de model sheet — e o algoritmo infla os perfis numa malha 3D cuja
// silhueta bate com os desenhos por construção.
//
//   inflate(sideOutline, topOutline, opts) -> BufferGeometry
//
// - sideOutline: polígono FECHADO [[z,y],...] — z pra frente, y pra cima.
// - topOutline:  polígono FECHADO [[z,x],...] — largura em cada z.
// - Em cada estação ao longo de z: faixa vertical [yLo,yHi] vem do perfil
//   lateral, faixa horizontal [xLo,xHi] do perfil de cima; a seção é uma
//   SUPERELIPSE (n=2 elipse, n alto = quase retângulo) com expoentes
//   separados pra metade de cima e de baixo — sola plana + dorso redondo
//   sem pós-processo.
import * as THREE from 'three';
import { clamp, lerp } from '../rng.js';

/** interseções de uma vertical em z com o polígono -> [lo, hi] (ou null) */
function rangeAt(outline, z) {
  const hits = [];
  for (let i = 0; i < outline.length; i++) {
    const [z0, v0] = outline[i], [z1, v1] = outline[(i + 1) % outline.length];
    if ((z0 <= z && z1 > z) || (z1 <= z && z0 > z)) {
      hits.push(v0 + ((z - z0) / (z1 - z0)) * (v1 - v0));
    }
  }
  if (hits.length < 2) return null;
  return [Math.min(...hits), Math.max(...hits)];
}

/** ponto dentro do polígono? (ray casting) */
function inside(poly, x, y) {
  let ok = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ok = !ok;
  }
  return ok;
}

export function inflate(sideOutline, topOutline, {
  stations = 14, seg = 10, squareTop = 2.2, squareBottom = 4.5, color = null,
  front = null, // 3ª vista opcional (x×y): recorta cada seção pelo envelope frontal
} = {}) {
  const zs = sideOutline.map((p) => p[0]);
  const zMin = Math.min(...zs), zMax = Math.max(...zs);
  const eps = (zMax - zMin) * 0.004;

  const pos = [], idx = [];
  let prevSide = null, prevTop = null;
  const rings = [];
  for (let i = 0; i < stations; i++) {
    const z = lerp(zMin + eps, zMax - eps, i / (stations - 1));
    const side = rangeAt(sideOutline, z) ?? prevSide;
    const top = rangeAt(topOutline, z) ?? prevTop;
    if (!side || !top) continue; // só possível nas pontas de perfis mal fechados
    prevSide = side; prevTop = top;
    const cy = (side[0] + side[1]) / 2, ry = Math.max((side[1] - side[0]) / 2, 0.002);
    const cx = (top[0] + top[1]) / 2, rx = Math.max((top[1] - top[0]) / 2, 0.002);
    const ring = [];
    for (let j = 0; j < seg; j++) {
      const th = (j / seg) * Math.PI * 2;
      const c = Math.cos(th), s = Math.sin(th);
      const n = s > 0 ? squareTop : squareBottom; // metade de cima / de baixo
      let px = cx + rx * Math.sign(c) * Math.abs(c) ** (2 / n);
      let py = cy + ry * Math.sign(s) * Math.abs(s) ** (2 / n);
      /* 3ª vista: se o vértice sai do envelope frontal, puxa em direção ao
         centro da seção até a borda (busca binária) — o "visual hull" de
         ficha de model sheet: cada vista só pode TIRAR material */
      if (front && inside(front, cx, cy) && !inside(front, px, py)) {
        let lo = 0, hi = 1;
        for (let k = 0; k < 12; k++) {
          const t = (lo + hi) / 2;
          if (inside(front, cx + (px - cx) * t, cy + (py - cy) * t)) lo = t; else hi = t;
        }
        px = cx + (px - cx) * lo; py = cy + (py - cy) * lo;
      }
      ring.push([px, py, z]);
    }
    rings.push({ ring, cx, cy, z });
  }
  for (const { ring } of rings) for (const [x, y, z] of ring) pos.push(x, y, z);
  const R = rings.length;
  for (let i = 0; i < R - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * seg + j, b = i * seg + ((j + 1) % seg);
      const c = a + seg, d = b + seg;
      idx.push(a, b, c, b, d, c);
    }
  }
  // tampas: leque pro centro da primeira/última estação (os perfis já
  // afinam nas pontas, então o leque é raso — sem ponta de cone)
  for (const [i0, flip] of [[0, -1], [R - 1, 1]]) {
    const { cx, cy, z } = rings[i0];
    const ci = pos.length / 3;
    pos.push(cx, cy, z + flip * eps);
    const base = i0 * seg;
    for (let j = 0; j < seg; j++) {
      if (flip > 0) idx.push(ci, base + j, base + ((j + 1) % seg));
      else idx.push(ci, base + ((j + 1) % seg), base + j);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  if (color) {
    const col = new THREE.Color(color);
    const cols = new Float32Array((pos.length / 3) * 3);
    for (let i = 0; i < pos.length / 3; i++) { cols[i * 3] = col.r; cols[i * 3 + 1] = col.g; cols[i * 3 + 2] = col.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  }
  return geo;
}

/**
 * Porta de entrada por Nº DE VISTAS — a IA (ou o ideador desenhando)
 * escolhe quantas vistas o objeto precisa:
 *
 *   1 vista  -> objeto de revolução (pote, poço, torre): use lathe() de
 *               lib/geo.js — o perfil gira em torno do eixo.
 *   2 vistas -> lado (z×y) + cima (z×x): o caso comum. Seções superelipse.
 *   3 vistas -> + frente (x×y): o envelope frontal RECORTA cada seção
 *               (visual hull) — pra formas que as 2 vistas não fecham
 *               (ex.: corpo que afina de frente mas não de lado).
 *
 * Objetos com concavidade DENTRO de uma vista (buraco, arco, vão entre
 * pernas) não saem de um inflate só: componha MASSAS — um fromViews por
 * massa (tronco, perna, braço...), como uma model sheet real.
 */
export function fromViews({ lado, cima, frente = null }, opts = {}) {
  if (!lado || !cima) {
    throw new Error('fromViews: precisa de lado (z×y) e cima (z×x). Pra 1 vista (revolução), use lathe() de lib/geo.js.');
  }
  return inflate(lado, cima, { ...opts, front: frente });
}
