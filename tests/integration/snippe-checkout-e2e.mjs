// The whole checkout chain against a FAKE Snippe on loopback (no real provider, no real money):
// catalogue -> POST /v1/payments -> the exact request our server sends to the provider -> pending -> the provider's
// signed webhook -> entitlement -> paid downloads. Also failure/cancel, forged signature and wrong-amount cases.
// This proves OUR side is wired correctly; it is not provider-sandbox evidence (see docs/PAYMENTS.md go-live checklist).
import {readFileSync} from 'node:fs';
import http from 'node:http';
import {randomUUID,randomBytes,createHmac} from 'node:crypto';
import assert from 'node:assert/strict';
import {loadEnv} from '../../apps/api/src/env.ts';import {getPool} from '../../apps/api/src/db.ts';import {buildServer} from '../../apps/api/src/server.ts';
loadEnv();
const received=[];let nextRef=0;
const provider=http.createServer((req,res)=>{let body='';req.on('data',c=>body+=c);req.on('end',()=>{
 const json=body?JSON.parse(body):null;received.push({method:req.method,url:req.url,auth:req.headers.authorization,idem:req.headers['idempotency-key'],body:json});
 if(req.method==='POST'&&req.url==='/v1/payments'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({status:'success',data:{reference:'pi_mock_'+(++nextRef)}}));}
 else{res.writeHead(404);res.end('{}');}
});});
await new Promise(r=>provider.listen(0,'127.0.0.1',r));
const secret=randomBytes(32).toString('hex');
Object.assign(process.env,{SNIPPE_API_BASE:`http://127.0.0.1:${provider.address().port}`,SNIPPE_API_KEY:'snp_mockkey',SNIPPE_WEBHOOK_SECRET:secret,STUDIO_CHECKOUT_ENABLED:'true',STUDIO_PAYMENT_APPROVED:'true'});
const pool=getPool(),app=buildServer();app.log.level='silent';await app.ready();
const gw=`http://127.0.0.1:${process.env.API_GW_HTTP_PORT}`;
const admin={apikey:process.env.SERVICE_ROLE_KEY,Authorization:`Bearer ${process.env.SERVICE_ROLE_KEY}`,'Content-Type':'application/json'};
const users=[],objects=[],checks=[];
async function account(){const email=`snippe-${randomUUID()}@example.invalid`,password=`Aa1!${randomBytes(16).toString('hex')}`;let r=await fetch(gw+'/auth/v1/admin/users',{method:'POST',headers:admin,body:JSON.stringify({email,password,email_confirm:true})});assert(r.ok);const u=await r.json();users.push(u.id);r=await fetch(gw+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:process.env.ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password})});const s=await r.json();return {id:u.id,email,headers:{authorization:`Bearer ${s.access_token}`}};}
async function job(a){const ws=(await pool.query('select id from workspaces where created_by=$1 and is_personal=true',[a.id])).rows[0].id;const key=`${ws}/outputs/${randomUUID()}.mp4`;objects.push(key);const r=await fetch(gw+'/storage/v1/object/media/'+key,{method:'POST',headers:{...admin,'Content-Type':'video/mp4'},body:readFileSync('../../tests/fixtures/media/synthetic-remux-test.mov')});assert(r.ok);
 const up=(await pool.query(`insert into upload_sessions(workspace_id,created_by,object_key,declared_filename,declared_size_bytes,expires_at,state) values($1,$2,$3,'t.mov',1024,now()+interval '1 hour','completed') returning id`,[ws,a.id,key])).rows[0].id;
 const ma=(await pool.query(`insert into media_assets(workspace_id,created_by,upload_session_id,object_key,size_bytes,retain_until) values($1,$2,$3,$4,1024,now()+interval '1 hour') returning id`,[ws,a.id,up,key])).rows[0].id;
 return (await pool.query(`insert into jobs(workspace_id,created_by,media_asset_id,recipe,status,output_object_key,output_retain_until) values($1,$2,$3,'platform_optimize','succeeded',$4,now()+interval '5 minutes') returning id`,[ws,a.id,ma,key])).rows[0].id;}
