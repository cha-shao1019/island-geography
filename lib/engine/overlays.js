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

/* 颱風：逆時針旋轉的螺旋雲帶，從東南方海面往西北移動，越過山脈後減弱 */
export function buildTyphoon(ctx) {
  const { W, SC, live } = ctx;
  const g = new THREE.Group(); g.visible = false; SC.add(g);
  const puffs = [];
  for (let arm = 0; arm < 3; arm++) for (let k = 0; k < 70; k++) {
    const r = 5 + k * 0.55, a = arm * 2.094 + k * 0.11 + rnd(k, arm) * 0.25;
    puffs.push([Math.cos(a) * r, rnd(k, arm + 9) * 2, Math.sin(a) * r, 1.6 + (1 - k / 70) * 2.2 + rnd(k, arm + 3)]);
  }
  for (let k = 0; k < 40; k++) { const a = (k / 40) * 6.283; puffs.push([Math.cos(a) * 6, 1.5, Math.sin(a) * 6, 3.2]); } // 眼牆
  const m = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf2f4f7, transparent: true, opacity: 0.9, roughness: 1 }), puffs.length), d = new THREE.Object3D();
  puffs.forEach(([x, y, z, s], i) => { d.position.set(x, y, z); d.scale.set(s, s * 0.55, s); d.updateMatrix(); m.setMatrixAt(i, d.matrix); });
  const spin = new THREE.Group(); spin.add(m); g.add(spin);
  const rain = new THREE.Mesh(new THREE.CylinderGeometry(30, 34, 26, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0x5f7d96, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
  rain.position.y = -13; g.add(rain);
  const path = new THREE.CatmullRomCurve3([[150, 140], [70, 70], [10, 0], [-60, -70], [-160, -150]].map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const DUR = 28;
  live.push((t, dt) => {
    if (ctx.typhoonAt == null) { g.visible = false; return; }
    const e = t - ctx.typhoonAt;
    if (e > DUR) { ctx.typhoonAt = null; g.visible = false; ctx.onTyphoon?.('end'); return; }
    const u = e / DUR, p = path.getPointAt(Math.min(1, u));
    const overLand = W.h(p.x, p.z) > 2, past = p.x < W.F.faultAt(p.z)[0] - 22;
    ctx.tyStrength = Math.max(0.45, (ctx.tyStrength ?? 1) - (past ? dt * 0.06 : 0));
    const grow = Math.min(1, e / 3), s = grow * ctx.tyStrength;
    g.visible = true; g.position.set(p.x, 30, p.z); g.scale.set(s, s, s);
    spin.rotation.y += dt * 1.1; // 由上往下看為逆時針（北半球）
    const stage = past ? 'weak' : overLand ? 'land' : 'sea';
    if (stage !== ctx.tyStage) { ctx.tyStage = stage; ctx.onTyphoon?.(stage); }
  });
  ctx.startTyphoon = (t) => { ctx.typhoonAt = t; ctx.tyStrength = 1; ctx.tyStage = null; };
}
