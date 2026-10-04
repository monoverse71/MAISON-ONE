/* ============================================================
   07b FILES — upload slots with real previews, lightbox, KYC cards.
   All file access goes through MockStorage (getUrl / upload), which is
   the single object to replace with Supabase Storage signed URLs.
   ============================================================ */
function docOwnerName(db, doc) {
  if (!doc) return '';
  if (doc.related_type === 'shareholder') { const s = Calc.byId(db.shareholders, doc.related_id); return s ? s.full_name : ''; }
  if (doc.related_type === 'nominee') { const n = Calc.byId(db.nominees, doc.related_id); return n ? n.name : ''; }
  return '';
}
const isImg = (d) => !!d && /^image\//.test(d.file_type || d.type || '');
const isPdfDoc = (d) => !!d && (d.file_type || d.type) === 'application/pdf';

function useFileUrl(doc) {
  const { db } = useApp(); const [url, setUrl] = useState(null);
  const key = doc ? doc.id + '|' + doc.storage_path : '';
  useEffect(() => {
    let dead = false; setUrl(null);
    if (doc) MockStorage.getUrl(doc, docOwnerName(db, doc)).then((u) => { if (!dead) setUrl(u); });
    return () => { dead = true; };
  }, [key]);
  return url;
}

function PdfTile({ name }) { return (<div className="pdf-tile"><Icon n="file" size={30} /><b>PDF</b><span>{name}</span></div>); }

/* Thumbnail of a stored document. Click opens the lightbox. */
function DocThumb({ doc, onClick, lightbox, alt }) {
  const { open } = useApp(); const url = useFileUrl(doc);
  if (!doc) return null;
  const go = onClick || (() => open('lightbox', Object.assign({ docId: doc.id }, lightbox || {})));
  return (<button type="button" className="thumb" onClick={go} aria-label={'Open larger preview of ' + (alt || doc.file_name)}>
    {isImg(doc) ? (url ? <img src={url} alt={alt || doc.file_name} /> : <div className="pdf-tile"><Icon n="eye" size={26} /><span>No preview in this session</span></div>) : <PdfTile name={doc.file_name} />}
  </button>);
}

function PersonAvatar({ name, docId, size }) {
  const { db } = useApp(); const doc = docId ? Calc.byId(db.documents, docId) : null; const url = useFileUrl(doc && !doc.archived_at ? doc : null);
  return <Avatar name={name} src={url} size={size} />;
}
function ShAvatar({ sh, size }) { return <PersonAvatar name={sh.full_name} docId={sh.photo_doc_id} size={size} />; }

/* Full-screen preview. Optional Replace / Remove when opened from a KYC slot. */
function Lightbox({ docId, url, name, type, owner, ownerId, slot, label, canEdit, actions, onClose }) {
  const { db } = useApp(); const doc = docId ? Calc.byId(db.documents, docId) : null; const fUrl = useFileUrl(doc);
  const src = url || fUrl, fname = name || (doc && doc.file_name) || '', ftype = type || (doc && doc.file_type) || '';
  const [zoom, setZoom] = useState(false); const tok = useRef({});
  const kyc0 = useKycActions({ owner, ownerId, slot, label: label || 'document', has: !!doc, after: onClose });
  const ext = usePendingActions(actions, onClose), kyc = actions ? ext : kyc0, showEdit = canEdit && (slot || actions);
  useEffect(() => {
    MODAL_STACK.push(tok.current); const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const key = (e) => { if (e.key === 'Escape' && MODAL_STACK[MODAL_STACK.length - 1] === tok.current) onClose(); };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); MODAL_STACK.splice(MODAL_STACK.indexOf(tok.current), 1); document.body.style.overflow = prev; };
  }, []);
  const img = /^image\//.test(ftype);
  return (<div className="lb" role="dialog" aria-modal="true" aria-label={'Preview of ' + fname}>
    <div className="lb-bar">
      <div style={{ minWidth: 0 }}><b style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fname}</b><span style={{ opacity: .75, fontSize: 12 }}>{label || (doc && doc.doc_type) || ''}{doc ? ' · ' + doc.code : ''}</span></div>
      <div className="chips">
        {img && src && <Btn size="sm" onClick={() => setZoom(!zoom)}>{zoom ? 'Fit to screen' : 'Actual size'}</Btn>}
        {showEdit && <><label className="btn btn-sm" htmlFor="lb-replace">Replace</label><input id="lb-replace" className="sr" type="file" accept="image/*,.pdf" onChange={(e) => kyc.upload(e.target.files && e.target.files[0])} />{doc && <Btn size="sm" variant="danger" busy={kyc.busy} onClick={kyc.remove}>Remove</Btn>}</>}
        <Btn size="sm" icon="x" onClick={onClose}>Close</Btn>
      </div>
    </div>
    <div className={'lb-body' + (zoom ? ' zoom' : '')} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {!src ? <div className="lb-empty"><Icon n="eye" size={34} /><div>No file is stored for this record.</div></div>
        : img ? <img src={src} alt={fname} /> : <iframe title={fname} src={src} />}
    </div>
  </div>);
}

