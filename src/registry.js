// Registro de objetos da Forja: id -> fábrica + categoria + orçamento.
// O estúdio lista daqui; o crítico audita daqui; o mapa só usa aprovados.
import { makeHouse, makeWell, makeShrine, makeTent, makeCampfire, makeBanner, makeStake, makeBridge, makePortalStone, makePortalArch } from './makers.js';
import { makeBiped, makeQuad } from './creature.js';
import { buildModelFromData } from './lib/model-builder.js';

import loboData from './models/lobo.json' with { type: 'json' };
import javaliData from './models/javali.json' with { type: 'json' };
import jogadorData from './models/jogador.json' with { type: 'json' };
import rochaData from './models/rocha.json' with { type: 'json' };
import carvalhoData from './models/arvore-carvalho.json' with { type: 'json' };
import pinheiroData from './models/arvore-pinheiro.json' with { type: 'json' };
import cogumeloData from './models/approved/cogumelo.json' with { type: 'json' };
import cogumeloMarromData from './models/approved/cogumelo-marrom.json' with { type: 'json' };
import { MOB_TYPES, NPCS } from './data.js';

// orçamentos de triângulos por categoria (o crítico cobra)
export const BUDGET = { veg: 900, prop: 2600, build: 5200, creature: 3200, hero: 5200 };

export const REGISTRY = [
  { id: 'arvore-carvalho', cat: 'veg', h: [3, 7], make: () => buildModelFromData(carvalhoData).group },
  { id: 'arvore-pinheiro', cat: 'veg', h: [3, 8], make: () => buildModelFromData(pinheiroData).group },
  { id: 'cogumelo', cat: 'veg', h: [0.5, 1.8], make: () => buildModelFromData(cogumeloData).group },
  { id: 'cogumelo-marrom', cat: 'veg', h: [0.5, 1.8], make: () => buildModelFromData(cogumeloMarromData).group },
  { id: 'rocha', cat: 'veg', h: [0.3, 2.4], make: () => buildModelFromData(rochaData).group },
  { id: 'casa', cat: 'build', h: [3.5, 7], make: () => makeHouse({ w: 5, d: 6 }) },
  { id: 'taverna', cat: 'build', h: [4, 8], make: () => makeHouse({ w: 7.5, d: 8, hW: 3.2, roofColor: 0x6d3b2a }) },
  { id: 'poco', cat: 'prop', h: [1.5, 3.4], make: makeWell },
  { id: 'santuario', cat: 'prop', h: [1.8, 3.4], make: makeShrine },
  { id: 'tenda', cat: 'prop', h: [2, 4.2], make: () => makeTent(1.15, 3) },
  { id: 'fogueira', cat: 'prop', h: [0.5, 1.6], make: makeCampfire },
  { id: 'estandarte', cat: 'prop', h: [3.4, 5], make: makeBanner },
  { id: 'estaca', cat: 'prop', h: [1.6, 2.8], make: () => makeStake(2) },
  { id: 'ponte', cat: 'build', h: [1.5, 3.2], make: makeBridge },
  { id: 'pedra-portal', cat: 'prop', h: [2, 4.2], make: () => makePortalStone(2) },
  { id: 'arco-portal', cat: 'build', h: [4.5, 6.5], make: () => makePortalArch().group },
  // criaturas (alturas em pé)
  { id: 'jogador', cat: 'hero', h: [1.6, 2.1], make: () => buildModelFromData(jogadorData, { tint: 0x5a2c22, hair: 0x3a2a1a, weapon: 'sword' }).group },
  { id: 'npc-serra', cat: 'creature', h: [1.6, 2.1], make: () => buildModelFromData(jogadorData, { tint: NPCS.serra.tint, hair: NPCS.serra.hair, weapon: 'sword' }).group },
  { id: 'npc-lenho', cat: 'creature', h: [1.6, 2.1], make: () => buildModelFromData(jogadorData, { tint: NPCS.lenho.tint, hair: NPCS.lenho.hair }).group },
  { id: 'lobo', cat: 'creature', h: [0.8, 1.6], make: () => buildModelFromData(loboData, { dorsalColor: MOB_TYPES.lobo.tint, scale: MOB_TYPES.lobo.scale }).group },
  { id: 'javali', cat: 'creature', h: [0.6, 1.3], make: () => buildModelFromData(javaliData, { dorsalColor: MOB_TYPES.javali.tint, scale: MOB_TYPES.javali.scale }).group },
  { id: 'gnoll-batedor', cat: 'creature', h: [1.4, 2.1], make: () => buildModelFromData(jogadorData, { tint: MOB_TYPES.batedor.tint, skin: 0xb99a6a, gnoll: true, scale: MOB_TYPES.batedor.scale, weapon: 'sword' }).group },
  { id: 'gnoll-bruto', cat: 'creature', h: [1.6, 2.4], make: () => buildModelFromData(jogadorData, { tint: MOB_TYPES.bruto.tint, skin: 0xb99a6a, gnoll: true, scale: MOB_TYPES.bruto.scale, weapon: 'axe' }).group },
  { id: 'presa-torta', cat: 'hero', h: [2, 3.2], make: () => buildModelFromData(jogadorData, { tint: MOB_TYPES.chefe.tint, skin: 0xb99a6a, gnoll: true, scale: MOB_TYPES.chefe.scale, weapon: 'axe' }).group },
];
export const byId = (id) => REGISTRY.find((r) => r.id === id);
