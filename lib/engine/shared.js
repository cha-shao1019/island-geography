/* 引擎內部共用工具 */
import * as THREE from 'three';
import { hs } from '../terrain/terrain.js';

export const rnd = (i, s) => hs(i * 1.37 + s, s * 2.1 + i * 0.13);
export const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85 }, o));

/** 建立 InstancedMesh：fn 設定每個實例的位置／旋轉／縮放，colors 回傳每個實例顏色 */
export function inst(SC, list, geo, mat, fn, colors) {
  if (!list.length) return null;
  const m = new THREE.InstancedMesh(geo, mat, list.length), d = new THREE.Object3D(), c = new THREE.Color();
  list.forEach((p, i) => {
    d.position.set(0, 0, 0); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1);
    fn(d, p, i); d.updateMatrix(); m.setMatrixAt(i, d.matrix);
    if (colors) { c.setHex(colors(p, i)); m.setColorAt(i, c); }
  });
  m.castShadow = m.receiveShadow = true; SC.add(m); return m;
}

export const GL_NOISE = `float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);}`;

/** 沿地表鋪一條帶狀網格（河流、道路共用） */
export function ribbon(points, halfWidth, yOf, extra) {
  const p = [], uv = [], ix = [], ex = [];
  let L = 0;
  points.forEach((s, i) => {
    const a = points[Math.min(i + 1, points.length - 1)], b = points[Math.max(i - 1, 0)];
    const dx = a.x - b.x, dz = a.z - b.z, l = Math.hypot(dx, dz) || 1, w = halfWidth(s, i), nx = (-dz / l) * w, nz = (dx / l) * w;
    if (i > 0) L += Math.hypot(s.x - points[i - 1].x, s.z - points[i - 1].z);
    const y = yOf(s, i);
    p.push(s.x + nx, y, s.z + nz, s.x - nx, y, s.z - nz); uv.push(0, L / 4, 1, L / 4);
    if (extra) { const v = extra(s, i); ex.push(v, v); }
    if (i < points.length - 1) { const q = i * 2; ix.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); // 逆時針朝上，從上方才看得到 }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (extra) g.setAttribute('aSp', new THREE.Float32BufferAttribute(ex, 1));
  g.setIndex(ix); g.computeVertexNormals();
  return g;
}
