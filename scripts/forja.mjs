#!/usr/bin/env node
// A FORJA · CLI — fotografa e audita objetos do estúdio, sem abrir navegador.
//   node scripts/forja.mjs shot [ids...]     folhas de contato (4 ângulos × 2 luzes)
//   node scripts/forja.mjs audit [ids...]    crítico algorítmico (exit 1 se error)
//   node scripts/forja.mjs all               tudo: audita e fotografa
//   node scripts/forja.mjs part <id> <nome1,nome2,...>   ISOLA peças (esconde as
//                                             nomeadas) e fotografa só o resto —
//                                             visão MICRO pra detalhar uma parte
//                                             sem o resto atrapalhar. Ver docs/FORJA.md.
//   node scripts/forja.mjs sil <id> <ref>     NOTA DE SILHUETA: isola conforme a
//                                             referência (qa/ref/silhuetas.json),
//                                             renderiza, compara por IoU com o
//                                             polígono traçado de foto real e
//                                             grava o overlay. O "está realmente
//                                             bom?" vira número.
//   node scripts/forja.mjs trace <img> [pts]  TRAÇADOR: desenho (contorno fechado
//                                             ou forma preenchida, traço escuro em
//                                             fundo claro) vira polígono y-pra-cima
//                                             pronto pra fromViews()/silhuetas.json.
//                                             É assim que desenho do ideador entra.
// Saída: qa/out/forja-<id>.png + qa/out/forja-audit.json
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { extname, join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = join(ROOT, 'qa', 'out');
mkdirSync(OUT, { recursive: true });

const [cmd = 'all', ...idsArg] = process.argv.slice(2);
// diff: compõe baseline (qa/baseline) sobre o atual (qa/out) num só PNG

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = createServer((req, res) => {
  const p = join(ROOT, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  try { const b = readFileSync(p); res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}/`;

const { chromium } = await import('playwright-core');
let exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
if (!existsSync(exe) && process.platform === 'win32') {
  const pwDir = join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (existsSync(pwDir)) {
    const candidates = [
      join(pwDir, 'chromium-1228', 'chrome-win64', 'chrome.exe'),
      join(pwDir, 'chromium_headless_shell-1228', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe')
    ];
    for (const c of candidates) { if (existsSync(c)) { exe = c; break; } }
  }
}
const browser = await chromium.launch({ executablePath: existsSync(exe) ? exe : undefined, args: ['--use-angle=swiftshader', '--headless=new'] });
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(base + 'studio.html');
await page.waitForFunction(() => window.__ST__, { timeout: 15000 });

const ids = idsArg.length ? idsArg : await page.evaluate(() => window.__ST__.list());
let hadError = false;
const auditAll = [];

for (const id of ids) {
  if (cmd === 'audit' || cmd === 'all') {
    const a = await page.evaluate((i) => window.__ST__.audit(i), id);
    auditAll.push(a);
    const errs = a.findings.filter((f) => f.level === 'error');
    const warns = a.findings.filter((f) => f.level === 'warn');
    if (errs.length) hadError = true;
    const flag = errs.length ? '✗' : warns.length ? '△' : '✓';
    console.log(`${flag} ${id.padEnd(16)} ${String(a.stats.tris).padStart(5)} tris · ${a.stats.materials} mat` +
      (a.findings.length ? '\n' + a.findings.map((f) => `    [${f.level}] ${f.check}: ${f.msg}`).join('\n') : ''));
  }
  if (cmd === 'shot' || cmd === 'all') {
    const dataUrl = await page.evaluate((i) => window.__ST__.contact(i), id);
    const file = join(OUT, `forja-${id}.png`);
    writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
    if (cmd === 'shot') console.log(`foto ${file}`);
  }
}
if (cmd === 'sil') {
  const [id, refName] = idsArg;
  const refs = JSON.parse(readFileSync(join(ROOT, 'qa', 'ref', 'silhuetas.json'), 'utf8'));
  const ref = refs[refName];
  if (!id || !ref) {
    console.error(`uso: node scripts/forja.mjs sil <id> <ref>\nrefs disponíveis: ${Object.keys(refs).filter((k) => k !== '_').join(', ')}`);
    process.exit(1);
  }
  const r = await page.evaluate(([i, rf]) => window.__ST__.silScore(i, rf.poly, { hide: rf.hide ?? [], yaw: rf.yaw ?? Math.PI / 2, pitch: rf.pitch ?? 0.03 }), [id, ref]);
  if (r.overlay) {
    const f = join(OUT, `sil-${id}-${refName}.png`);
    writeFileSync(f, Buffer.from(r.overlay.split(',')[1], 'base64'));
    console.log(`silhueta ${id} vs ${refName}: IoU ${(r.iou * 100).toFixed(1)}%  ->  ${f}`);
    if (r.diagText) console.log(r.diagText);
  } else {
    console.log(`silhueta ${id} vs ${refName}: máscara vazia (nada visível?)`);
  }
}
if (cmd === 'ronda') {
  const [id] = idsArg;
  if (!id) {
    console.error('uso: node scripts/forja.mjs ronda <id>');
    process.exit(1);
  }
  console.log(`=== RONDA AUTOMÁTICA: ${id} ===\n`);

  console.log('[1/3] Auditoria (audit):');
  const a = await page.evaluate((i) => window.__ST__.audit(i), id);
  auditAll.push(a);
  const errs = a.findings.filter((f) => f.level === 'error');
  const warns = a.findings.filter((f) => f.level === 'warn');
  const flag = errs.length ? '✗' : warns.length ? '△' : '✓';
  console.log(`  ${flag} ${id.padEnd(16)} ${String(a.stats.tris).padStart(5)} tris · ${a.stats.materials} mat`);
  if (a.findings.length) {
    console.log(a.findings.map((f) => `      [${f.level}] ${f.check}: ${f.msg}`).join('\n'));
  }

  console.log('\n[2/3] Gerando folha de contato (shot):');
  const shotUrl = await page.evaluate((i) => window.__ST__.contact(i), id);
  const shotFile = join(OUT, `forja-${id}.png`);
  writeFileSync(shotFile, Buffer.from(shotUrl.split(',')[1], 'base64'));
  console.log(`  ✓ Foto gerada: ${shotFile}`);

  console.log('\n[3/3] Checando referência de silhueta (sil):');
  const refs = JSON.parse(readFileSync(join(ROOT, 'qa', 'ref', 'silhuetas.json'), 'utf8'));
  const matchingRefs = Object.entries(refs).filter(([k]) => k !== '_' && (k === id || k.startsWith(id) || (id === 'jogador' && k.startsWith('pe'))));
  if (matchingRefs.length === 0) {
    console.log('  - Nenhuma referência cadastrada em qa/ref/silhuetas.json para este id.');
  } else {
    for (const [refName, ref] of matchingRefs) {
      const r = await page.evaluate(([i, rf]) => window.__ST__.silScore(i, rf.poly, { hide: rf.hide ?? [], yaw: rf.yaw ?? Math.PI / 2, pitch: rf.pitch ?? 0.03 }), [id, ref]);
      if (r.overlay) {
        const silFile = join(OUT, `sil-${id}-${refName}.png`);
        writeFileSync(silFile, Buffer.from(r.overlay.split(',')[1], 'base64'));
        console.log(`  ✓ Silhueta vs ${refName}: IoU ${(r.iou * 100).toFixed(1)}% -> ${silFile}`);
        if (r.diagText) console.log(r.diagText);
      }
    }
  }

  console.log(`\n=== FIM DA RONDA: ${id} ===`);
}
if (cmd === 'trace') {
  const [file, pts] = idsArg;
  if (!file || !existsSync(file)) {
    console.error('uso: node scripts/forja.mjs trace <imagem.png|jpg> [maxPontos]');
    process.exit(1);
  }
  const ext = extname(file).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  const dataURL = `data:${mime};base64,${readFileSync(file).toString('base64')}`;
  const poly = await page.evaluate(([d, n]) => window.__ST__.trace(d, { maxPontos: n }), [dataURL, Number(pts) || 18]);
  if (!poly) { console.error('trace: nenhuma forma encontrada (o traço fecha? o fundo é claro?)'); process.exit(1); }
  console.log(`${poly.length} pontos (y pra cima, unidades em pixel — normalize ao usar):`);
  console.log(JSON.stringify(poly));
}
if (cmd === 'part') {
  const [id, namesArg] = idsArg;
  const hideNames = (namesArg || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!id || !hideNames.length) {
    console.error('uso: node scripts/forja.mjs part <id> <nome1,nome2,...>  (esconde essas peças e fotografa o resto)');
    process.exit(1);
  }
  const dataUrl = await page.evaluate(([i, names]) => window.__ST__.contact(i, names), [id, hideNames]);
  const file = join(OUT, `forja-${id}-isolado.png`);
  writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(`foto ${file} (escondido: ${hideNames.join(', ')})`);
}
if (cmd === 'diff') {
  for (const id of ids) {
    const basePng = join(ROOT, 'qa', 'baseline', `forja-${id}.png`);
    const curPng = join(OUT, `forja-${id}.png`);
    if (!existsSync(basePng) || !existsSync(curPng)) { console.log(`diff ${id}: falta baseline ou atual`); continue; }
    const dataUrl = await page.evaluate(async ([a, b, label]) => {
      const load = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const c = document.createElement('canvas');
      c.width = Math.max(ia.width, ib.width); c.height = ia.height + ib.height + 30;
      const g = c.getContext('2d');
      g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(ia, 0, 22);
      g.drawImage(ib, 0, ia.height + 30);
      g.fillStyle = '#f0c95c'; g.font = '18px Georgia';
      g.fillText(`${label} — ANTES (baseline)`, 8, 16);
      g.fillText(`${label} — DEPOIS (atual)`, 8, ia.height + 26);
      return c.toDataURL('image/png');
    }, [`/qa/baseline/forja-${id}.png`, `/qa/out/forja-${id}.png`, id]);
    const f = join(OUT, `forja-${id}-diff.png`);
    writeFileSync(f, Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log(`diff ${f}`);
  }
}
if (auditAll.length) writeFileSync(join(OUT, 'forja-audit.json'), JSON.stringify(auditAll, null, 2));
await browser.close();
server.close();
if (hadError) { console.error('\nA Forja reprova: há findings de nível error.'); process.exit(1); }
