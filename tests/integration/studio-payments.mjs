// Synthetic signed provider fixtures against real Studio DB/Auth/Storage and actual Fastify routes.
// This does NOT contact Snippe or constitute provider-approved sandbox evidence.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID,randomBytes,createHmac} from 'node:crypto';
import assert from 'node:assert/strict';
import {loadEnv} from '../../apps/api/src/env.ts';import {getPool} from '../../apps/api/src/db.ts';import {buildServer} from '../../apps/api/src/server.ts';
loadEnv();process.env.STUDIO_CHECKOUT_ENABLED='false';process.env.SNIPPE_WEBHOOK_SECRET=randomBytes(32).toString('hex');
const pool=getPool(),app=buildServer();app.log.level='silent';await app.ready();
const gw=`http://127.0.0.1:${process.env.API_GW_HTTP_PORT}`;
const admin={apikey:process.env.SERVICE_ROLE_KEY,Authorization:`Bearer ${process.env.SERVICE_ROLE_KEY}`,'Content-Type':'application/json'};
const users=[],objects=[],checks=[];
async function account(){const email=`payment-${randomUUID()}@example.invalid`,password=`Aa1!${randomBytes(16).toString('hex')}`;let r=await fetch(gw+'/auth/v1/admin/users',{method:'POST',headers:admin,body:JSON.stringify({email,password,email_confirm:true})});assert(r.ok);const user=await r.json();users.push(user.id);r=await fetch(gw+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:process.env.ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password})});assert(r.ok);const session=await r.json();return {id:user.id,headers:{authorization:`Bearer ${session.access_token}`},token:session.access_token};}
async function job(a){const ws=(await pool.query('select id from workspaces where created_by=$1 and is_personal=true',[a.id])).rows[0].id;const key=`${ws}/outputs/${randomUUID()}.mp4`;objects.push(key);const r=await fetch(gw+'/storage/v1/object/media/'+key,{method:'POST',headers:{...admin,'Content-Type':'video/mp4'},body:readFileSync('../../tests/fixtures/media/synthetic-remux-test.mov')});assert(r.ok);
const up=(await pool.query(`insert into upload_sessions(workspace_id,created_by,object_key,declared_filename,declared_size_bytes,expires_at) values($1,$2,$3,'fixture.mov',1024,now()+interval '1 hour') returning id`,[ws,a.id,key])).rows[0].id;
const ma=(await pool.query(`insert into media_assets(workspace_id,created_by,upload_session_id,object_key,size_bytes,retain_until) values($1,$2,$3,$4,1024,now()+interval '1 hour') returning id`,[ws,a.id,up,key])).rows[0].id;
return (await pool.query(`insert into jobs(workspace_id,created_by,media_asset_id,recipe,status,output_object_key,output_retain_until) values($1,$2,$3,'remux','succeeded',$4,now()+interval '1 hour') returning id`,[ws,a.id,ma,key])).rows[0].id;}
async function intent(a,j){return (await pool.query(`insert into payment_intents(user_id,amount_tzs,plan_name,plan_code,duration_seconds,downloads_per_day,downloads_total,payment_method,idempotency_key) values($1,1500,'Synthetic test only','weekly',3600,2,2,'mobile',$2) returning id`,[a.id,randomBytes(15).toString('hex')])).rows[0].id;}
function event(id,type='completed'){return {id:'evt_'+randomBytes(12).toString('hex'),api_version:'2026-01-25',type:'payment.'+type,data:{status:type,reference:'pi_'+randomBytes(12).toString('hex'),amount:{value:1500,currency:'TZS'},metadata:{studio_payment_intent:id,product:'hasheemstudio'}}};}
async function webhook(e,{timestamp=String(Math.floor(Date.now()/1000)),invalid=false}={}){const raw=JSON.stringify(e);const signature=invalid?'0'.repeat(64):createHmac('sha256',process.env.SNIPPE_WEBHOOK_SECRET).update(timestamp+'.'+raw).digest('hex');return app.inject({method:'POST',url:'/webhooks/snippe',headers:{'content-type':'application/json','x-webhook-timestamp':timestamp,'x-webhook-signature':signature},payload:raw});}
async function download(a,j){return app.inject({method:'POST',url:`/v1/jobs/${j}/download`,headers:a.headers});}
try{
 const a=await account(),b=await account(),j=await job(a),second=await job(a),third=await job(a),fourth=await job(a),id=await intent(a,j),e=event(id);
 {const cat=(await app.inject({url:'/v1/payments/plans'})).json();assert.equal(cat.available,false);assert.deepEqual(cat.plans.map(p=>[p.code,p.amountTzs,p.videos,p.days]),[['weekly',2000,20,7],['monthly',5000,50,30]]);}
 assert.equal((await app.inject({method:'POST',url:'/v1/payments',headers:a.headers,payload:{planCode:'weekly',method:'mobile',phone:'255700000000',firstname:'Test',lastname:'Fixture'}})).statusCode,503);checks.push('checkout disabled; no outbound charge');
 assert.equal((await download(a,j)).statusCode,200);assert.equal((await download(a,second)).statusCode,429);checks.push('free allowance enforced before payment');
 assert.equal((await webhook(e,{invalid:true})).statusCode,401);assert.equal((await webhook(e,{timestamp:String(Math.floor(Date.now()/1000)-301)})).statusCode,401);
 assert.equal((await webhook({...e,data:{...e.data,amount:{value:1501,currency:'TZS'}}})).statusCode,400);
 assert.equal((await webhook({...e,data:{...e.data,metadata:{product:'hasheemstudio',studio_payment_intent:randomUUID()}}})).statusCode,400);checks.push('invalid signature, stale, wrong amount and correlation denied');
 const responses=await Promise.all([webhook(e),webhook(e)]);assert(responses.every(r=>r.statusCode===200));assert.equal((await pool.query('select count(*)::int n from payment_events where payment_intent_id=$1',[id])).rows[0].n,1);assert.equal((await pool.query('select count(*)::int n from paid_entitlements where payment_intent_id=$1',[id])).rows[0].n,1);checks.push('concurrent duplicate events stored once, one entitlement');
 assert.equal((await app.inject({url:`/v1/payments/${id}`,headers:b.headers})).statusCode,404);assert.equal((await download(b,second)).statusCode,403);
 const c=await pool.connect();try{await c.query('begin');await c.query('set local role authenticated');await c.query("select set_config('request.jwt.claim.sub',$1,true)",[b.id]);assert.equal((await c.query('select id from payment_intents where id=$1',[id])).rows.length,0);assert.equal((await c.query('select id from paid_entitlements where payment_intent_id=$1',[id])).rows.length,0);await c.query('rollback');}finally{c.release();}checks.push('API/RLS foreign account denied');
 assert.equal((await download(a,second)).statusCode,200);checks.push('verified synthetic webhook enables backend-signed second download');
 {const g=(await pool.query('select entitlement_id from download_grants where job_id=$1',[second])).rows[0];assert(g.entitlement_id,'paid download is charged to the entitlement');assert.equal((await pool.query('select entitlement_id from download_grants where job_id=$1',[j])).rows[0].entitlement_id,null);checks.push('free download uncharged, second charged to paid quota');}
 await pool.query("update paid_entitlements set starts_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' where payment_intent_id=$1",[id]);assert.equal((await download(a,third)).statusCode,429);
 await pool.query("update paid_entitlements set starts_at=now()-interval '2 hours',expires_at=now()+interval '1 hour',revoked_at=now() where payment_intent_id=$1",[id]);assert.equal((await download(a,third)).statusCode,429);checks.push('expired/revoked entitlement immediately denied');
 await pool.query("update paid_entitlements set revoked_at=null where payment_intent_id=$1",[id]);
 {const ent=await app.inject({url:'/v1/payments/entitlement',headers:a.headers});assert.equal(ent.json().paid.videosRemaining,1);}
 assert.equal((await download(a,third)).statusCode,200);assert.equal((await download(a,fourth)).statusCode,429);
 {const ent=(await app.inject({url:'/v1/payments/entitlement',headers:a.headers})).json();assert.equal(ent.paid.videosRemaining,0);}checks.push('total-videos quota exhausts exactly at the plan limit (2 of 2), entitlement endpoint agrees');
 for(const type of ['failed','voided','expired']){const pid=await intent(a),ev=event(pid,type);assert.equal((await webhook(ev)).statusCode,200);assert.equal((await pool.query('select id from paid_entitlements where payment_intent_id=$1',[pid])).rows.length,0);assert.equal((await webhook({...ev,id:ev.id+'late',type:'payment.completed',data:{...ev.data,status:'completed'}})).statusCode,400);}checks.push('failed/cancelled/expired never unlock or resurrect');
 assert.equal((await app.inject({method:'POST',url:'/webhooks/snippe',headers:{'content-type':'application/json'},payload:'x'.repeat(65537)})).statusCode,413);checks.push('bounded webhook body');
 mkdirSync('../../docs/evidence/payments',{recursive:true});writeFileSync('../../docs/evidence/payments/integration.json',JSON.stringify({passed:true,checks,providerContacted:false,providerSandbox:false,fixtureAmountNotApprovedPrice:true},null,2));console.log('PASS Studio payment DB/API/RLS/webhook/download integration checks');
} finally {
 for(const key of objects)await fetch(gw+'/storage/v1/object/media',{method:'DELETE',headers:admin,body:JSON.stringify({prefixes:[key]})});
 for(const id of users)await fetch(gw+'/auth/v1/admin/users/'+id,{method:'DELETE',headers:admin});
 await app.close();await pool.end();delete process.env.SNIPPE_WEBHOOK_SECRET;
}
