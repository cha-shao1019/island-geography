/* 圖層：交互關係光點、季風粒子與雲雨、洋流、板塊與斷層、地震波 */
import * as THREE from 'three';
import { rnd } from './shared.js';
import { resolve } from '../world.js';

function arrowsAlong(ctx, curve, color, n, speed, size) {
  const g = new THREE.Group(), geo = new THREE.ConeGeometry(0.9 * size, 2.6 * size, 8); geo.rotateZ(-Math.PI / 2);
  const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color }), n), d = new THREE.Object3D();
  g.add(m, new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.5 * size, 6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 })));
  ctx.live.push((t) => {
    if (!g.parent || !g.parent.visible) return;
    for (let i = 0; i < n; i++) {
      const u = (((i / n + t * speed) % 1) + 1) % 1, p = curve.getPointAt(u), q = curve.getTangentAt(u);
      d.position.copy(p); d.rotation.set(0, -Math.atan2(q.z, q.x), 0); d.updateMatrix(); m.setMatrixAt(i, d.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return g;
}

export function buildFlows(ctx, flows) {
  const { W, SC, G } = ctx;
  G.flows = new THREE.Group(); G.flows.visible = false; SC.add(G.flows);
  flows.forEach((f, fi) => {
    const pts = f.pts.map((p) => resolve(W, p));
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, z], i) => new THREE.Vector3(x, W.y(x, z) + 4 + (i > 0 && i < pts.length - 1 ? 10 : 0), z)));
    G.flows.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.35, 6), new THREE.MeshBasicMaterial({ color: f.c, transparent: true, opacity: 0.45 })));
    const dots = [];
    for (let k = 0; k < 7; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 12), new THREE.MeshBasicMaterial({ color: f.c })); G.flows.add(s); dots.push(s); }
    ctx.live.push((t) => { if (!G.flows.visible) return; dots.forEach((d, k) => d.position.copy(curve.getPointAt((((t * 0.08 + k / 7 + fi * 0.13) % 1) + 1) % 1))); });
  });
}

