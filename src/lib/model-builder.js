// A FORJA · model-builder — interpretador declarativo de JSON para modelos 3D orgânicos.
// Converte uma árvore de dados JSON em objetos Three.js (Group / Mesh) e registra
// o mapa de partes por nome para o sistema de animações.
import * as THREE from 'three';
import { loft, countershade, clampBelow } from './loft.js';
import { inflate } from './silhouette.js';

const _matCache = new Map();
export const M = (color, opts = {}) => {
  const c = typeof color === 'string' && color.startsWith('0x') ? parseInt(color, 16) : color;
  const key = String(c) + JSON.stringify(opts);
  if (!_matCache.has(key)) _matCache.set(key, new THREE.MeshLambertMaterial({ color: c, ...opts }));
  return _matCache.get(key);
};

export const VC = (opts = {}) => {
  const key = 'vc' + JSON.stringify(opts);
  if (!_matCache.has(key)) _matCache.set(key, new THREE.MeshLambertMaterial({ vertexColors: true, ...opts }));
  return _matCache.get(key);
};

const _modelCache = new Map();

/** Valida os campos do JSON antes de construir */
export function validateModelData(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return ['JSON deve ser um objeto'];
  if (!data.id) errors.push('Falta campo "id"');
  if (!data.root) errors.push('Falta campo "root"');

  function checkNode(node, path = 'root') {
    if (!node || typeof node !== 'object') {
      errors.push(`Nó em "${path}" é inválido`);
      return;
    }
    if (!node.type) errors.push(`Nó em "${path}" não tem "type"`);
    if (node.type === 'loft') {
      if (!Array.isArray(node.sections) || node.sections.length < 2) {
        errors.push(`Loft em "${path}" precisa ter "sections" com no mínimo 2 itens`);
      }
    } else if (node.type === 'inflate') {
      if (!Array.isArray(node.side) || !Array.isArray(node.top)) {
        errors.push(`Inflate em "${path}" precisa de arrays "side" e "top"`);
      }
    }
    if (node.children) {
      if (!Array.isArray(node.children)) errors.push(`"children" em "${path}" deve ser um array`);
      else node.children.forEach((c, idx) => checkNode(c, `${path}.children[${idx}]`));
    }
  }

  if (data.root) checkNode(data.root);
  return errors;
}

