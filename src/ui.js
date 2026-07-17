// HUD e janelas — todo o "chrome" clássico (frames, hotbar, tracker,
// minimapa, log, texto flutuante, diálogos). DOM puro por cima do canvas.
import { ABILITIES, ITEMS, STRINGS } from './data.js';
import { trackerLines } from './quests.js';
import { xpIntoLevel, diffColor } from './combat.js';
import { WORLD_HALF, POI } from './terrain.js';

const $ = (id) => document.getElementById(id);
export const dom = {};
let floatersEl, msgEl;

export function initUI(onSlotClick) {
  for (const id of ['playerFrame', 'targetFrame', 'pfName', 'pfLevel', 'pfHp', 'pfHpT', 'pfRage', 'pfRageT',
    'tfName', 'tfLevel', 'tfHp', 'tfHpT', 'hotbar', 'xpFill', 'tracker', 'trackerBody', 'minimap',
    'dialog', 'dlgName', 'dlgTitle', 'dlgText', 'dlgQuests', 'dlgClose', 'questDetail', 'qdName', 'qdText',
    'qdRew', 'qdOk', 'qdCancel', 'announce', 'interactTip', 'portalPanel', 'portalText', 'portalStay',
    'deathVeil', 'deathText', 'intro', 'introGo', 'zoneName']) dom[id] = $(id);
  floatersEl = $('floaters');
  msgEl = $('msglog');
  // hotbar: 5 slots fixos
  const keys = ['1', '2', '3', '4', '5'];
  Object.values(ABILITIES).forEach((ab, i) => {
    const slot = document.createElement('div');
    slot.className = 'slot locked';
    slot.id = `slot-${ab.id}`;
    slot.innerHTML = `<span class="key">${keys[i]}</span>${ab.icon}<div class="cd"></div>`;
    slot.dataset.tip = `${ab.name} — ${ab.desc}`;
    slot.onclick = () => onSlotClick(ab.id);
    dom.hotbar.appendChild(slot);
  });
  dom.dlgClose.onclick = closeDialog;
}

// ---------- frames ----------
export function setPlayerFrame(p) {
  dom.pfName.textContent = p.title ? `Você, ${p.title}` : 'Você';
  dom.pfLevel.textContent = p.level;
  dom.pfHp.style.width = `${(p.hp / p.hpMax) * 100}%`;
  dom.pfHpT.textContent = `${Math.ceil(p.hp)} / ${p.hpMax}`;
  dom.pfRage.style.width = `${p.rage}%`;
  dom.pfRageT.textContent = `${Math.floor(p.rage)}`;
  const into = xpIntoLevel(p.level, p.xp);
  dom.xpFill.style.width = `${into.pct * 100}%`;
}
export function setTargetFrame(mob, playerLevel) {
  if (!mob || mob.dead) { dom.targetFrame.style.display = 'none'; return; }
  dom.targetFrame.style.display = 'block';
  dom.tfName.textContent = mob.def.name;
  dom.tfLevel.textContent = mob.def.level;
  dom.tfLevel.style.color = diffColor(playerLevel, mob.def.level);
  dom.tfHp.style.width = `${(mob.hp / mob.hpMax) * 100}%`;
  dom.tfHpT.textContent = `${Math.ceil(mob.hp)} / ${mob.hpMax}`;
}

// ---------- hotbar ----------
export function updateHotbar(player, target, cooldowns) {
  for (const ab of Object.values(ABILITIES)) {
    const slot = document.getElementById(`slot-${ab.id}`);
    const locked = player.level < ab.level;
    slot.classList.toggle('locked', locked);
    if (locked) { slot.dataset.tip = `${ab.name} (nível ${ab.level}) — ${ab.desc}`; continue; }
    const cd = cooldowns[ab.id] ?? 0;
    const cdEl = slot.querySelector('.cd');
    if (cd > 0.05) { cdEl.style.display = 'flex'; cdEl.textContent = cd >= 1 ? Math.ceil(cd) : cd.toFixed(1); }
    else cdEl.style.display = 'none';
    const dist = target && !target.dead ? Math.hypot(target.cre.group.position.x - player.x, target.cre.group.position.z - player.z) : null;
    slot.classList.toggle('oor', ab.range > 0 && (dist === null || dist > ab.range));
    slot.classList.toggle('norage', player.rage < ab.rage);
  }
}

// ---------- tracker ----------
export function renderTracker(questState) {
  const lines = trackerLines(questState);
  dom.tracker.style.display = lines.length ? 'block' : 'none';
  dom.trackerBody.innerHTML = lines.map((q) =>
    `<div class="q">${q.name}</div>` +
    q.lines.map((l) => `<div class="ob ${l.done ? 'done' : ''}">— ${l.label}: ${l.n}/${l.total}</div>`).join(''),
  ).join('');
}

// ---------- mensagens / flutuantes / anúncio ----------
export function msg(text, cls = 'sys') {
  const d = document.createElement('div');
  d.className = cls;
  d.textContent = text;
  msgEl.appendChild(d);
  while (msgEl.children.length > 9) msgEl.firstChild.remove();
  setTimeout(() => { d.style.transition = 'opacity 1s'; d.style.opacity = '0'; setTimeout(() => d.remove(), 1000); }, 6500);
}
export function floatText(text, sx, sy, cls = '') {
  const d = document.createElement('div');
  d.className = `float ${cls}`;
  d.textContent = text;
  d.style.left = `${sx + (Math.random() * 30 - 15)}px`;
  d.style.top = `${sy - 10}px`;
  floatersEl.appendChild(d);
  setTimeout(() => d.remove(), 1100);
}
let annT = null;
export function announce(text) {
  dom.announce.textContent = text;
  dom.announce.style.opacity = '1';
  clearTimeout(annT);
  annT = setTimeout(() => { dom.announce.style.opacity = '0'; }, 2600);
}
export function interactTip(text) {
  dom.interactTip.style.display = text ? 'block' : 'none';
  if (text) dom.interactTip.textContent = text;
}

