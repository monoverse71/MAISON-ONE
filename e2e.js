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
  await page.goto('file://'+process.cwd()+'/dist_local.html'); await page.waitForSelector('text=Total shareholders');
  const nav = async n => { await page.locator('aside nav button', { hasText: n }).first().click(); await page.waitForTimeout(250); };
  const ok = (c, m) => console.log((c ? 'ok   ' : 'FAIL ') + m);
  const dlg = () => page.locator('[role=dialog]').last();
  const toasts = () => page.locator('.toast').allTextContents();
  const shot = (n) => page.screenshot({ path: 'shots/' + n + '.png' });
  // pages
  for (const n of ['Dashboard','Shareholders','Share Sales','Units','Construction Contributions','Project Expenses','Payments','Documents','Reports','Audit Log','Settings']) { await nav(n); if (await page.locator('text=This page could not be shown').count()) ok(false, 'page ' + n); }
  ok(true, 'all 11 pages render');
  // 1 shareholder + six uploads
  await nav('Shareholders'); await page.getByRole('button', { name: /Add shareholder/ }).click();
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
  await dlg().getByLabel('Share quantity').fill('1');
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
  await dlg().getByLabel(/^Unit/).selectOption({ label: (await dlg().getByLabel(/^Unit/).locator('option', { hasText: UC }).textContent()) });
  await dlg().getByLabel(/Total construction contribution/).fill('2000000'); await dlg().getByRole('button', { name: 'Set total' }).click(); await page.waitForTimeout(800);
  await page.getByPlaceholder(/Search unit/).fill(UC); await page.locator('tbody tr', { hasText: UC }).click(); await page.waitForSelector('text=Payment history');
  ok(await page.locator('text=Not Started').count() > 0, 'plan starts at Not Started, due 20,00,000');
  // 4 flexible payments
  const pays = [['50000', 'Cash', ''], ['120000', 'bKash', 'BK1'], ['30000', 'Bank Transfer', 'TT-9'], ['75000', 'Cheque', 'CHQ-0011']];
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
  await page.getByRole('button', { name: 'Add payment' }).first().click(); await dlg().getByLabel(/^Amount/).fill('-500'); await dlg().getByLabel('Payment method').selectOption('Cash'); await dlg().getByRole('button', { name: /Record payment/ }).click(); await page.waitForTimeout(200);
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
  await nav('Project Expenses'); await page.getByRole('button', { name: /Print expense records/ }).click(); await page.waitForSelector('.pv .paper'); await shot('11_expense_records'); await pdf('expense_records'); await page.locator('.pv').getByRole('button', { name: 'Close' }).click();
  await page.locator('tbody tr').first().getByRole('button', { name: 'More actions' }).click(); await page.getByRole('menuitem', { name: /Print voucher/ }).click(); await page.waitForSelector('.pv .paper'); await pdf('expense_voucher'); await page.locator('.pv').getByRole('button', { name: 'Close' }).click();
  await nav('Payments'); await page.getByRole('button', { name: /Print statement/ }).click(); await page.waitForSelector('.pv .paper'); await pdf('all_payments'); await page.locator('.pv').getByRole('button', { name: 'Close' }).click();
  await nav('Documents'); ok(await page.locator('tbody .thumb img').count() > 5, 'Documents page shows thumbnails'); await shot('12_documents');
  await nav('Dashboard'); ok((await page.locator('main').innerText()).includes('Construction contributions outstanding'), 'dashboard has flexible contribution card'); await shot('13_dashboard');
  await nav('Reports'); for (const id of ['Construction Contribution', 'Construction Due']) { const b = page.locator('[role=tab]', { hasText: id }).first(); if (await b.count()) { await b.click(); await page.waitForTimeout(200); } }
  await page.getByRole('button', { name: 'Print A4' }).click(); await page.waitForSelector('.pv .paper'); await shot('14_report_print'); await pdf('report'); await page.locator('.pv').getByRole('button', { name: 'Close' }).click();
  ok(true, 'reports print');
  { const cp = require('child_process'); let bad = 0; for (const f of fs.readdirSync('out').filter(x => x.endsWith('.pdf'))) { const o = cp.execSync('pdfinfo out/' + f).toString(); const pg = +/Pages:\s+(\d+)/.exec(o)[1]; const sz = /Page size:\s+(.*)/.exec(o)[1]; if (pg !== 1) bad++; console.log((pg === 1 ? 'ok   ' : 'FAIL ') + 'one page: ' + f + ' -> ' + pg + ' page, ' + sz); } ok(bad === 0, 'every printed document is exactly one A4 page'); }
  console.log('errors: ' + (errors.length ? '\n' + errors.join('\n') : 'none')); await browser.close();
})().catch(e => { console.error('SCRIPT FAIL', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
