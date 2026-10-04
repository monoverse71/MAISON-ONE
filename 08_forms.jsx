/* ============================================================
   08 FORMS + MODALS — every form validates with V.*, then calls a
   service (S.*). Modals are opened through useApp().open(name, props).
   ============================================================ */
function ModalFooter({ onClose, busy, label, onSubmit, extra, cancelLabel }) {
  return (<>{extra}<Btn onClick={onClose}>{cancelLabel || 'Cancel'}</Btn><Btn variant="primary" busy={busy} onClick={onSubmit}>{label || 'Save'}</Btn></>);
}

/* ---------- payment fields shared by share + construction forms ---------- */
function PaymentFields({ f, set, errs, dueHint }) {
  return (<>
    <Field label="Amount" req err={errs.amount} hint={dueHint}><Money value={f.amount} onChange={set('amount')} placeholder="0" /></Field>
    <Field label="Payment date" req err={errs.payment_date}><DateIn value={f.payment_date} onChange={set('payment_date')} max={TODAY} /></Field>
    <Field label="Payment method" req err={errs.method}><Sel value={f.method} onChange={set('method')} options={METHODS} placeholder="Select method" /></Field>
    <Field label={f.method === 'Cash' ? 'Reference (optional for cash)' : 'Transaction / cheque reference'} req={f.method !== 'Cash'} err={errs.reference}><Txt value={f.reference} onChange={set('reference')} placeholder={f.method === 'bKash' ? 'bKash TrxID' : f.method === 'Cheque' ? 'Cheque number' : 'Bank reference'} /></Field>
    <Field label="Note" full><Area value={f.note} onChange={set('note')} placeholder="Optional" /></Field>
    <Field label="Attach receipt or slip" full hint="Stored with the payment. Image or PDF."><FileIn onChange={set('file')} /></Field>
  </>);
}
function PayWarn({ chk }) {
  if (!chk) return null;
  return (<div style={{ display: 'grid', gap: 8 }}>
    {chk.overpay > 0 && <Note tone="warn"><b>This is {fmtMoney(chk.overpay)} more than the remaining due.</b> The extra amount will show as an overpayment. Confirm only if this is intended.</Note>}
    {chk.duplicate && <Note tone="warn"><b>Possible duplicate.</b> A payment with the same amount, date and reference was already recorded ({chk.duplicate.receipt_no || chk.duplicate.code}).</Note>}
  </div>);
}

/* ---------- shareholder ---------- */
function ShareholderForm({ shareholder, onClose, onSaved }) {
  const { db, S, run } = useApp(); const reqId = useRequestId();
  const nom0 = shareholder ? db.nominees.filter((n) => n.shareholder_id === shareholder.id && live(n))[0] : null;
  const [f, set] = useForm({ full_name: shareholder ? shareholder.full_name : '', phone: shareholder ? shareholder.phone : '', email: shareholder ? shareholder.email : '', profession: shareholder ? shareholder.profession : '', designation: shareholder ? shareholder.designation : '', nid: shareholder ? shareholder.nid : '', address: shareholder ? shareholder.address : '', registration_date: shareholder ? shareholder.registration_date : TODAY, status: shareholder ? shareholder.status : 'Active', remarks: shareholder ? shareholder.remarks : '' });
  const [n, setN] = useForm({ name: nom0 ? nom0.name : '', relation: nom0 ? nom0.relation : '', phone: nom0 ? nom0.phone : '', nid: nom0 ? nom0.nid : '', address: nom0 ? nom0.address : '' });
  const [files, setFiles] = useState({});
  const [errs, setErrs] = useState({}); const [busy, setBusy] = useState(false); const [dups, setDups] = useState(null);
  const setFile = (k) => (file) => setFiles((p) => Object.assign({}, p, { [k]: file }));
  const submit = async () => {
    const e = V.shareholder(f, n); if (!n.name.trim() && (files.nominee_photo || files.nominee_nid_front || files.nominee_nid_back) && !(nom0 && nom0.name)) e.nominee_name = 'Enter the nominee name before adding nominee documents.'; setErrs(e); if (V.hasErrors(e)) return;
    const found = S.findDuplicateShareholders(f, shareholder && shareholder.id);
    if (found.length && !dups) { setDups(found); return; }
    setBusy(true);
    const r = await run(() => shareholder ? S.updateShareholder(shareholder.id, { data: f, nominee: n, files: files }, reqId) : S.createShareholder({ data: f, nominee: n, files: files }, reqId), shareholder ? 'Shareholder updated' : 'Shareholder added');
    setBusy(false); if (r.ok) { onClose(); onSaved && onSaved(r.r); }
  };
  const dc = (id) => { const d = id ? Calc.byId(db.documents, id) : null; return d && !d.archived_at ? d : null; };
  return (<Modal title={shareholder ? 'Edit shareholder' : 'Add shareholder'} sub={shareholder ? shareholder.code : 'A shareholder ID is assigned when you save.'} size="wide" onClose={onClose} footer={<ModalFooter onClose={onClose} busy={busy} onSubmit={submit} label={dups ? 'Save anyway' : shareholder ? 'Save changes' : 'Add shareholder'} />}>
    {dups && <Note tone="warn"><b>This may already exist.</b> Matching record{dups.length > 1 ? 's' : ''}: {dups.map((d) => d.code + ' ' + d.full_name).join('; ')}. Check before saving a second record for the same person.</Note>}
    <div className="frm">
      <div className="frm-t">Personal details</div>
      <Field label="Full name" req err={errs.full_name}><Txt value={f.full_name} onChange={set('full_name')} autoComplete="off" /></Field>
      <Field label="Phone number" req err={errs.phone}><Txt value={f.phone} onChange={set('phone')} placeholder="01711-000000" inputMode="tel" /></Field>
      <Field label="Email" err={errs.email}><Txt value={f.email} onChange={set('email')} type="email" /></Field>
      <Field label="NID number" req err={errs.nid} hint="10, 13 or 17 digits."><Txt value={f.nid} onChange={set('nid')} inputMode="numeric" /></Field>
      <Field label="Profession"><Txt value={f.profession} onChange={set('profession')} /></Field>
      <Field label="Designation"><Txt value={f.designation} onChange={set('designation')} /></Field>
      <Field label="Address" full><Txt value={f.address} onChange={set('address')} /></Field>
      <Field label="Registration date" req err={errs.registration_date}><DateIn value={f.registration_date} onChange={set('registration_date')} max={TODAY} /></Field>
      <Field label="Status"><Sel value={f.status} onChange={set('status')} options={['Active', 'Inactive']} /></Field>
      <div className="frm-t">Shareholder photo and NID</div>
      <div className="full slots">
        <DocSlot label="Profile photo" doc={dc(shareholder && shareholder.photo_doc_id)} value={files.photo} onChange={setFile('photo')} />
        <DocSlot label="NID front" doc={dc(shareholder && shareholder.nid_front_doc_id)} value={files.nid_front} onChange={setFile('nid_front')} />
        <DocSlot label="NID back" doc={dc(shareholder && shareholder.nid_back_doc_id)} value={files.nid_back} onChange={setFile('nid_back')} />
      </div>
      <div className="frm-t">Nominee</div>
      <Field label="Nominee name" err={errs.nominee_name}><Txt value={n.name} onChange={(v) => { setN('name')(v); if (errs.nominee_name) setErrs((p) => Object.assign({}, p, { nominee_name: undefined })); }} /></Field>
      <Field label="Relation"><Txt value={n.relation} onChange={setN('relation')} placeholder="Spouse, son, brother…" /></Field>
      <Field label="Nominee phone" err={errs.nominee_phone}><Txt value={n.phone} onChange={setN('phone')} inputMode="tel" /></Field>
      <Field label="Nominee NID" err={errs.nominee_nid}><Txt value={n.nid} onChange={setN('nid')} inputMode="numeric" /></Field>
      <Field label="Nominee address" full><Txt value={n.address} onChange={setN('address')} /></Field>
      <div className="full slots">
        <DocSlot label="Nominee photo" doc={dc(nom0 && nom0.photo_doc_id)} value={files.nominee_photo} onChange={setFile('nominee_photo')} />
        <DocSlot label="Nominee NID front" doc={dc(nom0 && nom0.nid_front_doc_id)} value={files.nominee_nid_front} onChange={setFile('nominee_nid_front')} />
        <DocSlot label="Nominee NID back" doc={dc(nom0 && nom0.nid_back_doc_id)} value={files.nominee_nid_back} onChange={setFile('nominee_nid_back')} />
      </div>
      <div className="frm-t">Remarks</div>
      <Field label="Remarks" full><Area value={f.remarks} onChange={set('remarks')} /></Field>
    </div>
  </Modal>);
}

