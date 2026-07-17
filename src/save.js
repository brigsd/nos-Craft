// Save em localStorage — o "Registro" local do Ramo.
const KEY = 'noscraft-save-v1';

export function saveGame(player, questState) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      v: 1,
      level: player.level, xp: player.xp, coins: player.coins,
      equipAttack: player.equipAttack, title: player.title, attuned: player.attuned,
      pos: { x: player.x, z: player.z },
      quests: questState,
      savedAt: Date.now(),
    }));
  } catch { /* modo anônimo etc. — jogo segue sem save */ }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s.v !== 1) return null;
    return s;
  } catch { return null; }
}

export function wipeSave() {
  try { localStorage.removeItem(KEY); } catch { /* ok */ }
}
