/* 載入預先算好的地形，並計算「地形特徵點」，讓標記落在真的地形上 */
import { sampleH, slopeAt, spineX, APEX, HALF, SZ } from './terrain/terrain.js';

export async function loadWorld(N) {
  const [buf, rivers] = await Promise.all([
    fetch(`/terrain/heights-${N}.bin`).then((r) => { if (!r.ok) throw new Error('地形資料載入失敗'); return r.arrayBuffer(); }),
    fetch('/terrain/rivers.json').then((r) => r.json()),
  ]);
  const q = new Int16Array(buf), H = new Float32Array(q.length);
  for (let i = 0; i < q.length; i++) H[i] = q[i] / 100;
  const W = { H, n1: N + 1, N, SZ, HALF };
  W.rivers = rivers.map((r) => ({ id: r.id, main: r.main, S: r.S.map(([x, z, t, bed, w, sl]) => ({ x, z, t, bed, w, sl })) }));
  W.riv = (id) => W.rivers.find((r) => r.id === id);
  W.h = (x, z) => sampleH(W, x, z);
  W.y = (x, z) => Math.max(sampleH(W, x, z), 0);
  W.slope = (x, z) => slopeAt(W, x, z);
  W.F = features(W);
  return W;
}

export const nearestS = (r, x, z) => { let b = null, d = 1e9; for (const p of r.S) { const q = (p.x - x) ** 2 + (p.z - z) ** 2; if (q < d) { d = q; b = p; } } return b; };
export const atT = (r, t) => r.S[Math.min(r.S.length - 1, Math.floor(r.S.length * t))];

function features(W) {
  const F = {};
  // 曲流頂點：外彎＝凹岸、內彎＝凸岸
  const x0 = -35.7, z0 = 12 + 7 * Math.sin(0.22 * x0), p = nearestS(W.riv('R2'), x0, z0);
  F.concave = [x0, z0 - (p.w + 2.2)]; F.convex = [x0, z0 + (p.w + 3)];
  // 沖積扇：沿扇面往西北西
  const dx = -0.94, dz = -0.34;
  F.fanTop = [APEX[0] + dx * 3, APEX[1] + dz * 3];
  F.fanMid = [APEX[0] + dx * 11, APEX[1] + dz * 11];
  F.fanEnd = [APEX[0] + dx * 20, APEX[1] + dz * 20];
  F.fanVil = [APEX[0] + Math.cos(Math.PI * 0.9) * 20.5, APEX[1] + Math.sin(Math.PI * 0.9) * 20.5];
  F.recharge = [APEX[0] + dx * 9 + 1, APEX[1] + dz * 9 - 3];
  const v = atT(W.riv('R2'), 0.035); F.vvalley = [v.x, v.z];
  // 河階：沿 R3 法線走，找到階崖（陡）與其後的階面（平）
  const r3 = W.riv('R3'), i3 = Math.floor(r3.S.length * 0.36), a = r3.S[i3], b = r3.S[i3 + 4];
  const tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz), nx = -tz / l, nz = tx / l;
  let best = null;
  for (const sg of [1, -1]) {
    let cliff = null, flat = null;
    for (let d = a.w + 1; d < 22; d += 0.5) {
      const x = a.x + nx * d * sg, z = a.z + nz * d * sg, s = W.slope(x, z), h = W.h(x, z);
      if (!cliff && s > 0.9 && h > a.bed + 1.5) cliff = [x, z];
      else if (cliff && !flat && s < 0.25) flat = [x + nx * sg * 1.5, z + nz * sg * 1.5];
    }
    if (cliff && flat && !best) best = { cliff, flat };
  }
  F.terCliff = best ? best.cliff : [a.x + nx * 6, a.z + nz * 6];
  F.terFlat = best ? best.flat : [a.x + nx * 9, a.z + nz * 9];
  const dm = atT(W.riv('R1'), 0.16); F.dam = [dm.x, dm.z];
  F.fault = [spineX(-20) + 12, -20];
  F.faultAt = (z) => [spineX(z) + 12, z];
  return F;
}

/** 把內容裡的位置（座標或特徵名稱）轉成 [x, z] */
export const resolve = (W, pos) => (typeof pos === 'string' ? W.F[pos] : pos);
