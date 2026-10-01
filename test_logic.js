const fs=require('fs');
const files=['00_core','01_seed','02_repo','03_calc','04_services','05_reports'];
const src=files.map(f=>fs.readFileSync('src/'+f+'.js','utf8')).join('\n');
const fn=new Function('URL',src+`
;return (async()=>{
 const repo=createRepository(); let db=await repo.loadAll();
 const user=db.users[0];
 const S=createServices({repo,getDb:()=>db,getUser:()=>user,refresh:async()=>{db=repo.snapshot();}});
 const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m); if(!c) process.exitCode=1;};
 const d=Calc.dashboard(db);
 console.log('cons planned',d.consPlanned,'collected',d.consCollected,'due',d.consDue,'plans',d.consPlans,'completed',d.consCompleted,'notStarted',d.consNotStarted);
 ok(!db.construction_installments,'no construction_installments table');
 ok(d.consTop.length>0,'consTop populated');
 // user's example: total 20,00,000; payments 50k,1.2L,30k,75k
 const a301=db.construction_plans[0]; const pc0=Calc.plan(db,a301);
 ok(pc0.total===2000000&&pc0.paid===275000&&pc0.due===1725000&&pc0.pctExact===13.8||pc0.pctExact===13.75,'A-301 example: total 20,00,000 paid 2,75,000 due 17,25,000 pct '+pc0.pctExact);
 // building structure
 { const us=db.units; ok(us.length===36,'36 units: '+us.length); ok(us.every(u=>u.size_sqft===1440),'all 1440 sq ft'); ok(us.every(u=>u.floor>=4&&u.floor<=12),'units only on floors 4-12'); ok([4,5,6,7,8,9,10,11,12].every(f=>us.filter(u=>u.floor===f).length===4),'4 units per floor'); ok(new Set(us.map(u=>u.code)).size===36,'unique codes'); ok(us.every(u=>u.code===u.floor+u.unit_no),'codes follow floor+letter');
  for(const bad of [{code:'2A',floor:'2'},{code:'13A',floor:'13'},{code:'0B',floor:'0'},{code:'A-301',floor:'3'},{code:'4A',floor:'4'}]){ try{await S.saveUnit(null,Object.assign({size_sqft:'1440',status:'Available',shareholder_id:'',remarks:''},bad),'bad'+bad.code);ok(false,'created '+bad.code)}catch(e){ok(e.code==='VALIDATION','blocked creating unit '+bad.code)} }
  try{await S.saveUnit(null,{code:'5A',floor:'5',size_sqft:'1200',status:'Available',shareholder_id:'',remarks:''},'sz');ok(false,'size')}catch(e){ok(e.code==='VALIDATION','wrong size/duplicate blocked')} }
 { const d0=repo.snapshot(); const ps=d0.construction_plans.slice(0,9); ok(ps.length>=9&&ps.every(p=>{const u=Calc.byId(d0.units,p.unit_id);return u&&u.shareholder_id===p.shareholder_id&&/^(4|5|6|7|8|9|10|11|12)[A-D]$/.test(u.code)}),'seed construction plans still match their unit + shareholder: '+ps.map(p=>Calc.byId(d0.units,p.unit_id).code).join(','));
  ok(d0.construction_payments.every(p=>Calc.byId(d0.construction_plans,p.plan_id).unit_id===p.unit_id),'construction payments still point at the right unit'); }
 // plan -> flexible payments
 db=repo.snapshot(); const unit=db.units.filter(u=>u.status==='Available')[0];
 await S.saveUnit(unit.id,{code:unit.code,floor:String(unit.floor),size_sqft:'1440',status:'Assigned',shareholder_id:'sh_0011',assigned_date:TODAY,remarks:''},'u1');
 db=repo.snapshot();
 const planId=await S.createPlan({unit_id:unit.id,total_amount:'2000000'},'p1');
 for (const [i,amt] of [50000,120000,30000,75000].entries()) await S.addConstructionPayment({plan_id:planId,amount:amt,payment_date:TODAY,method:i%2?'bKash':'Cash',reference:i%2?'BK'+i:''},'cp'+i);
 const plan=Calc.byId(db.construction_plans,planId), pc=Calc.plan(db,plan);
 ok(pc.paid===275000&&pc.due===1725000&&pc.pctExact===13.8||pc.pctExact===13.75,'new plan paid '+pc.paid+' due '+pc.due+' pct '+pc.pctExact+' status '+pc.status);
 try{await S.addConstructionPayment({plan_id:planId,amount:-5,payment_date:TODAY,method:'Cash'},'x1');ok(false,'negative allowed')}catch(e){ok(e.code==='VALIDATION','negative amount blocked')}
 try{await S.addConstructionPayment({plan_id:planId,amount:9999999,payment_date:TODAY,method:'Cash'},'x2');ok(false,'overpay silent')}catch(e){ok(e.code==='NEEDS_CONFIRMATION','overpay needs confirmation')}
 try{await S.addConstructionPayment({plan_id:planId,amount:50000,payment_date:TODAY,method:'Cash'},'x3');ok(false,'dup silent')}catch(e){ok(e.code==='NEEDS_CONFIRMATION','duplicate needs confirmation')}
 const first=db.construction_payments.filter(p=>p.plan_id===planId)[0];
 await S.reverseConstructionPayment(first.id,'test');
 ok(Calc.plan(db,plan).paid===225000,'reversal reduces paid to 2,25,000');
 try{await S.updatePlanTotal(planId,100000,'x');ok(false,'total below paid allowed')}catch(e){ok(true,'total below paid blocked')}
 await S.updatePlanTotal(planId,2500000,'scope increase'); ok(Calc.byId(db.construction_plans,planId).total_amount===2500000,'total updated with reason');
 // documents: nominee slots
 const fake=(n,t)=>Object.assign(new Blob(['x'.repeat(1234)],{type:t||'image/png'}),{name:n});
 const sh=await S.createShareholder({data:{full_name:'Doc Tester',phone:'01711-999888',email:'',profession:'',designation:'',nid:'1112223334',address:'',registration_date:TODAY,status:'Active',remarks:''},nominee:{name:'Nom One',relation:'Spouse',phone:'',nid:'',address:''},files:{photo:fake('p.png'),nid_front:fake('f.png'),nid_back:fake('b.png'),nominee_photo:fake('np.png'),nominee_nid_front:fake('nf.png'),nominee_nid_back:fake('nb.pdf','application/pdf')}},'d1');
 db=repo.snapshot(); const shr=Calc.byId(db.shareholders,sh.id), nom=db.nominees.filter(n=>n.shareholder_id===sh.id)[0];
 ok(shr.photo_doc_id&&shr.nid_front_doc_id&&shr.nid_back_doc_id,'shareholder photo + NID docs linked');
 ok(nom.photo_doc_id&&nom.nid_front_doc_id&&nom.nid_back_doc_id,'nominee photo + NID docs linked');
 const codes=db.documents.filter(d=>d.related_id===sh.id||d.related_id===nom.id).map(d=>d.code); ok(new Set(codes).size===codes.length,'document codes unique: '+codes.join(','));
 await S.setPersonDocument({owner:'shareholder',ownerId:sh.id,slot:'photo',file:fake('p2.png')});
 db=repo.snapshot(); const old=Calc.byId(db.documents,shr.photo_doc_id); ok(old.archived_at,'replaced photo archived, not deleted');
 await S.removePersonDocument({owner:'nominee',ownerId:nom.id,slot:'nid_back',reason:'wrong file'});
 db=repo.snapshot(); ok(db.nominees.filter(n=>n.id===nom.id)[0].nid_back_doc_id===null,'nominee NID back removed (archived)');
 try{await S.setPersonDocument({owner:'shareholder',ownerId:sh.id,slot:'photo',file:fake('x.exe','application/x-msdownload')});ok(false,'bad type accepted')}catch(e){ok(e.code==='VALIDATION','non-image/PDF rejected')}
 REPORTS.forEach(rp=>{const x=runReport(rp,db,{from:'',to:'',status:'',q:''});console.log('report',rp.id,x.rows.length)});
 console.log('notifications',Calc.notifications(db).map(n=>n.title));
 console.log(amountInWords(275000),'|',amountInWords(12345678),'|',amountInWords(1725000));
})();`);
fn(URL).catch(e=>{console.error('FAIL',e);process.exit(1)});
