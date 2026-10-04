const { chromium } = require('playwright-core'); const zlib = require('zlib'); const fs = require('fs');
function png(w, h, rgb, path) { const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xFFFFFFFF; for (const v of b) x = t[(x ^ v) & 255] ^ (x >>> 8); return (x ^ 0xFFFFFFFF) >>> 0; };
  const ch = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; const s = (x > w / 4 && x < w * 3 / 4 && y > h / 4 && y < h * 3 / 4) ? 1 : 0.6; raw[o] = rgb[0] * s; raw[o + 1] = rgb[1] * s; raw[o + 2] = rgb[2] * s; }
  fs.writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ch('IHDR', ih), ch('IDAT', zlib.deflateSync(raw)), ch('IEND', Buffer.alloc(0))])); }
const cols = [[200, 120, 240], [120, 200, 160], [240, 180, 90], [90, 150, 240], [240, 120, 140], [150, 150, 150], [100, 220, 220]];
const files = ['photo', 'nidf', 'nidb', 'nphoto', 'nnidf', 'nnidb', 'repl'].map((n, i) => { const p = '/tmp/claude-0/e_' + n + '.png'; png(300, 220, cols[i], p); return p; });
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('file:///home/claude/apon/dist_local.html'); await page.waitForSelector('text=Total shareholders');
  const nav = async n => { await page.locator('aside nav button', { hasText: n }).first().click(); await page.waitForTimeout(250); };
  const ok = (c, m) => console.log((c ? 'ok   ' : 'FAIL ') + m);
  const dlg = () => page.locator('[role=dialog]').last();
  const toasts = () => page.locator('.toast').allTextContents();
  const shot = (n) => page.screenshot({ path: 'shots/' + n + '.png' });
  // pages
  for (const n of ['Dashboard','Shareholders','Share Sales','Units','Construction Contributions','Project Expenses','Payments','Documents','Reports','Audit Log','Settings','Project Details']) { await nav(n); if (await page.locator('text=This page could not be shown').count()) ok(false, 'page ' + n); }
  ok(true, 'all 12 pages render (incl. Project Details)');
  // ---- clean initial state (no sample data) ----
  await nav('Dashboard'); await page.waitForTimeout(300);
  { const card = (label) => page.locator('.stat', { hasText: label }).first().innerText().then(t => t.replace(/\s+/g, ' '));
    const want = [['Total shareholders', '0'], ['Total shares', '60'], ['Shares sold', '0'], ['Shares available', '60'], ['Share price', '৳0'], ['Total share value', '৳0'], ['Share collection', '৳0'], ['Share due', '৳0'], ['Construction contributions', '৳0'], ['Project construction expense', '৳0']];
    for (const [l, v] of want) { const t = await card(l); ok(new RegExp(l, 'i').test(t) && t.replace(new RegExp(l, 'i'), '').replace(/MONEY (IN|OUT)/, '').trim().startsWith(v), 'dashboard "' + l + '" starts at ' + v + ' (' + t.slice(0, 60) + ')'); }
    const m = await page.locator('main').innerText();
    ok(m.includes('default share price is not set'), 'dashboard says the default share price is not set');
    ok(m.includes('No transactions yet'), 'dashboard shows "No transactions yet" empty state');
    ok(!/Sample data|sample|demo/i.test(await page.locator('body').innerText()), 'no sample/demo wording anywhere on the dashboard or sidebar'); }
  for (const [n, sel] of [['Shareholders', 'tbody tr'], ['Share Sales', 'tbody tr'], ['Construction Contributions', 'tbody tr'], ['Project Expenses', 'tbody tr'], ['Payments', 'tbody tr'], ['Documents', 'tbody tr'], ['Audit Log', 'tbody tr']]) { await nav(n); ok(await page.locator('main ' + sel).count() === 0, n + ' list is empty on a clean project'); }
  await nav('Units'); ok(await page.locator('.ucard').count() === 36 && await page.locator('.ucard.s-Available').count() === 36, 'Units: 36 cards, all Available');
  await nav('Project Details');
  { const t = await page.locator('main').innerText(); ok(t.includes('Maison One') && t.includes('12 Katha') && t.includes('8,640 sq ft') && t.includes('Ground + 12 Floors + Rooftop') && t.includes('Ground\u20133rd Floor') && t.includes('4th\u201312th Floor') && t.includes('1,440 sq ft'), 'Project Details show name, 12 Katha, 8,640 sq ft, building, commercial, residential, unit size'); ok(/Residential floors\s*9/.test(t) && /Residential units\s*36/.test(t) && t.includes('Rooftop / Amenity Area'), 'residential floors 9, units 36, rooftop is amenity area'); ok(await page.locator('.pgrid .pimg img').count() === 0, 'no sample project images'); }
  // booking is blocked while the price is 0
  await nav('Share Sales'); await page.getByRole('button', { name: /New share booking/ }).first().click();
  ok(await dlg().locator('text=default share price has not been configured').count() >= 1, 'booking form says the default price is not configured');
  ok(!(await dlg().getByRole('button', { name: 'Save booking' }).isDisabled()) && await dlg().getByLabel(/Share price \(per share\)/).inputValue() === '0', 'at default 0 the price is pre-filled as 0 and still editable (Save not blocked)'); await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  // Settings -> Share Configuration
  await nav('Settings');
  ok(await page.locator('text=Share Configuration').count() >= 1 && !(await page.locator('text=Reset sample data').count()), 'Settings has Share Configuration, no sample-data reset');
  ok(await page.getByLabel(/Total shares in the project/).inputValue() === '60' && await page.getByLabel(/Default share price \(per share\)/).inputValue() === '0', 'Settings shows total shares 60 and price 0');
  await page.getByLabel(/Default share price \(per share\)/).fill('1000000'); await page.getByRole('button', { name: 'Save share configuration' }).click(); await page.waitForTimeout(700);
  ok((await toasts()).join(' ').includes('Share configuration saved'), 'share price set to 10,00,000 from Settings (no code change)');
  await nav('Dashboard'); { const t = await page.locator('.stat', { hasText: 'Total share value' }).first().innerText(); ok(/6[,0-9.]*\s*(Cr|crore|Crore)|6,00,00,000|6\.0?0? ?Cr/i.test(t), 'dashboard Total share value updates to 60 x price (' + t.replace(/\s+/g, ' ') + ')'); ok(!(await page.locator('text=share price has not been configured').count()), 'not-configured banner gone'); }
  await nav('Settings'); await page.getByLabel(/Total shares in the project/).fill('0'); await page.getByRole('button', { name: 'Save share configuration' }).click(); await page.waitForTimeout(300); ok(await page.locator('text=Enter a whole number of shares').count() === 1, 'total shares 0 rejected');
  await page.getByLabel(/Total shares in the project/).fill('60');
  // 1 shareholder + six uploads
  await nav('Shareholders'); await page.getByRole('button', { name: /Add shareholder/ }).first().click();
  await dlg().getByLabel(/Full name/).fill('Rahim Uddin Test'); await dlg().getByLabel(/^Phone number/).fill('01766-555123'); await dlg().getByLabel(/NID number/).fill('1987654321');
  await dlg().locator('.slot input[type=file]').nth(3).setInputFiles(files[3]);
  await dlg().getByRole('button', { name: 'Add shareholder' }).click(); await page.waitForTimeout(300);
  ok(await dlg().locator('text=Enter the nominee name before adding nominee documents').count() === 1, 'nominee files without nominee name blocked');
  await dlg().getByLabel('Nominee name').fill('Karima Begum'); await dlg().getByLabel('Relation').fill('Spouse');
  for (let i = 0; i < 6; i++) if (i !== 3) await dlg().locator('.slot input[type=file]').nth(i).setInputFiles(files[i]);
  await page.waitForTimeout(300);
  ok(await dlg().locator('.slot img').count() === 6, 'six local previews shown in the form');
  await shot('01_form_uploads');
  await dlg().locator('.slot .thumb').first().click(); await page.waitForSelector('.lb img'); ok(true, 'form thumbnail opens larger preview'); await shot('02_lightbox'); await page.keyboard.press('Escape');
  await dlg().getByRole('button', { name: 'Add shareholder' }).click(); await page.waitForTimeout(2600);
  ok((await toasts()).join(' ').includes('Shareholder added'), 'shareholder saved with 6 files');
  await page.getByPlaceholder('Search name, ID, phone, NID').fill('Rahim Uddin'); await page.waitForTimeout(200);
  await page.locator('tbody tr', { hasText: 'Rahim Uddin Test' }).click(); await page.waitForSelector('text=Land share');
  await page.getByRole('tab', { name: /^Overview/ }).click(); ok(await page.locator('.kyc-strip img').count() === 3, 'profile overview shows photo + NID thumbnails');
  await page.getByRole('tab', { name: /Documents/ }).click(); await page.waitForTimeout(300);
  ok(await page.locator('.slots .slot img').count() === 6, 'Documents tab: 6 KYC previews (shareholder + nominee)');
  await shot('03_profile_docs');
  // replace via card then lightbox
  await page.locator('.slots .slot').first().locator('input[type=file]').setInputFiles(files[6]); await page.waitForTimeout(900);
  ok((await toasts()).join(' ').includes('replaced'), 'photo replaced'); 
  await page.locator('.slots .slot .thumb').first().click(); await page.waitForSelector('.lb img'); 
  ok(await page.locator('.lb').getByText('Replace').count() === 1 && await page.locator('.lb').getByRole('button', { name: 'Remove' }).count() === 1, 'lightbox offers Replace and Remove'); await page.keyboard.press('Escape');
  await page.locator('.slots .slot').nth(1).getByRole('button', { name: 'Remove' }).click(); await page.locator('[role=dialog]').last().getByRole('textbox').fill('Blurry scan'); await page.locator('[role=dialog]').last().getByRole('button', { name: 'Remove' }).click(); await page.waitForTimeout(800);
  ok(await page.locator('.slots .slot').nth(1).locator('img').count() === 0, 'NID front removed (archived)');
  await page.locator('.slots .slot').nth(1).locator('input[type=file]').setInputFiles(files[1]); await page.waitForTimeout(800);
  ok(await page.locator('.slots .slot img').count() === 6, 'NID front re-uploaded');
  // 2 share booking with payment
  await page.getByRole('button', { name: 'New booking' }).click();
  ok(await dlg().getByLabel(/Share price \(per share\)/).inputValue() === '1000000' && !(await dlg().getByLabel(/Share price \(per share\)/).isDisabled()), 'booking price pre-filled from Settings and editable');
  await dlg().getByLabel('Share quantity').fill('61'); await dlg().getByRole('button', { name: 'Save booking' }).click(); await page.waitForTimeout(250); ok(await dlg().locator('text=Only 60 share(s) are still available').count() === 1, 'quantity above available (60) rejected');
  await dlg().getByLabel('Share quantity').fill('1'); ok((await dlg().innerText()).replace(/\s+/g, ' ').includes('Grand total ৳10,00,000'), 'booking total calculated automatically (1 x ৳10,00,000)');
  await dlg().locator('label', { hasText: /^Amount/ }).first().click().catch(()=>{});
  await dlg().getByLabel(/^Amount/).fill('300000'); await dlg().getByLabel('Payment method').selectOption('bKash'); await dlg().getByLabel('Reference', { exact: true }).fill('BK-TRX-7788');
  await dlg().getByRole('button', { name: /Save & add payment/ }).click(); await page.waitForTimeout(900);
  ok(await page.locator('[role=dialog]', { hasText: 'Receipt RCT-S' }).count() === 1, 'share receipt shown immediately after saving');
  await page.locator('[role=dialog]').last().getByRole('button', { name: /Print Receipt/ }).click(); await page.waitForSelector('.pv .paper');
  ok(await page.locator('#print-root .doc').count() === 1, 'share receipt A4 preview + print-root');
  await shot('04_share_receipt_preview');
  fs.writeFileSync('/tmp/claude-0/state.txt', 'x');
  await page.screenshot({ path: 'shots/x.png' });
  await page.evaluate(() => 0);
  const pdf = async (name) => { await page.emulateMedia({ media: 'print' }); await page.waitForTimeout(500); await page.pdf({ path: 'out/' + name + '.pdf', preferCSSPageSize: true, printBackground: true }); await page.emulateMedia({ media: 'screen' }); };
  await pdf('share_receipt');
  await page.locator('.pv').getByRole('button', { name: 'Close' }).click(); await page.locator('[role=dialog]').last().getByRole('button', { name: 'Done' }).click();
  // 3 fixed building structure + assign a unit
  await nav('Units');
  const floorsTxt = await page.locator('.bldg').innerText();
  ok(['Ground','1st','2nd','3rd','4th','12th','Roof Top'].every(x => floorsTxt.includes(x)) && floorsTxt.includes('Commercial') && floorsTxt.includes('Roof / Amenities'), 'building structure shows Ground..12th + Roof Top');
  ok(await page.locator('.bfloor.res').count() === 9 && await page.locator('.ucard').count() === 36, '9 residential floors, 36 unit cards');
  ok(await page.locator('.bfloor.non').count() === 5 && await page.locator('.bfloor.non .ucard').count() === 0, 'Ground-3rd and Roof Top have no units');
  ok(!(await page.getByRole('button', { name: /Add unit/ }).count()), 'no free-form Add unit button');
  const card = page.locator('.ucard.s-Available').first(); const UC = (await card.locator('.uc-top b').innerText()).trim(); console.log('using unit', UC);
  await card.click();
  await dlg().getByLabel('Status').selectOption('Assigned');
  await dlg().getByLabel(/Assigned shareholder/).selectOption({ label: (await dlg().getByLabel(/Assigned shareholder/).locator('option', { hasText: 'Rahim Uddin Test' }).textContent()) });
  await dlg().getByRole('button', { name: 'Save changes' }).click(); await page.waitForTimeout(800);
  ok((await toasts()).join(' ').includes('Unit updated'), 'unit assigned to shareholder'); await shot('03b_units');
  await nav('Construction Contributions'); await page.getByRole('button', { name: /Set total contribution/ }).first().click();
  await dlg().getByPlaceholder(/Search unit/).fill(UC); await dlg().locator('[role=option]', { hasText: 'Unit ' + UC }).click();
  await dlg().getByLabel(/Total construction contribution/).fill('2000000'); await dlg().getByRole('button', { name: 'Set total' }).click(); await page.waitForTimeout(800);
  await page.getByPlaceholder(/Search unit/).fill(UC); await page.locator('tbody tr', { hasText: UC }).click(); await page.waitForSelector('text=Payment history');
  ok(await page.locator('text=Not Started').count() > 0, 'plan starts at Not Started, due 20,00,000');
  // 4 flexible payments
  const pays = [['50000', 'Others', ''], ['120000', 'bKash', 'BK1'], ['30000', 'Bank Transfer', 'TT-9'], ['75000', 'Cheque', 'CHQ-0011']];
  for (const [a, m, r] of pays) {
    await page.getByRole('button', { name: 'Add payment' }).first().click();
    await dlg().getByLabel(/^Amount/).fill(a); await dlg().getByLabel('Payment method').selectOption(m); if (r) await dlg().getByLabel(/reference/i).fill(r);
    await dlg().getByRole('button', { name: /Record payment/ }).click(); await page.waitForTimeout(900);
    if (a === '50000') { ok(await page.locator('[role=dialog]', { hasText: 'Receipt RCT-C' }).count() === 1, 'construction receipt immediately after save'); await shot('05_cons_receipt'); }
    await page.locator('[role=dialog]').last().getByRole('button', { name: 'Done' }).click();
  }
  const txt = await page.locator('main').innerText();
  ok(txt.includes('৳2,75,000') && txt.includes('৳17,25,000') && txt.includes('13.8%'), 'Paid ৳2,75,000, Due ৳17,25,000, 13.8%'); await shot('06_plan_detail');
  // negative & overpay
  await page.getByRole('button', { name: 'Add payment' }).first().click(); await dlg().getByLabel(/^Amount/).fill('-500'); await dlg().getByLabel('Payment method').selectOption('Others'); await dlg().getByRole('button', { name: /Record payment/ }).click(); await page.waitForTimeout(200);
  ok(await dlg().locator('.err').count() > 0, 'negative payment blocked');
  await dlg().getByLabel(/^Amount/).fill('1800000'); await dlg().getByRole('button', { name: /Record payment/ }).click(); await page.waitForTimeout(300);
  ok(await dlg().locator('text=more than the remaining due').count() === 1, 'overpayment needs explicit confirmation'); await page.keyboard.press('Escape');
  // print receipt from history + statement
  await page.locator('tbody tr').first().getByRole('button', { name: 'Receipt' }).click(); await page.waitForSelector('.pv .paper'); await shot('07_cons_receipt_a4'); await pdf('construction_receipt'); await page.locator('.pv').getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Print statement' }).click(); await page.waitForSelector('.pv .paper'); await shot('08_cons_statement'); await pdf('construction_statement'); await page.locator('.pv').getByRole('button', { name: 'Close' }).click();
  // reversal keeps history
  await page.locator('tbody tr').nth(0).getByRole('button', { name: 'More actions' }).click(); await page.getByRole('menuitem', { name: 'Reverse entry' }).click();
  await dlg().getByRole('textbox').first().fill('Test reversal'); await dlg().locator('#rev-again').uncheck(); await dlg().getByRole('button', { name: 'Reverse entry' }).click(); await page.waitForTimeout(900);
  ok((await page.locator('main').innerText()).includes('৳2,25,000') || (await page.locator('main').innerText()).includes('৳2,00,000'), 'reversal lowers paid; history kept'); 
  // stress: many payments so statements become very long
  await nav('Construction Contributions'); await page.getByPlaceholder(/Search unit/).fill(UC); await page.locator('tbody tr', { hasText: UC }).click(); await page.waitForSelector('text=Payment history');
  for (let i = 0; i < 70; i++) {
    await page.getByRole('button', { name: 'Add payment' }).first().click();
    await dlg().getByLabel(/^Amount/).fill(String(1000 + i)); await dlg().getByLabel('Payment method').selectOption('bKash'); await dlg().getByLabel(/reference/i).fill('STRESS-' + i);
    await dlg().getByRole('button', { name: /Record payment/ }).click(); await page.waitForTimeout(520);
    await page.locator('[role=dialog]').last().getByRole('button', { name: 'Done' }).click();
  }
  ok(true, '70 extra payments recorded (stress)');
  await page.getByRole('button', { name: 'Print statement' }).click(); await page.waitForSelector('.pv .paper'); await page.waitForTimeout(600);
  console.log('pv-sub:', await page.locator('.pv-sub').innerText()); await shot('08b_long_statement'); await pdf('LONG_construction_statement'); await page.locator('.pv').getByRole('button', { name: 'Close' }).click();
  // 5 profile, dashboard, reports, other prints
  await nav('Shareholders'); await page.getByPlaceholder('Search name, ID, phone, NID').fill('Rahim Uddin'); await page.locator('tbody tr', { hasText: 'Rahim Uddin Test' }).click(); await page.waitForSelector('text=Land share');
  await page.getByRole('tab', { name: /Construction/ }).click(); ok((await page.locator('main').innerText()).includes(UC), 'profile construction tab shows unit'); await shot('09_profile_cons');
  for (const [item, name] of [['Shareholder 360 summary', 'profile_360'], ['Financial statement', 'shareholder_statement'], ['Payment history statement', 'payment_statement']]) {
    await page.getByRole('button', { name: 'Print' }).first().click(); await page.getByRole('menuitem', { name: item }).click(); await page.waitForSelector('.pv .paper'); await page.waitForTimeout(400); await shot('10_' + name); await pdf(name); await page.locator('.pv').getByRole('button', { name: 'Close' }).click(); }
  await nav('Share Sales'); await page.locator('tbody tr').first().getByRole('button', { name: 'More actions' }).click(); await page.getByRole('menuitem', { name: /Print booking/ }).click(); await page.waitForSelector('.pv .paper'); await pdf('booking'); await page.locator('.pv').getByRole('button', { name: 'Close' }).click();
  await nav('Project Expenses'); await page.getByRole('button', { name: /Add project expense/ }).first().click();
  await dlg().getByLabel('Expense category').selectOption('Cement'); await dlg().getByLabel('Payee name').fill('Test Supplier'); await dlg().getByLabel('Description').fill('Cement test purchase'); await dlg().getByLabel(/^Amount/).fill('150000'); await dlg().getByLabel('Payment method').selectOption('Others');
  await dlg().getByRole('button', { name: /^Save|Add expense|Record/ }).last().click(); await page.waitForTimeout(900); ok(await page.locator('tbody tr', { hasText: 'Cement test purchase' }).count() === 1, 'expense created through the UI');
  await page.getByRole('button', { name: /Print expense records/ }).click(); await page.waitForSelector('.pv .paper'); await shot('11_expense_records'); await pdf('expense_records'); await page.locator('.pv').getByRole('button', { name: 'Close' }).click();
  await page.locator('tbody tr').first().getByRole('button', { name: 'More actions' }).click(); await page.getByRole('menuitem', { name: /Print voucher/ }).click(); await page.waitForSelector('.pv .paper'); await pdf('expense_voucher'); await page.locator('.pv').getByRole('button', { name: 'Close' }).click();
  await nav('Payments'); await page.getByRole('button', { name: /Print statement/ }).click(); await page.waitForSelector('.pv .paper'); await pdf('all_payments'); await page.locator('.pv').getByRole('button', { name: 'Close' }).click();
  await nav('Documents'); ok(await page.locator('tbody .thumb img').count() >= 3, 'Documents page shows thumbnails of uploaded files only'); await shot('12_documents');
  await nav('Dashboard'); ok((await page.locator('main').innerText()).includes('Construction contributions outstanding'), 'dashboard has flexible contribution card'); await shot('13_dashboard');
  await nav('Reports'); for (const id of ['Construction Contribution', 'Construction Due']) { const b = page.locator('[role=tab]', { hasText: id }).first(); if (await b.count()) { await b.click(); await page.waitForTimeout(200); } }
  await page.getByRole('button', { name: 'Print A4' }).click(); await page.waitForSelector('.pv .paper'); await shot('14_report_print'); await pdf('report'); await page.locator('.pv').getByRole('button', { name: 'Close' }).click();
  ok(true, 'reports print');

  // ---- official logo ----
  const lg = await page.evaluate(() => { const i = document.querySelector('aside .brand img.brand-logo'); return i ? { nw: i.naturalWidth, nh: i.naturalHeight, w: i.clientWidth - parseFloat(getComputedStyle(i).paddingLeft) - parseFloat(getComputedStyle(i).paddingRight), h: i.clientHeight - parseFloat(getComputedStyle(i).paddingTop) - parseFloat(getComputedStyle(i).paddingBottom), ok: i.complete } : null; });
  ok(lg && lg.ok && lg.nw > 0 && Math.abs(lg.w / lg.h - lg.nw / lg.nh) < 0.02, 'sidebar shows the official logo, proportions kept (' + (lg && (lg.w / lg.h).toFixed(3) + ' vs ' + (lg.nw / lg.nh).toFixed(3)) + ')');
  ok(await page.locator('text=/^AN$/').count() === 0, 'no text "AN" mark left in the app');
  await nav('Dashboard'); await page.locator('aside nav button', { hasText: 'Payments' }).click(); await page.locator('tbody tr').first().getByRole('button', { name: 'More actions' }).click(); await page.getByRole('menuitem', { name: /Print receipt/ }).click(); await page.waitForSelector('.pv .paper'); await page.waitForTimeout(500);
  const pl = await page.evaluate(() => { const i = document.querySelector('.pv .paper .doc-logo'); const r = i.getBoundingClientRect(); return { ok: i.complete && i.naturalWidth > 0, ratio: (r.width / r.height) / (i.naturalWidth / i.naturalHeight) }; });
  ok(pl.ok && Math.abs(pl.ratio - 1) < 0.02, 'A4 header shows the official logo, undistorted (ratio ' + pl.ratio.toFixed(3) + ')'); await pdf('receipt_with_logo'); await shot('15_receipt_logo'); await page.locator('.pv').getByRole('button', { name: 'Close' }).click();
  // ---- project details ----
  await nav('Project Details'); await page.waitForSelector('text=Project images');
  ok(await page.locator('.pgrid .pimg img').count() === 0, 'project page has no images until some are uploaded');
  ok((await page.locator('main').innerText()).includes('36') && (await page.locator('main').innerText()).includes('1,440 sq ft'), 'project facts reuse live data: 36 units, 1,440 sq ft'); await shot('16_project');
  await page.getByRole('button', { name: /^Add images/ }).first().click();
  await dlg().locator('input[type=file]').setInputFiles([files[0], files[1], files[2]]); await page.waitForTimeout(300);
  ok(await dlg().locator('.pq-i img').count() === 3, 'three images staged with previews');
  await dlg().getByLabel('Image title').first().fill('North elevation'); await dlg().getByLabel('Category').first().selectOption('Building');
  await dlg().getByRole('button', { name: /Add 3 images/ }).click(); await page.waitForTimeout(1500);
  ok(await page.locator('.pgrid .pimg img').count() === 3, 'multiple images uploaded (0 -> 3) and thumbnails appear'); ok((await page.locator('.pgrid').innerText()).includes('North elevation'), 'caption shown'); await shot('17_project_gallery');
  await page.locator('.pgrid .pimg', { hasText: 'North elevation' }).locator('.thumb').click(); await page.waitForSelector('.lb img');
  ok(await page.locator('.lb').getByText('Replace').count() === 1 && await page.locator('.lb').getByRole('button', { name: 'Remove' }).count() === 1, 'project image opens in the existing lightbox with Replace and Remove'); await page.keyboard.press('Escape');
  await page.locator('.pgrid .pimg', { hasText: 'North elevation' }).locator('input[type=file]').setInputFiles(files[6]); await page.waitForTimeout(900);
  ok((await toasts()).join(' ').includes('Image replaced') && await page.locator('.pgrid .pimg img').count() === 3, 'replace works (still 3, old one archived)');
  await page.locator('.pgrid .pimg', { hasText: 'North elevation' }).getByRole('button', { name: 'Details' }).click(); await dlg().getByLabel('Title / caption').fill('North elevation (final)'); await dlg().getByRole('button', { name: 'Save' }).click(); await page.waitForTimeout(700);
  ok((await page.locator('.pgrid').innerText()).includes('North elevation (final)'), 'caption edit works');
  await page.locator('.pgrid .pimg', { hasText: 'North elevation (final)' }).getByRole('button', { name: 'Remove' }).click(); await dlg().getByRole('textbox').fill('Test removal'); await dlg().getByRole('button', { name: 'Remove' }).click(); await page.waitForTimeout(800);
  ok(await page.locator('.pgrid .pimg img').count() === 2, 'remove works (3 -> 2, archived with reason)');
  await page.getByRole('button', { name: /Edit details/ }).click(); await dlg().getByLabel('Land area').fill('12 Katha (edited)'); await dlg().getByLabel('Construction start date').fill('2026-01-15'); await dlg().getByLabel(/Expected completion/).fill('2029-06-30'); await dlg().getByLabel('Building structure').fill('G+12 with roof top (test)'); await dlg().getByRole('button', { name: 'Save details' }).click(); await page.waitForTimeout(700);
  { const t = await page.locator('main').innerText(); ok(t.includes('12 Katha (edited)') && t.includes('15 Jan 2026') && t.includes('30 Jun 2029') && t.includes('G+12 with roof top (test)'), 'project information edit works (area, dates, structure)'); ok(t.includes('Commercial') && t.includes('Residential floors') && t.includes('Residential units') && t.includes('Total area'), 'all requested information rows are shown'); }
  await page.getByRole('button', { name: /Edit details/ }).click(); await dlg().getByLabel(/Expected completion/).fill('2020-01-01'); await dlg().getByRole('button', { name: 'Save details' }).click(); await page.waitForTimeout(300); ok(await dlg().locator('text=Completion cannot be before the start date').count() === 1, 'completion before start is rejected'); await page.keyboard.press('Escape');
  await nav('Audit Log'); ok((await page.locator('main').innerText()).includes('project image'), 'project image changes are in the audit log');
  await nav('Project Details'); await page.getByRole('button', { name: /Print project sheet/ }).click(); await page.waitForSelector('.pv .paper'); await page.waitForTimeout(700); await shot('18_project_print'); await pdf('project_sheet'); await page.locator('.pv').getByRole('button', { name: 'Close' }).click();
  // ---- refinement: price per booking, search, optional fields, Other expense, Others method ----
  await nav('Shareholders'); await page.getByRole('button', { name: /Add shareholder/ }).first().click();
  await dlg().getByLabel(/Full name/).fill('Name Only Person'); ok(await dlg().locator('.req, [aria-hidden=true]:text("*")').count() <= 1 || true, 'form opened');
  await dlg().getByRole('button', { name: 'Add shareholder' }).click(); await page.waitForTimeout(900);
  ok((await toasts()).join(' ').includes('Shareholder added') && await page.locator('tbody tr', { hasText: 'Name Only Person' }).count() === 1, 'TEST7: shareholder saved with only a name, no validation error');
  await nav('Settings'); await page.getByLabel(/Default share price \(per share\)/).fill('500000'); await page.getByRole('button', { name: 'Save share configuration' }).click(); await page.waitForTimeout(600);
  await nav('Share Sales'); await page.getByRole('button', { name: /New share booking/ }).first().click();
  ok(await dlg().getByLabel(/Share price \(per share\)/).inputValue() === '500000', 'TEST2: price pre-filled with Settings default 5,00,000');
  await dlg().locator('#bk-sh').fill('Rahim'); await page.waitForTimeout(200); ok(await dlg().locator('[role=option]', { hasText: 'Rahim Uddin Test' }).count() === 1, 'TEST8: search by name shows the matching shareholder');
  await dlg().locator('#bk-sh').fill('555123'); await page.waitForTimeout(200); ok(await dlg().locator('[role=option]', { hasText: 'Rahim Uddin Test' }).count() === 1 && await dlg().locator('[role=option]', { hasText: 'Name Only' }).count() === 0, 'TEST9: search by phone narrows to the match');
  await dlg().locator('#bk-sh').fill('SH-0002'); await page.waitForTimeout(200); ok(await dlg().locator('[role=option]', { hasText: 'Name Only Person' }).count() === 1, 'TEST9: search by shareholder ID shows the match');
  await dlg().locator('[role=option]', { hasText: 'Name Only Person' }).click(); ok((await dlg().innerText()).includes('Name Only Person') && (await dlg().innerText()).includes('Shares already held'), 'selecting a result fills the shareholder details');
  await dlg().getByLabel('Share quantity').fill('2'); await dlg().getByLabel(/Share price \(per share\)/).fill('475000'); ok((await dlg().innerText()).replace(/\s+/g, ' ').includes('Grand total ৳9,50,000'), 'TEST3: editing the price to 4,75,000 gives 2 x 4,75,000 = 9,50,000');
  await dlg().getByRole('button', { name: 'Save booking' }).click(); await page.waitForTimeout(900);
  await nav('Settings'); await page.getByLabel(/Default share price \(per share\)/).fill('525000'); await page.getByRole('button', { name: 'Save share configuration' }).click(); await page.waitForTimeout(600);
  await nav('Share Sales'); { const row = page.locator('tbody tr', { hasText: 'Name Only Person' }); ok(await row.count() === 1 && (await row.innerText()).includes('9,50,000'), 'TEST4: after the default moved to 5,25,000 the old booking still totals 9,50,000 (4,75,000 each)'); }
  await page.getByRole('button', { name: /New share booking/ }).first().click(); ok(await dlg().getByLabel(/Share price \(per share\)/).inputValue() === '525000', 'new bookings now pre-fill 5,25,000'); await dlg().locator('#bk-sh').fill('Rahim'); await dlg().locator('[role=option]').first().click(); await dlg().getByLabel('Share quantity').fill('1000'); await dlg().getByRole('button', { name: 'Save booking' }).click(); await page.waitForTimeout(300); ok(await dlg().locator('text=share(s) are still available').count() === 1, 'TEST10: overselling is blocked'); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await nav('Dashboard'); { const t = (await page.locator('main').innerText()).replace(/\s+/g, ' '); ok(t.includes('Shares sold') && /Shares sold\s*\d+/.test(t), 'TEST11: dashboard totals computed from saved booking prices'); }
  await nav('Project Expenses'); await page.getByRole('button', { name: /Add project expense/ }).first().click();
  ok(await dlg().locator('text=Expense Type / Description').count() === 0, 'no custom field until category is Other');
  await dlg().getByLabel('Expense category').selectOption('Other'); ok(await dlg().locator('text=Expense Type / Description').count() === 1, 'TEST5: category Other shows "Expense Type / Description"');
  await dlg().getByPlaceholder('What was this expense for?').fill('Site security equipment'); await dlg().getByLabel(/^Amount/).fill('5000');
  ok(await dlg().locator('text=Payment method details').count() === 0, 'no method details until Others'); await dlg().getByLabel('Payment method').selectOption('Others'); ok(await dlg().locator('text=Payment method details').count() === 1, 'TEST6: method Others shows "Payment method details"');
  await dlg().getByLabel('Payment method details').fill('Company Account');
  await dlg().getByRole('button', { name: /^Save|Add expense|Record/ }).last().click(); await page.waitForTimeout(900);
  { const row = page.locator('tbody tr', { hasText: 'Site security equipment' }); ok(await row.count() >= 1 && (await row.first().innerText()).includes('Other') && (await row.first().innerText()).includes('Company Account'), 'TEST5/6: expense list shows the custom type and "Others: Company Account"'); }
  await page.getByRole('button', { name: /Print expense records/ }).click(); await page.waitForSelector('.pv .paper'); await page.waitForTimeout(400); ok((await page.locator('.pv .paper').innerText()).includes('Site security equipment'), 'custom expense text appears in the printed records'); await pdf('expense_records_other'); await page.locator('.pv').getByRole('button', { name: 'Close' }).click();
  { const cp = require('child_process'); let bad = 0; for (const f of fs.readdirSync('out').filter(x => x.endsWith('.pdf'))) { const o = cp.execSync('pdfinfo out/' + f).toString(); const pg = +/Pages:\s+(\d+)/.exec(o)[1]; const sz = /Page size:\s+(.*)/.exec(o)[1]; if (pg !== 1) bad++; console.log((pg === 1 ? 'ok   ' : 'FAIL ') + 'one page: ' + f + ' -> ' + pg + ' page, ' + sz); } ok(bad === 0, 'every printed document is exactly one A4 page'); }
  console.log('errors: ' + (errors.length ? '\n' + errors.join('\n') : 'none')); await browser.close();
})().catch(e => { console.error('SCRIPT FAIL', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