// ---------- diálogo de NPC ----------
let dlgCallbacks = null;
export function openDialog(npc, offered, turnable, greeting, cb) {
  dlgCallbacks = cb;
  dom.dlgName.textContent = npc.def.name;
  dom.dlgTitle.textContent = npc.def.title;
  dom.dlgText.textContent = greeting;
  dom.dlgQuests.innerHTML = '';
  for (const q of turnable) {
    const b = document.createElement('button');
    b.className = 'qbtn';
    b.innerHTML = `<span class="tag">?</span> ${q.name} <i style="color:#9adf6a">(completa)</i>`;
    b.onclick = () => cb.turnIn(q);
    dom.dlgQuests.appendChild(b);
  }
  for (const q of offered) {
    const b = document.createElement('button');
    b.className = 'qbtn';
    b.innerHTML = `<span class="tag">!</span> ${q.name}`;
    b.onclick = () => showQuestDetail(q, cb);
    dom.dlgQuests.appendChild(b);
  }
  dom.dialog.style.display = 'block';
}
export function closeDialog() {
  dom.dialog.style.display = 'none';
  dom.questDetail.style.display = 'none';
}
function showQuestDetail(q, cb) {
  dom.qdName.textContent = q.name;
  dom.qdText.textContent = q.text;
  dom.qdRew.textContent = `Recompensa: ${q.xp} XP · ${q.coins} moedas${q.title ? ` · título «${q.title}»` : ''}`;
  dom.qdOk.onclick = () => { dom.questDetail.style.display = 'none'; cb.accept(q); };
  dom.qdCancel.onclick = () => { dom.questDetail.style.display = 'none'; };
  dom.questDetail.style.display = 'block';
}
export function showQuestDone(q, cb) {
  dom.qdName.textContent = q.name;
  dom.qdText.textContent = q.done;
  dom.qdRew.textContent = `Recompensa: ${q.xp} XP · ${q.coins} moedas${q.title ? ` · título «${q.title}»` : ''}`;
  dom.qdOk.textContent = 'Concluir';
  dom.qdOk.onclick = () => { dom.questDetail.style.display = 'none'; dom.qdOk.textContent = 'Aceitar'; cb(); };
  dom.qdCancel.onclick = () => { dom.questDetail.style.display = 'none'; dom.qdOk.textContent = 'Aceitar'; };
  dom.questDetail.style.display = 'block';
}

// ---------- minimapa ----------
let mapImg = null;
export function setMinimapSource(colormapCanvas) {
  mapImg = colormapCanvas;
}
export function drawMinimap(player, mobsArr, npcsArr) {
  const c = dom.minimap;
  const g = c.getContext('2d');
  const S = 150, R = 68;                       // raio visível do mapa
  const view = 90;                             // metros cobertos pelo raio
  g.clearRect(0, 0, S, S);
  g.save();
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 3, 0, 7); g.clip();
  if (mapImg) {
    const px = ((player.x + WORLD_HALF) / (WORLD_HALF * 2)) * mapImg.width;
    const pz = ((player.z + WORLD_HALF) / (WORLD_HALF * 2)) * mapImg.height;
    const half = (view / (WORLD_HALF * 2)) * mapImg.width;
    g.drawImage(mapImg, px - half, pz - half, half * 2, half * 2, 0, 0, S, S);
  }
  const dot = (x, z, color, r = 3) => {
    const dx = (x - player.x) / view * R + S / 2;
    const dz = (z - player.z) / view * R + S / 2;
    if (Math.hypot(dx - S / 2, dz - S / 2) > S / 2 - 6) return;
    g.fillStyle = color;
    g.beginPath(); g.arc(dx, dz, r, 0, 7); g.fill();
  };
  for (const m of mobsArr) if (!m.dead) dot(m.cre.group.position.x, m.cre.group.position.z, '#c23a2a', 2.4);
  for (const n of npcsArr) dot(n.cre.group.position.x, n.cre.group.position.z, n.marker.visible ? '#ffd100' : '#58c8f0', 3.2);
  dot(POI.portal.x, POI.portal.z, '#8ff8e2', 3.4);
  // seta do jogador (aponta pro rumo da câmera)
  g.translate(S / 2, S / 2);
  g.rotate(player.mapAngle ?? 0);
  g.fillStyle = '#fff';
  g.beginPath(); g.moveTo(0, -7); g.lineTo(4.6, 5); g.lineTo(-4.6, 5); g.closePath(); g.fill();
  g.restore();
}

// ---------- morte / portal ----------
export function showDeath(on) {
  dom.deathVeil.style.background = on ? 'rgba(8,4,4,.78)' : 'rgba(8,4,4,0)';
  dom.deathText.style.opacity = on ? '1' : '0';
  dom.deathText.textContent = on ? STRINGS.dead : '';
}
export function openPortalPanel(attuned) {
  dom.portalText.innerHTML = attuned
    ? 'O véu respira, sintonizado com O Coração. Do outro lado: a campina, o Núcleo, o Pulso.<br><i>(a travessia abre o mundo-origem do NÓS)</i>'
    : STRINGS.portalLocked;
  document.getElementById('portalGo').style.display = attuned ? 'inline-block' : 'none';
  dom.portalPanel.style.display = 'block';
  dom.portalStay.onclick = () => { dom.portalPanel.style.display = 'none'; };
}
export const itemName = (id) => ITEMS[id]?.name ?? id;
