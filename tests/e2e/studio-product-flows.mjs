// Browser OTP flows use real Auth; payment screens below are explicitly synthetic UI fixtures.
import {chromium} from 'playwright';import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';import {randomBytes,randomUUID} from 'node:crypto';import assert from 'node:assert/strict';
const e=Object.fromEntries(readFileSync('/etc/hasheemstudio/local.env','utf8').split('\n').filter(l=>l&&!l.startsWith('#')&&l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const gw=`http://127.0.0.1:${e.API_GW_HTTP_PORT}`,base='http://127.0.0.1:5174';
const headers={apikey:e.SERVICE_ROLE_KEY,Authorization:`Bearer ${e.SERVICE_ROLE_KEY}`,'Content-Type':'application/json'};
const email=`browser-otp-${randomUUID()}@example.invalid`,password=`Aa1!${randomBytes(20).toString('hex')}`;let uid;
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'reduce'}),page=await context.newPage();
mkdirSync('docs/evidence/studio-product-flows',{recursive:true});const checks=[];
async function generate(type){const r=await fetch(gw+'/auth/v1/admin/generate_link',{method:'POST',headers,body:JSON.stringify({type,email,password})});assert(r.ok);const d=await r.json();uid=d.id??d.user?.id??uid;return d.email_otp;}
try{
 let code=await generate('signup');await page.goto(base+'/verify-email');await page.getByRole('textbox',{name:'Email address'}).fill(email);
 await page.getByRole('textbox',{name:'Confirmation code'}).fill(code==='000000'?'111111':'000000');await page.getByRole('button',{name:'Verify email',exact:true}).click();await page.getByRole('alert').filter({hasText:'invalid, expired or already used'}).waitFor();checks.push('browser wrong signup OTP rejected');
 await page.getByRole('textbox',{name:'Confirmation code'}).fill(code);await page.getByRole('button',{name:'Verify email',exact:true}).click();await page.getByRole('heading',{name:'Email Verified!'}).waitFor();await page.reload();await page.getByRole('heading',{name:'Email Verified!'}).waitFor();checks.push('browser signup OTP session and refresh');
 await page.getByRole('button',{name:'Toggle menu'}).click();await page.getByRole('button',{name:'Log out'}).click();await page.waitForURL(base+'/');
 await page.goto(base+'/verify-email');await page.getByRole('textbox',{name:'Email address'}).fill(email);await page.getByRole('textbox',{name:'Confirmation code'}).fill(code);await page.getByRole('button',{name:'Verify email',exact:true}).click();await page.getByRole('alert').waitFor();checks.push('browser used code denied after logout');
 code=await generate('recovery');
 // Suppress only the recovery-send request to avoid sending an unapproved email; the OTP
 // verification below is an unmocked real GoTrue request using the admin-generated code.
 await page.route('**/auth/v1/recover**',r=>r.fulfill({json:{}}));await page.goto(base+'/forgot-password');await page.getByRole('textbox',{name:'Email address'}).fill(email);await page.getByRole('button',{name:'Send reset code'}).click();await page.getByRole('textbox',{name:'Recovery code'}).fill(code);await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForURL(base+'/reset-password');
 await page.getByRole('textbox',{name:'New password'}).waitFor();await page.screenshot({path:'docs/evidence/studio-product-flows/reset-ready-mobile.png',fullPage:true});await page.getByRole('textbox',{name:'New password'}).fill(`Aa2!${randomBytes(20).toString('hex')}`);await page.getByRole('button',{name:'Update Password'}).click();await page.getByText('Password Updated',{exact:true}).waitFor();checks.push('browser recovery code/session/password update');
 // Payment UI fixtures never hit the charge endpoint. Actual webhook/download tests are separate.
 const jobId=randomUUID(),paymentId=randomUUID();let status='pending';
 await page.route('**/v1/jobs/'+jobId,r=>r.fulfill({json:{id:jobId,status:'succeeded',recipe:'remux',hasOutput:true,requiresLogin:false,outputExpired:false}}));
 await page.route('**/v1/jobs/'+jobId+'/download',r=>r.fulfill({status:429,json:{error:'daily_download_limit',message:'Your daily video allowance is used.'}}));
 await page.route('**/v1/payments/plan',r=>r.fulfill({json:{available:true,name:'Synthetic fixture (not offered)',amount:1500,duration:3600,downloads:5,methods:['mobile']}}));
 await page.route('**/v1/payments/'+paymentId,r=>r.fulfill({json:{status}}));
 await page.evaluate(([job,payment])=>sessionStorage.setItem(`studio-payment-${job}`,payment),[jobId,paymentId]);
 for(const state of ['pending','completed','failed']){status=state;await page.goto(base+'/app/jobs/'+jobId);await page.getByRole('button',{name:'Download video',exact:true}).click();await page.getByText(state==='pending'?'Payment pending':state==='completed'?'Payment confirmed':'Payment failed',{exact:true}).waitFor();await page.evaluate(()=>{const label=document.createElement('p');label.textContent='SYNTHETIC UI FIXTURE — no payment made';label.style.cssText='position:fixed;top:0;left:0;right:0;background:#fff;color:#111;z-index:9999;text-align:center;font:12px sans-serif;padding:8px';document.body.append(label)});await page.screenshot({path:`docs/evidence/studio-product-flows/payment-${state}.png`,fullPage:true});}checks.push('synthetic payment pending/completed/failed UI only; no provider request');
 writeFileSync('docs/evidence/studio-product-flows/results.json',JSON.stringify({passed:true,checks,emailDelivered:false,providerSandbox:false,fixtureAmountNotPrice:true},null,2));console.log('PASS browser real OTP/session and labelled synthetic payment presentation');
}finally{await browser.close();if(uid)await fetch(gw+'/auth/v1/admin/users/'+uid,{method:'DELETE',headers});}
