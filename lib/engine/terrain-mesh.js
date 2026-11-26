/* 地形網格：頂點色＋著色器圖層（分層設色、岩性、等高線） */
import * as THREE from 'three';
import { colorAt, spineX, ISLET, ISR, HALF, SZ } from '../terrain/terrain.js';

export function rockCode(x, z, h) {
  const rI = Math.hypot(x - ISLET[0], z - ISLET[1]);
  if (rI < ISR * 1.02) return 3;           // 火成岩
  if (rI < ISR * 1.3 && h < 0) return 4;   // 珊瑚礁石灰岩
  if (h <= 0) return 5;                    // 海底沉積物
  if (h < 6.5) return 0;                   // 沖積層
  if (h < 20 && x < spineX(z) - 4) return 1; // 沉積岩
  return 2;                                // 變質岩
}

export function buildTerrain(ctx) {
  const { W, SC, U } = ctx, N = W.N, n1 = W.n1;
  const pos = new Float32Array(n1 * n1 * 3), col = new Float32Array(n1 * n1 * 3), rock = new Float32Array(n1 * n1), idx = new Uint32Array(N * N * 6);
  let q = 0;
  for (let j = 0; j < n1; j++) for (let i = 0; i < n1; i++) {
    const k = j * n1 + i, x = -HALF + (SZ * i) / N, z = -HALF + (SZ * j) / N, h = W.H[k];
    pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
    const c = colorAt(x, z, h, W.slope(x, z)); col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2];
    rock[k] = rockCode(x, z, h);
    if (i < N && j < N) { idx[q++] = k; idx[q++] = k + n1; idx[q++] = k + 1; idx[q++] = k + 1; idx[q++] = k + n1; idx[q++] = k + n1 + 1; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aRock', new THREE.BufferAttribute(rock, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uMode = U.mode; sh.uniforms.uContour = U.contour;
    sh.vertexShader = 'attribute float aRock;\nvarying float vH;\nvarying float vRock;\n' +
      sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvH=position.y;vRock=aRock;');
    sh.fragmentShader = `uniform float uMode;uniform float uContour;varying float vH;varying float vRock;
vec3 hyp(float h){if(h<0.)return mix(vec3(.72,.89,.94),vec3(.16,.37,.55),clamp(-h/17.,0.,1.));vec3 c=mix(vec3(.37,.62,.35),vec3(.65,.77,.42),smoothstep(0.,4.,h));c=mix(c,vec3(.91,.85,.54),smoothstep(4.,10.,h));c=mix(c,vec3(.84,.64,.36),smoothstep(10.,20.,h));c=mix(c,vec3(.66,.45,.25),smoothstep(20.,32.,h));return mix(c,vec3(.96,.94,.9),smoothstep(38.,48.,h));}
vec3 rockC(float r){if(r<.5)return vec3(.95,.87,.6);if(r<1.5)return vec3(.79,.6,.36);if(r<2.5)return vec3(.55,.5,.68);if(r<3.5)return vec3(.45,.24,.18);if(r<4.5)return vec3(.97,.96,.92);return vec3(.62,.78,.82);}
` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
if(uMode>.5&&uMode<1.5)diffuseColor.rgb=pow(hyp(vH),vec3(1.6));
if(uMode>1.5)diffuseColor.rgb=pow(rockC(vRock),vec3(1.6));
if(uContour>.5){float c=vH/2.;float f=abs(fract(c-.5)-.5);float w=fwidth(c);float ln=1.-smoothstep(w*.5,w*1.5,f);
 float cm=vH/10.;float fm=abs(fract(cm-.5)-.5);float wm=fwidth(cm);float lm=1.-smoothstep(wm*.7,wm*2.2,fm);
 vec3 lc=vH>0.?vec3(.25,.13,.05):vec3(.08,.2,.4);diffuseColor.rgb=mix(diffuseColor.rgb,lc,clamp(max(ln*.6,lm*.95),0.,1.));}`);
  };
  const land = new THREE.Mesh(g, mat);
  land.receiveShadow = land.castShadow = true;
  SC.add(land);
  const deep = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshBasicMaterial({ color: 0x1b4b66 }));
  deep.rotation.x = -Math.PI / 2; deep.position.y = -17.4; SC.add(deep);
}
