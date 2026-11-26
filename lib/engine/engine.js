/* 3D 引擎核心：渲染器、鏡頭（捲動驅動／探索拖曳）、標記定位、圖層切換。
   React 只透過 createEngine 回傳的 API 操作它；每幀的 DOM 更新（標記、卡片視差）在這裡直接做，避免重繪 React。 */
import * as THREE from 'three';
import { buildTerrain } from './terrain-mesh.js';
import { buildSea, buildRivers } from './water.js';
import { buildObjects, buildLife } from './world-objects.js';
import { buildFlows, buildOverlays, buildTyphoon } from './overlays.js';
import { resolve } from '../world.js';

const ease = (t) => t * t * (3 - 2 * t);

export function createEngine({ container, pinLayer, W, zones, sci, flows, cat, lite, onActive, onZonePin, onMarkerPin, onError, onProfile, onHour, onFlood, onTyphoon }) {
  const all = [...zones, ...sci];
  const report = (where, e) => { console.error(where, e); onError?.(`[${where}] ${e?.message || e}`); };
  const safe = (where, f) => (...a) => { try { return f(...a); } catch (e) { report(where, e); } };

  /* 視角：地理區以標記中心為目標，距離依標記分布 */
  const VIEWS = { all: [12, 0, 6, 300, -0.35, 0.86], link: [10, 0, 10, 280, -0.15, 0.72], end: [12, 0, 0, 330, 0.45, 0.95] };
  zones.forEach((z) => {
    const ps = z.m.map((m) => resolve(W, m[2])), xs = ps.map((p) => p[0]), zs = ps.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
    VIEWS[z.id] = [cx, Math.min(8, W.y(cx, cz)), cz, Math.max(48, span * 1.9 + 22), z.a[0], z.a[1]];
  });
  sci.forEach((z) => (VIEWS[z.id] = z.v));

  /* 渲染器與場景 */
  const R = new THREE.WebGLRenderer({ antialias: !lite, alpha: true, powerPreference: 'high-performance' });
  R.setPixelRatio(Math.min(lite ? 1.5 : 2, window.devicePixelRatio));
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 0.92;
  container.appendChild(R.domElement);
  const SC = new THREE.Scene(); SC.fog = new THREE.Fog(0xd3e6ee, 330, 900);
  const CAM = new THREE.PerspectiveCamera(38, 1, 1, 2000);
  const HEMI = new THREE.HemisphereLight(0xe8f4ff, 0x56664a, 1.5); SC.add(HEMI);
  const MOON = new THREE.DirectionalLight(0x9db8ff, 0); MOON.position.set(120, 160, -60); SC.add(MOON);
  const SUN = new THREE.DirectionalLight(0xfff1d8, 2.9);
  SUN.position.set(-120, 170, 80); SUN.castShadow = true; SUN.shadow.mapSize.set(lite ? 1024 : 2048, lite ? 1024 : 2048);
  Object.assign(SUN.shadow.camera, { left: -160, right: 160, top: 160, bottom: -160, near: 10, far: 500 });
  SUN.shadow.bias = -0.0008; SUN.shadow.camera.updateProjectionMatrix(); SC.add(SUN);

  const U = { mode: { value: 0 }, contour: { value: 0 }, time: { value: 0 }, sun: { value: new THREE.Vector3(-0.5, 0.8, 0.3).normalize() }, level: { value: 0 }, day: { value: 1 } };
  const FOG = { fogC: { value: new THREE.Color(0xd3e6ee) }, fogN: { value: 330 }, fogF: { value: 900 } };
  const ctx = { W, SC, U, FOG, SUN, G: {}, live: [], lite, season: 'winter', quakeAt: null, glow: [], nightOnly: [], hour: 10, onTyphoon };
  safe('terrain', buildTerrain)(ctx);
  safe('sea', buildSea)(ctx);
  safe('rivers', buildRivers)(ctx);
  safe('objects', buildObjects)(ctx);
  if (ctx.road) safe('life', buildLife)(ctx);
  safe('flows', buildFlows)(ctx, flows);
  safe('overlays', buildOverlays)(ctx);
  safe('typhoon', buildTyphoon)(ctx);
  const land = SC.children.find((o) => o.isMesh && o.geometry?.attributes?.aRock);

  /* ===== 日夜：太陽角度、天空、霧、燈光 ===== */
  const C = (h) => new THREE.Color(h), tmp = new THREE.Color(), tmp2 = new THREE.Color();
  const SKY = { day: [C(0x8fc1dc), C(0xc6dfea), C(0xd9e9ef)], dusk: [C(0x56709f), C(0xe99a6a), C(0xf3c891)], night: [C(0x070d1f), C(0x14223d), C(0x1d2f4c)] };
  const css = (c) => '#' + c.getHexString();
  function applyTime(h) {
    ctx.hour = h;
    const a = ((h - 6) / 12) * Math.PI, el = Math.sin(a), day = Math.min(1, Math.max(0, el * 1.6 + 0.15)), dusk = Math.max(0, 1 - Math.abs(el) * 3.2);
    SUN.position.set(-210 * Math.cos(a), Math.max(15, 220 * el), 80);
    SUN.intensity = 2.9 * day; SUN.color.copy(C(0xfff1d8)).lerp(C(0xff9a55), dusk * 0.8);
    HEMI.intensity = 0.3 + 1.2 * day; HEMI.color.copy(C(0x6d83b8)).lerp(C(0xe8f4ff), day);
    MOON.intensity = 0.55 * (1 - day);
    U.day.value = day; U.sun.value.copy(SUN.position).normalize();
    const sky = [0, 1, 2].map((i) => tmp2.copy(SKY.night[i]).lerp(SKY.day[i], day).lerp(SKY.dusk[i], dusk * 0.85).clone());
    container.style.background = `linear-gradient(${css(sky[0])} 0%,${css(sky[1])} 48%,${css(sky[2])} 62%)`;
    tmp.copy(sky[2]); FOG.fogC.value.copy(tmp); SC.fog.color.copy(tmp);
    ctx.glow.forEach(([m, k]) => (m.emissiveIntensity = (1 - day) * k));
    ctx.nightOnly.forEach((o) => (o.visible = day < 0.45));
  }
  applyTime(10);

  /* ===== 海平面與潮汐 ===== */
  let baseLevel = 0, tide = false;
  const landH = Float32Array.from(W.H.filter((h) => h > 0)).sort();
  function flood(level) {
    let lo = 0, hi = landH.length; while (lo < hi) { const m = (lo + hi) >> 1; if (landH[m] < level) lo = m + 1; else hi = m; }
    const names = []; zones.forEach((z) => z.m.forEach((m) => { const [x, zz] = resolve(W, m[2]); const h = W.h(x, zz); if (h > 0 && h < level && m[0] !== '地科') names.push(m[1]); }));
    onFlood?.({ pct: Math.round((lo / landH.length) * 1000) / 10, names });
  }

  /* ===== 剖面工具 ===== */
  let tool = null, picks = [], profLine = null, profPins = [];
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function clearProfile() {
    picks = []; if (profLine) { SC.remove(profLine); profLine.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); }); profLine = null; }
    profPins.forEach((p) => p.el.remove()); profPins = [];
  }
  function addProfPin(x, z, label) {
    const el = document.createElement('div'); el.className = 'pin on tool'; el.innerHTML = `<i></i>${label}`; el.style.setProperty('--c', '#c8382a'); pinLayer.appendChild(el);
    profPins.push({ el, on: true, p: new THREE.Vector3(x, Math.max(W.h(x, z), U.level.value) + 0.4, z) });
  }
  function pick(cx, cy) {
    const r = R.domElement.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, CAM); const hit = land && ray.intersectObject(land, false)[0]; if (!hit) return;
    if (picks.length >= 2) clearProfile();
    picks.push([hit.point.x, hit.point.z]); addProfPin(hit.point.x, hit.point.z, picks.length === 1 ? 'A' : 'B');
    if (picks.length === 2) {
      const [[ax, az], [bx, bz]] = picks, L = Math.hypot(bx - ax, bz - az), n = 120, pts = [], line = [];
      for (let i = 0; i <= n; i++) { const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, h = W.h(x, z); pts.push([t * L, h]); line.push(new THREE.Vector3(x, Math.max(h, U.level.value) + 0.35, z)); }
      profLine = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(line), 240, 0.4, 6), new THREE.MeshBasicMaterial({ color: 0xc8382a }));
      SC.add(profLine);
      onProfile?.({ pts, len: L, level: U.level.value });
    } else onProfile?.(null);
  }

  /* 標記 */
  const PINS = [];
  zones.forEach((z, zi) => {
    const el = document.createElement('button'); el.className = 'pin zone'; el.innerHTML = `<i></i>${zi + 1}・${z.short}`;
    el.onclick = () => onZonePin?.(z.id); pinLayer.appendChild(el);
    const v = VIEWS[z.id]; PINS.push({ el, zone: '*', p: new THREE.Vector3(v[0], W.y(v[0], v[2]) + 7, v[2]) });
  });
  all.forEach((z) => z.m.forEach((m, mi) => {
    const [x, zz] = resolve(W, m[2]), el = document.createElement('button');
    el.className = 'pin'; el.style.setProperty('--c', cat[m[0]]); el.innerHTML = `<i></i>${m[1]}`;
    el.onclick = () => onMarkerPin?.(z.id, mi); pinLayer.appendChild(el);
    PINS.push({ el, zone: z.id, cat: m[0], mi, p: new THREE.Vector3(x, W.y(x, zz) + 0.4, zz) });
  }));

  /* 狀態 */
  let mode = 'story', active = 'all', exZone = 'all', hot = null, cats = null;
  let cur = [...VIEWS.all], goal = [...VIEWS.all], off = [0, 0], clock = 0, last = performance.now(), raf = 0, shake = 0, autoDay = false, lastHourSent = 10;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function pinState() {
    const zone = mode === 'ex' ? exZone : active;
    PINS.forEach((p) => {
      const show = p.zone === '*' ? zone === 'all' || zone === 'end' : p.zone === zone && (mode !== 'ex' || !cats || cats[p.cat]);
      p.on = show; p.el.classList.toggle('on', show); if (!show) p.el.style.visibility = 'hidden';
      p.el.classList.toggle('hot', !!(hot && p.zone === hot[0] && p.mi === hot[1]));
    });
    if (ctx.G.flows) ctx.G.flows.visible = zone === 'link';
  }

  pinState();

  function size() { const w = container.clientWidth || window.innerWidth, h = container.clientHeight || window.innerHeight; R.setSize(w, h, false); CAM.aspect = w / h; CAM.fov = w < 700 ? 50 : 38; CAM.updateProjectionMatrix(); }
  window.addEventListener('resize', size); size();

  function scrollGoal() {
    const secs = [...document.querySelectorAll('[data-view]')]; if (!secs.length) return;
    const y = window.scrollY + window.innerHeight * 0.45; let i = 0;
    secs.forEach((s, k) => { if (s.offsetTop <= y) i = k; });
    const s = secs[i], t = Math.min(1, Math.max(0, (y - s.offsetTop) / s.offsetHeight)), nx = secs[Math.min(i + 1, secs.length - 1)];
    const a = VIEWS[s.dataset.view], b = VIEWS[nx.dataset.view]; if (!a || !b) return;
    const k = ease(Math.min(1, Math.max(0, (t - 0.55) / 0.45)));
    goal = a.map((v, j) => v + (b[j] - v) * k);
    const now = k > 0.5 ? nx.dataset.view : s.dataset.view;
    if (now !== active) { active = now; pinState(); onActive?.(active); }
  }
  function cards() {
    const vh = window.innerHeight;
    document.querySelectorAll('[data-parallax]').forEach((c) => {
      const r = c.getBoundingClientRect(), k = (r.top + r.height / 2 - vh / 2) / vh;
      c.style.opacity = reduce ? '1' : (1 - Math.min(1, Math.max(0, (Math.abs(k) - 0.32) / 0.4))).toFixed(3);
      if (!reduce) c.style.transform = `translateY(${(k * -46).toFixed(1)}px)`;
    });
  }
  function offGoal() {
    const w = window.innerWidth, h = window.innerHeight;
    if (mode === 'ex') return w < 900 ? [0, h * 0.2] : [54, 0];
    if (w < 900) return [0, h * 0.18];
    const i = all.findIndex((z) => z.id === active);
    if (i >= 0) return [i % 2 ? w * 0.16 : -w * 0.16, 0];
    return active === 'link' ? [-w * 0.14, 0] : [0, 0];
  }
  function camPos(v) {
    const [x, y, z, r, th, ph] = v, s = shake;
    CAM.position.set(x + r * Math.sin(ph) * Math.sin(th) + s * Math.sin(clock * 53), y + r * Math.cos(ph) + s * Math.sin(clock * 41), z + r * Math.sin(ph) * Math.cos(th));
    CAM.lookAt(x, y, z);
  }

  const V3 = new THREE.Vector3();
  const step = safe('loop', (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now; clock += dt; U.time.value = clock;
    if (mode === 'story') { scrollGoal(); cards(); }
    if (autoDay) { const h = (ctx.hour + dt * 0.4) % 24; applyTime(h); if (Math.abs(h - lastHourSent) > 0.24 || h < lastHourSent) { lastHourSent = h; onHour?.(Math.round(h * 4) / 4); } }
    const lvl = baseLevel + (tide ? 0.45 * Math.sin((clock * Math.PI * 2) / 14) : 0);
    if (lvl !== U.level.value) { U.level.value = lvl; if (ctx.sea) ctx.sea.position.y = lvl; }
    const k = reduce ? 1 : 0.07;
    cur = cur.map((v, j) => v + (goal[j] - v) * k);
    shake = ctx.quakeAt != null ? Math.max(0, 1.6 * Math.exp(-(clock - ctx.quakeAt) * 0.7) * (clock - ctx.quakeAt > 0.8 ? 1 : 0.35)) : 0;
    const og = offGoal(), w = window.innerWidth, h = window.innerHeight;
    off = off.map((v, j) => v + (og[j] - v) * k);
    CAM.setViewOffset(w, h, off[0], off[1], w, h);
    camPos(cur);
    ctx.live.forEach((f, i) => { try { f(clock, dt); } catch (e) { report('anim' + i, e); ctx.live[i] = () => {}; } });
    R.render(SC, CAM);
    [...PINS, ...profPins].forEach((p) => {
      if (!p.on) return;
      V3.copy(p.p).project(CAM);
      p.el.style.visibility = V3.z < 1 && Math.abs(V3.x) < 1.1 && Math.abs(V3.y) < 1.1 ? 'visible' : 'hidden';
      p.el.style.transform = `translate(${((V3.x * 0.5 + 0.5) * w).toFixed(1)}px,${((-V3.y * 0.5 + 0.5) * h - 16).toFixed(1)}px) translate(-50%,-100%)`;
    });
  });
  const loop = (now) => { step(now); raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);

  /* 探索模式拖曳 */
  const pts = new Map(); let lastP = null;
  const el = R.domElement;
  el.style.touchAction = 'pan-y'; // 導覽模式讓手指在背景上也能捲動
  let downAt = null;
  const down = (e) => { if (mode !== 'ex') return; pts.set(e.pointerId, [e.clientX, e.clientY]); lastP = [e.clientX, e.clientY]; downAt = pts.size === 1 ? [e.clientX, e.clientY] : null; el.setPointerCapture(e.pointerId); };
  const move = (e) => {
    if (!pts.has(e.pointerId)) return;
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d0 = Math.hypot(a[0] - b[0], a[1] - b[1]); pts.set(e.pointerId, [e.clientX, e.clientY]);
      const [c, d] = [...pts.values()], d1 = Math.hypot(c[0] - d[0], c[1] - d[1]); goal[3] = Math.min(420, Math.max(18, (goal[3] * d0) / d1)); return;
    }
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    goal[4] -= (e.clientX - lastP[0]) * 0.006; goal[5] = Math.min(1.35, Math.max(0.12, goal[5] - (e.clientY - lastP[1]) * 0.005)); lastP = [e.clientX, e.clientY];
  };
  const up = (e) => { if (tool === 'profile' && downAt && pts.size === 1 && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 6) pick(e.clientX, e.clientY); downAt = null; pts.delete(e.pointerId); };
  const wheel = (e) => { if (mode !== 'ex') return; e.preventDefault(); goal[3] = Math.min(420, Math.max(18, goal[3] * (1 + e.deltaY * 0.0012))); };
  el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', wheel, { passive: false });

  /* 對外 API */
  return {
    views: VIEWS,
    setMode(m) { mode = m; el.style.touchAction = m === 'ex' ? 'none' : 'pan-y'; if (m === 'story') active = ''; pinState(); },
    setZone(id) { exZone = id; hot = null; if (VIEWS[id]) goal = [...VIEWS[id]]; pinState(); },
    setCats(c) { cats = c; pinState(); },
    focus(zid, i) {
      const z = all.find((q) => q.id === zid), same = hot && hot[0] === zid && hot[1] === i;
      hot = same ? null : [zid, i];
      if (same) goal = [...VIEWS[zid]];
      else { const [x, zz] = resolve(W, z.m[i][2]); goal = [x, W.y(x, zz), zz, z.sci ? Math.min(120, VIEWS[zid][3] * 0.6) : Math.max(26, VIEWS[zid][3] * 0.5), goal[4], Math.min(Math.max(goal[5], 0.5), 0.95)]; }
      pinState();
      return !same;
    },
    setLayers(L) {
      U.mode.value = L.mode; U.contour.value = L.contour;
      if (ctx.G.wind) ctx.G.wind.visible = !!L.wind;
      if (ctx.G.current) ctx.G.current.visible = !!L.current;
      if (ctx.G.plate) ctx.G.plate.visible = !!L.plate;
    },
    setSeason(s) { ctx.season = s; },
    setTool(t) { tool = t; el.style.cursor = t ? 'crosshair' : ''; if (!t) { clearProfile(); onProfile?.(null); } },
    clearProfile() { clearProfile(); onProfile?.(null); },
    setHour(h) { if (Math.abs(h - ctx.hour) > 0.01) applyTime(h); },
    setAutoDay(b) { autoDay = b; lastHourSent = ctx.hour; },
    setSeaLevel(v) { baseLevel = v; flood(v); },
    setTide(b) { tide = b; },
    typhoon() { ctx.startTyphoon?.(clock); if (mode === 'ex') goal = [0, 0, 0, 430, 0.35, 0.68]; },
    quake() { ctx.quakeAt = clock; },
    dispose() {
      cancelAnimationFrame(raf); window.removeEventListener('resize', size);
      el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.removeEventListener('wheel', wheel);
      PINS.forEach((p) => p.el.remove());
      SC.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => x.dispose?.()); });
      R.dispose(); R.domElement.remove();
    },
  };
}
