/* ============================================================
   06 UI KIT — reusable presentational components + hooks.
   Nothing here knows about storage; pages get data via useApp().
   ============================================================ */
const { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect, useContext, createContext, Fragment, useId } = React;
const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);

const ICONS = {
  dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  tag: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z M7 7h.01',
  building: 'M3 21h18 M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16 M15 9h4a2 2 0 0 1 2 2v10 M9 7h2 M9 11h2 M9 15h2',
  wrench: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
  receipt: 'M5 2h14v20l-3.5-2-3.5 2-3.5-2L5 22z M9 7h6 M9 11h6 M9 15h4',
  card: 'M1 4h22v16H1z M1 10h22',
  printer: 'M6 9V2h12v7 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v8H6z',
  image: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3 M21 15l-5-5L5 21',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h8',
  chart: 'M12 20V10 M18 20V4 M6 20v-4',
  sliders: 'M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0',
  plus: 'M12 5v14 M5 12h14',
  x: 'M18 6L6 18 M6 6l12 12',
  menu: 'M3 12h18 M3 6h18 M3 18h18',
  more: 'M12 12h.01 M12 5h.01 M12 19h.01',
  check: 'M20 6L9 17l-5-5',
  alert: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 16v-4 M12 8h.01',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  edit: 'M12 20h9 M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  undo: 'M3 7v6h6 M3 13a9 9 0 1 0 3-7.7L3 8',
  archive: 'M21 8v13H3V8 M1 3h22v5H1z M10 12h4',
  right: 'M9 18l6-6-6-6',
  down: 'M6 9l6 6 6-6',
  left: 'M19 12H5 M12 19l-7-7 7-7',
  wallet: 'M20 12V8H6a2 2 0 0 1 0-4h12v4 M4 6v12a2 2 0 0 0 2 2h14v-4 M18 12a2 2 0 0 0 0 4h4v-4z',
  copy: 'M9 9h13v13H9z M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8'
};
function Icon({ n, size = 18, sw = 1.8 }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>{(ICONS[n] || '').split(' M').map((d, i) => <path key={i} d={(i ? 'M' : '') + d} />)}</svg>);
}

/* ---------- small hooks ---------- */
function useForm(init) {
  const [f, setF] = useState(init);
  const set = (k) => (e) => { const v = e && e.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e; setF((p) => Object.assign({}, p, { [k]: v })); };
  return [f, set, setF];
}
function useRequestId() { const r = useRef(null); if (!r.current) r.current = uid('req'); return r.current; }

/* ---------- status ---------- */
const TONES = {
  Paid: 'ok', Completed: 'ok', Active: 'ok', Approved: 'ok', 'Handed Over': 'ok', Posted: 'ok', 'Fully Paid': 'ok',
  Partial: 'warn', Pending: 'warn', Reserved: 'warn', 'In Progress': 'warn', Overpaid: 'warn',
  Overdue: 'bad', Rejected: 'bad', Unpaid: 'bad', Cancelled: 'bad',
  Upcoming: 'info', Assigned: 'info', 'Under Construction': 'info', Available: 'info', 'Not Started': 'info',
  Inactive: 'mute', Reversed: 'mute', Reversal: 'mute', Archived: 'mute'
};
function Status({ v }) { return <span className={'badge t-' + (TONES[v] || 'mute')}>{v}</span>; }
function Flow({ dir }) { return dir === 'in' ? <span className="pill pill-in">Money in</span> : dir === 'out' ? <span className="pill pill-out">Money out</span> : <span className="pill pill-net">Net</span>; }

