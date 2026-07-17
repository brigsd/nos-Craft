// A FORJA · lib de qualidade geométrica.
// O que faz low-poly ler como "bonito e sólido" não é polígono a mais:
// é BISEL pegando luz, AO nas juntas, paleta coesa e textura com pincel.
// Tudo aqui é procedural, determinístico e barato de renderizar.
import * as THREE from 'three';
import { hash2, mulberry32, fbm, clamp, lerp } from '../rng.js';

// ---------- paleta coesa (rampas sombra->luz por família de material) ----------
export const PAL = {
  madeira:      ['#3a2a1c', '#5a4330', '#77593c', '#96744e'],
  madeiraClara: ['#4a3a26', '#6b543c', '#8a6a48', '#a8875e'],
  pedra:        ['#4c4a48', '#6f6c66', '#8f8b84', '#aaa69e'],
  pedraClara:   ['#6a7076', '#8b949c', '#a9b4bf', '#c5ced6'],
  reboco:       ['#8a8068', '#b0a78c', '#d8cfb4', '#eee7d0'],
  telhaRubra:   ['#5a2a1e', '#7a3a28', '#9c4a32', '#b85c3a'],
  telhaMusgo:   ['#4a4426', '#5d5a30', '#6d3b2a', '#8a4a34'],
  folha:        ['#1f4a1e', '#2f6633', '#3f7d2c', '#5d9c3a'],
  folhaSeca:    ['#3a4a20', '#4f6628', '#6a8030', '#8a9c40'],
  couro:        ['#4a3424', '#6a4c32', '#8a6a4a', '#a8845c'],
  pano:         ['#5a2020', '#7a2a22', '#9a3a2a', '#b04c30'],
  metal:        ['#5a6068', '#7a828c', '#9aa4b0', '#c2cad4'],
  pele:         ['#8a6a4a', '#b08a60', '#d8b090', '#f0d0aa'],
  terra:        ['#4a3a28', '#6a5438', '#8a6e48', '#a8895c'],
};
export const C = (fam, i) => new THREE.Color(PAL[fam][clamp(i, 0, PAL[fam].length - 1)]);

const matCache = new Map();
/** material lambert com vertex colors ligado (o AO/gradiente vive nos vértices) */
export function mat(opts = {}) {
  const key = JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ vertexColors: true, ...opts }));
  return matCache.get(key);
}

// ---------- geometria com acabamento ----------
/**
 * Caixa BISOTADA — o upgrade nº 1 do low-poly: a quina chanfrada cria uma
 * faceta que pega a luz e desenha o contorno do objeto sozinha.
 */
export function bevelBox(w, h, d, bevel = 0.05, fam = 'pedra', tone = 2) {
  const b = Math.min(bevel, w / 3, h / 3, d / 3);
  const geo = new THREE.BoxGeometry(w - 2 * b, h - 2 * b, d - 2 * b, 1, 1, 1);
  // expande cada vértice na direção do seu octante -> chanfro uniforme
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    pos.setXYZ(i, v.x + Math.sign(v.x) * b, v.y + Math.sign(v.y) * b, v.z + Math.sign(v.z) * b);
  }
  // não: isso só re-infla. Chanfro de verdade: usa BoxGeometry segmentada e recorta os cantos.
  return chamferBox(w, h, d, b, fam, tone);
}
/** implementação real do chanfro: box 3x3x3 segmentos com os anéis externos encolhidos */
export function chamferBox(w, h, d, bevel = 0.06, fam = 'pedra', tone = 2) {
  const b = Math.min(bevel, w * 0.32, h * 0.32, d * 0.32);
  const geo = new THREE.BoxGeometry(w, h, d, 3, 3, 3).toNonIndexed();
  const pos = geo.attributes.position;
  const hw = w / 2, hh = h / 2, hd = d / 2;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    // vértices do anel externo (nos extremos) puxam pra dentro nos OUTROS eixos
    const ex = Math.abs(Math.abs(x) - hw) < 1e-4, ey = Math.abs(Math.abs(y) - hh) < 1e-4, ez = Math.abs(Math.abs(z) - hd) < 1e-4;
    // segmento interno de box 3x: os vértices intermediários estão em ±(dim/6)
    const snap = (val, half) => Math.sign(val) * (half - b);
    if (ex && Math.abs(y) > hh - hh / 3 + 1e-4) y = snap(y, hh);
    if (ex && Math.abs(z) > hd - hd / 3 + 1e-4) z = snap(z, hd);
    if (ey && Math.abs(x) > hw - hw / 3 + 1e-4) x = snap(x, hw);
    if (ey && Math.abs(z) > hd - hd / 3 + 1e-4) z = snap(z, hd);
    if (ez && Math.abs(x) > hw - hw / 3 + 1e-4) x = snap(x, hw);
    if (ez && Math.abs(y) > hh - hh / 3 + 1e-4) y = snap(y, hh);
    // e os do MEIO das faces expandem de volta ao plano da face
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  paintVerts(geo, fam, tone);
  return geo;
}

