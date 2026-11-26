/* 地物（樹、水田、茶樹、都市、村落、港口、風機、道路）與生活動畫（車、行人、船） */
import * as THREE from 'three';
import { M, inst, rnd, ribbon } from './shared.js';
import { lake, riverMat } from './water.js';
import { nearestS } from '../world.js';
import { fbm, isCity, inRiceTerrace, BASIN, APEX, TEA, ISLET, ISR } from '../terrain/terrain.js';

const inPaddy = (x, z, h, sl) => h > 0.9 && h < 5.5 && sl < 0.3 && x < 4 + 6 * fbm(z * 0.05, 1, 2) && z > -46 + 6 * fbm(x * 0.05, 2, 2) && z < 44 + 6 * fbm(x * 0.05, 3, 2) && !isCity(x, z);
const inTea = (x, z, h, sl) => Math.hypot(x - TEA[0], z - TEA[1]) < 14 && h > 3.2 && sl < 0.7;

export function buildObjects(ctx) {
  const { W, SC, live, lite } = ctx, F = W.F, add = (...a) => inst(SC, ...a);
  /* 樹 */
  const trees = [], maxTrees = lite ? 2200 : 4600;
  for (let i = 0; i < 30000 && trees.length < maxTrees; i++) {
    const x = (rnd(i, 1) - 0.5) * 260, z = (rnd(i, 2) - 0.5) * 260, h = W.h(x, z), sl = W.slope(x, z), rI = Math.hypot(x - ISLET[0], z - ISLET[1]);
    if (isCity(x, z) || inTea(x, z, h, sl) || inRiceTerrace(x, z)) continue;
    if ((h > 6.5 && h < 44 && sl < 1.7) || (rI < ISR && h > 1.5 && h < 8 && sl < 1) || (x > -58 && x < -54.5 && z > 72 && z < 90 && h > 0.6)) trees.push([x, h, z, rnd(i, 3)]);
  }
  add(trees, new THREE.ConeGeometry(0.75, 2.3, 6), M(0xffffff, { roughness: 0.9 }),
    (d, [x, h, z, r]) => { d.position.set(x, h + 1, z); const s = 0.6 + r * 0.8; d.scale.set(s, s * (0.9 + r * 0.4), s); d.rotation.y = r * 6; },
    ([, h, , r]) => (h > 26 ? 0x2a4a26 : r > 0.5 ? 0x335f2b : 0x41712f));
  /* 水田 */
  const fields = [], R2 = W.riv('R2');
  for (let x = -74; x < 6; x += 3.2) for (let z = -50; z < 50; z += 2.6) {
    const cx = x + 1.6, cz = z + 1.3, h = W.h(cx, cz), sl = W.slope(cx, cz);
    if (!inPaddy(cx, cz, h, sl)) continue;
    const r = nearestS(R2, cx, cz); if (Math.hypot(r.x - cx, r.z - cz) < r.w + 2) continue;
    fields.push([cx, h, cz, rnd(Math.round(cx * 7 + cz * 3), 9)]);
  }
  add(fields, new THREE.BoxGeometry(2.85, 0.12, 2.25), M(0xffffff, { roughness: 0.55 }), (d, [x, h, z]) => d.position.set(x, h + 0.05, z),
    (p) => [0x7fb5a6, 0x8fbf4a, 0x9cc455, 0xb9c35b, 0xd4c06a][Math.floor(p[3] * 5)]);
  /* 茶樹：沿等高線成行 */
  const tea = [];
  for (let x = TEA[0] - 14; x < TEA[0] + 14; x += 0.6) for (let z = TEA[1] - 14; z < TEA[1] + 14; z += 0.6) {
    const h = W.h(x, z), sl = W.slope(x, z); if (!inTea(x, z, h, sl) || Math.sin(h * 6) < -0.1) continue; tea.push([x, h, z]);
  }
  add(tea.slice(0, lite ? 2600 : 5200), new THREE.SphereGeometry(0.42, 7, 5), M(0x2f6a2c, { roughness: 0.95 }), (d, [x, h, z]) => { d.position.set(x, h + 0.22, z); d.scale.set(1.35, 0.75, 1.35); });
  /* 都市 */
  const bld = [];
  const city = (cx, cz, rad, tall, seed) => {
    for (let x = cx - rad; x <= cx + rad; x += 1.35) for (let z = cz - rad; z <= cz + rad; z += 1.35) {
      const d = Math.hypot(x - cx, z - cz); if (d > rad || rnd(Math.round(x * 7 + z * 13), seed) < 0.18) continue;
      const h = W.h(x, z); if (h < 0.6 || W.slope(x, z) > 0.8) continue;
      if (Math.abs((((x % 6) + 6) % 6) - 3) < 0.5 || Math.abs((((z % 6) + 6) % 6) - 3) < 0.5) continue;
      const r = rnd(Math.round(x * 3 + z * 5), seed + 1);
      bld.push([x, h, z, 0.4 + r * 1.4 + tall * Math.exp(-((d / (rad * 0.38)) ** 2)) * r * r, r]);
    }
  };
  city(BASIN[0], BASIN[1], 12.5, 9, 4); city(-47, -75, 7.5, 4, 5);
  const bMat = M(0xffffff, { roughness: 0.6, emissive: 0xffc46b, emissiveIntensity: 0 }); ctx.glow.push([bMat, 1.6]);
  add(bld, new THREE.BoxGeometry(1, 1, 1), bMat, (d, [x, h, z, hh]) => { d.position.set(x, h + hh / 2, z); d.scale.set(1, hh, 1); },
    (p) => [0xf2efe8, 0xd9d4ca, 0xbcc6cc, 0xe6ddd0, 0x9fb0ba][Math.floor(p[4] * 5)]);
  /* 村落 */
  const houses = [];
  const village = (cx, cz, rad, n, seed) => {
    for (let i = 0; i < n * 5 && n > 0; i++) {
      const a = rnd(i, seed) * 6.283, r = Math.sqrt(rnd(i, seed + 1)) * rad, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, h = W.h(x, z);
      if (h < 0.7 || W.slope(x, z) > 0.6) continue; houses.push([x, h, z, rnd(i, seed + 2)]); n--;
    }
  };
  for (let k = 0; k < 14; k++) { const a = Math.PI * (0.62 + k * 0.055); village(APEX[0] + Math.cos(a) * 20.5, APEX[1] + Math.sin(a) * 20.5, 2.2, 5, 10 + k); }
  village(-16, 50, 4, 22, 40); village(F.terFlat[0], F.terFlat[1], 2.5, 8, 41); village(15, 92, 3.5, 18, 42); village(77, 88, 3, 16, 43);
  village(-56, 58, 3, 14, 44); village(24, 6, 2.5, 8, 45); village(-36, -20, 4, 14, 46); village(-46, 30, 4, 12, 47); village(-17, -21, 3, 8, 48);
  const hMat = M(0xf1ebe0, { emissive: 0xffb45a, emissiveIntensity: 0 }); ctx.glow.push([hMat, 1.3]);
  add(houses, new THREE.BoxGeometry(0.9, 0.7, 0.75), hMat, (d, [x, h, z, r]) => { d.position.set(x, h + 0.33, z); d.rotation.y = r * 3; });
  add(houses, new THREE.ConeGeometry(0.78, 0.55, 4), M(0xffffff), (d, [x, h, z, r]) => { d.position.set(x, h + 0.95, z); d.rotation.y = r * 3 + 0.785; d.scale.set(1, 1, 0.85); },
    (p) => (p[3] > 0.5 ? 0xb4533a : 0x6f7b86));
  /* 魚塭 */
  const ponds = [];
  for (let x = -57.5; x <= -50; x += 2.3) for (let z = 62; z <= 80; z += 1.8) { const h = W.h(x, z); if (h > 0.5 && h < 3.2) ponds.push([x, h, z]); }
  add(ponds, new THREE.BoxGeometry(2, 0.12, 1.5), M(0x5f9fa8, { roughness: 0.15, metalness: 0.1 }), (d, [x, h, z]) => d.position.set(x, h + 0.06, z));
  /* 港口 */
  const pier = M(0xb9b3a8);
  [[-55, -80, 12, 2, -0.6], [-57, -85, 10, 2, -0.6]].forEach(([x, z, l, w, a]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(l, 0.8, w), pier); m.position.set(x, 0.3, z); m.rotation.y = a; m.castShadow = m.receiveShadow = true; SC.add(m);
  });
  const cont = []; for (let i = 0; i < 40; i++) cont.push([-58 + rnd(i, 60) * 7, 0, -84 + rnd(i, 61) * 5, i]);
  add(cont, new THREE.BoxGeometry(1, 0.6, 0.45), M(0xffffff), (d, [x, , z, i]) => { d.position.set(x, 0.95 + (i % 3) * 0.6, z); d.rotation.y = -0.6; },
    (p) => [0xd2563c, 0x2f7fb0, 0xe2a23a, 0x4e8d5d][p[3] % 4]);
  for (let k = 0; k < 3; k++) {
    const c = new THREE.Group(), y = M(0xf0b429);
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.35, 6, 0.35), y); a.position.y = 3;
    const b = new THREE.Mesh(new THREE.BoxGeometry(6, 0.35, 0.35), y); b.position.set(1.5, 5.8, 0);
    c.add(a, b); c.position.set(-58 + k * 3.2, 0.7, -80 - k * 2.1); c.rotation.y = -0.6; c.traverse((o) => (o.castShadow = true)); SC.add(c);
  }
  const ind = []; for (let i = 0; i < 16; i++) { const x = -42 + rnd(i, 70) * 8, z = -82 + rnd(i, 71) * 5, h = W.h(x, z); if (h > 0.6) ind.push([x, h, z]); }
  add(ind, new THREE.CylinderGeometry(0.9, 0.9, 1.4, 16), M(0xe9e6df, { roughness: 0.5, metalness: 0.2 }), (d, [x, h, z]) => d.position.set(x, h + 0.7, z));
  /* 水庫 */
  const S1 = W.riv('R1').S, di = Math.floor(S1.length * 0.16), dam = S1[di], dn = S1[di + 3];
  const dw = new THREE.Mesh(new THREE.BoxGeometry(10, 7, 1.4), M(0xd8d4cb));
  dw.position.set(dam.x, dam.bed + 3.2, dam.z); dw.rotation.y = -Math.atan2(dn.z - dam.z, dn.x - dam.x) + Math.PI / 2; dw.castShadow = true; SC.add(dw);
  /* 水庫：沿壩上游河谷鋪一片水面，高於谷壁的部分被地形遮住，形成自然的湖岸 */
  const level = dam.bed + 5, upS = S1.slice(Math.floor(S1.length * 0.05), di + 1);
  SC.add(new THREE.Mesh(ribbon(upS, () => 9, () => level, () => 0.02, () => 5), riverMat(ctx)));
  /* 燈塔 */
  const lh = new THREE.Group();
  const t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 3.6, 16), M(0xffffff)); t1.position.y = 1.8;
  const t2 = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.8, 16), M(0xc8382a)); t2.position.y = 4;
  lh.add(t1, t2); lh.position.set(48, W.h(48, -46), -46); lh.traverse((o) => (o.castShadow = true)); SC.add(lh);
  const bg = new THREE.ConeGeometry(2.2, 26, 16, 1, true); bg.translate(0, 13, 0); bg.rotateZ(-Math.PI / 2);
  const beam = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff2b0).multiplyScalar(2), transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.set(48, W.h(48, -46) + 4.1, -46); SC.add(beam); ctx.nightOnly.push(beam);
  live.push((t) => { beam.rotation.y = t * 0.9; });
  /* 風機 */
  const rotors = [];
  [46, 52, 57, 70, 76, 82, 88].forEach((z) => {
    const x = -69 + 2.5 * Math.sin(z * 0.12) + (z > 84 ? 13 : 0), h = Math.max(W.h(x, z), 0.2), g = new THREE.Group(), wm = M(0xf6f6f4, { roughness: 0.5 });
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 7, 8), wm); tw.position.y = 3.5; g.add(tw);
    const rot = new THREE.Group(); rot.position.set(0.3, 7, 0);
    for (let k = 0; k < 3; k++) { const bg = new THREE.BoxGeometry(0.08, 2.9, 0.3); bg.translate(0, 1.45, 0); const b = new THREE.Mesh(bg, wm); b.rotation.x = k * 2.094; rot.add(b); }
    g.add(rot); g.position.set(x, h, z); g.traverse((o) => (o.castShadow = true)); SC.add(g); rotors.push(rot);
  });
  live.push((t) => rotors.forEach((r, i) => (r.rotation.x = t * 1.6 + i)));
  /* 道路：取周圍最高點當路面，過河時自然變成橋 */
  const pts = [[-46, -74], [-34, -66], [-24, -58], [-16, -55], [-20, -40], [-26, -22], [-20, -4], [-24, 12], [-30, 26], [-22, 40], [-16, 50], [-30, 56], [-46, 58], [-56, 58]];
  const rp = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z))).getSpacedPoints(500);
  const ry = rp.map((p) => { let m = -1e9; for (let k = -3; k <= 3; k++) for (let j = -3; j <= 3; j++) m = Math.max(m, W.h(p.x + k * 0.8, p.z + j * 0.8)); return Math.max(m, 0.9) + 0.15; });
  for (let it = 0; it < 3; it++) for (let i = 1; i < ry.length - 1; i++) ry[i] = Math.max(ry[i], (ry[i - 1] + ry[i + 1]) / 2);
  const rm = new THREE.Mesh(ribbon(rp, () => 0.45, (_, i) => ry[i]), M(0x55514b, { polygonOffset: true, polygonOffsetFactor: -3, side: THREE.DoubleSide }));
  rm.receiveShadow = rm.castShadow = true; SC.add(rm);
  ctx.road = { rp, ry };
  /* 路燈：入夜才亮 */
  const lamps = rp.filter((_, i) => i % 7 === 0).map((p, i) => [p.x, ry[i * 7] + 0.9, p.z]);
  const lm = inst(SC, lamps, new THREE.SphereGeometry(0.22, 6, 5), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd28a).multiplyScalar(4) }), (d, [x, y, z]) => d.position.set(x, y, z)); // 亮度 >1 讓光暈效果抓到
  if (lm) { lm.castShadow = false; ctx.nightOnly.push(lm); }
}