export function buildOverlays(ctx) {
  const { W, SC, G, live } = ctx;
  /* 季風粒子 */
  const NW = ctx.lite ? 220 : 380, geo = new THREE.ConeGeometry(0.45, 1.8, 6); geo.rotateZ(-Math.PI / 2);
  const wm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }), wind = new THREE.InstancedMesh(geo, wm, NW), d = new THREE.Object3D();
  const P = []; for (let i = 0; i < NW; i++) P.push({ x: (rnd(i, 90) - 0.5) * 300, z: (rnd(i, 91) - 0.5) * 300, y: 10 });
  G.wind = new THREE.Group(); G.wind.add(wind); SC.add(G.wind);
  /* 迎風坡的雲與雨 */
  const cloud = (x, z) => {
    const g = new THREE.Group();
    for (let k = 0; k < 6; k++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(3 + rnd(k, x) * 2.5, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf4f6f8, transparent: true, opacity: 0.92, roughness: 1 }));
      s.position.set((rnd(k, z) - 0.5) * 10, rnd(k, x + z) * 2, (rnd(k, x - z) - 0.5) * 7); g.add(s);
    }
    const rain = new THREE.Mesh(new THREE.CylinderGeometry(5, 6, 22, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x6f8fa8, transparent: true, opacity: 0.18, depthWrite: false }));
    rain.position.y = -11; g.add(rain); g.position.set(x, W.y(x, z) + 24, z); return g;
  };
  G.cloudW = new THREE.Group(); [[22, -82], [34, -62], [8, -96]].forEach((p) => G.cloudW.add(cloud(...p)));
  G.cloudS = new THREE.Group(); [[-6, 26], [4, 6], [-10, 46]].forEach((p) => G.cloudS.add(cloud(...p)));
  G.wind.add(G.cloudW, G.cloudS);
  live.push((t, dt) => {
    if (!G.wind.visible) return;
    const winter = ctx.season === 'winter', dir = winter ? [-0.72, 0.69] : [0.72, -0.69];
    wm.color.setHex(winter ? 0xeaf4ff : 0xffe2b8); G.cloudW.visible = winter; G.cloudS.visible = !winter;
    P.forEach((p, i) => {
      p.x += dir[0] * dt * 22; p.z += dir[1] * dt * 22;
      if (Math.abs(p.x) > 168 || Math.abs(p.z) > 168) { const o = (rnd(i, t % 97) - 0.5) * 210; p.x = -dir[0] * 125 - dir[1] * o; p.z = -dir[1] * 125 + dir[0] * o; }
      p.y += (W.y(p.x, p.z) + 7 - p.y) * Math.min(1, dt * 2);
      d.position.set(p.x, p.y, p.z); d.rotation.set(0, -Math.atan2(dir[1], dir[0]), 0); d.scale.set(1, 1, 1); d.updateMatrix(); wind.setMatrixAt(i, d.matrix);
    });
    wind.instanceMatrix.needsUpdate = true;
  });
  /* 洋流 */
  G.current = new THREE.Group(); SC.add(G.current);
  const curve = (pts) => new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0.8, z)));
  G.current.add(
    arrowsAlong(ctx, curve([[86, 150], [74, 70], [70, -10], [80, -80], [70, -150]]), 0xe0573e, 26, 0.025, 1.4),
    arrowsAlong(ctx, curve([[-70, -150], [-92, -70], [-100, 10], [-92, 90], [-74, 150]]), 0x3aa0d8, 26, 0.02, 1.4),
  );
  /* 板塊與斷層 */
  G.plate = new THREE.Group(); SC.add(G.plate);
  const pb = new THREE.CatmullRomCurve3([[66, -150], [63, -60], [67, 0], [72, 60], [70, 150]].map(([x, z]) => new THREE.Vector3(x, 0.6, z)));
  G.plate.add(new THREE.Mesh(new THREE.TubeGeometry(pb, 200, 0.8, 8), new THREE.MeshBasicMaterial({ color: 0xc8382a })));
  const tg = new THREE.ConeGeometry(1.6, 3.2, 3); tg.rotateZ(Math.PI / 2);
  const tm = new THREE.InstancedMesh(tg, new THREE.MeshBasicMaterial({ color: 0xc8382a }), 41), d2 = new THREE.Object3D();
  for (let i = 0; i <= 40; i++) { const p = pb.getPointAt(i / 40); d2.position.set(p.x - 2.2, 0.6, p.z); d2.updateMatrix(); tm.setMatrixAt(i, d2.matrix); }
  G.plate.add(tm);
  const fl = []; for (let z = -70; z <= 70; z += 2) { const [x] = W.F.faultAt(z); fl.push(new THREE.Vector3(x, W.h(x, z) + 0.4, z)); }
  G.plate.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(fl), 200, 0.35, 6), new THREE.MeshBasicMaterial({ color: 0xff6a4d })));
  const ep = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 12), new THREE.MeshBasicMaterial({ color: 0xc8382a })); ep.position.set(60, 0.9, -8); G.plate.add(ep);
  /* 地震波：藍＝P 波、紅＝S 波 */
  const ring = (c) => { const m = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 96), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.set(60, 0.9, -8); m.visible = false; SC.add(m); return m; };
  G.pw = ring(0x3aa0d8); G.sw = ring(0xe0573e);
  live.push((t) => {
    if (ctx.quakeAt == null) return;
    const e = t - ctx.quakeAt;
    if (e > 9) { G.pw.visible = G.sw.visible = false; ctx.quakeAt = null; return; }
    G.pw.visible = G.sw.visible = true;
    G.pw.scale.set(e * 26, e * 26, 1); G.sw.scale.set(e * 15, e * 15, 1);
    G.pw.material.opacity = G.sw.material.opacity = Math.max(0, 1 - e / 9);
  });
}

/* 颱風：立體結構——颱風眼、高聳眼牆、向內旋入的螺旋雨帶、頂部外流雲；
   中心高度高於最高山（約 60），北半球逆時針旋轉，越過山脈後強度減弱 */
