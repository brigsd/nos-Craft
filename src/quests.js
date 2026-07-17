// Máquina de estado das missões — PURA (sem DOM/three), testável em Node.
// Estado do jogador: { active: {questId: {progress:[n,...]}}, completed: [id], items: {itemId:n} }
import { QUESTS, ITEMS } from './data.js';

export const questById = (id) => QUESTS.find((q) => q.id === id);

/** quests que um NPC oferece agora (pré-requisito: anterior da cadeia concluída; nível mínimo) */
export function offeredBy(npcId, state, playerLevel) {
  return QUESTS.filter((q) => {
    if (q.giver !== npcId) return false;
    if (state.completed.includes(q.id) || state.active[q.id]) return false;
    if (playerLevel < q.level) return false;
    const idx = QUESTS.indexOf(q);
    // cadeia linear: toda quest anterior com o MESMO arco precisa estar completa.
    // (regra simples do Vale: quests destravam na ordem do array, exceto as de nível 1 que são livres)
    for (let i = 0; i < idx; i++) {
      if (QUESTS[i].level >= 2 && !state.completed.includes(QUESTS[i].id) && q.level >= 2) return false;
    }
    return true;
  });
}

/** quests prontas para entregar a este NPC */
export function turnableTo(npcId, state) {
  return QUESTS.filter((q) => q.turnIn === npcId && state.active[q.id] && isComplete(q, state));
}

export function accept(q, state) {
  state.active[q.id] = { progress: q.objectives.map(() => 0) };
  // quest de entrega: o item entra na mochila na aceitação
  for (const ob of q.objectives) if (ob.type === 'deliver') state.items[ob.item] = (state.items[ob.item] ?? 0) + 1;
}

export function isComplete(q, state) {
  const st = state.active[q.id];
  if (!st) return false;
  return q.objectives.every((ob, i) => {
    if (ob.type === 'kill') return st.progress[i] >= ob.count;
    if (ob.type === 'collect') return (state.items[ob.item] ?? 0) >= ob.count;
    if (ob.type === 'deliver') return (state.items[ob.item] ?? 0) >= 1; // consumido no turn-in
    return false;
  });
}

/** registra um kill; retorna lista de {quest, label, n, total} atualizados */
export function onKill(mobType, state) {
  const updates = [];
  for (const [qid, st] of Object.entries(state.active)) {
    const q = questById(qid);
    q.objectives.forEach((ob, i) => {
      if (ob.type === 'kill' && ob.targets.includes(mobType) && st.progress[i] < ob.count) {
        st.progress[i]++;
        updates.push({ quest: q, label: ob.label, n: st.progress[i], total: ob.count });
      }
    });
  }
  return updates;
}

/** o mob dropa item de quest? (só se alguma ativa precisa e ainda falta) */
export function questDropWanted(item, state) {
  for (const [qid] of Object.entries(state.active)) {
    const q = questById(qid);
    for (const ob of q.objectives) {
      if (ob.type === 'collect' && ob.item === item && (state.items[item] ?? 0) < ob.count) return true;
    }
  }
  return false;
}

export function addItem(item, state, n = 1) {
  state.items[item] = (state.items[item] ?? 0) + n;
}

/** entrega: consome itens de collect/deliver, marca completa, devolve recompensas */
export function turnIn(q, state) {
  for (const ob of q.objectives) {
    if (ob.type === 'collect' || ob.type === 'deliver') {
      state.items[ob.item] = Math.max(0, (state.items[ob.item] ?? 0) - (ob.count ?? 1));
      if (!ITEMS[ob.item]?.equip && state.items[ob.item] === 0) delete state.items[ob.item];
    }
  }
  delete state.active[q.id];
  state.completed.push(q.id);
  return { xp: q.xp, coins: q.coins, title: q.title };
}

/** resumo pro tracker: [{name, lines:[{label,n,total,done}]}] */
export function trackerLines(state) {
  return Object.entries(state.active).map(([qid, st]) => {
    const q = questById(qid);
    return {
      name: q.name,
      lines: q.objectives.map((ob, i) => {
        const n = ob.type === 'kill' ? st.progress[i] : Math.min(state.items[ob.item] ?? 0, ob.count ?? 1);
        const total = ob.count ?? 1;
        return { label: ob.label, n, total, done: n >= total };
      }),
    };
  });
}
