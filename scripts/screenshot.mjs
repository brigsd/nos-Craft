#!/usr/bin/env node
// O "olhar" do nos-Craft: sobe um server local, abre no Chromium headless
// (WebGL via SwiftShader) e fotografa pontos canônicos. Uso:
//   node scripts/screenshot.mjs            -> todos os pontos
//   node scripts/screenshot.mjs vila portal
// Saída: qa/out/*.png (gitignorado — evidência é regenerável).
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { extname, join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = join(ROOT, 'qa', 'out');
mkdirSync(OUT, { recursive: true });

const POINTS = {
  portal:  { tp: [-144, -6], cam: [2.4, 0.28, 11] },
  vila:    { tp: [-62, 16], cam: [-2.2, 0.25, 12] },
  taverna: { tp: [-30, 4], cam: [0.9, 0.3, 9] },
  ponte:   { tp: [26, 22], cam: [-0.6, 0.3, 11] },
  lobos:   { tp: [-80, -42], cam: [2.6, 0.3, 10] },
  gnoll:   { tp: [92, -58], cam: [-0.7, 0.32, 12] },
  gruta:   { tp: [124, -98], cam: [-0.8, 0.3, 10] },
  combate: { tp: [-90, -50], cam: [2.8, 0.3, 8], target: true },
};

const wanted = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const server = createServer((req, res) => {
  const p = join(ROOT, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  try {
    const body = readFileSync(p);
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('nao achei');
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}/`;

const { chromium } = await import('playwright-core');
const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ executablePath: existsSync(exe) ? exe : undefined, args: ['--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });
await page.goto(base);
await page.waitForTimeout(2500);
await page.evaluate(() => window.__NC_QA__.start());
await page.waitForTimeout(600);

const names = wanted.length ? wanted : Object.keys(POINTS);
for (const name of names) {
  const pt = POINTS[name];
  if (!pt) { console.error(`ponto desconhecido: ${name}`); continue; }
  await page.evaluate((p) => {
    window.__NC_QA__.tp(p.tp[0], p.tp[1]);
    window.__NC_QA__.cam(p.cam[0], p.cam[1], p.cam[2]);
    if (p.target) {
      const near = window.__NC_QA__.mobs.findIndex((m) => !m.dead);
      if (near >= 0) window.__NC_QA__.setTarget(near);
    }
  }, pt);
  await page.waitForTimeout(450);
  const file = join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  console.log(`olhou ${name} -> ${file}`);
}
await browser.close();
server.close();