function signed(event){const raw=JSON.stringify(event),ts=String(Math.floor(Date.now()/1000));return {raw,headers:{'content-type':'application/json','x-webhook-timestamp':ts,'x-webhook-signature':createHmac('sha256',secret).update(ts+'.').update(raw).digest('hex')}};}
const hook=(event,tamper)=>{const s=signed(event);return app.inject({method:'POST',url:'/webhooks/snippe',headers:tamper?{...s.headers,'x-webhook-signature':'0'.repeat(64)}:s.headers,payload:s.raw});};
const providerEvent=(sent,type,amount)=>({id:'evt_'+randomBytes(10).toString('hex'),api_version:'2026-01-25',type:'payment.'+type,data:{status:type,reference:'pi_mock_'+nextRef,amount:{value:amount,currency:'TZS'},metadata:sent.metadata}});
const pay=(a,planCode)=>app.inject({method:'POST',url:'/v1/payments',headers:a.headers,payload:{planCode,method:'mobile',phone:'255712345678',firstname:'Amina',lastname:'Test'}});
try{
 const cat=(await app.inject({url:'/v1/payments/plans'})).json();
 assert.equal(cat.available,true);assert.deepEqual(cat.plans.map(p=>[p.code,p.amountTzs,p.videos,p.days]),[['weekly',5000,20,7],['monthly',19900,50,30]]);checks.push('catalogue live: weekly 5,000 TZS / 20 videos / 7 days, monthly 19,900 TZS / 50 videos / 30 days');

 // ---- weekly: happy path
 const a=await account();
 let r=await pay(a,'weekly');assert.equal(r.statusCode,202);assert.equal(r.json().status,'pending');const paymentId=r.json().id;
 assert.equal(received.length,1);const sent=received[0];
 assert.equal(sent.auth,'Bearer snp_mockkey');assert.match(sent.idem,/^[a-f0-9]{30}$/);
 assert.equal(sent.body.payment_type,'mobile');assert.equal(sent.body.details.amount,5000);assert.equal(sent.body.details.currency,'TZS');
 assert.equal(sent.body.phone_number,'255712345678');assert.deepEqual(sent.body.customer,{firstname:'Amina',lastname:'Test',email:a.email});
 assert.equal(sent.body.webhook_url,'https://api.hasheemstudio.com/webhooks/snippe');assert.equal(sent.body.metadata.product,'hasheemstudio');assert.equal(sent.body.metadata.studio_payment_intent,paymentId);
 checks.push('request to the provider: bearer key, idempotency key, mobile, 5000 TZS, phone, customer, our webhook URL, Studio-only metadata');
 const row=(await pool.query('select status,provider_reference,amount_tzs,plan_code,downloads_total from payment_intents where id=$1',[paymentId])).rows[0];
 assert.deepEqual([row.status,row.provider_reference,row.amount_tzs,row.plan_code,row.downloads_total],['pending','pi_mock_1',5000,'weekly',20]);
 assert.equal((await app.inject({url:`/v1/payments/${paymentId}`,headers:a.headers})).json().status,'pending');
 r=await pay(a,'monthly');assert.equal(r.statusCode,202);assert.equal(received.length,1,'a second attempt while one is open does not charge again');checks.push('one open attempt per account: no double charge');
 // forged / wrong amount / stale are refused and unlock nothing
 assert.equal((await hook(providerEvent(sent.body,'completed',5000),true)).statusCode,401);
 assert.equal((await hook(providerEvent(sent.body,'completed',4999))).statusCode,400);
 assert.equal((await pool.query('select count(*)::int n from paid_entitlements where user_id=$1',[a.id])).rows[0].n,0);checks.push('forged signature and wrong amount rejected, nothing unlocked');
 // the real event
 assert.equal((await hook(providerEvent(sent.body,'completed',5000))).statusCode,200);
 assert.equal((await app.inject({url:`/v1/payments/${paymentId}`,headers:a.headers})).json().status,'completed');
 const ent=(await app.inject({url:'/v1/payments/entitlement',headers:a.headers})).json();
 assert.equal(ent.paid.videosRemaining,20);assert.deepEqual(ent.paid.planCodes,['weekly']);
 const days=(new Date(ent.paid.expiresAt)-Date.now())/864e5;assert(days>6.9&&days<=7.01,'7 day window');checks.push('signed completed webhook -> plan active: 20 videos, 7 days');
 // paid downloads: first = free daily, second = charged to the plan
 const j1=await job(a),j2=await job(a);
 assert.equal((await app.inject({method:'POST',url:`/v1/jobs/${j1}/download`,headers:a.headers})).statusCode,200);
 assert.equal((await app.inject({method:'POST',url:`/v1/jobs/${j2}/download`,headers:a.headers})).statusCode,200);
 assert.equal((await app.inject({url:'/v1/payments/entitlement',headers:a.headers})).json().paid.videosRemaining,19);checks.push('downloads work: free daily video first, then 1 charged to the plan (19 left)');

 // ---- monthly: price + failed/cancelled payments never unlock
 const b=await account();
 r=await pay(b,'monthly');assert.equal(r.statusCode,202);const sentB=received[received.length-1];assert.equal(sentB.body.details.amount,19900);
 assert.equal((await hook(providerEvent(sentB.body,'completed',5000))).statusCode,400,'monthly must be paid at 19,900, not the weekly price');
 assert.equal((await hook(providerEvent(sentB.body,'failed',19900))).statusCode,200);
 assert.equal((await app.inject({url:`/v1/payments/${r.json().id}`,headers:b.headers})).json().status,'failed');
 assert.equal((await app.inject({url:'/v1/payments/entitlement',headers:b.headers})).json().paid,null);
 // a failed payment can be retried, and the retry can complete
 r=await pay(b,'monthly');assert.equal(r.statusCode,202);const sentB2=received[received.length-1];
 assert.equal((await hook(providerEvent(sentB2.body,'completed',19900))).statusCode,200);
 const entB=(await app.inject({url:'/v1/payments/entitlement',headers:b.headers})).json();assert.equal(entB.paid.videosRemaining,50);assert.deepEqual(entB.paid.planCodes,['monthly']);
 assert((new Date(entB.paid.expiresAt)-Date.now())/864e5>29.9);checks.push('monthly 19,900 TZS: wrong amount refused, failed payment unlocks nothing, retry completes -> 50 videos, 30 days');
 // guests cannot pay
 assert.equal((await app.inject({method:'POST',url:'/v1/payments',payload:{planCode:'weekly',method:'mobile',phone:'255712345678',firstname:'A',lastname:'B'}})).statusCode,401);checks.push('anonymous users cannot start a payment');
 console.log('PASS Snippe checkout chain (fake provider): '+checks.length+' checks');for(const c of checks)console.log('  -',c);
} finally {
 for(const key of objects)await fetch(gw+'/storage/v1/object/media',{method:'DELETE',headers:admin,body:JSON.stringify({prefixes:[key]})});
 for(const id of users)await fetch(gw+'/auth/v1/admin/users/'+id,{method:'DELETE',headers:admin});
 provider.close();await app.close();await pool.end();
}
