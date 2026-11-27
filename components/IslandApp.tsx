'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useIsland, type Profile, type Flood } from '@/store/island';

const TY_MSG: Record<string, string> = {
  sea: '颱風在溫暖的海面上生成，北半球氣流以逆時針方向旋入中心。',
  land: '颱風登陸！迎風坡豪雨，留意山崩與土石流。',
  weak: '越過中央山脈後，低層結構被破壞，颱風強度減弱。',
  end: '颱風遠離。雨量為水庫補充了水資源，但也留下災後復原工作。',
};
import { ZONES, SCI, FLOWS, CAT } from '@/content/zones';
import Nav from './Nav';
import Story from './Story';
import Explore from './Explore';
import Toast from './Toast';

type Actions = { focusMarker: (zid: string, i: number) => void; quake: () => void; typhoon: () => void; clearProfile: () => void };
const EngineCtx = createContext<Actions>({ focusMarker: () => {}, quake: () => {}, typhoon: () => {}, clearProfile: () => {} });
export const useActions = () => useContext(EngineCtx);

export default function IslandApp({ initialZone }: { initialZone?: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const pinsRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eng = useRef<any>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errors, setErrors] = useState<string[]>([]);
  const mode = useIsland((s) => s.mode);
  const zone = useIsland((s) => s.zone);

  useEffect(() => {
    let disposed = false, unsub = () => {};
    (async () => {
      try {
        // 畫質：?q=high 強制完整、?q=low 強制輕量；否則依螢幕寬度與 CPU 核心數判斷
        const q = new URLSearchParams(window.location.search).get('q');
        const lite = q === 'high' ? false : q === 'low' ? true : window.innerWidth < 700 || (navigator.hardwareConcurrency ?? 8) <= 4;
        const [{ loadWorld }, { createEngine }] = await Promise.all([import('@/lib/world.js'), import('@/lib/engine/engine.js')]);
        const W = await loadWorld(lite ? 280 : 480);
        if (disposed || !stageRef.current || !pinsRef.current) return;
        const e = createEngine({
          container: stageRef.current, pinLayer: pinsRef.current, W, zones: ZONES, sci: SCI, flows: FLOWS, cat: CAT, lite,
          onActive: (id: string) => useIsland.getState().setActive(id),
          onZonePin: (id: string) => useIsland.getState().enter(id),
          onMarkerPin: (zid: string, i: number) => focusMarker(zid, i),
          onError: (msg: string) => setErrors((x) => (x.length > 4 ? x : [...x, msg])),
          onProfile: (p: Profile | null) => useIsland.getState().setProfile(p),
          onHour: (h: number) => useIsland.setState({ hour: h }),
          onFlood: (f: Flood) => useIsland.getState().setFlood(f),
          onHazard: (h: string[]) => useIsland.getState().setHazards(h),
          onTyphoon: (stage: string) => { const m = TY_MSG[stage]; if (m) useIsland.getState().say(m); },
        });
        eng.current = e;
        const s0 = useIsland.getState();
        e.setLayers(s0.layers); e.setSeason(s0.season);
        unsub = useIsland.subscribe((s, p) => {
          if (s.mode !== p.mode) e.setMode(s.mode);
          if (s.mode === 'ex' && (s.zone !== p.zone || s.mode !== p.mode)) e.setZone(s.zone);
          if (s.layers !== p.layers) e.setLayers(s.layers);
          if (s.season !== p.season) e.setSeason(s.season);
          if (s.filter !== p.filter || s.zone !== p.zone) e.setCats(s.filter === '全部' ? null : { [s.filter]: 1 });
          if (s.tool !== p.tool) e.setTool(s.tool);
          if (s.hour !== p.hour) e.setHour(s.hour);
          if (s.autoDay !== p.autoDay) e.setAutoDay(s.autoDay);
          if (s.seaLevel !== p.seaLevel) e.setSeaLevel(s.seaLevel);
          if (s.tide !== p.tide) e.setTide(s.tide);
        });
        if (initialZone) useIsland.getState().enter(initialZone);
        setStatus('ready');
      } catch (err) {
        console.error(err);
        setErrors((x) => [...x, String((err as Error)?.message || err)]);
        setStatus('error');
      }
    })();
    return () => { disposed = true; unsub(); eng.current?.dispose(); eng.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 探索模式：鎖住頁面捲動，網址同步成 /explore/區域 */
  useEffect(() => {
    document.body.classList.toggle('ex', mode === 'ex');
    // 保留查詢字串（例如 ?debug=1、?speed=6），只改路徑
    try { window.history.replaceState(null, '', (mode === 'ex' ? `/explore/${zone}` : '/') + window.location.search); } catch {}
  }, [mode, zone]);

  function focusMarker(zid: string, i: number) {
    const s = useIsland.getState();
    if (s.mode !== 'ex' || s.zone !== zid) s.enter(zid);
    const on = eng.current?.focus(zid, i);
    useIsland.getState().setHot(on ? [zid, i] : null);
  }
  function quake() {
    eng.current?.quake();
    useIsland.getState().say('地震！藍圈是 P 波（快、上下震），紅圈是 S 波（慢、左右晃、破壞大）。震央附近陡坡發生山崩，海底地震引發海嘯。');
  }

  function typhoon() { eng.current?.typhoon(); }
  function clearProfile() { eng.current?.clearProfile(); }

  return (
    <EngineCtx.Provider value={{ focusMarker, quake, typhoon, clearProfile }}>
      <div id="stage" ref={stageRef} />
      <div id="pins" ref={pinsRef} />
      {status === 'loading' && <div className="loading">正在生成島嶼…</div>}
      <Toast />
      <Nav />
      <Story />
      <Explore />
      {errors.length > 0 && <div className="err" role="alert">{errors.join('\n')}</div>}
    </EngineCtx.Provider>
  );
}
