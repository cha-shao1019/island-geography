'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useIsland } from '@/store/island';
import { ZONES, SCI, FLOWS, CAT } from '@/content/zones';
import Nav from './Nav';
import Story from './Story';
import Explore from './Explore';
import Toast from './Toast';

type Actions = { focusMarker: (zid: string, i: number) => void; quake: () => void };
const EngineCtx = createContext<Actions>({ focusMarker: () => {}, quake: () => {} });
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
        const lite = window.innerWidth < 700 || (navigator.hardwareConcurrency ?? 8) <= 4;
        const [{ loadWorld }, { createEngine }] = await Promise.all([import('@/lib/world.js'), import('@/lib/engine/engine.js')]);
        const W = await loadWorld(lite ? 240 : 360);
        if (disposed || !stageRef.current || !pinsRef.current) return;
        const e = createEngine({
          container: stageRef.current, pinLayer: pinsRef.current, W, zones: ZONES, sci: SCI, flows: FLOWS, cat: CAT, lite,
          onActive: (id: string) => useIsland.getState().setActive(id),
          onZonePin: (id: string) => useIsland.getState().enter(id),
          onMarkerPin: (zid: string, i: number) => focusMarker(zid, i),
          onError: (msg: string) => setErrors((x) => (x.length > 4 ? x : [...x, msg])),
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
    try { window.history.replaceState(null, '', mode === 'ex' ? `/explore/${zone}` : '/'); } catch {}
  }, [mode, zone]);

  function focusMarker(zid: string, i: number) {
    const s = useIsland.getState();
    if (s.mode !== 'ex' || s.zone !== zid) s.enter(zid);
    const on = eng.current?.focus(zid, i);
    useIsland.getState().setHot(on ? [zid, i] : null);
  }
  function quake() {
    eng.current?.quake();
    useIsland.getState().say('地震！藍色圈是 P 波（較快、先到、上下震動），紅色圈是 S 波（較慢、後到、左右搖晃、破壞大）。');
  }

  return (
    <EngineCtx.Provider value={{ focusMarker, quake }}>
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
