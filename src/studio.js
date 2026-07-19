// A FORJA · estúdio — um objeto por vez, sob luz honesta.
// Botões: objeto, rig de luz, fundo, wireframe, girar. HUD com stats.
// QA hooks: __ST__.show(id) .angle(yaw,pitch,dist) .contact(id) .audit(id)
import * as THREE from 'three';
import { REGISTRY, byId, BUDGET } from './registry.js';
import { statsOf } from './lib/geo.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2b3038);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.05, 300);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- palco ----------
const stage = new THREE.Group();
scene.add(stage);
const grid = new THREE.GridHelper(20, 20, 0x556066, 0x39424a);
scene.add(grid);
// figura de referência 1.80m (silhueta cinza)
const ref = (() => {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: 0x5a636b });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.1, 3, 8), m);
  body.position.y = 0.98; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), m);
  head.position.y = 1.66; g.add(head);
  g.position.x = -2.2;
  return g;
})();
scene.add(ref);

// ---------- rigs de luz ----------
const rigs = {};
{
  const mk = (name, lights) => { const g = new THREE.Group(); lights.forEach((l) => g.add(l)); g.visible = false; scene.add(g); rigs[name] = g; };
  /* Forja ronda 3: 2.6 direto estourava branco puro nas normais CONTÍNUAS
     do loft (a caixa só tinha ~6 direções de normal; a malha orgânica tem
     infinitas, então mais área pega o ângulo de brilho máximo) */
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.7); sun.position.set(-6, 10, 5);
  mk('dia', [sun, new THREE.HemisphereLight(0xbdd9ff, 0x5a6a44, 1.0)]);
  const dusk = new THREE.DirectionalLight(0xffa050, 2.2); dusk.position.set(8, 3, -2);
  mk('tarde', [dusk, new THREE.HemisphereLight(0x6a70b8, 0x4a3a30, 0.8)]);
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(-5, 8, 6);
  const fill = new THREE.DirectionalLight(0xd8d2c8, 0.55); fill.position.set(6, 3, -4); // neutro-quente (o azul lavava a parede sombreada)
  const rim = new THREE.DirectionalLight(0xffe0a0, 1.4); rim.position.set(0, 5, -8);
  mk('estudio', [key, fill, rim, new THREE.AmbientLight(0x404850, 0.6)]);
}
let rigName = 'dia';
rigs[rigName].visible = true;

// ---------- estado ----------
let current = null, currentId = null, spin = true, wire = false;
let yaw = 0.7, pitch = 0.32, dist = 8;

export function show(id) {
  const entry = byId(id);
  if (!entry) return null;
  if (current) stage.remove(current);
  current = entry.make();
  stage.add(current);
  currentId = id;
  const st = statsOf(current);
  const size = new THREE.Vector3(
    st.bbox.max[0] - st.bbox.min[0], st.bbox.max[1] - st.bbox.min[1], st.bbox.max[2] - st.bbox.min[2],
  );
  dist = Math.max(4, size.length() * 1.5);
  setWire(wire);
  tag(`${id} · ${st.tris} tris · ${st.meshes} meshes · ${st.materials} mat · ${size.x.toFixed(1)}×${size.y.toFixed(1)}×${size.z.toFixed(1)}m (budget ${BUDGET[entry.cat]})`);
  return st;
}
function setWire(on) {
  wire = on;
  if (!current) return;
  current.traverse((o) => { if (o.isMesh) o.material = on ? new THREE.MeshBasicMaterial({ wireframe: true, color: 0x9adf6a }) : o.userData.origMat ?? o.material; });
}
function tag(text) { document.getElementById('tag').textContent = text; }

