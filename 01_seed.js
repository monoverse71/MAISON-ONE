/* ============================================================
   01 SEED — DEMO DATA ONLY. Every row carries _demo:true.
   All names, phones, NIDs and amounts are fictional.
   Table names + column names map 1:1 to the future PostgreSQL schema.
   ============================================================ */
function createSeed() {
  const T = {
    users: [], shareholders: [], nominees: [], units: [], share_bookings: [], share_payments: [],
    construction_plans: [], construction_payments: [],
    contractors: [], contract_installments: [], project_expenses: [], documents: [], audit_logs: [], settings: []
  };
  const D = { _demo: true, archived_at: null };
  const id = function (p, n) { return p + '_' + pad(n, 4); };
  const clampPast = function (d) { return d > TODAY ? TODAY : d; };

  T.users.push(
    { id: 'usr_admin', name: 'Demo Admin', title: 'Managing Director', role: 'Admin', email: 'admin@demo.invalid', _demo: true },
    { id: 'usr_acct', name: 'Demo Accountant', title: 'Accounts Officer', role: 'Accountant', email: 'accounts@demo.invalid', _demo: true },
    { id: 'usr_view', name: 'Demo Auditor', title: 'External Auditor', role: 'Viewer', email: 'auditor@demo.invalid', _demo: true }
  );
  T.settings.push({ id: 'settings', project_name: APP_CONFIG.projectName, company_name: APP_CONFIG.companyName, total_shares: APP_CONFIG.totalShares, default_share_price: APP_CONFIG.defaultSharePrice, currency: 'BDT', _demo: true });

  /* ---- shareholders ---- */
  const SH = [
    ['Rahim Ahmed', '01711-204501', 'Businessman', 'Managing Director, Ahmed Traders', '1987415263', 'House 14, Road 7, Block C, Bashundhara R/A, Dhaka', -9, 'Active', ['Salma Ahmed', 'Spouse', '01711-204599']],
    ['Dr. Nusrat Jahan', '01819-330122', 'Physician', 'Consultant, Medicine', '1990263518', 'Flat 6B, Green Road, Dhanmondi, Dhaka', -9, 'Active', ['Arif Hasan', 'Spouse', '01819-330190']],
    ['Kamal Hossain', '01712-550874', 'Government Officer', 'Deputy Secretary', '1975188402', '22 Circuit House Road, Ramna, Dhaka', -8, 'Active', ['Rashida Hossain', 'Spouse', '01712-550880']],
    ['Farhana Yeasmin', '01915-782340', 'Banker', 'Senior Principal Officer', '1988742019', 'House 5, Sector 11, Uttara, Dhaka', -7, 'Active', ['Yeasin Ali', 'Brother', '01915-782388']],
    ['Mizanur Rahman', '01611-908276', 'Engineer', 'Deputy General Manager', '1982630947', 'Plot 31, Block D, Banani, Dhaka', -7, 'Active', ['Shamima Rahman', 'Spouse', '01611-908270']],
    ['Sabrina Akter', '01717-664120', 'University Lecturer', 'Assistant Professor', '1992551803', 'Shantinagar, Paltan, Dhaka', -6, 'Active', ['Mahbub Akter', 'Father', '01717-664100']],
    ['Tanvir Chowdhury', '01818-227431', 'Software Consultant', 'Solutions Architect', '1991374625', 'House 9, Road 2, Mohammadpur, Dhaka', -5, 'Active', ['Lamia Chowdhury', 'Spouse', '01818-227499']],
    ['Shirin Sultana', '01713-149852', 'Garment Entrepreneur', 'Proprietor, Sultana Apparels', '1979820364', 'Section 10, Mirpur, Dhaka', -5, 'Active', ['Rezaul Karim', 'Son', '01713-149800']],
    ['Abdul Karim', '01716-081937', 'Retired Banker', 'Former Executive Vice President', '1958403718', 'House 3, Lake Circus, Kalabagan, Dhaka', -9, 'Active', ['Nazma Karim', 'Spouse', '01716-081900']],
    ['Mahmudul Hasan', '01912-457086', 'Importer', 'Director, MH Global Trading', '1984275196', 'Agrabad C/A, Chattogram', -3, 'Active', ['Tahmina Hasan', 'Spouse', '01912-457000']],
    ['Rokeya Begum', '01814-390215', 'Business Owner', 'Proprietor, Begum Fashion House', '1981563270', 'Zindabazar, Sylhet', -2, 'Active', ['Sadiq Ullah', 'Brother', '01814-390200']],
    ['Jahid Islam', '01311-762048', 'Contractor', 'Owner, Islam Enterprise', '1976194053', 'Tongi, Gazipur', -10, 'Inactive', ['Halima Islam', 'Spouse', '01311-762000']]
  ];
  SH.forEach(function (s, i) {
    const n = i + 1, shId = id('sh', n), code = 'SH-' + pad(n, 4);
    const nidF = id('doc', 1000 + n * 2), nidB = id('doc', 1001 + n * 2);
    T.shareholders.push(Object.assign({
      id: shId, code: code, full_name: s[0], phone: s[1], email: s[0].toLowerCase().replace(/^dr\.\s*/, '').replace(/[^a-z]+/g, '.') + '@example.invalid',
      profession: s[2], designation: s[3], nid: s[4], address: s[5], photo_url: null, photo_doc_id: id('doc', 500 + n), nid_front_doc_id: nidF, nid_back_doc_id: nidB,
      registration_date: monthDate(s[6], 4), status: s[7], remarks: n === 12 ? 'Account on hold pending document verification.' : '', created_by: 'usr_admin', created_at: monthDate(s[6], 4) + 'T09:00:00'
    }, D));
    T.nominees.push(Object.assign({ id: id('nom', n), shareholder_id: shId, name: s[8][0], relation: s[8][1], phone: s[8][2], nid: String(2000000000 + n * 7311), address: s[5] }, D));
    T.documents.push(
      Object.assign({ id: nidF, code: 'DOC-' + pad(1000 + n * 2, 4), doc_type: 'NID', related_type: 'shareholder', related_id: shId, file_name: 'nid_front_' + code + '.jpg', file_type: 'image/jpeg', size_bytes: 412000 + n * 3100, storage_path: 'documents/' + shId + '/nid_front.jpg', uploaded_at: monthDate(s[6], 4) + 'T09:05:00', uploaded_by: 'usr_admin', description: 'NID front side', slot: 'nid_front' }, D),
      Object.assign({ id: nidB, code: 'DOC-' + pad(1001 + n * 2, 4), doc_type: 'NID', related_type: 'shareholder', related_id: shId, file_name: 'nid_back_' + code + '.jpg', file_type: 'image/jpeg', size_bytes: 398000 + n * 2700, storage_path: 'documents/' + shId + '/nid_back.jpg', uploaded_at: monthDate(s[6], 4) + 'T09:06:00', uploaded_by: 'usr_admin', description: 'NID back side', slot: 'nid_back' }, D)
    );
  });
  T.shareholders.forEach(function (s, i) {
    const n = i + 1, nom = T.nominees[i];
    const mk = function (idn, doc_type, slot, relType, relId, fname, desc) { return Object.assign({ id: id('doc', idn), code: 'DOC-' + pad(idn, 4), doc_type: doc_type, slot: slot, related_type: relType, related_id: relId, file_name: fname, file_type: 'image/jpeg', size_bytes: 180000 + (idn * 37) % 90000, storage_path: 'documents/' + relId + '/' + slot + '.jpg', uploaded_at: s.registration_date + 'T09:10:00', uploaded_by: 'usr_admin', description: desc }, D); };
    T.documents.push(mk(500 + n, 'Photo', 'photo', 'shareholder', s.id, 'photo_' + s.code + '.jpg', 'Profile photo'));
    nom.photo_doc_id = id('doc', 5000 + n * 3); nom.nid_front_doc_id = id('doc', 5001 + n * 3); nom.nid_back_doc_id = id('doc', 5002 + n * 3);
    T.documents.push(mk(5000 + n * 3, 'Photo', 'photo', 'nominee', nom.id, 'nominee_photo_' + s.code + '.jpg', 'Nominee photo'), mk(5001 + n * 3, 'NID', 'nid_front', 'nominee', nom.id, 'nominee_nid_front_' + s.code + '.jpg', 'Nominee NID front side'), mk(5002 + n * 3, 'NID', 'nid_back', 'nominee', nom.id, 'nominee_nid_back_' + s.code + '.jpg', 'Nominee NID back side'));
  });
  const shId = function (n) { return id('sh', n); };

  /* ---- units ---- */
  const U = [
    ['A-101', 1, 1450, 'Handed Over', 9, -3], ['A-201', 2, 1450, 'Under Construction', 2, -7], ['A-301', 3, 1450, 'Under Construction', 1, -8], ['A-401', 4, 1450, 'Under Construction', 4, -6],
    ['A-501', 5, 1450, 'Assigned', 5, -5], ['A-601', 6, 1450, 'Assigned', 8, -4], ['B-102', 1, 1250, 'Available', 0, 0], ['B-202', 2, 1250, 'Assigned', 6, -5],
    ['B-302', 3, 1250, 'Under Construction', 3, -6], ['B-402', 4, 1250, 'Reserved', 7, -3], ['B-502', 5, 1250, 'Under Construction', 1, -6], ['B-602', 6, 1250, 'Available', 0, 0]
  ];
  U.forEach(function (u, i) {
    T.units.push(Object.assign({
      id: id('unit', i + 1), code: u[0], floor: u[1], unit_no: u[0].split('-')[1], size_sqft: u[2], status: u[3], shareholder_id: u[4] ? shId(u[4]) : null,
      assigned_date: u[4] ? monthDate(u[5], 12) : null, remarks: u[3] === 'Reserved' ? 'Reserved against pending share payment.' : ''
    }, D));
  });
  const unitId = function (code) { return T.units.filter(function (u) { return u.code === code; })[0].id; };

  /* ---- share bookings + payments ---- */
  let spN = 0;
  const BK = [
    [1, 3, 950000, 50000, -9, 5, 'Board Member', [[1000000, -9, 5, 'Bank Transfer', 'TXN-BRAC-84201'], [800000, -7, 12, 'Cheque', 'CHQ-5540121'], [1000000, -5, 8, 'Bank Transfer', 'TXN-BRAC-91177']]],
    [1, 2, 1000000, 0, -4, 3, 'Direct', [[800000, -4, 3, 'Bank Transfer', 'TXN-BRAC-99310'], [400000, -2, 15, 'bKash', 'BK7H29QX1L']]],
    [2, 2, 950000, 0, -9, 12, 'Md. Sohel Rana', [[1000000, -9, 12, 'Bank Transfer', 'TXN-DBBL-20418'], [900000, -6, 10, 'Cheque', 'CHQ-3320981']]],
    [3, 2, 950000, 25000, -8, 3, 'Direct', [[1200000, -8, 3, 'Bank Transfer', 'TXN-CITY-77120'], [300000, -5, 20, 'Cash', '']]],
    [4, 3, 975000, 75000, -7, 9, 'Md. Sohel Rana', [[1500000, -7, 9, 'Cheque', 'CHQ-8821003'], [1350000, -4, 18, 'Bank Transfer', 'TXN-EBL-45102']]],
    [5, 2, 975000, 0, -7, 20, 'Direct', [[600000, -7, 20, 'Bank Transfer', 'TXN-SCB-31054'], [600000, -5, 5, 'Cash', ''], [300000, -3, 11, 'bKash', 'BK3M81ZP0A']]],
    [6, 1, 1000000, 0, -6, 2, 'Board Member', [[1000000, -6, 2, 'Bank Transfer', 'TXN-BRAC-60233']]],
    [7, 2, 1000000, 50000, -5, 14, 'Direct', [[500000, -5, 14, 'bKash', 'BK9Q02WD5E']]],
    [8, 3, 1000000, 100000, -5, 22, 'Nasrin Sultana', [[2000000, -5, 22, 'Cheque', 'CHQ-1109457'], [900000, -2, 7, 'Bank Transfer', 'TXN-DBBL-50876']]],
    [9, 2, 950000, 0, -9, 20, 'Board Member', [[1900000, -9, 20, 'Bank Transfer', 'TXN-CITY-12009']]],
    [10, 4, 1000000, 200000, -3, 6, 'Md. Sohel Rana', [[1000000, -3, 6, 'Bank Transfer', 'TXN-EBL-70311'], [1000000, -1, 9, 'Cheque', 'CHQ-6670218']]],
    [11, 1, 1050000, 0, -2, 4, 'Direct', [[300000, -2, 4, 'bKash', 'BK1X55MK8Z']]],
    [3, 1, 1050000, 0, -1, 15, 'Direct', []],
    [12, 1, 950000, 0, -10, 8, 'Direct', [[500000, -10, 8, 'Bank Transfer', 'TXN-SCB-10442']]]
  ];
  BK.forEach(function (b, i) {
    const n = i + 1, bid = id('bk', n), bookingDate = monthDate(b[4], b[5]);
    T.share_bookings.push(Object.assign({
      id: bid, code: 'BK-' + pad(n, 4), shareholder_id: shId(b[0]), quantity: b[1], unit_price: b[2], discount: b[3], booking_date: bookingDate,
      reference_person: b[6], remarks: '', status: 'Active', created_by: 'usr_admin', created_at: bookingDate + 'T10:00:00'
    }, D));
    T.documents.push(Object.assign({ id: id('doc', 2000 + n), code: 'DOC-' + pad(2000 + n, 4), doc_type: 'Share Agreement', related_type: 'booking', related_id: bid, file_name: 'share_agreement_BK-' + pad(n, 4) + '.pdf', file_type: 'application/pdf', size_bytes: 880000 + n * 9000, storage_path: 'documents/' + bid + '/agreement.pdf', uploaded_at: bookingDate + 'T11:00:00', uploaded_by: 'usr_admin', description: 'Signed share purchase agreement' }, D));
    b[7].forEach(function (p) {
      spN++;
      const pd = clampPast(monthDate(p[1], p[2]));
      T.share_payments.push(Object.assign({
        id: id('spay', spN), code: 'SP-' + pad(spN, 4), receipt_no: 'RCT-S-' + pad(spN, 4), booking_id: bid, shareholder_id: shId(b[0]), amount: p[0], payment_date: pd,
        method: p[3], reference: p[4], note: '', attachment_doc_id: null, kind: 'payment', reversal_of: null, reversal_reason: null, reversed_by_id: null, status: 'Posted',
        created_by: 'usr_acct', created_at: pd + 'T14:20:00', client_request_id: null
      }, D));
    });
  });

  /* ---- construction plans (customer contributions) ----
     One total per unit. The customer pays any amount on any date; there is no installment schedule. */
  let cpN = 0;
  const PL = [
    ['A-301', 1, 2000000, -8, [[50000, -6, 12, 'Cash'], [120000, -5, 3, 'bKash'], [30000, -4, 20, 'Cash'], [75000, -2, 9, 'Bank Transfer']]],
    ['B-502', 1, 2600000, -6, [[300000, -5, 10, 'Bank Transfer'], [45000, -3, 22, 'Cash'], [155000, -1, 6, 'Cheque']]],
    ['A-201', 2, 2800000, -7, [[500000, -6, 8, 'Cheque'], [250000, -4, 14, 'Bank Transfer'], [60000, -2, 25, 'bKash'], [90000, -1, 11, 'Cash']]],
    ['B-302', 3, 2400000, -6, [[200000, -5, 15, 'Bank Transfer'], [35000, -3, 4, 'Cash']]],
    ['A-401', 4, 3000000, -6, [[750000, -5, 18, 'Cheque'], [400000, -3, 2, 'Bank Transfer'], [125000, -1, 20, 'bKash']]],
    ['A-501', 5, 2700000, -5, [[100000, -4, 7, 'Cash']]],
    ['B-202', 6, 2200000, -5, []],
    ['A-601', 8, 3200000, -4, [[600000, -3, 12, 'Bank Transfer'], [80000, -2, 5, 'Cash'], [220000, -1, 19, 'Cheque']]],
    ['A-101', 9, 2500000, -9, [[1000000, -8, 10, 'Bank Transfer'], [500000, -6, 16, 'Cheque'], [350000, -5, 2, 'Bank Transfer'], [400000, -3, 14, 'Bank Transfer'], [250000, -2, 8, 'Cheque']]]
  ];
  PL.forEach(function (p, i) {
    const n = i + 1, planId = id('cplan', n), uId = unitId(p[0]);
    T.construction_plans.push(Object.assign({ id: planId, code: 'CP-' + pad(n, 4), unit_id: uId, shareholder_id: shId(p[1]), total_amount: p[2], status: 'Active', remarks: '', created_by: 'usr_admin', created_at: monthDate(p[3], 2) + 'T10:00:00' }, D));
    T.documents.push(Object.assign({ id: id('doc', 3000 + n), code: 'DOC-' + pad(3000 + n, 4), doc_type: 'Construction Agreement', related_type: 'unit', related_id: uId, file_name: 'construction_agreement_' + p[0] + '.pdf', file_type: 'application/pdf', size_bytes: 1020000 + n * 7000, storage_path: 'documents/' + uId + '/construction_agreement.pdf', uploaded_at: monthDate(p[3], 2) + 'T10:30:00', uploaded_by: 'usr_admin', description: 'Flat construction contribution agreement' }, D));
    p[4].forEach(function (x) {
      cpN++;
      const pd = clampPast(monthDate(x[1], x[2])), m = x[3];
      T.construction_payments.push(Object.assign({
        id: id('cpay', cpN), code: 'CN-' + pad(cpN, 4), receipt_no: 'RCT-C-' + pad(cpN, 4), plan_id: planId, unit_id: uId, shareholder_id: shId(p[1]),
        amount: x[0], payment_date: pd, method: m, reference: m === 'Cash' ? '' : m === 'bKash' ? 'BK' + (7 + cpN) + 'X' + (2900 + cpN * 13) : m === 'Cheque' ? 'CHQ-' + (600000 + cpN * 731) : 'TXN-' + (48000 + cpN * 37), note: '', attachment_doc_id: null,
        kind: 'payment', reversal_of: null, reversal_reason: null, reversed_by_id: null, status: 'Posted', created_by: 'usr_acct', created_at: pd + 'T15:10:00', client_request_id: null
      }, D));
    });
  });

  /* ---- contractors / suppliers ---- */
  const CT = [
    ['ABC Construction', 'Contractor', 'Structural / RCC', '01712-880011', 5000000, [[-4, 10], [-2, 10], [1, 5], [3, 5], [5, 5]], 2],
    ['Rupayan Electricals', 'Contractor', 'Electrical', '01715-330900', 1800000, [[-3, 20], [1, 10], [4, 10]], 1],
    ['Bashundhara Plumbing Works', 'Contractor', 'Plumbing / Sanitary', '01914-662310', 1200000, [[-2, 18], [1, 18], [3, 18], [5, 18]], 1],
    ['Metro Lift Solutions', 'Contractor', 'Lift', '01811-204477', 2400000, [[-1, 10], [4, 10]], 1],
    ['BSRM Steel Depot', 'Supplier', 'Steel', '01713-909120', null, [], 0],
    ['Shah Cement Traders', 'Supplier', 'Cement', '01711-450098', null, [], 0],
    ['Akij Tiles Gallery', 'Supplier', 'Tiles', '01919-731002', null, [], 0],
    ['Rahman Transport Services', 'Supplier', 'Transportation', '01712-118530', null, [], 0]
  ];
  let ciN = 0;
  CT.forEach(function (c, i) {
    const n = i + 1, cid = id('ctr', n), each = c[4] ? Math.floor(c[4] / c[5].length) : 0;
    T.contractors.push(Object.assign({ id: cid, code: 'CTR-' + pad(n, 3), name: c[0], kind: c[1], trade: c[2], phone: c[3], contract_value: c[4], contract_date: c[4] ? monthDate(c[5][0][0] - 1, 2) : null, status: 'Active', created_by: 'usr_admin', created_at: monthDate(-6, 2) + 'T09:00:00' }, D));
    c[5].forEach(function (d, k) {
      ciN++;
      T.contract_installments.push(Object.assign({ id: id('cti', ciN), contractor_id: cid, no: k + 1, due_date: monthDate(d[0], d[1]), amount: k === c[5].length - 1 ? c[4] - each * (c[5].length - 1) : each }, D));
    });
  });
  const ctr = function (n) { return id('ctr', n); };
  const ctInst = function (cn, no) { return T.contract_installments.filter(function (x) { return x.contractor_id === ctr(cn) && x.no === no; })[0]; };

  /* ---- project expenses (money out) ---- */
  const EX = [
    [-5, 10, 'Cement', 6, 'Cement supply, 1,300 bags (foundation pour)', 650000, 'Bank Transfer', 'TXN-BRAC-31002', 'Approved'],
    [-5, 20, 'Steel', 5, 'MS rod 12mm / 16mm, 7.2 MT', 1420000, 'Cheque', 'CHQ-7100244', 'Approved'],
    [-4, 10, 'Contractor Payment', 1, 'ABC Construction, installment 1 (RCC frame)', 1000000, 'Bank Transfer', 'TXN-BRAC-40118', 'Approved', [1, 1]],
    [-4, 18, 'Labor', null, 'Site labor wages, weekly settlement', 320000, 'Cash', '', 'Approved'],
    [-3, 7, 'Cement', 6, 'Cement supply, 1,000 bags (columns)', 480000, 'Bank Transfer', 'TXN-BRAC-45120', 'Approved'],
    [-3, 20, 'Electrical', 2, 'Rupayan Electricals, installment 1 (conduit & wiring)', 600000, 'Bank Transfer', 'TXN-BRAC-46990', 'Approved', [2, 1]],
    [-3, 25, 'Government / Approval', null, 'Plan approval and utility connection fees', 275000, 'Bank Transfer', 'TXN-BRAC-47713', 'Approved'],
    [-2, 10, 'Contractor Payment', 1, 'ABC Construction, installment 2 (slab casting)', 1000000, 'Bank Transfer', 'TXN-BRAC-52034', 'Approved', [1, 2]],
    [-2, 14, 'Steel', 5, 'MS rod 20mm, 6 MT', 960000, 'Cheque', 'CHQ-7100301', 'Approved'],
    [-2, 18, 'Plumbing', 3, 'Bashundhara Plumbing Works, installment 1', 300000, 'Bank Transfer', 'TXN-BRAC-53780', 'Approved', [3, 1]],
    [-2, 22, 'Transportation', 8, 'Material haulage, 14 trips', 85000, 'Cash', '', 'Approved'],
    [-1, 10, 'Lift', 4, 'Metro Lift Solutions, advance (2 x 8-person lifts)', 1200000, 'Bank Transfer', 'TXN-BRAC-60119', 'Approved', [4, 1]],
    [-1, 16, 'Tiles', 7, 'Floor tile advance, common areas', 540000, 'Cheque', 'CHQ-7100377', 'Approved'],
    [-1, 24, 'Engineering', null, 'Structural design review fee', 150000, 'Bank Transfer', 'TXN-BRAC-62210', 'Approved'],
    [0, 3, 'Labor', null, 'Site labor wages, weekly settlement', 360000, 'Cash', '', 'Approved'],
    [0, 12, 'Cement', 6, 'Cement supply, 800 bags (brick work)', 390000, 'Bank Transfer', 'TXN-BRAC-68807', 'Pending'],
    [0, 17, 'Interior', null, 'Sample flat interior mock-up', 210000, 'Cheque', 'CHQ-7100410', 'Pending'],
    [0, 20, 'Generator', null, 'Standby generator advance (250 kVA)', 450000, 'Bank Transfer', 'TXN-BRAC-70455', 'Pending'],
    [-1, 5, 'Electrical', null, 'Electrical fittings bill (duplicate of earlier invoice)', 65000, 'Cash', '', 'Rejected']
  ];
  EX.forEach(function (e, i) {
    const n = i + 1, ed = clampPast(monthDate(e[0], e[1])), eid = id('exp', n), inst = e[9] ? ctInst(e[9][0], e[9][1]) : null;
    if (e[3] !== null && !inst) { /* supplier purchase, no contract */ }
    T.project_expenses.push(Object.assign({
      id: eid, code: 'EX-' + pad(n, 4), expense_date: ed, category: e[2], contractor_id: e[3] ? ctr(e[3]) : null, payee_name: e[3] ? T.contractors[e[3] - 1].name : '', contract_installment_id: inst ? inst.id : null,
      description: e[4], amount: e[5], method: e[6], reference: e[7], attachment_doc_id: null, approval_status: e[8], approved_by: e[8] === 'Pending' ? null : 'usr_admin', paid_by: 'usr_acct', remarks: e[8] === 'Rejected' ? 'Rejected by MD: duplicate invoice.' : '',
      kind: 'expense', reversal_of: null, reversal_reason: null, reversed_by_id: null, status: 'Posted', created_by: 'usr_acct', created_at: ed + 'T16:00:00', client_request_id: null
    }, D));
    if (n % 3 === 1) T.documents.push(Object.assign({ id: id('doc', 4000 + n), code: 'DOC-' + pad(4000 + n, 4), doc_type: 'Bill / Invoice', related_type: 'expense', related_id: eid, file_name: 'invoice_EX-' + pad(n, 4) + '.pdf', file_type: 'application/pdf', size_bytes: 210000 + n * 5000, storage_path: 'documents/' + eid + '/invoice.pdf', uploaded_at: ed + 'T16:10:00', uploaded_by: 'usr_acct', description: 'Supplier / contractor invoice' }, D));
  });

  /* ---- audit log (derived from the seed records) ---- */
  let auN = 0;
  const au = function (at, user, action, type, ent, summary, shareholder) {
    auN++;
    T.audit_logs.push({ id: id('aud', auN), at: at, user_id: user, user_name: user === 'usr_admin' ? 'Demo Admin' : 'Demo Accountant', role: user === 'usr_admin' ? 'Admin' : 'Accountant', action: action, entity_type: type, entity_id: ent, summary: summary, shareholder_id: shareholder || null, reason: null, before: null, after: null, _demo: true });
  };
  T.shareholders.forEach(function (s) { au(s.created_at, 'usr_admin', 'Created shareholder', 'shareholder', s.id, 'Created shareholder ' + s.code + ' ' + s.full_name, s.id); });
  T.share_bookings.forEach(function (b) { au(b.created_at, 'usr_admin', 'Created booking', 'booking', b.id, 'Created booking ' + b.code + ' for ' + b.quantity + ' share(s)', b.shareholder_id); });
  T.share_payments.forEach(function (p) { au(p.created_at, 'usr_acct', 'Added payment', 'share_payment', p.id, 'Recorded share payment ' + p.receipt_no + ' of ' + fmtMoney(p.amount) + ' via ' + p.method, p.shareholder_id); });
  T.construction_plans.forEach(function (p) { au(p.created_at, 'usr_admin', 'Created construction plan', 'construction_plan', p.id, 'Created construction plan ' + p.code + ' of ' + fmtMoney(p.total_amount), p.shareholder_id); });
  T.construction_payments.forEach(function (p) { au(p.created_at, 'usr_acct', 'Added payment', 'construction_payment', p.id, 'Recorded construction payment ' + p.receipt_no + ' of ' + fmtMoney(p.amount), p.shareholder_id); });
  T.project_expenses.forEach(function (e) { au(e.created_at, 'usr_acct', 'Added project expense', 'expense', e.id, 'Added expense ' + e.code + ': ' + e.description + ' (' + fmtMoney(e.amount) + ')', null); });
  T.audit_logs.sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
  return T;
}
