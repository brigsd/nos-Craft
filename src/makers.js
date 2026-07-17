// Construtores PUROS de objetos — cada um devolve um Group centrado na
// origem com o chão em y=0. O estúdio (studio.html) audita cada um aqui;
// props.js só POSICIONA no terreno. Regra: objeto novo nasce no estúdio,
// passa no olhar, e só então entra no mapa.
import * as THREE from 'three';
import { hash2, mulberry32 } from './rng.js';

/* materiais MEMOIZADOS por cor+opts — a Forja acusou 13-15 draw calls por
   objeto quando cada Mesh criava o seu (achado da ronda 1) */
const _matCache = new Map();
export const M = (color, opts = {}) => {
  const key = color + JSON.stringify(opts);
  if (!_matCache.has(key)) _matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return _matCache.get(key);
};

// ---------- vegetação ----------
export function treeParts(kind) { // geometrias por parte (o plantio instancia)
  if (kind === 'pinheiro') {
    const trunk = new THREE.CylinderGeometry(0.22, 0.34, 2.2, 6);
    trunk.translate(0, 1.1, 0);
    const parts = [{ geo: trunk, color: 0x5d4130 }];
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.ConeGeometry(1.9 - i * 0.5, 2.0, 7);
      cone.translate(0, 2.6 + i * 1.25, 0);
      parts.push({ geo: cone, color: 0x2f6633 });
    }
    return parts;
  }
  const trunk = new THREE.CylinderGeometry(0.28, 0.42, 2.6, 6);
  trunk.translate(0, 1.3, 0);
  const parts = [{ geo: trunk, color: 0x6b4a30 }];
  const c1 = new THREE.IcosahedronGeometry(1.9, 0); c1.translate(0, 3.6, 0);
  const c2 = new THREE.IcosahedronGeometry(1.4, 0); c2.translate(1.1, 3.0, 0.5);
  const c3 = new THREE.IcosahedronGeometry(1.3, 0); c3.translate(-1.0, 3.1, -0.4);
  for (const c of [c1, c2, c3]) parts.push({ geo: c, color: 0x3f7d2c });
  return parts;
}
export function makeTree(kind = 'carvalho') {
  const g = new THREE.Group();
  for (const p of treeParts(kind)) g.add(new THREE.Mesh(p.geo, M(p.color)));
  return g;
}
export function makeRock(seed = 1) {
  const rnd = mulberry32(seed * 77 + 3);
  const r = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), M(0x8f8b84));
  r.scale.set(0.6 + rnd() * 1.1, 0.45 + rnd() * 0.55, 0.6 + rnd() * 1.1);
  r.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
  const g = new THREE.Group(); g.add(r);
  /* Forja ronda 1: nascia enterrada/gigante. TETO de altura pela bbox
     (a rotação livre fazia o eixo longo virar altura) e aterrar depois. */
  g.updateMatrixWorld(true);
  let bb = new THREE.Box3().setFromObject(g);
  const h = bb.max.y - bb.min.y;
  if (h > 1.55) { r.scale.multiplyScalar(1.55 / h); g.updateMatrixWorld(true); bb = new THREE.Box3().setFromObject(g); }
  r.position.y = -bb.min.y - (bb.max.y - bb.min.y) * 0.15;
  return g;
}

// ---------- vila ----------
export function makeHouse({ w = 5, d = 6, hW = 2.6, roofColor = 0x8a4a34 } = {}) {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, hW, d), M(0xd8cfb4));
  wall.position.y = hW / 2; g.add(wall);
  const beam = M(0x5a4330);
  for (const [bx, bz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, hW, 0.3), beam);
    b.position.set(bx, hW / 2, bz); g.add(b);
  }
  const trav = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.26, d + 0.06), beam);
  trav.position.y = hW - 0.6; g.add(trav);
  /* telhado de DUAS ÁGUAS de verdade (prisma), não cone — v2 do estúdio:
     o cone lia como chapéu de circo de certos ângulos */
  const roofH = 1.9;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 - 0.5, 0); shape.lineTo(w / 2 + 0.5, 0); shape.lineTo(0, roofH); shape.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: d + 1, bevelEnabled: false });
  roofGeo.translate(0, hW, -(d + 1) / 2);
  const roof = new THREE.Mesh(roofGeo, M(roofColor));
  g.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.7, 0.12), M(0x4a3626));
  door.position.set(0, 0.85, d / 2 + 0.04); g.add(door);
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.1), M(0xf7dd90, { emissive: 0x6a5210 }));
  win.position.set(w / 4, 1.5, d / 2 + 0.04); g.add(win);
  return g;
}
export function makeWell() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.9, 10), M(0x9a948c));
  ring.position.y = 0.45; g.add(ring);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.0, 6), M(0x7a4a34));
  roof.position.y = 2.4; g.add(roof);
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.9, 0.16), M(0x5a4330));
    post.position.set(s * 0.9, 1.4, 0); g.add(post);
  }
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.22, 7), M(0x6b543c));
  bucket.position.y = 1.15; g.add(bucket);
  return g;
}
export function makeShrine() {
  const g = new THREE.Group();
  const st = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.6, 0.7), M(0xb9c4cf));
  st.position.y = 1.3; st.rotation.y = 0.3; g.add(st);
  const runa = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.07, 6, 12), M(0x74d0ff, { emissive: 0x2a6a8a }));
  runa.position.set(0, 1.7, 0.38); runa.rotation.y = 0.3; g.add(runa);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.3, 8), M(0x8a948a));
  base.position.y = 0.15; g.add(base);
  return g;
}

