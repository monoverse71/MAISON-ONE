/* ============================================================
   10 PAGES B — Share Sales, Units, Construction Contributions
   ============================================================ */
function SalesPage({ newBooking }) {
  const { db, user, go, open, confirm, run, S } = useApp(); const w = can(user, 'write');
  useEffect(() => { if (newBooking) open('booking', {}); }, []);
  const [q, setQ] = useState(''); const [flt, setFlt] = useState('all');
  const settings = db.settings[0], sold = Calc.sharesSold(db);
  const all = useMemo(() => db.share_bookings.filter(live).map((b) => { const s = Calc.bookingSummary(db, b); return { id: b.id, b: b, s: s, name: shName(db, b.shareholder_id), code: b.code, date: b.booking_date }; }).sort((a, b) => b.date.localeCompare(a.date) || b.code.localeCompare(a.code)), [db]);
  const rows = all.filter((r) => (flt === 'all' || r.s.status === flt) && (!q.trim() || (r.name + ' ' + r.code + ' ' + r.b.reference_person).toLowerCase().indexOf(q.trim().toLowerCase()) >= 0));
  const totals = { value: sum(all, (r) => r.s.grand), paid: sum(all, (r) => r.s.paid), due: sum(all, (r) => r.s.due) };
  const archive = async (r) => { const a = await confirm({ title: 'Archive booking ' + r.code + '?', message: 'Only bookings with no net payments can be archived. The record stays in the audit trail.', confirmLabel: 'Archive', danger: true, reason: true }); if (a.ok) run(() => S.archiveBooking(r.id, a.reason), 'Booking archived'); };
  const opts = ['all', 'Paid', 'Partial', 'Unpaid'].map((k) => ({ id: k, label: k === 'all' ? 'All' : k, count: k === 'all' ? all.length : all.filter((r) => r.s.status === k).length }));
  const cols = [
    { key: 'code', label: 'Booking', render: (r) => <span className="mono">{r.code}</span> },
    { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
    { key: 'name', label: 'Shareholder', render: (r) => <ShLink id={r.b.shareholder_id} /> },
    { key: 'q', label: 'Shares', align: 'r', val: (r) => r.b.quantity, render: (r) => r.b.quantity },
    { key: 'p', label: 'Price', align: 'r', val: (r) => r.b.unit_price, render: (r) => M(r.b.unit_price) },
    { key: 'd', label: 'Discount', align: 'r', val: (r) => r.s.discount, render: (r) => M(r.s.discount) },
    { key: 'g', label: 'Grand total', align: 'r', val: (r) => r.s.grand, render: (r) => M(r.s.grand) },
    { key: 'pd', label: 'Paid', align: 'r', val: (r) => r.s.paid, render: (r) => M(r.s.paid) },
    { key: 'du', label: 'Due', align: 'r', val: (r) => r.s.due, render: (r) => <span className="num" style={{ color: r.s.due > 0.004 ? 'var(--warn)' : undefined, fontWeight: r.s.due > 0.004 ? 600 : 400 }}>{fmtMoney(r.s.due)}</span> },
    { key: 'st', label: 'Status', val: (r) => r.s.status, render: (r) => <Status v={r.s.status} /> },
    { key: 'actions', label: 'Actions', align: 'r', render: (r) => (<div className="act">{w && r.s.due > 0.004 && <Btn size="sm" onClick={(e) => { e.stopPropagation(); open('sharePayment', { bookingId: r.id }); }}>Add payment</Btn>}<RowMenu items={[
      { label: 'Print booking document', icon: 'printer', onClick: () => open('printPreview', { doc: 'booking', args: { id: r.id } }) },
      { label: 'View shareholder', icon: 'user', onClick: () => go('profile', { id: r.b.shareholder_id }) },
      { label: 'View payments', icon: 'card', onClick: () => go('profile', { id: r.b.shareholder_id, tab: 'payments' }) },
      { label: 'Upload document', icon: 'upload', hidden: !w, onClick: () => open('document', { relatedType: 'booking', relatedId: r.id, docType: 'Booking Document' }) },
      { label: 'Archive booking', icon: 'archive', danger: true, hidden: !can(user, 'archive'), onClick: () => archive(r) }
    ]} /></div>) }
  ];
  return (<>
    <PageHead title="Share sales" sub="Land share bookings and what has been collected against each. Construction money is not mixed in here." flow="in" demo actions={w && <Btn variant="primary" icon="plus" onClick={() => open('booking', {})}>New share booking</Btn>} />
    <div className="grid g-auto">
      <Stat label="Shares sold" value={sold + ' of ' + settings.total_shares} sub={(settings.total_shares - sold) + ' still available'} />
      <Stat label="Total booked value" value={fmtCompact(totals.value)} title={fmtMoney(totals.value)} sub="After discounts" />
      <Stat label="Collected" value={fmtCompact(totals.paid)} title={fmtMoney(totals.paid)} flow="in" />
      <Stat label="Due" value={fmtCompact(totals.due)} title={fmtMoney(totals.due)} sub="Not yet collected" />
    </div>
    <Card flush>
      <div className="toolbar"><SearchBox value={q} onChange={setQ} placeholder="Search booking, shareholder, reference" /><Chips options={opts} value={flt} onChange={setFlt} /></div>
      <DataTable cols={cols} rows={rows} pageSize={10} initialSort={null} onRowClick={(r) => go('profile', { id: r.b.shareholder_id, tab: 'bookings' })}
        foot={rows.length > 1 ? { g: fmtMoney(sum(rows, (r) => r.s.grand)), pd: fmtMoney(sum(rows, (r) => r.s.paid)), du: fmtMoney(sum(rows, (r) => r.s.due)), q: sum(rows, (r) => r.b.quantity) } : null}
        empty={{ title: 'No bookings found', text: q || flt !== 'all' ? 'Clear the search or choose another filter.' : 'Create the first share booking.', icon: 'tag', action: w && !q && flt === 'all' ? <Btn variant="primary" onClick={() => open('booking', {})}>New share booking</Btn> : null }} />
    </Card>
  </>);
}

/* =================== UNITS =================== */
function UnitsPage() {
  const { db, user, go, open } = useApp(); const w = can(user, 'write');
  const [q, setQ] = useState(''); const [flt, setFlt] = useState('all');
  const all = useMemo(() => db.units.filter(live).map((u) => { const plan = db.construction_plans.filter((p) => live(p) && p.unit_id === u.id && p.status !== 'Cancelled')[0]; return Object.assign({ holder: u.shareholder_id ? shName(db, u.shareholder_id) : '', plan: plan || null, pc: plan ? Calc.plan(db, plan) : null }, u); }), [db]);
  const rows = all.filter((u) => (flt === 'all' || u.status === flt) && (!q.trim() || (u.code + ' ' + u.holder).toLowerCase().indexOf(q.trim().toLowerCase()) >= 0));
  const floors = Array.from(new Set(all.map((u) => u.floor))).sort((a, b) => b - a);
  const opts = [{ id: 'all', label: 'All', count: all.length }].concat(UNIT_STATUSES.map((s) => ({ id: s, label: s, count: all.filter((u) => u.status === s).length })));
  const cols = [
    { key: 'code', label: 'Unit', render: (u) => <b>{u.code}</b> },
    { key: 'floor', label: 'Floor', align: 'r' },
    { key: 'size_sqft', label: 'Size', align: 'r', render: (u) => u.size_sqft + ' sq ft' },
    { key: 'status', label: 'Status', render: (u) => <Status v={u.status} /> },
    { key: 'holder', label: 'Assigned shareholder', render: (u) => u.shareholder_id ? <ShLink id={u.shareholder_id} /> : <span className="muted">Not assigned</span> },
    { key: 'assigned_date', label: 'Assigned', render: (u) => fmtDate(u.assigned_date) },
    { key: 'plan', label: 'Construction', noSort: true, render: (u) => u.pc ? <span className="num">{fmtMoney(u.pc.paid)} of {fmtMoney(u.pc.total)}</span> : <span className="muted">{u.shareholder_id ? 'No total set' : '—'}</span> },
    { key: 'actions', label: 'Actions', align: 'r', render: (u) => (<div className="act">{w && <Btn size="sm" icon="edit" onClick={(e) => { e.stopPropagation(); open('unit', { unit: u }); }}>{u.shareholder_id ? 'Edit' : 'Assign'}</Btn>}<RowMenu items={[
      { label: 'Open construction contribution', icon: 'wrench', hidden: !u.plan, onClick: () => go('construction', { planId: u.plan.id }) },
      { label: 'Set total construction contribution', icon: 'plus', hidden: !(w && u.shareholder_id && !u.plan), onClick: () => open('plan', { unitId: u.id }) },
      { label: 'View shareholder', icon: 'user', hidden: !u.shareholder_id, onClick: () => go('profile', { id: u.shareholder_id }) },
      { label: 'Upload document', icon: 'upload', hidden: !w, onClick: () => open('document', { relatedType: 'unit', relatedId: u.id }) }
    ]} /></div>) }
  ];
  return (<>
    <PageHead title="Units" sub="Flats in the project and who holds them. One shareholder can hold several units without being duplicated." demo actions={w && <Btn variant="primary" icon="plus" onClick={() => open('unit', {})}>Add unit</Btn>} />
    <Card title="Floor view" sub="Select a unit to edit or assign it">
      <div style={{ display: 'grid', gap: 10 }}>{floors.map((fl) => (<div className="floor" key={fl}><b className="muted">Floor {fl}</b><div className="chips">{all.filter((u) => u.floor === fl).sort((a, b) => cmpStr(a.code, b.code)).map((u) => (<button key={u.id} type="button" className={'ucell s-' + u.status.split(' ')[0]} onClick={() => w ? open('unit', { unit: u }) : (u.shareholder_id && go('profile', { id: u.shareholder_id }))} title={u.status}><b>{u.code}</b><span>{u.holder || 'Available'}</span></button>))}</div></div>))}</div>
      <div className="legend" style={{ marginTop: 14 }}>{UNIT_STATUSES.map((s) => <span key={s}><Status v={s} /></span>)}</div>
    </Card>
    <Card flush>
      <div className="toolbar"><SearchBox value={q} onChange={setQ} placeholder="Search unit or shareholder" /><Chips options={opts} value={flt} onChange={setFlt} /></div>
      <DataTable cols={cols} rows={rows} pageSize={12} empty={{ title: 'No units found', text: 'Clear the search or choose another status.', icon: 'building' }} />
    </Card>
  </>);
}

/* =================== CONSTRUCTION CONTRIBUTIONS =================== */
function ConstructionPage({ planId }) { return planId ? <PlanDetail id={planId} /> : <PlanList />; }

function PlanList() {
  const { db, user, go, open } = useApp(); const w = can(user, 'write');
  const [q, setQ] = useState(''); const [flt, setFlt] = useState('all');
  const all = useMemo(() => db.construction_plans.filter((p) => live(p) && p.status !== 'Cancelled').map((p) => { const s = Calc.plan(db, p), u = Calc.byId(db.units, p.unit_id); return { id: p.id, p: p, s: s, unit: u.code, name: shName(db, p.shareholder_id), total: s.total, paid: s.paid, due: s.due, pct: s.pctExact, last: s.last ? s.last.payment_date : '', status: s.status }; }), [db]);
  const rows = all.filter((r) => (flt === 'all' || r.status === flt) && (!q.trim() || (r.unit + ' ' + r.name + ' ' + r.p.code).toLowerCase().indexOf(q.trim().toLowerCase()) >= 0));
  const t = { total: sum(all, (r) => r.total), paid: sum(all, (r) => r.paid), due: sum(all, (r) => r.due) };
  const opts = ['all', 'In Progress', 'Not Started', 'Completed'].map((k) => ({ id: k, label: k === 'all' ? 'All' : k, count: k === 'all' ? all.length : all.filter((r) => r.status === k).length }));
  const cols = [
    { key: 'unit', label: 'Unit', render: (r) => <div className="cell-name"><div><b>{r.unit}</b><span className="mono">{r.p.code}</span></div></div> },
    { key: 'name', label: 'Shareholder', render: (r) => <ShLink id={r.p.shareholder_id} /> },
    { key: 'total', label: 'Total contribution', align: 'r', render: (r) => M(r.total) },
    { key: 'paid', label: 'Total paid', align: 'r', render: (r) => M(r.paid) },
    { key: 'due', label: 'Remaining due', align: 'r', render: (r) => <span className="num" style={{ color: r.due > 0.004 ? 'var(--warn)' : undefined, fontWeight: r.due > 0.004 ? 600 : 400 }}>{fmtMoney(r.due)}</span> },
    { key: 'pct', label: 'Progress', render: (r) => <div style={{ minWidth: 110 }}><span className="num">{fmtPct(r.pct)}</span><Progress parts={[{ pct: r.s.pct, color: 'var(--s-cons)', label: 'Paid' }]} /></div> },
    { key: 'last', label: 'Last payment', render: (r) => r.last ? fmtDate(r.last) : '—' },
    { key: 'status', label: 'Status', render: (r) => <Status v={r.status} /> },
    { key: 'actions', label: 'Actions', align: 'r', render: (r) => (<div className="act"><Btn size="sm" icon="eye" onClick={(e) => { e.stopPropagation(); go('construction', { planId: r.id }); }}>Open</Btn>{w && r.due > 0.004 && <Btn size="sm" onClick={(e) => { e.stopPropagation(); open('consPayment', { planId: r.id }); }}>Add payment</Btn>}<RowMenu items={[{ label: 'Print statement (A4)', icon: 'printer', onClick: () => open('printPreview', { doc: 'consStatement', args: { planId: r.id } }) }]} /></div>) }
  ];
  return (<>
    <PageHead title="Construction contributions" sub="One total per shareholder and unit. Clients pay any amount, whenever they choose. Separate from land share payments." flow="in" demo actions={<>{rows.length > 0 && <Btn icon="printer" onClick={() => open('printPreview', { doc: 'report', args: { reportId: 'cons_contribution' } })}>Print summary</Btn>}{w && <Btn variant="primary" icon="plus" onClick={() => open('plan', {})}>Set total contribution</Btn>}</>} />
    <div className="grid g-auto">
      <Stat label="Total contributions set" value={fmtCompact(t.total)} title={fmtMoney(t.total)} sub={all.length + ' units'} />
      <Stat label="Total paid" value={fmtCompact(t.paid)} title={fmtMoney(t.paid)} flow="in" sub={t.total ? fmtPct(t.paid / t.total * 100) + ' of total' : ''} />
      <Stat label="Remaining due" value={fmtCompact(t.due)} title={fmtMoney(t.due)} />
      <Stat label="Not started" value={all.filter((r) => r.status === 'Not Started').length} sub="No payment yet" />
    </div>
    <Card flush>
      <div className="toolbar"><SearchBox value={q} onChange={setQ} placeholder="Search unit, shareholder, plan" /><Chips options={opts} value={flt} onChange={setFlt} /></div>
      <DataTable cols={cols} rows={rows} pageSize={10} onRowClick={(r) => go('construction', { planId: r.id })} empty={{ title: 'No construction contributions', text: q || flt !== 'all' ? 'Clear the search or choose another filter.' : 'Set a total for an assigned unit.', icon: 'wrench', action: w && !q && flt === 'all' ? <Btn variant="primary" onClick={() => open('plan', {})}>Set total contribution</Btn> : null }} />
    </Card>
  </>);
}

function PlanDetail({ id }) {
  const { db, user, go, open } = useApp(); const w = can(user, 'write');
  const plan = Calc.byId(db.construction_plans, id);
  if (!plan || !live(plan)) return <Card><Empty icon="wrench" title="Contribution not found" action={<Btn onClick={() => go('construction')}>Back to contributions</Btn>} /></Card>;
  const pc = Calc.plan(db, plan), unit = Calc.byId(db.units, plan.unit_id);
  const ledger = buildLedger(db, { shareholderId: plan.shareholder_id }).filter((l) => l.type === 'cons' && l.rec.plan_id === id);
  const asc = ledger.slice().sort((a, b) => a.date.localeCompare(b.date) || a.rec.created_at.localeCompare(b.rec.created_at)); let run = pc.total; const bal = {};
  asc.forEach((l) => { if (l.rec.status !== 'Reversed') run = roundMoney(run - l.amount); bal[l.id] = run; });
  const cols = [
    { key: 'receipt', label: 'Receipt no.', render: (r) => <span className="mono">{r.receipt}</span> },
    { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
    { key: 'amount', label: 'Amount', align: 'r', render: (r) => M(r.amount) },
    { key: 'method', label: 'Method' },
    { key: 'reference', label: 'Reference', render: (r) => <span className="mono">{r.reference}</span> },
    { key: 'note', label: 'Note', noSort: true, render: (r) => r.rec.note || '—' },
    { key: 'bal', label: 'Due after', align: 'r', noSort: true, render: (r) => M(bal[r.id]) },
    { key: 'status', label: 'Status', render: (r) => <Status v={r.status} /> },
    { key: 'actions', label: '', align: 'r', render: (r) => (<div className="act"><Btn size="sm" icon="printer" onClick={() => open('printPreview', { doc: 'receipt', args: { kind: 'cons', id: r.id } })}>Receipt</Btn><RowMenu items={[
      { label: 'View receipt', icon: 'receipt', onClick: () => open('receipt', { kind: 'cons', id: r.id }) },
      { label: 'Reverse entry', icon: 'undo', danger: true, hidden: !(r.canReverse && can(user, 'reverse')), onClick: () => open('reverse', { kind: 'cons', id: r.id }) }]} /></div>) }
  ];
  return (<>
    <div><Btn size="sm" variant="ghost" icon="left" onClick={() => go('construction')}>All construction contributions</Btn></div>
    <PageHead title={'Unit ' + unit.code} sub={plan.code + ' · ' + unit.size_sqft + ' sq ft · floor ' + unit.floor} flow="in" actions={<>
      <Btn icon="printer" onClick={() => open('printPreview', { doc: 'consStatement', args: { planId: id } })}>Print statement</Btn>
      {can(user, 'approve') && <Btn icon="edit" onClick={() => open('planTotal', { planId: id })}>Change total</Btn>}
      {w && <Btn variant="primary" icon="card" onClick={() => open('consPayment', { planId: id })}>Add payment</Btn>}</>} />
    <Card><div className="chips" style={{ justifyContent: 'space-between', gap: 20 }}><div><div className="muted">Shareholder</div><div style={{ fontSize: 16 }}><ShLink id={plan.shareholder_id} /></div></div><Status v={pc.status} /></div></Card>
    <div className="grid g-auto">
      <Stat label="Total contribution" value={fmtMoney(pc.total)} />
      <Stat label="Total paid" value={fmtMoney(pc.paid)} flow="in" sub={pc.count + ' payment' + (pc.count === 1 ? '' : 's')} />
      <Stat label="Remaining due" value={fmtMoney(pc.due)} />
      <Stat label="Payment progress" value={fmtPct(pc.pctExact)} sub={pc.last ? 'Last payment ' + fmtDate(pc.last.payment_date) : 'No payment yet'} />
    </div>
    <Progress parts={[{ pct: pc.pct, color: 'var(--s-cons)', label: 'Paid' }]} />
    {pc.status === 'Overpaid' && <Note tone="warn">Payments exceed the total contribution by {fmtMoney(pc.paid - pc.total)}. This was confirmed when it was recorded.</Note>}
    <Card title="Payment history" sub="Pay any amount, any time. Each payment is its own record. Corrections are made by reversing and re-entering." flush actions={w && <Btn size="sm" variant="primary" icon="plus" onClick={() => open('consPayment', { planId: id })}>Add payment</Btn>}>
      <DataTable cols={cols} rows={ledger} pageSize={10} rowClass={(r) => r.rec.status === 'Reversed' ? 'strike' : ''} empty={{ title: 'No payments yet', text: 'Payments against this contribution will appear here.', icon: 'card', action: w && <Btn variant="primary" onClick={() => open('consPayment', { planId: id })}>Add payment</Btn> }} />
    </Card>
  </>);
}
