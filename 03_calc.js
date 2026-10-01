/* ============================================================
   03 CALC + VALIDATION — pure business logic over a db snapshot.
   No React, no storage. Totals are always derived, never stored.
   ============================================================ */
const live = function (r) { return !r.archived_at; };
const PERMS = { Admin: ['write', 'reverse', 'approve', 'archive', 'settings'], Accountant: ['write', 'reverse'], Viewer: [] };
function can(user, perm) { return !!user && (PERMS[user.role] || []).indexOf(perm) >= 0; }

const Calc = {
  byId: function (rows, id) { for (let i = 0; i < rows.length; i++) if (rows[i].id === id) return rows[i]; return null; },
  overpay: function (amount, due) { return amount > due + 0.005 ? roundMoney(amount - due) : 0; },

  bookingSummary: function (db, b) {
    const payments = db.share_payments.filter(function (p) { return p.booking_id === b.id && live(p); });
    const total = roundMoney(b.quantity * b.unit_price), discount = b.discount || 0, grand = Math.max(0, roundMoney(total - discount));
    const paid = sum(payments, function (p) { return p.amount; }), due = roundMoney(grand - paid);
    const status = paid <= 0 ? 'Unpaid' : due > 0.004 ? 'Partial' : due < -0.004 ? 'Overpaid' : 'Paid';
    return { total: total, discount: discount, grand: grand, paid: paid, due: due, status: status, payments: payments };
  },
  instStatus: function (dueDate, amount, paid) {
    if (paid >= amount - 0.005) return 'Paid';
    if (dueDate < TODAY) return 'Overdue';
    if (paid > 0) return 'Partial';
    return daysBetween(TODAY, dueDate) <= 31 ? 'Pending' : 'Upcoming';
  },
  /* Flexible contribution: one total per unit, payments of any amount on any date. No installment schedule. */
  plan: function (db, p) {
    const pays = db.construction_payments.filter(function (x) { return x.plan_id === p.id && live(x); });
    const paid = sum(pays, function (x) { return x.amount; }), total = p.total_amount, due = roundMoney(total - paid);
    const dates = pays.filter(function (x) { return x.kind === 'payment' && x.status === 'Posted'; }).map(function (x) { return x.payment_date; }).sort();
    const status = p.status === 'Cancelled' ? 'Cancelled' : total > 0 && due < -0.004 ? 'Overpaid' : total > 0 && due <= 0.004 ? 'Completed' : paid > 0.004 ? 'In Progress' : 'Not Started';
    const exact = total ? Math.round(paid / total * 1000) / 10 : 0;
    return { payments: pays, count: dates.length, last: dates.length ? dates[dates.length - 1] : '', total: total, paid: paid, due: due, status: status, pct: Math.max(0, Math.min(100, exact)), pctExact: exact };
  },
  shareholder: function (db, sh) {
    const bookings = db.share_bookings.filter(function (b) { return b.shareholder_id === sh.id && live(b); }).map(function (b) { return { b: b, s: Calc.bookingSummary(db, b) }; });
    const units = db.units.filter(function (u) { return u.shareholder_id === sh.id && live(u); });
    const plans = db.construction_plans.filter(function (p) { return p.shareholder_id === sh.id && live(p) && p.status !== 'Cancelled'; }).map(function (p) { return { p: p, s: Calc.plan(db, p) }; });
    const shares = sum(bookings, function (x) { return x.b.quantity; });
    const shareValue = sum(bookings, function (x) { return x.s.grand; }), sharePaid = sum(bookings, function (x) { return x.s.paid; });
    const consTotal = sum(plans, function (x) { return x.s.total; }), consPaid = sum(plans, function (x) { return x.s.paid; });
    return {
      bookings: bookings, units: units, plans: plans, shares: shares,
      shareValue: shareValue, sharePaid: sharePaid, shareDue: roundMoney(shareValue - sharePaid),
      consTotal: consTotal, consPaid: consPaid, consDue: roundMoney(consTotal - consPaid),
      received: roundMoney(sharePaid + consPaid), outstanding: roundMoney(shareValue - sharePaid + consTotal - consPaid)
    };
  },
  contractor: function (db, c) {
    const insts = db.contract_installments.filter(function (i) { return i.contractor_id === c.id && live(i); }).sort(function (a, b) { return a.no - b.no; });
    const exps = db.project_expenses.filter(function (e) { return live(e) && e.contractor_id === c.id && e.approval_status !== 'Rejected'; });
    const rows = insts.map(function (i) {
      const paid = sum(exps.filter(function (e) { return e.contract_installment_id === i.id; }), function (e) { return e.amount; });
      return Object.assign({}, i, { paid: paid, due: roundMoney(i.amount - paid), status: Calc.instStatus(i.due_date, i.amount, paid) });
    });
    const total = c.contract_value || 0, paid = sum(rows, function (r) { return r.paid; });
    const upcoming = rows.filter(function (r) { return r.due > 0.004 && r.status !== 'Overdue'; });
    return { installments: rows, total: total, paid: paid, due: roundMoney(total - paid), upcoming: upcoming, upcomingAmount: sum(upcoming, function (r) { return r.due; }), overdue: rows.filter(function (r) { return r.status === 'Overdue'; }).length, totalPaidAll: sum(exps, function (e) { return e.amount; }), pct: total ? Math.min(100, Math.round(paid / total * 100)) : 0 };
  },
  expenseCounts: function (e) { return live(e) && e.approval_status !== 'Rejected'; },
  sharesSold: function (db) { return sum(db.share_bookings.filter(live), function (b) { return b.quantity; }); },

  dashboard: function (db) {
    const shs = db.shareholders.filter(live);
    const bookings = db.share_bookings.filter(live).map(function (b) { return { b: b, s: Calc.bookingSummary(db, b) }; });
    const plans = db.construction_plans.filter(function (p) { return live(p) && p.status !== 'Cancelled'; }).map(function (p) { return { p: p, s: Calc.plan(db, p) }; });
    const exps = db.project_expenses.filter(Calc.expenseCounts);
    const shareValue = sum(bookings, function (x) { return x.s.grand; }), shareCollected = sum(bookings, function (x) { return x.s.paid; });
    const consPlanned = sum(plans, function (x) { return x.s.total; }), consCollected = sum(plans, function (x) { return x.s.paid; });
    const expense = sum(exps, function (e) { return e.amount; });
    const settings = db.settings[0];
    const keys = lastMonthKeys(6);
    const trend = keys.map(function (k) {
      return {
        key: k, label: monthLabel(k),
        share: sum(db.share_payments.filter(function (p) { return live(p) && monthKey(p.payment_date) === k; }), function (p) { return p.amount; }),
        construction: sum(db.construction_payments.filter(function (p) { return live(p) && monthKey(p.payment_date) === k; }), function (p) { return p.amount; }),
        expense: sum(exps.filter(function (e) { return monthKey(e.expense_date) === k; }), function (e) { return e.amount; })
      };
    });
    const cat = {};
    exps.forEach(function (e) { cat[e.category] = (cat[e.category] || 0) + e.amount; });
    const byCategory = Object.keys(cat).map(function (k) { return { label: k, value: cat[k] }; }).filter(function (x) { return x.value > 0; }).sort(function (a, b) { return b.value - a.value; });
    const shName = function (id) { const s = Calc.byId(db.shareholders, id); return s ? s.full_name : '—'; };
    const unitCode = function (id) { const u = Calc.byId(db.units, id); return u ? u.code : '—'; };
    const recentPayments = db.share_payments.filter(live).map(function (p) { return { id: p.id, type: 'Land Share', receipt: p.receipt_no, date: p.payment_date, who: shName(p.shareholder_id), amount: p.amount, method: p.method, status: p.status, kind: p.kind }; })
      .concat(db.construction_payments.filter(live).map(function (p) { return { id: p.id, type: 'Construction', receipt: p.receipt_no, date: p.payment_date, who: shName(p.shareholder_id) + ' · ' + unitCode(p.unit_id), amount: p.amount, method: p.method, status: p.status, kind: p.kind }; }))
      .sort(function (a, b) { return b.date.localeCompare(a.date) || b.receipt.localeCompare(a.receipt); });
    const upcoming = [];
    const consTop = plans.filter(function (x) { return x.s.due > 0.004; }).sort(function (a, b) { return b.s.due - a.s.due; }).slice(0, 6).map(function (x) { return { id: x.p.id, plan_id: x.p.id, who: shName(x.p.shareholder_id), unit: unitCode(x.p.unit_id), total: x.s.total, paid: x.s.paid, due: x.s.due, pct: x.s.pct, status: x.s.status }; });
    db.contractors.filter(function (c) { return live(c) && c.contract_value; }).forEach(function (c) { Calc.contractor(db, c).installments.forEach(function (r) { if (r.due > 0.004) upcoming.push({ dir: 'Out', who: c.name, what: 'Contract installment ' + r.no, due_date: r.due_date, amount: r.due, status: r.status, contractor_id: c.id }); }); });
    upcoming.sort(function (a, b) { return a.due_date.localeCompare(b.due_date); });
    return {
      shareholders: shs.length, sharesSold: sum(bookings, function (x) { return x.b.quantity; }), totalShares: settings.total_shares,
      shareValue: shareValue, shareCollected: shareCollected, shareDue: roundMoney(shareValue - shareCollected),
      consPlanned: consPlanned, consCollected: consCollected, consDue: roundMoney(consPlanned - consCollected),
      expense: expense, fund: roundMoney(shareCollected + consCollected - expense), receivables: roundMoney(shareValue - shareCollected + consPlanned - consCollected),
      pendingApprovalAmount: sum(exps.filter(function (e) { return e.approval_status === 'Pending'; }), function (e) { return e.amount; }),
      trend: trend, byCategory: byCategory,
      recentBookings: bookings.map(function (x) { return x.b; }).sort(function (a, b) { return b.booking_date.localeCompare(a.booking_date) || b.code.localeCompare(a.code); }).slice(0, 6),
      recentPayments: recentPayments.slice(0, 7), recentExpenses: db.project_expenses.filter(live).sort(function (a, b) { return b.expense_date.localeCompare(a.expense_date) || b.code.localeCompare(a.code); }).slice(0, 6),
      upcoming: upcoming, consTop: consTop, consNotStarted: plans.filter(function (x) { return x.s.status === 'Not Started'; }).length, consCompleted: plans.filter(function (x) { return x.s.status === 'Completed'; }).length, consPlans: plans.length
    };
  },
  notifications: function (db) {
    const d = Calc.dashboard(db), out = [];
    if (d.consNotStarted) out.push({ tone: 'info', title: d.consNotStarted + ' unit' + (d.consNotStarted > 1 ? 's' : '') + ' with no construction payment yet', text: 'Contribution set, nothing received', go: ['construction'] });
    const pend = db.project_expenses.filter(function (e) { return live(e) && e.approval_status === 'Pending'; });
    if (pend.length) out.push({ tone: 'warn', title: pend.length + ' expense' + (pend.length > 1 ? 's' : '') + ' awaiting approval', text: fmtMoney(sum(pend, function (e) { return e.amount; })) + ' pending', go: ['expenses'] });
    const soon = d.upcoming.filter(function (u) { return u.dir === 'Out' && u.status !== 'Overdue' && daysBetween(TODAY, u.due_date) <= 14; });
    if (soon.length) out.push({ tone: 'info', title: soon.length + ' contractor installment' + (soon.length > 1 ? 's' : '') + ' due within 14 days', text: fmtMoney(sum(soon, function (x) { return x.amount; })), go: ['expenses', { tab: 'contractors' }] });
    const outC = d.upcoming.filter(function (u) { return u.dir === 'Out' && u.status === 'Overdue'; });
    if (outC.length) out.push({ tone: 'bad', title: outC.length + ' overdue contractor installment' + (outC.length > 1 ? 's' : ''), text: fmtMoney(sum(outC, function (x) { return x.amount; })), go: ['expenses', { tab: 'contractors' }] });
    return out;
  }
};

