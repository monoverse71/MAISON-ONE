/* ============================================================
   09 PAGES A — Dashboard, Shareholders, Shareholder 360° profile,
   plus the shared payment-ledger table used on several pages.
   ============================================================ */
function buildLedger(db, opts) {
  opts = opts || {}; const out = [];
  const add = (type, p) => {
    if (!live(p) || (opts.shareholderId && p.shareholder_id !== opts.shareholderId)) return;
    const b = type === 'share' ? Calc.byId(db.share_bookings, p.booking_id) : null, u = type === 'cons' ? Calc.byId(db.units, p.unit_id) : null;
    out.push({ id: p.id, type: type, rec: p, receipt: p.receipt_no, date: p.payment_date, shareholder_id: p.shareholder_id, who: shName(db, p.shareholder_id), target: type === 'share' ? (b ? b.code : '—') : (u ? u.code : '—'), amount: p.amount, method: p.method, reference: p.reference || '—', status: p.kind === 'reversal' ? 'Reversal' : p.status, canReverse: p.kind === 'payment' && p.status === 'Posted' });
  };
  db.share_payments.forEach((p) => add('share', p)); db.construction_payments.forEach((p) => add('cons', p));
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.receipt.localeCompare(a.receipt));
}
function TypePill({ type }) { return type === 'share' ? <span className="pill pill-share">Land share</span> : <span className="pill pill-cons">Construction</span>; }

