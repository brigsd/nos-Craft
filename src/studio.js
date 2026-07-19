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
  const regions = {
    'topo-esq': { extra: 0, missing: 0, ref: 0 },
    'topo-dir': { extra: 0, missing: 0, ref: 0 },
    'meio-esq': { extra: 0, missing: 0, ref: 0 },
    'meio-dir': { extra: 0, missing: 0, ref: 0 },
    'base-esq': { extra: 0, missing: 0, ref: 0 },
    'base-dir': { extra: 0, missing: 0, ref: 0 },
  };

  for (let i = 0; i < N * MH; i++) {
    const a = refPx[i * 4] > 127 ? 1 : 0;
    const b = Math.abs(objPx[i * 4] - bgr) + Math.abs(objPx[i * 4 + 1] - bgg) + Math.abs(objPx[i * 4 + 2] - bgb) > 28 ? 1 : 0;
    if (a && b) inter++;
    if (a || b) uni++;

    const x = i % N;
    const y = (i / N) | 0;
    const rY = y < MH / 3 ? 'topo' : y < (2 * MH) / 3 ? 'meio' : 'base';
    const rX = x < N / 2 ? 'esq' : 'dir';
    const regKey = `${rY}-${rX}`;

    if (a) regions[regKey].ref++;
    if (b && !a) regions[regKey].extra++;
    if (a && !b) regions[regKey].missing++;
  }
  const iou = uni ? inter / uni : 0;

  const feedback = [];
  const totalRef = Object.values(regions).reduce((acc, r) => acc + r.ref, 0) || 1;

  const ratioDiff = Math.round(((objH - refH) / refH) * 100);
  if (Math.abs(ratioDiff) >= 3) {
    if (ratioDiff > 0) feedback.push(`  ! proporção: ${ratioDiff}% mais alto/fino que a referência`);
    else feedback.push(`  ! proporção: ${Math.abs(ratioDiff)}% mais baixo/largo que a referência`);
  }

  for (const [key, r] of Object.entries(regions)) {
    const extraPct = Math.round((r.extra / totalRef) * 100);
    const missingPct = Math.round((r.missing / totalRef) * 100);
    if (extraPct >= 2) feedback.push(`  + sobra material em ${key} (+${extraPct}%)`);
    if (missingPct >= 2) feedback.push(`  - falta material em ${key} (-${missingPct}%)`);
  }

  const diagText = feedback.length ? feedback.join('\n') : '  ✓ forma e proporção muito alinhadas com a referência';

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
  return { iou, overlay: ov.toDataURL('image/png'), diagText, regions };
}

/**
 * TRAÇADOR (ronda 9) — desenho vira polígono automaticamente, pro ideador
 * poder participar DESENHANDO vistas. Recebe uma imagem (dataURL): traço
 * escuro FECHADO (ou forma preenchida) sobre fundo claro. Pipeline:
 * binariza por luminância -> flood-fill das bordas marca o LADO DE FORA
 * (então o miolo de um contorno fechado conta como dentro) -> maior
 * componente -> contorno por Moore-neighbor -> simplifica (Douglas-Peucker)
 * até ~maxPontos. Devolve polígono y-PRA-CIMA pronto pra fromViews/refs.
 */
export async function trace(dataURL, { maxPontos = 18, limiar = 150 } = {}) {
  const img = new Image();
  img.src = dataURL;
  await new Promise((ok, err) => { img.onload = ok; img.onerror = err; });
  const W = Math.min(img.width, 640);
  const H = Math.round(img.height * (W / img.width));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); // achata transparência pra claro
  g.drawImage(img, 0, 0, W, H);
  const px = g.getImageData(0, 0, W, H).data;
  const dark = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const lum = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    dark[i] = lum < limiar ? 1 : 0;
  }
  // fora = claro alcançável da borda; dentro = todo o resto (fecha contornos)
  const out = new Uint8Array(W * H);
  const stack = [];
  for (let x = 0; x < W; x++) { stack.push(x, (H - 1) * W + x); }
  for (let y = 0; y < H; y++) { stack.push(y * W, y * W + W - 1); }
  while (stack.length) {
    const i = stack.pop();
    if (out[i] || dark[i]) continue;
    out[i] = 1;
    const x = i % W, y = (i / W) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < W - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - W);
    if (y < H - 1) stack.push(i + W);
  }
  const solid = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) solid[i] = out[i] ? 0 : 1;
  // maior componente sólida (ignora sujeirinhas)
  const comp = new Int32Array(W * H).fill(-1);
  let best = -1, bestN = 0, nComp = 0;
  for (let i0 = 0; i0 < W * H; i0++) {
    if (!solid[i0] || comp[i0] >= 0) continue;
    let n = 0; const st = [i0]; comp[i0] = nComp;
    while (st.length) {
      const i = st.pop(); n++;
      const x = i % W, y = (i / W) | 0;
      for (const j of [i - 1, i + 1, i - W, i + W]) {
        if (j < 0 || j >= W * H) continue;
        const jx = j % W; if (Math.abs(jx - x) > 1) continue;
        if (solid[j] && comp[j] < 0) { comp[j] = nComp; st.push(j); }
      }
    }
    if (n > bestN) { bestN = n; best = nComp; }
    nComp++;
  }
  const isIn = (x, y) => x >= 0 && x < W && y >= 0 && y < H && comp[y * W + x] === best;
  // contorno Moore-neighbor a partir do primeiro pixel da componente
  let sx = -1, sy = -1;
  outer: for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isIn(x, y)) { sx = x; sy = y; break outer; }
  if (sx < 0) return null;
  const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const path = [[sx, sy]];
  let cx = sx, cy = sy, dir = 7;
  for (let step = 0; step < W * H * 4; step++) {
    let found = false;
    for (let k = 0; k < 8; k++) {
      const d = (dir + 6 + k) % 8; // vira à esquerda primeiro (segue a borda)
      const nx = cx + DIRS[d][0], ny = cy + DIRS[d][1];
      if (isIn(nx, ny)) { cx = nx; cy = ny; dir = d; found = true; break; }
    }
    if (!found) break;
    if (cx === sx && cy === sy) break;
    path.push([cx, cy]);
  }
  // Douglas-Peucker até caber em maxPontos
  const dp = (pts, eps) => {
    if (pts.length < 3) return pts;
    const [x0, y0] = pts[0], [x1, y1] = pts[pts.length - 1];
    let iMax = 0, dMax = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const [x, y] = pts[i];
      const d = Math.abs((y1 - y0) * x - (x1 - x0) * y + x1 * y0 - y1 * x0) / (Math.hypot(x1 - x0, y1 - y0) || 1);
      if (d > dMax) { dMax = d; iMax = i; }
    }
    if (dMax < eps) return [pts[0], pts[pts.length - 1]];
    const a = dp(pts.slice(0, iMax + 1), eps), b = dp(pts.slice(iMax), eps);
    return a.slice(0, -1).concat(b);
  };
  let eps = 1, poly = path;
  for (let k = 0; k < 24 && poly.length > maxPontos; k++) { poly = dp(path, eps); eps *= 1.4; }
  // y pra cima + arredonda
  return poly.map(([x, y]) => [Math.round(x), Math.round(H - 1 - y)]);
}

window.__ST__ = {
  show, audit, contact, hide, silScore, trace,
  angle: (y, p, d) => { yaw = y; pitch = p; if (d) dist = d; spin = false; },
  list: () => REGISTRY.map((r) => r.id),
};
