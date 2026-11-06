(()=>{
// Usage: node seed.js  (resets data.db, creates admin user + example data)
const fs=require('fs'),crypto=require('crypto'),path=require('path');const {DatabaseSync}=require('node:sqlite');
const D=process.env.DATA_DIR||__dirname;fs.mkdirSync(D,{recursive:true});const cp=path.join(D,'config.json');
if(!fs.existsSync(cp))fs.writeFileSync(cp,JSON.stringify({company:{name:'Example Epoxy Co.',phone:'(555) 010-0000',email:'office@example-epoxy.test',address:'123 Example St, Anytown'},
 meta_verify_token:'',meta_app_secret:'',meta_page_access_token:'',
 twilio:{account_sid:'',auth_token:'',from_number:'',_note:'Placeholder for future SMS integration - not used in v1'},
 coating_systems:[{name:'Full Flake System',price:6.5},{name:'Metallic Epoxy',price:9.5},{name:'Quartz Broadcast',price:8},{name:'Solid Color Epoxy',price:4.5},{name:'Polyaspartic Clear Topcoat',price:3}],
 addons:[{name:'Crack Repair (per lin ft)',price:8},{name:'Moisture Vapor Barrier (per sq ft)',price:1.5},{name:'Cove Base (per lin ft)',price:12},{name:'Stem Wall Coating (per lin ft)',price:6},{name:'Diamond Grinding Prep (per sq ft)',price:1},{name:'Old Coating Removal (per sq ft)',price:2}]},null,2));
try{fs.unlinkSync(path.join(D,'data.db'))}catch{}
const db=new DatabaseSync(path.join(D,'data.db'));db.exec(fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8'));
const pw=process.env.ADMIN_PASSWORD||crypto.randomBytes(6).toString('base64url');const salt=crypto.randomBytes(8).toString('hex');
const un=process.env.ADMIN_USERNAME||'admin';db.prepare('INSERT INTO users(username,name,salt,hash) VALUES(?,?,?,?)').run(un,'Admin',salt,crypto.scryptSync(pw,salt,32).toString('hex'));
fs.writeFileSync(path.join(D,'CREDENTIALS.txt'),`Epoxy CRM login\nusername: ${un}\npassword: ${process.env.ADMIN_PASSWORD?'(set via ADMIN_PASSWORD env var)':pw}\n\nMeta webhook reads META_VERIFY_TOKEN, META_APP_SECRET, and META_PAGE_ACCESS_TOKEN from the environment.\n`,{mode:0o600});
if(process.env.SEED_EXAMPLE==='0'){console.log('Initialized (no example data)');db.close();return;}
const day=n=>new Date(Date.now()+n*864e5).toISOString().slice(0,10),ts=n=>new Date(Date.now()+n*864e5).toISOString();
const ins=(t,o)=>{const k=Object.keys(o);return db.prepare(`INSERT INTO ${t}(${k})VALUES(${k.map(()=>'?')})`).run(...Object.values(o)).lastInsertRowid;};
const c1=ins('customers',{name:'(Example) Mike Jensen',phone:'555-0101',email:'mike@example.test',address:'410 Oak Ridge Dr',city:'Anytown',notes:'3-car garage, wants flake in Tidal Wave',created_at:ts(-20)});
const c2=ins('customers',{name:'(Example) Sarah Lopez',phone:'555-0102',email:'sarah@example.test',address:'88 Lakeview Ct',city:'Anytown',notes:'Basement metallic, gray/silver',created_at:ts(-15)});
const c3=ins('customers',{name:'(Example) Ridgeway Auto Shop',phone:'555-0103',email:'ops@ridgeway.test',address:'2200 Industrial Pkwy',city:'Anytown',notes:'Commercial quartz, needs weekend install',created_at:ts(-30)});
const L=(o)=>ins('leads',{created_at:ts(-(o.ago||0)),...(delete o.ago,o)});
L({name:'(Example) Tom Becker',phone:'555-0201',email:'tom@example.test',source:'Meta Ads',status:'New',project_type:'Garage - Flake',sq_ft:480,ago:0});
L({name:'(Example) Priya Shah',phone:'555-0202',source:'Meta Ads',status:'New',project_type:'Patio',sq_ft:300,ago:1});
L({name:'(Example) Dan Wu',phone:'555-0203',source:'Referral',status:'Contacted',project_type:'Basement - Metallic',sq_ft:700,ago:3});
const l1=L({customer_id:c1,name:'(Example) Mike Jensen',phone:'555-0101',source:'Meta Ads',status:'Won',project_type:'Garage - Flake',sq_ft:720,ago:20});
const l2=L({customer_id:c2,name:'(Example) Sarah Lopez',phone:'555-0102',source:'Google',status:'Quoted',project_type:'Basement - Metallic',sq_ft:850,ago:15});
L({name:'(Example) Gary Holt',source:'Website',status:'Lost',project_type:'Garage',sq_ft:400,notes:'Went with cheaper bid',ago:25});
const crA=ins('crews',{name:'Crew A',members:'Jose, Ryan',color:'#2563eb',created_at:ts(-60)});
const crB=ins('crews',{name:'Crew B',members:'Luis, Kyle',color:'#16a34a',created_at:ts(-60)});
const it=a=>JSON.stringify(a);
const q1=ins('quotes',{customer_id:c1,lead_id:l1,title:'3-Car Garage Full Flake',status:'Accepted',items:it([{desc:'Full Flake System',qty:720,unit:'sq ft',price:6.5},{desc:'Crack Repair (per lin ft)',qty:40,unit:'lin ft',price:8},{desc:'Stem Wall Coating (per lin ft)',qty:70,unit:'lin ft',price:6}]),tax_rate:0,discount:200,created_at:ts(-18)});
ins('quotes',{customer_id:c2,lead_id:l2,title:'Basement Metallic Epoxy',status:'Sent',items:it([{desc:'Metallic Epoxy',qty:850,unit:'sq ft',price:9.5},{desc:'Moisture Vapor Barrier (per sq ft)',qty:850,unit:'sq ft',price:1.5}]),tax_rate:0,discount:0,valid_until:day(20),created_at:ts(-10)});
const q3=ins('quotes',{customer_id:c3,title:'Shop Floor Quartz + Cove',status:'Accepted',items:it([{desc:'Quartz Broadcast',qty:2400,unit:'sq ft',price:8},{desc:'Cove Base (per lin ft)',qty:200,unit:'lin ft',price:12}]),tax_rate:0,discount:0,created_at:ts(-25)});
const j1=ins('jobs',{customer_id:c1,quote_id:q1,title:'3-Car Garage Full Flake',address:'410 Oak Ridge Dr',start_date:day(-6),end_date:day(-5),crew_id:crA,status:'Completed',total:5220,created_at:ts(-17)});
const j2=ins('jobs',{customer_id:c3,quote_id:q3,title:'Shop Floor Quartz + Cove',address:'2200 Industrial Pkwy',start_date:day(5),end_date:day(7),crew_id:crB,status:'Scheduled',total:21600,created_at:ts(-20)});
ins('jobs',{customer_id:c2,title:'(Example) Site measure & moisture test',address:'88 Lakeview Ct',start_date:day(2),end_date:day(2),crew_id:crA,status:'Scheduled',total:0,created_at:ts(-2)});
const i1=ins('invoices',{customer_id:c1,job_id:j1,number:'INV-1001',status:'Paid',items:db.prepare('SELECT items FROM quotes WHERE id=?').get(q1).items,tax_rate:0,total:5220,due_date:day(8),notes:'Includes discount of $200',created_at:ts(-6)});
const i2=ins('invoices',{customer_id:c3,job_id:j2,number:'INV-1002',status:'Partial',items:db.prepare('SELECT items FROM quotes WHERE id=?').get(q3).items,tax_rate:0,total:21600,due_date:day(10),created_at:ts(-19)});
ins('payments',{invoice_id:i1,amount:1500,method:'Check',kind:'Deposit',paid_on:day(-17),created_at:ts(-17)});
ins('payments',{invoice_id:i1,amount:3720,method:'Card',kind:'Final Payment',paid_on:day(-5),created_at:ts(-5)});
ins('payments',{invoice_id:i2,amount:6480,method:'ACH',kind:'Deposit',paid_on:day(-19),created_at:ts(-19)});
for(const [c,l,t,x,a] of [[c1,l1,'note','Called, wants install before holidays',-19],[c1,null,'job','Install completed by Crew A',-5],[c2,l2,'quote','Quote #2 sent by email',-10],[c3,null,'note','Weekend access via side gate, ask for Rick',-20]])ins('activities',{customer_id:c,lead_id:l,type:t,text:x,created_at:ts(a)});
console.log('Seeded. Credentials in CREDENTIALS.txt');

})();
