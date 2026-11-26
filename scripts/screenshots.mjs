// 用真正的 WebGL（軟體渲染）開網站，逐區截圖並記錄瀏覽器錯誤。CI 會把 shots/ 上傳成 artifact。
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:3000';
const OUT = 'shots';
mkdirSync(OUT, { recursive: true });
const log = [];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'] });

async function page(vw, name) {
  const p = await browser.newPage({ viewport: vw });
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') log.push(`[${name}] ${m.type()}: ${m.text()}`); });
  p.on('pageerror', (e) => log.push(`[${name}] pageerror: ${e.message}`));
  return p;
}
const ready = async (p) => { await p.waitForSelector('.loading', { state: 'detached', timeout: 90000 }).catch(() => log.push('loading timeout')); await p.waitForTimeout(5000); };

for (const [tag, vw] of [['desk', { width: 1280, height: 800 }], ['mob', { width: 390, height: 844 }]]) {
  const p = await page(vw, tag);
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await ready(p);
  await p.screenshot({ path: `${OUT}/${tag}-00-hero.png` });
  const ids = await p.$$eval('[data-view]', (els) => els.map((e) => e.id).filter(Boolean));
  let n = 1;
  for (const id of ids) {
    if (id === 'top') continue;
    await p.evaluate((i) => document.getElementById(i).scrollIntoView(), id);
    await p.waitForTimeout(4500);
    await p.screenshot({ path: `${OUT}/${tag}-${String(n++).padStart(2, '0')}-${id}.png` });
  }
  await p.close();
  const zones = tag === 'desk' ? ['all', 'fan', 'mea', 'ter', 'volc', 'topo', 'rock', 'plate', 'climate'] : ['fan', 'topo'];
  for (const z of zones) {
    const q = await page(vw, `${tag}-ex-${z}`);
    await q.goto(`${BASE}/explore/${z}`, { waitUntil: 'networkidle' });
    await ready(q);
    await q.screenshot({ path: `${OUT}/${tag}-ex-${z}.png` });
    if (z === 'fan' || z === 'ter') {
      await q.click('.notes .item[data-i="0"]').catch(() => {});
      await q.waitForTimeout(4000);
      await q.screenshot({ path: `${OUT}/${tag}-ex-${z}-focus.png` });
    }
    await q.close();
  }
}
await browser.close();
writeFileSync(`${OUT}/console.txt`, log.join('\n') || '(no console errors)');
console.log(log.length ? log.join('\n') : 'no console errors');
