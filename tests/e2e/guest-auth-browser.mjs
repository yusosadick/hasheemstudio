// Runs the imported auth screens against real local Supabase/API/worker, with a disposable user.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { randomUUID,randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
const env=Object.fromEntries(readFileSync(process.env.HASHEEMSTUDIO_ENV_FILE ?? (process.platform === "darwin" ? `${homedir()}/.config/hasheemstudio/local.env` : "/etc/hasheemstudio/local.env"),'utf8').split('\n').filter(l=>l.trim()&&!l.startsWith('#')&&l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const gateway=`http://127.0.0.1:${env.API_GW_HTTP_PORT}`,base=process.env.TEST_WEB_URL??'http://127.0.0.1:5174';
const admin={apikey:env.SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SERVICE_ROLE_KEY}`,'Content-Type':'application/json'};
const email=`browser-${randomUUID()}@example.invalid`,password=`Aa1!${randomBytes(16).toString('hex')}`;
const created=await fetch(`${gateway}/auth/v1/admin/users`,{method:'POST',headers:admin,body:JSON.stringify({email,password,email_confirm:true})});assert(created.ok);const user=await created.json();
const db=new pg.Client({host:'127.0.0.1',port:Number(env.POSTGRES_PORT),user:'postgres.hasheemstudio',password:env.POSTGRES_PASSWORD,database:env.POSTGRES_DB});await db.connect();
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined),headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});const page=await context.newPage();
page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));let guestWorkspace;
mkdirSync('docs/evidence/guest-download-gate',{recursive:true});
try{
 await page.goto(base+'/');await page.getByRole('link',{name:'Choose video',exact:true}).click();
 await page.locator('input[type=file]').setInputFiles('tests/fixtures/media/synthetic-remux-test.mov');
 await page.waitForURL('**/app/jobs/*',{timeout:30000});const jobPath=new URL(page.url()).pathname;
 const jobId=jobPath.split('/').pop();guestWorkspace=(await db.query('select workspace_id from jobs where id=$1',[jobId])).rows[0].workspace_id;
 await page.getByRole('heading',{name:'Your video is ready'}).waitFor({timeout:120000});
 await page.screenshot({path:'docs/evidence/guest-download-gate/guest-result.png',fullPage:true});
 await page.getByRole('link',{name:'Sign in to download'}).click();
 await page.getByRole('textbox',{name:'Email address'}).fill(email);await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('heading',{name:'Welcome back'}).waitFor();
 await page.getByRole('textbox',{name:'Password',exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.waitForURL(base+jobPath);await page.getByRole('button',{name:'Download video',exact:true}).waitFor();
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download video',exact:true}).click()]);
 const stream=await download.createReadStream();let bytes=0;for await(const chunk of stream) bytes+=chunk.length;
 assert(bytes>0);assert.equal(download.suggestedFilename(),'hasheem-video.mp4');
 const response={status:200,bytes};
 // Signed-in uploads still use real direct-to-storage TUS, and processing is allowed before quota gating.
 await page.goto(base+'/app/upload');await page.locator('input[type=file]').setInputFiles('tests/fixtures/media/synthetic-remux-test.mov');
 await page.waitForURL('**/app/jobs/*',{timeout:30000});await page.getByRole('heading',{name:'Your video is ready'}).waitFor({timeout:120000});
 await page.getByRole('button',{name:'Download video',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Your daily video allowance is used'}).waitFor();
 await page.getByRole('button',{name:'Upgrade unavailable'}).waitFor();
 assert(await page.locator('header > div').getByRole('link',{name:'Get Started',exact:true}).isVisible());
 await page.screenshot({path:'docs/evidence/guest-download-gate/download-gate.png',fullPage:true});
 await page.goto(base+'/verify-email');await page.getByText('Email Verified!',{exact:true}).waitFor();
 await page.goto(base+'/app/upload');
 await page.getByRole('button',{name:'Log out',exact:true}).click();await page.waitForURL(base+'/');
 await page.goto(base+'/login');await page.getByRole('heading',{name:'Welcome to Hasheem Studio'}).waitFor();
 await page.waitForTimeout(700);await page.screenshot({path:'docs/evidence/guest-download-gate/auth-desktop.png',fullPage:true});
 await page.getByRole('textbox',{name:'Email address'}).fill(`new-${randomUUID()}@example.invalid`);await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('heading',{name:'Create your account'}).waitFor();
 await page.getByRole('textbox',{name:'Full name',exact:true}).waitFor();await page.getByRole('combobox',{name:'Country'}).waitFor();
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(700);await page.screenshot({path:'docs/evidence/guest-download-gate/signup-mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.goto(base+'/reset-password');await page.getByText('This password reset link is no longer valid.',{exact:false}).waitFor();
 await page.goto(base+'/verify-email');await page.getByRole('heading',{name:'Verify your email',exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 writeFileSync('docs/evidence/guest-download-gate/browser.json',JSON.stringify({passed:true,downloadBytes:response.bytes,checks:['guest upload/process in browser','existing-email password step','return to exact processed result after login','actual browser file download', 'signed-in direct TUS processing', 'daily limit shown at download','logout','new-email registration step','390px no overflow','invalid reset link handled','verification follows live session and clears after logout'],pageErrors:errors},null,2));
 console.log('PASS browser guest processing, progressive login, return to result, download, logout, signup layout, invalid auth links');
}finally{
 await browser.close();
 if(guestWorkspace){const keys=await db.query(`select object_key key from upload_sessions where workspace_id=$1 union select output_object_key key from jobs where workspace_id=$1 and output_object_key is not null`,[guestWorkspace]);for(const {key}of keys.rows)await fetch(`${gateway}/storage/v1/object/media`,{method:'DELETE',headers:admin,body:JSON.stringify({prefixes:[key]})});await db.query('delete from workspaces where id=$1',[guestWorkspace]);}
 const ownKeys=await db.query(`select object_key key from upload_sessions where created_by=$1 union select output_object_key key from jobs where created_by=$1 and output_object_key is not null`,[user.id]);for(const {key}of ownKeys.rows)await fetch(`${gateway}/storage/v1/object/media`,{method:'DELETE',headers:admin,body:JSON.stringify({prefixes:[key]})});
 await fetch(`${gateway}/auth/v1/admin/users/${user.id}`,{method:'DELETE',headers:admin});await db.end();
}