/* ---------- validation (returns { field: message }) ---------- */
const V = {
  phone: function (s) { return /^(\+?88)?01[3-9]\d{8}$/.test(String(s || '').replace(/[\s-]/g, '')); },
  nid: function (s) { return /^(\d{10}|\d{13}|\d{17})$/.test(String(s || '').replace(/\s/g, '')); },
  email: function (s) { return !s || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); },
  hasErrors: function (e) { return Object.keys(e).length > 0; },
  amount: function (v, e, key, label) {
    const n = Number(v);
    if (v === '' || v == null || isNaN(n)) e[key] = 'Enter ' + (label || 'the amount') + '.';
    else if (n <= 0) e[key] = 'Amount must be greater than zero.';
  },
  shareholder: function (f, n) {
    const e = {};
    if (!String(f.full_name || '').trim()) e.full_name = 'Enter the full name.';
    if (!String(f.phone || '').trim()) e.phone = 'Enter a phone number.'; else if (!V.phone(f.phone)) e.phone = 'Use a Bangladesh mobile number, e.g. 01711-000000.';
    if (!V.email(f.email)) e.email = 'Enter a valid email address.';
    if (!String(f.nid || '').trim()) e.nid = 'Enter the NID number.'; else if (!V.nid(f.nid)) e.nid = 'NID must be 10, 13 or 17 digits.';
    if (!f.registration_date) e.registration_date = 'Choose a registration date.';
    if (n && n.phone && !V.phone(n.phone)) e.nominee_phone = 'Use a Bangladesh mobile number.';
    if (n && n.nid && !V.nid(n.nid)) e.nominee_nid = 'NID must be 10, 13 or 17 digits.';
    return e;
  },
  paymentCore: function (f) {
    const e = {};
    V.amount(f.amount, e, 'amount');
    if (!f.payment_date) e.payment_date = 'Choose the payment date.'; else if (f.payment_date > TODAY) e.payment_date = 'Payment date cannot be in the future.';
    if (!f.method) e.method = 'Choose a payment method.';
    if (f.method && f.method !== 'Cash' && !String(f.reference || '').trim()) e.reference = 'Enter the transaction or cheque reference.';
    return e;
  },
  booking: function (f, ctx) {
    const e = {};
    if (!f.shareholder_id) e.shareholder_id = 'Select a shareholder.';
    const q = Number(f.quantity);
    if (!f.quantity || isNaN(q) || q < 1 || Math.floor(q) !== q) e.quantity = 'Enter a whole number of shares, at least 1.';
    else if (q > ctx.available) e.quantity = 'Only ' + ctx.available + ' share(s) are still available.';
    const p = Number(f.unit_price); if (!f.unit_price || isNaN(p) || p <= 0) e.unit_price = 'Enter the price per share.';
    const dsc = Number(f.discount || 0); if (isNaN(dsc) || dsc < 0) e.discount = 'Discount cannot be negative.'; else if (!e.quantity && !e.unit_price && dsc > q * p) e.discount = 'Discount cannot exceed the total value.';
    if (!f.booking_date) e.booking_date = 'Choose the booking date.'; else if (f.booking_date > TODAY) e.booking_date = 'Booking date cannot be in the future.';
    return e;
  },
  unit: function (f, ctx) {
    const e = {};
    if (!String(f.code || '').trim()) e.code = 'Enter the unit label, e.g. A-301.';
    else if (ctx.db.units.some(function (u) { return u.id !== ctx.id && u.code.toLowerCase() === f.code.trim().toLowerCase() && live(u); })) e.code = 'A unit with this label already exists.';
    if (!f.floor || isNaN(Number(f.floor)) || Number(f.floor) < 0) e.floor = 'Enter the floor number.';
    if (!f.size_sqft || Number(f.size_sqft) <= 0) e.size_sqft = 'Enter the size in sq ft.';
    if (f.status === 'Available' && f.shareholder_id) e.status = 'An assigned unit cannot be Available. Choose Assigned or clear the shareholder.';
    if (f.status !== 'Available' && !f.shareholder_id) e.shareholder_id = 'Assign a shareholder for this status.';
    return e;
  },
  schedule: function (rows, total, paidById) {
    const e = {};
    if (!rows.length) return { _: 'Add at least one installment.' };
    let s = 0;
    rows.forEach(function (r, i) {
      if (!r.due_date) e['d' + i] = 'Set a date.';
      const a = Number(r.amount); if (!r.amount || isNaN(a) || a <= 0) e['a' + i] = 'Enter an amount above zero.';
      else if (r.id && paidById && a < (paidById[r.id] || 0) - 0.005) e['a' + i] = 'Cannot be below the ' + fmtMoney(paidById[r.id]) + ' already paid.';
      s += a || 0;
    });
    if (Math.abs(s - total) > 0.005) e._ = 'Installments add up to ' + fmtMoney(s) + ' but the plan total is ' + fmtMoney(total) + '.';
    return e;
  },
  expense: function (f, ctx) {
    const e = {};
    if (!f.category) e.category = 'Choose a category.';
    if (!String(f.description || '').trim()) e.description = 'Add a short description.';
    V.amount(f.amount, e, 'amount');
    if (!f.expense_date) e.expense_date = 'Choose the date.'; else if (f.expense_date > TODAY) e.expense_date = 'Date cannot be in the future.';
    if (!f.method) e.method = 'Choose a payment method.';
    if (f.method && f.method !== 'Cash' && !String(f.reference || '').trim()) e.reference = 'Enter the transaction or cheque reference.';
    if (!f.contractor_id && !String(f.payee_name || '').trim()) e.payee_name = 'Choose a contractor/supplier or type the payee name.';
    return e;
  },
  contractor: function (f, rows) {
    const e = {};
    if (!String(f.name || '').trim()) e.name = 'Enter the contractor or supplier name.';
    if (f.phone && !V.phone(f.phone)) e.phone = 'Use a Bangladesh mobile number.';
    if (f.kind === 'Contractor') {
      if (!f.contract_value || Number(f.contract_value) <= 0) e.contract_value = 'Enter the contract value.';
      else { const se = V.schedule(rows, Number(f.contract_value)); if (V.hasErrors(se)) e.schedule = se._ || 'Check the installment rows.'; }
    }
    return e;
  },
  plan: function (f) {
    const e = {};
    if (!f.unit_id) e.unit_id = 'Select a unit.';
    if (!f.total_amount || Number(f.total_amount) <= 0) e.total_amount = 'Enter the total construction contribution.';
    return e;
  },
  planTotal: function (total, paid, reason) {
    const e = {}; const t = Number(total);
    if (!total || isNaN(t) || t <= 0) e.total = 'Enter an amount above zero.'; else if (t < paid - 0.005) e.total = 'The total cannot be lower than the ' + fmtMoney(paid) + ' already paid.';
    if (!String(reason || '').trim()) e.reason = 'Give a reason for the change.';
    return e;
  },
  document: function (f) {
    const e = {};
    if (!f.file) e.file = 'Choose a file to upload.';
    if (!f.related_type) e.related_type = 'Choose what this document belongs to.';
    else if (f.related_type !== 'project' && !f.related_id) e.related_id = 'Choose the record.';
    if (!f.doc_type) e.doc_type = 'Choose a document type.';
    return e;
  }
};

/* Build an equal-split schedule; the last row absorbs any rounding remainder. */
function buildSchedule(total, count, firstDate, everyMonths) {
  const n = Math.max(1, Math.floor(count) || 1), t = Number(total) || 0, each = Math.floor(t / n), rows = [];
  for (let i = 0; i < n; i++) rows.push({ key: uid('row'), due_date: addMonths(firstDate || TODAY, i * (everyMonths || 1)), amount: i === n - 1 ? roundMoney(t - each * (n - 1)) : each });
  return rows;
}
