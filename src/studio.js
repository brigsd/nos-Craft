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

/** folha de contato: 4 ângulos × 2 rigs num único canvas (dataURL) */
export async function contact(id) {
  const prevRig = rigName, prevYaw = yaw, prevPitch = pitch;
  show(id);
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

window.__ST__ = { show, audit, contact, angle: (y, p, d) => { yaw = y; pitch = p; if (d) dist = d; spin = false; }, list: () => REGISTRY.map((r) => r.id) };
