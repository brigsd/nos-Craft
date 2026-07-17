// Colocação no MUNDO dos objetos aprovados no estúdio (makers.js).
// Regra da casa: objeto novo nasce em studio.html, passa no olhar, e só
// então ganha uma linha aqui. Este arquivo só posiciona/instancia.
import * as THREE from 'three';
import { heightAt, roadDist, riverDist, POI, WORLD_HALF, WATER_Y } from './terrain.js';
import { mulberry32, hash2, fbm } from './rng.js';
import {
  M, treeParts, makeHouse, makeWell, makeShrine, makeTent, makeCampfire,
  makeBanner, makeStake, makeBridge, makePortalStone, makePortalArch, makeRock,
} from './makers.js';

export const COLLIDERS = []; // {x,z,r}
const collide = (x, z, r) => COLLIDERS.push({ x, z, r });
const groundAt = (obj, x, z, rotY = 0, sink = 0.05) => {
  obj.position.set(x, heightAt(x, z) - sink, z);
  obj.rotation.y = rotY;
  return obj;
};

// ---------- floresta (instanciada por parte) ----------
export function plantForest(scene) {
  const rnd = mulberry32(4021);
  const spots = [];
  for (let i = 0; i < 4200 && spots.length < 620; i++) {
    const x = (rnd() * 2 - 1) * (WORLD_HALF - 14);
    const z = (rnd() * 2 - 1) * (WORLD_HALF - 14);
    const h = heightAt(x, z);
    if (h < WATER_Y + 0.6 || h > 34) continue;
    if (roadDist(x, z) < 6 || riverDist(x, z) < 9.5) continue;
    if (Math.hypot(x - POI.vila.x, z - POI.vila.z) < 34) continue;
    if (Math.hypot(x - POI.portal.x, z - POI.portal.z) < 20) continue;
    if (Math.hypot(x - POI.colinaGnoll.x, z - POI.colinaGnoll.z) < 24) continue;
    if (Math.hypot(x - POI.campoLobos.x, z - POI.campoLobos.z) < 26 && rnd() < 0.75) continue;
    const edge = Math.max(Math.abs(x), Math.abs(z)) / WORLD_HALF;
    const dens = 0.12 + fbm(x * 0.01 + 3, z * 0.01 + 8, 3) * 0.5 + edge * 0.5;
    if (rnd() > dens) continue;
    spots.push({ x, z, h, s: 0.8 + rnd() * 0.75, rot: rnd() * Math.PI * 2, b: rnd() < 0.4 });
  }
  const dummy = new THREE.Object3D();
  for (const [kind, isB] of [['carvalho', false], ['pinheiro', true]]) {
    const mine = spots.filter((s) => s.b === isB);
    for (const part of treeParts(kind)) {
      const im = new THREE.InstancedMesh(part.geo, M(part.color), mine.length);
      mine.forEach((s, i) => {
        dummy.position.set(s.x, s.h - 0.15, s.z);
        dummy.rotation.set(0, s.rot, 0);
        dummy.scale.setScalar(s.s);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      });
      scene.add(im);
    }
    mine.forEach((s) => collide(s.x, s.z, 0.55 * s.s));
  }
  return spots.length;
}

export function scatterRocks(scene) {
  const rnd = mulberry32(913);
  let n = 0;
  while (n < 90) {
    const x = (rnd() * 2 - 1) * (WORLD_HALF - 10), z = (rnd() * 2 - 1) * (WORLD_HALF - 10);
    if (heightAt(x, z) < WATER_Y + 0.3 || roadDist(x, z) < 5) { n += 0; if (++n > 4000) break; continue; }
    scene.add(groundAt(makeRock((x * 7 + z * 13) | 0), x, z, rnd() * 3, 0.15));
    n++;
  }
}

