'use client';
import { useEffect } from 'react';
import { useIsland } from '@/store/island';

export default function Toast() {
  const toast = useIsland((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => useIsland.getState().say(''), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  return <div className={`toast ${toast ? 'on' : ''}`} role="status">{toast}</div>;
}