/* ---------- layout primitives ---------- */
function Card({ title, sub, actions, children, flush, className }) {
  return (<section className={'card ' + (className || '')}>
    {(title || actions) && <div className="card-h"><div><h2>{title}</h2>{sub && <small>{sub}</small>}</div>{actions && <div className="chips">{actions}</div>}</div>}
    {flush ? children : <div className="card-b">{children}</div>}
  </section>);
}
function PageHead({ title, sub, actions, flow }) {
  return (<div className="ph"><div><div className="chips" style={{ marginBottom: 6 }}>{flow && <Flow dir={flow} />}</div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{actions && <div className="ph-actions">{actions}</div>}</div>);
}
function Stat({ label, value, sub, flow, title }) {
  return (<div className="card stat"><div className="stat-l"><span>{label}</span>{flow && <Flow dir={flow} />}</div><div className="stat-v" title={title}>{value}</div>{sub && <div className="stat-s">{sub}</div>}</div>);
}
function Empty({ title, text, action, icon }) {
  return (<div className="empty"><Icon n={icon || 'file'} size={28} /><b>{title}</b>{text && <span style={{ maxWidth: 380 }}>{text}</span>}{action}</div>);
}
function Btn({ children, variant, size, icon, busy, ...rest }) {
  const cls = 'btn' + (variant === 'primary' ? ' btn-primary' : variant === 'danger' ? ' btn-danger' : variant === 'ghost' ? ' btn-ghost' : '') + (size === 'sm' ? ' btn-sm' : '');
  return (<button type="button" className={cls} {...rest} disabled={rest.disabled || busy}>{busy ? <span className="spin" /> : icon ? <Icon n={icon} size={size === 'sm' ? 14 : 16} /> : null}{children}</button>);
}
function Note({ tone, children, icon }) { return (<div className={'note t-' + (tone || 'info')} role={tone === 'bad' ? 'alert' : undefined}><Icon n={icon || (tone === 'bad' || tone === 'warn' ? 'alert' : 'info')} size={16} /><div>{children}</div></div>); }
function Progress({ parts }) { return (<div className="bar" role="img" aria-label={parts.map((p) => p.label + ' ' + Math.round(p.pct) + '%').join(', ')}>{parts.map((p, i) => <i key={i} style={{ width: Math.max(0, Math.min(100, p.pct)) + '%', background: p.color }} title={p.label} />)}</div>); }
function Avatar({ name, src, size = 34 }) {
  return src ? <img src={src} alt="" width={size} height={size} style={{ borderRadius: '50%', objectFit: 'cover' }} /> : <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials(name)}</span>;
}
function Tabs({ tabs, value, onChange }) {
  return (<div className="tabs" role="tablist">{tabs.map((t) => <button key={t.id} type="button" role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}>{t.label}{t.count != null ? ' (' + t.count + ')' : ''}</button>)}</div>);
}
function Seg({ options, value, onChange }) {
  return (<div className="seg" role="group">{options.map((o) => <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.label}</button>)}</div>);
}
function Chips({ options, value, onChange }) {
  return (<div className="chips" role="group">{options.map((o) => <button key={o.id} type="button" className="chip" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.label}{o.count != null ? ' · ' + o.count : ''}</button>)}</div>);
}
function SearchBox({ value, onChange, placeholder }) {
  const id = useId();
  return (<div className="search"><span className="ico"><Icon n="search" size={16} /></span><label htmlFor={id} className="sr">Search</label><input id={id} type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || 'Search'} /></div>);
}

