// Real infrastructure test: guest TUS -> worker -> login -> atomic private download grants.
// Uses only the dedicated local stack; never logs bearer tokens or signed URLs.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { randomUUID, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
const path=process.env.HASHEEMSTUDIO_ENV_FILE ?? (process.platform==='darwin' ? `${homedir()}/.config/hasheemstudio/local.env` : '/etc/hasheemstudio/local.env');
const env=Object.fromEntries(readFileSync(path,'utf8').split('\n').filter(l=>l.trim()&&!l.startsWith('#')&&l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const api=process.env.TEST_API_URL ?? 'http://127.0.0.1:8788';
const storage=`http://127.0.0.1:${env.API_GW_HTTP_PORT}`;
const admin={apikey:env.SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SERVICE_ROLE_KEY}`,'Content-Type':'application/json'};
const db=new pg.Client({host:'127.0.0.1',port:Number(env.POSTGRES_PORT),user:'postgres.hasheemstudio',password:env.POSTGRES_PASSWORD,database:env.POSTGRES_DB});
await db.connect();
assert.equal((await db.query('select project from _hasheemstudio_meta.bootstrap limit 1')).rows[0].project,'hasheemstudio');
const users=[],workspaces=[],objects=[],tusPaths=[],checks=[];
function record(name){checks.push(name);console.log(`PASS ${name}`);}
async function call(route,{method='GET',headers={},body,status=200}={}){
 const res=await fetch(`${api}${route}`,{method,headers:{...headers,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 assert.equal(res.status,status,`${method} ${route}: expected ${status}, got ${res.status}`);
 return res.status===204?null:res.json();
}
async function account(){
 const email=`download-${randomUUID()}@example.invalid`,password=`Aa1!${randomBytes(16).toString('hex')}`;
 const response=await fetch(`${storage}/auth/v1/admin/users`,{method:'POST',headers:admin,body:JSON.stringify({email,password,email_confirm:true})});
 assert(response.ok);const user=await response.json();users.push(user.id);
 const login=await fetch(`${storage}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:env.ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
 assert(login.ok);const session=await login.json();return {user,headers:{Authorization:`Bearer ${session.access_token}`},token:session.access_token,email,password};
}
async function guest(){
 const data=await call('/v1/guest-sessions',{method:'POST',status:201});
 const headers={'X-Guest-Token':data.token};
 const ws=(await db.query(`select workspace_id from guest_sessions where token_hash=encode(sha256($1::bytea),'hex')`,[Buffer.from(data.token)])).rows[0].workspace_id;
 workspaces.push(ws);return {headers,ws};
}
const fixture=readFileSync(new URL('../fixtures/media/synthetic-remux-test.mov',import.meta.url));
async function prepare(g){
 const session=await call('/v1/uploads/sessions',{method:'POST',headers:g.headers,body:{filename:'fixture.mov',declaredSizeBytes:fixture.length,declaredMimeType:'video/quicktime'}});
 objects.push(session.objectKey);
 assert(session.tusUploadPath.startsWith('/v1/'));
 const actual=(await db.query('select tus_upload_path from upload_sessions where id=$1',[session.sessionId])).rows[0].tus_upload_path;tusPaths.push(actual);
 const head=await fetch(`${api}${session.tusUploadPath}`,{method:'HEAD',headers:{...g.headers,'Tus-Resumable':'1.0.0'}});assert.equal(head.status,200);assert.equal(head.headers.get('upload-offset'),'0');
 const impostor=await fetch(`${api}${session.tusUploadPath}`,{method:'HEAD',headers:{'X-Guest-Token':'f'.repeat(64)}});assert.equal(impostor.status,401);
 for(let offset=0;offset<fixture.length;offset+=262144){
  const chunk=fixture.subarray(offset,Math.min(offset+262144,fixture.length));
  const sent=await fetch(`${api}${session.tusUploadPath}`,{method:'PATCH',headers:{...g.headers,'Tus-Resumable':'1.0.0','Content-Type':'application/offset+octet-stream','Upload-Offset':String(offset)},body:chunk});assert.equal(sent.status,204);
 }
 const finalized=await call(`/v1/uploads/sessions/${session.sessionId}/finalize`,{method:'POST',headers:g.headers});
 const replay=await call(`/v1/uploads/sessions/${session.sessionId}/finalize`,{method:'POST',headers:g.headers});assert.equal(finalized.mediaAssetId,replay.mediaAssetId);
 const key=randomUUID(),body={mediaAssetId:finalized.mediaAssetId,recipe:'remux',idempotencyKey:key};
 const job=await call('/v1/jobs',{method:'POST',headers:g.headers,body,status:201});
 const same=await call('/v1/jobs',{method:'POST',headers:g.headers,body,status:201});assert.equal(same.jobId,job.jobId);
 const until=Date.now()+120000;let view;
 while(Date.now()<until){view=await call(`/v1/jobs/${job.jobId}`,{headers:g.headers});if(['failed','succeeded'].includes(view.status))break;await new Promise(r=>setTimeout(r,600));}
 assert.equal(view.status,'succeeded');assert.equal(view.downloadUrl,null);assert.equal(view.requiresLogin,true);assert.equal(view.hasOutput,true);
 objects.push(`${g.ws}/outputs/${job.jobId}.mp4`);
 return job.jobId;
}
try{
 const g=await guest(),other=await guest(),a=await account(),b=await account();
 await call('/v1/uploads/sessions',{method:'POST',headers:g.headers,body:{filename:'oversized.mov',declaredSizeBytes:104857601},status:413});record('100 MB upper bound enforced before upload');
 const first=await prepare(g);record('guest resumable upload, worker processing, idempotent retries; no result download URL');
 await call(`/v1/jobs/${first}`,{headers:other.headers,status:403});
 await call(`/v1/jobs/${first}/download`,{method:'POST',headers:g.headers,status:401});
 await call(`/v1/jobs/${first}/download`,{method:'POST',headers:a.headers,status:403});record('anonymous downloads and cross-guest/account access denied');
 const second=await prepare(g);record('second video processes before any download allowance decision');
 const responses=await Promise.all([first,second].map(id=>fetch(`${api}/v1/jobs/${id}/download`,{method:'POST',headers:{...g.headers,...a.headers}})));
 assert.deepEqual(responses.map(r=>r.status).sort(),[200,429]);
 const winner=responses[0].status===200?first:second,loser=winner===first?second:first;
 const granted=await responses.find(r=>r.status===200).json();
 const file=await fetch(granted.downloadUrl);assert.equal(file.status,200);assert.match(file.headers.get("content-disposition"),/attachment/);assert((await file.arrayBuffer()).byteLength>0);
 assert.equal((await db.query('select count(*)::int n from download_grants where user_id=$1',[a.user.id])).rows[0].n,1);record('concurrent distinct downloads grant exactly one free video and return real bytes');
 await call(`/v1/jobs/${winner}/download`,{method:'POST',headers:a.headers});
 await call(`/v1/jobs/${winner}`,{headers:a.headers});
 await call(`/v1/jobs/${winner}`,{headers:g.headers,status:401});
 await call(`/v1/jobs/${winner}/download`,{method:'POST',headers:{...g.headers,...b.headers},status:403});record('repeat download is free; claimed result accessible after login without guest token; claim cannot be stolen');
 const outputKey=`${g.ws}/outputs/${winner}.mp4`;
 const direct=await fetch(`${storage}/storage/v1/object/authenticated/media/${outputKey}`,{headers:{apikey:env.ANON_KEY,...a.headers}});assert(!direct.ok);record('raw storage output read blocked');
 // Even authenticated workspace owners must use the gate, not direct storage access.
 const personal=(await db.query('select workspace_id from workspace_members where user_id=$1',[a.user.id])).rows[0].workspace_id;
 const ownKey=`${personal}/outputs/gate-test.mp4`;objects.push(ownKey);
 const put=await fetch(`${storage}/storage/v1/object/media/${ownKey}`,{method:'POST',headers:{...admin,'Content-Type':'video/mp4'},body:fixture});assert(put.ok);
 const ownRead=await fetch(`${storage}/storage/v1/object/authenticated/media/${ownKey}`,{headers:{apikey:env.ANON_KEY,...a.headers}});assert(!ownRead.ok);
 const selfSign=await fetch(`${storage}/storage/v1/object/sign/media/${ownKey}`,{method:'POST',headers:{apikey:env.ANON_KEY,...a.headers,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:300})});assert(!selfSign.ok);record('workspace owner cannot read or self-sign locked outputs');
 await db.query(`update download_grants set granted_at=now()-interval '1 day' where user_id=$1`,[a.user.id]);
 await call(`/v1/jobs/${loser}/download`,{method:'POST',headers:{...g.headers,...a.headers}});record('allowance resets on the next UTC day');
 await db.query(`update jobs set output_retain_until=now()-interval '1 second' where id=$1`,[winner]);
 await call(`/v1/jobs/${winner}/download`,{method:'POST',headers:a.headers,status:410});record('expired output cannot receive a new signed URL');
 const lookup=await fetch(`${storage}/rest/v1/rpc/email_exists`,{method:'POST',headers:{apikey:env.ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_email:a.email})});assert(lookup.ok);assert.equal(await lookup.json(),true);
 const unknown=await fetch(`${storage}/rest/v1/rpc/email_exists`,{method:'POST',headers:{apikey:env.ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_email:`absent-${randomUUID()}@example.invalid`})});assert.equal(await unknown.json(),false);record('imported progressive-auth RPC distinguishes existing and new emails');
 mkdirSync('docs/evidence/guest-download-gate',{recursive:true});writeFileSync('docs/evidence/guest-download-gate/integration.json',JSON.stringify({passed:true,checks},null,2));
}finally{
 for(const objectKey of objects)await fetch(`${storage}/storage/v1/object/media`,{method:'DELETE',headers:admin,body:JSON.stringify({prefixes:[objectKey]})});
 for(const path of tusPaths)await fetch(`${storage}${path}`,{method:'DELETE',headers:{...admin,'Tus-Resumable':'1.0.0'}});
 for(const id of users)await fetch(`${storage}/auth/v1/admin/users/${id}`,{method:'DELETE',headers:admin});
 for(const ws of workspaces)await db.query('delete from workspaces where id=$1',[ws]);
 await db.end();
}
