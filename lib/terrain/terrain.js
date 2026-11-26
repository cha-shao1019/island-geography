/* 地形產生器：建置時（scripts/build-terrain.mjs）與瀏覽器（顏色、取樣）共用的純函式 */
/* ===== 地形生成（純函式，不依賴 three.js） ===== */
export const SZ=280,HALF=SZ/2;
export const sm=(a,b,v)=>{const t=Math.min(1,Math.max(0,(v-a)/(b-a)));return t*t*(3-2*t)};
export const hs=(x,y)=>{const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s)};
export const vn=(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf),a=hs(xi,yi),b=hs(xi+1,yi),c=hs(xi,yi+1),d=hs(xi+1,yi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v};
export const fbm=(x,y,o=5)=>{let s=0,a=.5,f=1;for(let i=0;i<o;i++){s+=a*(vn(x*f,y*f)*2-1);f*=2.03;a*=.5}return s};
export const ridge=(x,y)=>{let s=0,a=.55,f=1;for(let i=0;i<5;i++){const n=1-Math.abs(vn(x*f,y*f)*2-1);s+=a*n*n;f*=2.1;a*=.5}return s};
export const mix=(a,b,t)=>a+(b-a)*t;

export const RT=[-12,-26];
export const inRiceTerrace=(x,z)=>Math.hypot(x-RT[0],z-RT[1])<9.5;
export const BASIN=[-18,-56],APEX=[2,2],OX=[-28,27],ISLET=[88,78],ISR=17,DELTA=[-50,-70],TEA=[2,48];
export const spineX=z=>18+6*Math.sin(z*.035);
export const mainE=(x,z)=>((x+10)/62)**2+(z/105)**2+.1*fbm(x*.03+7,z*.03);

/* 1. 未切割的地形 */
export function h0(x,z){
 const e=mainE(x,z),sx=spineX(z),dx=x-sx,east=dx>0;
 let h;
 if(e<1){
  const landW=east?sm(1,.965,e):sm(1,.86,e);
  const low=.25+2.6*landW+.7*fbm(x*.05,z*.05,4)*landW;
  const g=east?Math.exp(-((dx/15)**2)):Math.exp(-((dx/16)**2));
  const tz=sm(112,62,Math.abs(z));
  const mtn=g*tz*(26+30*ridge(x*.035+5,z*.035))*(east?sm(1,.975,e):sm(1,.9,e));
  h=low+mtn;
  /* 盆地：中央低平、外圍丘陵 */
  const db=Math.hypot(x-BASIN[0],z-BASIN[1]);
  h+=16*Math.exp(-(((db-21)/6)**2))*(.7+.6*fbm(x*.08,z*.08,3))*landW;
  h=mix(h,2.3+.3*fbm(x*.1,z*.1,3),Math.exp(-((db/14)**2)));
  /* 沖積扇 */
  if(x<7){const r=Math.hypot(x-APEX[0],z-APEX[1]);h=Math.max(h,(13-r*.4)*landW+.15*fbm(x*.2,z*.2,3))}
  /* 梯田：山坡依高度切成平台 */
  {const dr=Math.hypot(x-RT[0],z-RT[1]),wr=1-sm(7,10,dr);if(wr>0&&h>3){const q=2,f=h/q,hq=q*Math.floor(f)+q*sm(.88,1,f-Math.floor(f));h=mix(h,hq,wr)}}
  /* 東岸海階：量化成階梯 */
  const w=Math.exp(-(((z-12)/20)**2))*sm(30,38,x);
  if(w>0){const q=6,f=h/q,hq=q*Math.floor(f)+q*sm(.82,1,f-Math.floor(f));h=mix(h,hq,w)}
 }else{
  h=-.3-17*sm(1,1.5,e);
  if(x>0&&e<1.05)h=Math.max(h,-.35-(e-1)*6); /* 東岸海蝕平台 */
 }
 /* 三角洲向海延伸 */
 const dd=Math.hypot(x-DELTA[0]+3,(z-DELTA[1])*1.1);
 h=Math.max(h,.85-((dd/11)**2)*2.2+.15*fbm(x*.2,z*.2,2));
 if(e<1)h=mix(h,.8+.2*fbm(x*.15,z*.15,2),Math.exp(-(((x-DELTA[0])**2+(z-DELTA[1])**2)/64)));
 /* 鳥足狀三角洲：沿分流兩側堆出伸入海中的沙嘴 */
 for(const id of ['R1a','R1b','R1c']){const pts=RIV.find(r=>r.id===id).pts;for(let i=0;i<pts.length-1;i++){const [ax,az]=pts[i],[bx,bz]=pts[i+1],vx=bx-ax,vz=bz-az,L2=vx*vx+vz*vz,t=Math.max(0,Math.min(1.25,((x-ax)*vx+(z-az)*vz)/L2)),d=Math.hypot(x-ax-vx*t,z-az-vz*t);h=Math.max(h,.95-(d/3.2)**2*1.6-Math.max(0,t-1)*3)}}
 /* 沙洲與潟湖 */
 if(z>36&&z<92){
  const xb=-69+2.5*Math.sin(z*.12),taper=sm(36,44,z)*sm(92,84,z);
  const inlet=1-Math.exp(-(((z-63)/2.2)**2));
  if(Math.abs(x-xb)<3.6)h=Math.max(h,(1.7-((x-xb)/2.3)**2*1.4)*taper*inlet);
  if(x>xb&&x<xb+14&&h<0)h=Math.max(h,-.9-12*(1-taper));
  if(x>xb-8&&x<xb+14&&h<0)h=Math.max(h,-2.2-12*(1-taper)-.5*Math.max(0,xb-x));
 }
 /* 火山離島 */
 const r=Math.hypot(x-ISLET[0],z-ISLET[1]);
 let hv=r<ISR*1.6?24*Math.max(0,1-r/ISR)**1.3:-40;
 if(r<ISR){hv=Math.min(hv,18)-9*sm(5,2,r)+.4*fbm(x*.2,z*.2,3)}
 else if(r<ISR*1.6){hv=-.3-16*sm(ISR,ISR*1.6,r)}
 if(r>ISR*1.02&&r<ISR*1.28)hv=Math.max(hv,-.45+.15*fbm(x*.3,z*.3,2)); /* 裙礁 */
 else if(r>=ISR&&r<=ISR*1.02)hv=Math.max(hv,-1.1);
 h=Math.max(h,hv);
 return h;
}