export function buildLife(ctx) {
  const { W, SC, live, lite } = ctx, d = new THREE.Object3D(), c = new THREE.Color();
  /* 車 */
  const NC = lite ? 16 : 28, cMat = M(0xffffff, { roughness: 0.4, emissive: 0xfff4d0, emissiveIntensity: 0 }), cars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.42, 0.5), cMat, NC);
  ctx.glow.push([cMat, 0.5]);
  for (let i = 0; i < NC; i++) { c.setHex([0xd64933, 0xf4f1ea, 0x2f6f9f, 0xf2b632, 0x404a52][i % 5]); cars.setColorAt(i, c); }
  cars.castShadow = true; SC.add(cars);
  const { rp, ry } = ctx.road, n = rp.length;
  /* 車流量隨時間：上下班尖峰最多、深夜最少 */
  const traffic = (h) => Math.min(1, 0.15 + 0.85 * (Math.exp(-(((h - 8) / 1.4) ** 2)) + Math.exp(-(((h - 18) / 1.6) ** 2))) + (h > 9 && h < 17 ? 0.35 : 0));
  live.push((t) => {
    const active = Math.round(NC * traffic(ctx.hour));
    for (let i = 0; i < NC; i++) {
      const dir = i % 2 ? 1 : -1, u = (((i / NC + t * 0.012 * dir) % 1) + 1) % 1, f = u * (n - 1), k = Math.floor(f), k2 = Math.min(k + 1, n - 1), a = rp[k], b = rp[k2], w = f - k, side = dir * 0.22;
      const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
      d.position.set(a.x + dx * w - (dz / l) * side, ry[k] + (ry[k2] - ry[k]) * w + 0.22, a.z + dz * w + (dx / l) * side);
      d.rotation.set(0, -Math.atan2(dz, dx), 0); const sc = i < active ? 1 : 0; d.scale.set(sc, sc, sc); d.updateMatrix(); cars.setMatrixAt(i, d.matrix);
    }
    cars.instanceMatrix.needsUpdate = true;
  });
  /* 行人 */
  const F = W.F, spots = [[BASIN[0], BASIN[1], 10, 60], [-47, -75, 5, 22], [F.fanVil[0], F.fanVil[1], 2, 8], [-16, 50, 3, 10], [15, 92, 3, 12], [77, 88, 3, 12], [-56, 58, 2.5, 8], [-30, -6, 6, 10], [TEA[0], TEA[1], 6, 10], [96, 92, 2, 8]];
  const ppl = [];
  spots.forEach(([x, z, r, k], s) => { for (let i = 0; i < (lite ? Math.ceil(k / 2) : k); i++) ppl.push({ x, z, r, p: rnd(i, s + 80) * 6.28, v: 0.15 + rnd(i, s + 81) * 0.25 }); });
  const body = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.16, 0.55, 6), M(0xffffff), ppl.length);
  ppl.forEach((_, i) => { c.setHex([0xd64933, 0x2f6f9f, 0xf2b632, 0x3f8f62, 0xeeeeee, 0x7a4fb0][i % 6]); body.setColorAt(i, c); });
  SC.add(body);
  const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 6, 5), M(0xe9c4a0), ppl.length); SC.add(head);
  live.push((t) => {
    const h = ctx.hour, share = h < 5 || h > 22 ? 0.15 : h < 7 || h > 20 ? 0.5 : 1, shown = Math.round(ppl.length * share);
    ppl.forEach((p, i) => {
      const x = p.x + Math.cos(p.p + t * p.v) * p.r * Math.sin(p.p * 1.7 + t * p.v * 0.6), z = p.z + Math.sin(p.p + t * p.v * 0.8) * p.r * Math.cos(p.p * 0.7 + t * p.v * 0.5), y = Math.max(W.h(x, z), 0.3);
      const k = i < shown ? 1 : 0; d.rotation.set(0, 0, 0); d.scale.set(k, k, k); d.position.set(x, y + 0.28, z); d.updateMatrix(); body.setMatrixAt(i, d.matrix);
      d.position.y = y + 0.66; d.updateMatrix(); head.setMatrixAt(i, d.matrix);
    });
    body.instanceMatrix.needsUpdate = true; head.instanceMatrix.needsUpdate = true;
  });
  /* 船 */
  const ship = (hull, cab, len) => {
    const g = new THREE.Group(), a = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, len * 0.32), M(hull)); a.position.y = 0.3;
    const b = new THREE.Mesh(new THREE.BoxGeometry(len * 0.35, 0.9, len * 0.26), M(cab)); b.position.set(-len * 0.2, 1.1, 0);
    g.add(a, b); g.traverse((o) => (o.castShadow = true)); SC.add(g); return g;
  };
  const ferry = ship(0xffffff, 0x2b7a9a, 4.2), cargo = ship(0x9b2f25, 0xf4f1ea, 7);
  for (let k = 0; k < 6; k++) { const cc = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.5), M([0xd2563c, 0x2f7fb0, 0xe2a23a][k % 3])); cc.position.set(-1.6 + (k % 3) * 1.1, 1, k < 3 ? -0.3 : 0.3); cargo.add(cc); }
  const fr = new THREE.CatmullRomCurve3([[16, 0, 95], [34, 0, 101], [56, 0, 98], [73, 0, 92]].map((a) => new THREE.Vector3(...a)));
  const cr = new THREE.CatmullRomCurve3([[-60, 0, -86], [-76, 0, -98], [-100, 0, -112], [-136, 0, -130]].map((a) => new THREE.Vector3(...a)));
  const boats = [];
  for (let k = 0; k < 6; k++) { const b = ship(0xf3efe6, 0xc8382a, 1.6); b.userData = { x: [58, 60, 96, 72, 102, -80][k], z: [-6, 10, 62, 100, 84, 40][k], p: k }; boats.push(b); }
  live.push((t) => {
    const f = Math.min(1, Math.max(0, (Math.sin(t * 0.05) + 1) / 2)), p = fr.getPointAt(f), q = fr.getTangentAt(f);
    ferry.position.set(p.x, 0, p.z); ferry.rotation.y = -Math.atan2(q.z, q.x);
    const g = (((t * 0.012) % 1) + 1) % 1, p2 = cr.getPointAt(g), q2 = cr.getTangentAt(g);
    cargo.position.set(p2.x, 0, p2.z); cargo.rotation.y = -Math.atan2(q2.z, q2.x);
    boats.forEach((b) => { const u = b.userData; b.position.set(u.x + Math.sin(t * 0.2 + u.p) * 2, Math.sin(t * 1.5 + u.p) * 0.08, u.z + Math.cos(t * 0.17 + u.p) * 2); b.rotation.y = t * 0.1 + u.p; });
  });
}
