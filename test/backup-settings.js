// Smoke test for backup export/import and Meta env status. Prints pass/fail only.
const {spawn}=require('child_process');
const http=require('http');
const fs=require('fs');
const os=require('os');
const path=require('path');
const crypto=require('crypto');
const {DatabaseSync}=require('node:sqlite');

const ROOT=path.join(__dirname,'..');
const VERIFY='verify-token-fixture';
const APP='app-secret-fixture';
const PAGE='page-token-fixture';
const PASS='test-pass-not-a-secret';
const SECRETS=[VERIFY,APP,PAGE,PASS];
const failures=[];
function check(name,ok,detail){if(ok)console.log('ok  '+name);else{console.log('FAIL '+name+(detail?': '+redact(detail):''));failures.push(name);}}
function redact(s){let t=String(s);for(const secret of SECRETS)t=t.split(secret).join('[redacted]');return t;}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

function startServer(envExtra){
  const data=fs.mkdtempSync(path.join(os.tmpdir(),'epoxy-bak-'));
  const port=36000+crypto.randomInt(2000);
  const env={...process.env,PORT:String(port),DATA_DIR:data,ADMIN_USERNAME:'admin',ADMIN_PASSWORD:PASS,SEED_EXAMPLE:'0'};
  for(const name of ['META_VERIFY_TOKEN','META_APP_SECRET','META_PAGE_ACCESS_TOKEN'])delete env[name];
  Object.assign(env,envExtra);
  const child=spawn(process.execPath,[path.join(ROOT,'server.js')],{env,stdio:['ignore','pipe','pipe']});
  let log='';
  child.stdout.on('data',d=>{log+=d;});
  child.stderr.on('data',d=>{log+=d;});
  let settled=false;
  const ready=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{if(!settled){settled=true;reject(new Error('server did not start'));}},20000);
    child.stdout.on('data',()=>{if(!settled&&log.includes('Epoxy CRM on')){settled=true;clearTimeout(timer);resolve();}});
    child.on('exit',code=>{if(!settled){settled=true;clearTimeout(timer);reject(new Error('server exited '+code+' '+redact(log)));}});
  });
  return {child,port,data,ready,log:()=>log,stop(){child.kill('SIGTERM');}};
}

function req(port,method,pathname,{body,cookie,headers}={}){
  return new Promise((resolve,reject)=>{
    const opts={method,hostname:'127.0.0.1',port,path:pathname,headers:{...(headers||{})}};
    if(cookie)opts.headers.Cookie='sid='+cookie;
    if(body&&!opts.headers['Content-Length'])opts.headers['Content-Length']=Buffer.byteLength(body);
    const r=http.request(opts,res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));});
    r.on('error',reject);
    r.end(body);
  });
}
function sid(res){const sc=res.headers['set-cookie'];const line=Array.isArray(sc)?sc.join(';'):(sc||'');const m=/sid=([^;]+)/.exec(line);return m&&m[1];}
function json(res){return JSON.parse(res.body.toString('utf8'));}
function leaked(buf){const text=Buffer.isBuffer(buf)?buf.toString('utf8'):String(buf);return SECRETS.find(secret=>text.includes(secret))||'';}

async function login(port){
  const res=await req(port,'POST','/api/login',{headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:PASS})});
  return {res,cookie:sid(res)};
}