/* ---------- share payment ---------- */
function SharePaymentForm({ shareholderId, bookingId, prefill, correctionOf, onClose }) {
  const { db, S, run, open } = useApp(); const reqId = useRequestId();
  const b0 = bookingId ? Calc.byId(db.share_bookings, bookingId) : null;
  const [sh, setSh] = useState(shareholderId || (b0 ? b0.shareholder_id : ''));
  const [f, set, setF] = useForm(Object.assign({ booking_id: bookingId || '', amount: '', payment_date: TODAY, method: '', reference: '', note: '', file: null }, prefill || {}));
  const [errs, setErrs] = useState({}); const [busy, setBusy] = useState(false); const [warn, setWarn] = useState(null);
  const books = db.share_bookings.filter((b) => live(b) && b.shareholder_id === sh).map((b) => ({ b: b, s: Calc.bookingSummary(db, b) }));
  const sel = books.filter((x) => x.b.id === f.booking_id)[0];
  useEffect(() => { if (sh && !f.booking_id) { const o = books.filter((x) => x.s.due > 0.004); if (o.length === 1) setF((p) => Object.assign({}, p, { booking_id: o[0].b.id })); } }, [sh]);
  useEffect(() => { setWarn(null); }, [f.amount, f.payment_date, f.reference, f.booking_id]);
  const shOptions = db.shareholders.filter(live).map((s) => ({ value: s.id, label: s.code + ' · ' + s.full_name }));
  const submit = async () => {
    const e = {}; if (!sh) e.sh = 'Select a shareholder.'; if (!f.booking_id) e.booking_id = 'Select a booking.'; Object.assign(e, V.paymentCore(f)); setErrs(e); if (V.hasErrors(e)) return;
    const chk = S.checkSharePayment(f); if ((chk.overpay || chk.duplicate) && !warn) { setWarn(chk); return; }
    setBusy(true);
    const r = await run(() => S.addSharePayment(Object.assign({}, f, { allowOverpay: !!warn, allowDuplicate: !!warn, correction_of: correctionOf }), reqId), 'Payment recorded');
    setBusy(false); if (r.ok) { onClose(); open('receipt', { kind: 'share', id: r.r.id }); }
  };
  return (<Modal title={correctionOf ? 'Record corrected share payment' : 'Add share payment'} sub="Land share payment. Construction payments are recorded separately." onClose={onClose} footer={<ModalFooter onClose={onClose} busy={busy} onSubmit={submit} label={warn ? 'Confirm and record' : 'Record payment'} />}>
    {correctionOf && <Note tone="info">Correcting {correctionOf}. The original stays in the record as reversed.</Note>}
    <div className="frm">
      <Field label="Shareholder" req err={errs.sh}><Sel value={sh} onChange={(v) => { setSh(v); setF((p) => Object.assign({}, p, { booking_id: '' })); }} options={shOptions} placeholder="Select shareholder" disabled={!!shareholderId || !!bookingId} /></Field>
      <Field label="Booking" req err={errs.booking_id} hint={sh && !books.length ? 'This shareholder has no share booking yet.' : undefined}><Sel value={f.booking_id} onChange={set('booking_id')} options={books.map((x) => ({ value: x.b.id, label: x.b.code + ' · ' + x.b.quantity + ' share(s) · due ' + fmtMoney(x.s.due) }))} placeholder="Select booking" disabled={!!bookingId} /></Field>
      {sel && <div className="full sumbox card" style={{ padding: '4px 14px' }}><div className="sumrow"><span>Grand total</span><span>{fmtMoney(sel.s.grand)}</span></div><div className="sumrow"><span>Paid so far</span><span>{fmtMoney(sel.s.paid)}</span></div><div className="sumrow big"><span>Remaining due</span><span>{fmtMoney(sel.s.due)}</span></div></div>}
      <PaymentFields f={f} set={set} errs={errs} dueHint={sel && sel.s.due > 0 ? <button type="button" className="link" onClick={() => setF((p) => Object.assign({}, p, { amount: String(sel.s.due) }))}>Pay full due ({fmtMoney(sel.s.due)})</button> : undefined} />
    </div>
    <PayWarn chk={warn} />
  </Modal>);
}