// ---------- vila ----------
export function buildVillage(scene) {
  const V = POI.vila;
  scene.add(groundAt(makeHouse({ w: 5, d: 6 }), V.x - 8, V.z - 8, 0.4)); collide(V.x - 8, V.z - 8, 3.6);
  scene.add(groundAt(makeHouse({ w: 4.4, d: 5, roofColor: 0x7a5a34 }), V.x + 9, V.z - 4, -0.5)); collide(V.x + 9, V.z - 4, 3.2);
  scene.add(groundAt(makeHouse({ w: 4.6, d: 5.4, roofColor: 0x6d4434 }), V.x - 10, V.z + 9, 1.2)); collide(V.x - 10, V.z + 9, 3.3);
  scene.add(groundAt(makeHouse({ w: 7.5, d: 8, hW: 3.2, roofColor: 0x6d3b2a }), POI.taverna.x, POI.taverna.z, 0.15)); collide(POI.taverna.x, POI.taverna.z, 4.8);
  scene.add(groundAt(makeWell(), V.x, V.z + 2)); collide(V.x, V.z + 2, 1.5);
  scene.add(groundAt(makeShrine(), POI.santuario.x, POI.santuario.z)); collide(POI.santuario.x, POI.santuario.z, 1.2);
  // cerca acompanhando a ladeira
  const fence = M(0x6b543c);
  for (let i = 0; i < 10; i++) {
    const x = V.x - 16 + i * 3.4, z = V.z + 14 + Math.sin(i) * 0.4;
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.0, 0.14), fence);
    p.position.set(x, heightAt(x, z) + 0.5, z);
    scene.add(p);
    if (i === 9) break;
    const x2 = x + 3.4, z2 = V.z + 14 + Math.sin(i + 1) * 0.4;
    const h1 = heightAt(x, z) + 0.82, h2 = heightAt(x2, z2) + 0.82;
    const r = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(3.4, h2 - h1), 0.12, 0.1), fence);
    r.position.set((x + x2) / 2, (h1 + h2) / 2, (z + z2) / 2);
    r.rotation.z = Math.atan2(h2 - h1, 3.4);
    r.rotation.y = -Math.atan2(z2 - z, 3.4);
    scene.add(r);
  }
}

export function buildBridge(scene) {
  const b = makeBridge();
  b.position.set(POI.ponte.x, WATER_Y + 0.5, POI.ponte.z + 6);
  b.rotation.y = 0.5;
  scene.add(b);
}

// ---------- acampamento gnoll ----------
export function buildGnollCamp(scene) {
  const { x: cx, z: cz } = POI.colinaGnoll;
  for (const [dx, dz, s, seed] of [[-8, -4, 1.2, 1], [6, -7, 1.05, 2], [9, 5, 1.3, 3], [-5, 8, 1.0, 4]]) {
    const t = makeTent(s, seed);
    scene.add(groundAt(t, cx + dx, cz + dz, 0, 0.1));
    t.rotation.y = Math.atan2(-dx, -dz); // boca voltada pra fogueira
    collide(cx + dx, cz + dz, 2.2 * s);
  }
  const fire = makeCampfire();
  scene.add(groundAt(fire, cx, cz));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    if (Math.abs(a - 3.6) < 0.5) continue; // portão
    const x = cx + Math.cos(a) * 15.5, z = cz + Math.sin(a) * 15.5;
    scene.add(groundAt(makeStake(i), x, z));
  }
  return fire;
}

export function buildBanner(scene) {
  const { x: cx, z: cz } = POI.colinaGnoll;
  const b = makeBanner();
  scene.add(groundAt(b, cx + 2.5, cz - 9));
  return b;
}

export function buildCave(scene) {
  const { x: cx, z: cz } = POI.gruta;
  const rnd = mulberry32(48);
  for (let i = 0; i < 8; i++) {
    const a = -0.4 + (i / 7) * (Math.PI + 0.8);
    const x = cx + Math.cos(a) * 6.2, z = cz + Math.sin(a) * 6.2 - 2;
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(2 + rnd() * 1.6, 0), M(0x6f6a63));
    r.position.set(x, heightAt(x, z) + 1 + rnd(), z);
    r.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    r.scale.y = 1.5 + rnd();
    scene.add(r);
    collide(x, z, 2.2);
  }
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(7.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x14100e, side: THREE.BackSide }),
  );
  shell.position.set(cx, heightAt(cx, cz) - 0.2, cz - 3);
  scene.add(shell);
}

// ---------- portal ----------
export function buildPortal(scene) {
  const { x: cx, z: cz } = POI.portal;
  const base = heightAt(cx, cz);
  const g = new THREE.Group();
  // pedras do círculo: cada uma ancorada no terreno DELA (pad semi-achatado)
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.9;
    const wx = cx + Math.cos(a) * 6.5, wz = cz + Math.sin(a) * 6.5;
    const st = makePortalStone(i);
    st.position.set(wx - cx, heightAt(wx, wz) - base, wz - cz);
    st.rotation.y = -a;
    g.add(st);
  }
  const arch = makePortalArch();
  arch.group.rotation.y = 0.9;
  g.add(arch.group);
  g.position.set(cx, base, cz);
  scene.add(g);
  collide(cx + Math.cos(0.9) * 2.1, cz - Math.sin(0.9) * 2.1, 0.6);
  collide(cx - Math.cos(0.9) * 2.1, cz + Math.sin(0.9) * 2.1, 0.6);
  return { group: g, veil: arch.veil };
}
