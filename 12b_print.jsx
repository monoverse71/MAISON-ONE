/* ============================================================
   12b PRINT — A4 documents. Every template is a function of the live
   database (db) and small args, so a printout always matches the screen.
   PrintPreview shows the paper on screen and mirrors the same tree
   into #print-root, which is the only thing visible under @media print.
   ============================================================ */
const maskNid = (n) => n ? '•'.repeat(Math.max(0, String(n).length - 4)) + String(n).slice(-4) : '—';

/* Balance of one plan or booking as it stood when a payment was recorded. */
function asOf(list, p, key) {
  return sum(list.filter((x) => live(x) && x[key] === p[key] && (x.payment_date < p.payment_date || (x.payment_date === p.payment_date && x.created_at <= p.created_at))), (x) => x.amount);
}

/* One-page rule: every document is exactly one A4 sheet. After layout, the content block is scaled
   (CSS zoom) to the largest size that still fits the space between header and footer. */
function useFitOnePage(deps) {
  const doc = useRef(null), body = useRef(null), fit = useRef(null); const [scale, setScale] = useState(1);
  const run = useCallback(() => {
    const b = body.current, f = fit.current; if (!b || !f) return;
    const fits = (z) => { f.style.zoom = z; const bh = b.getBoundingClientRect().height, fh = f.getBoundingClientRect().height; return bh > 0 && fh <= bh + 0.5; };
    let lo = 0.12, hi = 1, best;
    if (fits(1)) best = 1; else { for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; } best = lo; best = Math.floor(best * 1000) / 1000; fits(best); }
    f.style.zoom = best; setScale(best);
  }, []);
  useLayoutEffect(() => { run(); }, deps);
  useEffect(() => {
    const d = doc.current; if (!d) return;
    const again = () => run(); d.addEventListener('load', again, true);
    window.addEventListener('beforeprint', again); window.addEventListener('resize', again);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(again);
    const t = setTimeout(again, 400), t2 = setTimeout(again, 1500);
    return () => { d.removeEventListener('load', again, true); window.removeEventListener('beforeprint', again); window.removeEventListener('resize', again); clearTimeout(t); clearTimeout(t2); };
  }, []);
  return { doc: doc, body: body, fit: fit, scale: scale };
}

function DocFrame({ title, docNo, date, ctx, children, landscape, note }) {
  const st = ctx.db.settings[0]; const fp = useFitOnePage([children]);
  useEffect(() => { window.dispatchEvent(new CustomEvent('docfit', { detail: fp.scale })); }, [fp.scale]);
  return (<article className={'doc' + (landscape ? ' land' : '')} ref={fp.doc} data-fit={fp.scale}>
    <header className="doc-head">
      <div className="doc-brand"><img className="doc-logo" src={BRAND_LOGO.url} alt="Apon Niketon Holdings logo" /><div><div className="doc-co">{st.company_name}</div><div className="doc-proj">{st.project_name}</div></div></div>
      <div className="doc-id"><div className="doc-title">{title}</div>{docNo && <div>No. <b className="mono">{docNo}</b></div>}<div>Date: <b>{fmtDate(date || TODAY)}</b></div></div>
    </header>
    <div className="doc-body" ref={fp.body}><div className="doc-fit" ref={fp.fit}>{children}</div></div>
    <footer className="doc-foot">
      <span>{st.company_name} · {title}{docNo ? ' · ' + docNo : ''}</span>
      <span>Printed {fmtDate(TODAY)} by {ctx.user.name}</span>
      {note && <span className="doc-note">{note}</span>}
    </footer>
  </article>);
}

function DT({ cols, rows, foot, empty }) {
  return (<table className="dt"><thead><tr>{cols.map((c, i) => <th key={i} className={c.r ? 'r' : ''} style={c.w ? { width: c.w } : undefined}>{c.l}</th>)}</tr></thead>
    <tbody>{rows.length ? rows.map((r, i) => <tr key={i} className={r._cls || ''}>{cols.map((c, j) => <td key={j} className={c.r ? 'r' : ''}>{c.f ? c.f(r, i) : r[c.k]}</td>)}</tr>) : <tr><td colSpan={cols.length} className="dt-empty">{empty || 'No records.'}</td></tr>}</tbody>
    {foot && <tfoot><tr>{cols.map((c, j) => { const v = foot[c.k != null ? c.k : j]; return <td key={j} className={c.r ? 'r' : ''}>{v != null ? v : ''}</td>; })}</tr></tfoot>}
  </table>);
}
function KV({ items, cols }) {
  return (<dl className="kv" style={cols ? { gridTemplateColumns: 'repeat(' + cols + ',minmax(0,1fr))' } : undefined}>{items.filter(Boolean).map((it, i) => <div key={i}><dt>{it[0]}</dt><dd>{it[1] == null || it[1] === '' ? '—' : it[1]}</dd></div>)}</dl>);
}
function Sect({ title, children }) { return (<section className="dsec"><h3>{title}</h3>{children}</section>); }
function Totals({ rows }) {
  return (<div className="dtot">{rows.map((r, i) => <div key={i} className={r.big ? 'big' : ''}><span>{r[0]}</span><b>{r[1]}</b></div>)}</div>);
}
function Boxes({ items }) {
  return (<div className="dbox-row">{items.map((it, i) => <div key={i} className="dbox"><span>{it[0]}</span><b>{it[1]}</b>{it[2] && <small>{it[2]}</small>}</div>)}</div>);
}
function Sigs({ labels }) {
  return (<div className="sigs">{labels.map((l, i) => <div key={i}><div className="sig-line" /><span>{l[0]}</span>{l[1] && <small>{l[1]}</small>}</div>)}</div>);
}
function PBar({ pct }) { return (<div className="pbar" aria-label={pct + ' percent'}><i style={{ width: Math.max(0, Math.min(100, pct)) + '%' }} /></div>); }
function DocImg({ doc, label }) {
  const url = useFileUrl(doc);
  return (<figure className="dimg">{doc && isImg(doc) && url ? <img src={url} alt={label} /> : <div className="dimg-none">{doc ? (isPdfDoc(doc) ? 'PDF file' : 'No preview') : 'Not provided'}</div>}<figcaption>{label}</figcaption></figure>);
}
const okDoc = (db, id) => { const d = id ? Calc.byId(db.documents, id) : null; return d && !d.archived_at ? d : null; };
const Missing = ({ what }) => <article className="doc"><div className="doc-body"><p>{what || 'This record could not be found.'}</p></div></article>;
const partyBox = (db, sh) => (<KV cols={2} items={[['Shareholder', <b>{sh.full_name}</b>], ['Shareholder ID', sh.code], ['Phone', sh.phone], ['NID', maskNid(sh.nid)], ['Address', sh.address], ['Email', sh.email]]} />);

