/* ============================================================
   12c PROJECT DETAILS — project information plus a gallery of project
   images. Images belong to the project (documents.related_type = 'project'),
   use the same storage adapter and the same lightbox as every other file.
   ============================================================ */
const TOTAL_FLOORS = BUILDING.filter((b) => b.floor <= 12).length, COMM_FLOORS = BUILDING.filter((b) => b.use === 'Commercial').length;
const catRank = (c) => { const i = PROJECT_IMAGE_CATEGORIES.indexOf(c); return i < 0 ? 99 : i; };
const projectImagesOf = (db) => db.documents.filter((d) => live(d) && d.related_type === 'project' && d.slot === 'project_image').sort((a, b) => catRank(a.category) - catRank(b.category) || (a.sort || 0) - (b.sort || 0));

function useProjectImageActions() {
  const { S, run, confirm } = useApp();
  return {
    replace: async (doc, file) => (await run(() => S.replaceProjectImage(doc.id, file), 'Image replaced')).ok,
    remove: async (doc) => { const a = await confirm({ title: 'Remove "' + doc.caption + '"?', message: 'The image is archived rather than destroyed, and the removal is recorded in the audit log.', confirmLabel: 'Remove', danger: true, reason: true }); if (!a.ok) return false; return (await run(() => S.removeProjectImage(doc.id, a.reason), 'Image removed')).ok; }
  };
}

function ProjectImageCard({ doc, canEdit }) {
  const { open } = useApp(); const act = useProjectImageActions(); const id = useId();
  const actions = { replace: (f) => act.replace(doc, f), remove: () => act.remove(doc) };
  return (<figure className="pimg">
    <DocThumb doc={doc} alt={doc.caption} lightbox={{ label: doc.caption + ' · ' + doc.category, canEdit: canEdit, actions: actions }} />
    <figcaption><b>{doc.caption}</b><span className="badge t-info">{doc.category}</span></figcaption>
    {canEdit && <div className="slot-a">
      <label className="btn btn-sm" htmlFor={id}>Replace</label><input id={id} className="sr" type="file" accept="image/*" onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) act.replace(doc, f); }} />
      <Btn size="sm" icon="edit" onClick={() => open('projectImageEdit', { id: doc.id })}>Details</Btn>
      <Btn size="sm" variant="danger" onClick={() => act.remove(doc)}>Remove</Btn>
    </div>}
  </figure>);
}

function ProjectImageEdit({ id, onClose }) {
  const { db, S, run } = useApp(); const doc = Calc.byId(db.documents, id); if (!doc) return null;
  const [title, setTitle] = useState(doc.caption || ''); const [cat, setCat] = useState(doc.category || 'Other'); const [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); const r = await run(() => S.updateProjectImage(id, { title: title, category: cat }), 'Image details saved'); setBusy(false); if (r.ok) onClose(); };
  return (<Modal title="Image details" sub={doc.file_name} size="narrow" onClose={onClose} footer={<ModalFooter onClose={onClose} busy={busy} onSubmit={submit} label="Save" />}>
    <div className="docprev"><DocThumb doc={doc} alt={doc.caption} /></div>
    <div className="frm"><Field label="Title / caption" full><Txt value={title} onChange={setTitle} /></Field><Field label="Category" full><Sel value={cat} onChange={setCat} options={PROJECT_IMAGE_CATEGORIES} /></Field></div>
  </Modal>);
}