// ---------- crítico em-página ----------
export function audit(id) {
  const entry = byId(id);
  const obj = entry.make();
  const st = statsOf(obj);
  const f = [];
  const H = st.bbox.max[1] - st.bbox.min[1];
  if (st.tris > BUDGET[entry.cat]) f.push({ level: 'error', check: 'budget', msg: `${st.tris} tris > orçamento ${BUDGET[entry.cat]} (${entry.cat})` });
  if (st.tris > BUDGET[entry.cat] * 0.75) f.push({ level: 'warn', check: 'budget', msg: `${st.tris} tris já em ${Math.round(st.tris / BUDGET[entry.cat] * 100)}% do orçamento` });
  if (st.materials > 8) f.push({ level: 'warn', check: 'drawcalls', msg: `${st.materials} materiais (mais material = mais draw call; funda o que der)` });
  if (st.bbox.min[1] > 0.12) f.push({ level: 'error', check: 'chao', msg: `flutuando: base em y=${st.bbox.min[1].toFixed(2)} (deveria tocar y≈0)` });
  if (st.bbox.min[1] < -0.6) f.push({ level: 'warn', check: 'chao', msg: `enterrado: base em y=${st.bbox.min[1].toFixed(2)}` });
  if (H < entry.h[0] || H > entry.h[1]) f.push({ level: 'error', check: 'escala', msg: `altura ${H.toFixed(2)}m fora da faixa [${entry.h[0]}, ${entry.h[1]}] (ref humano 1.80m)` });
  // peça ÓRFÃ / anatomia: bbox da geometria PRÓPRIA de cada mesh (não a do
  // Object3D.setFromObject, que soma os descendentes — por isso uma cabeça
  // flutuando dentro do tronco-pai sempre "tocava" nele, mesmo com um vão
  // vazio de verdade entre a malha do pescoço e a da cabeça; achado a olho,
  // Forja ronda 6, boneco com vão barriga->cabeça que este check deixou passar)
  {
    const boxes = [];
    obj.updateMatrixWorld(true);
    obj.traverse((o) => {
      if (!o.isMesh) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      boxes.push({ node: o, box: o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld) });
    });
    for (let i = 0; i < boxes.length; i++) {
      let touches = boxes.length === 1;
      for (let j = 0; j < boxes.length && !touches; j++) {
        if (i === j) continue;
        const a = boxes[i].box.clone().expandByScalar(0.05);
        if (a.intersectsBox(boxes[j].box)) touches = true;
      }
      if (!touches) { f.push({ level: 'error', check: 'anatomia', msg: `peça "${boxes[i].node.name || boxes[i].node.parent?.name || i}" não encosta em nada (vão vazio? base a ${boxes[i].box.min.y.toFixed(2)}m)` }); }
    }
  }
  // simetria de bbox no chão (objeto muito descentrado engana o posicionador)
  const cx = (st.bbox.max[0] + st.bbox.min[0]) / 2, cz = (st.bbox.max[2] + st.bbox.min[2]) / 2;
  if (Math.hypot(cx, cz) > Math.max(1, (st.bbox.max[0] - st.bbox.min[0])) * 0.4) {
    f.push({ level: 'warn', check: 'centro', msg: `centro do bbox a ${Math.hypot(cx, cz).toFixed(2)}m da origem` });
  }
  return { id, stats: st, findings: f };
}

/** folha de contato: 4 ângulos × 2 rigs num único canvas (dataURL).
    hideNames (opcional): esconde peças pelo nome ANTES de fotografar — a
    visão MICRO do fluxo isolar->auditar->melhorar->MACRO (docs/FORJA.md). */
export async function contact(id, hideNames) {
  const prevRig = rigName, prevYaw = yaw, prevPitch = pitch;
  show(id);
  if (hideNames && hideNames.length) hide(hideNames);
  const S = 480;
  const sheet = document.createElement('canvas');
  sheet.width = S * 4; sheet.height = S * 2;
  const g = sheet.getContext('2d');
  const shots = [];
  for (const rn of ['dia', 'estudio']) {
    for (let k = 0; k < 4; k++) shots.push({ rig: rn, yaw: 0.7 + (k * Math.PI) / 2 });
  }
  const old = renderer.getSize(new THREE.Vector2());
  renderer.setSize(S, S, false);
  camera.aspect = 1; camera.updateProjectionMatrix();
  for (let i = 0; i < shots.length; i++) {
    setRig(shots[i].rig);
    yaw = shots[i].yaw;
    placeCamera();
    renderer.render(scene, camera);
    const img = new Image();
    img.src = renderer.domElement.toDataURL();
    await new Promise((ok) => { img.onload = ok; });
    g.drawImage(img, (i % 4) * S, Math.floor(i / 4) * S, S, S);
    g.fillStyle = '#f0c95c'; g.font = '16px Georgia';
    g.fillText(`${id} · ${shots[i].rig} · ${Math.round((shots[i].yaw * 180) / Math.PI)}°`, (i % 4) * S + 10, Math.floor(i / 4) * S + 22);
  }
  renderer.setSize(old.x, old.y, false);
  camera.aspect = old.x / old.y; camera.updateProjectionMatrix();
  setRig(prevRig); yaw = prevYaw; pitch = prevPitch;
  return sheet.toDataURL('image/png');
}
function setRig(name) {
  rigs[rigName].visible = false;
  rigName = name;
  rigs[rigName].visible = true;
}

