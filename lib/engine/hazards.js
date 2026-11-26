/* 災害效應：豪雨（河川暴漲、泥水）、山崩與土石流、低窪淹水、暴潮、地震引發的山崩與海嘯。
   由颱風與地震觸發，以 ctx.hz 狀態驅動；UI 透過 ctx.onHazard 取得目前發生中的災害清單。 */
import * as THREE from 'three';
import { rnd } from './shared.js';
import { HALF, SZ } from '../terrain/terrain.js';

export function buildHazards(ctx) {
  const { W, SC, U, live } = ctx;
  const hz = (ctx.hz = { rain: 0, flood: 0, surge: 0, slides: [], active: new Set() });

  /* 山崩候選點：陡坡 */
  const sites = [];
  for (let i = 0; i < 9000 && sites.length < 60; i++) {
    const x = (rnd(i, 31) - 0.5) * 240, z = (rnd(i, 32) - 0.5) * 240, h = W.h(x, z);
    if (h < 9 || h > 42 || W.slope(x, z) < 1.25) continue;
    const gx = W.h(x + 1, z) - W.h(x - 1, z), gz = W.h(x, z + 1) - W.h(x, z - 1), l = Math.hypot(gx, gz) || 1;
    sites.push({ x, z, dx: -gx / l, dz: -gz / l, t: -1 });
  }
  const scarMat = new THREE.MeshStandardMaterial({ color: 0x8b6a45, roughness: 1, transparent: true, opacity: 0, polygonOffset: true, polygonOffsetFactor: -2 });
  const scars = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6), scarMat, sites.length), d = new THREE.Object3D();
  scars.receiveShadow = true; SC.add(scars);
  const NB = 260, boulders = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.35, 0), new THREE.MeshStandardMaterial({ color: 0x6d5236, roughness: 1 }), NB);
  boulders.castShadow = true; SC.add(boulders);
  const rocks = Array.from({ length: NB }, () => ({ x: 0, z: 0, life: 0 }));

  function trigger(filter, n) {
    const cand = sites.filter((s) => s.t < 0 && filter(s));
    for (let k = 0; k < Math.min(n, cand.length); k++) { const s = cand[Math.floor(Math.random() * cand.length)]; if (s.t < 0) s.t = 0; }
  }
  ctx.triggerSlides = trigger;

  /* 低窪淹水面：只覆蓋陸上低地的網格，水位升起後由地形切出淹水範圍 */
  const N = 120, step = SZ / N, pos = [], idx = [];
  const ok = (x, z) => { const h = W.h(x, z); return h > 0.25 && h < 5.5; };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -HALF + i * step, z = -HALF + j * step;
    if (!ok(x + step / 2, z + step / 2)) continue;
    const b = pos.length / 3; pos.push(x, 0, z, x + step, 0, z, x, 0, z + step, x + step, 0, z + step); idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
  }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setIndex(idx); fg.computeVertexNormals();
  const floodMesh = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ color: 0x8c7352, roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.86 }));
  floodMesh.visible = false; SC.add(floodMesh);

  /* 海嘯：由震央向外擴散的隆起水環 */
  const wave = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 8, 120), new THREE.MeshStandardMaterial({ color: 0xdff3f7, roughness: 0.2, transparent: true, opacity: 0.85 }));
  wave.rotation.x = -Math.PI / 2; wave.visible = false; SC.add(wave);

  const report = () => ctx.onHazard?.([...hz.active]);
  const setOn = (k, on) => { if (on && !hz.active.has(k)) { hz.active.add(k); report(); } else if (!on && hz.active.has(k)) { hz.active.delete(k); report(); } };

  live.push((t, dt) => {
    /* 颱風驅動：登陸後豪雨增強；靠近海岸時暴潮 */
    const ty = ctx.typhoonAt != null, near = ty && ctx.tyPos && Math.hypot(ctx.tyPos.x, ctx.tyPos.z * 0.6) < 110;
    const rainTarget = ty && near ? 1 : 0;
    hz.rain += (rainTarget - hz.rain) * Math.min(1, dt * (rainTarget ? 0.35 : 0.12));
    hz.flood += ((hz.rain > 0.55 ? 1 : 0) - hz.flood) * Math.min(1, dt * (hz.rain > 0.55 ? 0.12 : 0.06));
    hz.surge += ((ty && near && ctx.tyStage !== 'weak' ? 1 : 0) - hz.surge) * Math.min(1, dt * 0.4);
    if (ty && ctx.tyStage === 'land' && rnd(Math.floor(t * 3), 5) > 0.7) {
      const p = ctx.tyPos; trigger((s) => Math.hypot(s.x - p.x, s.z - p.z) < 55 && s.dx * 0.7 + s.dz * 0.7 > -0.2, 1); // 迎風（東南側）坡優先
    }
    U.mud.value = Math.min(1, hz.rain * 1.1);
    ctx.surge = hz.surge * 0.8 + (ctx.tsunami ? ctx.tsunami : 0);
    floodMesh.visible = hz.flood > 0.02; floodMesh.position.y = 0.3 + hz.flood * 3.0;
    setOn('rain', hz.rain > 0.3); setOn('flood', hz.flood > 0.25); setOn('surge', hz.surge > 0.3);

    /* 山崩：崩塌痕逐漸擴大、落石沿坡面滾落 */
    let anySlide = false;
    sites.forEach((s, i) => {
      if (s.t >= 0) { s.t += dt; anySlide = anySlide || s.t < 12; }
      const k = s.t < 0 ? 0 : Math.min(1, s.t / 3), fade = s.t > 40 ? Math.max(0, 1 - (s.t - 40) / 20) : 1;
      if (s.t > 60) s.t = -1;
      const len = 1.5 + k * 4;
      d.position.set(s.x + s.dx * len * 0.5, W.h(s.x + s.dx * len * 0.5, s.z + s.dz * len * 0.5) + 0.1, s.z + s.dz * len * 0.5);
      d.rotation.set(0, -Math.atan2(s.dz, s.dx), 0); const sc = k * fade; d.scale.set(len * sc, 0.25 * sc, 1.6 * sc); d.updateMatrix(); scars.setMatrixAt(i, d.matrix);
      if (s.t >= 0 && s.t < 6 && rnd(i, Math.floor(t * 20)) > 0.6) { const r = rocks.find((q) => q.life <= 0); if (r) Object.assign(r, { x: s.x + (rnd(i, t) - 0.5) * 2, z: s.z + (rnd(i, t + 1) - 0.5) * 2, life: 5, s }); }
    });
    scars.instanceMatrix.needsUpdate = true; scarMat.opacity = 0.95;
    rocks.forEach((r, i) => {
      if (r.life > 0) {
        r.life -= dt; const gx = W.h(r.x + 0.6, r.z) - W.h(r.x - 0.6, r.z), gz = W.h(r.x, r.z + 0.6) - W.h(r.x, r.z - 0.6), l = Math.hypot(gx, gz) || 1, v = Math.min(9, 3 + l * 3);
        r.x -= (gx / l) * v * dt; r.z -= (gz / l) * v * dt;
        if (W.h(r.x, r.z) < 0.3) r.life = 0;
      }
      const sc = r.life > 0 ? 1 : 0; d.position.set(r.x, W.h(r.x, r.z) + 0.3, r.z); d.rotation.set(t * 3 + i, t * 2, 0); d.scale.set(sc, sc, sc); d.updateMatrix(); boulders.setMatrixAt(i, d.matrix);
    });
    boulders.instanceMatrix.needsUpdate = true;
    setOn('slide', anySlide);

    /* 海嘯環 */
    if (ctx.tsunamiAt != null) {
      const e = t - ctx.tsunamiAt;
      if (e > 14) { ctx.tsunamiAt = null; wave.visible = false; ctx.tsunami = 0; setOn('tsunami', false); }
      else {
        const R = 4 + e * 11; wave.visible = true; wave.position.set(60, 0.25 + (U.level.value || 0), -8); wave.scale.set(R, R, 1 + 30 * Math.max(0, 1 - e / 14));
        ctx.tsunami = Math.max(0, Math.sin(Math.min(1, Math.max(0, (e - 3) / 8)) * Math.PI)) * 0.9; setOn('tsunami', true);
      }
    }
  });

  ctx.quakeEffects = (t) => {
    trigger((s) => Math.hypot(s.x - 40, s.z + 8) < 60, 10);
    ctx.tsunamiAt = t;
  };
}