/**
 * Pinta vertex colors: cor base da rampa + AO fake (escurece por baixo e
 * nas reentrâncias) + leve variação por ruído (quebra o chapado).
 */
export function paintVerts(geo, fam, tone = 2, { aoBottom = 0.45, noise = 0.08, seed = 1 } = {}) {
  const pos = geo.attributes.position;
  const bb = new THREE.Box3().setFromBufferAttribute(pos);
  const span = Math.max(0.001, bb.max.y - bb.min.y);
  const base = C(fam, tone), dark = C(fam, Math.max(0, tone - 1));
  const colors = new Float32Array(pos.count * 3);
  const col = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y01 = (pos.getY(i) - bb.min.y) / span;
    const ao = lerp(1 - aoBottom, 1, Math.pow(y01, 0.7));
    const n = (hash2((pos.getX(i) * 37 + seed * 91) | 0, (pos.getZ(i) * 37) | 0) - 0.5) * noise;
    col.copy(base).lerp(dark, clamp(1 - ao + Math.max(0, -n), 0, 1));
    col.multiplyScalar(1 + Math.max(0, n));
    colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/** desloca vértices com fbm — pedra/tronco orgânico a partir de primitivas */
export function displace(geo, amp = 0.12, freq = 2.2, seed = 7) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const n = fbm(v.x * freq + seed * 11, (v.y + v.z) * freq + seed * 5, 3) - 0.5;
    const len = v.length() || 1;
    v.multiplyScalar(1 + (n * amp) / len);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** sólido de revolução por perfil [[raio, y], ...] — poste, poço, jarro */
export function lathe(profile, segs = 10, fam = 'madeira', tone = 2) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, segs).toNonIndexed();
  geo.computeVertexNormals();
  paintVerts(geo, fam, tone);
  return geo;
}