// ---------- câmera/loop ----------
function placeCamera() {
  const cy = Math.max(1.2, dist * Math.sin(pitch));
  camera.position.set(Math.sin(yaw) * dist, cy, Math.cos(yaw) * dist);
  const bb = current ? new THREE.Box3().setFromObject(current) : null;
  const midY = bb ? (bb.min.y + bb.max.y) / 2 : 1;
  camera.lookAt(0, midY, 0);
}
let dragging = false, lx = 0, ly = 0;
addEventListener('mousedown', (e) => { if (e.target.tagName === 'CANVAS') { dragging = true; lx = e.clientX; ly = e.clientY; } });
addEventListener('mouseup', () => { dragging = false; });
addEventListener('mousemove', (e) => {
  if (!dragging) return;
  yaw -= (e.clientX - lx) * 0.008; pitch = Math.min(1.3, Math.max(0.02, pitch + (e.clientY - ly) * 0.006));
  lx = e.clientX; ly = e.clientY;
  spin = false;
});
addEventListener('wheel', (e) => { dist = Math.min(60, Math.max(1.5, dist + Math.sign(e.deltaY) * (dist * 0.12))); });

// ---------- barra de botões ----------
const bar = document.getElementById('bar');
function btn(label, fn, group) {
  const b = document.createElement('button');
  b.textContent = label;
  b.onclick = () => { fn(b); if (group) [...bar.querySelectorAll(`[data-g="${group}"]`)].forEach((x) => x.classList.remove('on')); if (group) b.classList.add('on'); };
  if (group) b.dataset.g = group;
  bar.appendChild(b);
  return b;
}
for (const r of REGISTRY) btn(r.id, () => show(r.id), 'obj');
bar.appendChild(document.createTextNode(' · '));
for (const rn of Object.keys(rigs)) btn(rn, () => setRig(rn), 'rig');
bar.appendChild(document.createTextNode(' · '));
btn('girar', () => { spin = !spin; });
btn('wireframe', () => {
  if (!current) return;
  current.traverse((o) => { if (o.isMesh && !o.userData.origMat) o.userData.origMat = o.material; });
  setWire(!wire);
});

const url = new URL(location.href);
show(url.searchParams.get('obj') ?? 'casa');

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = (now - last) / 1000; last = now;
  if (spin) yaw += dt * 0.5;
  placeCamera();
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);

/** esconde peças pelo nome (Object3D.name) — pra isolar o resto do objeto
    sem o que atrapalha (ex.: hide(['torso']) some com tronco+cabeça+braços,
    que são todos filhos dele, sobrando só quadril+pernas). Lista de ESCONDER,
    não de mostrar: nomes novos adicionados em qualquer lugar do rig ficam
    visíveis por padrão — não quebram silenciosamente uma chamada antiga
    (achado da Forja ronda 7: a v1 era lista-do-que-mostrar e uma peça nova
    nomeada sumia sem aviso se não fosse listada). */
function hide(names) {
  if (!current) return;
  const set = new Set(names);
  current.traverse((o) => { if (set.has(o.name)) o.visible = false; });
}
/**
 * NOTA DE SILHUETA (ronda 8) — o "está realmente bom?" vira número.
 * Renderiza o objeto (com peças escondidas via hideNames) de um ângulo,
 * extrai a máscara de pixels não-fundo, e compara com um polígono de
 * referência (traçado de foto real, y pra cima) por IoU depois de
 * normalizar as duas bboxes. Devolve { iou, overlay } — overlay é um PNG
 * com o render + o contorno da referência por cima, pro olho conferir
 * ONDE a forma foge, não só o quanto.
 */