/* ---------- form controls ---------- */
function Field({ label, err, hint, req, full, children }) {
  const id = useId();
  const child = React.isValidElement(children) ? React.cloneElement(children, { id: children.props.id || id, 'aria-invalid': err ? 'true' : undefined, 'aria-describedby': err ? id + '-e' : undefined }) : children;
  return (<div className={'field' + (full ? ' full' : '')}><label htmlFor={(children.props && children.props.id) || id}>{label}{req && <span className="req"> *</span>}</label>{child}{err && <span className="err" id={id + '-e'}>{err}</span>}{!err && hint && <span className="hint">{hint}</span>}</div>);
}
function Money({ value, onChange, ...rest }) { return (<div className="money"><span aria-hidden="true">৳</span><input className="inp" type="number" inputMode="decimal" min="0" step="any" value={value} onChange={(e) => onChange(e.target.value)} {...rest} /></div>); }
function Sel({ value, onChange, options, placeholder, ...rest }) {
  return (<select className="inp" value={value} onChange={(e) => onChange(e.target.value)} {...rest}>{placeholder !== undefined && <option value="">{placeholder}</option>}{options.map((o) => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}</select>);
}
/* Searchable picker. options: [{ value, label, sub, search }]. Matches any word typed against label, sub and search text (name, ID, phone, unit...). Shows the first 50 matches so it stays fast with many records. */
function SearchPick({ value, onChange, options, placeholder, disabled, emptyText, id, clearLabel }) {
  const [q, setQ] = useState(''); const [open, setOpen] = useState(false); const [hi, setHi] = useState(0); const ref = useRef(null);
  const cur = options.filter((o) => o.value === value)[0];
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const hits = options.filter((o) => { const hay = ((o.label || '') + ' ' + (o.sub || '') + ' ' + (o.search || '')).toLowerCase(); return terms.every((t) => hay.indexOf(t) >= 0); }).slice(0, 50);
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const pick = (o) => { onChange(o.value); setQ(''); setOpen(false); };
  if (cur && !open) return (<div className="sp-sel inp" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><span><b>{cur.label}</b>{cur.sub ? <span className="muted"> · {cur.sub}</span> : null}</span>{!disabled && <button type="button" className="link" aria-label={clearLabel || 'Change selection'} onClick={() => { onChange(''); setOpen(true); }}>Change</button>}</div>);
  return (<div ref={ref} style={{ position: 'relative' }}>
    <input id={id} className="inp" type="text" role="combobox" aria-expanded={open} aria-autocomplete="list" autoComplete="off" disabled={disabled} placeholder={placeholder || 'Type to search'} value={q}
      onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }}
      onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, hits.length - 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); } else if (e.key === 'Enter' && open && hits[hi]) { e.preventDefault(); pick(hits[hi]); } else if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); } }} />
    {open && <ul role="listbox" className="sp-list" style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)', zIndex: 60, maxHeight: 260, overflowY: 'auto', margin: 0, padding: 4, listStyle: 'none', background: 'var(--surface, #fff)', border: '1px solid var(--line, #d8dde3)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.14)' }}>
      {hits.length ? hits.map((o, i) => <li key={o.value} role="option" aria-selected={i === hi} onMouseDown={(e) => { e.preventDefault(); pick(o); }} onMouseEnter={() => setHi(i)} style={{ padding: '7px 10px', borderRadius: 6, cursor: 'pointer', background: i === hi ? 'var(--hover, rgba(0,0,0,.06))' : 'transparent' }}><b>{o.label}</b>{o.sub ? <span className="muted" style={{ marginLeft: 8, fontSize: 12.5 }}>{o.sub}</span> : null}</li>) : <li className="muted" style={{ padding: '8px 10px' }}>{emptyText || 'No matches'}</li>}
    </ul>}
  </div>);
}
function Txt({ value, onChange, ...rest }) { return <input className="inp" type="text" value={value} onChange={(e) => onChange(e.target.value)} {...rest} />; }
function DateIn({ value, onChange, max, ...rest }) { return <input className="inp" type="date" value={value} max={max} onChange={(e) => onChange(e.target.value)} {...rest} />; }
function Area({ value, onChange, ...rest }) { return <textarea className="inp" value={value} onChange={(e) => onChange(e.target.value)} {...rest} />; }
function FileIn({ onChange, accept }) { return <input className="inp" type="file" accept={accept || 'image/*,.pdf'} onChange={(e) => onChange(e.target.files && e.target.files[0] ? e.target.files[0] : null)} />; }