function LedgerTable({ rows, showWho = true, pageSize = 10, empty }) {
  const { user, open } = useApp();
  const cols = [
    { key: 'receipt', label: 'Receipt', render: (r) => <span className="mono">{r.receipt}</span> },
    { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
    { key: 'type', label: 'Type', render: (r) => <TypePill type={r.type} /> },
    showWho && { key: 'who', label: 'Shareholder', render: (r) => <ShLink id={r.shareholder_id} /> },
    { key: 'target', label: 'For' },
    { key: 'method', label: 'Method' },
    { key: 'reference', label: 'Reference', render: (r) => <span className="mono">{r.reference}</span> },
    { key: 'amount', label: 'Amount', align: 'r', render: (r) => M(r.amount) },
    { key: 'status', label: 'Status', render: (r) => <Status v={r.status} /> },
    { key: 'actions', label: '', align: 'r', render: (r) => (<div className="act"><RowMenu items={[
      { label: 'View receipt', icon: 'receipt', onClick: () => open('receipt', { kind: r.type, id: r.id }) },
      { label: 'Print receipt (A4)', icon: 'printer', onClick: () => open('printPreview', { doc: 'receipt', args: { kind: r.type, id: r.id } }) },
      { label: 'Reverse entry', icon: 'undo', danger: true, hidden: !(r.canReverse && can(user, 'reverse')), onClick: () => open('reverse', { kind: r.type, id: r.id }) }
    ]} /></div>) }
  ].filter(Boolean);
  return <DataTable cols={cols} rows={rows} pageSize={pageSize} rowClass={(r) => r.rec.status === 'Reversed' ? 'strike' : ''} empty={empty || { title: 'No payments yet', text: 'Recorded payments appear here.', icon: 'card' }} />;
}

function Timeline({ logs, empty }) {
  if (!logs.length) return <Empty icon="clock" title="No activity yet" text={empty || 'Actions on this record will be listed here.'} />;
  return (<ul className="tl">{logs.map((a) => (<li key={a.id}><i /><div><div><b>{a.action}</b> <span className="muted">· {a.entity_type.replace('_', ' ')}</span></div><div>{a.summary}</div>{a.reason && <div className="muted">Reason: {a.reason}</div>}<div className="muted" style={{ fontSize: 12 }}>{fmtDateTime(a.at)} · {a.user_name} ({a.role})</div></div></li>))}</ul>);
}

/* =================== DASHBOARD =================== */
function DashboardPage() {
  const { db, go } = useApp();
  const d = useMemo(() => Calc.dashboard(db), [db]);
  const avail = d.totalShares - d.sharesSold, active = db.shareholders.filter((s) => live(s) && s.status === 'Active').length;
  const rDue = (u) => u.status === 'Overdue' ? <span className="badge t-bad">{daysBetween(u.due_date, TODAY)} days overdue</span> : <span className="muted">{daysBetween(TODAY, u.due_date) === 0 ? 'Due today' : 'in ' + daysBetween(TODAY, u.due_date) + ' days'}</span>;
  const overviewItems = { inn: [{ label: 'Land share collection', value: d.shareCollected, color: 'var(--s-share)' }, { label: 'Construction contributions', value: d.consCollected, color: 'var(--s-cons)' }], out: [{ label: 'Project construction expenses', value: d.expense, color: 'var(--s-out)' }] };
  const scale = Math.max(d.shareCollected, d.consCollected, d.expense, d.shareDue + d.consDue, 1);
  return (<>
    <PageHead title="Dashboard" sub={'Money in and money out for ' + db.settings[0].project_name + '.'} demo={db.users && db.settings[0]._demo} actions={<><Btn icon="tag" onClick={() => go('sales', { newBooking: true })}>New share booking</Btn><Btn icon="receipt" onClick={() => go('expenses', { newExpense: true })}>Add project expense</Btn></>} />
    <div className="grid g-auto">
      <Stat label="Total shareholders" value={d.shareholders} sub={active + ' active'} />
      <Stat label="Total shares sold" value={d.sharesSold} sub={'of ' + d.totalShares + ' · ' + avail + ' available'} />
      <Stat label="Total share value" value={fmtCompact(d.shareValue)} title={fmtMoney(d.shareValue)} sub="After discounts" />
      <Stat label="Total share collection" value={fmtCompact(d.shareCollected)} title={fmtMoney(d.shareCollected)} flow="in" sub={d.shareValue ? Math.round(d.shareCollected / d.shareValue * 100) + '% of share value' : ''} />
      <Stat label="Total share due" value={fmtCompact(d.shareDue)} title={fmtMoney(d.shareDue)} sub="Receivable from shareholders" />
      <Stat label="Construction contributions" value={fmtCompact(d.consCollected)} title={fmtMoney(d.consCollected)} flow="in" sub={'of ' + fmtCompact(d.consPlanned) + ' planned'} />
      <Stat label="Construction contribution due" value={fmtCompact(d.consDue)} title={fmtMoney(d.consDue)} sub="Receivable on plans" />
      <Stat label="Project construction expense" value={fmtCompact(d.expense)} title={fmtMoney(d.expense)} flow="out" sub={d.pendingApprovalAmount ? fmtCompact(d.pendingApprovalAmount) + ' awaiting approval' : 'All approved'} />
      <Stat label="Available project fund" value={fmtCompact(d.fund)} title={fmtMoney(d.fund)} flow="net" sub="Collections minus expenses" />
    </div>
    <div className="grid g2">
      <Card title="Financial overview" sub="Cash received, cash spent and what is still owed">
        <div className="io-cols">
          <div><h4><Flow dir="in" /></h4><HBars stacked items={overviewItems.inn} max={scale} /></div>
          <div><h4><Flow dir="out" /></h4><HBars stacked items={overviewItems.out} max={scale} /></div>
        </div>
        <div style={{ marginTop: 22 }}>
          <div className="sect-t">Outstanding receivables · {fmtMoney(d.receivables)}</div>
          <Progress parts={[{ pct: d.shareDue / (d.receivables || 1) * 100, color: 'var(--s-share)', label: 'Share due' }, { pct: d.consDue / (d.receivables || 1) * 100, color: 'var(--s-cons)', label: 'Construction due' }]} />
          <div className="legend" style={{ marginTop: 8 }}><span><i style={{ background: 'var(--s-share)' }} />Share due {fmtMoney(d.shareDue)}</span><span><i style={{ background: 'var(--s-cons)' }} />Construction due {fmtMoney(d.consDue)}</span></div>
        </div>
      </Card>
      <Card title="Payment collection trend" sub="Last six months">
        <TrendChart data={d.trend} series={[{ key: 'share', label: 'Share collection', color: 'var(--s-share)' }, { key: 'construction', label: 'Construction collection', color: 'var(--s-cons)' }, { key: 'expense', label: 'Project expenses', color: 'var(--s-out)', dash: '5 4' }]} />
      </Card>
    </div>
    <div className="grid g2">
      <Card title="Construction expense summary" sub="Approved spending by category" actions={<Flow dir="out" />}>
        <HBars items={d.byCategory.slice(0, 8).map((x) => ({ label: x.label, value: x.value, color: 'var(--s-out)' }))} max={d.byCategory.length ? d.byCategory[0].value : 1} empty="No approved expenses yet." />
      </Card>
      <Card title="Construction contributions outstanding" sub="Largest amounts still to be received. Clients pay any amount, any time." flush actions={<Btn size="sm" variant="ghost" onClick={() => go('construction')}>All contributions</Btn>}>
        <DataTable pageSize={6} rows={d.consTop} empty={{ title: 'Nothing outstanding', text: 'Every contribution is fully paid.', icon: 'check' }} onRowClick={(u) => go('construction', { planId: u.plan_id })}
          cols={[{ key: 'who', label: 'Shareholder', render: (u) => <div className="cell-name"><div><b>{u.who}</b><span>Unit {u.unit} · {fmtPct(u.pct)} paid</span></div></div> }, { key: 'paid', label: 'Paid', align: 'r', render: (u) => M(u.paid) }, { key: 'due', label: 'Due', align: 'r', render: (u) => M(u.due) }]} />
      </Card>
    </div>
    <div className="grid g2">
      <Card title="Upcoming contractor installments" sub="Money going out to contractors" flush actions={<Btn size="sm" variant="ghost" onClick={() => go('expenses', { tab: 'contractors' })}>Contractors</Btn>}>
        <DataTable pageSize={6} rows={d.upcoming.map((u, i) => Object.assign({ id: 'u' + i }, u))} empty={{ title: 'Nothing scheduled', text: 'Contractor installments due will show up here.', icon: 'clock' }} onRowClick={() => go('expenses', { tab: 'contractors' })}
          cols={[{ key: 'who', label: 'Who', render: (u) => <div className="cell-name"><div><b>{u.who}</b><span>{u.what}</span></div></div> }, { key: 'due_date', label: 'When', render: (u) => <div>{fmtDate(u.due_date)}<div>{rDue(u)}</div></div> }, { key: 'amount', label: 'Amount', align: 'r', render: (u) => M(u.amount) }]} />
      </Card>
      <Card title="Recent customer payments" flush actions={<Btn size="sm" variant="ghost" onClick={() => go('payments')}>All payments</Btn>}>
        <DataTable pageSize={6} rows={d.recentPayments} empty={{ title: 'No payments yet', icon: 'card' }}
          cols={[{ key: 'who', label: 'Received from', render: (r) => <div className="cell-name"><div><b>{r.who}</b><span>{r.receipt} · {fmtDate(r.date)} · {r.method}</span></div></div> }, { key: 'type', label: 'Type', render: (r) => <TypePill type={r.type === 'Land Share' ? 'share' : 'cons'} /> }, { key: 'amount', label: 'Amount', align: 'r', render: (r) => M(r.amount) }]} />
      </Card>
    </div>
    <div className="grid g2">
      <Card title="Recent share sales" flush actions={<Btn size="sm" variant="ghost" onClick={() => go('sales')}>All sales</Btn>}>
        <DataTable pageSize={6} rows={d.recentBookings.map((b) => ({ id: b.id, b: b, s: Calc.bookingSummary(db, b) }))} onRowClick={(r) => go('profile', { id: r.b.shareholder_id })}
          cols={[{ key: 'b', label: 'Booking', render: (r) => <div className="cell-name"><div><b>{shName(db, r.b.shareholder_id)}</b><span>{r.b.code} · {fmtDate(r.b.booking_date)}</span></div></div> }, { key: 'q', label: 'Shares', align: 'r', render: (r) => r.b.quantity }, { key: 'g', label: 'Grand total', align: 'r', render: (r) => M(r.s.grand) }, { key: 'st', label: 'Status', render: (r) => <Status v={r.s.status} /> }]} />
      </Card>
    </div>
    <Card title="Recent construction expenses" flush actions={<><Flow dir="out" /><Btn size="sm" variant="ghost" onClick={() => go('expenses')}>All expenses</Btn></>}>
      <DataTable pageSize={6} rows={d.recentExpenses} onRowClick={() => go('expenses')} empty={{ title: 'No expenses yet', icon: 'receipt' }}
        cols={[{ key: 'code', label: 'Expense', render: (e) => <span className="mono">{e.code}</span> }, { key: 'expense_date', label: 'Date', render: (e) => fmtDate(e.expense_date) }, { key: 'category', label: 'Category' }, { key: 'description', label: 'Description', render: (e) => <div style={{ minWidth: 220 }}>{e.description}<div className="muted" style={{ fontSize: 12 }}>{e.payee_name || '—'}</div></div> }, { key: 'amount', label: 'Amount', align: 'r', render: (e) => M(e.amount) }, { key: 'approval_status', label: 'Approval', render: (e) => <Status v={e.approval_status} /> }]} />
    </Card>
  </>);
}

/* =================== SHAREHOLDERS =================== */
function ShareholdersPage() {
  const { db, user, go, open, confirm, run, S, toast } = useApp();
  const [q, setQ] = useState(''); const [flt, setFlt] = useState('all');
  const all = useMemo(() => db.shareholders.filter(live).map((s) => { const c = Calc.shareholder(db, s); return { id: s.id, s: s, c: c, code: s.code, name: s.full_name, phone: s.phone, shares: c.shares, value: c.shareValue, paid: c.sharePaid, due: c.shareDue, cpaid: c.consPaid, cdue: c.consDue, status: s.status }; }), [db]);
  const tests = { all: () => true, Active: (r) => r.s.status === 'Active', Inactive: (r) => r.s.status === 'Inactive', Due: (r) => r.due > 0.004 || r.cdue > 0.004, 'Fully Paid': (r) => r.c.bookings.length > 0 && r.due <= 0.004, 'Has Unit': (r) => r.c.units.length > 0, 'No Unit': (r) => r.c.units.length === 0 };
  const rows = all.filter(tests[flt]).filter((r) => { const t = q.trim().toLowerCase(); return !t || (r.name + ' ' + r.code + ' ' + r.phone + ' ' + r.s.nid + ' ' + r.s.email).toLowerCase().indexOf(t) >= 0; });
  const w = can(user, 'write');
  const addPay = (r) => { if (!r.c.bookings.length) { toast.info('No booking yet', r.name + ' has no share booking. Create one first.'); open('booking', { shareholderId: r.id }); } else open('sharePayment', { shareholderId: r.id }); };
  const archive = async (r) => { const a = await confirm({ title: 'Archive ' + r.name + '?', message: 'The record is hidden from lists but kept for the audit trail. It cannot be archived while it has bookings, units or plans.', confirmLabel: 'Archive', danger: true, reason: true }); if (a.ok) run(() => S.archiveShareholder(r.id, a.reason), 'Shareholder archived'); };
  const opts = ['all', 'Active', 'Inactive', 'Due', 'Fully Paid', 'Has Unit', 'No Unit'].map((k) => ({ id: k, label: k === 'all' ? 'All' : k, count: all.filter(tests[k]).length }));
  const cols = [
    { key: 'code', label: 'ID', render: (r) => <span className="mono">{r.code}</span> },
    { key: 'name', label: 'Name', render: (r) => <div className="cell-name"><ShAvatar sh={r.s} /><div><b>{r.name}</b><span>{r.s.profession}</span></div></div> },
    { key: 'phone', label: 'Phone', render: (r) => <span className="num">{r.phone}</span> },
    { key: 'shares', label: 'Shares', align: 'r' },
    { key: 'value', label: 'Total share value', align: 'r', render: (r) => M(r.value) },
    { key: 'paid', label: 'Paid', align: 'r', render: (r) => M(r.paid) },
    { key: 'due', label: 'Due', align: 'r', render: (r) => <span className="num" style={{ color: r.due > 0.004 ? 'var(--warn)' : undefined, fontWeight: r.due > 0.004 ? 600 : 400 }}>{fmtMoney(r.due)}</span> },
    { key: 'cpaid', label: 'Construction paid', align: 'r', render: (r) => M(r.cpaid) },
    { key: 'cdue', label: 'Construction due', align: 'r', render: (r) => <span className="num" style={{ color: r.cdue > 0.004 ? 'var(--warn)' : undefined, fontWeight: r.cdue > 0.004 ? 600 : 400 }}>{fmtMoney(r.cdue)}</span> },
    { key: 'status', label: 'Status', render: (r) => <Status v={r.status} /> },
    { key: 'actions', label: 'Actions', align: 'r', render: (r) => (<div className="act"><Btn size="sm" icon="eye" onClick={(e) => { e.stopPropagation(); go('profile', { id: r.id }); }}>View</Btn><RowMenu items={[
      { label: 'Edit', icon: 'edit', hidden: !w, onClick: () => open('shareholder', { shareholder: r.s }) },
      { label: 'Add payment', icon: 'card', hidden: !w, onClick: () => addPay(r) },
      { label: 'View documents', icon: 'file', onClick: () => go('profile', { id: r.id, tab: 'documents' }) },
      { label: 'View financial history', icon: 'clock', onClick: () => go('profile', { id: r.id, tab: 'payments' }) },
      { label: 'Archive', icon: 'archive', danger: true, hidden: !can(user, 'archive'), onClick: () => archive(r) }
    ]} /></div>) }
  ];
  return (<>
    <PageHead title="Shareholders" sub="Every person who holds land shares in the project, with land share and construction money kept apart." demo actions={w && <Btn variant="primary" icon="plus" onClick={() => open('shareholder', {})}>Add shareholder</Btn>} />
    <Card flush>
      <div className="toolbar"><SearchBox value={q} onChange={setQ} placeholder="Search name, ID, phone, NID" /><Chips options={opts} value={flt} onChange={setFlt} /></div>
      <DataTable cols={cols} rows={rows} pageSize={10} onRowClick={(r) => go('profile', { id: r.id })} empty={{ title: q || flt !== 'all' ? 'No shareholders match' : 'No shareholders yet', text: q || flt !== 'all' ? 'Clear the search or choose another filter.' : 'Add the first shareholder to get started.', icon: 'users', action: w && !q && flt === 'all' ? <Btn variant="primary" icon="plus" onClick={() => open('shareholder', {})}>Add shareholder</Btn> : null }} />
    </Card>
  </>);
}

/* =================== SHAREHOLDER 360 PROFILE =================== */
function ProfilePage({ id, tab: tab0 }) {
  const { db, user, go, open } = useApp();
  const [tab, setTab] = useState(tab0 || 'overview');
  useEffect(() => { setTab(tab0 || 'overview'); }, [tab0, id]);
  const sh = Calc.byId(db.shareholders, id);
  if (!sh || !live(sh)) return <Card><Empty icon="users" title="Shareholder not found" text="This record may have been archived." action={<Btn onClick={() => go('shareholders')}>Back to shareholders</Btn>} /></Card>;
  const c = Calc.shareholder(db, sh), w = can(user, 'write');
  const nominee = db.nominees.filter((n) => n.shareholder_id === id && live(n))[0];
  const ledger = buildLedger(db, { shareholderId: id });
  const bookingIds = c.bookings.map((x) => x.b.id), unitIds = c.units.map((u) => u.id);
  const nomIds = db.nominees.filter((n) => n.shareholder_id === id).map((n) => n.id);
  const docs = db.documents.filter((d) => live(d) && ((d.related_type === 'shareholder' && d.related_id === id) || (d.related_type === 'nominee' && nomIds.indexOf(d.related_id) >= 0) || (d.related_type === 'booking' && bookingIds.indexOf(d.related_id) >= 0) || (d.related_type === 'unit' && unitIds.indexOf(d.related_id) >= 0) || ((d.related_type === 'share_payment' || d.related_type === 'construction_payment') && ledger.some((l) => l.id === d.related_id)))).sort(byDateDesc('uploaded_at'));
  const logs = db.audit_logs.filter((a) => a.shareholder_id === id).sort((a, b) => b.at.localeCompare(a.at));
  const tabs = [{ id: 'overview', label: 'Overview' }, { id: 'bookings', label: 'Share bookings', count: c.bookings.length }, { id: 'units', label: 'Units', count: c.units.length }, { id: 'construction', label: 'Construction', count: c.plans.length }, { id: 'payments', label: 'Payments', count: ledger.length }, { id: 'documents', label: 'Documents', count: docs.length }, { id: 'nominee', label: 'Nominee' }, { id: 'activity', label: 'Activity history', count: logs.length }];
  const dcl = (i) => { const d = i ? Calc.byId(db.documents, i) : null; return d && !d.archived_at ? d : null; };
  const planOf = (u) => c.plans.filter((x) => x.p.unit_id === u.id)[0];
  return (<>
    <div><Btn size="sm" variant="ghost" icon="left" onClick={() => go('shareholders')}>All shareholders</Btn></div>
    <Card><div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
      <ShAvatar sh={sh} size={72} />
      <div style={{ flex: 1, minWidth: 220 }}>
        <div className="chips"><h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600 }}>{sh.full_name}</h1><Status v={sh.status} /></div>
        <div className="muted" style={{ marginTop: 4 }}><span className="mono">{sh.code}</span> · <span className="num">{sh.phone}</span> · {sh.profession}{sh.designation ? ', ' + sh.designation : ''}</div>
      </div>
      <div className="chips">{w && <Btn icon="edit" onClick={() => open('shareholder', { shareholder: sh })}>Edit</Btn>}<RowMenu label="Print options" icon="printer" text="Print" items={[{ label: 'Shareholder 360 summary', icon: 'printer', onClick: () => open('printPreview', { doc: 'profile', args: { id: id } }) }, { label: 'Financial statement', icon: 'printer', onClick: () => open('printPreview', { doc: 'shStatement', args: { id: id } }) }, { label: 'Payment history statement', icon: 'printer', onClick: () => open('printPreview', { doc: 'payStatement', args: { shareholderId: id } }) }]} />{w && <Btn icon="tag" onClick={() => open('booking', { shareholderId: id })}>New booking</Btn>}{w && <Btn variant="primary" icon="card" onClick={() => c.bookings.length ? open('sharePayment', { shareholderId: id }) : open('booking', { shareholderId: id })}>Add share payment</Btn>}</div>
    </div></Card>
    <div className="grid g3">
      <Card title="Land share" actions={<span className="pill pill-share">Shares</span>}><div className="sumbox"><div className="sumrow"><span>Total share value</span><b>{fmtMoney(c.shareValue)}</b></div><div className="sumrow"><span>Paid</span><span>{fmtMoney(c.sharePaid)}</span></div><div className="sumrow"><span>Due</span><b style={{ color: c.shareDue > 0.004 ? 'var(--warn)' : 'var(--ok)' }}>{fmtMoney(c.shareDue)}</b></div></div></Card>
      <Card title="Construction" actions={<span className="pill pill-cons">Units</span>}><div className="sumbox"><div className="sumrow"><span>Total construction contribution</span><b>{fmtMoney(c.consTotal)}</b></div><div className="sumrow"><span>Paid</span><span>{fmtMoney(c.consPaid)}</span></div><div className="sumrow"><span>Due</span><b style={{ color: c.consDue > 0.004 ? 'var(--warn)' : 'var(--ok)' }}>{fmtMoney(c.consDue)}</b></div></div></Card>
      <Card title="Overall" actions={<Flow dir="net" />}><div className="sumbox"><div className="sumrow big"><span>Total received</span><b>{fmtMoney(c.received)}</b></div><div className="sumrow big"><span>Total outstanding</span><b style={{ color: c.outstanding > 0.004 ? 'var(--warn)' : 'var(--ok)' }}>{fmtMoney(c.outstanding)}</b></div><div className="sumrow"><span>Shares held · units</span><span>{c.shares} · {c.units.length}</span></div></div></Card>
    </div>
    <Card flush>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'overview' && <div className="card-b grid g2">
        <div><div className="sect-t">Details</div><dl className="dl"><dt>Email</dt><dd>{sh.email || '—'}</dd><dt>NID</dt><dd className="mono">{sh.nid}</dd><dt>Address</dt><dd>{sh.address || '—'}</dd><dt>Profession</dt><dd>{sh.profession || '—'}</dd><dt>Designation</dt><dd>{sh.designation || '—'}</dd><dt>Registered</dt><dd>{fmtDate(sh.registration_date)}</dd><dt>Remarks</dt><dd>{sh.remarks || '—'}</dd></dl></div>
        <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
          <div><div className="sect-t">Land share paid · {c.shareValue ? Math.round(c.sharePaid / c.shareValue * 100) : 0}%</div><Progress parts={[{ pct: c.shareValue ? c.sharePaid / c.shareValue * 100 : 0, color: 'var(--s-share)', label: 'Paid' }]} /></div>
          <div><div className="sect-t">Construction paid · {c.consTotal ? Math.round(c.consPaid / c.consTotal * 100) : 0}%</div><Progress parts={[{ pct: c.consTotal ? c.consPaid / c.consTotal * 100 : 0, color: 'var(--s-cons)', label: 'Paid' }]} /></div>
          <div><div className="sect-t">Photo and NID</div><div className="kyc-strip">{[['Photo', sh.photo_doc_id], ['NID front', sh.nid_front_doc_id], ['NID back', sh.nid_back_doc_id]].map((k) => dcl(k[1]) ? <div key={k[0]}><DocThumb doc={dcl(k[1])} alt={k[0]} /><span>{k[0]}</span></div> : <div key={k[0]}><div className="slot-empty" style={{ aspectRatio: '4/3' }}>None</div><span>{k[0]}</span></div>)}</div><button type="button" className="link" onClick={() => setTab('documents')}>Manage documents</button></div>
          <div><div className="sect-t">Units</div><div className="chips">{c.units.length ? c.units.map((u) => <span key={u.id} className="chip">{u.code} · <Status v={u.status} /></span>) : <span className="muted">No unit assigned yet.</span>}</div></div>
        </div>
      </div>}
      {tab === 'bookings' && <DataTable pageSize={8} rows={c.bookings.map((x) => ({ id: x.b.id, b: x.b, s: x.s }))} empty={{ title: 'No share bookings', text: 'Create the first booking for this shareholder.', icon: 'tag', action: w && <Btn variant="primary" onClick={() => open('booking', { shareholderId: id })}>New booking</Btn> }}
        cols={[{ key: 'code', label: 'Booking', val: (r) => r.b.code, render: (r) => <span className="mono">{r.b.code}</span> }, { key: 'date', label: 'Date', val: (r) => r.b.booking_date, render: (r) => fmtDate(r.b.booking_date) }, { key: 'q', label: 'Shares', align: 'r', val: (r) => r.b.quantity, render: (r) => r.b.quantity }, { key: 'p', label: 'Price', align: 'r', val: (r) => r.b.unit_price, render: (r) => M(r.b.unit_price) }, { key: 'd', label: 'Discount', align: 'r', val: (r) => r.s.discount, render: (r) => M(r.s.discount) }, { key: 'g', label: 'Grand total', align: 'r', val: (r) => r.s.grand, render: (r) => M(r.s.grand) }, { key: 'pd', label: 'Paid', align: 'r', val: (r) => r.s.paid, render: (r) => M(r.s.paid) }, { key: 'du', label: 'Due', align: 'r', val: (r) => r.s.due, render: (r) => M(r.s.due) }, { key: 'st', label: 'Status', val: (r) => r.s.status, render: (r) => <Status v={r.s.status} /> }, { key: 'actions', label: '', align: 'r', render: (r) => w && r.s.due > 0.004 ? <Btn size="sm" onClick={() => open('sharePayment', { bookingId: r.b.id })}>Add payment</Btn> : null }]} />}
      {tab === 'units' && <DataTable pageSize={8} rows={c.units.map((u) => Object.assign({ p: planOf(u) }, u))} empty={{ title: 'No units assigned', text: 'Assign units from the Units page. One shareholder can hold several.', icon: 'building', action: <Btn onClick={() => go('units')}>Go to units</Btn> }}
        cols={[{ key: 'code', label: 'Unit', render: (u) => <b>{u.code}</b> }, { key: 'floor', label: 'Floor' }, { key: 'size_sqft', label: 'Size', render: (u) => u.size_sqft + ' sq ft' }, { key: 'status', label: 'Status', render: (u) => <Status v={u.status} /> }, { key: 'assigned_date', label: 'Assigned', render: (u) => fmtDate(u.assigned_date) }, { key: 'plan', label: 'Construction', noSort: true, render: (u) => u.p ? <span>{fmtMoney(u.p.s.paid)} of {fmtMoney(u.p.s.total)}</span> : <span className="muted">No total set</span> }, { key: 'actions', label: '', align: 'r', render: (u) => u.p ? <Btn size="sm" onClick={() => go('construction', { planId: u.p.p.id })}>Open</Btn> : (w ? <Btn size="sm" onClick={() => open('plan', { unitId: u.id })}>Set total</Btn> : null) }]} />}
      {tab === 'construction' && <div className="card-b" style={{ display: 'grid', gap: 14 }}>{c.plans.length ? c.plans.map((x) => { const u = Calc.byId(db.units, x.p.unit_id); return (<div key={x.p.id} className="card" style={{ padding: 16, display: 'grid', gap: 10 }}>
        <div className="chips" style={{ justifyContent: 'space-between' }}><div><b>{u.code}</b> <span className="muted">· {x.p.code}</span></div><Status v={x.s.status} /></div>
        <div className="grid g3" style={{ gap: 10 }}><div><div className="muted">Total contribution</div><b className="num">{fmtMoney(x.s.total)}</b></div><div><div className="muted">Total paid</div><b className="num">{fmtMoney(x.s.paid)}</b></div><div><div className="muted">Remaining due</div><b className="num" style={{ color: x.s.due > 0.004 ? 'var(--warn)' : 'var(--ok)' }}>{fmtMoney(x.s.due)}</b></div></div>
        <Progress parts={[{ pct: x.s.pct, color: 'var(--s-cons)', label: 'Paid' }]} />
        <div className="chips" style={{ justifyContent: 'space-between' }}><span className="muted">{fmtPct(x.s.pctExact)} paid · {x.s.count} payment{x.s.count === 1 ? '' : 's'}{x.s.last ? ' · last ' + fmtDate(x.s.last.payment_date) : ''}</span><span className="chips"><Btn size="sm" onClick={() => go('construction', { planId: x.p.id })}>Open</Btn><Btn size="sm" icon="printer" onClick={() => open('printPreview', { doc: 'consStatement', args: { planId: x.p.id } })}>Print statement</Btn>{w && <Btn size="sm" variant="primary" onClick={() => open('consPayment', { planId: x.p.id })}>Add payment</Btn>}</span></div></div>); }) : <Empty icon="wrench" title="No construction contribution set" text="Set one total per unit once the unit is assigned. The client can then pay any amount, any time." />}</div>}
      {tab === 'payments' && <div className="card-b" style={{ display: 'grid', gap: 22 }}>
        <div><div className="sect-t">Land share payments</div><div className="card" style={{ overflow: 'hidden' }}><LedgerTable rows={ledger.filter((l) => l.type === 'share')} showWho={false} pageSize={6} /></div></div>
        <div><div className="sect-t">Construction payments</div><div className="card" style={{ overflow: 'hidden' }}><LedgerTable rows={ledger.filter((l) => l.type === 'cons')} showWho={false} pageSize={6} /></div></div>
      </div>}
      {tab === 'documents' && <div>
        <div className="card-b"><div className="sect-t">Shareholder photo and NID</div><div className="slots">{[['photo', 'Profile photo', sh.photo_doc_id], ['nid_front', 'NID front', sh.nid_front_doc_id], ['nid_back', 'NID back', sh.nid_back_doc_id]].map((k) => <KycCard key={k[0]} owner="shareholder" ownerId={sh.id} slot={k[0]} label={k[1]} doc={dcl(k[2])} canEdit={w} />)}</div>{nominee && <><div className="sect-t" style={{ marginTop: 18 }}>Nominee photo and NID · {nominee.name}</div><div className="slots">{[['photo', 'Nominee photo', nominee.photo_doc_id], ['nid_front', 'Nominee NID front', nominee.nid_front_doc_id], ['nid_back', 'Nominee NID back', nominee.nid_back_doc_id]].map((k) => <KycCard key={k[0]} owner="nominee" ownerId={nominee.id} slot={k[0]} label={k[1]} doc={dcl(k[2])} canEdit={w} />)}</div></>}</div>
        <div className="toolbar" style={{ justifyContent: 'flex-end' }}>{w && <Btn icon="upload" onClick={() => open('document', { relatedType: 'shareholder', relatedId: id })}>Upload document</Btn>}</div>
        <DataTable pageSize={8} rows={docs} empty={{ title: 'No documents', text: 'Upload NID, agreements and receipts here.', icon: 'file' }} onRowClick={(d) => open('docView', { id: d.id })}
          cols={[{ key: 'th', label: '', noSort: true, render: (d) => <div style={{ width: 44 }}><DocThumb doc={d} onClick={() => open('docView', { id: d.id })} /></div> }, { key: 'code', label: 'ID', render: (d) => <span className="mono">{d.code}</span> }, { key: 'file_name', label: 'File', render: (d) => <b>{d.file_name}</b> }, { key: 'doc_type', label: 'Type' }, { key: 'rel', label: 'Belongs to', noSort: true, render: (d) => relatedLabel(db, d) }, { key: 'uploaded_at', label: 'Uploaded', render: (d) => fmtDate(d.uploaded_at.slice(0, 10)) }]} /></div>}
      {tab === 'nominee' && <div className="card-b">{nominee ? <div style={{ display: 'grid', gap: 18 }}><dl className="dl"><dt>Name</dt><dd>{nominee.name}</dd><dt>Relation</dt><dd>{nominee.relation || '—'}</dd><dt>Phone</dt><dd className="num">{nominee.phone || '—'}</dd><dt>NID</dt><dd className="mono">{nominee.nid || '—'}</dd><dt>Address</dt><dd>{nominee.address || '—'}</dd></dl>
        <div><div className="sect-t">Nominee photo and NID</div><div className="slots">{[['photo', 'Nominee photo', nominee.photo_doc_id], ['nid_front', 'Nominee NID front', nominee.nid_front_doc_id], ['nid_back', 'Nominee NID back', nominee.nid_back_doc_id]].map((k) => <KycCard key={k[0]} owner="nominee" ownerId={nominee.id} slot={k[0]} label={k[1]} doc={dcl(k[2])} canEdit={w} />)}</div></div></div> : <Empty icon="user" title="No nominee recorded" text="Add a nominee by editing this shareholder." action={w && <Btn onClick={() => open('shareholder', { shareholder: sh })}>Edit shareholder</Btn>} />}</div>}
      {tab === 'activity' && <div className="card-b"><Timeline logs={logs} /></div>}
    </Card>
  </>);
}
