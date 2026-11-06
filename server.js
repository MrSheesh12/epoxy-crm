// Epoxy CRM v1 — zero-dependency Node (>=22.5) server using built-in node:sqlite
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {DatabaseSync}=require('node:sqlite');
const PORT=process.env.PORT||3100, DIR=__dirname, DATA=process.env.DATA_DIR||__dirname;
if(!fs.existsSync(path.join(DATA,'data.db')))require('./seed.js'); // first boot: init DB (+ example data unless SEED_EXAMPLE=0)
const cfg=JSON.parse(fs.readFileSync(path.join(DATA,'config.json'),'utf8'));
for(const [k,e] of [['meta_verify_token','META_VERIFY_TOKEN'],['meta_app_secret','META_APP_SECRET'],['meta_page_access_token','META_PAGE_ACCESS_TOKEN']])if(process.env[e])cfg[k]=process.env[e];
if(process.env.COMPANY_NAME)cfg.company.name=process.env.COMPANY_NAME;
const db=new DatabaseSync(path.join(DATA,'data.db'));
db.exec(fs.readFileSync(path.join(DIR,'schema.sql'),'utf8'));
const now=()=>new Date().toISOString();
const hash=(p,s)=>crypto.scryptSync(p,s,32).toString('hex');
const all=(q,...a)=>db.prepare(q).all(...a), get=(q,...a)=>db.prepare(q).get(...a), run=(q,...a)=>db.prepare(q).run(...a);
function log(customer_id,lead_id,type,text){run('INSERT INTO activities(customer_id,lead_id,type,text,created_at) VALUES(?,?,?,?,?)',customer_id||null,lead_id||null,type,text,now());}
// generic CRUD config: table -> allowed columns
const T={customers:['name','phone','email','address','city','notes','sms_opt_in'],
 leads:['customer_id','name','phone','email','address','source','status','project_type','sq_ft','notes','meta_lead_id'],
 quotes:['customer_id','lead_id','title','status','items','tax_rate','discount','notes','valid_until'],
 jobs:['customer_id','quote_id','title','address','start_date','end_date','crew_id','status','total','notes'],
 crews:['name','members','color'],
 invoices:['customer_id','job_id','number','status','items','tax_rate','total','due_date','notes'],
 payments:['invoice_id','amount','method','kind','paid_on','note']};
function calcQuote(q){const items=JSON.parse(q.items||'[]');let sub=0;for(const i of items)sub+=(+i.qty||0)*(+i.price||0);const disc=+q.discount||0;const tax=(sub-disc)*(+q.tax_rate||0)/100;return{subtotal:sub,discount:disc,tax,total:sub-disc+tax};}
function invPaid(id){return get('SELECT COALESCE(SUM(amount),0) s FROM payments WHERE invoice_id=?',id).s;}
function refreshInvoice(id){const inv=get('SELECT * FROM invoices WHERE id=?',id);if(!inv)return;const paid=invPaid(id);const st=paid<=0?(inv.status==='Draft'?'Draft':'Unpaid'):paid+0.005>=inv.total?'Paid':'Partial';run('UPDATE invoices SET status=? WHERE id=?',st,id);}
function decorate(t,r){if(!r)return r;
 if(t==='quotes')Object.assign(r,calcQuote(r));
 if(t==='invoices'){r.paid=invPaid(r.id);r.balance=r.total-r.paid;}
 if(['quotes','jobs','invoices','leads'].includes(t)&&r.customer_id){const c=get('SELECT name FROM customers WHERE id=?',r.customer_id);r.customer_name=c&&c.name;}
 if(t==='jobs'&&r.crew_id){const c=get('SELECT name,color FROM crews WHERE id=?',r.crew_id);if(c){r.crew_name=c.name;r.crew_color=c.color;}}
 return r;}