/** Prepara nó recursivamente */
function buildNode(node, parts = {}, overrides = {}) {
  const g = new THREE.Group();
  if (node.name) {
    g.name = node.name;
    parts[node.name] = g;
  }

  if (node.position) g.position.set(...node.position);
  if (node.rotation) g.rotation.set(...node.rotation);
  if (node.scale) {
    if (Array.isArray(node.scale)) g.scale.set(...node.scale);
    else g.scale.setScalar(node.scale);
  }

  let mesh = null;
  const col = overrides[node.colorOverrideKey] ?? node.color ?? 0x888888;
  const colVal = typeof col === 'string' && col.startsWith('0x') ? parseInt(col, 16) : col;

  if (node.type === 'loft') {
    const geo = loft(node.sections, {
      seg: node.seg ?? 8,
      caps: node.caps ?? true,
      capStart: node.capStart,
      capEnd: node.capEnd,
      capSmooth: node.capSmooth,
      color: node.countershade ? null : colVal,
    });
    if (node.clampBelow !== undefined) clampBelow(geo, node.clampBelow);
    if (node.countershade) {
      const dCol = overrides.dorsalColor ?? (typeof node.countershade.dorsal === 'string' ? parseInt(node.countershade.dorsal, 16) : node.countershade.dorsal);
      const vMul = node.countershade.ventralMul ?? 0.6;
      const vCol = new THREE.Color(dCol).multiplyScalar(vMul).getHex();
      countershade(geo, dCol, vCol);
      mesh = new THREE.Mesh(geo, VC());
    } else {
      mesh = new THREE.Mesh(geo, VC());
    }
  } else if (node.type === 'inflate') {
    const geo = inflate(node.side, node.top, {
      front: node.front ?? null,
      stations: node.stations ?? 14,
      seg: node.seg ?? 10,
      squareTop: node.squareTop ?? 2.2,
      squareBottom: node.squareBottom ?? 4.5,
      color: colVal,
    });
    if (node.clampBelow !== undefined) clampBelow(geo, node.clampBelow);
    mesh = new THREE.Mesh(geo, VC());
  } else if (node.type === 'sphere') {
    const wSeg = node.seg ? node.seg[0] : 8;
    const hSeg = node.seg ? node.seg[1] : 6;
    const geo = new THREE.SphereGeometry(
      node.radius ?? 0.5,
      wSeg,
      hSeg,
      node.phiStart ?? 0,
      node.phiLength ?? Math.PI * 2,
      node.thetaStart ?? 0,
      node.thetaLength ?? Math.PI
    );
    mesh = new THREE.Mesh(geo, M(colVal));
  } else if (node.type === 'box') {
    const size = node.size ?? [1, 1, 1];
    const geo = new THREE.BoxGeometry(...size);
    mesh = new THREE.Mesh(geo, M(colVal));
  } else if (node.type === 'cylinder') {
    const geo = new THREE.CylinderGeometry(node.radiusTop ?? 0.5, node.radiusBottom ?? 0.5, node.height ?? 1, node.seg ?? 8);
    mesh = new THREE.Mesh(geo, M(colVal));
  } else if (node.type === 'cone') {
    const geo = new THREE.ConeGeometry(node.radius ?? 0.5, node.height ?? 1, node.seg ?? 8);
    mesh = new THREE.Mesh(geo, M(colVal));
  }

  if (mesh) {
    if (node.meshName) mesh.name = node.meshName;
    else if (node.name) mesh.name = node.name + '_mesh';
    if (mesh.name) parts[mesh.name] = mesh;
    g.add(mesh);
  }

  if (node.children && Array.isArray(node.children)) {
    for (const childNode of node.children) {
      const child = buildNode(childNode, parts, overrides);
      g.add(child);
    }
  }

  // Suporte a adereços condicionais de bípede via overrides
  if (node.name === 'head') {
    if (overrides.gnoll) {
      const snoutGeo = new THREE.BoxGeometry(0.2, 0.16, 0.26);
      const snoutMesh = new THREE.Mesh(snoutGeo, overrides.skin ? M(overrides.skin) : M(0xd8b090));
      snoutMesh.position.set(0, -0.06, 0.3);
      g.add(snoutMesh);
      for (const s of [-1, 1]) {
        const earGeo = new THREE.ConeGeometry(0.09, 0.26, 4);
        const earMesh = new THREE.Mesh(earGeo, overrides.skin ? M(overrides.skin) : M(0xd8b090));
        earMesh.position.set(s * 0.17, 0.3, 0); earMesh.rotation.z = -s * 0.3;
        g.add(earMesh);
      }
    } else if (overrides.hair !== undefined && overrides.hair !== null) {
      const hMesh = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.16, 0.44), M(overrides.hair));
      hMesh.position.y = 0.24;
      g.add(hMesh);
    }
  }

  if (node.name === 'foreR' && overrides.weapon) {
    const w = new THREE.Group();
    if (overrides.weapon === 'axe') {
      const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 5), M(0x5a4330));
      haft.position.y = -0.2; w.add(haft);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.06), M(0xb9c2cc));
      blade.position.set(0.16, 0.14, 0); w.add(blade);
    } else {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.85, 0.03), M(0xc9d2dc));
      blade.position.y = 0.28; w.add(blade);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.06), M(0x8a6a2a));
      guard.position.y = -0.13; w.add(guard);
    }
    w.position.set(0, -0.42, 0.06);
    parts.weapon = w;
    g.add(w);
  }

  return g;
}

/** Constrói um objeto 3D a partir do modelo JSON */
export function buildModelFromData(data, overrides = {}) {
  const errs = validateModelData(data);
  if (errs.length > 0) {
    throw new Error(`Modelo JSON "${data?.id}" inválido:\n` + errs.join('\n'));
  }
  const parts = {};
  const rootGroup = buildNode(data.root, parts, overrides);
  const userScale = overrides.scale ?? data.scale ?? 1;
  const isBiped = data.kind === 'biped' || data.isBiped;
  const scale = userScale * (isBiped ? 0.68 : 1);
  rootGroup.scale.setScalar(scale);

  return { group: rootGroup, parts, kind: data.kind ?? 'model' };
}

/** Carrega e constrói o modelo por ID */
export async function loadModel(id, overrides = {}) {
  if (!_modelCache.has(id)) {
    const res = await fetch(`/src/models/${id}.json`);
    if (!res.ok) throw new Error(`Não foi possível carregar o modelo /src/models/${id}.json`);
    const data = await res.json();
    _modelCache.set(id, data);
  }
  return buildModelFromData(_modelCache.get(id), overrides);
}

/** Registro síncrono para modelos pré-carregados */
export function registerModelData(id, data) {
  _modelCache.set(id, data);
}
