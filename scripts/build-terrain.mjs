// 建置前預先算好地形：輸出高度（Int16，單位 0.01）與河流取樣資料到 public/terrain/
import {genWorld,RIV} from '../lib/terrain/terrain.js';
import {writeFileSync,mkdirSync} from 'node:fs';
mkdirSync('public/terrain',{recursive:true});
const t0=Date.now();
for(const N of [480,280]){
  const W=genWorld(N),q=new Int16Array(W.H.length);
  for(let i=0;i<W.H.length;i++)q[i]=Math.round(W.H[i]*100);
  writeFileSync(`public/terrain/heights-${N}.bin`,Buffer.from(q.buffer));
}
const r2=v=>Math.round(v*100)/100;
const rivers=RIV.map(r=>({id:r.id,main:!!r.main,S:r.S.map(p=>[r2(p.x),r2(p.z),r2(p.t),r2(p.bed),r2(p.w),r2(p.sl)])}));
writeFileSync('public/terrain/rivers.json',JSON.stringify(rivers));
console.log(`terrain built in ${Date.now()-t0}ms`);