/* ---------- row action menu ---------- */
function RowMenu({ items, label, icon, text }) {
  const [pos, setPos] = useState(null);
  const btn = useRef(null);
  useEffect(() => {
    if (!pos) return;
    const t0 = Date.now(); const close = (e) => { if (e.type === 'keydown' && e.key !== 'Escape') return; if (e.type === 'scroll' && Date.now() - t0 < 250) return; setPos(null); };
    const down = (e) => { if (!e.target.closest || !e.target.closest('.pop-fixed')) setPos(null); };
    document.addEventListener('keydown', close); document.addEventListener('mousedown', down); window.addEventListener('scroll', close, true); window.addEventListener('resize', close);
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('mousedown', down); window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [pos]);
  const vis = items.filter((i) => !i.hidden);
  if (!vis.length) return null;
  const toggle = (e) => { e.stopPropagation(); if (pos) return setPos(null); const r = btn.current.getBoundingClientRect(); const h = vis.length * 36 + 12; setPos({ top: r.bottom + h > window.innerHeight ? Math.max(8, r.top - h) : r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) }); };
  return (<>
    <button ref={btn} type="button" className="btn btn-sm btn-ghost" style={text ? undefined : { padding: '4px 6px' }} aria-label={label || 'More actions'} aria-haspopup="menu" aria-expanded={!!pos} onClick={toggle}>{text ? <><Icon n={icon || 'more'} size={15} />{text}</> : <Icon n="more" size={18} sw={2.4} />}</button>
    {pos && <div className="pop-fixed" role="menu" style={{ top: pos.top, right: pos.right }}>{vis.map((i, k) => <button key={k} type="button" role="menuitem" disabled={i.disabled} className={'pop-i' + (i.danger ? ' danger' : '')} onClick={(e) => { e.stopPropagation(); setPos(null); i.onClick(); }}>{i.icon && <Icon n={i.icon} size={15} />}{i.label}</button>)}</div>}
  </>);
}

/* ---------- data table ---------- */
function DataTable({ cols, rows, rowKey, onRowClick, empty, pageSize = 10, foot, rowClass, initialSort, summary }) {
  const [sort, setSort] = useState(initialSort || null);
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [rows.length]);
  const sorted = useMemo(() => {
    if (!sort) return rows; const c = cols.find((x) => x.key === sort.key); if (!c) return rows;
    const val = c.val || ((r) => r[c.key]);
    const out = rows.slice().sort((a, b) => { const x = val(a), y = val(b); return typeof x === 'number' && typeof y === 'number' ? x - y : cmpStr(x == null ? '' : x, y == null ? '' : y); });
    return sort.dir < 0 ? out.reverse() : out;
  }, [rows, sort, cols]);
  const pages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1, cur = Math.min(page, pages - 1);
  const view = pageSize ? sorted.slice(cur * pageSize, (cur + 1) * pageSize) : sorted;
  if (!rows.length) return <Empty {...(empty || { title: 'Nothing to show', text: 'No records match.' })} />;
  const rk = rowKey || 'id';
  return (<>
    <div className="tbl-wrap"><table className="tbl">
      <thead><tr>{cols.map((c) => (<th key={c.key} className={c.align === 'r' ? 'r' : ''} aria-sort={sort && sort.key === c.key ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}>
        {c.noSort || c.key === 'actions' ? c.label : <button type="button" className="link" style={{ color: 'inherit', font: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit', fontWeight: 600 }} onClick={() => setSort((s) => s && s.key === c.key ? (s.dir > 0 ? { key: c.key, dir: -1 } : null) : { key: c.key, dir: 1 })}>{c.label}{sort && sort.key === c.key ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}</button>}
      </th>))}</tr></thead>
      <tbody>{view.map((r) => (<tr key={r[rk]} className={(onRowClick ? 'click ' : '') + (rowClass ? rowClass(r) : '')} tabIndex={onRowClick ? 0 : undefined} onClick={onRowClick ? () => onRowClick(r) : undefined} onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(r); } : undefined}>
        {cols.map((c) => <td key={c.key} className={c.align === 'r' ? 'r' : ''}>{c.render ? c.render(r) : r[c.key]}</td>)}
      </tr>))}</tbody>
      {foot && <tfoot><tr>{cols.map((c, i) => <td key={c.key} className={c.align === 'r' ? 'r' : ''}>{foot[c.key] != null ? foot[c.key] : (i === 0 ? 'Total' : '')}</td>)}</tr></tfoot>}
    </table></div>
    <div className="tbl-foot"><span>{summary || (pageSize ? 'Showing ' + (cur * pageSize + 1) + '–' + Math.min(sorted.length, (cur + 1) * pageSize) + ' of ' + sorted.length : sorted.length + ' rows')}</span>
      {pages > 1 && <span className="chips"><Btn size="sm" disabled={cur === 0} onClick={() => setPage(cur - 1)}>Previous</Btn><span>Page {cur + 1} of {pages}</span><Btn size="sm" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Next</Btn></span>}
    </div>
  </>);
}