async function main(){
  const yaml=fs.readFileSync(path.join(ROOT,'render.yaml'),'utf8');
  check('render.yaml plan is free',/plan:\s*free\b/.test(yaml)&&!/^\s*plan:\s*(starter|standard|pro)\b/im.test(yaml)&&!/\bdisk:/i.test(yaml));
  const html=fs.readFileSync(path.join(ROOT,'public/index.html'),'utf8');
  const appHtml=html.split('id="app"')[1]||'';
  check('banner is inside the signed-in shell',appHtml.includes('/tmp/epoxy-data')&&appHtml.includes('DATA_DIR')&&/spin-down/.test(appHtml)&&appHtml.includes('href="#/settings"'));
  check('banner is not on the login form',!(html.split('id="app"')[0].includes('data-banner')));

  const configured=startServer({META_VERIFY_TOKEN:VERIFY,META_APP_SECRET:APP,META_PAGE_ACCESS_TOKEN:PAGE});
  try{
    await configured.ready;
    for(const [method,pathname] of [['GET','/api/backup/export'],['POST','/api/backup/import'],['GET','/api/settings/meta-status']]){
      const res=await req(configured.port,method,pathname,{body:method==='POST'?Buffer.from('nope'):undefined});
      check('unauthenticated '+method+' '+pathname+' rejected',res.status===401&&json(res).error==='auth'&&!leaked(res.body), 'status '+res.status);
    }
    const {res:loginRes,cookie}=await login(configured.port);
    check('login works',loginRes.status===200&&!!cookie);
    const statusRes=await req(configured.port,'GET','/api/settings/meta-status',{cookie});
    const status=json(statusRes);
    check('meta-status booleans when all three are set',statusRes.status===200&&status.META_VERIFY_TOKEN===true&&status.META_APP_SECRET===true&&status.META_PAGE_ACCESS_TOKEN===true&&Object.keys(status).length===3&&Object.values(status).every(v=>typeof v==='boolean')&&!leaked(statusRes.body));
    const settingsRes=await req(configured.port,'GET','/api/settings',{cookie});
    check('coating settings do not echo secrets',settingsRes.status===200&&!leaked(settingsRes.body));
    const challenge=await req(configured.port,'GET','/api/webhooks/meta-leads?hub.mode=subscribe&hub.verify_token='+encodeURIComponent(VERIFY)+'&hub.challenge=ping-challenge');
    check('webhook handshake still returns the challenge',challenge.status===200&&challenge.body.toString()==='ping-challenge');
    const wrong=await req(configured.port,'GET','/api/webhooks/meta-leads?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=ping-challenge');
    check('webhook rejects a bad verify token',wrong.status===403&&wrong.body.toString()==='forbidden');
    const unsigned=await req(configured.port,'POST','/api/webhooks/meta-leads',{headers:{'Content-Type':'application/json'},body:'{}'});
    check('webhook still rejects an unsigned post',unsigned.status===401&&!leaked(unsigned.body));

    const customer=json(await req(configured.port,'POST','/api/customers',{cookie,headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Backup Probe'})}));
    const quote=json(await req(configured.port,'POST','/api/quotes',{cookie,headers:{'Content-Type':'application/json'},body:JSON.stringify({customer_id:customer.id,title:'Probe Quote Alpha',items:[{desc:'Probe',qty:2,price:12.5}]})}));
    const job=json(await req(configured.port,'POST','/api/jobs',{cookie,headers:{'Content-Type':'application/json'},body:JSON.stringify({customer_id:customer.id,quote_id:quote.id,title:'Probe Job Alpha',status:'Scheduled',total:25})}));
    const exported=await req(configured.port,'GET','/api/backup/export',{cookie});
    check('export downloads a sqlite file',exported.status===200&&exported.body.subarray(0,16).toString()==='SQLite format 3\0'&&/attachment;\s*filename="epoxy-crm-backup\.db"/.test(exported.headers['content-disposition']||'')&&!leaked(exported.body), 'status '+exported.status+' bytes '+exported.body.length);
    const snapPath=path.join(os.tmpdir(),'epoxy-snap-'+crypto.randomBytes(4).toString('hex')+'.db');
    fs.writeFileSync(snapPath,exported.body);
    const snapDb=new DatabaseSync(snapPath,{readOnly:true});
    const snapQuote=snapDb.prepare('SELECT title FROM quotes WHERE title=?').get('Probe Quote Alpha');
    const snapJob=snapDb.prepare('SELECT title FROM jobs WHERE title=?').get('Probe Job Alpha');
    snapDb.close();fs.rmSync(snapPath,{force:true});
    check('export file contains the quote and job',!!(snapQuote&&snapJob));

    await req(configured.port,'DELETE','/api/quotes/'+quote.id,{cookie});
    await req(configured.port,'DELETE','/api/jobs/'+job.id,{cookie});
    const beta=json(await req(configured.port,'POST','/api/quotes',{cookie,headers:{'Content-Type':'application/json'},body:JSON.stringify({customer_id:customer.id,title:'Probe Quote Beta',items:[{desc:'Later',qty:1,price:1}]})}));
    const wipedQuotes=json(await req(configured.port,'GET','/api/quotes',{cookie})).map(q=>q.title);
    const wipedJobs=json(await req(configured.port,'GET','/api/jobs',{cookie})).map(j=>j.title);
    check('wipe removes the exported quote and job',!wipedQuotes.includes('Probe Quote Alpha')&&!wipedJobs.includes('Probe Job Alpha')&&wipedQuotes.includes('Probe Quote Beta'));
    const imported=await req(configured.port,'POST','/api/backup/import',{cookie,headers:{'Content-Type':'application/octet-stream'},body:exported.body});
    check('import accepts the export',imported.status===200&&json(imported).ok===true&&!leaked(imported.body), 'status '+imported.status+' '+redact(imported.body.toString()));
    const restoredQuotes=json(await req(configured.port,'GET','/api/quotes',{cookie})).map(q=>q.title);
    const restoredJobs=json(await req(configured.port,'GET','/api/jobs',{cookie})).map(j=>j.title);
    check('import restores the quote and job and drops the later quote',restoredQuotes.includes('Probe Quote Alpha')&&restoredJobs.includes('Probe Job Alpha')&&!restoredQuotes.includes('Probe Quote Beta'));
    const garbage=await req(configured.port,'POST','/api/backup/import',{cookie,headers:{'Content-Type':'application/octet-stream'},body:Buffer.from('this is not a database')});
    const still=json(await req(configured.port,'GET','/api/quotes',{cookie})).map(q=>q.title);
    check('bad import is rejected and data stays',garbage.status===400&&json(garbage).error==='not a sqlite database'&&still.includes('Probe Quote Alpha')&&!leaked(garbage.body));
    check('server log does not contain secret values',!leaked(configured.log()));
    void beta;
  }finally{configured.stop();await sleep(200);fs.rmSync(configured.data,{recursive:true,force:true});}

  const closed=startServer({META_VERIFY_TOKEN:VERIFY,META_PAGE_ACCESS_TOKEN:PAGE});
  try{
    await closed.ready;
    const blocked=await req(closed.port,'GET','/api/webhooks/meta-leads?hub.mode=subscribe&hub.verify_token='+encodeURIComponent(VERIFY)+'&hub.challenge=ping-challenge');
    check('webhook stays fail-closed when META_APP_SECRET is missing',blocked.status===403&&blocked.body.toString()==='forbidden'&&!leaked(blocked.body));
    check('fail-closed log names META_APP_SECRET and not the value',closed.log().includes('META_APP_SECRET')&&!leaked(closed.log()));
    const {cookie}=await login(closed.port);
    const status=json(await req(closed.port,'GET','/api/settings/meta-status',{cookie}));
    check('meta-status marks the missing name false',status.META_VERIFY_TOKEN===true&&status.META_APP_SECRET===false&&status.META_PAGE_ACCESS_TOKEN===true&&!leaked(JSON.stringify(status)));
  }finally{closed.stop();await sleep(200);fs.rmSync(closed.data,{recursive:true,force:true});}

  if(failures.length){console.log(failures.length+' failed');process.exit(1);}
  console.log('all checks passed');
}
main().catch(e=>{console.error('FAIL runner: '+redact(e&&e.stack||e));process.exit(1);});