/* 2. 河流：沿路徑取樣，河床只降不升 */
function meander(){const p=[[22,-12],[16,-8],[10,-4],[5,0],[1,3]];for(let x=-2;x>=-76;x-=1)p.push([x,12+7*Math.sin(x*.22)]);return p}
export const RIV=[
 {id:'R1',pts:[[24,-80],[16,-70],[8,-62],[-3,-57],[-16,-55],[-28,-58],[-38,-64],[-46,-69]],main:1},
 {id:'R1a',pts:[[-46,-69],[-53,-66],[-62,-62]]},
 {id:'R1b',pts:[[-46,-69],[-54,-71],[-63,-71]]},
 {id:'R1c',pts:[[-46,-69],[-52,-75],[-58,-80]]},
 {id:'R2',pts:meander(),main:1},
 {id:'R3',pts:[[18,28],[11,37],[3,45],[-7,51],[-19,56],[-31,59],[-43,62],[-56,63],[-62,63]],main:1}];
function densify(pts,step=.6){const out=[];let L=0;
 for(let i=0;i<pts.length-1;i++){const [ax,az]=pts[i],[bx,bz]=pts[i+1],l=Math.hypot(bx-ax,bz-az),n=Math.max(1,Math.ceil(l/step));
  for(let k=0;k<n;k++){out.push({x:ax+(bx-ax)*k/n,z:az+(bz-az)*k/n,s:L+l*k/n})}L+=l}
 out.push({x:pts.at(-1)[0],z:pts.at(-1)[1],s:L});out.forEach(p=>p.t=p.s/L);return out}
export function prepRivers(){
 let parentBed=null;
 for(const r of RIV){
  r.S=densify(r.pts);
  let m=Infinity;
  r.S.forEach((p,i)=>{const g=h0(p.x,p.z);const depth=r.main?mix(2.6,1.6,p.t):.9;let b=g-depth;if(!r.main&&i===0&&parentBed!=null)b=Math.min(b,parentBed);m=Math.min(m,b);p.bed=Math.max(m,-1.2)});
  if(r.id==='R1')parentBed=r.S.at(-1).bed;
  r.S.forEach(p=>{p.w=r.main?mix(1.0,2.8,p.t):1.3;p.sl=r.main?mix(1.5,.13,sm(0,.55,p.t)):.2});
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;r.S.forEach(p=>{x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);z0=Math.min(z0,p.z);z1=Math.max(z1,p.z)});r.bb=[x0-45,x1+45,z0-45,z1+45];
 }
}
let _rd=1e9; /* carve 時順便記錄到最近河道的距離（減去河寬），給侵蝕遮罩用 */
function carve(x,z,h){
 _rd=1e9;
 for(const r of RIV){if(x<r.bb[0]||x>r.bb[1]||z<r.bb[2]||z>r.bb[3])continue;
  let best=1e9,bp=null;for(const p of r.S){const d=(p.x-x)**2+(p.z-z)**2;if(d<best){best=d;bp=p}}
  const d=Math.sqrt(best),R0=r.main?mix(24,12,bp.t):8,wt=1-sm(R0,R0+10,d);_rd=Math.min(_rd,d-bp.w);if(wt<=0)continue;
  let hc=Math.min(h,bp.bed+Math.max(0,d-bp.w)*bp.sl);
  /* 河階：R3 中游兩岸依相對高度量化成階 */
  if(r.id==='R3'&&bp.t>.18&&bp.t<.6&&d>bp.w+1){const rel=hc-bp.bed,q=3.4,f=rel/q,rq=q*Math.floor(f)+q*sm(.86,1,f-Math.floor(f));hc=bp.bed+mix(rel,rq,sm(.18,.26,bp.t)*sm(.6,.5,bp.t)*(1-sm(18,24,d)))}
  /* 自然堤：平原河段兩岸略高 */
  if(r.id==='R2'&&bp.t>.25)hc+=.55*Math.exp(-(((d-bp.w-1.6)/1.3)**2));
  h=mix(h,hc,wt);}
 /* 牛軛湖 */
 const e=Math.abs(Math.hypot((x-OX[0])/6.5,(z-OX[1])/4.2)-1)*5.5;
 if(e<4)h=Math.min(h,1.0+e*.7);
 return h;
}