/* ---------- construction payment ---------- */
function ConsPaymentForm({ planId, prefill, correctionOf, onClose }) {
  const { db, S, run, open } = useApp(); const reqId = useRequestId();
  const [pid, setPid] = useState(planId || '');
  const [f, set, setF] = useForm(Object.assign({ amount: '', payment_date: TODAY, method: '', reference: '', note: '', file: null }, prefill || {}));
  const [errs, setErrs] = useState({}); const [busy, setBusy] = useState(false); const [warn, setWarn] = useState(null);
  const plans = db.construction_plans.filter((p) => live(p) && p.status !== 'Cancelled').map((p) => ({ p: p, s: Calc.plan(db, p), u: Calc.byId(db.units, p.unit_id) }));
  const cur = plans.filter((x) => x.p.id === pid)[0];
  useEffect(() => { setWarn(null); }, [f.amount, f.payment_date, f.reference, pid]);
  const submit = async () => {
    const e = {}; if (!pid) e.plan = 'Select a unit.'; Object.assign(e, V.paymentCore(f)); setErrs(e); if (V.hasErrors(e)) return;
    const chk = S.checkConstructionPayment(Object.assign({ plan_id: pid }, f)); if ((chk.overpay || chk.duplicate) && !warn) { setWarn(chk); return; }
    setBusy(true);
    const r = await run(() => S.addConstructionPayment(Object.assign({ plan_id: pid }, f, { allowOverpay: !!warn, allowDuplicate: !!warn, correction_of: correctionOf }), reqId), 'Construction payment recorded');
    setBusy(false); if (r.ok) { onClose(); open('receipt', { kind: 'cons', id: r.r.id }); }
  };
  const after = cur && Number(f.amount) > 0 ? roundMoney(cur.s.due - Number(f.amount)) : null;
  return (<Modal title={correctionOf ? 'Record corrected construction payment' : 'Add construction payment'} sub="Any amount, any date. Land share payments are recorded separately." onClose={onClose} footer={<ModalFooter onClose={onClose} busy={busy} onSubmit={submit} label={warn ? 'Confirm and record' : 'Record payment'} />}>
    {correctionOf && <Note tone="info">Correcting {correctionOf}. The original stays in the record as reversed.</Note>}
    <div className="frm">
      <Field label="Unit and shareholder" req err={errs.plan}><Sel value={pid} onChange={(v) => { setPid(v); setF((p) => Object.assign({}, p, { amount: '' })); }} options={plans.map((x) => ({ value: x.p.id, label: x.u.code + ' · ' + shName(db, x.p.shareholder_id) }))} placeholder="Select unit" disabled={!!planId} /></Field>
      {cur && <div className="full sumbox card" style={{ padding: '4px 14px' }}>
        <div className="sumrow"><span>Total contribution</span><span>{fmtMoney(cur.s.total)}</span></div>
        <div className="sumrow"><span>Paid so far</span><span>{fmtMoney(cur.s.paid)}</span></div>
        <div className="sumrow big"><span>Remaining due</span><span>{fmtMoney(cur.s.due)}</span></div>
        {after !== null && <div className="sumrow"><span>Due after this payment</span><span>{fmtMoney(Math.max(0, after))}</span></div>}
      </div>}
      <PaymentFields f={f} set={set} errs={errs} dueHint={cur && cur.s.due > 0 ? <button type="button" className="link" onClick={() => setF((p) => Object.assign({}, p, { amount: String(cur.s.due) }))}>Pay full due ({fmtMoney(cur.s.due)})</button> : 'Enter the amount the client is paying now.'} />
    </div>
    <PayWarn chk={warn} />
  </Modal>);
}

/* ---------- schedule editor (construction plans + contracts) ---------- */
function ScheduleEditor({ rows, setRows, total, paidById, err }) {
  const paid = paidById || {}, t = Number(total) || 0, s = sum(rows, (r) => r.amount), left = roundMoney(t - s);
  const upd = (key, patch) => setRows(rows.map((r) => r.key === key ? Object.assign({}, r, patch) : r));
  const add = () => { const last = rows.slice().sort((a, b) => a.due_date.localeCompare(b.due_date)).pop(); setRows(rows.concat([{ key: uid('row'), due_date: addMonths(last ? last.due_date : TODAY, 1), amount: left > 0 ? left : 0 }])); };
  const split = () => {
    const locked = rows.filter((r) => paid[r.id] > 0), free = rows.filter((r) => !(paid[r.id] > 0)); if (!free.length) return;
    const rest = roundMoney(t - sum(locked, (r) => r.amount)), each = Math.floor(rest / free.length); let seen = 0;
    setRows(rows.map((r) => { if (paid[r.id] > 0) return r; seen++; return Object.assign({}, r, { amount: seen === free.length ? roundMoney(rest - each * (free.length - 1)) : each }); }));
  };
  return (<div style={{ display: 'grid', gap: 10 }}>
    <div className="tbl-wrap"><table className="tbl"><thead><tr><th>#</th><th>Due date</th><th>Amount</th><th className="r">Paid</th><th /></tr></thead><tbody>
      {rows.slice().sort((a, b) => a.due_date.localeCompare(b.due_date)).map((r, i) => (<tr key={r.key}>
        <td>{i + 1}</td>
        <td><input className="inp" type="date" aria-label={'Installment ' + (i + 1) + ' due date'} value={r.due_date} onChange={(e) => upd(r.key, { due_date: e.target.value })} style={{ minWidth: 140 }} /></td>
        <td><div className="money"><span aria-hidden="true">৳</span><input className="inp" type="number" min="0" step="any" aria-label={'Installment ' + (i + 1) + ' amount'} value={r.amount} onChange={(e) => upd(r.key, { amount: e.target.value })} style={{ minWidth: 130 }} /></div></td>
        <td className="r">{paid[r.id] ? fmtMoney(paid[r.id]) : '—'}</td>
        <td className="r"><Btn size="sm" variant="ghost" disabled={paid[r.id] > 0} title={paid[r.id] > 0 ? 'Has payments' : 'Remove'} onClick={() => setRows(rows.filter((x) => x.key !== r.key))}><Icon n="x" size={14} /></Btn></td>
      </tr>))}
    </tbody></table></div>
    <div className="chips" style={{ justifyContent: 'space-between' }}>
      <span className={'badge ' + (Math.abs(left) < 0.005 ? 't-ok' : 't-warn')}>Scheduled {fmtMoney(s)} of {fmtMoney(t)}{Math.abs(left) >= 0.005 ? (left > 0 ? ' · ' + fmtMoney(left) + ' left to schedule' : ' · ' + fmtMoney(-left) + ' over') : ''}</span>
      <span className="chips"><Btn size="sm" icon="plus" onClick={add}>Add installment</Btn><Btn size="sm" onClick={split} disabled={!rows.length}>Split evenly</Btn></span>
    </div>
    {err && <span className="err">{err}</span>}
  </div>);
}
function ScheduleGenerator({ total, onGenerate }) {
  const [c, setC] = useState('4'); const [d, setD] = useState(addMonths(TODAY, 1)); const [ev, setEv] = useState('1');
  return (<div className="frm full" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', alignItems: 'end' }}>
    <Field label="Installments"><input className="inp" type="number" min="1" max="60" value={c} onChange={(e) => setC(e.target.value)} /></Field>
    <Field label="First due date"><DateIn value={d} onChange={setD} /></Field>
    <Field label="Every (months)"><input className="inp" type="number" min="1" max="12" value={ev} onChange={(e) => setEv(e.target.value)} /></Field>
    <Btn onClick={() => onGenerate(buildSchedule(total, c, d, Number(ev) || 1))} disabled={!(Number(total) > 0)}>Generate schedule</Btn>
  </div>);
}

