// NÓS-Craft — tabelas de dados e textos (pt-BR).
// Tudo que é balanceamento/conteúdo mora aqui; lógica fica em combat.js/quests.js.

export const XP_CURVE = [0, 100, 220, 380, 600, 900, Infinity]; // xp TOTAL p/ alcançar nível i+1
export const MAX_LEVEL = 6;

export const PLAYER_BASE = {
  hp: 60, hpPerLevel: 14,
  attack: 7, attackPerLevel: 2,
  attackSpeed: 2.0,          // s por golpe automático
  moveSpeed: 6.2,            // m/s (corrida clássica)
  rageMax: 100,
  ragePerHit: 12,            // fúria gerada ao ACERTAR golpe automático
  ragePerTaken: 6,           // fúria ao APANHAR
  rageDecay: 1.5,            // fúria/s fora de combate
};

export const ABILITIES = {
  golpe:      { id: 'golpe',      name: 'Golpe Heroico',   level: 1, rage: 15, cd: 3,  range: 3.2, dmgMul: 1.6, dmgFlat: 6,  icon: '⚔️', desc: 'Um golpe devastador com a arma. (Fúria 15)' },
  investida:  { id: 'investida',  name: 'Investida',       level: 2, rage: 0,  cd: 12, range: 22,  minRange: 7, rageGain: 15, icon: '💨', desc: 'Avança contra o inimigo, gerando 15 de Fúria. (8-22m)' },
  grito:      { id: 'grito',      name: 'Grito de Batalha', level: 3, rage: 10, cd: 25, range: 0,  buffAtk: 5, buffDur: 45, icon: '📢', desc: '+5 de Ataque por 45s. (Fúria 10)' },
  redemoinho: { id: 'redemoinho', name: 'Redemoinho',      level: 4, rage: 25, cd: 8,  range: 0,  aoe: 4.5, dmgMul: 1.1, dmgFlat: 4, icon: '🌀', desc: 'Gira a arma, ferindo TODOS os inimigos a 4.5m. (Fúria 25)' },
  execucao:   { id: 'execucao',   name: 'Execução',        level: 5, rage: 15, cd: 6,  range: 3.2, dmgMul: 2.6, dmgFlat: 14, execThreshold: 0.2, icon: '💀', desc: 'Só com o alvo abaixo de 20% de vida: um golpe final brutal. (Fúria 15)' },
};

// tipos de mob: stats base por nível efetivo
export const MOB_TYPES = {
  lobo:     { name: 'Lobo do Vale',     level: 1, hp: 34,  attack: 4,  attackSpeed: 1.8, moveSpeed: 5.4, aggroR: 7,  xp: 30,  kind: 'quad', tint: 0x9a958a, scale: 1.2 },
  loboUiv:  { name: 'Lobo Uivador',     level: 2, hp: 46,  attack: 6,  attackSpeed: 1.8, moveSpeed: 5.6, aggroR: 8,  xp: 42,  kind: 'quad', tint: 0x77726a, scale: 1.32 },
  javali:   { name: 'Javali Fuçador',   level: 2, hp: 52,  attack: 5,  attackSpeed: 2.1, moveSpeed: 5.2, aggroR: 0,  xp: 40,  kind: 'quad', tint: 0x7a5b43, scale: 1.05, snout: true },
  batedor:  { name: 'Gnoll Batedor',    level: 3, hp: 62,  attack: 8,  attackSpeed: 1.9, moveSpeed: 5.8, aggroR: 10, xp: 58,  kind: 'biped', tint: 0xa08a56, scale: 0.95 },
  bruto:    { name: 'Gnoll Bruto',      level: 4, hp: 88,  attack: 11, attackSpeed: 2.2, moveSpeed: 5.4, aggroR: 10, xp: 78,  kind: 'biped', tint: 0x8a6d46, scale: 1.12 },
  chefe:    { name: 'Presa-Torta',      level: 5, hp: 260, attack: 15, attackSpeed: 2.0, moveSpeed: 5.6, aggroR: 12, xp: 320, kind: 'biped', tint: 0x9c4f3d, scale: 1.45, elite: true },
};

export const LOOT = {
  lobo:    [{ item: 'pelego', chance: 0.4 }, { coins: [1, 3] }],
  loboUiv: [{ item: 'pelego', chance: 0.5 }, { coins: [1, 4] }],
  javali:  [{ item: 'presa', chance: 0.65 }, { coins: [1, 3] }],
  batedor: [{ item: 'insignia', chance: 0.35 }, { coins: [2, 5] }, { item: 'espadaBatedor', chance: 0.12 }],
  bruto:   [{ coins: [3, 7] }],
  chefe:   [{ item: 'machadoChefe', chance: 1 }, { coins: [25, 40] }],
};

export const ITEMS = {
  pelego:        { name: 'Pelego de Lobo', desc: 'Cheira a mato molhado.' },
  presa:         { name: 'Presa de Javali', desc: 'Curvada e afiada.' },
  insignia:      { name: 'Insígnia Rasgada', desc: 'Um símbolo gnoll: três riscos e um osso.' },
  trouxaBroa:    { name: 'Trouxa de Broas', desc: 'Ainda quente. NÃO comer no caminho.', quest: true },
  estandarte:    { name: 'Estandarte da Matilha', desc: 'O pano fede, mas é a prova.', quest: true },
  espadaBatedor: { name: 'Espada do Batedor', desc: '+3 de Ataque.', equip: { attack: 3 } },
  machadoChefe:  { name: 'Quebra-Presas', desc: 'O machado do chefe. +6 de Ataque.', equip: { attack: 6 } },
};

