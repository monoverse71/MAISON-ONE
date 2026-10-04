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
 ok(Calc.notifications(db).length===1&&/default share price/i.test(Calc.notifications(db)[0].title),'only notification is the optional "default share price not set" hint');
 REPORTS.forEach(rp=>{const x=runReport(rp,db,{from:'',to:'',status:'',q:''});ok(rp.id==='overall'?x.rows.every(r=>r.amount===0):x.rows.length===0,'report empty (zeros only): '+rp.id)});
 // ---- building ----
 { const us=db.units; ok(us.length===36,'36 residential units'); ok(us.every(u=>u.size_sqft===1440),'each 1,440 sq ft'); ok(us.every(u=>u.floor>=4&&u.floor<=12),'none on Ground-3rd or Roof'); ok([0,1,2,3,13].every(f=>us.filter(u=>u.floor===f).length===0),'floors 0-3 and roof hold 0 units'); ok([4,5,6,7,8,9,10,11,12].every(f=>us.filter(u=>u.floor===f).length===4),'4 units on each of 9 floors'); ok(us.every(u=>u.status==='Available'&&!u.shareholder_id),'all units Available and unassigned');
   ok(RES_FLOORS.length===9&&!RES_FLOORS.includes(13),'rooftop is not a residential floor');
   ok(us.reduce((a,u)=>a+u.size_sqft,0)===51840,'total residential area 51,840 sq ft (36 x 1,440)'); }
 // ---- TEST 1/7: shareholder with only a name, price still 0 ----
 const E=(n)=>({data:{full_name:n,phone:'',email:'',profession:'',designation:'',nid:'',address:'',registration_date:'',status:'Active',remarks:''},nominee:{name:'',relation:'',phone:'',nid:'',address:''},files:{}});
 const shA=await S.createShareholder(E('Rahim Ahmed'),'sA'); db=repo.snapshot();
 ok(shA.code==='SH-0001'&&db.shareholders.length===1,'TEST1/7: shareholder saved with only a name');
 ok(db.nominees.length===0&&db.documents.length===0,'no nominee row or documents forced');
 const shB=await S.createShareholder(E('Md. Rahim Uddin'),'sB'); const shC=await S.createShareholder(E('Karim Hossain'),'sC'); db=repo.snapshot();
 // gradual completion
 await S.updateShareholder(shA.id,{data:{full_name:'Rahim Ahmed',phone:'01711-204501',email:'',profession:'',designation:'',nid:'',address:'',registration_date:'',status:'Active',remarks:''},nominee:{name:'',relation:'',phone:'',nid:'',address:''},files:{}},'uA1');
 await S.updateShareholder(shA.id,{data:{full_name:'Rahim Ahmed',phone:'01711-204501',email:'',profession:'',designation:'',nid:'1987415263',address:'Dhaka',registration_date:'',status:'Active',remarks:''},nominee:{name:'Salma',relation:'Spouse',phone:'',nid:'',address:''},files:{}},'uA2'); db=repo.snapshot();
 ok(Calc.byId(db.shareholders,shA.id).nid==='1987415263'&&db.nominees.length===1,'profile completed gradually: phone, then NID/address, then nominee (no nominee NID needed)');
 try{await S.createShareholder(Object.assign(E('Bad'),{data:{full_name:'Bad',phone:'123',email:'',profession:'',designation:'',nid:'',address:'',registration_date:'',status:'Active',remarks:''}}),'sBad');ok(false,'bad phone accepted')}catch(e){ok(e.code==='VALIDATION','a phone number, if typed, must still be valid')}
 try{await S.createShareholder(E('  '),'sBlank');ok(false,'blank name')}catch(e){ok(e.code==='VALIDATION','name is the one required shareholder field')}
 // ---- TEST: booking allowed at default price 0 with a custom price ----
 ok(db.settings[0].default_share_price===0,'default price is still 0');
 const bk0=await S.createBooking({shareholder_id:shC.id,quantity:'1',unit_price:'450000',discount:'',booking_date:'',reference_person:'',remarks:''},'b0'); db=repo.snapshot();
 ok(bk0.booking.unit_price===450000&&bk0.booking.booking_date===TODAY,'booking at default 0 accepted with a custom price; date defaults to today');
 try{await S.createBooking({shareholder_id:shC.id,quantity:'1',unit_price:'0',booking_date:TODAY},'bz');ok(false,'zero price')}catch(e){ok(e.code==='VALIDATION','a booking still needs a price above 0 to have a value')}
 try{await S.createBooking({shareholder_id:shC.id,quantity:'-2',unit_price:'450000',booking_date:TODAY},'bn');ok(false,'neg qty')}catch(e){ok(e.code==='VALIDATION','negative quantity blocked')}
 try{await S.createBooking({shareholder_id:'',quantity:'1',unit_price:'450000',booking_date:TODAY},'bs');ok(false,'no shareholder')}catch(e){ok(e.code==='VALIDATION','shareholder required')}
 // ---- settings validation ----
 try{await S.updateSettings({default_share_price:-5});ok(false,'negative price')}catch(e){ok(e.code==='VALIDATION','negative default price rejected')}
 try{await S.updateSettings({total_shares:0});ok(false,'zero shares')}catch(e){ok(e.code==='VALIDATION','zero total shares rejected')}
 const acct=db.users.filter(u=>u.role==='Accountant')[0]; { const S2=createServices({repo,getDb:()=>db,getUser:()=>acct,refresh:async()=>{db=repo.snapshot();}}); try{await S2.updateSettings({default_share_price:1});ok(false,'accountant changed price')}catch(e){ok(true,'only Admin can change share configuration ('+e.code+')')} }
 // ---- TEST 2/3/4/11: default price, per-booking price, history preserved ----
 await S.updateSettings({default_share_price:500000}); db=repo.snapshot(); ok(db.settings[0].default_share_price===500000,'TEST2: default price set to 5,00,000');
 const bA=await S.createBooking({shareholder_id:shA.id,quantity:'5',unit_price:'500000',discount:'0',booking_date:TODAY},'bA');
 const bB=await S.createBooking({shareholder_id:shB.id,quantity:'5',unit_price:'475000',discount:'0',booking_date:TODAY,payment:{amount:'1000000',payment_date:TODAY,method:'Others',method_details:'Company Account',reference:''}},'bB'); db=repo.snapshot();
 ok(bA.booking.unit_price===500000&&bB.booking.unit_price===475000,'TEST3: A 5 x 5,00,000 and B 5 x 4,75,000 both allowed and saved on the booking');
 await S.updateSettings({default_share_price:525000}); db=repo.snapshot();
 const oldB=Calc.byId(db.share_bookings,bB.booking.id), oldA=Calc.byId(db.share_bookings,bA.booking.id);
 ok(oldB.unit_price===475000&&oldA.unit_price===500000&&Calc.byId(db.share_bookings,bk0.booking.id).unit_price===450000,'TEST4: after the default moves to 5,25,000 every old booking keeps its own price');
 { const sA=Calc.bookingSummary(db,oldA), sB=Calc.bookingSummary(db,oldB); ok(sA.grand===2500000&&sB.grand===2375000,'booking totals unchanged: 25,00,000 and 23,75,000'); }
 let d3=Calc.dashboard(db); ok(d3.soldShareValue===2500000+2375000+450000&&d3.sharesSold===11&&d3.availableShares===49,'TEST11: dashboard sold value uses each saved price (57,25,000), 11 sold / 49 available');
 ok(d3.totalShareValue===60*525000,'reference Total share value uses the current default (60 x 5,25,000)');
 { const rp=runReport(REPORTS.filter(r=>r.id==='sales')[0],db,{from:'',to:'',status:'',q:''}); const js=JSON.stringify(rp.rows); ok(rp.rows.length===3&&js.includes('2375000')&&js.includes('2500000')&&js.includes('450000'),'sales report totals use each booking saved price'); }
 { const sb=REPORTS.filter(r=>/booking|sales|share/.test(r.id)); console.log('share-related reports:',sb.map(r=>r.id).join(',')); }
 // ---- TEST 6: payment method Others ----
 { const pay=db.share_payments[0]; ok(pay.method==='Others'&&pay.method_details==='Company Account'&&methodLabel(pay)==='Others: Company Account','TEST6: method Others + details saved ("'+methodLabel(pay)+'")'); }
 await S.addSharePayment({booking_id:bA.booking.id,amount:'100000',payment_date:TODAY,method:'',reference:'',note:''},'pNoMethod'); db=repo.snapshot(); ok(db.share_payments.filter(p=>p.booking_id===bA.booking.id)[0].method==='','payment saves with no method and no reference');
 ok(METHODS.length===12&&METHODS.join('|')==='Account Transfer|Bank Transfer|BEFTN|RTGS|Cheque|NPSB|Mobile Banking|bKash|Nagad|Rocket|Upay|Others','12 payment methods in the required order');
 await S.addSharePayment({booking_id:bA.booking.id,amount:'50000',payment_date:TODAY,method:'bKash',method_details:'ignored',reference:'X1',note:''},'pB'); db=repo.snapshot(); ok(db.share_payments.filter(p=>p.reference==='X1')[0].method_details==='','method details are kept only for Others');
 try{await S.addSharePayment({booking_id:bA.booking.id,amount:'-5',payment_date:TODAY,method:'',note:''},'pN');ok(false,'neg pay')}catch(e){ok(e.code==='VALIDATION','negative payment blocked')}
 try{await S.addSharePayment({booking_id:bA.booking.id,amount:'100000',payment_date:TODAY,method:'',reference:'',note:''},'pDup');ok(false,'dup silently saved')}catch(e){ok(e.code==='NEEDS_CONFIRMATION','duplicate payment needs confirmation')}
 // ---- TEST 5: Other expense ----
 const ex=await S.createExpense({category:'Other',other_description:'Site security equipment',amount:'25000',expense_date:TODAY,description:'',payee_name:'',method:'Others',method_details:'Cash',reference:'',approval_status:'Approved'},'e1'); db=repo.snapshot();
 { const e=Calc.byId(db.project_expenses,ex.id); ok(e.other_description==='Site security equipment'&&catLabel(e)==='Other: Site security equipment'&&e.description==='Site security equipment','TEST5: Other expense keeps its custom description ('+catLabel(e)+')'); ok(methodLabel(e)==='Others: Cash','expense method Others details saved');
   const rp=runReport(REPORTS.filter(r=>r.id==='expense_records'||/expense/.test(r.id))[0],db,{from:'',to:'',status:'',q:''}); ok(JSON.stringify(rp.rows).includes('Site security equipment'),'custom expense text appears in the expense report'); }
 await S.createExpense({category:'Cement',amount:'1000',expense_date:TODAY,approval_status:'Approved'},'e2'); db=repo.snapshot(); ok(db.project_expenses.length===2,'expense saves with only category, amount and date');
 try{await S.createExpense({category:'',amount:'1000',expense_date:TODAY},'e3');ok(false,'no category')}catch(e){ok(e.code==='VALIDATION','expense still needs a category')}
 try{await S.createExpense({category:'Cement',amount:'-1',expense_date:TODAY},'e4');ok(false,'neg exp')}catch(e){ok(e.code==='VALIDATION','negative expense blocked')}
 // ---- TEST 10: never above the total ----
 db=repo.snapshot(); const left=60-Calc.sharesSold(db);
 try{await S.createBooking({shareholder_id:shA.id,quantity:String(left+1),unit_price:'500000',booking_date:TODAY},'bOver');ok(false,'oversell')}catch(e){ok(e.code==='VALIDATION','TEST10: selling '+(left+1)+' when only '+left+' remain is blocked')}
 await S.createBooking({shareholder_id:shA.id,quantity:String(left),unit_price:'500000',booking_date:TODAY},'bAll'); db=repo.snapshot(); ok(Calc.sharesSold(db)===60&&Calc.dashboard(db).availableShares===0,'all 60 sold, available 0');
 try{await S.createBooking({shareholder_id:shA.id,quantity:'1',unit_price:'500000',booking_date:TODAY},'b61');ok(false,'61st')}catch(e){ok(e.code==='VALIDATION','61st share blocked')}
 try{await S.updateSettings({total_shares:59});ok(false,'below sold')}catch(e){ok(e.code==='VALIDATION','total cannot drop below sold')}
 console.log(amountInWords(275000),'|',amountInWords(12345678));
})();`);
fn(URL).catch(e=>{console.error('FAIL',e);process.exit(1)});