/* ---------- booking ---------- */
function BookingForm({ shareholderId, onClose }) {
  const { db, S, run, open, go } = useApp(); const reqId = useRequestId();
  const settings = db.settings[0], priceSet = Number(settings.default_share_price) > 0, avail = settings.total_shares - Calc.sharesSold(db);
  const [f, set, setF] = useForm({ shareholder_id: shareholderId || '', quantity: '1', unit_price: String(settings.default_share_price || 0), booking_date: TODAY, discount: '0', reference_person: '', remarks: '' });
  const [p, setP] = useForm({ amount: '', payment_date: TODAY, method: '', reference: '', note: '' });
  const [errs, setErrs] = useState({}); const [busy, setBusy] = useState(null);
  const total = roundMoney((Number(f.quantity) || 0) * (Number(f.unit_price) || 0)), disc = Number(f.discount) || 0, grand = Math.max(0, roundMoney(total - disc)), paid = Number(p.amount) > 0 ? Number(p.amount) : 0;
  const save = async (withPay) => {
    const e = V.booking(f, { available: avail });
    if (!priceSet) { setErrs({ unit_price: 'The share price has not been configured. Set it in Settings > Share Configuration.' }); return; }
    if (withPay) { const pe = V.paymentCore(p); Object.keys(pe).forEach((k) => { e['p_' + k] = pe[k]; }); if (!e.p_amount && paid > grand + 0.005) e.p_amount = 'The payment cannot exceed the grand total of ' + fmtMoney(grand) + '.'; if (!e.p_payment_date && p.payment_date < f.booking_date) e.p_payment_date = 'The payment date cannot be before the booking date.'; }
    setErrs(e); if (V.hasErrors(e)) return;
    setBusy(withPay ? 'pay' : 'save');
    const r = await run(() => S.createBooking(Object.assign({}, f, { payment: withPay ? p : null }), reqId), withPay ? 'Booking and first payment saved' : 'Booking saved');
    setBusy(null); if (r.ok) { onClose(); if (r.r.payment) open('receipt', { kind: 'share', id: r.r.payment.id }); }
  };
  return (<Modal title="New share booking" sub={avail + ' of ' + settings.total_shares + ' shares are still available.'} size="wide" onClose={onClose} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn busy={busy === 'save'} disabled={!!busy || !priceSet || avail < 1} onClick={() => save(false)}>Save booking</Btn><Btn variant="primary" busy={busy === 'pay'} disabled={!!busy || !priceSet || avail < 1} onClick={() => save(true)}>Save &amp; add payment</Btn></>}>
    {!priceSet && <Note tone="warn">The share price has not been configured yet, so a booking cannot be created. <button type="button" className="link" onClick={() => { onClose(); go('settings'); }}>Set the price in Settings &rarr; Share Configuration</button>.</Note>}
    {priceSet && avail < 1 && <Note tone="warn">All {settings.total_shares} shares are sold. New bookings are blocked unless an Admin raises the total in Settings &rarr; Share Configuration.</Note>}
    <div className="frm">
      <div className="frm-t">Share allocation</div>
      <Field label="Shareholder" req err={errs.shareholder_id} full><Sel value={f.shareholder_id} onChange={set('shareholder_id')} options={db.shareholders.filter((s) => live(s) && s.status === 'Active').map((s) => ({ value: s.id, label: s.code + ' · ' + s.full_name + ' · ' + s.phone }))} placeholder="Select shareholder" disabled={!!shareholderId} /></Field>
      {!shareholderId && <div className="full" style={{ marginTop: -6 }}><Btn size="sm" icon="plus" onClick={() => open('shareholder', { onSaved: (row) => setF((x) => Object.assign({}, x, { shareholder_id: row.id })) })}>Add new shareholder</Btn></div>}
      <Field label="Share quantity" req err={errs.quantity}><input className="inp" type="number" min="1" max={avail} step="1" value={f.quantity} onChange={(e) => set('quantity')(e.target.value)} /></Field>
      <Field label="Share price (from Settings)" err={errs.unit_price} hint={priceSet ? 'Set in Settings > Share Configuration' : 'Not configured (৳0)'}><Money value={f.unit_price} onChange={() => {}} readOnly disabled /></Field>
      <Field label="Booking date" req err={errs.booking_date}><DateIn value={f.booking_date} onChange={set('booking_date')} max={TODAY} /></Field>
      <Field label="Discount" err={errs.discount}><Money value={f.discount} onChange={set('discount')} /></Field>
      <Field label="Reference person"><Txt value={f.reference_person} onChange={set('reference_person')} placeholder="Who introduced this buyer" /></Field>
      <Field label="Remarks"><Txt value={f.remarks} onChange={set('remarks')} /></Field>
      <div className="frm-t">Summary</div>
      <div className="full sumbox card" style={{ padding: '4px 14px' }}>
        <div className="sumrow"><span>Total value</span><span>{fmtMoney(total)}</span></div>
        <div className="sumrow"><span>Discount</span><span>− {fmtMoney(disc)}</span></div>
        <div className="sumrow big"><span>Grand total</span><span>{fmtMoney(grand)}</span></div>
        <div className="sumrow"><span>Paid with this booking</span><span>{fmtMoney(paid)}</span></div>
        <div className="sumrow big"><span>Due</span><span>{fmtMoney(grand - paid)}</span></div>
      </div>
      <div className="frm-t">Payment</div>
      <div className="full hint">Recorded when you choose Save &amp; add payment. Save booking creates the booking with no payment; add payments later from Share Sales or the shareholder profile.</div>
      <Field label="Amount" err={errs.p_amount}><Money value={p.amount} onChange={setP('amount')} placeholder="0" /></Field>
      <Field label="Payment date" err={errs.p_payment_date}><DateIn value={p.payment_date} onChange={setP('payment_date')} max={TODAY} /></Field>
      <Field label="Payment method" err={errs.p_method}><Sel value={p.method} onChange={setP('method')} options={METHODS} placeholder="Select method" /></Field>
      <Field label="Reference" err={errs.p_reference}><Txt value={p.reference} onChange={setP('reference')} placeholder={p.method === 'Cash' ? 'Optional for cash' : 'Transaction / cheque reference'} /></Field>
      <Field label="Payment note" full><Txt value={p.note} onChange={setP('note')} /></Field>
    </div>
  </Modal>);
}