// ---------- texturas de canvas com pincel ----------
const texCache = new Map();
function makeTex(key, w, h, painter, repeat = [1, 1]) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  painter(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.magFilter = THREE.NearestFilter; // pixelzinho crocante de perto
  texCache.set(key, t);
  return t;
}
/** tábuas verticais com veio e pregos */
export function texWood(seed = 1, planks = 5) {
  return makeTex(`wood${seed}-${planks}`, 128, 128, (g, w, h) => {
    const rnd = mulberry32(seed * 131 + 7);
    const pw = w / planks;
    for (let p = 0; p < planks; p++) {
      const tone = PAL.madeira[1 + ((rnd() * 2.4) | 0)];
      g.fillStyle = tone;
      g.fillRect(p * pw, 0, pw, h);
      // veio: linhas verticais onduladas mais escuras
      g.strokeStyle = 'rgba(30,18,10,0.35)';
      g.lineWidth = 1.4;
      for (let vle = 0; vle < 3; vle++) {
        g.beginPath();
        const x0 = p * pw + 3 + rnd() * (pw - 6);
        g.moveTo(x0, 0);
        for (let y = 0; y <= h; y += 16) g.lineTo(x0 + Math.sin(y * 0.05 + rnd() * 6) * 2.4, y);
        g.stroke();
      }
      // separação da tábua + prego
      g.fillStyle = 'rgba(20,12,8,0.55)';
      g.fillRect(p * pw, 0, 1.5, h);
      g.fillStyle = '#2a2624';
      g.fillRect(p * pw + pw / 2 - 1, 6, 2.4, 2.4);
      g.fillRect(p * pw + pw / 2 - 1, h - 9, 2.4, 2.4);
    }
  });
}
/** telhado de telhas encaixadas (escamas) */
export function texShingles(fam = 'telhaRubra', seed = 2) {
  return makeTex(`shin${fam}${seed}`, 128, 128, (g, w, h) => {
    const rnd = mulberry32(seed * 313 + 11);
    const rows = 8, cw = 16;
    g.fillStyle = PAL[fam][0];
    g.fillRect(0, 0, w, h);
    for (let r = rows; r >= 0; r--) {
      const y = r * (h / rows);
      const off = (r % 2) * (cw / 2);
      for (let x = -1; x < w / cw + 1; x++) {
        g.fillStyle = PAL[fam][1 + ((rnd() * 2.6) | 0)];
        g.beginPath();
        g.roundRect(x * cw + off + 0.8, y - h / rows, cw - 1.6, h / rows + 4, 3);
        g.fill();
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.fillRect(x * cw + off + 0.8, y + 1.4, cw - 1.6, 2.2);
      }
    }
  }, [2, 2]);
}
/** cantaria: pedras irregulares com argamassa */
export function texMasonry(seed = 3) {
  return makeTex(`mas${seed}`, 128, 128, (g, w, h) => {
    const rnd = mulberry32(seed * 501 + 3);
    g.fillStyle = '#57534e';
    g.fillRect(0, 0, w, h);
    const rows = 5;
    for (let r = 0; r < rows; r++) {
      let x = -((rnd() * 20) | 0);
      const rh = h / rows;
      while (x < w) {
        const sw = 14 + rnd() * 22;
        g.fillStyle = PAL.pedra[1 + ((rnd() * 2.7) | 0)];
        g.beginPath();
        g.roundRect(x + 1.4, r * rh + 1.4, sw - 2.8, rh - 2.8, 3);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.10)';
        g.fillRect(x + 2.5, r * rh + 2.5, sw - 5, 2);
        x += sw;
      }
    }
  }, [2, 1]);
}
/** pano rústico com trama */
export function texCloth(fam = 'couro', seed = 4) {
  return makeTex(`cloth${fam}${seed}`, 64, 64, (g, w, h) => {
    const rnd = mulberry32(seed * 977 + 13);
    g.fillStyle = PAL[fam][2];
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(40,24,12,0.25)';
    for (let i = 0; i < w; i += 4) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke();
    }
    // remendos e costuras
    for (let k = 0; k < 3; k++) {
      const x = rnd() * w, y = rnd() * h;
      g.strokeStyle = PAL[fam][0];
      g.setLineDash([3, 2.4]);
      g.strokeRect(x, y, 12 + rnd() * 10, 9 + rnd() * 8);
      g.setLineDash([]);
    }
  }, [2, 2]);
}
/** material texturizado (sem vertex color — a textura manda) */
export function texMat(tex, opts = {}) {
  return new THREE.MeshLambertMaterial({ map: tex, ...opts });
}

// ---------- utilidades de composição ----------
/** mescla estática de um grupo em 1 mesh por material (menos draw calls) */
export function freeze(group) {
  group.updateMatrixWorld(true);
  const byMat = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    const key = o.material.uuid;
    if (!byMat.has(key)) byMat.set(key, { mat: o.material, geos: [] });
    byMat.get(key).geos.push(g.index ? g.toNonIndexed() : g);
  });
  const out = new THREE.Group();
  for (const { mat: m, geos } of byMat.values()) {
    out.add(new THREE.Mesh(mergeGeos(geos), m));
  }
  return out;
}
export function mergeGeos(geos) {
  // merge manual (sem BufferGeometryUtils): concatena atributos compatíveis
  let total = 0;
  for (const g of geos) total += g.attributes.position.count;
  const attrs = {};
  for (const name of Object.keys(geos[0].attributes)) {
    const item = geos[0].attributes[name].itemSize;
    const arr = new Float32Array(total * item);
    let off = 0;
    for (const g of geos) {
      const a = g.attributes[name] ?? fillAttr(g, name, item);
      arr.set(a.array, off);
      off += a.array.length;
    }
    attrs[name] = new THREE.BufferAttribute(arr, item);
  }
  const geo = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(attrs)) geo.setAttribute(name, attr);
  return geo;
}
function fillAttr(g, name, itemSize) {
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * itemSize).fill(name === 'color' ? 1 : 0);
  return new THREE.BufferAttribute(arr, itemSize);
}
/** estatísticas de um objeto (o crítico usa) */
export function statsOf(root) {
  let tris = 0, meshes = 0;
  const mats = new Set();
  root.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    mats.add(o.material.uuid);
    const p = o.geometry.attributes.position;
    tris += (o.geometry.index ? o.geometry.index.count : p.count) / 3;
  });
  const bb = new THREE.Box3().setFromObject(root);
  return { tris: Math.round(tris), meshes, materials: mats.size, bbox: { min: bb.min.toArray(), max: bb.max.toArray() } };
}
