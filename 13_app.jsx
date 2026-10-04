/* ============================================================
   13 APP SHELL — state container, routing, layout, global search,
   notifications, toasts, confirmation dialog and modal host.
   The only place that creates the repository and services.
   ============================================================ */
const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' }, { id: 'shareholders', label: 'Shareholders', icon: 'users' }, { id: 'sales', label: 'Share Sales', icon: 'tag' },
  { id: 'project', label: 'Project Details', icon: 'info' }, { id: 'units', label: 'Units', icon: 'building' }, { id: 'construction', label: 'Construction Contributions', icon: 'wrench' }, { id: 'expenses', label: 'Project Expenses', icon: 'receipt' },
  { id: 'payments', label: 'Payments', icon: 'card' }, { id: 'documents', label: 'Documents', icon: 'file' }, { id: 'reports', label: 'Reports', icon: 'chart' },
  { id: 'audit', label: 'Audit Log', icon: 'shield' }, { id: 'settings', label: 'Settings', icon: 'sliders' }
];
const PAGES = { project: ProjectPage, dashboard: DashboardPage, shareholders: ShareholdersPage, profile: ProfilePage, sales: SalesPage, units: UnitsPage, construction: ConstructionPage, expenses: ExpensesPage, payments: PaymentsPage, documents: DocumentsPage, reports: ReportsPage, audit: AuditPage, settings: SettingsPage };
function initialRoute() { let h = ''; try { h = (location.hash || '').replace('#', ''); } catch (e) { } return { name: NAV.some((n) => n.id === h) ? h : 'dashboard', params: {}, nonce: 0 }; }

function usePopover() {
  const [open, setOpen] = useState(false); const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  return [open, setOpen, ref];
}

