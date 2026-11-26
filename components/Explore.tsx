'use client';
import { useEffect, useRef } from 'react';
import { useIsland, type Filter } from '@/store/island';
import { ZONES, SCI, FLOWS, CAT, ALL, type Cat } from '@/content/zones';
import { useActions } from './IslandApp';
import Legend from './Legend';
import Tools from './Tools';

const LAYERS = [['contour', '等高線'], ['hyp', '分層設色'], ['rock', '岩性'], ['wind', '季風'], ['current', '洋流'], ['plate', '板塊']] as const;

function LayerBar() {
  const { layers, season, toggleLayer, toggleSeason } = useIsland();
  const { quake } = useActions();
  const on = (k: (typeof LAYERS)[number][0]) => (k === 'hyp' ? layers.mode === 1 : k === 'rock' ? layers.mode === 2 : !!layers[k]);
  return (
    <div className="layers">
      <b>圖層</b>
      {LAYERS.map(([k, t]) => <button key={k} className={on(k) ? 'on' : ''} aria-pressed={on(k)} onClick={() => toggleLayer(k)}>{t}</button>)}
      {!!layers.wind && <button className="act" onClick={toggleSeason}>{season === 'winter' ? '冬季 → 切換夏季' : '夏季 → 切換冬季'}</button>}
      {!!layers.plate && <button className="act" onClick={quake}>模擬地震</button>}
    </div>
  );
}

export default function Explore() {
  const { mode, zone, hot, filter, setZone, setFilter } = useIsland();
  const { focusMarker } = useActions();
  const notes = useRef<HTMLElement>(null), list = useRef<HTMLElement>(null);

  useEffect(() => { notes.current?.scrollTo({ top: 0 }); list.current?.querySelector('.on')?.scrollIntoView({ block: 'nearest', inline: 'center' }); }, [zone]);
  useEffect(() => { if (hot) notes.current?.querySelector(`[data-i="${hot[1]}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [hot]);
  if (mode !== 'ex') return null;

  const zb = (id: string, label: string, name: string, s?: boolean) => (
    <button key={id} className={`${s ? 's' : ''} ${zone === id ? 'on' : ''}`} onClick={() => setZone(id)}><b>{label}</b>{name}</button>
  );
  const z = ALL.find((q) => q.id === zone);
  const cnt = (c: Cat) => z?.m.filter((m) => m[0] === c).length ?? 0;

  return (
    <div className="ex-ui">
      <nav className="zones" aria-label="區域" ref={list}>
        <h3>地理區域</h3>
        {zb('all', '島', '全島總覽')}
        {ZONES.map((q, i) => zb(q.id, String(i + 1), q.name))}
        {zb('link', '↔', '交互關係')}
        <h3>地球科學</h3>
        {SCI.map((q) => zb(q.id, '科', q.name, true))}
      </nav>
      <aside className="notes" ref={notes}>
        {zone === 'all' && (
          <>
            <h2>全島總覽</h2>
            <p>本島由中央的褶皺山脈分成東西兩側：西側河流長、平原廣，東側山地直逼海岸。海峽另一側是一座火山離島。點選島上的區域名稱放大，或疊上圖層。</p>
            <LayerBar />
            <Tools />
            {ZONES.map((q, i) => <button key={q.id} className="item open" onClick={() => setZone(q.id)}><span className="t">{i + 1}．{q.name}</span><p>{q.m.map((m) => m[1]).join('、')}</p></button>)}
          </>
        )}
        {zone === 'link' && (
          <>
            <h2>交互關係</h2>
            <p>區域之間靠河流、電網、航線連在一起。地圖上的光點就是流動的方向。</p>
            {FLOWS.map((f) => <div key={f.name} className="item open" style={{ ['--c' as string]: f.css }}><span className="t"><span className="tagc" style={{ ['--c' as string]: f.css }}>流動</span>{f.name}</span><p>{f.n}</p></div>)}
          </>
        )}
        {z && (
          <>
            <h2>{z.name}</h2>
            <p>{z.lead}</p>
            <LayerBar />
            <Tools />
            <Legend kind={z.legend} />
            <div className="chips">
              {(['全部', '地形', '產業', '人文', '地科'] as Filter[]).filter((c) => c === '全部' || cnt(c as Cat)).map((c) => (
                <button key={c} className={filter === c ? 'on' : ''} onClick={() => setFilter(c)}>{c}{c === '全部' ? '' : ' ' + cnt(c as Cat)}</button>
              ))}
            </div>
            {z.m.map((m, i) => (filter === '全部' || filter === m[0]) && (
              <button key={m[1]} data-i={i} className={`item ${hot && hot[0] === z.id && hot[1] === i ? 'open' : ''}`} style={{ ['--c' as string]: CAT[m[0]] }} onClick={() => focusMarker(z.id, i)}>
                <span className="t"><span className="tagc" style={{ ['--c' as string]: CAT[m[0]] }}>{m[0]}</span>{m[1]}</span>
                <p>{m[3]}</p>
              </button>
            ))}
          </>
        )}
      </aside>
      <div className="hint">拖曳旋轉・右鍵或 Ctrl＋拖曳平移・滾輪縮放・雙指縮放與平移</div>
    </div>
  );
}
