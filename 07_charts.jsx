/* ============================================================
   07 CHARTS — small SVG/HTML charts. Colors come from CSS tokens,
   so both themes work. One axis per chart; legend always shown.
   ============================================================ */
function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }

function Legend({ items }) { return (<div className="legend">{items.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}</div>); }

function TrendChart({ data, series }) {
  const [hover, setHover] = useState(null);
  const [asTable, setAsTable] = useState(false);
  const wrap = useRef(null);
  const W = 640, H = 250, L = 60, R = 30, T = 12, B = 30;
  const max = niceMax(Math.max.apply(null, data.reduce((a, d) => a.concat(series.map((s) => d[s.key])), [1])));
  const x = (i) => L + (data.length === 1 ? (W - L - R) / 2 : i * (W - L - R) / (data.length - 1));
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const ticks = [0, 1, 2, 3, 4].map((k) => max * k / 4);
  const move = (e) => {
    const r = wrap.current.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W;
    let best = 0, bd = 1e9; data.forEach((d, i) => { const dd = Math.abs(x(i) - px); if (dd < bd) { bd = dd; best = i; } }); setHover(best);
  };
  if (asTable) return (<div><div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}><Btn size="sm" onClick={() => setAsTable(false)}>Show chart</Btn></div>
    <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Month</th>{series.map((s) => <th key={s.key} className="r">{s.label}</th>)}</tr></thead><tbody>{data.map((d) => <tr key={d.key}><td>{d.label}</td>{series.map((s) => <td key={s.key} className="r">{fmtMoney(d[s.key])}</td>)}</tr>)}</tbody></table></div></div>);
  return (<div>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}><Legend items={series} /><Btn size="sm" onClick={() => setAsTable(true)}>Show table</Btn></div>
    <div className="chart-wrap" ref={wrap} onMouseMove={move} onMouseLeave={() => setHover(null)} onTouchMove={(e) => move(e.touches[0])}>
      <svg viewBox={'0 0 ' + W + ' ' + H} width="100%" role="img" aria-label={'Monthly trend of ' + series.map((s) => s.label).join(', ')} style={{ display: 'block' }}>
        {ticks.map((t, i) => (<g key={i}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" /><text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">{t === 0 ? '0' : '৳' + fmtAxis(t)}</text></g>))}
        {data.map((d, i) => <text key={d.key} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--ink-3)">{d.label}</text>)}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--line-2)" strokeWidth="1" />}
        {series.map((s) => {
          const pts = data.map((d, i) => x(i) + ',' + y(d[s.key])).join(' ');
          return (<g key={s.key}>
            <polyline points={pts} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dash || undefined} />
            {data.map((d, i) => (i === data.length - 1 || i === hover) && <circle key={i} cx={x(i)} cy={y(d[s.key])} r={i === hover ? 5 : 4} fill={s.color} stroke="var(--surface)" strokeWidth="2" />)}
          </g>);
        })}
      </svg>
      {hover != null && (() => { const d = data[hover], left = Math.min(Math.max(x(hover) / W * 100, 18), 82); return (<div className="chart-tip" style={{ left: left + '%', top: 0 }}><b style={{ display: 'block', marginBottom: 4 }}>{d.label}</b>{series.map((s) => <div key={s.key}><span><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: s.color, marginRight: 6 }} />{s.label}</span><b>{fmtMoney(d[s.key])}</b></div>)}</div>); })()}
    </div>
  </div>);
}

function HBars({ items, max, fmt, empty, stacked }) {
  const m = max || Math.max.apply(null, items.map((i) => i.value).concat([1]));
  if (!items.length) return <div className="muted">{empty || 'No data yet.'}</div>;
  if (stacked) return (<div style={{ display: 'grid', gap: 14 }}>{items.map((i) => (<div key={i.label} title={i.label + ': ' + fmtMoney(i.value)}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}><span>{i.label}</span><b className="num" style={{ whiteSpace: 'nowrap' }}>{(fmt || fmtCompact)(i.value)}</b></div><div className="hb" style={{ display: 'block' }}><div className="track"><i style={{ width: Math.max(1.5, i.value / m * 100) + '%', background: i.color }} /></div></div></div>))}</div>);
  return (<div className="hb" role="list">{items.map((i) => (<Fragment key={i.label}>
    <span role="listitem" title={i.label} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.label}</span>
    <div className="track" title={i.label + ': ' + fmtMoney(i.value)}><i style={{ width: Math.max(1.5, i.value / m * 100) + '%', background: i.color }} /></div>
    <b className="num" style={{ fontWeight: 600 }}>{(fmt || fmtCompact)(i.value)}</b>
  </Fragment>))}</div>);
}
