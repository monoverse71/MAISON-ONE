/* ============================================================
   02 REPOSITORY — the ONLY layer that touches storage.
   The UI and services talk to `repo` through this interface.
   MockRepository keeps data in memory (never localStorage).
   To go live, implement SupabaseRepository with the same methods
   and change createRepository(). No component changes are needed.
   ============================================================ */
class RepoError extends Error { constructor(code, message) { super(message); this.code = code; this.title = code === 'DUPLICATE_SUBMISSION' ? 'Already submitted' : 'Data error'; } }

/* Ledger tables are append-only: only these status-style fields may change after insert. */
const LEDGER_MUTABLE = {
  share_payments: ['status', 'reversed_by_id'],
  construction_payments: ['status', 'reversed_by_id'],
  project_expenses: ['status', 'reversed_by_id', 'approval_status', 'approved_by'],
  audit_logs: []
};
const PK_TABLES = ['users', 'shareholders', 'nominees', 'units', 'share_bookings', 'share_payments', 'construction_plans', 'construction_payments', 'contractors', 'contract_installments', 'project_expenses', 'documents', 'audit_logs', 'settings'];

class MockRepository {
  constructor(seed) { this.kind = 'Mock (in-memory)'; this.tables = deepClone(seed); this.requestIds = new Set(); }
  async loadAll() { await sleep(650); return this.snapshot(); }
  snapshot() { return deepClone(this.tables); }
  /* Atomic: all operations succeed or none are applied (Supabase: a single RPC / transaction). */
  async batch(ops, opts) {
    await sleep(220);
    const requestId = opts && opts.requestId;
    if (requestId && this.requestIds.has(requestId)) throw new RepoError('DUPLICATE_SUBMISSION', 'This form was already submitted. Refresh the list to see the record.');
    const staged = deepClone(this.tables);
    ops.forEach(function (op) {
      const tbl = staged[op.table];
      if (!tbl) throw new RepoError('UNKNOWN_TABLE', 'Unknown table ' + op.table);
      if (op.op === 'insert') {
        if (!op.row.id) throw new RepoError('MISSING_ID', 'Rows need a stable id.');
        if (tbl.some(function (r) { return r.id === op.row.id; })) throw new RepoError('DUPLICATE_ID', 'Duplicate id ' + op.row.id);
        tbl.push(op.row);
      } else if (op.op === 'update') {
        const row = tbl.filter(function (r) { return r.id === op.id; })[0];
        if (!row) throw new RepoError('NOT_FOUND', 'Record not found in ' + op.table);
        const allowed = LEDGER_MUTABLE[op.table];
        if (allowed) Object.keys(op.patch).forEach(function (k) { if (allowed.indexOf(k) < 0) throw new RepoError('IMMUTABLE', 'Historical financial records cannot be edited. Reverse the entry and record a corrected one.'); });
        Object.assign(row, op.patch);
      } else if (op.op === 'archive') {
        const row = tbl.filter(function (r) { return r.id === op.id; })[0];
        if (!row) throw new RepoError('NOT_FOUND', 'Record not found in ' + op.table);
        Object.assign(row, { archived_at: nowIso(), archived_by: op.meta && op.meta.by, archive_reason: op.meta && op.meta.reason });
      } else throw new RepoError('BAD_OP', 'Unsupported operation. Hard delete is not available.');
    });
    this.tables = staged;
    if (requestId) this.requestIds.add(requestId);
    return true;
  }
  reset(seed) { this.tables = deepClone(seed); this.requestIds = new Set(); }
}

/* Skeleton showing how each method maps to Supabase. Not connected in V1. */
class SupabaseRepository {
  constructor(/* supabaseClient */) { this.kind = 'Supabase (not connected)'; }
  async loadAll() { /* one select per table with RLS applied, e.g. supabase.from('shareholders').select('*') */ throw new RepoError('NOT_CONNECTED', 'Supabase is not connected in V1.'); }
  async batch(/* ops */) { /* supabase.rpc('apply_batch', { ops }) so the writes and audit rows share one transaction; unique(client_request_id) blocks double submits */ throw new RepoError('NOT_CONNECTED', 'Supabase is not connected in V1.'); }
}

/* File storage adapter. The UI only calls upload / getUrl / remove, so swapping in Supabase Storage
   means replacing this one object (upload -> storage.from('documents').upload, getUrl -> createSignedUrl).
   The prototype keeps uploaded files in browser memory for this visit only. */