export async function silScore(id, refPoly, { hide: hideNames = [], yaw: sy = Math.PI / 2, pitch: sp = 0.03 } = {}) {
  const prevYaw = yaw, prevPitch = pitch, prevSpin = spin;
  show(id);
  if (hideNames.length) hide(hideNames);
  grid.visible = false; ref.visible = false;
  yaw = sy; pitch = sp; spin = false;
  // enquadra no que ficou visível (setFromObject ignoraria o hide)
  const bb = new THREE.Box3();
  current.updateMatrixWorld(true);
  current.traverse((o) => {
    if (!o.isMesh) return;
    for (let n = o; n; n = n.parent) if (!n.visible) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    bb.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
  });
  const size = bb.getSize(new THREE.Vector3());
  dist = Math.max(1.2, size.length() * 1.9);
  const S = 480;
  const old = renderer.getSize(new THREE.Vector2());
  renderer.setSize(S, S, false);
  camera.aspect = 1; camera.updateProjectionMatrix();
  const mid = bb.getCenter(new THREE.Vector3());
  camera.position.set(Math.sin(yaw) * dist, mid.y + dist * Math.sin(pitch), Math.cos(yaw) * dist);
  camera.lookAt(mid.x, mid.y, mid.z);
  renderer.render(scene, camera);
  const shot = document.createElement('canvas');
  shot.width = shot.height = S;
  shot.getContext('2d').drawImage(renderer.domElement, 0, 0);
  renderer.setSize(old.x, old.y, false);
  camera.aspect = old.x / old.y; camera.updateProjectionMatrix();
  grid.visible = true; ref.visible = true;
  yaw = prevYaw; pitch = prevPitch; spin = prevSpin;

  // ---- máscara do render (pixel != cor de fundo) ----
  // fundo REAL amostrado do canto do frame — calcular via THREE.Color dava
  // valores em espaço linear (setHex converte sRGB->linear) enquanto o
  // framebuffer está em sRGB: a máscara marcava o fundo inteiro como objeto
  const px = shot.getContext('2d').getImageData(0, 0, S, S).data;
  const bgr = px[0], bgg = px[1], bgb = px[2];
  const mask = new Uint8Array(S * S);
  let x0 = S, x1 = 0, y0 = S, y1 = 0;
  for (let i = 0; i < S * S; i++) {
    const d = Math.abs(px[i * 4] - bgr) + Math.abs(px[i * 4 + 1] - bgg) + Math.abs(px[i * 4 + 2] - bgb);
    if (d > 28) {
      mask[i] = 1;
      const x = i % S, y = (i / S) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 <= x0) return { iou: 0, overlay: null };

  /* ---- normalização HONESTA: escala uniforme pelo comprimento, sola
     alinhada embaixo. A v1 esticava cada bbox pra um quadrado — isso
     perdoava proporção errada (altura×comprimento) e fazia a nota oscilar
     por re-registro quando a forma mal mudava. Com escala uniforme, se o
     objeto é alto demais pro comprimento, a nota CAI — proporção agora é
     parte da régua. */
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const rxs = refPoly.map((p) => p[0]), rys = refPoly.map((p) => p[1]);
  const rx0 = Math.min(...rxs), rx1 = Math.max(...rxs), ry0 = Math.min(...rys), ry1 = Math.max(...rys);
  const rw = rx1 - rx0, rh = ry1 - ry0;
  const N = 220; // largura comum
  const objH = Math.max(2, Math.round((h / w) * N));
  const refH = Math.max(2, Math.round((rh / rw) * N));
  const MH = Math.max(objH, refH);

  const refCv = document.createElement('canvas'); refCv.width = N; refCv.height = MH;
  const rg = refCv.getContext('2d');
  rg.fillStyle = '#fff';
  rg.beginPath();
  refPoly.forEach(([x, y], i) => {
    const X = ((x - rx0) / rw) * N;
    const Y = MH - ((y - ry0) / rh) * refH; // y pra cima + sola no fundo
    i ? rg.lineTo(X, Y) : rg.moveTo(X, Y);
  });
  rg.closePath(); rg.fill();
  const refPx = rg.getImageData(0, 0, N, MH).data;

  const objCv = document.createElement('canvas'); objCv.width = N; objCv.height = MH;
  const og = objCv.getContext('2d');
  og.drawImage(shot, x0, y0, w, h, 0, MH - objH, N, objH);
  const objPx = og.getImageData(0, 0, N, MH).data;

  let inter = 0, uni = 0;
  for (let i = 0; i < N * MH; i++) {
    const a = refPx[i * 4] > 127 ? 1 : 0;
    const b = Math.abs(objPx[i * 4] - bgr) + Math.abs(objPx[i * 4 + 1] - bgg) + Math.abs(objPx[i * 4 + 2] - bgb) > 28 ? 1 : 0;
    if (a && b) inter++;
    if (a || b) uni++;
  }
  const iou = uni ? inter / uni : 0;

  // ---- overlay: recorte do render + contorno da ref por cima (2x) ----
  const ov = document.createElement('canvas'); ov.width = N * 2; ov.height = MH * 2;
  const vg = ov.getContext('2d');
  vg.fillStyle = '#22262c'; vg.fillRect(0, 0, N * 2, MH * 2);
  vg.imageSmoothingEnabled = false;
  vg.drawImage(shot, x0, y0, w, h, 0, (MH - objH) * 2, N * 2, objH * 2);
  vg.strokeStyle = '#8ff8e2'; vg.lineWidth = 2; vg.setLineDash([6, 4]);
  vg.beginPath();
  refPoly.forEach(([x, y], i) => {
    const X = ((x - rx0) / rw) * N * 2;
    const Y = (MH - ((y - ry0) / rh) * refH) * 2;
    i ? vg.lineTo(X, Y) : vg.moveTo(X, Y);
  });
  vg.closePath(); vg.stroke();
  vg.fillStyle = '#f0c95c'; vg.font = '20px Georgia';
  vg.fillText(`IoU ${(iou * 100).toFixed(1)}%`, 10, 26);
  return { iou, overlay: ov.toDataURL('image/png') };
}

window.__ST__ = {
  show, audit, contact, hide, silScore,
  angle: (y, p, d) => { yaw = y; pitch = p; if (d) dist = d; spin = false; },
  list: () => REGISTRY.map((r) => r.id),
};