function GlobalSearch() {
  const { db, go, open } = useApp(); const [q, setQ] = useState(''); const [show, setShow, ref] = usePopover();
  const t = q.trim().toLowerCase();
  const groups = useMemo(() => {
    if (t.length < 2) return [];
    const has = (s) => String(s).toLowerCase().indexOf(t) >= 0, g = [];
    const add = (title, items) => { if (items.length) g.push({ title: title, items: items.slice(0, 4) }); };
    add('Shareholders', db.shareholders.filter((s) => live(s) && has(s.full_name + ' ' + s.code + ' ' + s.phone + ' ' + s.nid)).map((s) => ({ key: s.id, label: s.full_name, sub: s.code + ' · ' + s.phone, act: () => go('profile', { id: s.id }) })));
    add('Units', db.units.filter((u) => live(u) && has(u.code)).map((u) => ({ key: u.id, label: 'Unit ' + u.code, sub: u.shareholder_id ? shName(db, u.shareholder_id) : 'Available', act: () => go('units') })));
    add('Share bookings', db.share_bookings.filter((b) => live(b) && has(b.code)).map((b) => ({ key: b.id, label: b.code, sub: shName(db, b.shareholder_id), act: () => go('profile', { id: b.shareholder_id, tab: 'bookings' }) })));
    add('Payments', db.share_payments.filter((p) => live(p) && has(p.receipt_no + ' ' + p.reference)).map((p) => ({ key: p.id, label: p.receipt_no, sub: shName(db, p.shareholder_id) + ' · ' + fmtMoney(p.amount), act: () => open('receipt', { kind: 'share', id: p.id }) })).concat(db.construction_payments.filter((p) => live(p) && has(p.receipt_no + ' ' + p.reference)).map((p) => ({ key: p.id, label: p.receipt_no, sub: shName(db, p.shareholder_id) + ' · ' + fmtMoney(p.amount), act: () => open('receipt', { kind: 'cons', id: p.id }) }))));
    add('Contractors and suppliers', db.contractors.filter((c) => live(c) && has(c.name + ' ' + c.trade)).map((c) => ({ key: c.id, label: c.name, sub: c.trade, act: () => go('expenses', { tab: 'contractors' }) })));
    add('Expenses', db.project_expenses.filter((e) => live(e) && has(e.code + ' ' + e.description)).map((e) => ({ key: e.id, label: e.code, sub: e.description, act: () => go('expenses') })));
    add('Documents', db.documents.filter((d) => live(d) && has(d.file_name + ' ' + d.code)).map((d) => ({ key: d.id, label: d.file_name, sub: d.code, act: () => open('docView', { id: d.id }) })));
    return g;
  }, [db, t]);
  return (<div className="gsearch" ref={ref}>
    <span className="ico"><Icon n="search" size={16} /></span><label htmlFor="gs" className="sr">Search everything</label>
    <input id="gs" type="search" placeholder="Search shareholders, units, receipts…" value={q} autoComplete="off" onFocus={() => setShow(true)} onChange={(e) => { setQ(e.target.value); setShow(true); }} />
    {show && t.length >= 2 && <div className="pop" style={{ left: 0, right: 0, top: 'calc(100% + 6px)' }}>{groups.length ? groups.map((g) => (<div key={g.title}><div className="pop-h">{g.title}</div>{g.items.map((i) => <button key={i.key} type="button" className="pop-i" onClick={() => { setShow(false); setQ(''); i.act(); }}><div style={{ minWidth: 0 }}><div style={{ fontWeight: 600 }}>{i.label}</div><div className="muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.sub}</div></div></button>)}</div>)) : <div className="empty" style={{ padding: 22 }}>No matches for “{q}”.</div>}</div>}
  </div>);
}

function NotificationsMenu() {
  const { db, go } = useApp(); const [open, setOpen, ref] = usePopover(); const items = useMemo(() => Calc.notifications(db), [db]);
  return (<div ref={ref} style={{ position: 'relative' }}>
    <button type="button" className="icon-btn" aria-label={'Notifications' + (items.length ? ', ' + items.length + ' new' : '')} aria-expanded={open} onClick={() => setOpen(!open)}><Icon n="bell" />{items.length > 0 && <span className="dot">{items.length}</span>}</button>
    {open && <div className="pop" style={{ right: 0, top: 'calc(100% + 6px)', width: 330 }}><div className="pop-h">Needs attention</div>{items.length ? items.map((n, i) => <button key={i} type="button" className="pop-i" onClick={() => { setOpen(false); go(n.go[0], n.go[1]); }}><span className={'badge t-' + n.tone} style={{ padding: 0, width: 8, height: 8, borderRadius: '50%' }} /><div><div style={{ fontWeight: 600 }}>{n.title}</div><div className="muted" style={{ fontSize: 12 }}>{n.text}</div></div></button>) : <div className="empty" style={{ padding: 22 }}>Nothing needs attention.</div>}</div>}
  </div>);
}
function UserMenu() {
  const { db, user, setUserId, toast, go } = useApp(); const [open, setOpen, ref] = usePopover();
  return (<div ref={ref} style={{ position: 'relative' }}>
    <button type="button" className="user-btn" aria-expanded={open} aria-label="Account menu" onClick={() => setOpen(!open)}><Avatar name={user.name} size={30} /><span className="ub-t" style={{ textAlign: 'left', lineHeight: 1.2 }}><b style={{ display: 'block', fontSize: 13 }}>{user.name}</b><span className="muted" style={{ fontSize: 11.5 }}>{user.role}</span></span></button>
    {open && <div className="pop" style={{ right: 0, top: 'calc(100% + 6px)', width: 260 }}><div className="pop-h">Switch user</div>{db.users.map((u) => <button key={u.id} type="button" className="pop-i" onClick={() => { setUserId(u.id); setOpen(false); toast.info('Signed in as ' + u.name, u.role + ' access'); }}><Avatar name={u.name} size={28} /><div><div style={{ fontWeight: 600 }}>{u.name}{u.id === user.id ? ' ✓' : ''}</div><div className="muted" style={{ fontSize: 12 }}>{u.title} · {u.role}</div></div></button>)}<div className="nav-sep" /><button type="button" className="pop-i" onClick={() => { setOpen(false); go('settings'); }}><Icon n="sliders" size={15} />Settings</button></div>}
  </div>);
}

function ConfirmHost({ state, onDone }) {
  const [reason, setReason] = useState(''); const [err, setErr] = useState('');
  const o = state.opts;
  const ok = () => { if (o.reason && !reason.trim()) { setErr('Give a reason. It is saved in the audit log.'); return; } onDone({ ok: true, reason: reason.trim() }); };
  return (<Modal title={o.title} size="narrow" onClose={() => onDone({ ok: false })} footer={<><Btn onClick={() => onDone({ ok: false })}>Cancel</Btn><button type="button" className={'btn ' + (o.danger ? 'btn-danger solid' : 'btn-primary')} onClick={ok}>{o.confirmLabel || 'Confirm'}</button></>}>
    {o.message && <p style={{ color: 'var(--ink-2)' }}>{o.message}</p>}
    {o.reason && <Field label="Reason" req err={err}><Area value={reason} onChange={(v) => { setReason(v); setErr(''); }} placeholder="Recorded in the audit log" /></Field>}
  </Modal>);
}

function LoadingShell() {
  return (<div className="shell"><aside className="side"><div className="brand"><BrandLogo height={54} chip /><div className="brand-co">{APP_CONFIG.companyName}</div><div className="brand-sys">{APP_CONFIG.systemName}</div></div>{NAV.map((n) => <div key={n.id} className="skel" style={{ height: 34, margin: '3px 4px' }} />)}</aside>
    <main className="main"><div className="top"><div className="skel" style={{ height: 36, width: 260 }} /></div><div className="content"><div className="skel" style={{ height: 40, width: 220 }} /><div className="grid g-auto">{[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="skel" style={{ height: 88 }} />)}</div><div className="skel" style={{ height: 280 }} /><span className="sr" role="status">Loading project data</span></div></main></div>);
}

function App() {
  const repoRef = useRef(null); if (!repoRef.current) repoRef.current = createRepository(); const repo = repoRef.current;
  const dbRef = useRef(null), userRef = useRef(null);
  const [db, setDb] = useState(null); const [loadErr, setLoadErr] = useState(null); const [userId, setUserId] = useState('usr_admin');
  const [route, setRoute] = useState(initialRoute); const [modals, setModals] = useState([]); const [toasts, setToasts] = useState([]); const [conf, setConf] = useState(null); const [drawer, setDrawer] = useState(false);
  const user = db ? (db.users.filter((u) => u.id === userId)[0] || db.users[0]) : null; userRef.current = user;
  const refresh = useCallback(async () => { const s = repo.snapshot(); dbRef.current = s; setDb(s); }, [repo]);
  useEffect(() => { repo.loadAll().then((s) => { dbRef.current = s; setDb(s); }).catch(setLoadErr); }, []);
  const S = useMemo(() => createServices({ repo: repo, getDb: () => dbRef.current, getUser: () => userRef.current, refresh: refresh }), [repo, refresh]);
  const push = useCallback((kind, title, text) => { const id = uid('t'); setToasts((t) => t.concat([{ id: id, kind: kind, title: title, text: text }])); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7500 : 4500); }, []);
  const toast = useMemo(() => ({ success: (t, m) => push('success', t, m), error: (t, m) => push('error', t, m), info: (t, m) => push('info', t, m) }), [push]);
  const run = useCallback(async (fn, okMsg) => {
    try { const r = await fn(); if (okMsg) toast.success(okMsg); return { ok: true, r: r }; }
    catch (e) { if (e.code === 'NO_CHANGE') toast.info(e.title, e.message); else toast.error(e.title || 'Something went wrong', e.message || String(e)); return { ok: false, e: e }; }
  }, [toast]);
  const confirm = useCallback((opts) => new Promise((res) => setConf({ opts: opts, res: res })), []);
  const open = useCallback((name, props) => { const id = uid('m'); setModals((m) => m.concat([{ id: id, name: name, props: props || {} }])); return id; }, []);
  const go = useCallback((name, params) => { setRoute((r) => ({ name: name, params: params || {}, nonce: r.nonce + 1 })); setDrawer(false); try { if (name !== 'profile') history.replaceState(null, '', '#' + name); } catch (e) { } try { window.scrollTo(0, 0); } catch (e) { } }, []);
  const ctx = useMemo(() => ({ db: db, user: user, S: S, toast: toast, run: run, confirm: confirm, open: open, go: go, route: route, repoKind: repo.kind, setUserId: setUserId }), [db, user, S, toast, run, confirm, open, go, route, repo]);
  useEffect(() => { if (db && user) document.title = db.settings[0].project_name + ' · ' + db.settings[0].company_name; }, [db]);
  if (loadErr) return <div className="content"><Card><Empty icon="alert" title="The project data could not be loaded" text={String(loadErr.message || loadErr)} action={<Btn variant="primary" onClick={() => location.reload()}>Reload</Btn>} /></Card></div>;
  if (!db) return <LoadingShell />;
  const st = db.settings[0], Page = PAGES[route.name] || DashboardPage, active = route.name === 'profile' ? 'shareholders' : route.name;
  const bottom = [{ id: 'dashboard', label: 'Home', icon: 'dashboard' }, { id: 'shareholders', label: 'People', icon: 'users' }, { id: 'sales', label: 'Sales', icon: 'tag' }, { id: 'payments', label: 'Payments', icon: 'card' }];
  return (<AppCtx.Provider value={ctx}>
    <div className="shell">
      {drawer && <div className="scrim" onClick={() => setDrawer(false)} />}
      <aside className={'side' + (drawer ? ' open' : '')} aria-label="Main navigation">
        <div className="brand"><BrandLogo height={54} chip /><div className="brand-co">{st.company_name}</div><div className="brand-sys">{APP_CONFIG.systemName}</div><div style={{ marginTop: 10, fontWeight: 600, color: 'var(--primary-text)', lineHeight: 1.3 }}>{st.project_name}</div></div>
        <nav className="nav">{NAV.map((n) => <Fragment key={n.id}>{n.id === 'audit' && <div className="nav-sep" />}<button type="button" aria-current={active === n.id ? 'page' : undefined} onClick={() => go(n.id)}><Icon n={n.icon} size={18} />{n.label}</button></Fragment>)}</nav>
        <div className="side-foot"><div>Storage · {repo.kind}</div></div>
      </aside>
      <div className="main">
        <header className="top">
          <button type="button" className="icon-btn menu-btn" aria-label="Open menu" onClick={() => setDrawer(true)}><Icon n="menu" /></button>
          <div className="proj"><small>{st.company_name}</small><b>{st.project_name}</b></div>
          <GlobalSearch />
          <div className="top-r"><NotificationsMenu /><UserMenu /></div>
        </header>
        <main className="content" id="main"><Boundary resetKey={route.name + route.nonce}><Page key={route.name + route.nonce} {...route.params} /></Boundary></main>
      </div>
    </div>
    <nav className="bottom-nav" aria-label="Quick navigation">{bottom.map((n) => <button key={n.id} type="button" aria-current={active === n.id ? 'page' : undefined} onClick={() => go(n.id)}><Icon n={n.icon} size={20} />{n.label}</button>)}<button type="button" onClick={() => setDrawer(true)}><Icon n="menu" size={20} />More</button></nav>
    {modals.map((m) => { const C = MODAL_REGISTRY[m.name]; return C ? <C key={m.id} {...m.props} onClose={() => setModals((x) => x.filter((y) => y.id !== m.id))} /> : null; })}
    {conf && <ConfirmHost state={conf} onDone={(r) => { conf.res(r); setConf(null); }} />}
    <div className="toasts" role="status" aria-live="polite">{toasts.map((t) => <div key={t.id} className={'toast ' + t.kind}><Icon n={t.kind === 'error' ? 'alert' : t.kind === 'success' ? 'check' : 'info'} size={17} /><div><b>{t.title}</b>{t.text && <span>{t.text}</span>}</div></div>)}</div>
  </AppCtx.Provider>);
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