/* 3. 產生網格 */
export function genWorld(N=360){
 prepRivers();
 const n1=N+1,H=new Float32Array(n1*n1);
 const mask=new Float32Array(n1*n1);
 for(let j=0;j<n1;j++)for(let i=0;i<n1;i++){const x=-HALF+SZ*i/N,z=-HALF+SZ*j/N,k=j*n1+i,h=carve(x,z,h0(x,z));H[k]=h;
  /* 侵蝕只作用在山地與丘陵；避開河道、湖、梯田、河階、海階、火山口 */
  const rI=Math.hypot(x-ISLET[0],z-ISLET[1]);
  mask[k]=sm(5,11,h)*sm(2,7,_rd)*(inRiceTerrace(x,z)?0:1)*(rI<6?0:1)*(1-Math.exp(-(((z-12)/20)**2))*sm(30,38,x))}
 if(!(typeof process!=="undefined"&&process.env.NO_ERODE))erode(H,mask,n1,SZ/N);
 return {H,n1,N};
}
export function sampleH(W,x,z){const N=W.N,n1=W.n1,fi=(x+HALF)/SZ*N,fj=(z+HALF)/SZ*N,i=Math.max(0,Math.min(N-1,Math.floor(fi))),j=Math.max(0,Math.min(N-1,Math.floor(fj))),u=fi-i,v=fj-j,H=W.H;
 return mix(mix(H[j*n1+i],H[j*n1+i+1],u),mix(H[(j+1)*n1+i],H[(j+1)*n1+i+1],u),v)}
export function slopeAt(W,x,z){const a=sampleH(W,x,z);return Math.hypot(sampleH(W,x+1,z)-a,sampleH(W,x,z+1)-a)}

/* 4. 顏色（地表覆蓋也是知識：水田、都市、茶園、礫石） */
const C=hex=>[(hex>>16&255)/255,(hex>>8&255)/255,(hex&255)/255];
const lerp3=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)];
const K={deep:C(0x1d4f6e),shal:C(0x86cfc4),reef:C(0xa9eadb),sand:C(0xe6d6a8),mud:C(0xb8a47c),grass:C(0x86ad55),grass2:C(0x6a9a45),forest:C(0x3f6e30),forest2:C(0x2b5226),rock:C(0x8c8173),alp:C(0x9c9a86),city:C(0xb3ada3),road:C(0x7d7870),gravel:C(0xc0a97f),tea1:C(0x3d6a2c),tea2:C(0x6c9c3f),paddy:[C(0x95b84c),C(0xadc65e),C(0x7ea545),C(0xc4c473)],volc:C(0x5d5048)};
export function isCity(x,z){return Math.hypot(x-BASIN[0],z-BASIN[1])<13||Math.hypot(x+47,z+75)<8}
export function colorAt(x,z,h,sl){
 const rI=Math.hypot(x-ISLET[0],z-ISLET[1]);
 if(h<-.15){if(rI>ISR&&rI<ISR*1.3)return K.reef;return lerp3(K.deep,K.shal,sm(-9,-.3,h))}
 if(h<.9){return Math.hypot(x-DELTA[0],z-DELTA[1])<12?K.mud:K.sand}
 let c;
 if(isCity(x,z)){const g=((x%3)+3)%3<.4||((z%3)+3)%3<.4;c=g?K.road:lerp3(K.city,K.road,hs(Math.floor(x/3),Math.floor(z/3))*.4)}
 else if(rI<ISR){c=h>9?K.volc:lerp3(K.grass2,K.forest,sm(3,8,h))}
 else if(inRiceTerrace(x,z)&&h>3){c=sl<.55?(Math.floor(h/2)%2?K.paddy[0]:C(0x7fb5a6)):C(0x8a7a55)}
 else if(Math.hypot(x-TEA[0],z-TEA[1])<14&&h>3.2&&sl<.9){c=Math.sin(h*7)>0?K.tea1:K.tea2}
 else if(Math.hypot(x-APEX[0],z-APEX[1])<9&&x<5&&h<11){c=K.gravel}
 else if(h<5.5&&x<4+6*fbm(z*.05,1,2)&&z>-46+6*fbm(x*.05,2,2)&&z<44+6*fbm(x*.05,3,2)&&sl<.35){const cell=Math.floor(x/3.2)*7+Math.floor(z/2.6);c=K.paddy[Math.floor(hs(cell,3)*4)]}
 else if(h<6){c=lerp3(K.grass,K.grass2,fbm(x*.1,z*.1,2)*.5+.5)}
 else{c=lerp3(K.forest,K.forest2,sm(8,30,h));if(h>38)c=lerp3(c,K.alp,sm(38,50,h))}
 return lerp3(c,K.rock,sm(1.8,3.2,sl));
}


