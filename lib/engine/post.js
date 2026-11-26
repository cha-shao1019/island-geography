/* 後製管線與天空
   桌機：場景 → GTAO 環境光遮蔽 → 光暈 → 輸出（色調映射＋sRGB）→ 移軸微縮 → 調色與暈影
   手機：場景 → 輸出（保持色彩一致，省掉昂貴效果） */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { HorizontalTiltShiftShader } from 'three/examples/jsm/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/examples/jsm/shaders/VerticalTiltShiftShader.js';

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uSat: { value: 1.08 }, uVig: { value: 0.18 } },
  vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: `uniform sampler2D tDiffuse;uniform float uSat;uniform float uVig;varying vec2 vUv;
void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,uSat);c=(c-.5)*1.04+.5;
float v=smoothstep(.95,.3,length((vUv-.5)*vec2(1.15,1.)));c*=mix(1.-uVig,1.,v);gl_FragColor=vec4(c,1.);}`,
};

export function buildPost(R, SC, CAM, lite) {
  const size = new THREE.Vector2(); R.getSize(size);
  const composer = new EffectComposer(R);
  composer.addPass(new RenderPass(SC, CAM));
  let gtao = null, bloom = null, th = null, tv = null;
  if (!lite) {
    gtao = new GTAOPass(SC, CAM, size.x, size.y, undefined,
      { radius: 2.2, distanceExponent: 1.4, thickness: 2.5, scale: 1.25, samples: 12, distanceFallOff: 1 },
      { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, radiusExponent: 1, rings: 2, samples: 12 });
    gtao.blendIntensity = 1;
    composer.addPass(gtao);
    bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.32, 0.55, 0.88);
    composer.addPass(bloom);
  }
  composer.addPass(new OutputPass());
  if (!lite) {
    th = new ShaderPass(HorizontalTiltShiftShader); tv = new ShaderPass(VerticalTiltShiftShader);
    composer.addPass(th); composer.addPass(tv);
    composer.addPass(new ShaderPass(GradeShader));
  }
  const api = {
    composer,
    setSize(w, h) {
      composer.setSize(w, h);
      gtao?.setSize?.(w, h);
      const amt = 1.1; // 移軸模糊強度（越大越像微縮模型）
      if (th) { th.uniforms.h.value = amt / w; th.uniforms.r.value = 0.5; }
      if (tv) { tv.uniforms.v.value = amt / h; tv.uniforms.r.value = 0.52; }
    },
    setTilt(k) { if (th) th.uniforms.h.value = (1.1 * k) / window.innerWidth; if (tv) tv.uniforms.v.value = (1.1 * k) / window.innerHeight; },
    render() { composer.render(); },
    dispose() { composer.dispose?.(); },
  };
  return api;
}

/* 天空穹頂：依太陽高度混合白天、黃昏、夜晚三組顏色，含太陽光暈與夜間星空 */
export function buildSky(SC) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uBot: { value: new THREE.Color() },
      uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(0xfff0d8) }, uDay: { value: 1 }, uNight: { value: 0 },
    },
    vertexShader: 'varying vec3 vDir;void main(){vDir=normalize(position);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}',
    fragmentShader: `uniform vec3 uTop;uniform vec3 uMid;uniform vec3 uBot;uniform vec3 uSun;uniform vec3 uSunCol;uniform float uDay;uniform float uNight;varying vec3 vDir;
void main(){vec3 d=normalize(vDir);float e=d.y;
vec3 c=mix(uMid,uTop,pow(clamp(e*1.4,0.,1.),.65));c=mix(uBot,c,smoothstep(-.04,.16,e));
float sd=max(dot(d,normalize(uSun)),0.);c+=uSunCol*(pow(sd,6.)*.25+pow(sd,48.)*.5)*(.35+.65*uDay);
c+=uSunCol*smoothstep(.9993,.9997,sd)*8.*step(-.02,uSun.y);
vec3 q=floor(d*260.);float h=fract(sin(dot(q,vec3(12.9898,78.233,37.719)))*43758.5453);c+=vec3(step(.9982,h))*uNight*1.8*smoothstep(0.,.25,e);
gl_FragColor=vec4(c,1.);}`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), mat);
  sky.renderOrder = -10; sky.frustumCulled = false; SC.add(sky);
  return sky;
}