/* ---------------- templates ---------------- */
const PRINT_DOCS = {
  /* Share and construction payment receipts */
  receipt: {
    title: (a) => a.kind === 'share' ? 'Share payment receipt' : 'Construction contribution receipt',
    render: (ctx, a) => {
      const db = ctx.db, share = a.kind === 'share', p = Calc.byId(share ? db.share_payments : db.construction_payments, a.id); if (!p) return <Missing />;
      const sh = Calc.byId(db.shareholders, p.shareholder_id), b = share ? Calc.byId(db.share_bookings, p.booking_id) : null, u = !share ? Calc.byId(db.units, p.unit_id) : null, plan = !share ? Calc.byId(db.construction_plans, p.plan_id) : null;
      const bs = b ? Calc.bookingSummary(db, b) : null, pc = plan ? Calc.plan(db, plan) : null;
      const total = share ? bs.grand : pc.total, paidAt = share ? asOf(db.share_payments, p, 'booking_id') : asOf(db.construction_payments, p, 'plan_id'), dueAt = roundMoney(total - paidAt);
      const att = okDoc(db, p.attachment_doc_id), reversed = p.status === 'Reversed', isRev = p.kind === 'reversal';
      const unit = share ? db.units.filter((x) => live(x) && x.shareholder_id === sh.id) : [u];
      return (<DocFrame ctx={ctx} title={isRev ? 'Payment reversal note' : share ? 'Share payment receipt' : 'Construction contribution receipt'} docNo={p.receipt_no} date={p.payment_date}>
        {reversed && <div className="stamp">REVERSED</div>}
        <Sect title="Received from">{partyBox(db, sh)}</Sect>
        <Sect title={share ? 'Booking and unit' : 'Unit'}>
          <KV cols={2} items={share ? [['Booking', b.code], ['Shares booked', b.quantity + ' × ' + fmtMoney(b.unit_price)], ['Unit(s)', unit.map((x) => x.code).join(', ') || 'Not assigned yet'], ['Payment type', 'Land share payment']] : [['Unit', <b>{u.code}</b>], ['Floor · size', floorName(u.floor) + ' · ' + u.size_sqft.toLocaleString('en-US') + ' sq ft'], ['Contribution ref.', plan.code], ['Payment type', 'Construction contribution']]} />
        </Sect>
        <Sect title="Payment details">
          <DT cols={[{ l: 'Receipt no.', k: 'r' }, { l: 'Date', k: 'd' }, { l: 'Method', k: 'm' }, { l: 'Reference', k: 'x' }, { l: 'Amount', r: true, f: (r) => <b>{fmtMoney(p.amount)}</b> }]} rows={[{ r: p.receipt_no, d: fmtDate(p.payment_date), m: methodLabel(p), x: p.reference || '—' }]} />
          <div className="words"><span>Amount in words</span><b>{amountInWords(Math.abs(p.amount))}</b></div>
          {p.note && <p className="dnote">Note: {p.note}</p>}
          {isRev && <p className="dnote">This entry cancels {db.construction_payments.concat(db.share_payments).filter((x) => x.id === p.reversal_of).map((x) => x.receipt_no).join('')}. Reason: {p.reversal_reason}</p>}
        </Sect>
        <Sect title="Account position after this payment">
          <Boxes items={[[share ? 'Booking total' : 'Total contribution', fmtMoney(total)], ['Total paid to date', fmtMoney(paidAt), 'Including this payment'], ['Remaining due', fmtMoney(dueAt), total ? fmtPct(Math.max(0, paidAt / total * 100)) + ' paid' : '']]} />
          <PBar pct={total ? paidAt / total * 100 : 0} />
        </Sect>
        <div className="dmeta">Recorded by {userName(db, p.created_by)} on {fmtDateTime(p.created_at)}{att ? ' · Attachment on file: ' + att.file_name : ''}</div>
        <Sigs labels={[['Received by', 'Name, signature and date'], ['Authorised signatory', st(ctx).company_name], ['Shareholder / client', sh.full_name]]} />
        <p className="dnote center">This receipt is valid only when signed by an authorised signatory. Payments are subject to verification by the company.</p>
      </DocFrame>);
    }
  },

  /* Share booking / transaction document */
  booking: {
    title: () => 'Share booking document',
    render: (ctx, a) => {
      const db = ctx.db, b = Calc.byId(db.share_bookings, a.id); if (!b) return <Missing />;
      const sh = Calc.byId(db.shareholders, b.shareholder_id), s = Calc.bookingSummary(db, b), pays = s.payments.slice().sort((x, y) => x.payment_date.localeCompare(y.payment_date) || x.created_at.localeCompare(y.created_at));
      const units = db.units.filter((x) => live(x) && x.shareholder_id === sh.id); let run = s.grand;
      const rows = pays.map((p) => { run = roundMoney(run - p.amount); return { date: fmtDate(p.payment_date), rc: p.receipt_no, m: methodLabel(p), x: p.reference || '—', a: p.amount, bal: run, _cls: p.status === 'Reversed' ? 'strike' : '' }; });
      return (<DocFrame ctx={ctx} title="Share booking document" docNo={b.code} date={b.booking_date}>
        <Sect title="Shareholder">{partyBox(db, sh)}</Sect>
        <Sect title="Booking details">
          <KV cols={3} items={[['Booking no.', b.code], ['Booking date', fmtDate(b.booking_date)], ['Shares booked', b.quantity], ['Price per share', fmtMoney(b.unit_price)], ['Reference person', b.reference_person], ['Allocated unit(s)', units.map((u) => u.code).join(', ') || 'Not assigned yet']]} />
        </Sect>
        <Sect title="Value">
          <Totals rows={[['Total value', fmtMoney(s.total)], ['Discount', '− ' + fmtMoney(s.discount)], ['Grand total', fmtMoney(s.grand), true], ['Paid to date', fmtMoney(s.paid)], ['Remaining due', fmtMoney(s.due), true]].map((r) => ({ 0: r[0], 1: r[1], big: r[2] }))} />
          <div className="words"><span>Grand total in words</span><b>{amountInWords(s.grand)}</b></div>
        </Sect>
        <Sect title="Payments received against this booking">
          <DT cols={[{ l: 'Date', k: 'date' }, { l: 'Receipt', k: 'rc' }, { l: 'Method', k: 'm' }, { l: 'Reference', k: 'x' }, { l: 'Amount', r: true, f: (r) => fmtMoney(r.a) }, { l: 'Due after', r: true, f: (r) => fmtMoney(r.bal) }]} rows={rows} foot={{ 3: 'Total paid', 4: fmtMoney(s.paid), 5: fmtMoney(s.due) }} empty="No payment recorded yet." />
        </Sect>
        {b.remarks && <p className="dnote">Remarks: {b.remarks}</p>}
        <Sigs labels={[['Shareholder', sh.full_name], ['Authorised signatory', ctx.db.settings[0].company_name], ['Witness', 'Name and signature']]} />
      </DocFrame>);
    }
  },

  /* Construction contribution statement (one unit) */
  consStatement: {
    title: () => 'Construction contribution statement',
    render: (ctx, a) => {
      const db = ctx.db, plan = Calc.byId(db.construction_plans, a.planId); if (!plan) return <Missing />;
      const sh = Calc.byId(db.shareholders, plan.shareholder_id), u = Calc.byId(db.units, plan.unit_id), pc = Calc.plan(db, plan);
      const pays = pc.payments.slice().sort((x, y) => x.payment_date.localeCompare(y.payment_date) || x.created_at.localeCompare(y.created_at)); let run = pc.total;
      const rows = pays.map((p, i) => { run = roundMoney(run - p.amount); return { n: i + 1, date: fmtDate(p.payment_date), rc: p.receipt_no, m: methodLabel(p), x: p.reference || '—', note: p.note || (p.kind === 'reversal' ? 'Reversal' : ''), a: p.amount, bal: run, _cls: p.status === 'Reversed' ? 'strike' : '' }; });
      return (<DocFrame ctx={ctx} title="Construction contribution statement" docNo={'CS-' + plan.code + '-' + TODAY.replace(/-/g, '')} date={TODAY}>
        <Sect title="Shareholder and unit"><KV cols={2} items={[['Shareholder', <b>{sh.full_name}</b>], ['Shareholder ID', sh.code], ['Unit', <b>{u.code}</b>], ['Floor · size', floorName(u.floor) + ' · ' + u.size_sqft.toLocaleString('en-US') + ' sq ft'], ['Contribution ref.', plan.code], ['Status', pc.status]]} /></Sect>
        <Sect title="Position as of today">
          <Boxes items={[['Total contribution', fmtMoney(pc.total)], ['Total paid', fmtMoney(pc.paid), pc.count + ' payment' + (pc.count === 1 ? '' : 's')], ['Remaining due', fmtMoney(pc.due)], ['Payment progress', fmtPct(pc.pctExact)]]} />
          <PBar pct={pc.pct} />
        </Sect>
        <Sect title="Payment history">
          <DT cols={[{ l: '#', k: 'n', w: '6%' }, { l: 'Date', k: 'date' }, { l: 'Receipt no.', k: 'rc' }, { l: 'Method', k: 'm' }, { l: 'Reference', k: 'x' }, { l: 'Note', k: 'note' }, { l: 'Amount', r: true, f: (r) => fmtMoney(r.a) }, { l: 'Due after', r: true, f: (r) => fmtMoney(r.bal) }]} rows={rows} foot={{ 4: 'Total paid', 6: fmtMoney(pc.paid), 7: fmtMoney(pc.due) }} empty="No payment has been recorded yet." />
        </Sect>
        <p className="dnote">There is no fixed installment schedule. The client may pay any amount on any date until the total contribution is settled. Reversed entries are shown struck through and are cancelled by a matching reversal.</p>
        <Sigs labels={[['Prepared by', ctx.user.name], ['Authorised signatory', ctx.db.settings[0].company_name], ['Shareholder / client', sh.full_name]]} />
      </DocFrame>);
    }
  },

  /* Shareholder financial statement */
  shStatement: {
    title: () => 'Shareholder financial statement',
    render: (ctx, a) => {
      const db = ctx.db, sh = Calc.byId(db.shareholders, a.id); if (!sh) return <Missing />;
      const c = Calc.shareholder(db, sh), led = buildLedger(db, { shareholderId: sh.id }).sort((x, y) => x.date.localeCompare(y.date));
      const share = led.filter((l) => l.type === 'share'), cons = led.filter((l) => l.type === 'cons');
      const pcols = [{ l: 'Date', f: (r) => fmtDate(r.date) }, { l: 'Receipt', k: 'receipt' }, { l: 'For', k: 'target' }, { l: 'Method', k: 'method' }, { l: 'Reference', k: 'reference' }, { l: 'Amount', r: true, f: (r) => fmtMoney(r.amount) }, { l: 'Status', k: 'status' }];
      const mark = (l) => l.map((r) => Object.assign({ _cls: r.rec.status === 'Reversed' ? 'strike' : '' }, r));
      return (<DocFrame ctx={ctx} title="Shareholder financial statement" docNo={'FS-' + sh.code + '-' + TODAY.replace(/-/g, '')} date={TODAY}>
        <Sect title="Shareholder">{partyBox(db, sh)}</Sect>
        <Sect title="Summary as of today">
          <Boxes items={[['Total received', fmtMoney(c.received)], ['Land share due', fmtMoney(c.shareDue)], ['Construction due', fmtMoney(c.consDue)], ['Total outstanding', fmtMoney(c.outstanding)]]} />
        </Sect>
        <Sect title="A. Land share bookings">
          <DT cols={[{ l: 'Booking', f: (r) => r.b.code }, { l: 'Date', f: (r) => fmtDate(r.b.booking_date) }, { l: 'Shares', r: true, f: (r) => r.b.quantity }, { l: 'Grand total', r: true, f: (r) => fmtMoney(r.s.grand) }, { l: 'Paid', r: true, f: (r) => fmtMoney(r.s.paid) }, { l: 'Due', r: true, f: (r) => fmtMoney(r.s.due) }, { l: 'Status', f: (r) => r.s.status }]} rows={c.bookings} foot={{ 3: fmtMoney(c.shareValue), 4: fmtMoney(c.sharePaid), 5: fmtMoney(c.shareDue) }} empty="No share booking." />
        </Sect>
        <Sect title="Land share payments"><DT cols={pcols} rows={mark(share)} foot={{ 5: fmtMoney(sum(share, (r) => r.amount)) }} empty="No land share payment." /></Sect>
        <Sect title="B. Construction contributions">
          <DT cols={[{ l: 'Unit', f: (r) => Calc.byId(db.units, r.p.unit_id).code }, { l: 'Total contribution', r: true, f: (r) => fmtMoney(r.s.total) }, { l: 'Paid', r: true, f: (r) => fmtMoney(r.s.paid) }, { l: 'Due', r: true, f: (r) => fmtMoney(r.s.due) }, { l: 'Progress', r: true, f: (r) => fmtPct(r.s.pctExact) }, { l: 'Status', f: (r) => r.s.status }]} rows={c.plans} foot={{ 1: fmtMoney(c.consTotal), 2: fmtMoney(c.consPaid), 3: fmtMoney(c.consDue) }} empty="No construction contribution set." />
        </Sect>
        <Sect title="Construction payments"><DT cols={pcols} rows={mark(cons)} foot={{ 5: fmtMoney(sum(cons, (r) => r.amount)) }} empty="No construction payment." /></Sect>
        <Sect title="Overall">
          <Totals rows={[{ 0: 'Land share value', 1: fmtMoney(c.shareValue) }, { 0: 'Construction contribution total', 1: fmtMoney(c.consTotal) }, { 0: 'Total receivable', 1: fmtMoney(c.shareValue + c.consTotal), big: true }, { 0: 'Total received', 1: fmtMoney(c.received) }, { 0: 'Total outstanding', 1: fmtMoney(c.outstanding), big: true }]} />
        </Sect>
        <p className="dnote">Land share money and construction contribution money are kept in separate ledgers. Reversed entries are shown struck through.</p>
        <Sigs labels={[['Prepared by', ctx.user.name], ['Authorised signatory', ctx.db.settings[0].company_name]]} />
      </DocFrame>);
    }
  },

  /* Shareholder 360 summary */
  profile: {
    title: () => 'Shareholder 360° summary',
    render: (ctx, a) => {
      const db = ctx.db, sh = Calc.byId(db.shareholders, a.id); if (!sh) return <Missing />;
      const c = Calc.shareholder(db, sh), nom = db.nominees.filter((n) => n.shareholder_id === sh.id && live(n))[0], led = buildLedger(db, { shareholderId: sh.id }).slice(0, 10);
      const dcs = db.documents.filter((d) => live(d) && d.related_type === 'shareholder' && d.related_id === sh.id && !d.slot);
      return (<DocFrame ctx={ctx} title="Shareholder 360° summary" docNo={sh.code} date={TODAY}>
        <div className="prof-top">
          <DocImg doc={okDoc(db, sh.photo_doc_id)} label="Photo" />
          <div style={{ flex: 1 }}><h2 className="prof-name">{sh.full_name}</h2><KV cols={2} items={[['Shareholder ID', sh.code], ['Status', sh.status], ['Phone', sh.phone], ['Email', sh.email], ['NID', maskNid(sh.nid)], ['Registered', fmtDate(sh.registration_date)], ['Profession', sh.profession + (sh.designation ? ', ' + sh.designation : '')], ['Address', sh.address]]} /></div>
        </div>
        <Sect title="Holdings and finances">
          <Boxes items={[['Shares held', c.shares, c.bookings.length + ' booking(s)'], ['Units', c.units.map((u) => u.code).join(', ') || '—'], ['Total received', fmtMoney(c.received)], ['Total outstanding', fmtMoney(c.outstanding)]]} />
          <DT cols={[{ l: 'Ledger', k: 'l' }, { l: 'Total', r: true, f: (r) => fmtMoney(r.t) }, { l: 'Paid', r: true, f: (r) => fmtMoney(r.p) }, { l: 'Due', r: true, f: (r) => fmtMoney(r.d) }, { l: 'Progress', r: true, f: (r) => fmtPct(r.t ? r.p / r.t * 100 : 0) }]} rows={[{ l: 'Land share', t: c.shareValue, p: c.sharePaid, d: c.shareDue }, { l: 'Construction contribution', t: c.consTotal, p: c.consPaid, d: c.consDue }]} />
        </Sect>
        <Sect title="Construction by unit">
          <DT cols={[{ l: 'Unit', f: (r) => Calc.byId(db.units, r.p.unit_id).code }, { l: 'Total', r: true, f: (r) => fmtMoney(r.s.total) }, { l: 'Paid', r: true, f: (r) => fmtMoney(r.s.paid) }, { l: 'Due', r: true, f: (r) => fmtMoney(r.s.due) }, { l: 'Progress', r: true, f: (r) => fmtPct(r.s.pctExact) }, { l: 'Status', f: (r) => r.s.status }]} rows={c.plans} empty="No construction contribution set." />
        </Sect>
        <Sect title="Nominee">
          {nom ? <div className="prof-top"><DocImg doc={okDoc(db, nom.photo_doc_id)} label="Nominee photo" /><div style={{ flex: 1 }}><KV cols={2} items={[['Name', <b>{nom.name}</b>], ['Relation', nom.relation], ['Phone', nom.phone], ['NID', maskNid(nom.nid)], ['Address', nom.address]]} /></div></div> : <p className="dnote">No nominee recorded.</p>}
        </Sect>
        <Sect title="Identity documents on file">
          <div className="dimg-row"><DocImg doc={okDoc(db, sh.nid_front_doc_id)} label="NID front" /><DocImg doc={okDoc(db, sh.nid_back_doc_id)} label="NID back" />{nom && <><DocImg doc={okDoc(db, nom.nid_front_doc_id)} label="Nominee NID front" /><DocImg doc={okDoc(db, nom.nid_back_doc_id)} label="Nominee NID back" /></>}</div>
          {dcs.length > 0 && <p className="dnote">Other documents: {dcs.map((d) => d.doc_type + ' (' + d.file_name + ')').join('; ')}</p>}
        </Sect>
        <Sect title="Latest payments">
          <DT cols={[{ l: 'Date', f: (r) => fmtDate(r.date) }, { l: 'Receipt', k: 'receipt' }, { l: 'Type', f: (r) => r.type === 'share' ? 'Land share' : 'Construction' }, { l: 'For', k: 'target' }, { l: 'Method', k: 'method' }, { l: 'Amount', r: true, f: (r) => fmtMoney(r.amount) }]} rows={led} empty="No payment yet." />
        </Sect>
        <Sigs labels={[['Prepared by', ctx.user.name], ['Authorised signatory', ctx.db.settings[0].company_name]]} />
      </DocFrame>);
    }
  },

  /* Payment history / statement (money in) */
  payStatement: {
    title: () => 'Payment statement',
    landscape: (a) => !a.shareholderId,
    render: (ctx, a) => {
      const db = ctx.db, sh = a.shareholderId ? Calc.byId(db.shareholders, a.shareholderId) : null;
      let led = buildLedger(db, a.shareholderId ? { shareholderId: a.shareholderId } : {}); if (a.ids) led = led.filter((l) => a.ids.indexOf(l.id) >= 0);
      led = led.sort((x, y) => x.date.localeCompare(y.date) || x.receipt.localeCompare(y.receipt));
      const share = sum(led.filter((l) => l.type === 'share'), (l) => l.amount), cons = sum(led.filter((l) => l.type === 'cons'), (l) => l.amount);
      const cols = [{ l: 'Date', f: (r) => fmtDate(r.date) }, { l: 'Receipt', k: 'receipt' }, { l: 'Type', f: (r) => r.type === 'share' ? 'Land share' : 'Construction' }].concat(sh ? [] : [{ l: 'Shareholder', k: 'who' }]).concat([{ l: 'For', k: 'target' }, { l: 'Method', k: 'method' }, { l: 'Reference', k: 'reference' }, { l: 'Amount', r: true, f: (r) => fmtMoney(r.amount) }, { l: 'Status', k: 'status' }]);
      return (<DocFrame ctx={ctx} landscape={!sh} title="Payment statement" docNo={'PS-' + (sh ? sh.code : 'ALL') + '-' + TODAY.replace(/-/g, '')} date={TODAY}>
        {sh && <Sect title="Shareholder">{partyBox(db, sh)}</Sect>}
        {(a.from || a.to) && <p className="dnote">Period: {a.from ? fmtDate(a.from) : 'start'} to {a.to ? fmtDate(a.to) : 'today'}</p>}
        <Sect title="Payments received (money in)"><DT cols={cols} rows={led.map((r) => Object.assign({ _cls: r.rec.status === 'Reversed' ? 'strike' : '' }, r))} foot={{ [cols.length - 3]: 'Net total', [cols.length - 2]: fmtMoney(share + cons) }} empty="No payments match." /></Sect>
        <Totals rows={[{ 0: 'Land share payments (net)', 1: fmtMoney(share) }, { 0: 'Construction payments (net)', 1: fmtMoney(cons) }, { 0: 'Total received', 1: fmtMoney(share + cons), big: true }]} />
        <p className="dnote">Reversals appear as negative lines and cancel the original entry, which is shown struck through.</p>
        <Sigs labels={[['Prepared by', ctx.user.name], ['Authorised signatory', ctx.db.settings[0].company_name]]} />
      </DocFrame>);
    }
  },

  /* Project expense records (money out) */
  expenseRecords: {
    title: () => 'Project expense records',
    landscape: () => true,
    render: (ctx, a) => {
      const db = ctx.db; let ex = db.project_expenses.filter(live); if (a.ids) ex = ex.filter((e) => a.ids.indexOf(e.id) >= 0);
      ex = ex.sort((x, y) => x.expense_date.localeCompare(y.expense_date) || x.code.localeCompare(y.code));
      const counted = ex.filter(Calc.expenseCounts), approved = sum(counted.filter((e) => e.approval_status === 'Approved'), (e) => e.amount), pending = sum(counted.filter((e) => e.approval_status === 'Pending'), (e) => e.amount);
      const cats = {}; counted.forEach((e) => { cats[e.category] = roundMoney((cats[e.category] || 0) + e.amount); });
      return (<DocFrame ctx={ctx} landscape title="Project expense records" docNo={'PE-' + TODAY.replace(/-/g, '')} date={TODAY}>
        <Boxes items={[['Approved spending', fmtMoney(approved)], ['Awaiting approval', fmtMoney(pending)], ['Records', ex.length]]} />
        <Sect title="Expenses (money out)"><DT cols={[{ l: 'Date', f: (r) => fmtDate(r.expense_date) }, { l: 'Expense', k: 'code' }, { l: 'Category', f: (r) => catLabel(r) }, { l: 'Payee', f: (r) => r.payee_name || '—' }, { l: 'Description', k: 'description' }, { l: 'Method · ref.', f: (r) => methodLabel(r) + (r.reference ? ' · ' + r.reference : '') }, { l: 'Approval', f: (r) => r.status === 'Reversed' ? 'Reversed' : r.kind === 'reversal' ? 'Reversal' : r.approval_status }, { l: 'Amount', r: true, f: (r) => fmtMoney(r.amount) }]} rows={ex.map((e) => Object.assign({ _cls: e.status === 'Reversed' || e.approval_status === 'Rejected' ? 'strike' : '' }, e))} foot={{ 6: 'Counted total', 7: fmtMoney(sum(counted, (e) => e.amount)) }} empty="No expense records." /></Sect>
        <Sect title="By category"><DT cols={[{ l: 'Category', k: 'c' }, { l: 'Amount', r: true, f: (r) => fmtMoney(r.v) }]} rows={Object.keys(cats).sort((x, y) => cats[y] - cats[x]).map((k) => ({ c: k, v: cats[k] }))} foot={{ 0: 'Total', 1: fmtMoney(sum(counted, (e) => e.amount)) }} /></Sect>
        <p className="dnote">Rejected expenses are not counted. Reversed entries are shown struck through and cancelled by a matching reversal.</p>
        <Sigs labels={[['Prepared by', ctx.user.name], ['Checked by', 'Accountant'], ['Approved by', 'Authorised signatory']]} />
      </DocFrame>);
    }
  },

  /* Single expense voucher */
  expenseVoucher: {
    title: () => 'Payment voucher',
    render: (ctx, a) => {
      const db = ctx.db, e = Calc.byId(db.project_expenses, a.id); if (!e) return <Missing />;
      const bill = okDoc(db, e.attachment_doc_id) || db.documents.filter((d) => d.related_type === 'expense' && d.related_id === e.id && live(d))[0];
      return (<DocFrame ctx={ctx} title="Payment voucher" docNo={e.code} date={e.expense_date}>
        {e.status === 'Reversed' && <div className="stamp">REVERSED</div>}
        <Sect title="Paid to"><KV cols={2} items={[['Payee', <b>{e.payee_name || '—'}</b>], ['Category', catLabel(e)], ['Description', e.description], ['Approval', e.approval_status + (e.approved_by ? ' by ' + userName(db, e.approved_by) : '')]]} /></Sect>
        <Sect title="Payment"><DT cols={[{ l: 'Voucher no.', k: 'c' }, { l: 'Date', k: 'd' }, { l: 'Method', k: 'm' }, { l: 'Reference', k: 'x' }, { l: 'Amount', r: true, f: () => <b>{fmtMoney(e.amount)}</b> }]} rows={[{ c: e.code, d: fmtDate(e.expense_date), m: methodLabel(e), x: e.reference || '—' }]} /><div className="words"><span>Amount in words</span><b>{amountInWords(Math.abs(e.amount))}</b></div>{e.remarks && <p className="dnote">Remarks: {e.remarks}</p>}{bill && <p className="dnote">Bill on file: {bill.file_name}</p>}</Sect>
        <div className="dmeta">Entered by {userName(db, e.created_by)} on {fmtDateTime(e.created_at)}</div>
        <Sigs labels={[['Prepared by', userName(db, e.created_by)], ['Approved by', 'Authorised signatory'], ['Received by', e.payee_name || 'Payee']]} />
      </DocFrame>);
    }
  },

  /* Project sheet: information, structure and every project image on one page */
  project: {
    title: () => 'Project details',
    render: (ctx, a) => {
      const db = ctx.db, st = db.settings[0], units = db.units.filter(live), imgs = projectImagesOf(db);
      return (<DocFrame ctx={ctx} title="Project details" docNo={'PD-' + TODAY.replace(/-/g, '')} date={TODAY}>
        <Sect title="Project"><KV cols={2} items={[['Project name', <b>{st.project_name}</b>], ['Project type', st.project_type], ['Location', st.location], ['Developer / company', st.company_name], ['Land area', st.land_area], ['Total area', st.total_area], ['Building', 'Ground + 12 Floors + Rooftop'], ['Commercial', 'Ground\u20133rd Floor'], ['Residential', '4th\u201312th Floor'], ['Residential floors', RES_FLOORS.length], ['Units per floor', UNIT_LETTERS.length], ['Residential units', units.length], ['Rooftop', 'Amenity area, not residential'], ['Unit size', units.length ? units[0].size_sqft.toLocaleString('en-US') + ' sq ft each' : ''], ['Construction start', st.construction_start ? fmtDate(st.construction_start) : ''], ['Expected completion', st.expected_completion ? fmtDate(st.expected_completion) : '']]} /></Sect>
        <Sect title="Description"><p className="dnote" style={{ fontSize: '9.5pt', color: '#1F2937' }}>{st.description || '—'}</p></Sect>
        <Sect title="Building structure"><DT cols={[{ l: 'Floor', k: 'f' }, { l: 'Use', k: 'u' }, { l: 'Units', r: true, k: 'n' }]} rows={BUILDING.map((b) => ({ f: b.label, u: b.use, n: b.units || '—' }))} foot={{ 0: 'Total', 2: units.length }} /></Sect>
        <Sect title="Construction, handover and contact"><KV cols={2} items={[['Construction / handover', st.handover_info], ['Contact phone', st.contact_phone], ['Contact email', st.contact_email], ['Contact address', st.contact_address]]} /></Sect>
        <Sect title={'Project images (' + imgs.length + ')'}>{imgs.length ? <div className="dimg-row">{imgs.map((d) => <DocImg key={d.id} doc={d} label={d.caption + ' · ' + d.category} />)}</div> : <p className="dnote">No project images added.</p>}</Sect>
        {st.notes && <Sect title="Notes"><p className="dnote">{st.notes}</p></Sect>}
      </DocFrame>);
    }
  },

  /* Any report definition */
  report: {
    title: (a) => { const r = REPORTS.filter((x) => x.id === a.reportId)[0]; return r ? r.title : 'Report'; },
    landscape: (a) => { const r = REPORTS.filter((x) => x.id === a.reportId)[0]; return !!r && r.id !== 'overall' && r.cols.length > 6; },
    render: (ctx, a) => {
      const db = ctx.db, rep = REPORTS.filter((x) => x.id === a.reportId)[0]; if (!rep) return <Missing />; const f = Object.assign({ from: '', to: '', status: '', q: '' }, a.filters || {});
      const res = runReport(rep, db, f), land = rep.id !== 'overall' && rep.cols.length > 6;
      const cols = rep.cols.map((c) => ({ l: c.l, r: c.t === 'money' || c.t === 'int', f: (r) => c.t === 'money' ? fmtMoney(r[c.k]) : formatCell(c, r[c.k]) }));
      const foot = {}; rep.cols.forEach((c, i) => { if (res.totals[c.k] != null) foot[i] = c.t === 'money' ? fmtMoney(res.totals[c.k]) : res.totals[c.k]; }); if (Object.keys(foot).length && !foot[0]) foot[0] = 'Total';
      return (<DocFrame ctx={ctx} landscape={land} title={rep.title} docNo={'RP-' + rep.id.toUpperCase().slice(0, 8) + '-' + TODAY.replace(/-/g, '')} date={TODAY}>
        <p className="dnote">{rep.desc}{(f.from || f.to) ? ' Period: ' + (f.from ? fmtDate(f.from) : 'start') + ' to ' + (f.to ? fmtDate(f.to) : 'today') + '.' : ''}{f.status ? ' Status: ' + f.status + '.' : ''}{f.q ? ' Search: “' + f.q + '”.' : ''}</p>
        {rep.id === 'overall'
          ? ['Money in', 'Money out', 'Net', 'Outstanding (as of today)', 'Position (as of today)'].map((sec) => <Sect key={sec} title={sec}><Totals rows={res.rows.filter((r) => r.section === sec).map((r) => ({ 0: r.item, 1: fmtMoney(r.amount), big: /^Total|Net|Available/.test(r.item) }))} /></Sect>)
          : <Sect title={res.rows.length + ' record' + (res.rows.length === 1 ? '' : 's')}><DT cols={cols} rows={res.rows} foot={Object.keys(foot).length ? foot : null} empty="No records match the filters." /></Sect>}
        <Sigs labels={[['Prepared by', ctx.user.name], ['Reviewed by', 'Accountant'], ['Authorised signatory', ctx.db.settings[0].company_name]]} />
      </DocFrame>);
    }
  }
};
function st(ctx) { return ctx.db.settings[0]; }

