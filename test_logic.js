const fs=require('fs');
const files=['00_core','01_seed','02_repo','03_calc','04_services','05_reports'];
const src=files.map(f=>fs.readFileSync('src/'+f+'.js','utf8')).join('\n');
const fn=new Function('URL',src+`
;return (async()=>{
 const repo=createRepository(); let db=await repo.loadAll();
 const user=db.users.filter(u=>u.role==='Admin')[0];
 const S=createServices({repo,getDb:()=>db,getUser:()=>user,refresh:async()=>{db=repo.snapshot();}});
 const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m); if(!c) process.exitCode=1;};
 const st=db.settings[0], d=Calc.dashboard(db);
 // ---- clean initial state ----
 const FIN=['shareholders','nominees','share_bookings','share_payments','construction_plans','construction_payments','contractors','contract_installments','project_expenses','documents','audit_logs'];
 FIN.forEach(t=>ok(db[t].length===0,'seed table empty: '+t));
 ok(Object.keys(db).every(t=>!Array.isArray(db[t])||db[t].every(r=>!r._demo)),'no row is flagged _demo');
 ok(st.project_name==='Maison One'&&st.company_name==='Apon Niketon Holdings','project Maison One, company Apon Niketon Holdings');
 ok(st.project_type==='Residential Project'&&st.land_area==='12 Katha'&&st.total_area==='8,640 sq ft','type, 12 Katha, 8,640 sq ft');
 ok(st.total_shares===60,'Total Shares = 60'); ok(st.default_share_price===0,'Share Price = 0');
 ok(d.shareholders===0&&d.sharesSold===0&&d.availableShares===60&&d.totalShares===60,'0 shareholders, 0 sold, 60 available');
 ok(d.sharePrice===0&&d.priceSet===false&&d.totalShareValue===0&&d.soldShareValue===0&&d.shareCollected===0&&d.shareDue===0,'price 0, total share value 0, collection 0, due 0');
 ok(d.consCollected===0&&d.consPlanned===0&&d.expense===0&&d.fund===0,'construction contributions 0, expenses 0');
 ok(d.recentPayments.length===0&&d.recentBookings.length===0&&d.recentExpenses.length===0&&d.upcoming.length===0&&d.consTop.length===0,'no recent transactions / upcoming / outstanding rows');
 ok(Calc.notifications(db).length===1&&/not configured/.test(Calc.notifications(db)[0].title),'only notification is "share price not configured"');
 REPORTS.forEach(rp=>{const x=runReport(rp,db,{from:'',to:'',status:'',q:''});ok(rp.id==='overall'?x.rows.every(r=>r.amount===0):x.rows.length===0,'report empty (zeros only): '+rp.id)});
 // ---- building ----
 { const us=db.units; ok(us.length===36,'36 residential units'); ok(us.every(u=>u.size_sqft===1440),'each 1,440 sq ft'); ok(us.every(u=>u.floor>=4&&u.floor<=12),'none on Ground-3rd or Roof'); ok([0,1,2,3,13].every(f=>us.filter(u=>u.floor===f).length===0),'floors 0-3 and roof hold 0 units'); ok([4,5,6,7,8,9,10,11,12].every(f=>us.filter(u=>u.floor===f).length===4),'4 units on each of 9 floors'); ok(us.every(u=>u.status==='Available'&&!u.shareholder_id),'all units Available and unassigned');
   ok(RES_FLOORS.length===9&&!RES_FLOORS.includes(13),'rooftop is not a residential floor');
   ok(us.reduce((a,u)=>a+u.size_sqft,0)===51840,'total residential area 51,840 sq ft (36 x 1,440)'); }
 // ---- booking blocked at price 0 ----
 const sh=await S.createShareholder({data:{full_name:'Test Holder',phone:'01711-999888',email:'',profession:'',designation:'',nid:'1112223334',address:'',registration_date:TODAY,status:'Active',remarks:''},nominee:{name:'',relation:'',phone:'',nid:'',address:''},files:{}},'sh1');
 try{await S.createBooking({shareholder_id:sh.id,quantity:'1',unit_price:'500000',discount:'0',booking_date:TODAY},'b0');ok(false,'booking at price 0 allowed')}catch(e){ok(e.code==='PRICE_NOT_SET','booking blocked while price is 0 (even if a price is typed in)')}
 ok(db.share_bookings.length===0,'no booking row created at price 0');
 // ---- settings validation ----
 try{await S.updateSettings({default_share_price:-5});ok(false,'negative price')}catch(e){ok(e.code==='VALIDATION','negative price rejected')}
 try{await S.updateSettings({total_shares:0});ok(false,'zero shares')}catch(e){ok(e.code==='VALIDATION','zero total shares rejected')}
 const acct=db.users.filter(u=>u.role==='Accountant')[0]; { const S2=createServices({repo,getDb:()=>db,getUser:()=>acct,refresh:async()=>{db=repo.snapshot();}}); try{await S2.updateSettings({default_share_price:1});ok(false,'accountant changed price')}catch(e){ok(e.code==='FORBIDDEN'||e.code==='PERMISSION','only Admin can change share configuration ('+e.code+')')} }
 // ---- set price from Settings, no code change ----
 await S.updateSettings({default_share_price:1000000,share_name:'Land Share',share_remarks:'test'});
 db=repo.snapshot(); let d1=Calc.dashboard(db);
 ok(d1.sharePrice===1000000&&d1.priceSet&&d1.totalShareValue===60000000,'price 10,00,000 -> total share value 6,00,00,000 (60 x price)');
 ok(Calc.notifications(db).length===0,'price notification clears once configured');
 const bk=await S.createBooking({shareholder_id:sh.id,quantity:'10',unit_price:'1',discount:'0',booking_date:TODAY,payment:{amount:'2500000',payment_date:TODAY,method:'Cash',reference:''}},'b1');
 db=repo.snapshot(); ok(bk.booking.unit_price===1000000,'booking uses Settings price, typed price ignored');
 let d2=Calc.dashboard(db);
 ok(d2.sharesSold===10&&d2.availableShares===50&&d2.totalShares===60,'10 sold -> 50 available of 60');
 ok(d2.soldShareValue===10000000&&d2.shareCollected===2500000&&d2.shareDue===7500000&&d2.totalShareValue===60000000,'sold value 1,00,00,000; collected 25,00,000; due 75,00,000; total value 6,00,00,000');
 // ---- never above 60 ----
 try{await S.createBooking({shareholder_id:sh.id,quantity:'51',unit_price:'1000000',discount:'0',booking_date:TODAY},'b2');ok(false,'51 allowed')}catch(e){ok(e.code==='VALIDATION','cannot book 51 when 50 available')}
 try{await S.createBooking({shareholder_id:sh.id,quantity:'0',unit_price:'1000000',discount:'0',booking_date:TODAY},'b3');ok(false,'0 allowed')}catch(e){ok(e.code==='VALIDATION','quantity 0 rejected')}
 await S.createBooking({shareholder_id:sh.id,quantity:'50',unit_price:'1000000',discount:'0',booking_date:TODAY},'b4'); db=repo.snapshot();
 ok(Calc.dashboard(db).availableShares===0&&Calc.sharesSold(db)===60,'all 60 sold -> available 0');
 try{await S.createBooking({shareholder_id:sh.id,quantity:'1',unit_price:'1000000',discount:'0',booking_date:TODAY},'b5');ok(false,'61st')}catch(e){ok(e.code==='VALIDATION','new booking blocked at 60/60')}
 try{await S.updateSettings({total_shares:59});ok(false,'total below sold')}catch(e){ok(e.code==='VALIDATION','total shares cannot drop below sold (60)')}
 await S.updateSettings({total_shares:70}); db=repo.snapshot(); ok(Calc.dashboard(db).availableShares===10,'Settings raising total to 70 re-opens 10 shares');
 // price change updates totals automatically
 await S.updateSettings({default_share_price:2000000}); db=repo.snapshot(); ok(Calc.dashboard(db).totalShareValue===140000000,'new price 20,00,000 x 70 = 14,00,00,000 automatically');
 console.log(amountInWords(275000),'|',amountInWords(12345678));
})();`);
fn(URL).catch(e=>{console.error('FAIL',e);process.exit(1)});
