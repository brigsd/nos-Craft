// suíte de lógica pura — node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/rng.js';
import { playerStats, rollAuto, rollAbility, xpForKill, grantXp, xpIntoLevel, abilitiesAt, canUse } from '../src/combat.js';
import { QUESTS, ABILITIES, MOB_TYPES, XP_CURVE, MAX_LEVEL, LOOT, ITEMS, NPCS } from '../src/data.js';
import { offeredBy, accept, onKill, isComplete, turnIn, addItem, questDropWanted, turnableTo, trackerLines } from '../src/quests.js';

test('dados: integridade das tabelas', () => {
  for (const q of QUESTS) {
    assert.ok(NPCS[q.giver], `${q.id}: giver ${q.giver} existe`);
    assert.ok(NPCS[q.turnIn], `${q.id}: turnIn ${q.turnIn} existe`);
    for (const ob of q.objectives) {
      if (ob.type === 'kill') for (const t of ob.targets) assert.ok(MOB_TYPES[t], `${q.id}: mob ${t} existe`);
      if (ob.type === 'collect' || ob.type === 'deliver') assert.ok(ITEMS[ob.item], `${q.id}: item ${ob.item} existe`);
    }
  }
  for (const [mob, drops] of Object.entries(LOOT)) {
    assert.ok(MOB_TYPES[mob], `loot: mob ${mob} existe`);
    for (const d of drops) if (d.item) assert.ok(ITEMS[d.item], `loot ${mob}: item ${d.item} existe`);
  }
  assert.equal(XP_CURVE.length, MAX_LEVEL + 1);
});

test('combate: stats crescem, dano é positivo e determinístico por seed', () => {
  const l1 = playerStats(1), l6 = playerStats(6);
  assert.ok(l6.hpMax > l1.hpMax && l6.attack > l1.attack);
  const a = rollAuto(10, mulberry32(7));
  const b = rollAuto(10, mulberry32(7));
  assert.deepEqual(a, b);
  assert.ok(a.dmg >= 1);
  assert.ok(rollAbility(ABILITIES.golpe, 10, mulberry32(3)).dmg > 0);
});

test('xp: cores/multiplicadores clássicos — cinza não dá xp, subir de nível funciona', () => {
  assert.equal(xpForKill(5, 'lobo'), 0);            // 4 níveis abaixo = cinza
  assert.ok(xpForKill(1, 'chefe') > MOB_TYPES.chefe.xp); // acima do nível = bônus
  let s = { level: 1, xp: 0 };
  const r = grantXp(s.level, s.xp, 150);
  assert.equal(r.level, 2);
  assert.deepEqual(r.leveled, [2]);
  const into = xpIntoLevel(r.level, r.xp);
  assert.equal(into.cur, 50); // 150 - 100
  const r2 = grantXp(1, 0, 99999);
  assert.equal(r2.level, MAX_LEVEL);
});

test('habilidades: destravam por nível; canUse cobre fúria/cd/alcance/execução', () => {
  assert.equal(abilitiesAt(1).length, 1);
  assert.equal(abilitiesAt(5).length, 5);
  const st = { rage: 20, cooldowns: {}, targetDist: 2, targetHpPct: 1, hasTarget: true };
  assert.ok(canUse(ABILITIES.golpe, st).ok);
  assert.equal(canUse(ABILITIES.golpe, { ...st, rage: 5 }).reason, 'rage');
  assert.equal(canUse(ABILITIES.golpe, { ...st, cooldowns: { golpe: 2 } }).reason, 'cd');
  assert.equal(canUse(ABILITIES.golpe, { ...st, targetDist: 9 }).reason, 'far');
  assert.equal(canUse(ABILITIES.investida, { ...st, targetDist: 3 }).reason, 'close');
  assert.equal(canUse(ABILITIES.execucao, { ...st, targetHpPct: 0.5 }).reason, 'exec');
  assert.ok(canUse(ABILITIES.execucao, { ...st, rage: 15, targetHpPct: 0.15 }).ok);
});

test('quests: cadeia inteira do Vale é jogável de ponta a ponta', () => {
  const state = { active: {}, completed: [], items: {} };
  let level = 1;

  // nível 1: Serra oferece lobos; Lenho oferece presas; a cadeia 2+ ainda não
  assert.deepEqual(offeredBy('serra', state, level).map((q) => q.id), ['lobos']);
  assert.deepEqual(offeredBy('broa', state, level).map((q) => q.id), []); // nível 2

  const lobos = offeredBy('serra', state, level)[0];
  accept(lobos, state);
  for (let i = 0; i < 6; i++) onKill(i % 2 ? 'lobo' : 'loboUiv', state);
  assert.ok(isComplete(lobos, state));
  assert.ok(turnableTo('serra', state).length === 1);
  const rw = turnIn(lobos, state);
  assert.equal(rw.xp, 90);

  // presas: só conta drop se a quest precisa
  const presas = offeredBy('lenho', state, level)[0];
  assert.equal(questDropWanted('presa', state), false);
  accept(presas, state);
  assert.equal(questDropWanted('presa', state), true);
  for (let i = 0; i < 4; i++) addItem('presa', state);
  assert.equal(questDropWanted('presa', state), false); // já tem o bastante
  assert.ok(isComplete(presas, state));
  turnIn(presas, state);
  assert.equal(state.items.presa, undefined); // consumiu

  level = 2;
  // entrega: item nasce na mochila e é entregue ao guarda
  const entrega = offeredBy('broa', state, level)[0];
  assert.equal(entrega.id, 'entrega');
  accept(entrega, state);
  assert.equal(state.items.trouxaBroa, 1);
  assert.ok(isComplete(entrega, state));
  assert.deepEqual(turnableTo('ponte', state).map((q) => q.id), ['entrega']);
  turnIn(entrega, state);

  const batedores = offeredBy('ponte', state, level)[0];
  accept(batedores, state);
  for (let i = 0; i < 5; i++) onKill('batedor', state);
  turnIn(batedores, state);

  level = 3;
  const acampamento = offeredBy('serra', state, level)[0];
  assert.equal(acampamento.id, 'acampamento');
  accept(acampamento, state);
  for (let i = 0; i < 3; i++) onKill('bruto', state);
  assert.ok(!isComplete(acampamento, state)); // falta o estandarte
  addItem('estandarte', state);
  assert.ok(isComplete(acampamento, state));
  const tl = trackerLines(state);
  assert.equal(tl[0].lines.every((l) => l.done), true);
  turnIn(acampamento, state);

  level = 4;
  const chefe = offeredBy('serra', state, level)[0];
  assert.equal(chefe.id, 'chefe');
  accept(chefe, state);
  onKill('chefe', state);
  const fim = turnIn(chefe, state);
  assert.equal(fim.title, 'Protetor do Vale');
  assert.equal(state.completed.length, QUESTS.length);
});