/* ---------- unit ---------- */
function UnitForm({ unit, onClose }) {
  const { db, S, run } = useApp(); const reqId = useRequestId();
  const [f, set] = useForm({ code: unit.code, floor: String(unit.floor), size_sqft: String(unit.size_sqft), status: unit.status, shareholder_id: unit.shareholder_id || '', assigned_date: unit.assigned_date || TODAY, remarks: unit.remarks || '' });
  const [errs, setErrs] = useState({}); const [busy, setBusy] = useState(false);
  const submit = async () => { const e = V.unit(f, { db: db, id: unit.id }); setErrs(e); if (V.hasErrors(e)) return; setBusy(true); const r = await run(() => S.saveUnit(unit.id, f, reqId), 'Unit updated'); setBusy(false); if (r.ok) onClose(); };
  return (<Modal title={'Unit ' + unit.code} sub={floorName(unit.floor) + ' · Residential · ' + unit.size_sqft.toLocaleString('en-US') + ' sq ft'} onClose={onClose} footer={<ModalFooter onClose={onClose} busy={busy} onSubmit={submit} label="Save changes" />}>
    <Note>The building plan is fixed: 36 residential units on floors 4 to 12. Unit label, floor and size cannot be changed here. A shareholder can hold several units.</Note>
    {errs.code && <span className="err">{errs.code}</span>}
    <div className="frm">
      <Field label="Status" err={errs.status}><Sel value={f.status} onChange={set('status')} options={UNIT_STATUSES} /></Field>
      <Field label="Assigned shareholder" err={errs.shareholder_id}><Sel value={f.shareholder_id} onChange={set('shareholder_id')} options={db.shareholders.filter(live).map((s) => ({ value: s.id, label: s.code + ' · ' + s.full_name }))} placeholder="Not assigned" /></Field>
      <Field label="Assignment date"><DateIn value={f.assigned_date} onChange={set('assigned_date')} disabled={!f.shareholder_id} /></Field>
      <Field label="Remarks" full><Area value={f.remarks} onChange={set('remarks')} /></Field>
    </div>
  </Modal>);
}

/* ---------- construction plan ---------- */
function PlanForm({ unitId, onClose, onSaved }) {
  const { db, S, run } = useApp(); const reqId = useRequestId();
  const free = db.units.filter((u) => live(u) && u.shareholder_id && !db.construction_plans.some((p) => live(p) && p.unit_id === u.id && p.status !== 'Cancelled'));
  const [f, set] = useForm({ unit_id: unitId || '', total_amount: '', remarks: '' });
  const [errs, setErrs] = useState({}); const [busy, setBusy] = useState(false);
  const u = Calc.byId(db.units, f.unit_id);
  const submit = async () => { const e = V.plan(f); setErrs(e); if (V.hasErrors(e)) return; setBusy(true); const r = await run(() => S.createPlan(f, reqId), 'Total construction contribution set'); setBusy(false); if (r.ok) { onClose(); onSaved && onSaved(r.r); } };
  return (<Modal title="Set total construction contribution" sub="One total per shareholder and unit. There is no fixed installment schedule." onClose={onClose} footer={<ModalFooter onClose={onClose} busy={busy} onSubmit={submit} label="Set total" />}>
    {!free.length && <Note tone="warn">Every assigned unit already has a contribution total. Assign a unit to a shareholder first from the Units page.</Note>}
    <div className="frm">
      <Field label="Unit" req err={errs.unit_id} hint={u ? 'Shareholder: ' + shName(db, u.shareholder_id) : 'Only assigned units without a total are listed.'}><Sel value={f.unit_id} onChange={set('unit_id')} options={free.map((x) => ({ value: x.id, label: x.code + ' · ' + shName(db, x.shareholder_id) }))} placeholder="Select unit" disabled={!!unitId} /></Field>
      <Field label="Total construction contribution" req err={errs.total_amount} hint="The client can then pay any amount, any time."><Money value={f.total_amount} onChange={set('total_amount')} placeholder="2000000" /></Field>
      <Field label="Remarks" full><Txt value={f.remarks} onChange={set('remarks')} /></Field>
    </div>
  </Modal>);
}
function PlanTotalForm({ planId, onClose }) {
  const { db, S, run } = useApp();
  const plan = Calc.byId(db.construction_plans, planId), pc = Calc.plan(db, plan);
  const [total, setTotal] = useState(String(plan.total_amount)); const [reason, setReason] = useState(''); const [errs, setErrs] = useState({}); const [busy, setBusy] = useState(false);
  const submit = async () => { const e = V.planTotal(total, pc.paid, reason); setErrs(e); if (V.hasErrors(e)) return; setBusy(true); const r = await run(() => S.updatePlanTotal(planId, total, reason), 'Total contribution updated'); setBusy(false); if (r.ok) onClose(); };
  return (<Modal title={'Change total contribution · ' + plan.code} sub={'Already paid ' + fmtMoney(pc.paid) + '. The total cannot go below this.'} size="narrow" onClose={onClose} footer={<ModalFooter onClose={onClose} busy={busy} onSubmit={submit} label="Save total" />}>
    <div className="frm">
      <Field label="New total contribution" req err={errs.total} full><Money value={total} onChange={setTotal} /></Field>
      <Field label="Reason for the change" req err={errs.reason} full><Txt value={reason} onChange={setReason} placeholder="Recorded in the audit log" /></Field>
    </div>
  </Modal>);
}

