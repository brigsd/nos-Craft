// Terreno do Vale Verdente: heightfield analítico (fbm + esculpidas) com
// colormap PINTADO em canvas (o visual "terreno pintado à mão" do clássico).
// heightAt(x,z) é a função-verdade — física, mobs e props consultam ela.
import * as THREE from 'three';
import { fbm, clamp, lerp } from './rng.js';

export const WORLD_HALF = 200;         // mundo 400×400m centrado em 0
const SEG = 220;

// ---------- pontos de interesse (a geografia canônica do Vale) ----------
export const POI = {
  portal:   { x: -150, z: -10 },
  vila:     { x: -48, z: 8 },
  santuario:{ x: -56, z: 20 },        // marco de renascer
  taverna:  { x: -36, z: -6 },
  ponte:    { x: 34, z: 14 },
  campoLobos: { x: -95, z: -55 },
  javalis:  { x: 8, z: -52 },
  colinaGnoll: { x: 105, z: -75 },
  gruta:    { x: 132, z: -108 },
};

// estrada: portal -> vila -> ponte -> colina gnoll
export const ROAD = [
  [POI.portal.x, POI.portal.z], [-110, 6], [POI.vila.x, POI.vila.z], [-10, 10],
  [POI.ponte.x, POI.ponte.z], [64, -18], [POI.colinaGnoll.x - 12, POI.colinaGnoll.z + 14],
];
// rio: do lago sul, passando sob a ponte, até o nordeste
export const RIVER = [
  [-20, 150], [4, 92], [18, 52], [POI.ponte.x, POI.ponte.z + 6], [44, -30], [72, -90], [96, -150],
];
export const WATER_Y = 0.55;

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
function pathDist(path, x, z) {
  let d = 1e9;
  for (let i = 0; i < path.length - 1; i++) d = Math.min(d, segDist(x, z, path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]));
  return d;
}
export const roadDist = (x, z) => pathDist(ROAD, x, z);
export const riverDist = (x, z) => pathDist(RIVER, x, z);
const lakeDist = (x, z) => Math.hypot(x - -26, z - 132) - 34; // lago ao sul (assinatura do Átrio: água contida)

const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

/** altura do chão em (x,z) — analítica, determinística */
export function heightAt(x, z) {
  // colinas base
  let h = fbm(x * 0.008 + 13, z * 0.008 + 7, 4) * 26 - 6;
  h += fbm(x * 0.03 + 91, z * 0.03 + 44, 3) * 3.2; // rugosidade
  // borda do mundo sobe (anel de morros que fecha o vale)
  const edge = Math.max(Math.abs(x), Math.abs(z)) / WORLD_HALF;
  h += smooth((edge - 0.62) / 0.38) * 46;
  // colina do portal e a colina gnoll erguem
  h += smooth(1 - Math.hypot(x - POI.portal.x, z - POI.portal.z) / 55) * 12;
  h += smooth(1 - Math.hypot(x - POI.colinaGnoll.x, z - POI.colinaGnoll.z) / 70) * 14;
  h += smooth(1 - Math.hypot(x - POI.gruta.x, z - POI.gruta.z) / 46) * 20; // morro da gruta
  // achatar sítios (vila, portal, acampamento, gruta-pátio)
  const flat = (cx, cz, r, alvo) => { const k = smooth(1 - Math.hypot(x - cx, z - cz) / r); h = lerp(h, alvo, k * 0.92); };
  flat(POI.vila.x, POI.vila.z, 34, 3.2);
  flat(POI.portal.x, POI.portal.z, 20, 13.5);
  flat(POI.colinaGnoll.x, POI.colinaGnoll.z, 26, 13.0);
  flat(POI.gruta.x, POI.gruta.z, 15, 12.4);
  flat(POI.campoLobos.x, POI.campoLobos.z, 40, 2.4);
  flat(POI.javalis.x, POI.javalis.z, 34, 1.8);
  // estrada assenta suave
  const rd = roadDist(x, z);
  if (rd < 7) h = lerp(h, Math.min(h, 12.8), smooth(1 - rd / 7) * 0.55);
  // rio e lago cavam abaixo do nível d'água
  const rv = riverDist(x, z), lk = lakeDist(x, z);
  const wat = Math.min(rv - 7, lk);
  if (wat < 0) h = Math.min(h, lerp(WATER_Y - 0.4, WATER_Y - 2.6, smooth(-wat / 9)));
  else if (wat < 5) h = Math.min(h, WATER_Y + 0.25 + wat * 0.75); // margens baixas
  return h;
}

/** normal aproximada (p/ inclinar props e sombrear) */
export function normalAt(x, z) {
  const e = 0.6;
  const hx = heightAt(x + e, z) - heightAt(x - e, z);
  const hz = heightAt(x, z + e) - heightAt(x, z - e);
  return new THREE.Vector3(-hx, 2 * e, -hz).normalize();
}

