/* ============================================================
   11 PAGES C — Project Expenses (money out), Payments, Documents
   ============================================================ */
function ExpenseTable({ rows, pageSize = 10, empty }) {
  const { db, user, open, confirm, run, S } = useApp(); const w = can(user, 'write');
  const decide = async (e, status) => {
    const a = await confirm({ title: (status === 'Approved' ? 'Approve ' : 'Reject ') + e.code + '?', message: e.description + ' · ' + fmtMoney(e.amount), confirmLabel: status === 'Approved' ? 'Approve' : 'Reject', danger: status === 'Rejected', reason: status === 'Rejected' });
    if (a.ok) run(() => S.setExpenseApproval(e.id, status, a.reason), status === 'Approved' ? 'Expense approved' : 'Expense rejected');
  };
  const cols = [
    { key: 'expense_date', label: 'Date', render: (e) => fmtDate(e.expense_date) },
    { key: 'code', label: 'Expense', render: (e) => <span className="mono">{e.code}</span> },
    { key: 'category', label: 'Category' },
    { key: 'payee_name', label: 'Contractor / supplier', render: (e) => e.payee_name || '—' },
    { key: 'description', label: 'Description', render: (e) => <div style={{ minWidth: 230 }}>{e.description}{e.kind === 'reversal' && <div className="muted" style={{ fontSize: 12 }}>Reason: {e.reversal_reason}</div>}</div> },
    { key: 'amount', label: 'Amount', align: 'r', render: (e) => M(e.amount) },
    { key: 'method', label: 'Method', render: (e) => <div>{e.method}<div className="mono muted">{e.reference || ''}</div></div> },
    { key: 'approval_status', label: 'Approval', render: (e) => <div><Status v={e.status === 'Reversed' ? 'Reversed' : e.kind === 'reversal' ? 'Reversal' : e.approval_status} />{e.approved_by && <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>by {userName(db, e.approved_by)}</div>}</div> },
    { key: 'actions', label: 'Actions', align: 'r', render: (e) => { const bill = e.attachment_doc_id ? Calc.byId(db.documents, e.attachment_doc_id) : db.documents.filter((d) => d.related_type === 'expense' && d.related_id === e.id && live(d))[0]; return (<div className="act">
      {e.approval_status === 'Pending' && can(user, 'approve') && <><Btn size="sm" onClick={() => decide(e, 'Approved')}>Approve</Btn><Btn size="sm" variant="danger" onClick={() => decide(e, 'Rejected')}>Reject</Btn></>}
      <RowMenu items={[
        { label: 'Print voucher (A4)', icon: 'printer', onClick: () => open('printPreview', { doc: 'expenseVoucher', args: { id: e.id } }) },
        { label: 'View bill', icon: 'file', hidden: !bill, onClick: () => open('docView', { id: bill.id }) },
        { label: 'Attach bill', icon: 'upload', hidden: !w || !!bill, onClick: () => open('document', { relatedType: 'expense', relatedId: e.id, docType: 'Bill / Invoice' }) },
        { label: 'Reverse entry', icon: 'undo', danger: true, hidden: !(can(user, 'reverse') && e.kind === 'expense' && e.status === 'Posted'), onClick: () => open('reverse', { kind: 'expense', id: e.id }) }
      ]} /></div>); } }
  ];
  return <DataTable cols={cols} rows={rows} pageSize={pageSize} rowClass={(e) => e.status === 'Reversed' || e.approval_status === 'Rejected' ? 'strike' : ''} empty={empty || { title: 'No expenses found', text: 'Clear the search or choose another filter.', icon: 'receipt' }} />;
}

