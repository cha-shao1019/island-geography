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
  await p.goto(`${BASE}/?debug=1`, { waitUntil: 'networkidle' });
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
  const zones = tag === 'desk' ? ['all', 'mtn', 'delta', 'fan', 'mea', 'ter', 'lag', 'east', 'volc', 'topo', 'climate'] : ['mea', 'ter'];
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
// 模擬與工具（?speed=6 讓模擬在軟體渲染下也能走完）
try {
  const q = await page({ width: 1280, height: 800 }, 'sim');
  await q.goto(`${BASE}/explore/sim?speed=6`, { waitUntil: 'networkidle' });
  await ready(q);
  await q.locator('input[aria-label="海平面"]').fill('2');
  await q.waitForTimeout(3000);
  await q.screenshot({ path: `${OUT}/sim-sealevel.jpg`, type: 'jpeg', quality: 70 });
  await q.locator('input[aria-label="海平面"]').fill('0');
  await q.click('.tools >> text=颱風來襲');
  for (const [i, w] of [[1, 6000], [2, 8000], [3, 8000]]) { await q.waitForTimeout(w); await q.screenshot({ path: `${OUT}/sim-typhoon-${i}.jpg`, type: 'jpeg', quality: 70 }); }
  await q.locator('input[aria-label="時間"]').fill('21');
  await q.waitForTimeout(3000);
  await q.screenshot({ path: `${OUT}/sim-night.jpg`, type: 'jpeg', quality: 70 });
  await q.goto(`${BASE}/explore/plate?speed=3`, { waitUntil: 'networkidle' });
  await ready(q);
  await q.click('.layers >> text=模擬地震');
  await q.waitForTimeout(6000);
  await q.screenshot({ path: `${OUT}/sim-quake.jpg`, type: 'jpeg', quality: 70 });
  await q.goto(`${BASE}/explore/fan`, { waitUntil: 'networkidle' });
  await ready(q);
  await q.click('.tools >> text=剖面與測距');
  await q.mouse.click(420, 300); await q.waitForTimeout(800); await q.mouse.click(780, 520);
  await q.waitForTimeout(3000);
  await q.screenshot({ path: `${OUT}/tool-profile.jpg`, type: 'jpeg', quality: 70 });
  await q.mouse.move(640, 400); await q.mouse.down({ button: 'right' }); await q.mouse.move(500, 300, { steps: 8 }); await q.mouse.up({ button: 'right' });
  await q.waitForTimeout(2500);
  await q.screenshot({ path: `${OUT}/tool-pan.jpg`, type: 'jpeg', quality: 70 });
  await q.close();
} catch (e) { log.push(`[sim] script error: ${e.message.split('\n')[0]}`); }
await browser.close();
writeFileSync(`${OUT}/console.txt`, log.join('\n') || '(no console errors)');
console.log(log.length ? log.join('\n') : 'no console errors');
