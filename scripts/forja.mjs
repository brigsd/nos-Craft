#!/usr/bin/env node
// A FORJA · CLI — fotografa e audita objetos do estúdio, sem abrir navegador.
//   node scripts/forja.mjs shot [ids...]     folhas de contato (4 ângulos × 2 luzes)
//   node scripts/forja.mjs audit [ids...]    crítico algorítmico (exit 1 se error)
//   node scripts/forja.mjs all               tudo: audita e fotografa
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

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = createServer((req, res) => {
  const p = join(ROOT, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  try { const b = readFileSync(p); res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}/`;

const { chromium } = await import('playwright-core');
const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ executablePath: existsSync(exe) ? exe : undefined, args: ['--use-angle=swiftshader'] });
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
if (auditAll.length) writeFileSync(join(OUT, 'forja-audit.json'), JSON.stringify(auditAll, null, 2));
await browser.close();
server.close();
if (hadError) { console.error('\nA Forja reprova: há findings de nível error.'); process.exit(1); }
