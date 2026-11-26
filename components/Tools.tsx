'use client';
import { useIsland, type Profile } from '@/store/island';
import { useActions } from './IslandApp';

/* 比例尺：水平 1 單位 = 1 公里；垂直 1 單位 = 50 公尺（3D 模型垂直誇大 20 倍） */
const KM = 1, M_PER_UNIT = 50;
const hhmm = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

function ProfileChart({ p }: { p: Profile }) {
  const W = 320, H = 130, pad = { l: 38, r: 8, t: 10, b: 22 };
  const hs = p.pts.map(([, h]) => h * M_PER_UNIT), sea = p.level * M_PER_UNIT;
  const lo = Math.min(sea, ...hs), hi = Math.max(sea + 50, ...hs), dist = p.len * KM;
  const X = (d: number) => pad.l + (d / p.len) * (W - pad.l - pad.r);
  const Y = (m: number) => pad.t + (1 - (m - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const line = p.pts.map(([d, h]) => `${X(d).toFixed(1)},${Y(h * M_PER_UNIT).toFixed(1)}`).join(' ');
  const area = `${X(0)},${Y(lo)} ${line} ${X(p.len)},${Y(lo)}`;
  const rise = hs[hs.length - 1] - hs[0];
  let maxG = 0;
  for (let i = 1; i < hs.length; i++) { const dd = ((p.pts[i][0] - p.pts[i - 1][0]) * KM) * 1000; if (dd > 0) maxG = Math.max(maxG, Math.abs(hs[i] - hs[i - 1]) / dd); }
  const ticks = [lo, (lo + hi) / 2, hi].map((v) => Math.round(v / 10) * 10);
  return (
    <div className="profile">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="地形剖面圖">
        {sea > lo && <rect x={pad.l} y={Y(sea)} width={W - pad.l - pad.r} height={Y(lo) - Y(sea)} fill="#9fd0e6" opacity=".55" />}
        <polygon points={area} fill="#c9a46a" opacity=".55" />
        <polyline points={line} fill="none" stroke="#8a5a2b" strokeWidth="2" />
        {ticks.map((v) => <g key={v}><line x1={pad.l} x2={W - pad.r} y1={Y(v)} y2={Y(v)} stroke="currentColor" opacity=".12" /><text x={pad.l - 4} y={Y(v) + 4} textAnchor="end" fontSize="10" fill="currentColor">{v}</text></g>)}
        <text x={pad.l} y={H - 6} fontSize="11" fontWeight="700" fill="#c8382a">A</text>
        <text x={W - pad.r} y={H - 6} fontSize="11" fontWeight="700" fill="#c8382a" textAnchor="end">B</text>
        <text x={(W + pad.l) / 2} y={H - 6} fontSize="10" textAnchor="middle" fill="currentColor">{dist.toFixed(1)} km</text>
      </svg>
      <dl className="pstats">
        <div><dt>水平距離</dt><dd>{dist.toFixed(1)} km</dd></div>
        <div><dt>高差 A→B</dt><dd>{rise >= 0 ? '+' : ''}{Math.round(rise)} m</dd></div>
        <div><dt>平均坡度</dt><dd>{((Math.abs(rise) / (dist * 1000)) * 100).toFixed(1)}%</dd></div>
        <div><dt>最陡處</dt><dd>{(maxG * 100).toFixed(0)}%</dd></div>
      </dl>
      <p className="small">高度單位公尺，剖面圖已垂直誇大。比對等高線：線越密的地方，剖面線越陡。</p>
    </div>
  );
}

export default function Tools() {
  const { tool, profile, hour, autoDay, seaLevel, flood, tide, setTool, setHour, setAutoDay, setSeaLevel, setTide } = useIsland();
  const { typhoon, clearProfile } = useActions();
  return (
    <div className="tools">
      <b>工具與模擬</b>
      <div className="trow">
        <button className={tool === 'profile' ? 'on' : ''} aria-pressed={tool === 'profile'} onClick={() => setTool(tool === 'profile' ? null : 'profile')}>剖面與測距</button>
        <button className={tide ? 'on' : ''} aria-pressed={tide} onClick={() => setTide(!tide)}>潮汐</button>
        <button className="act" onClick={typhoon}>颱風來襲</button>
      </div>
      {tool === 'profile' && !profile && <p className="small">在島上依序點兩個位置（A、B），就會畫出這條線的地形剖面。</p>}
      {profile && <><ProfileChart p={profile} /><button className="link" onClick={clearProfile}>清除剖面，重新選點</button></>}
      <div className="slider two">
        <span>時間 <strong>{hhmm(hour)}</strong></span>
        <input type="range" aria-label="時間" min={0} max={23.75} step={0.25} value={hour} onChange={(e) => { setAutoDay(false); setHour(+e.target.value); }} />
        <button className={autoDay ? 'on' : ''} aria-pressed={autoDay} onClick={() => setAutoDay(!autoDay)}>{autoDay ? '暫停' : '播放一天'}</button>
      </div>
      <label className="slider">
        <span>海平面 <strong>+{Math.round(seaLevel * 50)} m</strong></span>
        <input type="range" aria-label="海平面" min={0} max={3} step={0.1} value={seaLevel} onChange={(e) => setSeaLevel(+e.target.value)} />
      </label>
      {seaLevel > 0 && flood && (
        <p className="small">淹沒本島陸地約 <strong>{flood.pct}%</strong>{flood.names.length ? `；受影響：${flood.names.slice(0, 8).join('、')}` : ''}</p>
      )}
    </div>
  );
}
