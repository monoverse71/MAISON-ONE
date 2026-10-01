/* ============================================================
   12 PAGES D — Reports, Audit log, Settings
   ============================================================ */
function ReportsPage() {
  const { db, open } = useApp();
  const [rid, setRid] = useState('shareholders'); const rep = REPORTS.filter((r) => r.id === rid)[0];
  const [f, setF] = useState({ from: '', to: '', status: '', q: '' });
  useEffect(() => { setF((p) => Object.assign({}, p, { status: '', q: '' })); }, [rid]);
  const res = useMemo(() => runReport(rep, db, f), [rep, db, f]);
  const rows = res.rows.map((r, i) => Object.assign({ _id: i }, r));
  const cols = rep.cols.map((c) => ({ key: c.k, label: c.l, align: c.t === 'money' || c.t === 'int' ? 'r' : undefined, render: (r) => c.t === 'badge' ? <Status v={r[c.k]} /> : c.t === 'money' ? M(r[c.k]) : formatCell(c, r[c.k]) }));
  const foot = {}; rep.cols.forEach((c) => { if (res.totals[c.k] != null) foot[c.k] = c.t === 'money' ? fmtMoney(res.totals[c.k]) : res.totals[c.k]; });
  const isOverall = rep.id === 'overall';
  const exp = (format) => open('exportPreview', { report: rep, rows: res.rows, totals: res.totals, format: format, filters: f });
  return (<>
    <PageHead title="Reports" sub="Filter, review and export. Exports are built from the same report definitions a server can later turn into PDF and Excel." demo />
    <div className="rep-grid">
      <Card flush><div style={{ padding: 6, display: 'grid', gap: 2 }} className="nav" role="tablist" aria-label="Reports">{REPORTS.map((r) => <button key={r.id} type="button" role="tab" aria-selected={r.id === rid} aria-current={r.id === rid ? 'page' : undefined} onClick={() => setRid(r.id)}><Icon n="chart" size={16} />{r.title}</button>)}</div></Card>
      <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
        <Card title={rep.title} sub={rep.desc} actions={<><Btn size="sm" variant="primary" icon="printer" onClick={() => open('printPreview', { doc: 'report', args: { reportId: rep.id, filters: f } })}>Print A4</Btn><Btn size="sm" icon="download" onClick={() => exp('csv')}>CSV</Btn><Btn size="sm" icon="download" onClick={() => exp('xlsx')}>Excel</Btn><Btn size="sm" icon="download" onClick={() => exp('pdf')}>PDF</Btn></>}>
          <div className="frm" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>
            <Field label={'From · ' + rep.dateLabel}><DateIn value={f.from} onChange={(v) => setF((p) => Object.assign({}, p, { from: v }))} /></Field>
            <Field label="To"><DateIn value={f.to} onChange={(v) => setF((p) => Object.assign({}, p, { to: v }))} /></Field>
            {!isOverall && <Field label="Status"><Sel value={f.status} onChange={(v) => setF((p) => Object.assign({}, p, { status: v }))} options={rep.statuses} placeholder="All statuses" /></Field>}
            {!isOverall && <Field label="Search"><Txt value={f.q} onChange={(v) => setF((p) => Object.assign({}, p, { q: v }))} placeholder="Name, ID, reference" /></Field>}
          </div>
          {(f.from || f.to || f.status || f.q) && <div style={{ marginTop: 10 }}><Btn size="sm" variant="ghost" onClick={() => setF({ from: '', to: '', status: '', q: '' })}>Clear filters</Btn></div>}
        </Card>
        <Card flush>
          {isOverall ? <div className="card-b">{['Money in', 'Money out', 'Net', 'Outstanding (as of today)', 'Position (as of today)'].map((sec) => (<div key={sec} style={{ marginBottom: 14 }}><div className="sect-t">{sec}</div><div className="sumbox">{res.rows.filter((r) => r.section === sec).map((r) => <div key={r.item} className={'sumrow' + (/^Total|Net|Available/.test(r.item) ? ' big' : '')}><span>{r.item}</span><span>{fmtMoney(r.amount)}</span></div>)}</div></div>))}</div>
            : <DataTable cols={cols} rows={rows} rowKey="_id" pageSize={12} foot={rows.length ? foot : null} empty={{ title: 'No rows match', text: 'Widen the dates or clear the status and search.', icon: 'chart' }} />}
        </Card>
      </div>
    </div>
  </>);
}

