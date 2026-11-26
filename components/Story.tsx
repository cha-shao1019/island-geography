'use client';
import { useIsland } from '@/store/island';
import { ZONES, SCI, FLOWS, CAT, ALL, type Zone } from '@/content/zones';
import { useActions } from './IslandApp';
import Legend from './Legend';

function Chapter({ z, i, sci }: { z: Zone; i: number; sci?: boolean }) {
  const enter = useIsland((s) => s.enter), toggleSeason = useIsland((s) => s.toggleSeason);
  const { quake, typhoon } = useActions();
  const extra = z.id === 'plate' || z.id === 'climate' || z.id === 'sim';
  return (
    <section className={`sec ${i % 2 ? 'r' : ''}`} data-view={z.id} id={`sec-${z.id}`}>
      <div className="card" data-parallax>
        <div className="kicker"><span className={sci ? 's' : ''}>{sci ? '地球科學' : `第 ${i + 1} 區`}</span>{z.short}</div>
        <h2>{z.name}</h2>
        <p>{z.lead}</p>
        <Legend kind={z.legend} />
        <ul className="mk">
          {z.m.slice(0, 4).map((m) => <li key={m[1]}><span className="tagc" style={{ ['--c' as string]: CAT[m[0]] }}>{m[0]}</span>{m[1]}</li>)}
        </ul>
        <div className="row">
          {z.id === 'plate' && <button className="go" onClick={quake}>模擬一次地震</button>}
          {z.id === 'climate' && <button className="go" onClick={toggleSeason}>切換冬季／夏季</button>}
          {z.id === 'sim' && <button className="go" onClick={typhoon}>颱風來襲</button>}
          <button className={extra ? '' : 'go'} onClick={() => enter(z.id)}>放大探索 →</button>
        </div>
      </div>
    </section>
  );
}

export default function Story() {
  const enter = useIsland((s) => s.enter);
  const count = ALL.reduce((a, z) => a + z.m.length, 0);
  return (
    <>
      <main id="story">
        <section className="hero" data-view="all" id="top">
          <h1 data-parallax>一座島，<br />讀完整本地理。</h1>
          <p data-parallax>褶皺山脈、盆地都市、沖積扇、曲流、河階、潟湖、海階，還有海峽另一側的火山島。往下捲動，鏡頭會帶你飛過每一個區域，再看見風、洋流與板塊這些看不見的力量。</p>
          <div className="row">
            <button className="go" onClick={() => document.getElementById('sec-mtn')?.scrollIntoView({ behavior: 'smooth' })}>開始導覽 ↓</button>
            <button onClick={() => enter('all')}>直接探索整座島</button>
          </div>
          <div className="facts" data-parallax>
            {([[ZONES.length, '個地理區域'], [SCI.length, '個地科主題'], [count, '個標記與筆記'], [6, '種圖層']] as const).map(([n, t]) => <div key={t}><strong>{n}</strong><span>{t}</span></div>)}
          </div>
        </section>
        {ZONES.map((z, i) => <Chapter key={z.id} z={z} i={i} />)}
        {SCI.map((z, i) => <Chapter key={z.id} z={z} i={ZONES.length + i} sci />)}
        <section className="sec" data-view="link" id="sec-link">
          <div className="card wide" data-parallax>
            <div className="kicker"><span>交互關係</span>兩座島、九個區域</div>
            <h2>看不見的線，把島連在一起</h2>
            <p>水、砂石、電力、人與貨物，在區域之間持續流動——鏡頭上流動的光點就是這些關係。</p>
            <div className="flows">{FLOWS.map((f) => <div key={f.name} style={{ ['--c' as string]: f.css }}><i /><span><b>{f.name}</b><small>{f.n}</small></span></div>)}</div>
            <button className="go" onClick={() => enter('link')}>在地圖上看關係 →</button>
          </div>
        </section>
        <section className="outro" data-view="end">
          <div className="card" data-parallax>
            <h2>現在，換你自己走一圈。</h2>
            <p>轉動島嶼、點開任何一個區域，疊上等高線、岩性、季風或板塊圖層。每一個標記都是一則可以帶走的筆記。</p>
            <div className="row"><button className="go" onClick={() => enter('all')}>進入自由探索</button></div>
          </div>
        </section>
      </main>
      <footer className="foot"><span>一座島・地理｜高中地理與地球科學互動圖鑑</span><span>島嶼為教學用虛構地形，高度經垂直誇大；實例取自臺灣與世界</span></footer>
    </>
  );
}