// Quests — cadeia do Vale Verdente. giver/turnIn = ids de NPC.
export const QUESTS = [
  {
    id: 'lobos', giver: 'serra', turnIn: 'serra', level: 1,
    name: 'Dentes no Pasto',
    text: 'Os lobos desceram da mata e já levaram duas ovelhas. Eu cuidaria disso, mas alguém tem que segurar a vila. Cace 6 lobos no pasto oeste.',
    done: 'Seis a menos. As ovelhas não vão agradecer, mas eu agradeço.',
    objectives: [{ type: 'kill', targets: ['lobo', 'loboUiv'], count: 6, label: 'Lobos caçados' }],
    xp: 90, coins: 8,
  },
  {
    id: 'presas', giver: 'lenho', turnIn: 'lenho', level: 1,
    name: 'Remédio Amargo',
    text: 'Meu joelho range mais que porta velha. Pó de presa de javali resolve — receita da minha avó. Traga 4 presas dos javalis da beira do rio.',
    done: 'Ahh… já sinto o joelho mais novo. Ou é impressão. Toma aí pelo trabalho.',
    objectives: [{ type: 'collect', item: 'presa', count: 4, label: 'Presas de Javali' }],
    xp: 100, coins: 10,
  },
  {
    id: 'entrega', giver: 'broa', turnIn: 'ponte', level: 2,
    name: 'Entrega Quente',
    text: 'O guarda da ponte leste não come desde ontem e broa fria é ofensa. Leva essa trouxa pra ele — e sem beliscar, eu conto as broas.',
    done: 'BROAS! Tu é gente boa. Fica de olho nesses gnolls aí, ó.',
    objectives: [{ type: 'deliver', item: 'trouxaBroa', to: 'ponte', label: 'Entregar as broas' }],
    xp: 80, coins: 6,
  },
  {
    id: 'batedores', giver: 'ponte', turnIn: 'ponte', level: 2,
    name: 'Olhos na Colina',
    text: 'Gnolls batedores rondam a colina nordeste. Onde tem batedor, tem matilha atrás. Derrube 5 antes que virem um problema de verdade.',
    done: 'Cinco batedores a menos. Mas eles não batem em retirada… vão vir mais.',
    objectives: [{ type: 'kill', targets: ['batedor'], count: 5, label: 'Batedores derrubados' }],
    xp: 130, coins: 12,
  },
  {
    id: 'acampamento', giver: 'serra', turnIn: 'serra', level: 3,
    name: 'O Acampamento',
    text: 'O guarda mandou aviso: acampamento gnoll na colina. Quebre os 3 brutos que guardam o lugar e traga o estandarte deles. Sem estandarte, matilha debanda.',
    done: 'O estandarte… então é a matilha do Presa-Torta. Isso explica muito — e piora tudo.',
    objectives: [
      { type: 'kill', targets: ['bruto'], count: 3, label: 'Gnolls Brutos' },
      { type: 'collect', item: 'estandarte', count: 1, label: 'Estandarte da Matilha' },
    ],
    xp: 180, coins: 18,
  },
  {
    id: 'chefe', giver: 'serra', turnIn: 'serra', level: 4,
    name: 'Presa-Torta',
    text: 'O chefe deles se enfiou na gruta ao norte do acampamento. Enquanto ele respirar, o Vale não dorme. Acabe com o Presa-Torta.',
    done: 'Acabou. O Vale te deve — e o Coração vai saber do teu nome. O portal na colina está sintonizado: podes voltar quando quiseres, Protetor do Vale.',
    objectives: [{ type: 'kill', targets: ['chefe'], count: 1, label: 'Presa-Torta' }],
    xp: 320, coins: 50, title: 'Protetor do Vale',
  },
];

export const NPCS = {
  serra: { name: 'Capitã Serra', title: 'Milícia do Vale', tint: 0x8e4444, hair: 0x2e2626 },
  lenho: { name: 'Velho Lenho', title: 'Lenhador Aposentado', tint: 0x5b6e46, hair: 0xd8d3c4 },
  broa:  { name: 'Taverneiro Broa', title: 'Estalagem do Vau', tint: 0x7a5b3a, hair: 0x574434 },
  ponte: { name: 'Guarda Chuço', title: 'Posto da Ponte Leste', tint: 0x4f5d78, hair: 0x3a3026 },
};

export const STRINGS = {
  title: 'NÓS-Craft',
  subtitle: 'O Vale Verdente — o primeiro Ramo de guerra',
  welcome: 'Você atravessa o portal. O ar do Vale é mais frio que o d’O Coração — e cheira a lenha e chuva. A Capitã Serra acena da vila.',
  levelUp: (l) => `Nível ${l}! Sua força cresce.`,
  newAbility: (a) => `Nova habilidade: ${a}`,
  questAccepted: (q) => `Missão aceita: ${q}`,
  questDone: (q) => `Missão concluída: ${q}`,
  questProgress: (label, n, total) => `${label}: ${n}/${total}`,
  dead: 'Você caiu. O Vale segura teu fôlego…',
  respawned: 'Você desperta junto ao marco da vila.',
  noRage: 'Fúria insuficiente!',
  noTarget: 'Sem alvo.',
  tooFar: 'Muito longe.',
  tooClose: 'Perto demais.',
  execFail: 'O alvo ainda está forte demais.',
  portalLocked: 'O portal zumbe, apagado. (Complete a cadeia do Vale para sintonizá-lo.)',
  portalUse: 'Voltar a’O Coração',
};