/* 水力侵蝕（雨滴模擬）：每滴雨沿坡面流下，坡陡處刮走土石、變緩處堆積，
   讓山坡長出自然的蝕溝、山脊與坡腳堆積。只在建置時執行一次，結果固定（亂數有種子）。 */
function erode(H,mask,n1,cell){
 let seed=1234567;const rand=()=>((seed=(seed*16807)%2147483647)/2147483647);
 /* 侵蝕刷：半徑 2 格的加權範圍，避免單點挖出坑洞 */
 const BR=[];let bs=0;for(let oj=-2;oj<=2;oj++)for(let oi=-2;oi<=2;oi++){const d=Math.hypot(oi,oj);if(d<=2.2){const w=1-d/2.6;BR.push([oi,oj,w]);bs+=w}}BR.forEach(b=>b[2]/=bs);
 const drops=Math.round(n1*n1*0.45),maxLife=40,inertia=.06,capF=6,minCap=.01,erodeK=.35,depK=.25,evap=.025,grav=6;
 const g=(x,y)=>{const i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j,k=j*n1+i,a=H[k],b=H[k+1],c=H[k+n1],d=H[k+n1+1];
  return [(b-a)*(1-v)+(d-c)*v,(c-a)*(1-u)+(d-b)*u,a*(1-u)*(1-v)+b*u*(1-v)+c*(1-u)*v+d*u*v]};
 for(let n=0;n<drops;n++){
  let x=1+rand()*(n1-3),y=1+rand()*(n1-3);
  const k0=Math.floor(y)*n1+Math.floor(x);if(mask[k0]<.05||H[k0]<4)continue;
  let dx=0,dy=0,sp=1,water=1,sed=0;
  for(let life=0;life<maxLife;life++){
   const i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j,k=j*n1+i,[gx,gy,h]=g(x,y);
   dx=dx*inertia-gx*(1-inertia);dy=dy*inertia-gy*(1-inertia);const l=Math.hypot(dx,dy);if(l<1e-6)break;dx/=l;dy/=l;
   x+=dx;y+=dy;if(x<1||y<1||x>n1-2||y>n1-2)break;
   const nh=g(x,y)[2],dh=nh-h,m=mask[k];
   if(m<.02||h<.5)break;
   const cap=Math.max(-dh*sp*water*capF,minCap);
   const w=[(1-u)*(1-v),u*(1-v),(1-u)*v,u*v],ks=[k,k+1,k+n1,k+n1+1];
   if(sed>cap||dh>0){const amt=dh>0?Math.min(dh,sed):(sed-cap)*depK;sed-=amt;for(let q=0;q<4;q++)H[ks[q]]+=amt*w[q]}
   else{const amt=Math.min((cap-sed)*erodeK*m,-dh)*.9;for(const [oi,oj,bw] of BR){const kk=k+oj*n1+oi;if(kk>=0&&kk<H.length)H[kk]-=amt*bw}sed+=amt}
   sp=Math.sqrt(Math.max(0,sp*sp+dh*grav*-1));water*=1-evap;
  }
 }
 /* 收尾：在侵蝕區做一次輕微平滑，去除殘留尖點 */
 const C=Float32Array.from(H);for(let j=1;j<n1-1;j++)for(let i=1;i<n1-1;i++){const k=j*n1+i;if(mask[k]<.05)continue;const av=(C[k-1]+C[k+1]+C[k-n1]+C[k+n1])/4;H[k]=C[k]+(av-C[k])*.45*mask[k]}
 void cell;
}