function xmlEsc(s) { return String(s == null ? '' : s).replace(/[<>&"]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]; }); }
function sampleImageUrl(doc, name) {
  const slot = doc.slot || (doc.doc_type === 'Photo' ? 'photo' : 'other'), nm = xmlEsc(name || 'Sample person');
  let svg;
  if (slot === 'photo') {
    svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 480"><rect width="400" height="480" fill="#EDE9FE"/><circle cx="200" cy="180" r="78" fill="#A78BFA"/><path d="M40 480c0-95 72-150 160-150s160 55 160 150z" fill="#8B5CF6"/><rect x="0" y="430" width="400" height="50" fill="#1F2937" opacity=".78"/><text x="200" y="462" font-family="sans-serif" font-size="20" fill="#fff" text-anchor="middle">SAMPLE PHOTO</text></svg>';
  } else if (slot === 'nid_front') {
    svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400"><rect width="640" height="400" rx="18" fill="#F9FAFB" stroke="#9CA3AF" stroke-width="3"/><rect width="640" height="74" rx="18" fill="#15803D"/><rect y="40" width="640" height="34" fill="#15803D"/><text x="320" y="46" font-family="sans-serif" font-size="24" font-weight="700" fill="#fff" text-anchor="middle">SAMPLE NATIONAL ID CARD</text><rect x="36" y="110" width="140" height="180" rx="8" fill="#DDD6FE"/><circle cx="106" cy="171" r="32" fill="#A78BFA"/><path d="M50 290c0-52 26-82 56-82s56 30 56 82z" fill="#8B5CF6"/><text x="204" y="140" font-family="sans-serif" font-size="14" fill="#6B7280">Name</text><text x="204" y="170" font-family="sans-serif" font-size="26" font-weight="700" fill="#1F2937">' + nm + '</text><text x="204" y="214" font-family="sans-serif" font-size="14" fill="#6B7280">ID No.</text><text x="204" y="242" font-family="sans-serif" font-size="24" fill="#1F2937" letter-spacing="3">•••• ••• ••••</text><rect x="204" y="272" width="300" height="10" rx="5" fill="#E5E7EB"/><rect x="204" y="294" width="220" height="10" rx="5" fill="#E5E7EB"/><text x="320" y="376" font-family="sans-serif" font-size="14" fill="#B91C1C" text-anchor="middle">Fictional sample. Not a real document.</text></svg>';
  } else if (slot === 'nid_back') {
    svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400"><rect width="640" height="400" rx="18" fill="#F9FAFB" stroke="#9CA3AF" stroke-width="3"/><rect y="34" width="640" height="52" fill="#1F2937"/><text x="320" y="68" font-family="sans-serif" font-size="20" font-weight="700" fill="#fff" text-anchor="middle">SAMPLE NATIONAL ID CARD (BACK)</text><rect x="36" y="112" width="568" height="10" rx="5" fill="#E5E7EB"/><rect x="36" y="136" width="500" height="10" rx="5" fill="#E5E7EB"/><rect x="36" y="160" width="420" height="10" rx="5" fill="#E5E7EB"/><g fill="#1F2937">' + Array.from({ length: 46 }, function (_, i) { return '<rect x="' + (60 + i * 11.6) + '" y="232" width="' + (i % 3 ? 5 : 8) + '" height="80"/>'; }).join('') + '</g><text x="320" y="376" font-family="sans-serif" font-size="14" fill="#B91C1C" text-anchor="middle">Fictional sample. Not a real document.</text></svg>';
  } else {
    svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 480"><rect width="400" height="480" fill="#F3F4F6"/><rect x="60" y="40" width="280" height="400" rx="6" fill="#fff" stroke="#9CA3AF"/><rect x="90" y="80" width="150" height="12" fill="#6B21A8"/><g fill="#E5E7EB"><rect x="90" y="130" width="220" height="8"/><rect x="90" y="156" width="200" height="8"/><rect x="90" y="182" width="220" height="8"/><rect x="90" y="208" width="170" height="8"/></g><text x="200" y="400" font-family="sans-serif" font-size="16" fill="#B91C1C" text-anchor="middle">SAMPLE DOCUMENT</text></svg>';
  }
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
const MockStorage = {
  blobs: {},
  async upload(file, path) { await sleep(250); this.blobs[path] = URL.createObjectURL(file); return { path: path, size: file.size, type: file.type || 'application/octet-stream' }; },
  async getUrl(doc, ownerName) {
    if (!doc) return null;
    if (this.blobs[doc.storage_path]) return this.blobs[doc.storage_path];
    if (doc._demo && /^image\//.test(doc.file_type)) return sampleImageUrl(doc, ownerName);
    return null;
  },
  /* Files are never destroyed by the app: removing a document archives its record. */
  async remove() { return true; }
};

function createRepository() { return new MockRepository(createSeed()); }
