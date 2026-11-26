'use client';
import { useIsland } from '@/store/island';
import { ZONES, SCI } from '@/content/zones';

export default function Nav() {
  const { mode, menuOpen, setMenu, enter, leave } = useIsland();
  return (
    <header className="nav">
      <a className="mark" href="/" onClick={(e) => { e.preventDefault(); leave(); window.scrollTo({ top: 0 }); }}>
        <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#0b4f6c" /><path d="M6 21c3-1 4-8 8-9s4 4 7 3 3-5 5-4v8c-6 3-14 4-20 2z" fill="#8fd3b6" /><circle cx="24" cy="10" r="2.4" fill="#f3c35b" /></svg>
        一座島・地理
      </a>
      <button className="wide" onClick={() => { leave(); window.scrollTo({ top: 0 }); }}>導覽</button>
      <button aria-expanded={menuOpen} onClick={() => setMenu(!menuOpen)}>區域選單</button>
      <button className="dark" onClick={() => (mode === 'ex' ? leave() : enter('all'))}>{mode === 'ex' ? '回到導覽' : '自由探索'}</button>
      {menuOpen && (
        <div className="menu" role="menu">
          <h4>地理區域</h4>
          <button onClick={() => enter('all')}><b>島</b>全島總覽</button>
          {ZONES.map((z, i) => <button key={z.id} onClick={() => enter(z.id)}><b>{i + 1}</b>{z.name}</button>)}
          <button onClick={() => enter('link')}><b>↔</b>交互關係</button>
          <h4>地球科學</h4>
          {SCI.map((z) => <button key={z.id} className="s" onClick={() => enter(z.id)}><b>科</b>{z.name}</button>)}
        </div>
      )}
    </header>
  );
}