function ExpensesPage({ tab: tab0, newExpense }) {
  const { db, user, open } = useApp(); const w = can(user, 'write');
  const [tab, setTab] = useState(tab0 || 'expenses');
  useEffect(() => { if (newExpense) open('expense', {}); }, []);
  useEffect(() => { if (tab0) setTab(tab0); }, [tab0]);
  const [q, setQ] = useState(''); const [ap, setAp] = useState('all'); const [cat, setCat] = useState('');
  const exps = useMemo(() => db.project_expenses.filter(live).sort((a, b) => b.expense_date.localeCompare(a.expense_date) || b.code.localeCompare(a.code)), [db]);
  const counted = exps.filter(Calc.expenseCounts), approved = counted.filter((e) => e.approval_status === 'Approved');
  const contractors = db.contractors.filter(live).map((c) => ({ c: c, s: Calc.contractor(db, c) }));
  const stat = { approved: sum(approved, (e) => e.amount), pending: sum(counted.filter((e) => e.approval_status === 'Pending'), (e) => e.amount), contractor: sum(approved.filter((e) => e.contractor_id), (e) => e.amount), due: sum(contractors.filter((x) => x.c.contract_value), (x) => x.s.due) };
  const rows = exps.filter((e) => (ap === 'all' || e.approval_status === ap) && (!cat || e.category === cat) && (!q.trim() || (e.code + ' ' + e.description + ' ' + e.payee_name + ' ' + e.reference).toLowerCase().indexOf(q.trim().toLowerCase()) >= 0));
  const opts = ['all', 'Approved', 'Pending', 'Rejected'].map((k) => ({ id: k, label: k === 'all' ? 'All' : k, count: k === 'all' ? exps.length : exps.filter((e) => e.approval_status === k).length }));
  return (<>
    <PageHead title="Project expenses" sub="Money going out of the project: contractors, materials, labor and approvals." flow="out" demo actions={<><Btn icon="printer" onClick={() => open('printPreview', { doc: 'expenseRecords', args: { ids: rows.map((e) => e.id) } })}>Print expense records</Btn>{w && <Btn icon="plus" onClick={() => open('contractor', {})}>Add contractor</Btn>}{w && <Btn variant="primary" icon="plus" onClick={() => open('expense', {})}>Add project expense</Btn>}</>} />
    <div className="grid g-auto">
      <Stat label="Approved spending" value={fmtCompact(stat.approved)} title={fmtMoney(stat.approved)} flow="out" />
      <Stat label="Awaiting approval" value={fmtCompact(stat.pending)} title={fmtMoney(stat.pending)} sub={counted.filter((e) => e.approval_status === 'Pending').length + ' expenses'} />
      <Stat label="Contractor and supplier payments" value={fmtCompact(stat.contractor)} title={fmtMoney(stat.contractor)} />
      <Stat label="Contract balance still to pay" value={fmtCompact(stat.due)} title={fmtMoney(stat.due)} sub={contractors.filter((x) => x.c.contract_value).length + ' contracts'} />
    </div>
    <Card flush>
      <Tabs tabs={[{ id: 'expenses', label: 'Expenses', count: exps.length }, { id: 'contractors', label: 'Contractors and contracts', count: contractors.length }]} value={tab} onChange={setTab} />
      {tab === 'expenses' && <>
        <div className="toolbar"><SearchBox value={q} onChange={setQ} placeholder="Search description, payee, reference" /><div style={{ minWidth: 190 }}><Sel value={cat} onChange={setCat} options={EXPENSE_CATEGORIES} placeholder="All categories" aria-label="Category" /></div><Chips options={opts} value={ap} onChange={setAp} /></div>
        <ExpenseTable rows={rows} />
      </>}
      {tab === 'contractors' && <div className="card-b" style={{ display: 'grid', gap: 16 }}>
        {contractors.length ? contractors.map((x) => <ContractorCard key={x.c.id} c={x.c} s={x.s} />) : <Empty icon="users" title="No contractors yet" text="Add a contractor to track its contract and installments." />}
      </div>}
    </Card>
  </>);
}

function ContractorCard({ c, s }) {
  const { user, open } = useApp(); const w = can(user, 'write'); const isC = !!c.contract_value;
  const pay = (r) => open('expense', { contractorId: c.id, prefill: { contractor_id: c.id, category: 'Contractor Payment', contract_installment_id: r ? r.id : '', amount: r ? String(r.due) : '', description: r ? c.name + ', installment ' + r.no : '' } });
  return (<div className="card" style={{ padding: 16, display: 'grid', gap: 12 }}>
    <div className="chips" style={{ justifyContent: 'space-between' }}>
      <div><b style={{ fontSize: 15 }}>{c.name}</b> <span className="muted">· {c.trade || c.kind} · <span className="mono">{c.code}</span> · {c.phone}</span></div>
      <div className="chips"><span className={'pill ' + (isC ? 'pill-net' : 'pill-out')}>{c.kind}</span>{w && <Btn size="sm" onClick={() => pay(null)}>Add payment</Btn>}</div>
    </div>
    {isC ? <>
      <div className="grid g-auto" style={{ gap: 10 }}>
        <div><div className="muted">Contract total</div><b className="num">{fmtMoney(s.total)}</b></div>
        <div><div className="muted">Paid</div><b className="num">{fmtMoney(s.paid)}</b></div>
        <div><div className="muted">Due</div><b className="num">{fmtMoney(s.due)}</b></div>
        <div><div className="muted">Upcoming installments</div><b className="num">{s.upcoming.length} · {fmtMoney(s.upcomingAmount)}</b></div>
      </div>
      <Progress parts={[{ pct: s.pct, color: 'var(--s-out)', label: 'Paid' }]} />
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>#</th><th>Due date</th><th className="r">Amount</th><th className="r">Paid</th><th className="r">Due</th><th>Status</th><th /></tr></thead><tbody>
        {s.installments.map((r) => <tr key={r.id}><td>{r.no}</td><td>{fmtDate(r.due_date)}</td><td className="r">{fmtMoney(r.amount)}</td><td className="r">{fmtMoney(r.paid)}</td><td className="r">{fmtMoney(r.due)}</td><td><Status v={r.status} /></td><td className="r">{w && r.due > 0.004 && <Btn size="sm" onClick={() => pay(r)}>Pay</Btn>}</td></tr>)}
      </tbody></table></div></> : <div className="muted">No installment contract. Paid to date across purchases: <b className="num" style={{ color: 'var(--ink)' }}>{fmtMoney(s.totalPaidAll)}</b></div>}
  </div>);
}