/* ---------- project expense + contractor ---------- */
function ExpenseForm({ prefill, correctionOf, contractorId, onClose }) {
  const { db, S, run, user } = useApp(); const reqId = useRequestId();
  const approver = can(user, 'approve');
  const [f, set, setF] = useForm(Object.assign({ category: '', contractor_id: contractorId || '', payee_name: '', contract_installment_id: '', description: '', amount: '', expense_date: TODAY, method: '', reference: '', approval_status: approver ? 'Approved' : 'Pending', remarks: '', file: null }, prefill || {}));
  const [errs, setErrs] = useState({}); const [busy, setBusy] = useState(false); const [warn, setWarn] = useState(null);
  const ctr = f.contractor_id ? Calc.byId(db.contractors, f.contractor_id) : null;
  const cc = ctr && ctr.contract_value ? Calc.contractor(db, ctr) : null;
  const insts = cc ? cc.installments.filter((r) => r.due > 0.004) : [];
  useEffect(() => { setWarn(null); }, [f.amount, f.expense_date, f.reference, f.contractor_id, f.contract_installment_id]);
  const pickContractor = (v) => { const c = Calc.byId(db.contractors, v); setF((p) => Object.assign({}, p, { contractor_id: v, contract_installment_id: '', category: c && c.kind === 'Contractor' ? 'Contractor Payment' : (c && EXPENSE_CATEGORIES.indexOf(c.trade) >= 0 ? c.trade : p.category) })); };
  const pickInst = (v) => { const r = insts.filter((x) => x.id === v)[0]; setF((p) => Object.assign({}, p, { contract_installment_id: v, amount: r && !p.amount ? String(r.due) : p.amount, description: r && !p.description ? (ctr.name + ', installment ' + r.no) : p.description })); };
  const submit = async () => {
    const e = V.expense(f, {}); setErrs(e); if (V.hasErrors(e)) return;
    const chk = S.checkExpense(f); if ((chk.overpay || chk.duplicate) && !warn) { setWarn(chk); return; }
    setBusy(true); const r = await run(() => S.createExpense(Object.assign({}, f, { allowOverpay: !!warn, allowDuplicate: !!warn }), reqId), f.approval_status === 'Pending' || !approver ? 'Expense saved, awaiting approval' : 'Expense recorded'); setBusy(false); if (r.ok) onClose();
  };
  return (<Modal title={correctionOf ? 'Record corrected expense' : 'Add project expense'} sub="Money paid out by the project." size="wide" onClose={onClose} footer={<ModalFooter onClose={onClose} busy={busy} onSubmit={submit} label={warn ? 'Confirm and record' : 'Save expense'} />}>
    {correctionOf && <Note tone="info">Correcting {correctionOf}. The original stays in the record as reversed.</Note>}
    <div className="frm">
      <Field label="Expense category" req err={errs.category}><Sel value={f.category} onChange={set('category')} options={EXPENSE_CATEGORIES} placeholder="Select category" /></Field>
      <Field label="Contractor / supplier" err={errs.payee_name} hint={!f.contractor_id ? 'Choose a saved one, or type the payee below.' : undefined}><Sel value={f.contractor_id} onChange={pickContractor} options={db.contractors.filter(live).map((c) => ({ value: c.id, label: c.name + ' · ' + c.trade }))} placeholder="Other / one-time payee" /></Field>
      {!f.contractor_id && <Field label="Payee name" req err={errs.payee_name}><Txt value={f.payee_name} onChange={set('payee_name')} /></Field>}
      {cc && <Field label="Against contract installment" hint={'Contract ' + fmtMoney(cc.total) + ', paid ' + fmtMoney(cc.paid) + ', due ' + fmtMoney(cc.due)}><Sel value={f.contract_installment_id} onChange={pickInst} options={insts.map((r) => ({ value: r.id, label: '#' + r.no + ' · ' + fmtDate(r.due_date) + ' · due ' + fmtMoney(r.due) }))} placeholder="Not against an installment" /></Field>}
      <Field label="Description" req err={errs.description} full><Txt value={f.description} onChange={set('description')} /></Field>
      <Field label="Amount" req err={errs.amount}><Money value={f.amount} onChange={set('amount')} placeholder="0" /></Field>
      <Field label="Date" req err={errs.expense_date}><DateIn value={f.expense_date} onChange={set('expense_date')} max={TODAY} /></Field>
      <Field label="Payment method" req err={errs.method}><Sel value={f.method} onChange={set('method')} options={METHODS} placeholder="Select method" /></Field>
      <Field label={f.method === 'Cash' ? 'Reference (optional for cash)' : 'Reference'} req={f.method !== 'Cash'} err={errs.reference}><Txt value={f.reference} onChange={set('reference')} /></Field>
      <Field label="Bill or invoice" hint="Image or PDF."><FileIn onChange={set('file')} /></Field>
      <Field label="Approval status" hint={approver ? undefined : 'Only an Admin can approve. Your entry will wait for approval.'}><Sel value={approver ? f.approval_status : 'Pending'} onChange={set('approval_status')} options={['Approved', 'Pending']} disabled={!approver} /></Field>
      <Field label="Remarks" full><Txt value={f.remarks} onChange={set('remarks')} /></Field>
    </div>
    <PayWarn chk={warn} />
  </Modal>);
}
function ContractorForm({ onClose }) {
  const { S, run } = useApp(); const reqId = useRequestId();
  const [f, set] = useForm({ name: '', kind: 'Contractor', trade: '', phone: '', contract_value: '', contract_date: TODAY });
  const [rows, setRows] = useState([]); const [errs, setErrs] = useState({}); const [busy, setBusy] = useState(false);
  const isC = f.kind === 'Contractor';
  const submit = async () => { const e = V.contractor(f, rows); setErrs(e); if (V.hasErrors(e)) return; setBusy(true); const r = await run(() => S.createContractor(f, rows, reqId), isC ? 'Contract created' : 'Supplier added'); setBusy(false); if (r.ok) onClose(); };
  return (<Modal title="Add contractor or supplier" sub="Contractors get an installment contract. Suppliers are paid per purchase." size="wide" onClose={onClose} footer={<ModalFooter onClose={onClose} busy={busy} onSubmit={submit} label={isC ? 'Create contract' : 'Add supplier'} />}>
    <div className="frm">
      <Field label="Name" req err={errs.name}><Txt value={f.name} onChange={set('name')} /></Field>
      <Field label="Type"><Sel value={f.kind} onChange={set('kind')} options={['Contractor', 'Supplier']} /></Field>
      <Field label="Trade or material"><Txt value={f.trade} onChange={set('trade')} placeholder="Electrical, steel, tiles…" /></Field>
      <Field label="Phone" err={errs.phone}><Txt value={f.phone} onChange={set('phone')} inputMode="tel" /></Field>
      {isC && <>
        <div className="frm-t">Contract</div>
        <Field label="Contract value" req err={errs.contract_value}><Money value={f.contract_value} onChange={set('contract_value')} /></Field>
        <Field label="Contract date"><DateIn value={f.contract_date} onChange={set('contract_date')} /></Field>
        <ScheduleGenerator total={f.contract_value} onGenerate={setRows} />
        <div className="full">{rows.length ? <ScheduleEditor rows={rows} setRows={setRows} total={f.contract_value} err={errs.schedule} /> : <div className="hint">Enter the contract value, then generate the installment schedule.{errs.schedule && <span className="err"> {errs.schedule}</span>}</div>}</div>
      </>}
    </div>
  </Modal>);
}