/* ---------- modal ---------- */
const MODAL_STACK = [];
function Modal({ title, sub, onClose, children, footer, size }) {
  const tok = useRef({}); const box = useRef(null);
  useEffect(() => {
    MODAL_STACK.push(tok.current);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const key = (e) => { if (e.key === 'Escape' && MODAL_STACK[MODAL_STACK.length - 1] === tok.current) onClose(); };
    document.addEventListener('keydown', key);
    const first = box.current && box.current.querySelector('input:not([type=hidden]):not([disabled]),select,textarea');
    if (first) first.focus({ preventScroll: true });
    return () => { document.removeEventListener('keydown', key); MODAL_STACK.splice(MODAL_STACK.indexOf(tok.current), 1); document.body.style.overflow = prev; };
  }, []);
  return (<div className="ov" role="presentation"><div className={'modal ' + (size || '')} role="dialog" aria-modal="true" aria-label={title} ref={box}>
    <div className="modal-h"><div><h2>{title}</h2>{sub && <div className="muted" style={{ marginTop: 2 }}>{sub}</div>}</div><button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><Icon n="x" /></button></div>
    <div className="modal-b">{children}</div>
    {footer && <div className="modal-f">{footer}</div>}
  </div></div>);
}

/* ---------- error boundary ---------- */
class Boundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err: err }; }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.err) this.setState({ err: null }); }
  render() { return this.state.err ? <Card><Empty icon="alert" title="This page could not be shown" text={String(this.state.err.message || this.state.err)} action={<Btn onClick={() => this.setState({ err: null })}>Try again</Btn>} /></Card> : this.props.children; }
}

/* Official company logo: one component, one source file (00b_logo.js). Proportions are kept by sizing on height only. */
function BrandLogo({ height = 40, chip, className }) {
  return <img className={'brand-logo' + (chip ? ' logo-chip' : '') + (className ? ' ' + className : '')} src={BRAND_LOGO.url} alt="Apon Niketon Holdings logo" height={height} width={Math.round(height * BRAND_LOGO.w / BRAND_LOGO.h)} style={{ height: height, width: 'auto' }} />;
}

/* ---------- money + label helpers used across pages ---------- */
const M = (v) => <span className="num">{fmtMoney(v)}</span>;
function shName(db, id) { const s = Calc.byId(db.shareholders, id); return s ? s.full_name : '—'; }
function userName(db, id) { const u = Calc.byId(db.users, id); return u ? u.name : '—'; }
function ShLink({ id, children }) { const { db, go } = useApp(); const s = Calc.byId(db.shareholders, id); if (!s) return <span>—</span>; return <button type="button" className="link" onClick={(e) => { e.stopPropagation(); go('profile', { id: id }); }}>{children || s.full_name}</button>; }
function relatedLabel(db, d) {
  const t = d.related_type, id = d.related_id;
  if (t === 'shareholder') { const s = Calc.byId(db.shareholders, id); return s ? 'Shareholder · ' + s.code + ' ' + s.full_name : 'Shareholder'; }
  if (t === 'nominee') { const n = Calc.byId(db.nominees, id); return n ? 'Nominee · ' + n.name : 'Nominee'; }
  if (t === 'booking') { const b = Calc.byId(db.share_bookings, id); return b ? 'Booking · ' + b.code : 'Booking'; }
  if (t === 'unit') { const u = Calc.byId(db.units, id); return u ? 'Unit · ' + u.code : 'Unit'; }
  if (t === 'share_payment') { const p = Calc.byId(db.share_payments, id); return p ? 'Share payment · ' + p.receipt_no : 'Share payment'; }
  if (t === 'construction_payment') { const p = Calc.byId(db.construction_payments, id); return p ? 'Construction payment · ' + p.receipt_no : 'Construction payment'; }
  if (t === 'expense') { const e = Calc.byId(db.project_expenses, id); return e ? 'Expense · ' + e.code : 'Expense'; }
  return 'Project';
}
