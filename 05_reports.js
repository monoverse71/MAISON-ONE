/* ============================================================
   05 REPORTS + EXPORT — report definitions are data, so the same
   definitions can later drive server-side PDF / Excel generation.
   ============================================================ */
function inRange(d, f) { return (!f.from || d >= f.from) && (!f.to || d <= f.to); }
const REPORTS = [
  {
    id: 'shareholders', title: 'Shareholder Report', desc: 'Every shareholder with shares held, units and net financial position.', file: 'shareholder_report',
    statuses: ['Active', 'Inactive'], dateLabel: 'Registered',
    cols: [{ k: 'code', l: 'ID' }, { k: 'name', l: 'Name' }, { k: 'phone', l: 'Phone' }, { k: 'date', l: 'Registered', t: 'date' }, { k: 'shares', l: 'Shares', t: 'int', total: true }, { k: 'units', l: 'Units' }, { k: 'value', l: 'Share Value', t: 'money', total: true }, { k: 'paid', l: 'Share Paid', t: 'money', total: true }, { k: 'cons_paid', l: 'Constr. Paid', t: 'money', total: true }, { k: 'outstanding', l: 'Outstanding', t: 'money', total: true }, { k: 'status', l: 'Status', t: 'badge' }],
    build: function (db) { return db.shareholders.filter(live).map(function (s) { const c = Calc.shareholder(db, s); return { code: s.code, name: s.full_name, phone: s.phone, date: s.registration_date, shares: c.shares, units: c.units.map(function (u) { return u.code; }).join(', ') || '—', value: c.shareValue, paid: c.sharePaid, cons_paid: c.consPaid, outstanding: c.outstanding, status: s.status }; }); }
  },
  {
    id: 'sales', title: 'Share Sales Report', desc: 'All share bookings with value, discount and payment position.', file: 'share_sales_report', statuses: ['Paid', 'Partial', 'Unpaid'], dateLabel: 'Booking date',
    cols: [{ k: 'code', l: 'Booking' }, { k: 'date', l: 'Date', t: 'date' }, { k: 'name', l: 'Shareholder' }, { k: 'qty', l: 'Shares', t: 'int', total: true }, { k: 'price', l: 'Price / Share', t: 'money' }, { k: 'total', l: 'Total Value', t: 'money', total: true }, { k: 'discount', l: 'Discount', t: 'money', total: true }, { k: 'grand', l: 'Grand Total', t: 'money', total: true }, { k: 'paid', l: 'Paid', t: 'money', total: true }, { k: 'due', l: 'Due', t: 'money', total: true }, { k: 'status', l: 'Status', t: 'badge' }],
    build: function (db) { return db.share_bookings.filter(live).map(function (b) { const s = Calc.bookingSummary(db, b), sh = Calc.byId(db.shareholders, b.shareholder_id); return { code: b.code, date: b.booking_date, name: sh.full_name, qty: b.quantity, price: b.unit_price, total: s.total, discount: s.discount, grand: s.grand, paid: s.paid, due: s.due, status: s.status }; }).sort(byDateDesc('date')); }
  },
  {
    id: 'share_collection', title: 'Share Collection Report', desc: 'Every land-share payment received, including reversals.', file: 'share_collection_report', statuses: ['Posted', 'Reversed'], dateLabel: 'Payment date',
    cols: [{ k: 'receipt', l: 'Receipt' }, { k: 'date', l: 'Date', t: 'date' }, { k: 'name', l: 'Shareholder' }, { k: 'booking', l: 'Booking' }, { k: 'amount', l: 'Amount', t: 'money', total: true }, { k: 'method', l: 'Method' }, { k: 'ref', l: 'Reference' }, { k: 'type', l: 'Entry' }, { k: 'status', l: 'Status', t: 'badge' }],
    build: function (db) { return db.share_payments.filter(live).map(function (p) { const sh = Calc.byId(db.shareholders, p.shareholder_id), b = Calc.byId(db.share_bookings, p.booking_id); return { receipt: p.receipt_no, date: p.payment_date, name: sh.full_name, booking: b.code, amount: p.amount, method: p.method, ref: p.reference || '—', type: p.kind === 'reversal' ? 'Reversal' : 'Payment', status: p.status }; }).sort(byDateDesc('date')); }
  },
  {
    id: 'share_due', title: 'Share Due Report', desc: 'Bookings with an unpaid balance, largest due first.', file: 'share_due_report', statuses: ['Partial', 'Unpaid'], dateLabel: 'Booking date',
    cols: [{ k: 'code', l: 'Booking' }, { k: 'name', l: 'Shareholder' }, { k: 'phone', l: 'Phone' }, { k: 'date', l: 'Booked', t: 'date' }, { k: 'grand', l: 'Grand Total', t: 'money', total: true }, { k: 'paid', l: 'Paid', t: 'money', total: true }, { k: 'due', l: 'Due', t: 'money', total: true }, { k: 'last', l: 'Last Payment', t: 'date' }, { k: 'status', l: 'Status', t: 'badge' }],
    build: function (db) { return db.share_bookings.filter(live).map(function (b) { const s = Calc.bookingSummary(db, b), sh = Calc.byId(db.shareholders, b.shareholder_id), last = s.payments.filter(function (p) { return p.kind === 'payment'; }).map(function (p) { return p.payment_date; }).sort().pop(); return { code: b.code, name: sh.full_name, phone: sh.phone, date: b.booking_date, grand: s.grand, paid: s.paid, due: s.due, last: last || '', status: s.status }; }).filter(function (r) { return r.due > 0.004; }).sort(function (a, b) { return b.due - a.due; }); }
  },
  {
    id: 'cons_contribution', title: 'Construction Contribution Report', desc: 'Total contribution, paid, due and progress for every unit.', file: 'construction_contribution_report', statuses: ['Completed', 'In Progress', 'Not Started', 'Overpaid'], dateLabel: 'Contribution set on',
    cols: [{ k: 'code', l: 'Plan' }, { k: 'unit', l: 'Unit' }, { k: 'name', l: 'Shareholder' }, { k: 'total', l: 'Total Contribution', t: 'money', total: true }, { k: 'paid', l: 'Paid', t: 'money', total: true }, { k: 'due', l: 'Due', t: 'money', total: true }, { k: 'pct', l: 'Progress' }, { k: 'count', l: 'Payments', t: 'int', total: true }, { k: 'last', l: 'Last Payment', t: 'date' }, { k: 'status', l: 'Status', t: 'badge' }],
    build: function (db) { return db.construction_plans.filter(function (p) { return live(p) && p.status !== 'Cancelled'; }).map(function (p) { const c = Calc.plan(db, p), u = Calc.byId(db.units, p.unit_id), sh = Calc.byId(db.shareholders, p.shareholder_id); return { code: p.code, date: p.created_at.slice(0, 10), unit: u.code, name: sh.full_name, total: c.total, paid: c.paid, due: c.due, pct: fmtPct(c.pctExact), count: c.count, last: c.last, status: c.status }; }); }
  },
  {
    id: 'cons_collection', title: 'Construction Collection Report', desc: 'Every construction contribution payment received, including reversals.', file: 'construction_collection_report', statuses: ['Posted', 'Reversed'], dateLabel: 'Payment date',
    cols: [{ k: 'receipt', l: 'Receipt' }, { k: 'date', l: 'Date', t: 'date' }, { k: 'name', l: 'Shareholder' }, { k: 'unit', l: 'Unit' }, { k: 'amount', l: 'Amount', t: 'money', total: true }, { k: 'method', l: 'Method' }, { k: 'ref', l: 'Reference' }, { k: 'type', l: 'Entry' }, { k: 'status', l: 'Status', t: 'badge' }],
    build: function (db) { return db.construction_payments.filter(live).map(function (p) { const sh = Calc.byId(db.shareholders, p.shareholder_id), u = Calc.byId(db.units, p.unit_id); return { receipt: p.receipt_no, date: p.payment_date, name: sh.full_name, unit: u.code, amount: p.amount, method: p.method, ref: p.reference || '—', type: p.kind === 'reversal' ? 'Reversal' : 'Payment', status: p.status }; }).sort(byDateDesc('date')); }
  },
  {
    id: 'cons_due', title: 'Construction Due Report', desc: 'Units that still owe construction contribution, largest balance first.', file: 'construction_due_report', statuses: ['In Progress', 'Not Started'], dateLabel: 'Contribution set on',
    cols: [{ k: 'unit', l: 'Unit' }, { k: 'name', l: 'Shareholder' }, { k: 'phone', l: 'Phone' }, { k: 'total', l: 'Total Contribution', t: 'money', total: true }, { k: 'paid', l: 'Paid', t: 'money', total: true }, { k: 'due', l: 'Due', t: 'money', total: true }, { k: 'pct', l: 'Progress' }, { k: 'last', l: 'Last Payment', t: 'date' }, { k: 'status', l: 'Status', t: 'badge' }],
    build: function (db) { return db.construction_plans.filter(function (p) { return live(p) && p.status !== 'Cancelled'; }).map(function (p) { const c = Calc.plan(db, p), u = Calc.byId(db.units, p.unit_id), sh = Calc.byId(db.shareholders, p.shareholder_id); return { unit: u.code, name: sh.full_name, phone: sh.phone, date: p.created_at.slice(0, 10), total: c.total, paid: c.paid, due: c.due, pct: fmtPct(c.pctExact), last: c.last, status: c.status }; }).filter(function (r) { return r.due > 0.004; }).sort(function (a, b) { return b.due - a.due; }); }
  },
  {
    id: 'expenses', title: 'Project Expense Report', desc: 'All money paid out by the project, with approval status.', file: 'project_expense_report', statuses: ['Approved', 'Pending', 'Rejected'], dateLabel: 'Expense date',
    cols: [{ k: 'code', l: 'Expense' }, { k: 'date', l: 'Date', t: 'date' }, { k: 'category', l: 'Category' }, { k: 'payee', l: 'Payee' }, { k: 'desc', l: 'Description' }, { k: 'amount', l: 'Amount', t: 'money', total: true }, { k: 'method', l: 'Method' }, { k: 'entry', l: 'Entry' }, { k: 'status', l: 'Approval', t: 'badge' }],
    build: function (db) { return db.project_expenses.filter(live).map(function (e) { return { code: e.code, date: e.expense_date, category: e.category, payee: e.payee_name || '—', desc: e.description, amount: e.approval_status === 'Rejected' ? 0 : e.amount, method: e.method, entry: e.kind === 'reversal' ? 'Reversal' : e.status === 'Reversed' ? 'Reversed' : 'Expense', status: e.approval_status }; }).sort(byDateDesc('date')); }
  },
  {
    id: 'contractors', title: 'Contractor Payment Report', desc: 'Contract installments with paid, due and upcoming amounts per contractor.', file: 'contractor_payment_report', statuses: ['Paid', 'Overdue', 'Pending', 'Upcoming', 'Partial'], dateLabel: 'Installment due date',
    cols: [{ k: 'name', l: 'Contractor' }, { k: 'trade', l: 'Trade' }, { k: 'no', l: 'Inst. #', t: 'int' }, { k: 'date', l: 'Due Date', t: 'date' }, { k: 'amount', l: 'Amount', t: 'money', total: true }, { k: 'paid', l: 'Paid', t: 'money', total: true }, { k: 'due', l: 'Due', t: 'money', total: true }, { k: 'status', l: 'Status', t: 'badge' }],
    build: function (db) { const out = []; db.contractors.filter(function (c) { return live(c) && c.contract_value; }).forEach(function (c) { Calc.contractor(db, c).installments.forEach(function (r) { out.push({ name: c.name, trade: c.trade, no: r.no, date: r.due_date, amount: r.amount, paid: r.paid, due: r.due, status: r.status }); }); }); return out.sort(function (a, b) { return cmpStr(a.name, b.name) || a.no - b.no; }); }
  },
  {
    id: 'overall', title: 'Overall Financial Summary', desc: 'Money in, money out and outstanding receivables for the selected period.', file: 'overall_financial_summary', statuses: [], dateLabel: 'Period', noStatus: true,
    cols: [{ k: 'section', l: 'Section' }, { k: 'item', l: 'Item' }, { k: 'amount', l: 'Amount', t: 'money' }],
    build: function (db, f) {
      const sp = sum(db.share_payments.filter(function (p) { return live(p) && inRange(p.payment_date, f); }), function (p) { return p.amount; });
      const cp = sum(db.construction_payments.filter(function (p) { return live(p) && inRange(p.payment_date, f); }), function (p) { return p.amount; });
      const ex = db.project_expenses.filter(function (e) { return Calc.expenseCounts(e) && inRange(e.expense_date, f); });
      const contractorOut = sum(ex.filter(function (e) { return e.category === 'Contractor Payment' || e.contractor_id; }), function (e) { return e.amount; }), all = sum(ex, function (e) { return e.amount; }), d = Calc.dashboard(db);
      return [
        { section: 'Money in', item: 'Land share collection', amount: sp }, { section: 'Money in', item: 'Customer construction contributions', amount: cp }, { section: 'Money in', item: 'Total money in', amount: roundMoney(sp + cp) },
        { section: 'Money out', item: 'Contractor and supplier payments', amount: contractorOut }, { section: 'Money out', item: 'Other project expenses', amount: roundMoney(all - contractorOut) }, { section: 'Money out', item: 'Total money out', amount: all },
        { section: 'Net', item: 'Net cash movement in period', amount: roundMoney(sp + cp - all) },
        { section: 'Outstanding (as of today)', item: 'Share value receivable', amount: d.shareDue }, { section: 'Outstanding (as of today)', item: 'Construction contribution receivable', amount: d.consDue }, { section: 'Outstanding (as of today)', item: 'Total receivables', amount: d.receivables },
        { section: 'Position (as of today)', item: 'Available project fund', amount: d.fund }
      ];
    }
  }
];

