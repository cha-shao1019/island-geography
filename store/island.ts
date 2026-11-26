'use client';
import { create } from 'zustand';
import { EMPTY_LAYERS, zoneLayers, type Cat, type Layers } from '@/content/zones';

export type Mode = 'story' | 'ex';
export type Season = 'winter' | 'summer';
export type Filter = '全部' | Cat;

interface IslandState {
  mode: Mode;
  /** 導覽模式下目前捲動到的章節 */
  active: string;
  /** 探索模式下選取的區域 */
  zone: string;
  layers: Layers;
  season: Season;
  hot: [string, number] | null;
  filter: Filter;
  toast: string;
  menuOpen: boolean;
  setActive: (id: string) => void;
  enter: (zone: string) => void;
  leave: () => void;
  setZone: (zone: string) => void;
  toggleLayer: (k: 'contour' | 'hyp' | 'rock' | 'wind' | 'current' | 'plate') => void;
  toggleSeason: () => void;
  setHot: (h: [string, number] | null) => void;
  setFilter: (f: Filter) => void;
  say: (msg: string) => void;
  setMenu: (o: boolean) => void;
}

export const SEASON_MSG: Record<Season, string> = {
  winter: '冬季：東北季風，東北部迎風多雨。',
  summer: '夏季：西南季風，西南部山區迎風多雨。',
};

export const useIsland = create<IslandState>((set, get) => ({
  mode: 'story',
  active: 'all',
  zone: 'all',
  layers: { ...EMPTY_LAYERS },
  season: 'winter',
  hot: null,
  filter: '全部',
  toast: '',
  menuOpen: false,
  setActive: (id) => set({ active: id, layers: zoneLayers(id) }),
  enter: (zone) => set({ mode: 'ex', zone, hot: null, filter: '全部', layers: zoneLayers(zone), menuOpen: false }),
  leave: () => set({ mode: 'story', hot: null }),
  setZone: (zone) => set({ zone, hot: null, filter: '全部', layers: zoneLayers(zone) }),
  toggleLayer: (k) => {
    const L = { ...get().layers };
    if (k === 'hyp') L.mode = L.mode === 1 ? 0 : 1;
    else if (k === 'rock') L.mode = L.mode === 2 ? 0 : 2;
    else L[k] = L[k] ? 0 : 1;
    set({ layers: L });
  },
  toggleSeason: () => {
    const s: Season = get().season === 'winter' ? 'summer' : 'winter';
    set({ season: s, toast: SEASON_MSG[s] });
  },
  setHot: (hot) => set({ hot }),
  setFilter: (filter) => set({ filter }),
  say: (toast) => set({ toast }),
  setMenu: (menuOpen) => set({ menuOpen }),
}));