export function buildTyphoon(ctx) {
  const { W, SC, live } = ctx;
  const g = new THREE.Group(); g.visible = false; SC.add(g);
  const puffs = [];
  // 眼牆：環狀高聳積雨雲（高 0～18）
  for (let k = 0; k < 90; k++) { const a = (k / 90) * 6.283 + rnd(k, 1) * 0.1, r = 7 + rnd(k, 2) * 2.5; puffs.push([Math.cos(a) * r, 4 + rnd(k, 3) * 14, Math.sin(a) * r, 3 + rnd(k, 4) * 2.2]); }
  // 中央密雲區
  for (let k = 0; k < 110; k++) { const a = rnd(k, 5) * 6.283, r = 10 + rnd(k, 6) * 12; puffs.push([Math.cos(a) * r, 2 + rnd(k, 7) * 9 * (1 - (r - 10) / 14), Math.sin(a) * r, 3.4 + rnd(k, 8) * 2]); }
  // 螺旋雨帶：對數螺旋，由外向內逆時針旋入
  for (let arm = 0; arm < 4; arm++) for (let k = 0; k < 70; k++) {
    const u = k / 70, r = 20 + u * 44, a = arm * 1.571 - Math.log(r / 20) * 2.2 + rnd(k, arm + 9) * 0.12;
    puffs.push([Math.cos(a) * r, 1 + rnd(k, arm + 11) * 6 * (1 - u), Math.sin(a) * r, 2.2 + (1 - u) * 2.2 + rnd(k, arm + 13)]);
  }
  const mat = new THREE.MeshStandardMaterial({ color: 0xf3f5f8, roughness: 1, transparent: true, opacity: 0.94 });
  const m = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat, puffs.length), d = new THREE.Object3D(), c = new THREE.Color();
  puffs.forEach(([x, y, z, s], i) => { d.position.set(x, y, z); d.scale.set(s * 1.3, s * 0.8, s * 1.3); d.rotation.set(rnd(i, 20), rnd(i, 21) * 6, 0); d.updateMatrix(); m.setMatrixAt(i, d.matrix); c.setScalar(0.78 + 0.22 * Math.min(1, y / 12)); m.setColorAt(i, c); });
  m.castShadow = true;
  const spin = new THREE.Group(); spin.add(m); g.add(spin);
  // 頂部外流卷雲（半透明薄盤）
  const cap = new THREE.Mesh(new THREE.RingGeometry(9, 58, 64, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
  cap.rotation.x = -Math.PI / 2; cap.position.y = 20; void cap; // 外流雲盤視覺上像平板，先不加入
  // 雨幕：眼牆下最強，往外變弱
  const rainMat = new THREE.MeshBasicMaterial({ color: 0x5c768d, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
  const rain1 = new THREE.Mesh(new THREE.CylinderGeometry(11, 13, 60, 40, 1, true), rainMat); rain1.position.y = -28;
  const rain2 = new THREE.Mesh(new THREE.CylinderGeometry(30, 36, 60, 48, 1, true), rainMat.clone()); rain2.material.opacity = 0.1; rain2.position.y = -28;
  g.add(rain1, rain2);
  const path = new THREE.CatmullRomCurve3([[170, 150], [80, 75], [12, 4], [-60, -70], [-170, -160]].map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const DUR = 32;
  live.push((t, dt) => {
    if (ctx.typhoonAt == null) { g.visible = false; return; }
    const e = t - ctx.typhoonAt;
    if (e > DUR) { ctx.typhoonAt = null; g.visible = false; ctx.onTyphoon?.('end'); return; }
    const p = path.getPointAt(Math.min(1, e / DUR));
    const overLand = W.h(p.x, p.z) > 2, past = p.x < W.F.faultAt(p.z)[0] - 22;
    ctx.tyStrength = Math.max(0.5, (ctx.tyStrength ?? 1) - (past ? dt * 0.05 : overLand ? dt * 0.012 : 0));
    const s = Math.min(1, e / 3) * (0.55 + 0.45 * ctx.tyStrength);
    g.visible = true; g.position.set(p.x, 62, p.z); g.scale.set(s, s, s);
    spin.rotation.y += dt * (0.5 + 0.7 * ctx.tyStrength); // 由上往下看為逆時針（北半球）
    ctx.tyPos = p; ctx.tyR = 40 * s;
    const stage = past ? 'weak' : overLand ? 'land' : 'sea';
    if (stage !== ctx.tyStage) { ctx.tyStage = stage; ctx.onTyphoon?.(stage); }
  });
  ctx.startTyphoon = (t) => { ctx.typhoonAt = t; ctx.tyStrength = 1; ctx.tyStage = null; };
}