function runReport(report, db, f) {
  let rows = report.build(db, f);
  const q = (f.q || '').trim().toLowerCase();
  if (report.id !== 'overall') {
    rows = rows.filter(function (r) { return (!r.date || inRange(r.date, f)) && (!f.status || r.status === f.status) && (!q || Object.keys(r).some(function (k) { return String(r[k]).toLowerCase().indexOf(q) >= 0; })); });
  }
  const totals = {};
  report.cols.forEach(function (c) { if (c.total) totals[c.k] = sum(rows, function (r) { return r[c.k]; }); });
  return { rows: rows, totals: totals };
}
function formatCell(col, v) { if (v === '' || v == null) return '—'; if (col.t === 'money') return fmtMoney(v); if (col.t === 'date') return fmtDate(v); return String(v); }

/* Export boundary. Today it builds the file content in the browser; later this calls a server function that returns a real PDF/XLSX. */
const Exporter = {
  csv: function (report, rows, totals) {
    const lines = [report.cols.map(function (c) { return csvEscape(c.l); }).join(',')];
    rows.forEach(function (r) { lines.push(report.cols.map(function (c) { return csvEscape(c.t === 'money' || c.t === 'int' ? r[c.k] : formatCell(c, r[c.k])); }).join(',')); });
    if (Object.keys(totals).length) lines.push(report.cols.map(function (c, i) { return csvEscape(i === 0 ? 'TOTAL' : totals[c.k] != null ? totals[c.k] : ''); }).join(','));
    return lines.join('\n');
  },
  build: function (report, result, format, f) {
    const stamp = TODAY, meta = ['Apon Niketon Holdings', report.title, 'Generated ' + stamp, 'Period: ' + (f.from || 'start') + ' to ' + (f.to || 'today')];
    if (format === 'csv') return { filename: report.file + '_' + stamp + '.csv', mime: 'text/csv', body: Exporter.csv(report, result.rows, result.totals), note: 'CSV opens in Excel and Google Sheets.' };
    if (format === 'xlsx') return { filename: report.file + '_' + stamp + '.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', body: Exporter.csv(report, result.rows, result.totals), note: 'Preview of the sheet contents. A server function will produce the formatted .xlsx workbook.' };
    return { filename: report.file + '_' + stamp + '.pdf', mime: 'application/pdf', body: meta.join('\n') + '\n\n' + Exporter.csv(report, result.rows, result.totals).replace(/,/g, '  |  '), note: 'Preview of the report text. A server function will produce the branded PDF with letterhead and page numbers.' };
  }
};