/* ---------- documents ---------- */
function relatedOptions(db, type) {
  const L = (rows, f) => rows.filter(live).map(f);
  if (type === 'shareholder') return L(db.shareholders, (s) => ({ value: s.id, label: s.code + ' · ' + s.full_name }));
  if (type === 'nominee') return L(db.nominees, (n) => ({ value: n.id, label: n.name + ' · nominee of ' + shName(db, n.shareholder_id) }));
  if (type === 'unit') return L(db.units, (u) => ({ value: u.id, label: u.code }));
  if (type === 'booking') return L(db.share_bookings, (b) => ({ value: b.id, label: b.code + ' · ' + shName(db, b.shareholder_id) }));
  if (type === 'share_payment') return L(db.share_payments, (p) => ({ value: p.id, label: p.receipt_no + ' · ' + shName(db, p.shareholder_id) + ' · ' + fmtMoney(p.amount) }));
  if (type === 'construction_payment') return L(db.construction_payments, (p) => ({ value: p.id, label: p.receipt_no + ' · ' + shName(db, p.shareholder_id) + ' · ' + fmtMoney(p.amount) }));
  if (type === 'expense') return L(db.project_expenses, (e) => ({ value: e.id, label: e.code + ' · ' + e.description.slice(0, 40) }));
  return [];
}
const RELATED_TYPES = [{ value: 'shareholder', label: 'Shareholder' }, { value: 'nominee', label: 'Nominee' }, { value: 'booking', label: 'Share booking' }, { value: 'unit', label: 'Unit' }, { value: 'share_payment', label: 'Share payment' }, { value: 'construction_payment', label: 'Construction payment' }, { value: 'expense', label: 'Project expense' }, { value: 'project', label: 'Whole project' }];
function DocumentForm({ relatedType, relatedId, docType, onClose }) {
  const { db, S, run } = useApp(); const reqId = useRequestId();
  const [f, set, setF] = useForm({ doc_type: docType || '', related_type: relatedType || 'shareholder', related_id: relatedId || '', description: '', file: null });
  const [errs, setErrs] = useState({}); const [busy, setBusy] = useState(false);
  const submit = async () => { const e = V.document(f); setErrs(e); if (V.hasErrors(e)) return; setBusy(true); const r = await run(() => S.addDocument(f, reqId), 'Document uploaded'); setBusy(false); if (r.ok) onClose(); };
  return (<Modal title="Upload document" sub="The file goes to private storage. Only its record is kept in this prototype." onClose={onClose} footer={<ModalFooter onClose={onClose} busy={busy} onSubmit={submit} label="Upload" />}>
    <div className="frm">
      <Field label="File" req err={errs.file} full><FileIn onChange={set('file')} /></Field>
      <Field label="Document type" req err={errs.doc_type}><Sel value={f.doc_type} onChange={set('doc_type')} options={DOC_TYPES} placeholder="Select type" /></Field>
      <Field label="Belongs to" req err={errs.related_type}><Sel value={f.related_type} onChange={(v) => setF((p) => Object.assign({}, p, { related_type: v, related_id: '' }))} options={RELATED_TYPES} disabled={!!relatedType} /></Field>
      {f.related_type !== 'project' && <Field label="Record" req err={errs.related_id} full><Sel value={f.related_id} onChange={set('related_id')} options={relatedOptions(db, f.related_type)} placeholder="Select record" disabled={!!relatedId} /></Field>}
      <Field label="Description" full><Txt value={f.description} onChange={set('description')} /></Field>
    </div>
  </Modal>);
}
function DocView({ id, onClose }) {
  const { db, open } = useApp(); const d = Calc.byId(db.documents, id); if (!d) return null;
  return (<Modal title={d.file_name} sub={d.code} onClose={onClose} footer={<><Btn onClick={onClose}>Close</Btn><Btn variant="primary" icon="eye" onClick={() => open('lightbox', { docId: d.id })}>Open larger preview</Btn></>}>
    <div className="docprev"><DocThumb doc={d} alt={d.file_name} /></div>
    <dl className="dl"><dt>Document ID</dt><dd className="mono">{d.code}</dd><dt>Type</dt><dd>{d.doc_type}</dd><dt>Belongs to</dt><dd>{relatedLabel(db, d)}</dd><dt>File type</dt><dd>{d.file_type}</dd><dt>Size</dt><dd>{fmtBytes(d.size_bytes)}</dd><dt>Uploaded</dt><dd>{fmtDateTime(d.uploaded_at)} by {userName(db, d.uploaded_by)}</dd><dt>Description</dt><dd>{d.description || '—'}</dd><dt>Storage path</dt><dd className="mono">{d.storage_path}</dd></dl>
  </Modal>);
}

