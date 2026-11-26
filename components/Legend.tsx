export default function Legend({ kind }: { kind?: 'hyp' | 'rock' | 'climate' }) {
  if (kind === 'hyp')
    return (
      <div className="legend">分層設色（1 格高度約 50 公尺，經垂直誇大）
        <div className="ramp" />
        <div className="ramp-l"><span>0</span><span>500 m</span><span>1000 m</span><span>1500 m</span><span>2400 m</span></div>
      </div>
    );
  const sw = (items: [string, string][]) => <div className="sw">{items.map(([t, c]) => <span key={t} style={{ ['--c' as string]: c }}><i />{t}</span>)}</div>;
  if (kind === 'rock') return <div className="legend">岩性{sw([['沖積層', '#f2de99'], ['沉積岩', '#c99a5c'], ['變質岩', '#8c80ad'], ['火成岩', '#73402f'], ['珊瑚礁石灰岩', '#f7f5ea']])}</div>;
  if (kind === 'climate') return <div className="legend">圖層{sw([['冬季東北季風', '#eaf4ff'], ['夏季西南季風', '#ffd59a'], ['迎風坡（多雨）', '#4f7fd6'], ['背風坡（乾熱）', '#f39a4a'], ['暖流', '#e0573e'], ['寒流', '#3aa0d8']])}</div>;
  return null;
}
