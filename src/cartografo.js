// O CARTÓGRAFO · ferramenta de mapa — vista de cima, 100% Canvas2D (sem
// WebGL: mais rápido de abrir, mais barato de auditar). Roda a MESMA
// geração de mundo do jogo (terrain.js/props.js) contra uma THREE.Scene
// nunca renderizada, só pra colher posições — e desenha um raio-X do
// layout: colormap pintado, estrada/rio, POIs, colisores, densidade de
// vegetação. É a resposta a "preciso entender o mapa antes de editar".
import * as THREE from 'three';
import { WORLD_HALF, POI, ROAD, RIVER, WATER_Y, heightAt, paintColormap } from './terrain.js';
import { plantForest, scatterRocks, buildVillage, buildBridge, buildGnollCamp, buildBanner, buildCave, buildPortal, COLLIDERS } from './props.js';

const cv = document.getElementById('mapCanvas');
const ctx = cv.getContext('2d');
const S = cv.width; // px por lado
const toWorld = WORLD_HALF * 2;
const px = (wx) => ((wx + WORLD_HALF) / toWorld) * S;

// ---------- gera o mundo (headless: Scene nunca vai a um renderer) ----------
const scene = new THREE.Scene();
const t0 = performance.now();
const nTrees = plantForest(scene);
scatterRocks(scene);
buildVillage(scene);
buildBridge(scene);
buildGnollCamp(scene);
buildBanner(scene);
buildCave(scene);
buildPortal(scene);
const buildMs = (performance.now() - t0).toFixed(0);

// posições de TODO objeto top-level da cena (aprox. 1 marcador por prédio/prop;
// InstancedMesh das árvores/pedras conta como 1 marcador — a densidade real
// já está em nTrees e no próprio colormap)
const placements = [];
scene.traverse((o) => {
  if (o === scene) return;
  if (o.parent !== scene) return; // só top-level (cada makeX() é 1 grupo)
  const p = o.position;
  let kind = 'prop';
  if (o.isInstancedMesh) kind = 'vegetacao';
  placements.push({ kind, x: p.x, z: p.z });
});

// ---------- fundo: o colormap pintado real do terreno ----------
const colormap = paintColormap(1024);
const bg = document.createElement('canvas');
bg.width = bg.height = S;
bg.getContext('2d').drawImage(colormap, 0, 0, S, S);

// ---------- camadas ----------
const LAYERS = {
  terreno: true, agua: true, estrada: true, poi: true, colisores: false, objetos: true, grade: true,
};
const LEGEND = [
  ['POI', '#8ff8e2'], ['Colisor', '#ff5642'], ['Construção', '#f0c95c'], ['Vegetação', '#3f7d2c'], ['Estrada', '#c9a86a'], ['Rio/Lago', '#3aa0c8'],
];

function drawPath(pts, color, width) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
  pts.forEach(([x, z], i) => { const X = px(x), Z = px(z); i ? ctx.lineTo(X, Z) : ctx.moveTo(X, Z); });
  ctx.stroke();
}

let hoverInfo = '';
function render() {
  ctx.clearRect(0, 0, S, S);
  if (LAYERS.terreno) ctx.drawImage(bg, 0, 0);
  else { ctx.fillStyle = '#0e1210'; ctx.fillRect(0, 0, S, S); }

  if (LAYERS.grade) {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
    for (let g = -WORLD_HALF; g <= WORLD_HALF; g += 20) {
      ctx.beginPath(); ctx.moveTo(px(g), 0); ctx.lineTo(px(g), S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, px(g)); ctx.lineTo(S, px(g)); ctx.stroke();
    }
  }
  if (LAYERS.estrada) drawPath(ROAD, '#c9a86a', 3);
  if (LAYERS.agua) drawPath(RIVER, '#3aa0c8', 5);

  if (LAYERS.colisores) {
    ctx.strokeStyle = 'rgba(255,86,66,0.7)'; ctx.lineWidth = 1;
    for (const c of COLLIDERS) { ctx.beginPath(); ctx.arc(px(c.x), px(c.z), (c.r / toWorld) * S, 0, 7); ctx.stroke(); }
  }
  if (LAYERS.objetos) {
    for (const p of placements) {
      ctx.fillStyle = p.kind === 'vegetacao' ? '#3f7d2c' : '#f0c95c';
      ctx.beginPath(); ctx.arc(px(p.x), px(p.z), p.kind === 'vegetacao' ? 1.6 : 3.2, 0, 7); ctx.fill();
    }
  }
  if (LAYERS.poi) {
    for (const [name, p] of Object.entries(POI)) {
      const X = px(p.x), Z = px(p.z);
      ctx.fillStyle = '#8ff8e2';
      ctx.beginPath(); ctx.arc(X, Z, 5, 0, 7); ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#dff8f0';
      ctx.font = '12px Georgia'; ctx.fillText(name, X + 8, Z - 6);
    }
  }
}

// ---------- toggles ----------
const togglesEl = document.getElementById('toggles');
for (const key of Object.keys(LAYERS)) {
  const row = document.createElement('div'); row.className = 'toggle';
  const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = LAYERS[key];
  cb.onchange = () => { LAYERS[key] = cb.checked; render(); };
  const lbl = document.createElement('span'); lbl.textContent = key;
  row.append(cb, lbl); togglesEl.appendChild(row);
}
const legendEl = document.getElementById('legend');
for (const [name, color] of LEGEND) {
  const row = document.createElement('div'); row.className = 'legend';
  row.innerHTML = `<span class="sw" style="background:${color}"></span>${name}`;
  legendEl.appendChild(row);
}

// ---------- readout dinâmico ----------
const readout = document.getElementById('readout');
function updateReadout(wx, wz) {
  const h = wx !== undefined ? heightAt(wx, wz).toFixed(2) : '—';
  readout.textContent =
    `mundo: ${toWorld}×${toWorld}m\n` +
    `árvores instanciadas: ${nTrees}\n` +
    `objetos posicionados: ${placements.length}\n` +
    `colisores: ${COLLIDERS.length}\n` +
    `build: ${buildMs}ms\n` +
    `--- cursor ---\n` +
    `x,z: ${wx !== undefined ? wx.toFixed(1) : '—'}, ${wz !== undefined ? wz.toFixed(1) : '—'}\n` +
    `altura: ${h}m`;
}
cv.addEventListener('mousemove', (e) => {
  const r = cv.getBoundingClientRect();
  const wx = ((e.clientX - r.left) / S) * toWorld - WORLD_HALF;
  const wz = ((e.clientY - r.top) / S) * toWorld - WORLD_HALF;
  updateReadout(wx, wz);
});
cv.addEventListener('mouseleave', () => updateReadout());

updateReadout();
render();
window.__CARTO__ = { placements, colliders: COLLIDERS, render, LAYERS, nTrees };