/* ---------------- preview + print ---------------- */
function PrintPreview({ doc, args, onClose }) {
  const app = useApp(); const def = PRINT_DOCS[doc]; const tok = useRef({}); const wrap = useRef(null);
  const [fitScale, setFitScale] = useState(1); const [scale, setScale] = useState(1); const [blocked, setBlocked] = useState(false); const [zoomMode, setZoomMode] = useState('fit');
  const landscape = def && def.landscape ? def.landscape(args || {}) : false, pw = landscape ? 1123 : 794;
  useEffect(() => {
    MODAL_STACK.push(tok.current); const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const key = (e) => { if (e.key === 'Escape' && MODAL_STACK[MODAL_STACK.length - 1] === tok.current) onClose(); };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); MODAL_STACK.splice(MODAL_STACK.indexOf(tok.current), 1); document.body.style.overflow = prev; };
  }, []);
  useEffect(() => {
    const fit = () => { const w = wrap.current ? wrap.current.clientWidth - 32 : pw; setScale(zoomMode === 'fit' ? Math.min(1, w / pw) : 1); };
    fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit);
  }, [zoomMode, pw]);
  /* #print-root holds the same document for the browser's print engine. */
  useEffect(() => { const h = (e) => setFitScale(e.detail); window.addEventListener('docfit', h); return () => window.removeEventListener('docfit', h); }, []);
  const root = document.getElementById('print-root');
  useEffect(() => { document.body.classList.add('printing'); return () => document.body.classList.remove('printing'); }, []);
  if (!def) return null;
  const ctx = { db: app.db, user: app.user };
  const el = def.render(ctx, args || {});
  const doPrint = () => {
    let fired = false; const on = () => { fired = true; }; window.addEventListener('beforeprint', on);
    try { window.print(); } catch (e) { }
    setTimeout(() => { window.removeEventListener('beforeprint', on); if (!fired) setBlocked(true); }, 700);
  };
  const title = def.title(args || {});
  return (<div className="pv" role="dialog" aria-modal="true" aria-label={'Print preview: ' + title}>
    <div className="pv-bar">
      <div style={{ minWidth: 0 }}><b>{title}</b><span className="pv-sub">A4 {landscape ? 'landscape' : 'portrait'} · exactly one page{fitScale < 0.995 ? ' · scaled to ' + Math.round(fitScale * 100) + '% to fit' : ''}</span></div>
      <div className="chips">
        <Btn size="sm" onClick={() => setZoomMode(zoomMode === 'fit' ? 'full' : 'fit')}>{zoomMode === 'fit' ? 'Actual size' : 'Fit to screen'}</Btn>
        <Btn size="sm" variant="primary" icon="printer" onClick={doPrint}>Print A4</Btn>
        <Btn size="sm" icon="x" onClick={onClose}>Close</Btn>
      </div>
    </div>
    {blocked && <div className="pv-note" role="status"><b>Printing did not open.</b> This preview may be embedded in a page that blocks the print dialog. Open the app in its own browser tab, then choose Print A4 (or press Ctrl/Cmd+P) to print or save as PDF. The layout shown here is the layout that will print.</div>}
    <div className="pv-scroll" ref={wrap}>
      <div className="paper-outer" style={{ width: pw * scale, }}>
        <div className={'paper' + (landscape ? ' land' : '')} style={{ zoom: scale, width: pw }}>{el}</div>
      </div>
    </div>
    {root && ReactDOM.createPortal(<div className="print-copy" data-orient={landscape ? 'landscape' : 'portrait'}>{el}</div>, root)}
  </div>);
}

MODAL_REGISTRY.printPreview = PrintPreview;
MODAL_REGISTRY.lightbox = Lightbox;
