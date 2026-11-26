/* 水體：海（依水深上色、波光、岸邊浪花）、河流與湖泊（沿流向流動） */
import * as THREE from 'three';
import { GL_NOISE, ribbon } from './shared.js';
import { OX, ISLET, mix } from '../terrain/terrain.js';

export function buildSea(ctx) {
  const { W, SC, U, FOG, SUN } = ctx, n1 = W.n1, data = new Uint8Array(n1 * n1 * 4);
  for (let k = 0; k < n1 * n1; k++) { data[k * 4] = Math.round(Math.min(1, Math.max(0, -W.H[k] / 18)) * 255); data[k * 4 + 3] = 255; }
  const tex = new THREE.DataTexture(data, n1, n1, THREE.RGBAFormat);
  tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  const m = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: Object.assign({ uTime: U.time, uDepth: { value: tex }, uSun: { value: SUN.position.clone().normalize() } }, FOG),
    vertexShader: `varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `uniform float uTime;uniform sampler2D uDepth;uniform vec3 uSun;uniform vec3 fogC;uniform float fogN;uniform float fogF;varying vec3 vW;
${GL_NOISE}
float wav(vec2 p){float t=uTime;return noise(p*.16+vec2(t*.06,t*.035))*.5+noise(p*.42+vec2(-t*.11,t*.08))*.3+noise(p*1.05+vec2(t*.2,-t*.15))*.2;}
void main(){vec2 p=vW.xz;float e=.35;float h0=wav(p),hx=wav(p+vec2(e,0.)),hz=wav(p+vec2(0.,e));
vec3 N=normalize(vec3((h0-hx)/e*1.6,1.,(h0-hz)/e*1.6));
vec2 uv=(p+140.)/280.;float d=18.;if(uv.x>0.&&uv.x<1.&&uv.y>0.&&uv.y<1.)d=texture2D(uDepth,uv).r*18.;
vec3 V=normalize(cameraPosition-vW);float fr=.04+.96*pow(1.-max(dot(N,V),0.),5.);
vec3 base=mix(vec3(.42,.83,.78),vec3(.12,.52,.66),smoothstep(0.,3.,d));base=mix(base,vec3(.05,.25,.42),smoothstep(3.,14.,d));
vec3 col=mix(base,vec3(.8,.89,.95),fr*.85);col*=.88+.12*max(dot(N,uSun),0.);
col+=vec3(1.,.96,.88)*pow(max(dot(reflect(-uSun,N),V),0.),160.)*1.4;
float band=1.-smoothstep(0.,1.1,d);float fw=.5+.5*sin(d*8.-uTime*2.+noise(p*.5)*5.);float foam=band*smoothstep(.55,.95,fw)*.85+(1.-smoothstep(0.,.22,d))*.7;
col=mix(col,vec3(.97,.98,.98),clamp(foam,0.,1.));
float a=max(mix(.45,.93,smoothstep(0.,4.,d)),clamp(foam,0.,1.));
col=mix(col,fogC,smoothstep(fogN,fogF,length(vW-cameraPosition)));gl_FragColor=vec4(col,a);}`,
  });
  const s = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), m);
  s.rotation.x = -Math.PI / 2; SC.add(s);
}

export function riverMat(ctx) {
  return new THREE.ShaderMaterial({
    uniforms: Object.assign({ uTime: ctx.U.time }, ctx.FOG),
    vertexShader: `attribute float aSp;varying vec2 vUv;varying float vSp;varying vec3 vW;void main(){vUv=uv;vSp=aSp;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `uniform float uTime;uniform vec3 fogC;uniform float fogN;uniform float fogF;varying vec2 vUv;varying float vSp;varying vec3 vW;
${GL_NOISE}
void main(){vec2 q=vec2(vUv.x*3.,vUv.y-uTime*vSp);float n=noise(q*vec2(1.,1.4))*.6+noise(q*vec2(2.6,4.)+3.)*.4;
vec3 c=mix(vec3(.14,.44,.62),vec3(.3,.63,.78),n);float edge=smoothstep(.3,.5,abs(vUv.x-.5));c=mix(c,vec3(.74,.85,.83),edge*.55);
c+=smoothstep(.7,.95,n)*(.18+.25*clamp(vSp-.6,0.,1.));
c=mix(c,fogC,smoothstep(fogN,fogF,length(vW-cameraPosition)));gl_FragColor=vec4(c,1.);}`,
    polygonOffset: true, polygonOffsetFactor: -2,
  });
}

export function lake(ctx, geo, sp) {
  const n = geo.attributes.position.count;
  geo.setAttribute('aSp', new THREE.Float32BufferAttribute(new Array(n).fill(sp), 1));
  return new THREE.Mesh(geo, riverMat(ctx));
}

export function buildRivers(ctx) {
  const { W, SC } = ctx;
  for (const r of W.rivers) {
    const S = r.S.filter((_, i) => i % 2 === 0);
    const g = ribbon(S, (s) => s.w + 0.4, (s) => Math.max(s.bed + 0.4, W.h(s.x, s.z) + 0.08, 0.06),
      (s) => (r.main ? mix(1.6, 0.45, Math.min(1, s.t * 1.6)) : 0.35));
    SC.add(new THREE.Mesh(g, riverMat(ctx)));
  }
  const ox = lake(ctx, new THREE.RingGeometry(0.8, 1.2, 64), 0.04);
  ox.rotation.x = -Math.PI / 2; ox.scale.set(6.5, 4.2, 1); ox.position.set(OX[0], 2.6, OX[1]); SC.add(ox);
  const cl = lake(ctx, new THREE.CircleGeometry(3.2, 32), 0.03);
  cl.rotation.x = -Math.PI / 2; cl.position.set(ISLET[0], W.h(ISLET[0], ISLET[1]) + 0.45, ISLET[1]); SC.add(cl);
}