/* =================== PAYMENTS =================== */
function PaymentsPage() {
  const { db, user, go, open } = useApp(); const w = can(user, 'write');
  const [dir, setDir] = useState('in'); const [type, setType] = useState('all'); const [q, setQ] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const all = useMemo(() => buildLedger(db), [db]);
  const rows = all.filter((r) => (type === 'all' || r.type === type) && (!from || r.date >= from) && (!to || r.date <= to) && (!q.trim() || (r.receipt + ' ' + r.who + ' ' + r.target + ' ' + r.reference + ' ' + r.method).toLowerCase().indexOf(q.trim().toLowerCase()) >= 0));
  const net = (list) => sum(list, (r) => r.amount);
  const exps = db.project_expenses.filter((e) => live(e) && (!from || e.expense_date >= from) && (!to || e.expense_date <= to) && (!q.trim() || (e.code + ' ' + e.description + ' ' + e.payee_name).toLowerCase().indexOf(q.trim().toLowerCase()) >= 0)).sort((a, b) => b.expense_date.localeCompare(a.expense_date) || b.code.localeCompare(a.code));
  const opts = [{ id: 'all', label: 'All money in', count: all.length }, { id: 'share', label: 'Land share', count: all.filter((r) => r.type === 'share').length }, { id: 'cons', label: 'Construction', count: all.filter((r) => r.type === 'cons').length }];
  return (<>
    <PageHead title="Payments" sub="Every payment record. Money in from customers and money out to contractors are shown separately." flow={dir} demo actions={<><Btn icon="printer" onClick={() => dir === 'in' ? open('printPreview', { doc: 'payStatement', args: { ids: rows.map((r) => r.id), from: from, to: to } }) : open('printPreview', { doc: 'expenseRecords', args: { ids: exps.map((e) => e.id) } })}>Print statement</Btn>{w && (dir === 'in' ? <><Btn icon="plus" onClick={() => open('sharePayment', {})}>Land share payment</Btn><Btn variant="primary" icon="plus" onClick={() => open('consPayment', {})}>Construction payment</Btn></> : <Btn variant="primary" icon="plus" onClick={() => open('expense', {})}>Add project expense</Btn>)}</>} />
    <div className="grid g-auto">
      {dir === 'in' ? <>
        <Stat label="Land share received" value={fmtCompact(net(rows.filter((r) => r.type === 'share')))} title={fmtMoney(net(rows.filter((r) => r.type === 'share')))} flow="in" sub="Net of reversals" />
        <Stat label="Construction received" value={fmtCompact(net(rows.filter((r) => r.type === 'cons')))} title={fmtMoney(net(rows.filter((r) => r.type === 'cons')))} flow="in" sub="Net of reversals" />
        <Stat label="Total money in" value={fmtCompact(net(rows))} title={fmtMoney(net(rows))} sub={rows.length + ' entries'} />
      </> : <>
        <Stat label="Total money out" value={fmtCompact(sum(exps.filter(Calc.expenseCounts), (e) => e.amount))} title={fmtMoney(sum(exps.filter(Calc.expenseCounts), (e) => e.amount))} flow="out" sub="Excludes rejected" />
        <Stat label="Entries" value={exps.length} />
      </>}
    </div>
    <Card flush>
      <div className="toolbar">
        <Seg options={[{ id: 'in', label: 'Money in' }, { id: 'out', label: 'Money out' }]} value={dir} onChange={setDir} />
        <SearchBox value={q} onChange={setQ} placeholder={dir === 'in' ? 'Search receipt, shareholder, reference' : 'Search description or payee'} />
        <div className="chips"><label className="muted" htmlFor="pf">From</label><input id="pf" className="inp" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} style={{ width: 150 }} /><label className="muted" htmlFor="pt">To</label><input id="pt" className="inp" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} style={{ width: 150 }} />{(from || to) && <Btn size="sm" variant="ghost" onClick={() => { setFrom(''); setTo(''); }}>Clear dates</Btn>}</div>
        {dir === 'in' && <Chips options={opts} value={type} onChange={setType} />}
      </div>
      {dir === 'in' ? <LedgerTable rows={rows} pageSize={12} empty={{ title: 'No payments found', text: 'Clear the search, dates or type filter.', icon: 'card' }} /> : <ExpenseTable rows={exps} pageSize={12} />}
    </Card>
  </>);
}