// ---------- acampamento ----------
export function makeTent(s = 1, seed = 5) {
  const g = new THREE.Group();
  const rnd = mulberry32(seed * 31 + 7);
  /* v2 do estúdio: cone liso lia como "montinho de areia" — agora tem
     ABERTURA escura, mastro saindo do topo e remendo de pano */
  const skin = new THREE.Mesh(new THREE.ConeGeometry(2.4 * s, 2.6 * s, 8, 1, true), M(0x8a6a4a, { side: THREE.DoubleSide }));
  skin.position.y = 1.3 * s; g.add(skin);
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.62 * s, 8), M(0x241a12));
  mouth.position.set(0, 0.62 * s, 2.13 * s);
  mouth.rotation.x = -0.42;
  g.add(mouth);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0 * s, 5), M(0x4a3a28));
  pole.position.y = 2.9 * s; g.add(pole);
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.7 * s, 0.5 * s), M(0x6d523a));
  patch.position.set(-1.2 * s, 1.5 * s, -1.16 * s);
  patch.lookAt(-3 * s, 2.4 * s, -3 * s);
  g.add(patch);
  g.rotation.y = rnd() * 0.6;
  return g;
}
export function makeCampfire() {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.2, 5), M(0x4a3320));
    log.rotation.set(Math.PI / 2.2, (i / 5) * Math.PI * 2, 0);
    log.position.y = 0.18;
    g.add(log);
  }
  const stonering = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), M(0x7a766e));
    s.position.set(Math.cos(a) * 0.85, 0.12, Math.sin(a) * 0.85);
    stonering.add(s);
  }
  g.add(stonering);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 6), M(0xff8c2a, { emissive: 0xcc5200 }));
  flame.position.y = 0.8; flame.name = 'flame';
  g.add(flame);
  return g;
}
export function makeBanner() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.2, 6), M(0x5a4330));
  pole.position.y = 2.1; g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.1), M(0x8a2a22, { side: THREE.DoubleSide }));
  flag.position.set(0.85, 3.4, 0); g.add(flag);
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), M(0xd8d3c4));
  skull.position.y = 4.3; g.add(skull);
  return g;
}
export function makeStake(seed = 1) {
  const g = new THREE.Group();
  const s = new THREE.Mesh(new THREE.ConeGeometry(0.22, 2.4, 5), M(0x6a4c30));
  s.position.y = 1.1;
  s.rotation.z = (hash2(seed, 3) - 0.5) * 0.3;
  g.add(s);
  return g;
}

// ---------- ponte ----------
export function makeBridge() {
  const g = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.35, 14), M(0x77593c));
  deck.position.y = 1.0; g.add(deck);
  for (const sx of [-1.9, 1.9]) {
    for (const sz of [-6, -2, 2, 6]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.1, 0.22), M(0x5a4330));
      post.position.set(sx, 1.7, sz); g.add(post);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 14), M(0x5a4330));
    rail.position.set(sx, 2.1, 0); g.add(rail);
  }
  for (const sz of [-1, 1]) {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.3, 2.6), M(0x8a6a48));
    ramp.position.set(0, 0.62, sz * 8.1);
    ramp.rotation.x = -sz * 0.3;
    g.add(ramp);
  }
  return g;
}

// ---------- portal ----------
export function makePortalStone(i = 0) {
  const g = new THREE.Group();
  const hH = 2.6 + hash2(i, 9) * 1.2;
  const st = new THREE.Mesh(new THREE.BoxGeometry(0.9, hH, 0.7), M(0xa9b4bf));
  st.position.y = hH / 2 - 0.25;
  st.rotation.z = (hash2(i, 5) - 0.5) * 0.14;
  g.add(st);
  /* glifo lavanda raso (eco dos monólitos do Coração) */
  if (hash2(i, 11) < 0.6) {
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.5), M(0xa884f3, { emissive: 0x4a3080 }));
    gl.position.set(0, hH * 0.55, 0.36);
    g.add(gl);
  }
  return g;
}
export function makePortalArch() {
  const g = new THREE.Group();
  const archM = M(0x9aa7b4);
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 5.2, 0.8), archM);
    p.position.set(s * 2.1, 2.6, 0); g.add(p);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.2), archM);
    foot.position.set(s * 2.1, 0.25, 0); g.add(foot);
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.8, 0.9), archM);
  top.position.y = 5.15; g.add(top);
  const key = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 1.0), M(0xb9c4cf));
  key.position.y = 5.65; g.add(key);
  // véu
  const veilTex = (() => {
    const s = 128, c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    for (let i = 0; i < 240; i++) {
      const a = hash2(i, 1) * Math.PI * 2, r = hash2(i, 2) * 60;
      ctx.fillStyle = `rgba(${120 + hash2(i, 3) * 80},220,${200 + hash2(i, 4) * 55},${0.25 + hash2(i, 5) * 0.5})`;
      ctx.beginPath();
      ctx.arc(64 + Math.cos(a + r * 0.12) * r * 0.9, 64 + Math.sin(a + r * 0.12) * r * 0.9, 1.5 + hash2(i, 6) * 2.5, 0, 7);
      ctx.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const veil = new THREE.Mesh(
    new THREE.CircleGeometry(1.9, 24),
    new THREE.MeshBasicMaterial({ map: veilTex, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false }),
  );
  veil.position.y = 2.75; veil.name = 'veil';
  g.add(veil);
  return { group: g, veil };
}