function body(req){return new Promise(res=>{let d='';req.on('data',c=>d+=c);req.on('end',()=>{try{res(d?JSON.parse(d):{})}catch{res({_raw:d})}})});}
function send(res,code,obj,type='application/json'){res.writeHead(code,{'Content-Type':type});res.end(type==='application/json'?JSON.stringify(obj):obj);}
function cookie(req,n){const m=(req.headers.cookie||'').match(new RegExp('(?:^|; )'+n+'=([^;]+)'));return m&&m[1];}
const META_VARS=['META_VERIFY_TOKEN','META_APP_SECRET','META_PAGE_ACCESS_TOKEN'];
function metaEnv(name){return String(process.env[name]||'').trim();}
function metaMissing(){return META_VARS.filter(name=>!metaEnv(name));}
function logMetaClosed(missing){console.error('Meta webhook fail-closed: missing '+missing.join(', ')+'. Refusing unverified webhook traffic.');}
const metaMissingAtBoot=metaMissing();if(metaMissingAtBoot.length)logMetaClosed(metaMissingAtBoot);
function safeEq(a,b){const x=Buffer.from(String(a)),y=Buffer.from(String(b));if(x.length!==y.length)return false;return crypto.timingSafeEqual(x,y);}
function verifyMetaSig(raw,header,secret){const sig=Array.isArray(header)?'':String(header||'');const m=/^sha256=([0-9a-fA-F]{64})$/.exec(sig);if(!m)return false;const expected=crypto.createHmac('sha256',secret).update(raw).digest();const given=Buffer.from(m[1],'hex');return given.length===expected.length&&crypto.timingSafeEqual(given,expected);}
function rawBody(req){return new Promise((resolve,reject)=>{const chunks=[];let n=0,done=false;req.on('data',c=>{if(done)return;n+=c.length;if(n>1e6){done=true;req.pause();reject(Object.assign(new Error('payload too large'),{status:413}));}else chunks.push(Buffer.from(c));});req.on('end',()=>{if(!done)resolve(Buffer.concat(chunks));});req.on('error',e=>{if(!done){done=true;reject(e);}});});}
function leadFromMeta(fields,meta){const f={};for(const x of fields||[])f[(x.name||'').toLowerCase()]=(x.values||[])[0];
 const name=f.full_name||[f.first_name,f.last_name].filter(Boolean).join(' ')||'Meta Lead';
 try{const r=run(`INSERT INTO leads(name,phone,email,address,source,status,project_type,sq_ft,notes,meta_lead_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
  name,f.phone_number||f.phone||'',f.email||'',[f.street_address,f.city,f.zip_code].filter(Boolean).join(', '),'Meta Ads','New',f.project_type||f['what_type_of_project?']||'',+(f.sq_ft||f.square_feet||0)||null,
  'Meta form '+(meta.form_id||'')+' ad '+(meta.ad_id||''),meta.leadgen_id||null,now());
  log(null,r.lastInsertRowid,'lead','Lead received from Meta Lead Ads');return r.lastInsertRowid;}
 catch(e){if(meta.leadgen_id&&String(e.message||'').includes('UNIQUE')&&get('SELECT id FROM leads WHERE meta_lead_id=?',String(meta.leadgen_id)))return null;throw e;}}
function redactMeta(msg){return String(msg||'error').replace(/access_token=[^&\s]+/gi,'access_token=(redacted)');}
async function fetchMetaLead(id){const token=metaEnv('META_PAGE_ACCESS_TOKEN');if(!token)return null;
 const url=new URL('https://graph.facebook.com/v25.0/'+encodeURIComponent(id));
 url.searchParams.set('fields','created_time,id,ad_id,form_id,field_data');
 url.searchParams.set('access_token',token);
 try{const r=await fetch(url,{signal:AbortSignal.timeout(10000)});const data=await r.json().catch(()=>null);
  if(!r.ok||!data||data.error||!Array.isArray(data.field_data)){const why=data&&data.error?(data.error.message||data.error.type||'graph error'):('HTTP '+r.status);console.error('Meta Graph field_data fetch failed for leadgen_id '+id+': '+redactMeta(why));return null;}
  return data;}
 catch(e){console.error('Meta Graph field_data fetch failed for leadgen_id '+id+': '+redactMeta(e&&e.message));return null;}}

http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://x'),p=u.pathname,M=req.method;
 // ---- Meta webhook (public) ----
 if(p==='/api/webhooks/meta-leads'){
  if(M==='GET'){const missing=metaMissing();if(missing.length){logMetaClosed(missing);return send(res,403,'forbidden','text/plain');}
   const mode=u.searchParams.get('hub.mode')||'',token=u.searchParams.get('hub.verify_token')||'',challenge=u.searchParams.get('hub.challenge');
   if(mode==='subscribe'&&challenge!==null&&safeEq(token,metaEnv('META_VERIFY_TOKEN')))return send(res,200,challenge,'text/plain');
   return send(res,403,'forbidden','text/plain');}
  if(M==='POST'){let raw;try{raw=await rawBody(req);}catch(e){return send(res,e.status||400,{error:e.status===413?'payload too large':'bad body'});}
   const missing=metaMissing();if(missing.length){logMetaClosed(missing);return send(res,403,'forbidden','text/plain');}
   if(!verifyMetaSig(raw,req.headers['x-hub-signature-256'],metaEnv('META_APP_SECRET')))return send(res,401,{error:'bad signature'});
   let b;try{b=JSON.parse(raw.toString('utf8'));}catch{return send(res,400,{error:'bad json'});}
   const ids=[];let failed=false;
   for(const ent of b.entry||[])for(const c of ent.changes||[]){if(c.field&&c.field!=='leadgen')continue;const v=c.value||{};
    const leadgenId=v.leadgen_id!=null&&String(v.leadgen_id)!==''?String(v.leadgen_id):'';
    if(!leadgenId)continue;
    if(get('SELECT id FROM leads WHERE meta_lead_id=?',leadgenId))continue;
    let fields=null;const d=await fetchMetaLead(leadgenId);if(d&&Array.isArray(d.field_data))fields=d.field_data;else if(Array.isArray(v.field_data))fields=v.field_data;
    if(!Array.isArray(fields)){failed=true;console.error('Meta webhook: no field_data for leadgen_id '+leadgenId);continue;}
    const id=leadFromMeta(fields,{...v,leadgen_id:leadgenId});if(id)ids.push(id);}
   if(failed)return send(res,502,{error:'lead fetch failed',created:ids});
   return send(res,200,{ok:true,created:ids});}
 }
 // ---- auth ----
 if(p==='/api/login'&&M==='POST'){const b=await body(req);const us=get('SELECT * FROM users WHERE username=?',b.username||'');
  if(!us||hash(b.password||'',us.salt)!==us.hash)return send(res,401,{error:'Invalid login'});
  const tok=crypto.randomBytes(24).toString('hex');run('INSERT INTO sessions(token,user_id,created_at) VALUES(?,?,?)',tok,us.id,now());
  res.setHeader('Set-Cookie',`sid=${tok}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000${req.headers["x-forwarded-proto"]==="https"?"; Secure":""}`);return send(res,200,{ok:true,name:us.name});}
 if(p.startsWith('/api/')){const s=get('SELECT u.id,u.name,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE token=?',cookie(req,'sid')||'');
  if(!s)return send(res,401,{error:'auth'});
  if(p==='/api/logout'){run('DELETE FROM sessions WHERE token=?',cookie(req,'sid'));res.setHeader('Set-Cookie','sid=; Path=/; Max-Age=0');return send(res,200,{ok:true});}
  if(p==='/api/me')return send(res,200,s);
  if(p==='/api/dashboard'){const m=new Date().toISOString().slice(0,7);const today=new Date().toISOString().slice(0,10);
   return send(res,200,{newLeads:get("SELECT COUNT(*) n FROM leads WHERE status='New'").n,
    pipeline:all('SELECT status,COUNT(*) n FROM leads GROUP BY status'),
    openQuotes:all("SELECT * FROM quotes WHERE status IN('Draft','Sent')").map(q=>decorate('quotes',q)),
    upcoming:all("SELECT * FROM jobs WHERE start_date>=? AND status NOT IN('Completed','Cancelled') ORDER BY start_date LIMIT 8",today).map(j=>decorate('jobs',j)),
    revenueMonth:get('SELECT COALESCE(SUM(amount),0) s FROM payments WHERE substr(paid_on,1,7)=?',m).s,
    revenueTotal:get('SELECT COALESCE(SUM(amount),0) s FROM payments').s,
    outstanding:all("SELECT * FROM invoices WHERE status!='Paid'").map(i=>decorate('invoices',i)).reduce((a,i)=>a+i.balance,0),
    recentLeads:all('SELECT * FROM leads ORDER BY created_at DESC LIMIT 6')});}
  // actions
  let m;
  if((m=p.match(/^\/api\/leads\/(\d+)\/convert$/))&&M==='POST'){const l=get('SELECT * FROM leads WHERE id=?',m[1]);let cid=l.customer_id;
   if(!cid){cid=run('INSERT INTO customers(name,phone,email,address,notes,created_at) VALUES(?,?,?,?,?,?)',l.name,l.phone,l.email,l.address,'Converted from lead ('+l.source+')',now()).lastInsertRowid;run('UPDATE leads SET customer_id=? WHERE id=?',cid,l.id);log(cid,l.id,'customer','Customer created from lead');}
   return send(res,200,{customer_id:cid});}
  if((m=p.match(/^\/api\/quotes\/(\d+)\/to-job$/))&&M==='POST'){const q=decorate('quotes',get('SELECT * FROM quotes WHERE id=?',m[1]));const c=get('SELECT * FROM customers WHERE id=?',q.customer_id)||{};
   const id=run('INSERT INTO jobs(customer_id,quote_id,title,address,status,total,created_at) VALUES(?,?,?,?,?,?,?)',q.customer_id,q.id,q.title,c.address||'','Scheduled',q.total,now()).lastInsertRowid;
   run("UPDATE quotes SET status='Accepted' WHERE id=?",q.id);if(q.lead_id)run("UPDATE leads SET status='Won' WHERE id=?",q.lead_id);log(q.customer_id,null,'job',`Quote #${q.id} accepted → Job #${id}`);return send(res,200,{id});}
  if((m=p.match(/^\/api\/jobs\/(\d+)\/invoice$/))&&M==='POST'){const j=get('SELECT * FROM jobs WHERE id=?',m[1]);const q=j.quote_id&&get('SELECT * FROM quotes WHERE id=?',j.quote_id);
   const items=q?q.items:JSON.stringify([{desc:j.title,qty:1,price:j.total}]);const tot=q?calcQuote(q).total:j.total;const n='INV-'+(1000+(get('SELECT COUNT(*) n FROM invoices').n+1));
   const due=new Date(Date.now()+14*864e5).toISOString().slice(0,10);
   const id=run('INSERT INTO invoices(customer_id,job_id,number,status,items,tax_rate,total,due_date,created_at) VALUES(?,?,?,?,?,?,?,?,?)',j.customer_id,j.id,n,'Unpaid',items,q?q.tax_rate:0,tot,due,now()).lastInsertRowid;
   if(q&&q.discount)run('UPDATE invoices SET notes=? WHERE id=?','Includes discount of $'+q.discount,id);
   log(j.customer_id,null,'invoice',`Invoice ${n} created for Job #${j.id}`);return send(res,200,{id});}
  if((m=p.match(/^\/api\/customers\/(\d+)\/full$/))){const id=m[1];return send(res,200,{customer:get('SELECT * FROM customers WHERE id=?',id),
   activities:all('SELECT * FROM activities WHERE customer_id=? OR lead_id IN(SELECT id FROM leads WHERE customer_id=?) ORDER BY created_at DESC',id,id),
   leads:all('SELECT * FROM leads WHERE customer_id=?',id),quotes:all('SELECT * FROM quotes WHERE customer_id=?',id).map(q=>decorate('quotes',q)),
   jobs:all('SELECT * FROM jobs WHERE customer_id=?',id).map(j=>decorate('jobs',j)),invoices:all('SELECT * FROM invoices WHERE customer_id=?',id).map(i=>decorate('invoices',i))});}
  if(p==='/api/activities'&&M==='POST'){const b=await body(req);log(b.customer_id,b.lead_id,b.type||'note',b.text);return send(res,200,{ok:true});}
  if(p==='/api/activities'){const lid=u.searchParams.get('lead_id');return send(res,200,all('SELECT * FROM activities WHERE lead_id=? ORDER BY created_at DESC',lid));}
  if(p==='/api/settings')return send(res,200,{coating_systems:cfg.coating_systems,addons:cfg.addons,company:cfg.company});
  // generic CRUD
  if((m=p.match(/^\/api\/(\w+)(?:\/(\d+))?$/))&&T[m[1]]){const t=m[1],id=m[2],cols=T[t];
   if(M==='GET'&&!id){let q=`SELECT * FROM ${t}`,a=[];const f=u.searchParams.get('customer_id');if(f){q+=' WHERE customer_id=?';a.push(f);}
    if(t==='payments'&&u.searchParams.get('invoice_id')){q+=' WHERE invoice_id=?';a.push(u.searchParams.get('invoice_id'));}
    return send(res,200,all(q+' ORDER BY id DESC',...a).map(r=>decorate(t,r)));}
   if(M==='GET')return send(res,200,decorate(t,get(`SELECT * FROM ${t} WHERE id=?`,id)));
   const b=await body(req);for(const k of ['items'])if(b[k]&&typeof b[k]!=='string')b[k]=JSON.stringify(b[k]);
   const ks=cols.filter(c=>c in b);
   if(M==='POST'){if(t==='invoices'&&!b.number)b.number='INV-'+(1000+get('SELECT COUNT(*) n FROM invoices').n+1),ks.push('number');
    const r=run(`INSERT INTO ${t}(${[...ks,'created_at'].join(',')}) VALUES(${[...ks,0].map(()=>'?').join(',')})`,...ks.map(k=>b[k]??null),now());
    const nid=r.lastInsertRowid;
    if(t==='leads')log(b.customer_id,nid,'lead',`Lead created (${b.source||'Manual'})`);
    if(t==='quotes')log(b.customer_id,b.lead_id,'quote',`Quote #${nid} created`);
    if(t==='payments'){const inv=get('SELECT * FROM invoices WHERE id=?',b.invoice_id);refreshInvoice(b.invoice_id);log(inv.customer_id,null,'payment',`${b.kind||'Payment'} $${(+b.amount).toFixed(2)} on ${inv.number}`);}
    return send(res,200,{id:nid});}
   if(M==='PUT'){const old=get(`SELECT * FROM ${t} WHERE id=?`,id);if(ks.length)run(`UPDATE ${t} SET ${ks.map(k=>k+'=?').join(',')} WHERE id=?`,...ks.map(k=>b[k]??null),id);
    if(t==='leads'&&b.status&&b.status!==old.status){log(old.customer_id,id,'status',`Lead status ${old.status} → ${b.status}`);if(b.status==='Quoted'&&!old.customer_id){}}
    if(t==='jobs'&&b.status&&b.status!==old.status)log(old.customer_id,null,'job',`Job #${id} ${old.status} → ${b.status}`);
    if(t==='invoices')refreshInvoice(id);
    return send(res,200,{ok:true});}
   if(M==='DELETE'){if(t==='payments'){const pm=get('SELECT * FROM payments WHERE id=?',id);run('DELETE FROM payments WHERE id=?',id);refreshInvoice(pm.invoice_id);}else run(`DELETE FROM ${t} WHERE id=?`,id);return send(res,200,{ok:true});}
  }
  return send(res,404,{error:'not found'});}
 // ---- static ----
 let fp=path.join(DIR,'public',p==='/'?'index.html':p);if(!fp.startsWith(path.join(DIR,'public'))||!fs.existsSync(fp)||fs.statSync(fp).isDirectory())fp=path.join(DIR,'public','index.html');
 const ext={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[path.extname(fp)]||'application/octet-stream';
 res.writeHead(200,{'Content-Type':ext});fs.createReadStream(fp).pipe(res);
}catch(e){console.error(e);send(res,500,{error:String(e.message)});}}).listen(PORT,'0.0.0.0',()=>console.log('Epoxy CRM on :'+PORT));
