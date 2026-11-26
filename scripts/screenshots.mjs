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
  await p.screenshot({ path: `${OUT}/${tag}-00-hero.jpg`, type: 'jpeg', quality: 70 });
  const ids = await p.$$eval('[data-view]', (els) => els.map((e) => e.id).filter(Boolean));
  let n = 1;
  for (const id of ids) {
    if (id === 'top') continue;
    await p.evaluate((i) => document.getElementById(i).scrollIntoView(), id);
    await p.waitForTimeout(4500);
    await p.screenshot({ path: `${OUT}/${tag}-${String(n++).padStart(2, '0')}-${id}.jpg`, type: 'jpeg', quality: 70 });
  }
  await p.close();
  const zones = tag === 'desk' ? ['all', 'fan', 'mea', 'ter', 'volc', 'topo', 'rock', 'plate', 'climate'] : ['fan', 'topo'];
  for (const z of zones) {
    const q = await page(vw, `${tag}-ex-${z}`);
    await q.goto(`${BASE}/explore/${z}`, { waitUntil: 'networkidle' });
    await ready(q);
    await q.screenshot({ path: `${OUT}/${tag}-ex-${z}.jpg`, type: 'jpeg', quality: 70 });
    if (z === 'fan' || z === 'ter') {
      await q.click('.notes .item[data-i="0"]').catch(() => {});
      await q.waitForTimeout(4000);
      await q.screenshot({ path: `${OUT}/${tag}-ex-${z}-focus.jpg`, type: 'jpeg', quality: 70 });
    }
    await q.close();
  }
}
// 模擬與工具
{
  const q = await page({ width: 1280, height: 800 }, 'sim');
  await q.goto(`${BASE}/explore/sim`, { waitUntil: 'networkidle' });
  await ready(q);
  await q.locator('input[aria-label="海平面"]').fill('2');
  await q.waitForTimeout(3000);
  await q.screenshot({ path: `${OUT}/sim-sealevel.jpg`, type: 'jpeg', quality: 70 });
  await q.locator('input[aria-label="海平面"]').fill('0');
  await q.click('text=颱風來襲');
  await q.waitForTimeout(9000);
  await q.screenshot({ path: `${OUT}/sim-typhoon.jpg`, type: 'jpeg', quality: 70 });
  await q.locator('input[aria-label="時間"]').fill('21');
  await q.waitForTimeout(3000);
  await q.screenshot({ path: `${OUT}/sim-night.jpg`, type: 'jpeg', quality: 70 });
  await q.locator('input[aria-label="時間"]').fill('17.5');
  await q.click('#zones >> text=沖積扇與湧泉帶');
  await q.waitForTimeout(4000);
  await q.click('text=剖面與測距');
  await q.mouse.click(420, 300); await q.waitForTimeout(800); await q.mouse.click(780, 520);
  await q.waitForTimeout(3000);
  await q.screenshot({ path: `${OUT}/tool-profile.jpg`, type: 'jpeg', quality: 70 });
  await q.close();
}
await browser.close();
writeFileSync(`${OUT}/console.txt`, log.join('\n') || '(no console errors)');
console.log(log.length ? log.join('\n') : 'no console errors');
