// Céu do Vale: cúpula com gradiente pintado + sol + nuvens billboard.
import * as THREE from 'three';
import { mulberry32 } from './rng.js';

export function buildSky(scene) {
  // cúpula: gradiente quente de "tarde de aventura"
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#3d6fb8');
  grad.addColorStop(0.45, '#7fb3e0');
  grad.addColorStop(0.78, '#cfe3d8');
  grad.addColorStop(1, '#e8d9b0');
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false }),
  );
  scene.add(dome);

  // luz: sol quente + céu de preenchimento (o look lambert saturado)
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.6);
  sun.position.set(-220, 300, 140);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbdd9ff, 0x5a6a44, 1.15);
  scene.add(hemi);

  // nuvens: sprites achatados à deriva
  const puffTex = (() => {
    const s = 128, cc = document.createElement('canvas');
    cc.width = cc.height = s;
    const gg = cc.getContext('2d');
    const rnd = mulberry32(77);
    for (let i = 0; i < 26; i++) {
      const r = 14 + rnd() * 26, x = 20 + rnd() * (s - 40), y = 44 + rnd() * 40;
      const rg = gg.createRadialGradient(x, y, 2, x, y, r);
      rg.addColorStop(0, 'rgba(255,255,255,0.9)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      gg.fillStyle = rg;
      gg.fillRect(0, 0, s, s);
    }
    const t = new THREE.CanvasTexture(cc);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const clouds = new THREE.Group();
  const rnd = mulberry32(31);
  for (let i = 0; i < 18; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, opacity: 0.85, fog: false }));
    const a = rnd() * Math.PI * 2, r = 260 + rnd() * 420;
    sp.position.set(Math.cos(a) * r, 150 + rnd() * 90, Math.sin(a) * r);
    sp.scale.set(180 + rnd() * 160, 60 + rnd() * 40, 1);
    sp.userData.w = 1.2 + rnd() * 1.6;
    clouds.add(sp);
  }
  scene.add(clouds);

  scene.fog = new THREE.Fog(0xcfe0d2, 90, 420);
  return { dome, clouds };
}

export function tickSky(sky, dt) {
  for (const sp of sky.clouds.children) {
    sp.position.x += sp.userData.w * dt;
    if (sp.position.x > 760) sp.position.x = -760;
  }
}