/* =================== AUDIT LOG =================== */
function AuditDetail({ id, onClose }) {
  const { db } = useApp(); const a = Calc.byId(db.audit_logs, id); if (!a) return null;
  const J = (o) => o ? JSON.stringify(o, null, 2) : '—';
  return (<Modal title={a.action} sub={fmtDateTime(a.at)} size="wide" onClose={onClose} footer={<Btn onClick={onClose}>Close</Btn>}>
    <dl className="dl"><dt>Who</dt><dd>{a.user_name} ({a.role})</dd><dt>Record type</dt><dd>{a.entity_type.replace('_', ' ')}</dd><dt>Record ID</dt><dd className="mono">{a.entity_id}</dd><dt>Summary</dt><dd>{a.summary}</dd><dt>Reason</dt><dd>{a.reason || '—'}</dd></dl>
    {(a.before || a.after) && <div className="grid g2"><div><div className="sect-t">Before</div><pre className="mono card" style={{ padding: 12, margin: 0, overflow: 'auto' }}>{J(a.before)}</pre></div><div><div className="sect-t">After</div><pre className="mono card" style={{ padding: 12, margin: 0, overflow: 'auto' }}>{J(a.after)}</pre></div></div>}
  </Modal>);
}
MODAL_REGISTRY.audit = AuditDetail;

function AuditPage() {
  const { db, open } = useApp();
  const [q, setQ] = useState(''); const [act, setAct] = useState(''); const [ent, setEnt] = useState(''); const [usr, setUsr] = useState('');
  const logs = useMemo(() => db.audit_logs.slice().sort((a, b) => b.at.localeCompare(a.at)), [db]);
  const rows = logs.filter((a) => (!act || a.action === act) && (!ent || a.entity_type === ent) && (!usr || a.user_id === usr) && (!q.trim() || (a.summary + ' ' + a.action + ' ' + (a.reason || '')).toLowerCase().indexOf(q.trim().toLowerCase()) >= 0));
  const uniq = (k) => Array.from(new Set(logs.map((a) => a[k]))).sort();
  const cols = [
    { key: 'at', label: 'When', render: (a) => <span className="num">{fmtDateTime(a.at)}</span> },
    { key: 'user_name', label: 'Who', render: (a) => <div>{a.user_name}<div className="muted" style={{ fontSize: 12 }}>{a.role}</div></div> },
    { key: 'action', label: 'Action', render: (a) => <b>{a.action}</b> },
    { key: 'entity_type', label: 'Record', render: (a) => a.entity_type.replace('_', ' ') },
    { key: 'summary', label: 'Summary', render: (a) => <div style={{ minWidth: 260 }}>{a.summary}{a.reason && <div className="muted" style={{ fontSize: 12 }}>Reason: {a.reason}</div>}</div> }
  ];
  return (<>
    <PageHead title="Audit log" sub="Every important action, who did it and when. Entries cannot be edited or deleted." demo />
    <Card flush>
      <div className="toolbar"><SearchBox value={q} onChange={setQ} placeholder="Search summary or reason" />
        <div style={{ minWidth: 180 }}><Sel value={act} onChange={setAct} options={uniq('action')} placeholder="All actions" aria-label="Action" /></div>
        <div style={{ minWidth: 160 }}><Sel value={ent} onChange={setEnt} options={uniq('entity_type').map((e) => ({ value: e, label: e.replace('_', ' ') }))} placeholder="All record types" aria-label="Record type" /></div>
        <div style={{ minWidth: 160 }}><Sel value={usr} onChange={setUsr} options={db.users.map((u) => ({ value: u.id, label: u.name }))} placeholder="All users" aria-label="User" /></div></div>
      <DataTable cols={cols} rows={rows} pageSize={14} onRowClick={(a) => open('audit', { id: a.id })} summary={rows.length + ' of ' + logs.length + ' entries'} empty={{ title: 'No entries match', text: 'Clear the search or filters.', icon: 'shield' }} />
    </Card>
  </>);
}

