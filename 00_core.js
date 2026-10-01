/* ============================================================
   00 CORE — configuration + pure utilities (no React, no data)
   ============================================================ */
'use strict';

/* Configurable identity. In production these come from the `settings` table. */
const APP_CONFIG = {
  companyName: 'Apon Niketon Holdings',
  systemName: 'Project Management System',
  projectName: 'Niketon Heights, Bashundhara R/A',
  totalShares: 40,
  defaultSharePrice: 1000000,
  demo: true,
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const METHODS = ['Bank Transfer','bKash','Cash','Cheque'];
const EXPENSE_CATEGORIES = ['Contractor Payment','Materials','Labor','Electrical','Plumbing','Structural','Tiles','Cement','Steel','Lift','Generator','Interior','Engineering','Government / Approval','Transportation','Other'];
/* Fixed building plan. Only floors 4 to 12 hold residential units (4 per floor, 1,440 sq ft each = 36 units). */
const UNIT_SIZE_SQFT = 1440, UNIT_LETTERS = ['A', 'B', 'C', 'D'], RES_FLOORS = [4, 5, 6, 7, 8, 9, 10, 11, 12];
const ORD = function (n) { return n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th'); };
const BUILDING = [0, 1, 2, 3].map(function (f) { return { floor: f, label: f === 0 ? 'Ground' : ORD(f), use: 'Commercial', units: 0 }; })
  .concat(RES_FLOORS.map(function (f) { return { floor: f, label: ORD(f), use: 'Residential', units: 4 }; }))
  .concat([{ floor: 13, label: 'Roof Top', use: 'Roof / Amenities', units: 0 }]);
const VALID_UNIT_CODES = RES_FLOORS.reduce(function (a, f) { return a.concat(UNIT_LETTERS.map(function (l) { return f + l; })); }, []);
function floorName(f) { const b = BUILDING.filter(function (x) { return x.floor === Number(f); })[0]; return b ? (f === 0 ? 'Ground Floor' : b.floor === 13 ? 'Roof Top' : b.label + ' Floor') : String(f); }
const UNIT_STATUSES = ['Available','Reserved','Assigned','Under Construction','Completed','Handed Over'];
const DOC_TYPES = ['NID','Photo','Share Agreement','Deed','Booking Document','Payment Receipt','Construction Agreement','Bill / Invoice','Other'];

function pad(n, w) { return String(n).padStart(w || 2, '0'); }
function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
const TODAY = isoDate(new Date());
function nowIso() { return new Date().toISOString(); }
function monthDate(offset, day) { const n = new Date(); return isoDate(new Date(n.getFullYear(), n.getMonth() + offset, day || 10)); }
function addMonths(iso, n) { const p = iso.split('-').map(Number); return isoDate(new Date(p[0], p[1] - 1 + n, Math.min(p[2], 28))); }
function daysBetween(a, b) { const pa = a.split('-').map(Number), pb = b.split('-').map(Number); return Math.round((new Date(pb[0], pb[1] - 1, pb[2]) - new Date(pa[0], pa[1] - 1, pa[2])) / 86400000); }
function monthKey(iso) { return iso.slice(0, 7); }
function monthLabel(key) { const p = key.split('-'); return MONTHS[+p[1] - 1] + " '" + p[0].slice(2); }
function lastMonthKeys(n) { const out = []; const now = new Date(); for (let i = n - 1; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); out.push(d.getFullYear() + '-' + pad(d.getMonth() + 1)); } return out; }

function roundMoney(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function fmtMoney(n) { const v = roundMoney(n); const s = Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: 2 }); return (v < 0 ? '-' : '') + '৳' + s; }
function fmtCompact(n) {
  const a = Math.abs(n), sg = n < 0 ? '-' : '';
  if (a >= 1e7) return sg + '৳' + (a / 1e7).toFixed(2) + ' Cr';
  if (a >= 1e5) return sg + '৳' + (a / 1e5).toFixed(2) + ' L';
  return fmtMoney(n);
}
function fmtAxis(n) { if (n >= 1e7) return (n / 1e7).toFixed(1).replace('.0', '') + 'Cr'; if (n >= 1e5) return (n / 1e5).toFixed(0) + 'L'; return String(n); }
function fmtDate(iso) { if (!iso) return '—'; const p = iso.slice(0, 10).split('-').map(Number); return p[2] + ' ' + MONTHS[p[1] - 1] + ' ' + p[0]; }
function fmtDateTime(ts) { if (!ts) return '—'; const d = new Date(ts); return fmtDate(isoDate(d)) + ', ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function fmtBytes(b) { if (!b) return '—'; if (b > 1048576) return (b / 1048576).toFixed(1) + ' MB'; return Math.max(1, Math.round(b / 1024)) + ' KB'; }
function initials(name) { return (name || '?').replace(/^(Dr\.|Md\.|Mst\.)\s*/i, '').split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase(); }

function uid(prefix) { return prefix + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3); }
function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function sum(arr, f) { let s = 0; for (let i = 0; i < arr.length; i++) s += Number(f ? f(arr[i]) : arr[i]) || 0; return roundMoney(s); }
function byDateDesc(key) { return function (a, b) { return String(b[key]).localeCompare(String(a[key])); }; }
function cmpStr(a, b) { return String(a).localeCompare(String(b), undefined, { numeric: true }); }
function csvEscape(v) { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }


/* Taka amount in words, lakh/crore style, for receipts. */
function amountInWords(n) {
  n = Math.round(Math.abs(Number(n) || 0));
  if (n === 0) return 'Zero Taka Only';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = function (x) { return x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? '-' + ones[x % 10] : ''); };
  const three = function (x) { return (x >= 100 ? ones[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' : '') : '') + (x % 100 ? two(x % 100) : ''); };
  const parts = [], crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5; const th = Math.floor(n / 1e3); n %= 1e3;
  if (crore) parts.push(three(crore) + ' Crore'); if (lakh) parts.push(two(lakh) + ' Lakh'); if (th) parts.push(two(th) + ' Thousand'); if (n) parts.push(three(n));
  return 'Taka ' + parts.join(' ') + ' Only';
}
function fmtPct(p) { return (Math.round(p * 10) / 10) + '%'; }

class AppError extends Error { constructor(message, title, code) { super(message); this.title = title || 'Action failed'; this.code = code || 'APP_ERROR'; } }