/* Replace / remove supplied by the caller (used by the project gallery). */
function usePendingActions(actions, after) {
  const [busy, setBusy] = useState(false);
  return { busy: busy,
    upload: async (f) => { if (!f || !actions) return; setBusy(true); const ok = await actions.replace(f); setBusy(false); if (ok && after) after(); },
    remove: async () => { if (!actions) return; setBusy(true); const ok = await actions.remove(); setBusy(false); if (ok && after) after(); } };
}

/* Replace / remove shared by KYC cards and the lightbox. */
function useKycActions({ owner, ownerId, slot, label, has, after }) {
  const { run, S, confirm } = useApp(); const [busy, setBusy] = useState(false);
  const upload = async (f) => { if (!f || !owner) return; setBusy(true); const r = await run(() => S.setPersonDocument({ owner: owner, ownerId: ownerId, slot: slot, file: f }), label + (has ? ' replaced' : ' uploaded')); setBusy(false); if (r.ok && after) after(); };
  const remove = async () => {
    const a = await confirm({ title: 'Remove ' + label + '?', message: 'The file is archived rather than destroyed, and the removal is recorded in the audit log.', confirmLabel: 'Remove', danger: true, reason: true });
    if (!a.ok) return; setBusy(true); const r = await run(() => S.removePersonDocument({ owner: owner, ownerId: ownerId, slot: slot, reason: a.reason }), label + ' removed'); setBusy(false); if (r.ok && after) after();
  };
  return { upload: upload, remove: remove, busy: busy };
}

/* Card on the profile: thumbnail, larger preview, replace, remove. */
function KycCard({ owner, ownerId, slot, label, doc, canEdit }) {
  const id = useId(); const k = useKycActions({ owner, ownerId, slot, label, has: !!doc });
  return (<div className="slot">
    <div className="slot-l">{label}</div>
    <div className="slot-box">{doc ? <DocThumb doc={doc} alt={label} lightbox={{ owner: owner, ownerId: ownerId, slot: slot, label: label, canEdit: canEdit }} /> : <div className="slot-empty">Not uploaded</div>}</div>
    {doc && <div className="hint">{doc.file_name} · {fmtBytes(doc.size_bytes)}</div>}
    {canEdit && <div className="slot-a"><label className="btn btn-sm" htmlFor={id}>{doc ? 'Replace' : 'Upload'}</label><input id={id} className="sr" type="file" accept="image/*,.pdf" onChange={(e) => { k.upload(e.target.files && e.target.files[0]); e.target.value = ''; }} />{doc && <Btn size="sm" variant="danger" busy={k.busy} onClick={k.remove}>Remove</Btn>}{k.busy && !doc && <span className="spin" />}</div>}
  </div>);
}

/* Slot inside the shareholder form. Changes are staged and saved with the form. value: File | 'REMOVE' | null */
function DocSlot({ label, doc, value, onChange }) {
  const { open, toast } = useApp(); const id = useId(); const [drag, setDrag] = useState(false);
  const file = value && value !== 'REMOVE' ? value : null, existing = value === 'REMOVE' ? null : doc, has = !!file || !!existing;
  const [local, setLocal] = useState(null);
  useEffect(() => { if (!file) { setLocal(null); return; } const u = URL.createObjectURL(file); setLocal(u); return () => URL.revokeObjectURL(u); }, [file]);
  const pick = (f) => { if (!f) return; if (!/^image\//.test(f.type) && f.type !== 'application/pdf') { toast.error('File type not accepted', 'Choose a JPG, PNG, WebP or PDF file.'); return; } if (f.size > 10 * 1048576) { toast.error('File too large', 'Choose a file under 10 MB.'); return; } onChange(f); };
  return (<div className={'slot' + (drag ? ' drag' : '')} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files && e.dataTransfer.files[0]); }}>
    <div className="slot-l">{label}</div>
    <div className="slot-box">
      {file ? (/^image\//.test(file.type) ? <button type="button" className="thumb" onClick={() => open('lightbox', { url: local, name: file.name, type: file.type, label: label })} aria-label={'Open larger preview of ' + label}>{local && <img src={local} alt={label + ' preview'} />}</button> : <PdfTile name={file.name} />)
        : existing ? <DocThumb doc={existing} alt={label} />
        : value === 'REMOVE' ? <div className="slot-empty">Will be removed when you save</div>
        : <div className="slot-empty">No file yet.<br />Drop one here or choose a file.</div>}
    </div>
    {file && <div className="hint"><span className="badge t-info">New</span> {file.name} · {fmtBytes(file.size)} · saved with the form</div>}
    <div className="slot-a">
      <label className="btn btn-sm" htmlFor={id}>{has ? 'Replace' : 'Upload'}</label>
      <input id={id} className="sr" type="file" accept="image/*,.pdf" onChange={(e) => { pick(e.target.files && e.target.files[0]); e.target.value = ''; }} />
      {has && <Btn size="sm" variant="danger" onClick={() => onChange(file ? null : 'REMOVE')}>Remove</Btn>}
      {value === 'REMOVE' && doc && <Btn size="sm" variant="ghost" onClick={() => onChange(null)}>Undo</Btn>}
    </div>
  </div>);
}
