// Real DB + Storage + Fastify routes: (1) a free account gets a clear message when it tries to prepare a second
// video (already downloaded today / one still waiting / one in progress), a paid plan lifts it; (2) results are removed
// 5 minutes after they are ready, by the scheduled worker sweep, and only once the grace period has passed.
import {readFileSync} from 'node:fs';
import {randomUUID,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {loadEnv} from '../../apps/api/src/env.ts';import {getPool} from '../../apps/api/src/db.ts';import {buildServer} from '../../apps/api/src/server.ts';
loadEnv();
const {sweepOnce,OUTPUT_DELETE_GRACE_SECONDS}=await import('../../apps/worker/src/retention.ts');
const {deleteObject}=await import('../../apps/worker/src/storage.ts');
const {RESULT_RETENTION_MS}=await import('../../apps/worker/src/processor.ts').catch(()=>({RESULT_RETENTION_MS:5*60*1000}));
const pool=getPool(),app=buildServer();app.log.level='silent';await app.ready();
const gw=`http://127.0.0.1:${process.env.API_GW_HTTP_PORT}`;
const admin={apikey:process.env.SERVICE_ROLE_KEY,Authorization:`Bearer ${process.env.SERVICE_ROLE_KEY}`,'Content-Type':'application/json'};
const users=[],objects=[],checks=[];
async function account(){const email=`limit-${randomUUID()}@example.invalid`,password=`Aa1!${randomBytes(16).toString('hex')}`;let r=await fetch(gw+'/auth/v1/admin/users',{method:'POST',headers:admin,body:JSON.stringify({email,password,email_confirm:true})});assert(r.ok);const user=await r.json();users.push(user.id);r=await fetch(gw+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:process.env.ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password})});assert(r.ok);const s=await r.json();return {id:user.id,headers:{authorization:`Bearer ${s.access_token}`}};}
const wsOf=async a=>(await pool.query('select id from workspaces where created_by=$1 and is_personal=true',[a.id])).rows[0].id;
async function putObject(key){objects.push(key);const r=await fetch(gw+'/storage/v1/object/media/'+key,{method:'POST',headers:{...admin,'Content-Type':'video/mp4'},body:readFileSync('../../tests/fixtures/media/synthetic-remux-test.mov')});assert(r.ok,'put '+r.status);}
const exists=async key=>(await fetch(gw+'/storage/v1/object/authenticated/media/'+key,{headers:admin})).ok;
async function makeJob(a,{status='succeeded',retain="now()+interval '5 minutes'",withOutput=true}={}){
 const ws=await wsOf(a),src=`${ws}/uploads/${randomUUID()}-t.mov`,out=`${ws}/outputs/${randomUUID()}.mp4`;await putObject(src);if(withOutput)await putObject(out);
 const up=(await pool.query(`insert into upload_sessions(workspace_id,created_by,object_key,declared_filename,declared_size_bytes,expires_at,state) values($1,$2,$3,'t.mov',1024,now()+interval '1 hour','completed') returning id`,[ws,a.id,src])).rows[0].id;
 const ma=(await pool.query(`insert into media_assets(workspace_id,created_by,upload_session_id,object_key,size_bytes,retain_until) values($1,$2,$3,$4,1024,now()+interval '1 hour') returning id`,[ws,a.id,up,src])).rows[0].id;
 const id=(await pool.query(`insert into jobs(workspace_id,created_by,media_asset_id,recipe,status,output_object_key,output_retain_until) values($1,$2,$3,'platform_optimize',$4,$5,${withOutput?retain:'null'}) returning id`,[ws,a.id,ma,status,withOutput?out:null])).rows[0].id;
 return {id,out,src,ma};
}
const start=a=>app.inject({method:'POST',url:'/v1/uploads/sessions',headers:a.headers,payload:{filename:'next.mov',declaredSizeBytes:1024,declaredMimeType:'video/quicktime'}});
try{
 // ---- 1. limit messages -------------------------------------------------------------------------------------------
 const a=await account();
 let r=await start(a);assert.equal(r.statusCode,200,'a fresh free account can start its first video');checks.push('fresh free account may start a video');
 const inflight=await makeJob(a,{status:'processing',withOutput:false});
 r=await start(a);assert.equal(r.statusCode,429);assert.equal(r.json().error,'video_in_progress');assert.match(r.json().message,/still being prepared/i);assert.equal(r.json().jobId,inflight.id);
 await pool.query("update jobs set status='failed' where id=$1",[inflight.id]);checks.push('second video while one is processing: clear "still being prepared" message + job id');
 const waiting=await makeJob(a);
 r=await start(a);assert.equal(r.statusCode,429);assert.equal(r.json().error,'video_waiting');assert.match(r.json().message,/download it first/i);assert.equal(r.json().jobId,waiting.id);checks.push('second video while one waits for download: clear "download it first" message + job id');
 await pool.query("update jobs set output_retain_until=now()-interval '1 minute' where id=$1",[waiting.id]);
 r=await start(a);assert.equal(r.statusCode,200,'an expired, never-downloaded video does not burn the free slot');checks.push('expired undownloaded video does not consume the free video');
 await pool.query('insert into download_grants(job_id,user_id) values($1,$2)',[waiting.id,a.id]);
 r=await start(a);assert.equal(r.statusCode,429);assert.equal(r.json().error,'free_limit_used');assert.match(r.json().message,/used today’s free video/i);assert(r.json().resetAt);checks.push('after downloading today\'s free video: clear "used today\'s free video" message with reset time');
 // a paid plan with videos left lifts the block
 const pi=(await pool.query(`insert into payment_intents(user_id,amount_tzs,plan_name,plan_code,duration_seconds,downloads_per_day,downloads_total,payment_method,idempotency_key,status) values($1,2000,'Weekly','weekly',604800,20,20,'mobile',$2,'completed') returning id`,[a.id,randomBytes(15).toString('hex')])).rows[0].id;
 await pool.query('insert into paid_entitlements(user_id,payment_intent_id,downloads_per_day,plan_code,downloads_total,expires_at) values($1,$2,20,\'weekly\',20,now()+interval \'7 days\')',[a.id,pi]);
 r=await start(a);assert.equal(r.statusCode,200);checks.push('a paid plan with videos left allows further videos');

 // ---- 2. 5-minute retention ---------------------------------------------------------------------------------------
 const b=await account();
 const fresh=await makeJob(b,{retain:"now()+interval '4 minutes'"});
 const justExpired=await makeJob(b,{retain:`now()-make_interval(secs=>${Math.max(1,OUTPUT_DELETE_GRACE_SECONDS-30)})`});
 const old=await makeJob(b,{retain:`now()-make_interval(secs=>${OUTPUT_DELETE_GRACE_SECONDS+30})`});
 const res=await sweepOnce(pool,deleteObject);
 assert(res.outputs>=1);
 assert.equal(await exists(fresh.out),true,'a result still inside its 5 minutes is kept');
 assert.equal(await exists(justExpired.out),true,'a just-expired result is kept for the short grace period so a running download can finish');
 assert.equal(await exists(old.out),false,'a result past retention + grace is deleted from storage');
 assert.notEqual((await pool.query('select output_deleted_at from jobs where id=$1',[old.id])).rows[0].output_deleted_at,null);
 checks.push('sweep deletes results only after 5 min + grace, keeps fresh ones');
 // the API refuses/flags an expired result
 const view=await app.inject({url:`/v1/jobs/${old.id}`,headers:b.headers});assert.equal(view.json().outputExpired,true);
 const dl=await app.inject({method:'POST',url:`/v1/jobs/${old.id}/download`,headers:b.headers});assert.equal(dl.statusCode,410);assert.match(dl.json().message,/removed after 5 minutes/i);
 const almost=await makeJob(b,{retain:"now()+interval '5 seconds'"});
 const dl2=await app.inject({method:'POST',url:`/v1/jobs/${almost.id}/download`,headers:b.headers});assert.equal(dl2.statusCode,410,'no new download link in the last seconds');
 checks.push('API reports expiry and refuses downloads after removal / in the final seconds');
 // sources: gone after retain_until unless a job still needs them
 await pool.query("update media_assets set retain_until=now()-interval '1 minute' where id=any($1)",[[fresh.ma,old.ma]]);
 await pool.query("update jobs set status='queued' where id=$1",[fresh.id]);await sweepOnce(pool,deleteObject);
 assert.equal(await exists(old.src),false,'expired source with no active job is deleted');
 assert.equal(await exists(fresh.src),true,'source still needed by a queued job is kept');
 checks.push('source uploads are deleted after retention unless a job still needs them');
 console.log('PASS free-limit messages + 5-minute retention ('+checks.length+' checks)');for(const c of checks)console.log('  -',c);
} finally {
 for(const key of objects)await fetch(gw+'/storage/v1/object/media',{method:'DELETE',headers:admin,body:JSON.stringify({prefixes:[key]})});
 for(const id of users)await fetch(gw+'/auth/v1/admin/users/'+id,{method:'DELETE',headers:admin});
 await app.close();await pool.end();
}
