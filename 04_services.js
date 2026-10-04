/* ============================================================
   04 SERVICES — every write goes through here:
   permission check -> validation -> repo.batch([...rows, audit row]) -> refresh.
   Financial rows are never edited or deleted; wrong entries are reversed.
   ============================================================ */
function maxNum(rows) { let mx = 0; rows.forEach(function (r) { const m = String(r.code || r.receipt_no || '').match(/(\d+)$/); if (m) mx = Math.max(mx, +m[1]); }); return mx; }
function codeGen(rows, prefix, w) { let mx = maxNum(rows); return function () { mx++; return prefix + pad(mx, w); }; }
function receiptGen(db, prefix) { let mx = Math.max(maxNum(db.share_payments.map(function (p) { return { code: p.receipt_no }; })), maxNum(db.construction_payments.map(function (p) { return { code: p.receipt_no }; }))); return function () { mx++; return prefix + pad(mx, 4); }; }
function digits(s) { return String(s || '').replace(/\D/g, '').replace(/^88/, ''); }
function diff(before, after, keys) { const b = {}, a = {}; keys.forEach(function (k) { if (String(before[k] == null ? '' : before[k]) !== String(after[k] == null ? '' : after[k])) { b[k] = before[k]; a[k] = after[k]; } }); return { before: b, after: a, changed: Object.keys(b) }; }