/* ---------- receipt / reverse / export ---------- */
function ReceiptModal({ kind, id, onClose }) {
  const { db, open } = useApp();
  const p = Calc.byId(kind === 'share' ? db.share_payments : db.construction_payments, id); if (!p) return null;
  const b = kind === 'share' ? Calc.byId(db.share_bookings, p.booking_id) : null, u = kind === 'cons' ? Calc.byId(db.units, p.unit_id) : null, att = p.attachment_doc_id ? Calc.byId(db.documents, p.attachment_doc_id) : null;
  const plan = kind === 'cons' ? Calc.byId(db.construction_plans, p.plan_id) : null, pc = plan ? Calc.plan(db, plan) : null, bs = b ? Calc.bookingSummary(db, b) : null;
  const tot = pc ? pc.total : bs ? bs.grand : 0, paid = pc ? pc.paid : bs ? bs.paid : 0, due = pc ? pc.due : bs ? bs.due : 0;
  return (<Modal title={'Receipt ' + p.receipt_no} sub={kind === 'share' ? 'Land share payment' : 'Construction contribution payment'} size="narrow" onClose={onClose} footer={<><Btn onClick={onClose}>Done</Btn><Btn variant="primary" icon="printer" onClick={() => open('printPreview', { doc: 'receipt', args: { kind: kind, id: id } })}>Print Receipt (A4)</Btn></>}>
    <div className="receipt">
      <div style={{ textAlign: 'center' }}><BrandLogo height={44} chip /><div className="brand-co">{db.settings[0].company_name}</div><div className="brand-sys">{db.settings[0].project_name}</div></div>
      <div className="sumbox">
        <div className="sumrow"><span>Received from</span><span>{shName(db, p.shareholder_id)}</span></div>
        <div className="sumrow"><span>{kind === 'share' ? 'Booking' : 'Unit'}</span><span>{kind === 'share' ? b.code : u.code}</span></div>
        <div className="sumrow"><span>Date</span><span>{fmtDate(p.payment_date)}</span></div>
        <div className="sumrow"><span>Method</span><span>{p.method}</span></div>
        <div className="sumrow"><span>Reference</span><span>{p.reference || '—'}</span></div>
        <div className="sumrow big"><span>Amount</span><span>{fmtMoney(p.amount)}</span></div>
      </div>
      <div className="sumbox">
        <div className="sumrow"><span>{kind === 'share' ? 'Booking total' : 'Total contribution'}</span><span>{fmtMoney(tot)}</span></div>
        <div className="sumrow"><span>Total paid to date</span><span>{fmtMoney(paid)}</span></div>
        <div className="sumrow big"><span>Remaining due</span><span>{fmtMoney(due)}</span></div>
      </div>
      <div className="hint">Recorded by {userName(db, p.created_by)} on {fmtDateTime(p.created_at)}.{att ? ' Attachment: ' + att.file_name + '.' : ''}</div>
    </div>
  </Modal>);
}
function ReverseDialog({ kind, id, onClose }) {
  const { db, S, run, open } = useApp();
  const rec = Calc.byId(kind === 'share' ? db.share_payments : kind === 'cons' ? db.construction_payments : db.project_expenses, id); if (!rec) return null;
  const [reason, setReason] = useState(''); const [again, setAgain] = useState(true); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const label = kind === 'expense' ? rec.code : rec.receipt_no;
  const submit = async () => {
    if (!reason.trim()) { setErr('Give a reason. It is saved in the audit log.'); return; }
    setBusy(true); const r = await run(() => kind === 'share' ? S.reverseSharePayment(id, reason) : kind === 'cons' ? S.reverseConstructionPayment(id, reason) : S.reverseExpense(id, reason), label + ' reversed'); setBusy(false);
    if (!r.ok) return; onClose();
    if (again) {
      if (kind === 'share') open('sharePayment', { bookingId: rec.booking_id, correctionOf: label, prefill: { amount: String(rec.amount), method: rec.method, reference: rec.reference, payment_date: rec.payment_date, note: rec.note } });
      else if (kind === 'cons') open('consPayment', { planId: rec.plan_id, correctionOf: label, prefill: { amount: String(rec.amount), method: rec.method, reference: rec.reference, payment_date: rec.payment_date, note: rec.note } });
      else open('expense', { correctionOf: label, prefill: { category: rec.category, contractor_id: rec.contractor_id || '', payee_name: rec.payee_name, contract_installment_id: rec.contract_installment_id || '', description: rec.description, amount: String(rec.amount), method: rec.method, reference: rec.reference, expense_date: rec.expense_date, remarks: rec.remarks } });
    }
  };
  return (<Modal title={'Reverse ' + label} sub="The original entry is kept. A negative entry cancels it out." size="narrow" onClose={onClose} footer={<ModalFooter onClose={onClose} busy={busy} onSubmit={submit} label="Reverse entry" />}>
    <div className="sumbox card" style={{ padding: '4px 14px' }}><div className="sumrow"><span>Amount</span><span>{fmtMoney(rec.amount)}</span></div><div className="sumrow"><span>Date</span><span>{fmtDate(rec.payment_date || rec.expense_date)}</span></div></div>
    <Field label="Reason for reversal" req err={err}><Area value={reason} onChange={(v) => { setReason(v); setErr(''); }} placeholder="For example: wrong amount entered" /></Field>
    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" id="rev-again" checked={again} onChange={(e) => setAgain(e.target.checked)} />Record a corrected entry next</label>
  </Modal>);
}
async function copyText(text, el) { try { await navigator.clipboard.writeText(text); return true; } catch (e) { if (el) { el.focus(); el.select(); } return false; } }
function ExportModal({ report, rows, totals, format, filters, onClose }) {
  const { toast } = useApp(); const out = useMemo(() => Exporter.build(report, { rows: rows, totals: totals }, format, filters), []); const ta = useRef(null);
  const copy = async () => { const ok = await copyText(out.body, ta.current); ok ? toast.success('Copied', 'Paste into Excel or Google Sheets.') : toast.info('Text selected', 'Press Ctrl+C (or Cmd+C) to copy.'); };
  return (<Modal title={'Export · ' + out.filename} sub={rows.length + ' rows'} size="wide" onClose={onClose} footer={<><Btn onClick={onClose}>Close</Btn><Btn variant="primary" icon="copy" onClick={copy}>Copy contents</Btn></>}>
    <Note>{out.note} Downloads are not available in this preview, so copy the contents instead.</Note>
    <textarea ref={ta} className="inp mono" readOnly rows={14} value={out.body} aria-label="Export contents" style={{ whiteSpace: 'pre', overflow: 'auto' }} />
  </Modal>);
}

const MODAL_REGISTRY = { shareholder: ShareholderForm, sharePayment: SharePaymentForm, consPayment: ConsPaymentForm, booking: BookingForm, unit: UnitForm, plan: PlanForm, planTotal: PlanTotalForm, expense: ExpenseForm, contractor: ContractorForm, document: DocumentForm, receipt: ReceiptModal, reverse: ReverseDialog, docView: DocView, exportPreview: ExportModal };