/* =================== SETTINGS =================== */
const TABLE_MAP = [['shareholders', 'shareholders'], ['nominees', 'nominees'], ['units', 'units'], ['share_bookings', 'share_bookings'], ['share_payments', 'share_payments'], ['construction_plans', 'construction_plans'], ['construction_payments', 'construction_payments'], ['project_expenses', 'project_expenses'], ['contractors', 'contractors'], ['contract_installments', 'contract_installments'], ['documents', 'documents'], ['audit_logs', 'audit_logs'], ['users', 'users']];
function SettingsPage() {
  const { db, user, S, run, confirm, repoKind, setUserId } = useApp();
  const st = db.settings[0], admin = can(user, 'settings');
  const [f, set] = useForm({ project_name: st.project_name, company_name: st.company_name, total_shares: String(st.total_shares), default_share_price: String(st.default_share_price) });
  const [errs, setErrs] = useState({}); const [busy, setBusy] = useState(false);
  const sold = Calc.sharesSold(db);
  const save = async () => {
    const e = {}; if (!f.project_name.trim()) e.project_name = 'Enter the project name.'; if (!f.company_name.trim()) e.company_name = 'Enter the company name.';
    const ts = Number(f.total_shares); if (!ts || ts < 1 || Math.floor(ts) !== ts) e.total_shares = 'Enter a whole number of shares.'; else if (ts < sold) e.total_shares = sold + ' shares are already sold. The total cannot be lower.';
    if (!(Number(f.default_share_price) > 0)) e.default_share_price = 'Enter a price above zero.';
    setErrs(e); if (V.hasErrors(e)) return; setBusy(true);
    await run(() => S.updateSettings({ project_name: f.project_name.trim(), company_name: f.company_name.trim(), total_shares: ts, default_share_price: Number(f.default_share_price) }), 'Settings saved'); setBusy(false);
  };
  const archived = []; PK_TABLES.forEach((t) => { (db[t] || []).forEach((r) => { if (r.archived_at) archived.push({ id: t + r.id, table: t, label: r.code || r.name || r.full_name || r.id, at: r.archived_at, by: userName(db, r.archived_by), reason: r.archive_reason || '—' }); }); });
  const reset = async () => { const a = await confirm({ title: 'Reset demo data?', message: 'This replaces everything in this prototype with the original sample records, including any changes you made.', confirmLabel: 'Reset', danger: true }); if (a.ok) run(() => S.resetDemo(), 'Demo data restored'); };
  const READY = [['Sign-in and roles', 'users table maps to Supabase Auth plus a profiles.role column. Role checks already run in the service layer (can()).', 'Wire up'], ['Row level security', 'One policy per table by role: Admin all, Accountant read and insert, Viewer read. Ledger tables get no update or delete policy.', 'Write policies'], ['File storage', 'documents.storage_path points at a private bucket. MockStorage is the only class to swap.', 'Create bucket'], ['Audit log', 'audit_logs rows are written in the same batch as the change. In Postgres, run the batch as one RPC and block update/delete with a trigger.', 'Add trigger'], ['Soft delete', 'archived_at, archived_by and archive_reason exist on every table. There is no hard delete anywhere.', 'Ready'], ['Reversals', 'Payments and expenses are append-only. Corrections add a negative entry that points at the original.', 'Ready'], ['Backups and recovery', 'Enable daily backups and point-in-time recovery in the Supabase project settings.', 'Configure']];
  return (<>
    <PageHead title="Settings" sub="Project identity, access and how this prototype maps onto the future database." demo />
    <div className="grid g2">
      <Card title="Project identity" sub="Version 1 manages one project. Names are read from here, not fixed in the pages.">
        <div className="frm">
          <Field label="Company name" req err={errs.company_name}><Txt value={f.company_name} onChange={set('company_name')} disabled={!admin} /></Field>
          <Field label="Project name" req err={errs.project_name}><Txt value={f.project_name} onChange={set('project_name')} disabled={!admin} /></Field>
          <Field label="Total shares in the project" req err={errs.total_shares} hint={sold + ' sold so far'}><input className="inp" type="number" min="1" value={f.total_shares} onChange={(e) => set('total_shares')(e.target.value)} disabled={!admin} /></Field>
          <Field label="Default price per share" req err={errs.default_share_price}><Money value={f.default_share_price} onChange={set('default_share_price')} disabled={!admin} /></Field>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14, alignItems: 'center' }}>{!admin && <span className="hint">Only an Admin can change these.</span>}<Btn variant="primary" busy={busy} disabled={!admin} onClick={save}>Save settings</Btn></div>
      </Card>
      <Card title="Signed in as" sub="Prototype only. Switch role to see what each one can do.">
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="Demo user"><Sel value={user.id} onChange={setUserId} options={db.users.map((u) => ({ value: u.id, label: u.name + ' · ' + u.role }))} /></Field>
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Role</th><th>Add records</th><th>Reverse</th><th>Approve</th><th>Archive</th><th>Settings</th></tr></thead><tbody>
            {Object.keys(PERMS).map((role) => <tr key={role}><td><b>{role}</b></td>{['write', 'reverse', 'approve', 'archive', 'settings'].map((p) => <td key={p}>{PERMS[role].indexOf(p) >= 0 ? <span className="badge t-ok">Yes</span> : <span className="muted">No</span>}</td>)}</tr>)}
          </tbody></table></div>
        </div>
      </Card>
    </div>
    <Card title="Database readiness" sub={'Storage in use: ' + repoKind + '. Nothing is saved between visits in this prototype.'}>
      <div className="grid g2">
        <div><div className="sect-t">Tables and current rows</div><div className="tbl-wrap"><table className="tbl"><thead><tr><th>PostgreSQL table</th><th className="r">Rows</th></tr></thead><tbody>{TABLE_MAP.map((t) => <tr key={t[0]}><td className="mono">{t[1]}</td><td className="r">{(db[t[0]] || []).length}</td></tr>)}</tbody></table></div></div>
        <div><div className="sect-t">Supabase checklist</div><div style={{ display: 'grid', gap: 10 }}>{READY.map((r) => (<div key={r[0]} style={{ display: 'grid', gap: 2 }}><div className="chips" style={{ justifyContent: 'space-between' }}><b>{r[0]}</b><span className={'badge ' + (r[2] === 'Ready' ? 't-ok' : 't-warn')}>{r[2]}</span></div><span className="muted">{r[1]}</span></div>))}</div></div>
      </div>
    </Card>
    <Card title="Archived records" sub="Archived items are hidden from lists and kept for the audit trail." flush>
      <DataTable rows={archived} pageSize={6} empty={{ title: 'Nothing archived', text: 'Archived shareholders, bookings and documents will be listed here.', icon: 'archive' }} cols={[{ key: 'table', label: 'Record type', render: (r) => <span className="mono">{r.table}</span> }, { key: 'label', label: 'Record' }, { key: 'at', label: 'Archived', render: (r) => fmtDateTime(r.at) }, { key: 'by', label: 'By' }, { key: 'reason', label: 'Reason' }]} />
    </Card>
    <Card title="Sample data"><div className="chips" style={{ justifyContent: 'space-between' }}><span className="muted" style={{ maxWidth: 560 }}>Every record here is fictional and marked as sample data. Clear it before real use.</span><Btn variant="danger" disabled={!admin} onClick={reset}>Reset sample data</Btn></div></Card>
  </>);
}
