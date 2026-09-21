// Real GoTrue OTP verification, disposable account; admin-generated codes stay in memory.
// Does not send mail or claim inbox delivery.
import {readFileSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {randomBytes,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
const env=Object.fromEntries(readFileSync(process.env.HASHEEMSTUDIO_ENV_FILE??(process.platform==='darwin'?`${homedir()}/.config/hasheemstudio/local.env`:'/etc/hasheemstudio/local.env'),'utf8').split('\n').filter(l=>l&&!l.startsWith('#')&&l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const url=`http://127.0.0.1:${env.API_GW_HTTP_PORT}/auth/v1`;
const admin={apikey:env.SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SERVICE_ROLE_KEY}`,'Content-Type':'application/json'};
const publicHeaders={apikey:env.ANON_KEY,'Content-Type':'application/json'};
const db=new pg.Client({host:'127.0.0.1',port:Number(env.POSTGRES_PORT),user:'postgres.hasheemstudio',password:env.POSTGRES_PASSWORD,database:env.POSTGRES_DB});await db.connect();
const email=`otp-${randomUUID()}@example.invalid`,password=`Aa1!${randomBytes(20).toString('hex')}`;let userId;
const checks=[];
async function generate(type){const r=await fetch(url+'/admin/generate_link',{method:'POST',headers:admin,body:JSON.stringify({type,email,password})});assert(r.ok,'admin code generation');const d=await r.json();userId=d.id??d.user?.id??userId;assert(/^\d{6}$/.test(d.email_otp),'six-digit OTP');return d.email_otp;}
async function verify(type,token){return fetch(url+'/verify',{method:'POST',headers:publicHeaders,body:JSON.stringify({email,token,type})});}
try{
 let code=await generate('signup');assert(userId);
 assert(!(await verify('signup',code==='000000'?'111111':'000000')).ok);checks.push('wrong signup code denied');
 await db.query('update auth.users set confirmation_sent_at=now()-interval \'2 days\' where id=$1',[userId]);
 assert(!(await verify('signup',code)).ok);checks.push('expired signup code denied');
 code=await generate('signup');let r=await verify('signup',code);assert(r.ok);let session=await r.json();assert(session.access_token&&session.user.email_confirmed_at);checks.push('signup code creates verified session');
 assert(!(await verify('signup',code)).ok);checks.push('used signup code denied');
 code=await generate('recovery');assert(!(await verify('signup',code)).ok);checks.push('recovery code cannot confirm signup');
 await db.query('update auth.users set recovery_sent_at=now()-interval \'2 days\' where id=$1',[userId]);assert(!(await verify('recovery',code)).ok);checks.push('expired recovery denied');
 code=await generate('recovery');r=await verify('recovery',code);assert(r.ok);session=await r.json();assert(session.access_token);checks.push('recovery code creates session');
 assert(!(await verify('recovery',code)).ok);checks.push('used recovery code denied');
 r=await fetch(url+'/user',{method:'PUT',headers:{...publicHeaders,Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({password:`Aa1!${randomBytes(20).toString('hex')}`})});assert(r.ok);checks.push('recovery session updates password');
 writeFileSync('docs/evidence/email-templates/otp.json',JSON.stringify({passed:true,checks,transport:'real deployed GoTrue via loopback',emailDelivered:false,codeSource:'admin generation; no SMTP send'},null,2));
 console.log('PASS real GoTrue signup/recovery OTP expiry/reuse/session checks');
}finally{if(userId)await fetch(url+'/admin/users/'+userId,{method:'DELETE',headers:admin});await db.end();}