// ---------- colormap pintado (WoW clássico = terreno vertex-painted) ----------
export function paintColormap(size = 1024) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const px = img.data;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = (i / size) * WORLD_HALF * 2 - WORLD_HALF;
      const z = (j / size) * WORLD_HALF * 2 - WORLD_HALF;
      const h = heightAt(x, z);
      const n = fbm(x * 0.05 + 5, z * 0.05 + 9, 3);
      // grama: verde saturado com manchas amareladas (mottling clássico)
      let r = 92 + n * 60, gg = 128 + n * 52, b = 52 + n * 26;
      const dry = fbm(x * 0.015 + 40, z * 0.015 + 21, 3);
      if (dry > 0.62) { r = lerp(r, 148, 0.5); gg = lerp(gg, 138, 0.4); b = lerp(b, 64, 0.4); }
      // rocha nas encostas e alturas
      const steep = Math.abs(heightAt(x + 1, z) - h) + Math.abs(heightAt(x, z + 1) - h);
      const rockK = smooth((steep - 1.15) / 0.9) + smooth((h - 26) / 10);
      if (rockK > 0) { const t = clamp(rockK, 0, 1); r = lerp(r, 118 + n * 26, t); gg = lerp(gg, 112 + n * 24, t); b = lerp(b, 108 + n * 22, t); }
      // areia nas margens
      const wat = Math.min(riverDist(x, z) - 7, lakeDist(x, z));
      if (wat < 2.4 && h > WATER_Y - 0.4) { const t = smooth(1 - wat / 2.4); r = lerp(r, 196, t * 0.8); gg = lerp(gg, 174, t * 0.8); b = lerp(b, 122, t * 0.8); }
      if (h < WATER_Y) { r = 96; gg = 92; b = 70; } // leito
      // estrada de terra batida com borda irregular
      const rd = roadDist(x, z) + (fbm(x * 0.11, z * 0.11, 2) - 0.5) * 2.2;
      if (rd < 2.6) { const t = smooth(1 - rd / 2.6); r = lerp(r, 158 + n * 24, t); gg = lerp(gg, 128 + n * 18, t); b = lerp(b, 88 + n * 14, t); }
      // pátio do acampamento gnoll: terra pisoteada
      const camp = Math.hypot(x - POI.colinaGnoll.x, z - POI.colinaGnoll.z);
      if (camp < 17) { const t = smooth(1 - camp / 17) * 0.7; r = lerp(r, 150, t); gg = lerp(gg, 118, t); b = lerp(b, 84, t); }
      const p = (j * size + i) * 4;
      px[p] = r; px[p + 1] = gg; px[p + 2] = b; px[p + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** textura de detalhe repetida (granulado de grama) multiplicada por cima */
function detailTexture() {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const img = g.createImageData(s, s);
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
    const n = fbm(i * 0.16, j * 0.16, 3) * 0.5 + fbm(i * 0.5 + 31, j * 0.5 + 17, 2) * 0.5;
    const v = 205 + n * 70; // em torno de 1.0 (multiplicativa ~ x0.8..1.08)
    const p = (j * s + i) * 4;
    img.data[p] = img.data[p + 1] = img.data[p + 2] = v;
    img.data[p + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(90, 90);
  return tex;
}

export function buildTerrain(scene) {
  const geo = new THREE.PlaneGeometry(WORLD_HALF * 2, WORLD_HALF * 2, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();

  const colormapCanvas = paintColormap(1024);
  const colormap = new THREE.CanvasTexture(colormapCanvas);
  colormap.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshLambertMaterial({ map: colormap });
  // detalhe multiplicado via segunda malha? não — luz de vértice + colormap já lê bem;
  // o granulado entra por lightMap barato (mesmo UV repetido não dá em lambert).
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);

  // água: um plano por trecho (rio bbox + lago), material animado no loop
  const waterMat = new THREE.MeshLambertMaterial({ color: 0x2f6f86, transparent: true, opacity: 0.78 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_HALF * 2, WORLD_HALF * 2, 48, 48).rotateX(-Math.PI / 2), waterMat);
  water.position.y = WATER_Y;
  scene.add(water);

  return { mesh, water, colormapCanvas, detail: detailTexture() };
}

/** anima a água (chamar no loop) */
export function tickWater(water, t) {
  const pos = water.geometry.attributes.position;
  for (let i = 0; i < pos.count; i += 3) { // 1/3 dos vértices basta pro brilho
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, Math.sin(t * 1.4 + x * 0.12 + z * 0.09) * 0.07);
  }
  pos.needsUpdate = true;
}