/* =================== DOCUMENTS =================== */
function DocumentsPage() {
  const { db, user, open, confirm, run, S } = useApp(); const w = can(user, 'write');
  const [q, setQ] = useState(''); const [type, setType] = useState(''); const [rel, setRel] = useState('');
  const rows = useMemo(() => db.documents.filter(live).sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at)).filter((d) => (!type || d.doc_type === type) && (!rel || d.related_type === rel) && (!q.trim() || (d.file_name + ' ' + d.code + ' ' + d.description + ' ' + relatedLabel(db, d)).toLowerCase().indexOf(q.trim().toLowerCase()) >= 0)), [db, q, type, rel]);
  const archive = async (d) => { const a = await confirm({ title: 'Archive ' + d.file_name + '?', message: 'The document is hidden from lists but kept for the audit trail.', confirmLabel: 'Archive', danger: true, reason: true }); if (a.ok) run(() => S.archiveDocument(d.id, a.reason), 'Document archived'); };
  const cols = [
    { key: 'th', label: 'Preview', noSort: true, render: (d) => <div style={{ width: 52 }} onClick={(e) => e.stopPropagation()}><DocThumb doc={d} /></div> },
    { key: 'code', label: 'Document ID', render: (d) => <span className="mono">{d.code}</span> },
    { key: 'file_name', label: 'File name', render: (d) => <div className="cell-name"><div><b>{d.file_name}</b><span>{d.description}</span></div></div> },
    { key: 'doc_type', label: 'Type' },
    { key: 'rel', label: 'Related to', val: (d) => relatedLabel(db, d), render: (d) => relatedLabel(db, d) },
    { key: 'file_type', label: 'File type', render: (d) => <span className="mono">{d.file_type.split('/').pop()}</span> },
    { key: 'size_bytes', label: 'Size', align: 'r', render: (d) => fmtBytes(d.size_bytes) },
    { key: 'uploaded_at', label: 'Uploaded', render: (d) => <div>{fmtDate(d.uploaded_at.slice(0, 10))}<div className="muted" style={{ fontSize: 12 }}>by {userName(db, d.uploaded_by)}</div></div> },
    { key: 'actions', label: '', align: 'r', render: (d) => (<div className="act"><Btn size="sm" icon="eye" onClick={(e) => { e.stopPropagation(); open('docView', { id: d.id }); }}>View</Btn><RowMenu items={[{ label: 'Archive', icon: 'archive', danger: true, hidden: !can(user, 'archive'), onClick: () => archive(d) }]} /></div>) }
  ];
  return (<>
    <PageHead title="Documents" sub="NID, agreements, deeds, receipts and bills. Files will be kept in private storage." demo actions={w && <Btn variant="primary" icon="upload" onClick={() => open('document', {})}>Upload document</Btn>} />
    <Card flush>
      <div className="toolbar"><SearchBox value={q} onChange={setQ} placeholder="Search file name, ID, description" /><div style={{ minWidth: 190 }}><Sel value={type} onChange={setType} options={DOC_TYPES} placeholder="All document types" aria-label="Document type" /></div><div style={{ minWidth: 190 }}><Sel value={rel} onChange={setRel} options={RELATED_TYPES} placeholder="Related to anything" aria-label="Related to" /></div></div>
      <DataTable cols={cols} rows={rows} pageSize={12} onRowClick={(d) => open('lightbox', { docId: d.id })} empty={{ title: 'No documents found', text: q || type || rel ? 'Clear the search or filters.' : 'Upload the first document.', icon: 'file', action: w && !q && !type && !rel ? <Btn variant="primary" onClick={() => open('document', {})}>Upload document</Btn> : null }} />
    </Card>
  </>);
}