function createServices(ctx) {
  const repo = ctx.repo, getDb = ctx.getDb, getUser = ctx.getUser, refresh = ctx.refresh;

  function guard(perm) { const u = getUser(); if (!can(u, perm)) throw new AppError('Your role (' + u.role + ') cannot do this. Ask an Admin to perform or approve it.', 'Permission needed', 'FORBIDDEN'); return u; }
  function need(errors) { if (V.hasErrors(errors)) throw new AppError('Please fix the highlighted fields and try again.', 'Check the form', 'VALIDATION'); }
  function audit(action, type, entityId, summary, extra) {
    const u = getUser();
    return { op: 'insert', table: 'audit_logs', row: Object.assign({ id: uid('aud'), at: nowIso(), user_id: u.id, user_name: u.name, role: u.role, action: action, entity_type: type, entity_id: entityId, summary: summary, shareholder_id: null, reason: null, before: null, after: null }, extra || {}) };
  }
  function ins(table, row) { return { op: 'insert', table: table, row: Object.assign({ archived_at: null, _demo: false }, row) }; }
  async function commit(ops, requestId) { await repo.batch(ops, { requestId: requestId }); await refresh(); }
  let docSeq = 0;
  function nextDocCode() { const m = Math.max(maxNum(getDb().documents), docSeq) + 1; docSeq = m; return 'DOC-' + pad(m, 4); }
  function checkFile(file) {
    if (!file || !file.name) throw new AppError('Choose a file to upload.', 'No file', 'VALIDATION');
    if (!/^image\//.test(file.type) && file.type !== 'application/pdf') throw new AppError(file.name + ' is not an image or PDF. Upload a JPG, PNG, WebP or PDF file.', 'File type not accepted', 'VALIDATION');
    if (file.size > 10 * 1048576) throw new AppError(file.name + ' is larger than 10 MB. Choose a smaller file.', 'File too large', 'VALIDATION');
  }
  async function storeFile(file, o) {
    checkFile(file);
    const id = uid('doc'), path = 'documents/' + o.related_id + '/' + id + '_' + file.name.replace(/[^\w.\-]+/g, '_');
    const up = await MockStorage.upload(file, path);
    return ins('documents', Object.assign({ id: id, code: o.code || nextDocCode(), doc_type: o.doc_type, slot: o.slot || null, related_type: o.related_type, related_id: o.related_id, file_name: file.name, file_type: up.type, size_bytes: up.size, storage_path: up.path, uploaded_at: nowIso(), uploaded_by: getUser().id, description: o.description || '' }, o.extra || {}));
  }
  /* Photo / NID slots for shareholders and nominees. Replacing or removing archives the earlier document; nothing is deleted. */
  const KYC_SLOTS = ['photo', 'nid_front', 'nid_back'];
  const KYC_FIELD = { photo: 'photo_doc_id', nid_front: 'nid_front_doc_id', nid_back: 'nid_back_doc_id' };
  const KYC_LABEL = { photo: 'photo', nid_front: 'NID front', nid_back: 'NID back' };
  async function slotOps(db, owner, row, slot, value, shId, reason) {
    const field = KYC_FIELD[slot], prev = row[field] ? Calc.byId(db.documents, row[field]) : null, ops = [], patch = {}, who = owner === 'nominee' ? 'nominee ' : '';
    if (value === 'REMOVE') {
      if (prev) { ops.push({ op: 'archive', table: 'documents', id: prev.id, meta: { by: getUser().id, reason: reason || 'Removed' } }); ops.push(audit('Removed document', 'document', prev.id, 'Removed ' + who + KYC_LABEL[slot] + ' (' + prev.file_name + ')', { shareholder_id: shId, reason: reason || 'Removed by user' })); }
      patch[field] = null; return { ops: ops, patch: patch };
    }
    const d = await storeFile(value, { doc_type: slot === 'photo' ? 'Photo' : 'NID', slot: slot, related_type: owner, related_id: row.id, description: (owner === 'nominee' ? 'Nominee ' : '') + (slot === 'photo' ? 'photo' : KYC_LABEL[slot] + ' side') });
    ops.push(d); patch[field] = d.row.id;
    if (prev) { ops.push({ op: 'archive', table: 'documents', id: prev.id, meta: { by: getUser().id, reason: 'Replaced by ' + d.row.code } }); ops.push(audit('Replaced document', 'document', d.row.id, 'Replaced ' + who + KYC_LABEL[slot] + ' with ' + d.row.file_name, { shareholder_id: shId, reason: 'Replaced ' + prev.file_name })); }
    else ops.push(audit('Uploaded document', 'document', d.row.id, 'Uploaded ' + who + KYC_LABEL[slot] + ' ' + d.row.file_name, { shareholder_id: shId }));
    return { ops: ops, patch: patch };
  }
  const SH_KEYS = ['full_name', 'phone', 'email', 'profession', 'designation', 'nid', 'address', 'registration_date', 'status', 'remarks'];
  const S = {};

  /* ---------- shareholders ---------- */
  S.findDuplicateShareholders = function (data, excludeId) {
    return getDb().shareholders.filter(function (s) { return live(s) && s.id !== excludeId; }).filter(function (s) {
      return (digits(s.phone) && digits(s.phone) === digits(data.phone)) || (s.nid && s.nid === String(data.nid || '').replace(/\s/g, '')) || (s.full_name.trim().toLowerCase() === String(data.full_name || '').trim().toLowerCase());
    });
  };
  const hasNomFile = function (files) { return KYC_SLOTS.some(function (k) { return files['nominee_' + k] && files['nominee_' + k] !== 'REMOVE'; }); };
  S.createShareholder = async function (input, requestId) {
    guard('write'); const data = input.data, nominee = input.nominee || {}, files = input.files || {}; need(V.shareholder(data, nominee));
    const hasNom = !!(nominee.name && nominee.name.trim());
    if (!hasNom && hasNomFile(files)) throw new AppError('Enter the nominee name before adding nominee documents.', 'Check the form', 'VALIDATION');
    const db = getDb(), code = codeGen(db.shareholders, 'SH-', 4)(), id = uid('sh');
    const row = Object.assign({ id: id, code: code, photo_url: null, photo_doc_id: null, nid_front_doc_id: null, nid_back_doc_id: null, created_by: getUser().id, created_at: nowIso() }, data, { nid: String(data.nid || '').replace(/\s/g, ''), phone: String(data.phone || '').trim(), registration_date: data.registration_date || TODAY });
    const nomRow = hasNom ? Object.assign({ id: uid('nom'), shareholder_id: id, photo_doc_id: null, nid_front_doc_id: null, nid_back_doc_id: null }, nominee) : null, docOps = [];
    for (const k of KYC_SLOTS) {
      if (files[k] && files[k] !== 'REMOVE') { const r = await slotOps(db, 'shareholder', row, k, files[k], id); Object.assign(row, r.patch); r.ops.forEach(function (o) { docOps.push(o); }); }
      if (nomRow && files['nominee_' + k] && files['nominee_' + k] !== 'REMOVE') { const r = await slotOps(db, 'nominee', nomRow, k, files['nominee_' + k], id); Object.assign(nomRow, r.patch); r.ops.forEach(function (o) { docOps.push(o); }); }
    }
    const ops = [ins('shareholders', row)];
    if (nomRow) ops.push(ins('nominees', nomRow));
    docOps.forEach(function (o) { ops.push(o); });
    ops.push(audit('Created shareholder', 'shareholder', id, 'Created shareholder ' + code + ' ' + row.full_name, { shareholder_id: id }));
    await commit(ops, requestId); return row;
  };
  S.updateShareholder = async function (id, input, requestId) {
    guard('write'); const db = getDb(), cur = Calc.byId(db.shareholders, id), data = input.data, nominee = input.nominee || {}, files = input.files || {}; need(V.shareholder(data, nominee));
    const nom = db.nominees.filter(function (n) { return n.shareholder_id === id && live(n); })[0] || null, hasNom = !!(nominee.name && nominee.name.trim());
    if (!hasNom && !nom && hasNomFile(files)) throw new AppError('Enter the nominee name before adding nominee documents.', 'Check the form', 'VALIDATION');
    const patch = Object.assign({}, data, { nid: String(data.nid || '').replace(/\s/g, ''), phone: String(data.phone || '').trim(), registration_date: data.registration_date || cur.registration_date || TODAY }), d = diff(cur, patch, SH_KEYS), ops = [], docOps = [], docNotes = [];
    for (const k of KYC_SLOTS) { const v = files[k]; if (v) { const r = await slotOps(db, 'shareholder', cur, k, v, id); Object.assign(patch, r.patch); r.ops.forEach(function (o) { docOps.push(o); }); docNotes.push(KYC_LABEL[k] + (v === 'REMOVE' ? ' removed' : ' updated')); } }
    let nomChanged = false;
    if (hasNom || nom) {
      const base = nom || Object.assign({ id: uid('nom'), shareholder_id: id, photo_doc_id: null, nid_front_doc_id: null, nid_back_doc_id: null }, nominee), nomPatch = hasNom ? Object.assign({}, nominee) : {};
      for (const k of KYC_SLOTS) { const v = files['nominee_' + k]; if (v) { const r = await slotOps(db, 'nominee', base, k, v, id); Object.assign(nomPatch, r.patch); r.ops.forEach(function (o) { docOps.push(o); }); docNotes.push('nominee ' + KYC_LABEL[k] + (v === 'REMOVE' ? ' removed' : ' updated')); } }
      if (nom) { const nd = diff(nom, nomPatch, ['name', 'relation', 'phone', 'nid', 'address', 'photo_doc_id', 'nid_front_doc_id', 'nid_back_doc_id']); if (nd.changed.length) { ops.push({ op: 'update', table: 'nominees', id: nom.id, patch: nomPatch }); nomChanged = true; } }
      else if (hasNom) { ops.push(ins('nominees', Object.assign(base, nomPatch))); nomChanged = true; }
    }
    if (!d.changed.length && !nomChanged && !docNotes.length) throw new AppError('Nothing was changed.', 'No changes', 'NO_CHANGE');
    ops.unshift({ op: 'update', table: 'shareholders', id: id, patch: patch });
    docOps.forEach(function (o) { ops.push(o); });
    ops.push(audit('Edited shareholder', 'shareholder', id, 'Edited ' + cur.code + ': ' + d.changed.concat(nomChanged ? ['nominee'] : []).concat(docNotes).join(', '), { shareholder_id: id, before: d.before, after: d.after }));
    await commit(ops, requestId); return true;
  };
  /* Profile-level document actions (photo / NID for shareholder or nominee). */
  S.setPersonDocument = async function (input) {
    guard('write'); const db = getDb(), owner = input.owner, row = Calc.byId(owner === 'nominee' ? db.nominees : db.shareholders, input.ownerId);
    if (!row) throw new AppError('Record not found.', 'Not found'); const shId = owner === 'nominee' ? row.shareholder_id : row.id;
    const r = await slotOps(db, owner, row, input.slot, input.file, shId);
    await commit([{ op: 'update', table: owner === 'nominee' ? 'nominees' : 'shareholders', id: row.id, patch: r.patch }].concat(r.ops));
  };
  S.removePersonDocument = async function (input) {
    guard('write'); if (!String(input.reason || '').trim()) throw new AppError('Give a reason for removing the document.', 'Reason needed', 'VALIDATION');
    const db = getDb(), owner = input.owner, row = Calc.byId(owner === 'nominee' ? db.nominees : db.shareholders, input.ownerId);
    if (!row) throw new AppError('Record not found.', 'Not found'); const shId = owner === 'nominee' ? row.shareholder_id : row.id;
    const r = await slotOps(db, owner, row, input.slot, 'REMOVE', shId, input.reason);
    await commit([{ op: 'update', table: owner === 'nominee' ? 'nominees' : 'shareholders', id: row.id, patch: r.patch }].concat(r.ops));
  };
  S.archiveShareholder = async function (id, reason) {
    guard('archive'); const db = getDb(), sh = Calc.byId(db.shareholders, id), sum_ = Calc.shareholder(db, sh);
    if (sum_.bookings.length || sum_.units.length || sum_.plans.length) throw new AppError('This shareholder still has bookings, units or construction plans. Archive or reverse those first.', 'Cannot archive yet', 'HAS_LINKS');
    await commit([{ op: 'archive', table: 'shareholders', id: id, meta: { by: getUser().id, reason: reason } }, audit('Archived record', 'shareholder', id, 'Archived shareholder ' + sh.code + ' ' + sh.full_name, { shareholder_id: id, reason: reason })]);
  };

  /* ---------- share bookings & payments ---------- */
  S.checkSharePayment = function (input) {
    const db = getDb(), b = Calc.byId(db.share_bookings, input.booking_id); if (!b) return { overpay: 0, duplicate: null };
    const s = Calc.bookingSummary(db, b), amt = Number(input.amount) || 0;
    const dup = db.share_payments.filter(function (p) { return live(p) && p.kind === 'payment' && p.status === 'Posted' && p.booking_id === b.id && p.amount === amt && p.payment_date === input.payment_date && (String(p.reference || '') === String(input.reference || '')); })[0] || null;
    return { overpay: Calc.overpay(amt, s.due), duplicate: dup, due: s.due };
  };
  function sharePaymentRow(db, b, input, receipt, nextCode, extra) {
    return ins('share_payments', Object.assign({
      id: uid('spay'), code: nextCode(), receipt_no: receipt, booking_id: b.id, shareholder_id: b.shareholder_id, amount: roundMoney(Number(input.amount)), payment_date: input.payment_date, method: input.method || '', method_details: input.method === 'Others' ? String(input.method_details || '').trim() : '',
      reference: String(input.reference || '').trim(), note: input.note || '', attachment_doc_id: null, kind: 'payment', reversal_of: null, reversal_reason: null, reversed_by_id: null, status: 'Posted', created_by: getUser().id, created_at: nowIso(), client_request_id: null
    }, extra || {}));
  }
  S.createBooking = async function (input, requestId) {
    guard('write'); const db = getDb(), total = db.settings[0].total_shares, avail = total - Calc.sharesSold(db);
    /* The price on a booking is whatever was agreed for that booking (the Settings price is only the pre-filled default) and is stored with the booking, so later Settings changes never touch it. */
    input = Object.assign({}, input, { booking_date: input.booking_date || TODAY }); need(V.booking(input, { available: avail }));
    const pay = input.payment && Number(input.payment.amount) > 0 ? input.payment : null, id = uid('bk'), grand = Number(input.quantity) * Number(input.unit_price) - Number(input.discount || 0);
    if (pay) { const pe = V.paymentCore(pay); need(pe); if (Number(pay.amount) > grand + 0.005) throw new AppError('The first payment exceeds the booking total. Lower it or increase the share quantity.', 'Payment too high', 'OVERPAY'); if (pay.payment_date < input.booking_date) throw new AppError('The payment date cannot be earlier than the booking date.', 'Check the dates', 'VALIDATION'); }
    const code = codeGen(db.share_bookings, 'BK-', 4)(), booking = ins('share_bookings', { id: id, code: code, shareholder_id: input.shareholder_id, quantity: Number(input.quantity), unit_price: Number(input.unit_price), discount: Number(input.discount || 0), booking_date: input.booking_date, reference_person: input.reference_person || '', remarks: input.remarks || '', status: 'Active', created_by: getUser().id, created_at: nowIso() });
    const ops = [booking, audit('Created booking', 'booking', id, 'Created booking ' + code + ' for ' + input.quantity + ' share(s), grand total ' + fmtMoney(grand), { shareholder_id: input.shareholder_id })];
    let payment = null;
    if (pay) { payment = sharePaymentRow(db, booking.row, pay, receiptGen(db, 'RCT-S-')(), codeGen(db.share_payments, 'SP-', 4)); ops.push(payment, audit('Added payment', 'share_payment', payment.row.id, 'Recorded ' + fmtMoney(payment.row.amount) + ' against ' + code + ' (' + payment.row.receipt_no + ')', { shareholder_id: input.shareholder_id })); }
    await commit(ops, requestId); return { booking: booking.row, payment: payment && payment.row };
  };
  S.addSharePayment = async function (input, requestId) {
    guard('write'); const db = getDb(), b = Calc.byId(db.share_bookings, input.booking_id); if (!b) throw new AppError('Choose a booking.', 'Check the form');
    need(V.paymentCore(input)); const chk = S.checkSharePayment(input);
    if (chk.overpay && !input.allowOverpay) throw new AppError('This payment is ' + fmtMoney(chk.overpay) + ' more than the remaining due.', 'Needs confirmation', 'NEEDS_CONFIRMATION');
    if (chk.duplicate && !input.allowDuplicate) throw new AppError('A payment with the same booking, amount, date and reference already exists (' + chk.duplicate.receipt_no + ').', 'Possible duplicate', 'NEEDS_CONFIRMATION');
    const ops = [], p = sharePaymentRow(db, b, input, receiptGen(db, 'RCT-S-')(), codeGen(db.share_payments, 'SP-', 4));
    if (input.file) { const d = await storeFile(input.file, { doc_type: 'Payment Receipt', related_type: 'share_payment', related_id: p.row.id, description: 'Receipt for ' + p.row.receipt_no }); p.row.attachment_doc_id = d.row.id; ops.push(d); }
    ops.unshift(p);
    ops.push(audit(input.correction_of ? 'Added corrected payment' : 'Added payment', 'share_payment', p.row.id, (input.correction_of ? 'Corrected payment ' : 'Recorded ') + fmtMoney(p.row.amount) + ' against ' + b.code + ' (' + p.row.receipt_no + ')' + (input.correction_of ? ' replacing ' + input.correction_of : ''), { shareholder_id: b.shareholder_id }));
    await commit(ops, requestId); return p.row;
  };
  S.reverseSharePayment = async function (id, reason) {
    guard('reverse'); const db = getDb(), p = Calc.byId(db.share_payments, id);
    if (!p || p.kind !== 'payment' || p.status !== 'Posted') throw new AppError('Only posted payments can be reversed.', 'Cannot reverse');
    if (!String(reason || '').trim()) throw new AppError('Give a reason for the reversal.', 'Reason needed');
    const rev = ins('share_payments', Object.assign({}, p, { id: uid('spay'), code: codeGen(db.share_payments, 'SP-', 4)(), receipt_no: receiptGen(db, 'RCT-S-')(), amount: -p.amount, kind: 'reversal', reversal_of: p.id, reversal_reason: reason, reversed_by_id: null, status: 'Posted', attachment_doc_id: null, note: 'Reversal of ' + p.receipt_no, created_by: getUser().id, created_at: nowIso(), payment_date: TODAY, client_request_id: null, _demo: false }));
    await commit([rev, { op: 'update', table: 'share_payments', id: p.id, patch: { status: 'Reversed', reversed_by_id: rev.row.id } }, audit('Reversed payment', 'share_payment', p.id, 'Reversed ' + p.receipt_no + ' (' + fmtMoney(p.amount) + ')', { shareholder_id: p.shareholder_id, reason: reason })]);
    return rev.row;
  };
  S.archiveBooking = async function (id, reason) {
    guard('archive'); const db = getDb(), b = Calc.byId(db.share_bookings, id), s = Calc.bookingSummary(db, b);
    if (Math.abs(s.paid) > 0.004) throw new AppError('This booking has payments with a net balance of ' + fmtMoney(s.paid) + '. Reverse them before archiving.', 'Cannot archive yet', 'HAS_LINKS');
    await commit([{ op: 'archive', table: 'share_bookings', id: id, meta: { by: getUser().id, reason: reason } }, audit('Archived record', 'booking', id, 'Archived booking ' + b.code, { shareholder_id: b.shareholder_id, reason: reason })]);
  };

  /* ---------- units ---------- */
  S.saveUnit = async function (id, f, requestId) {
    guard('write'); const db = getDb(); need(V.unit(f, { db: db, id: id }));
    const row = { code: f.code.trim().toUpperCase(), floor: Number(f.floor), unit_no: f.code.trim().toUpperCase().slice(-1), size_sqft: Number(f.size_sqft), status: f.status, shareholder_id: f.shareholder_id || null, assigned_date: f.shareholder_id ? (f.assigned_date || TODAY) : null, remarks: f.remarks || '' };
    if (!id) {
      const uidn = uid('unit'); await commit([ins('units', Object.assign({ id: uidn }, row)), audit('Created unit', 'unit', uidn, 'Created unit ' + row.code + ' (' + row.size_sqft + ' sq ft)', { shareholder_id: row.shareholder_id })], requestId); return row;
    }
    const cur = Calc.byId(db.units, id), d = diff(cur, row, ['code', 'floor', 'size_sqft', 'status', 'shareholder_id', 'assigned_date', 'remarks']);
    if (!d.changed.length) throw new AppError('Nothing was changed.', 'No changes', 'NO_CHANGE');
    const assigned = cur.shareholder_id !== row.shareholder_id;
    await commit([{ op: 'update', table: 'units', id: id, patch: row }, audit(assigned ? 'Assigned unit' : 'Edited unit', 'unit', id, (assigned ? 'Unit ' + row.code + (row.shareholder_id ? ' assigned to ' + Calc.byId(db.shareholders, row.shareholder_id).full_name : ' unassigned') : 'Edited unit ' + row.code + ': ' + d.changed.join(', ')), { shareholder_id: row.shareholder_id || cur.shareholder_id, before: d.before, after: d.after })], requestId);
    return row;
  };

  /* ---------- construction contributions ---------- */
  S.createPlan = async function (f, requestId) {
    guard('write'); const db = getDb(); need(V.plan(f));
    const unit = Calc.byId(db.units, f.unit_id);
    if (!unit.shareholder_id) throw new AppError('Assign this unit to a shareholder first.', 'Unit not assigned');
    if (db.construction_plans.some(function (p) { return live(p) && p.unit_id === unit.id && p.status !== 'Cancelled'; })) throw new AppError('Unit ' + unit.code + ' already has a construction contribution. Open it to add payments.', 'Contribution exists');
    const id = uid('cplan'), code = codeGen(db.construction_plans, 'CP-', 4)();
    await commit([ins('construction_plans', { id: id, code: code, unit_id: unit.id, shareholder_id: unit.shareholder_id, total_amount: Number(f.total_amount), status: 'Active', remarks: f.remarks || '', created_by: getUser().id, created_at: nowIso() }),
      audit('Created construction plan', 'construction_plan', id, 'Set total construction contribution of ' + fmtMoney(f.total_amount) + ' for unit ' + unit.code + ' (' + code + ')', { shareholder_id: unit.shareholder_id })], requestId); return id;
  };
  S.updatePlanTotal = async function (planId, total, reason) {
    guard('approve'); const db = getDb(), plan = Calc.byId(db.construction_plans, planId), pc = Calc.plan(db, plan); need(V.planTotal(total, pc.paid, reason));
    if (Number(total) === plan.total_amount) throw new AppError('The total is already ' + fmtMoney(plan.total_amount) + '.', 'No changes', 'NO_CHANGE');
    await commit([{ op: 'update', table: 'construction_plans', id: planId, patch: { total_amount: Number(total) } },
      audit('Changed construction total', 'construction_plan', planId, 'Changed total of ' + plan.code + ' from ' + fmtMoney(plan.total_amount) + ' to ' + fmtMoney(total), { shareholder_id: plan.shareholder_id, reason: reason, before: { total_amount: plan.total_amount }, after: { total_amount: Number(total) } })]);
  };
  S.checkConstructionPayment = function (input) {
    const db = getDb(), plan = Calc.byId(db.construction_plans, input.plan_id); if (!plan) return { overpay: 0, duplicate: null };
    const pc = Calc.plan(db, plan), amt = Number(input.amount) || 0;
    const dup = db.construction_payments.filter(function (p) { return live(p) && p.kind === 'payment' && p.status === 'Posted' && p.plan_id === plan.id && p.amount === amt && p.payment_date === input.payment_date && String(p.reference || '') === String(input.reference || ''); })[0] || null;
    return { overpay: Calc.overpay(amt, pc.due), duplicate: dup, due: pc.due };
  };
  S.addConstructionPayment = async function (input, requestId) {
    guard('write'); const db = getDb(), plan = Calc.byId(db.construction_plans, input.plan_id); if (!plan) throw new AppError('Choose a unit.', 'Check the form');
    need(V.paymentCore(input)); const chk = S.checkConstructionPayment(input), unit = Calc.byId(db.units, plan.unit_id);
    if (chk.overpay && !input.allowOverpay) throw new AppError('This payment is ' + fmtMoney(chk.overpay) + ' more than the remaining due of ' + fmtMoney(chk.due) + '.', 'Needs confirmation', 'NEEDS_CONFIRMATION');
    if (chk.duplicate && !input.allowDuplicate) throw new AppError('A payment with the same amount, date and reference already exists (' + chk.duplicate.receipt_no + ').', 'Possible duplicate', 'NEEDS_CONFIRMATION');
    const p = ins('construction_payments', { id: uid('cpay'), code: codeGen(db.construction_payments, 'CN-', 4)(), receipt_no: receiptGen(db, 'RCT-C-')(), plan_id: plan.id, unit_id: plan.unit_id, shareholder_id: plan.shareholder_id, amount: roundMoney(Number(input.amount)), payment_date: input.payment_date, method: input.method || '', method_details: input.method === 'Others' ? String(input.method_details || '').trim() : '', reference: String(input.reference || '').trim(), note: input.note || '', attachment_doc_id: null, kind: 'payment', reversal_of: null, reversal_reason: null, reversed_by_id: null, status: 'Posted', created_by: getUser().id, created_at: nowIso(), client_request_id: null });
    const ops = [];
    if (input.file) { const d = await storeFile(input.file, { doc_type: 'Payment Receipt', related_type: 'construction_payment', related_id: p.row.id, description: 'Receipt for ' + p.row.receipt_no }); p.row.attachment_doc_id = d.row.id; ops.push(d); }
    ops.unshift(p);
    ops.push(audit(input.correction_of ? 'Added corrected payment' : 'Added payment', 'construction_payment', p.row.id, (input.correction_of ? 'Corrected payment ' : 'Recorded ') + fmtMoney(p.row.amount) + ' for unit ' + unit.code + ' (' + p.row.receipt_no + ')' + (input.correction_of ? ' replacing ' + input.correction_of : ''), { shareholder_id: plan.shareholder_id }));
    await commit(ops, requestId); return p.row;
  };
  S.reverseConstructionPayment = async function (id, reason) {
    guard('reverse'); const db = getDb(), p = Calc.byId(db.construction_payments, id);
    if (!p || p.kind !== 'payment' || p.status !== 'Posted') throw new AppError('Only posted payments can be reversed.', 'Cannot reverse');
    if (!String(reason || '').trim()) throw new AppError('Give a reason for the reversal.', 'Reason needed');
    const rev = ins('construction_payments', Object.assign({}, p, { id: uid('cpay'), code: codeGen(db.construction_payments, 'CN-', 4)(), receipt_no: receiptGen(db, 'RCT-C-')(), amount: -p.amount, kind: 'reversal', reversal_of: p.id, reversal_reason: reason, reversed_by_id: null, status: 'Posted', attachment_doc_id: null, note: 'Reversal of ' + p.receipt_no, created_by: getUser().id, created_at: nowIso(), payment_date: TODAY, client_request_id: null, _demo: false }));
    await commit([rev, { op: 'update', table: 'construction_payments', id: p.id, patch: { status: 'Reversed', reversed_by_id: rev.row.id } }, audit('Reversed payment', 'construction_payment', p.id, 'Reversed ' + p.receipt_no + ' (' + fmtMoney(p.amount) + ')', { shareholder_id: p.shareholder_id, reason: reason })]);
    return rev.row;
  };

  /* ---------- contractors & project expenses ---------- */
  S.createContractor = async function (f, rows, requestId) {
    guard('write'); need(V.contractor(f, rows)); const db = getDb(), id = uid('ctr'), code = codeGen(db.contractors, 'CTR-', 3)(), isC = f.kind === 'Contractor';
    const ops = [ins('contractors', { id: id, code: code, name: f.name.trim(), kind: f.kind, trade: f.trade || '', phone: f.phone || '', contract_value: isC ? Number(f.contract_value) : null, contract_date: isC ? (f.contract_date || TODAY) : null, status: 'Active', created_by: getUser().id, created_at: nowIso() })];
    if (isC) rows.slice().sort(function (a, b) { return a.due_date.localeCompare(b.due_date); }).forEach(function (r, i) { ops.push(ins('contract_installments', { id: uid('cti'), contractor_id: id, no: i + 1, due_date: r.due_date, amount: Number(r.amount) })); });
    ops.push(audit(isC ? 'Created contract' : 'Created supplier', 'contractor', id, (isC ? 'Created contract with ' + f.name + ' worth ' + fmtMoney(f.contract_value) + ' in ' + rows.length + ' installments' : 'Added supplier ' + f.name)));
    await commit(ops, requestId); return id;
  };
  S.checkExpense = function (input) {
    const db = getDb(), amt = Number(input.amount) || 0; let overpay = 0;
    if (input.contract_installment_id) { const inst = Calc.byId(db.contract_installments, input.contract_installment_id), c = inst && Calc.byId(db.contractors, inst.contractor_id); if (c) { const r = Calc.contractor(db, c).installments.filter(function (x) { return x.id === inst.id; })[0]; overpay = Calc.overpay(amt, r.due); } }
    const dup = db.project_expenses.filter(function (e) { return live(e) && e.kind === 'expense' && e.status === 'Posted' && e.amount === amt && e.expense_date === input.expense_date && (e.contractor_id || '') === (input.contractor_id || '') && String(e.reference || '') === String(input.reference || ''); })[0] || null;
    return { overpay: overpay, duplicate: dup };
  };
  S.createExpense = async function (input, requestId) {
    guard('write'); const db = getDb(); need(V.expense(input, {})); const chk = S.checkExpense(input);
    if (chk.overpay && !input.allowOverpay) throw new AppError('This payment is ' + fmtMoney(chk.overpay) + ' more than the remaining due on the contract installment.', 'Needs confirmation', 'NEEDS_CONFIRMATION');
    if (chk.duplicate && !input.allowDuplicate) throw new AppError('An expense with the same date, amount, payee and reference already exists (' + chk.duplicate.code + ').', 'Possible duplicate', 'NEEDS_CONFIRMATION');
    const u = getUser(), approval = can(u, 'approve') ? input.approval_status : 'Pending', c = input.contractor_id ? Calc.byId(db.contractors, input.contractor_id) : null;
    const e = ins('project_expenses', { id: uid('exp'), code: codeGen(db.project_expenses, 'EX-', 4)(), expense_date: input.expense_date, category: input.category, contractor_id: input.contractor_id || null, payee_name: c ? c.name : String(input.payee_name || '').trim(), contract_installment_id: input.contract_installment_id || null, description: String(input.description || '').trim() || (input.category === 'Other' ? String(input.other_description || '').trim() : ''), other_description: input.category === 'Other' ? String(input.other_description || '').trim() : '', amount: roundMoney(Number(input.amount)), method: input.method || '', method_details: input.method === 'Others' ? String(input.method_details || '').trim() : '', reference: String(input.reference || '').trim(), attachment_doc_id: null, approval_status: approval, approved_by: approval === 'Pending' ? null : u.id, paid_by: u.id, remarks: input.remarks || '', kind: 'expense', reversal_of: null, reversal_reason: null, reversed_by_id: null, status: 'Posted', created_by: u.id, created_at: nowIso(), client_request_id: null });
    const ops = [];
    if (input.file) { const d = await storeFile(input.file, { doc_type: 'Bill / Invoice', related_type: 'expense', related_id: e.row.id, description: 'Bill for ' + e.row.code }); e.row.attachment_doc_id = d.row.id; ops.push(d); }
    ops.unshift(e); ops.push(audit('Added project expense', 'expense', e.row.id, 'Added expense ' + e.row.code + ': ' + e.row.description + ' (' + fmtMoney(e.row.amount) + ', ' + approval + ')'));
    await commit(ops, requestId); return e.row;
  };
  S.setExpenseApproval = async function (id, status, note) {
    guard('approve'); const e = Calc.byId(getDb().project_expenses, id);
    await commit([{ op: 'update', table: 'project_expenses', id: id, patch: { approval_status: status, approved_by: getUser().id } }, audit(status === 'Approved' ? 'Approved expense' : 'Rejected expense', 'expense', id, status + ' expense ' + e.code + ' (' + fmtMoney(e.amount) + ')', { reason: note || null, before: { approval_status: e.approval_status }, after: { approval_status: status } })]);
  };
  S.reverseExpense = async function (id, reason) {
    guard('reverse'); const db = getDb(), e = Calc.byId(db.project_expenses, id);
    if (!e || e.kind !== 'expense' || e.status !== 'Posted') throw new AppError('Only posted expenses can be reversed.', 'Cannot reverse');
    if (!String(reason || '').trim()) throw new AppError('Give a reason for the reversal.', 'Reason needed');
    const rev = ins('project_expenses', Object.assign({}, e, { id: uid('exp'), code: codeGen(db.project_expenses, 'EX-', 4)(), amount: -e.amount, kind: 'reversal', reversal_of: e.id, reversal_reason: reason, reversed_by_id: null, status: 'Posted', attachment_doc_id: null, description: 'Reversal of ' + e.code + ': ' + e.description, approval_status: 'Approved', approved_by: getUser().id, created_by: getUser().id, created_at: nowIso(), expense_date: TODAY, client_request_id: null, _demo: false }));
    await commit([rev, { op: 'update', table: 'project_expenses', id: e.id, patch: { status: 'Reversed', reversed_by_id: rev.row.id } }, audit('Reversed expense', 'expense', e.id, 'Reversed ' + e.code + ' (' + fmtMoney(e.amount) + ')', { reason: reason })]);
  };

  /* ---------- documents ---------- */
  S.addDocument = async function (f, requestId) {
    guard('write'); need(V.document(f)); const d = await storeFile(f.file, { doc_type: f.doc_type, related_type: f.related_type, related_id: f.related_type === 'project' ? 'project' : f.related_id, description: f.description });
    const sh = f.related_type === 'shareholder' ? f.related_id : null;
    await commit([d, audit('Uploaded document', 'document', d.row.id, 'Uploaded ' + d.row.file_name + ' (' + f.doc_type + ')', { shareholder_id: sh })], requestId); return d.row;
  };
  S.archiveDocument = async function (id, reason) {
    guard('archive'); const doc = Calc.byId(getDb().documents, id);
    await commit([{ op: 'archive', table: 'documents', id: id, meta: { by: getUser().id, reason: reason } }, audit('Archived record', 'document', id, 'Archived document ' + doc.file_name, { reason: reason })]);
  };

  /* ---------- project details + project images ----------
     Images are rows in `documents` (related_type 'project'), so they use the same storage adapter, audit trail and archive-only removal as every other file. */
  const PROJECT_KEYS = ['project_name', 'project_type', 'location', 'land_area', 'total_area', 'description', 'handover_info', 'building_structure', 'construction_start', 'expected_completion', 'contact_phone', 'contact_email', 'contact_address', 'notes'];
  const projectImages = function (db) { return db.documents.filter(function (d) { return live(d) && d.related_type === 'project' && d.slot === 'project_image'; }); };
  S.updateProjectDetails = async function (f) {
    guard('write'); const cur = getDb().settings[0], patch = {};
    if (!String(f.project_name || '').trim()) throw new AppError('Enter the project name.', 'Missing project name', 'VALIDATION');
    if (f.construction_start && f.expected_completion && f.expected_completion < f.construction_start) throw new AppError('Expected completion cannot be before the construction start date.', 'Check the dates', 'VALIDATION');
    if (f.contact_email && !/^\S+@\S+\.\S+$/.test(f.contact_email)) throw new AppError('Enter a valid contact email.', 'Invalid email', 'VALIDATION');
    PROJECT_KEYS.forEach(function (k) { if (f[k] != null) patch[k] = String(f[k]).trim(); });
    const d = diff(cur, patch, Object.keys(patch)); if (!d.changed.length) throw new AppError('Nothing was changed.', 'No changes', 'NO_CHANGE');
    await commit([{ op: 'update', table: 'settings', id: 'settings', patch: patch }, audit('Edited project details', 'settings', 'settings', 'Changed project details: ' + d.changed.join(', '), { before: d.before, after: d.after })]);
  };
  S.addProjectImages = async function (items) {
    guard('write'); if (!items || !items.length) throw new AppError('Choose at least one image.', 'No file', 'VALIDATION');
    items.forEach(function (it) { checkFile(it.file); if (!/^image\//.test(it.file.type)) throw new AppError(it.file.name + ' is not an image. Project images must be JPG, PNG or WebP.', 'File type not accepted', 'VALIDATION'); });
    const ops = []; let n = Date.now();
    for (let i = 0; i < items.length; i++) {
      const it = items[i], cat = it.category || 'Other', cap = String(it.title || '').trim() || it.file.name.replace(/\.[^.]+$/, '');
      const d = await storeFile(it.file, { doc_type: 'Project Image', slot: 'project_image', related_type: 'project', related_id: 'project', description: cap, extra: { category: cat, caption: cap, sort: n++ } });
      ops.push(d, audit('Added project image', 'document', d.row.id, 'Added project image "' + cap + '" (' + cat + ')', {}));
    }
    await commit(ops); return ops.length / 2;
  };
  S.updateProjectImage = async function (id, f) {
    guard('write'); const doc = Calc.byId(getDb().documents, id); if (!doc || doc.slot !== 'project_image') throw new AppError('Project image not found.', 'Not found', 'NOT_FOUND');
    const patch = { caption: String(f.title || '').trim() || doc.caption, category: f.category || doc.category, description: String(f.title || '').trim() || doc.caption };
    const d = diff(doc, patch, ['caption', 'category']); if (!d.changed.length) throw new AppError('Nothing was changed.', 'No changes', 'NO_CHANGE');
    await commit([{ op: 'update', table: 'documents', id: id, patch: patch }, audit('Edited project image', 'document', id, 'Edited project image details: ' + d.changed.join(', '), { before: d.before, after: d.after })]);
  };
  S.replaceProjectImage = async function (id, file) {
    guard('write'); const doc = Calc.byId(getDb().documents, id); if (!doc || doc.slot !== 'project_image') throw new AppError('Project image not found.', 'Not found', 'NOT_FOUND');
    if (file && !/^image\//.test(file.type)) throw new AppError('Project images must be JPG, PNG or WebP.', 'File type not accepted', 'VALIDATION');
    const d = await storeFile(file, { doc_type: 'Project Image', slot: 'project_image', related_type: 'project', related_id: 'project', description: doc.caption, extra: { category: doc.category, caption: doc.caption, sort: doc.sort } });
    await commit([d, { op: 'archive', table: 'documents', id: id, meta: { by: getUser().id, reason: 'Replaced by ' + d.row.code } }, audit('Replaced project image', 'document', d.row.id, 'Replaced project image "' + doc.caption + '" with ' + d.row.file_name, { reason: 'Replaced ' + doc.file_name })]); return d.row;
  };
  S.removeProjectImage = async function (id, reason) {
    guard('write'); const doc = Calc.byId(getDb().documents, id); if (!doc || doc.slot !== 'project_image') throw new AppError('Project image not found.', 'Not found', 'NOT_FOUND');
    await commit([{ op: 'archive', table: 'documents', id: id, meta: { by: getUser().id, reason: reason || 'Removed' } }, audit('Removed project image', 'document', id, 'Removed project image "' + doc.caption + '"', { reason: reason || 'Removed by user' })]);
  };

  /* ---------- settings ---------- */
  S.updateSettings = async function (patch) {
    guard('settings'); const db0 = getDb(), cur = db0.settings[0];
    if ('total_shares' in patch) { const ts = Number(patch.total_shares), sold = Calc.sharesSold(db0); if (!ts || ts < 1 || Math.floor(ts) !== ts) throw new AppError('Enter a whole number of shares.', 'Invalid total shares', 'VALIDATION'); if (ts < sold) throw new AppError(sold + ' shares are already sold. The total cannot be lower.', 'Total below sold', 'VALIDATION'); patch.total_shares = ts; }
    if ('default_share_price' in patch) { const pr = Number(patch.default_share_price); if (isNaN(pr) || pr < 0) throw new AppError('The share price cannot be negative.', 'Invalid share price', 'VALIDATION'); patch.default_share_price = pr; }
    const d = diff(cur, patch, Object.keys(patch));
    if (!d.changed.length) throw new AppError('Nothing was changed.', 'No changes', 'NO_CHANGE');
    await commit([{ op: 'update', table: 'settings', id: 'settings', patch: patch }, audit('Edited settings', 'settings', 'settings', 'Changed settings: ' + d.changed.join(', '), { before: d.before, after: d.after })]);
  };
  return S;
}