/* Add several images at once, each with its own title and category. */
function ProjectImagesForm({ onClose, category }) {
  const { S, run, toast } = useApp(); const id = useId(); const reqId = useRequestId();
  const [items, setItems] = useState([]); const [busy, setBusy] = useState(false); const [drag, setDrag] = useState(false);
  const add = (list) => {
    const ok = [], bad = [];
    Array.from(list || []).forEach((f) => { if (!/^image\//.test(f.type)) bad.push(f.name + ' (not an image)'); else if (f.size > 10 * 1048576) bad.push(f.name + ' (over 10 MB)'); else ok.push({ key: uid('pi'), file: f, title: f.name.replace(/\.[^.]+$/, ''), category: category || 'Other' }); });
    if (bad.length) toast.error('Some files were skipped', bad.join(', '));
    if (ok.length) setItems((p) => p.concat(ok));
  };
  const upd = (key, patch) => setItems((p) => p.map((x) => x.key === key ? Object.assign({}, x, patch) : x));
  const submit = async () => { if (!items.length) { toast.error('No image chosen', 'Choose at least one image.'); return; } setBusy(true); const r = await run(() => S.addProjectImages(items.map((x) => ({ file: x.file, title: x.title, category: x.category }))), items.length + ' image' + (items.length > 1 ? 's' : '') + ' added'); setBusy(false); if (r.ok) onClose(); };
  return (<Modal title="Add project images" sub="These images belong to the project, not to a shareholder." size="wide" onClose={onClose} footer={<ModalFooter onClose={onClose} busy={busy} onSubmit={submit} label={items.length ? 'Add ' + items.length + ' image' + (items.length > 1 ? 's' : '') : 'Add images'} />}>
    <div className={'dropzone' + (drag ? ' drag' : '')} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}>
      <Icon n="image" size={26} /><div>Drop images here, or</div>
      <label className="btn btn-sm" htmlFor={id}>Choose images</label><input id={id} className="sr" type="file" accept="image/*" multiple onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      <span className="hint">JPG, PNG or WebP, up to 10 MB each. Original quality is kept.</span>
    </div>
    {items.length > 0 && <div className="pq">{items.map((x) => <PendingImage key={x.key} x={x} upd={upd} remove={() => setItems((p) => p.filter((y) => y.key !== x.key))} />)}</div>}
  </Modal>);
}
function PendingImage({ x, upd, remove }) {
  const { open } = useApp(); const [u, setU] = useState(null);
  useEffect(() => { const s = URL.createObjectURL(x.file); setU(s); return () => URL.revokeObjectURL(s); }, [x.file]);
  return (<div className="pq-i">
    <button type="button" className="thumb" onClick={() => open('lightbox', { url: u, name: x.file.name, type: x.file.type, label: x.title })} aria-label={'Preview ' + x.file.name}>{u && <img src={u} alt={x.title + ' preview'} />}</button>
    <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
      <Txt value={x.title} onChange={(v) => upd(x.key, { title: v })} aria-label="Image title" placeholder="Title / caption" />
      <Sel value={x.category} onChange={(v) => upd(x.key, { category: v })} options={PROJECT_IMAGE_CATEGORIES} aria-label="Category" />
      <div className="hint">{x.file.name} · {fmtBytes(x.file.size)}</div>
    </div>
    <Btn size="sm" variant="ghost" onClick={remove} aria-label={'Remove ' + x.file.name}><Icon n="x" size={14} /></Btn>
  </div>);
}

function ProjectEditForm({ onClose }) {
  const { db, S, run } = useApp(); const st = db.settings[0];
  const [f, set] = useForm({ project_name: st.project_name || '', project_type: st.project_type || '', location: st.location || '', land_area: st.land_area || '', description: st.description || '', handover_info: st.handover_info || '', building_structure: st.building_structure || '', construction_start: st.construction_start || '', expected_completion: st.expected_completion || '', contact_phone: st.contact_phone || '', contact_email: st.contact_email || '', contact_address: st.contact_address || '', notes: st.notes || '' });
  const [errs, setErrs] = useState({}); const [busy, setBusy] = useState(false);
  const submit = async () => { const e = {}; if (!f.project_name.trim()) e.project_name = 'Enter the project name.'; if (f.contact_email && !/^\S+@\S+\.\S+$/.test(f.contact_email)) e.contact_email = 'Enter a valid email address.'; if (f.construction_start && f.expected_completion && f.expected_completion < f.construction_start) e.expected_completion = 'Completion cannot be before the start date.'; setErrs(e); if (V.hasErrors(e)) return; setBusy(true); const r = await run(() => S.updateProjectDetails(f), 'Project details saved'); setBusy(false); if (r.ok) onClose(); };
  return (<Modal title="Edit project details" sub="Units, unit size, floors and shares come from the live project data and are not typed here." size="wide" onClose={onClose} footer={<ModalFooter onClose={onClose} busy={busy} onSubmit={submit} label="Save details" />}>
    <div className="frm">
      <Field label="Project name" req err={errs.project_name}><Txt value={f.project_name} onChange={set('project_name')} /></Field>
      <Field label="Project type"><Txt value={f.project_type} onChange={set('project_type')} placeholder="Residential, commercial…" /></Field>
      <Field label="Project location"><Txt value={f.location} onChange={set('location')} /></Field>
      <Field label="Land area"><Txt value={f.land_area} onChange={set('land_area')} placeholder="e.g. 10 katha" /></Field>
      <Field label="Building structure" full hint="Floors, commercial and residential levels. Counts below are calculated from the Units data."><Area value={f.building_structure} onChange={set('building_structure')} rows={2} /></Field>
      <Field label="Construction start date"><DateIn value={f.construction_start} onChange={set('construction_start')} /></Field>
      <Field label="Expected completion / handover" err={errs.expected_completion}><DateIn value={f.expected_completion} onChange={set('expected_completion')} /></Field>
      <Field label="Project description" full><Area value={f.description} onChange={set('description')} rows={4} /></Field>
      <Field label="Construction / handover notes" full><Area value={f.handover_info} onChange={set('handover_info')} rows={3} /></Field>
      <Field label="Contact phone"><Txt value={f.contact_phone} onChange={set('contact_phone')} inputMode="tel" /></Field>
      <Field label="Contact email" err={errs.contact_email}><Txt value={f.contact_email} onChange={set('contact_email')} type="email" /></Field>
      <Field label="Contact address" full><Txt value={f.contact_address} onChange={set('contact_address')} /></Field>
      <Field label="Additional notes" full><Area value={f.notes} onChange={set('notes')} rows={3} /></Field>
    </div>
  </Modal>);
}

function ProjectPage() {
  const { db, user, open } = useApp(); const w = can(user, 'write'); const st = db.settings[0];
  const imgs = projectImagesOf(db); const [cat, setCat] = useState('all');
  const units = db.units.filter(live), assigned = units.filter((u) => u.shareholder_id).length;
  const main = imgs.filter((d) => d.category === 'Main')[0] || imgs[0];
  const shown = cat === 'all' ? imgs : imgs.filter((d) => d.category === cat);
  const chips = [{ id: 'all', label: 'All', count: imgs.length }].concat(PROJECT_IMAGE_CATEGORIES.filter((c) => imgs.some((d) => d.category === c)).map((c) => ({ id: c, label: c, count: imgs.filter((d) => d.category === c).length })));
  useEffect(() => { if (cat !== 'all' && !imgs.some((d) => d.category === cat)) setCat('all'); }, [imgs.length]);
  const rows = (items) => <dl className="dl">{items.map((it, i) => [<dt key={'t' + i}>{it[0]}</dt>, <dd key={'d' + i}>{it[1] || <span className="muted">Not added</span>}</dd>])}</dl>;
  return (<>
    <PageHead title="Project Details" sub="Everything about the project in one place: information, building structure and project images." demo actions={<><Btn icon="printer" onClick={() => open('printPreview', { doc: 'project', args: {} })}>Print project sheet</Btn>{w && <Btn icon="edit" onClick={() => open('projectEdit', {})}>Edit details</Btn>}</>} />
    <Card><div className="proj-hero">
      <div className="proj-hero-img">{main ? <DocThumb doc={main} alt={main.caption} /> : <div className="slot-empty" style={{ aspectRatio: '16/9' }}>No project image yet</div>}</div>
      <div className="proj-hero-t">
        <BrandLogo height={46} chip />
        <h2 className="proj-name">{st.project_name}</h2>
        <div className="muted">{st.project_type || 'Project type not added'} · {st.location || 'Location not added'}</div>
        <div className="proj-facts">
          <div><span>Total units</span><b>{units.length}</b></div>
          <div><span>Unit size</span><b>{units.length ? units[0].size_sqft.toLocaleString('en-US') + ' sq ft' : '—'}</b></div>
          <div><span>Residential floors</span><b>{RES_FLOORS.length} (4th to 12th)</b></div>
          <div><span>Units assigned</span><b>{assigned} of {units.length}</b></div>
        </div>
      </div>
    </div></Card>
    <div className="grid g2">
      <Card title="Project information">{rows([['Project name', st.project_name], ['Project type', st.project_type], ['Project location', st.location], ['Developer / company', st.company_name], ['Land area', st.land_area], ['Building structure', st.building_structure], ['Total floors', TOTAL_FLOORS + ' floors (Ground to 12th) plus roof top'], ['Commercial floors', COMM_FLOORS + ' (Ground to 3rd)'], ['Residential floors', RES_FLOORS.length + ' (4th to 12th)'], ['Total residential units', units.length], ['Unit size', units.length ? units[0].size_sqft.toLocaleString('en-US') + ' sq ft each' : '']])}</Card>
      <Card title="Construction, handover and contact">{rows([['Construction start date', st.construction_start ? fmtDate(st.construction_start) : ''], ['Expected completion / handover', st.expected_completion ? fmtDate(st.expected_completion) : ''], ['Construction / handover notes', st.handover_info], ['Contact phone', st.contact_phone], ['Contact email', st.contact_email], ['Contact address', st.contact_address]])}</Card>
    </div>
    <div className="grid g2">
      <Card title="Project description"><p className="proj-text">{st.description || <span className="muted">No description added yet.</span>}</p></Card>
      <Card title="Building structure" sub="Fixed plan, managed on the Units page"><ul className="bs-list">{BUILDING.map((b) => <li key={b.floor}><b>{b.label}</b><span>{b.use}{b.units ? ' · ' + b.units + ' units · ' + UNIT_SIZE_SQFT.toLocaleString('en-US') + ' sq ft each' : ''}</span></li>)}</ul></Card>
    </div>
    <Card title="Project images" sub={imgs.length + ' image' + (imgs.length === 1 ? '' : 's') + ' · these belong to the project itself, not to any shareholder'} actions={w && <Btn variant="primary" icon="plus" onClick={() => open('projectImages', { category: PROJECT_IMAGE_CATEGORIES.indexOf(cat) >= 0 ? cat : undefined })}>Add images</Btn>}>
      {imgs.length > 0 && <div style={{ marginBottom: 14 }}><Chips options={chips} value={cat} onChange={setCat} /></div>}
      {shown.length ? <div className="pgrid">{shown.map((d) => <ProjectImageCard key={d.id} doc={d} canEdit={w} />)}</div> : <Empty icon="image" title="No project images yet" text="Add the main building image, site and location, floor plans, interiors, amenities and construction progress photos." action={w && <Btn variant="primary" icon="plus" onClick={() => open('projectImages', {})}>Add images</Btn>} />}
    </Card>
    <Card title="Additional notes"><p className="proj-text">{st.notes || <span className="muted">No notes added yet.</span>}</p></Card>
  </>);
}

MODAL_REGISTRY.projectEdit = ProjectEditForm; MODAL_REGISTRY.projectImages = ProjectImagesForm; MODAL_REGISTRY.projectImageEdit = ProjectImageEdit;
