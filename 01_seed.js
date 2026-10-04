/* ============================================================
   01 SEED — CLEAN REAL PROJECT. No sample or demo financial records.
   Only: app users, project/share configuration (settings row) and the
   fixed 36-unit building structure (all Available, unassigned).
   Table names + column names map 1:1 to the future PostgreSQL schema.
   ============================================================ */
function createSeed() {
  const T = {
    users: [], shareholders: [], nominees: [], units: [], share_bookings: [], share_payments: [],
    construction_plans: [], construction_payments: [],
    contractors: [], contract_installments: [], project_expenses: [], documents: [], audit_logs: [], settings: []
  };
  const D = { _demo: false, archived_at: null };
  const id = function (p, n) { return p + '_' + pad(n, 4); };

  /* App user accounts (access roles), not financial data. */
  T.users.push(
    { id: 'usr_admin', name: 'Admin', title: 'Managing Director', role: 'Admin', email: '', _demo: false },
    { id: 'usr_acct', name: 'Accountant', title: 'Accounts Officer', role: 'Accountant', email: '', _demo: false },
    { id: 'usr_view', name: 'Auditor', title: 'Viewer', role: 'Viewer', email: '', _demo: false }
  );

  /* Project + share configuration. Share price starts at 0 and is edited in Settings > Share Configuration. */
  T.settings.push({
    id: 'settings', project_name: APP_CONFIG.projectName, company_name: APP_CONFIG.companyName, currency: 'BDT', _demo: false,
    total_shares: APP_CONFIG.totalShares, default_share_price: APP_CONFIG.defaultSharePrice, share_name: 'Land Share', share_remarks: '',
    project_type: 'Residential Project', location: '', land_area: '12 Katha', total_area: '8,640 sq ft',
    description: '',
    building_structure: 'Ground Floor to 12th Floor + Rooftop',
    construction_start: '', expected_completion: '', handover_info: '',
    contact_phone: '', contact_email: '', contact_address: '', notes: ''
  });

  /* 36 fixed residential units: floors 4-12, A-D, 1,440 sq ft. Ground to 3rd are commercial, the rooftop is amenity space. */
  VALID_UNIT_CODES.forEach(function (c, i) {
    T.units.push(Object.assign({
      id: id('unit', i + 1), code: c, floor: parseInt(c, 10), unit_no: c.slice(-1), size_sqft: UNIT_SIZE_SQFT, status: 'Available', shareholder_id: null, assigned_date: null, remarks: ''
    }, D));
  });
  return T;
}
