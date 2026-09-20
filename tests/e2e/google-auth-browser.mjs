// Read-only production Google readiness probe. Never records URLs with queries or credentials.
import { chromium } from 'playwright';
import { readFileSync, lstatSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const envPath='/etc/hasheemstudio/local.env';
const info=lstatSync(envPath);
assert(info.isFile() && !(info.mode & 0o077) && info.uid===process.getuid(),'protected environment required');
const env=Object.fromEntries(readFileSync(envPath,'utf8').split('\n').filter(l=>l.trim()&&!l.startsWith('#')&&l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const evidence={checkedAt:new Date().toISOString(),frontendCallback:'https://hasheemstudio.com/auth/callback',providerCallback:'https://supabase.hasheemstudio.com/auth/v1/callback',realConsentCompleted:false,credentialsPrinted:false};
let browser;
try{
  const r=await fetch('https://supabase.hasheemstudio.com/auth/v1/settings',{headers:{apikey:env.ANON_KEY},signal:AbortSignal.timeout(15000)});
  evidence.settingsHttpStatus=r.status;
  assert.equal(r.status,200,'public settings response');
  evidence.googleEnabled=(await r.json()).external?.google===true;
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext();
  const page=await context.newPage();
  await page.goto('https://hasheemstudio.com/login');
  const button=page.getByRole('button',{name:evidence.googleEnabled?'Continue with Google':'Google sign-in unavailable',exact:true});
  await button.waitFor({state:'visible'});
  evidence.buttonEnabled=!(await button.isDisabled());
  assert.equal(evidence.buttonEnabled,evidence.googleEnabled,'UI must reflect actual provider settings');
  if(evidence.googleEnabled){
    page.on('request',request=>{
      const url=new URL(request.url());
      if(url.hostname==='accounts.google.com' && url.searchParams.has('redirect_uri')) evidence.approvedProviderRedirect=url.searchParams.get('redirect_uri')===evidence.providerCallback;
      if(url.origin==='https://supabase.hasheemstudio.com' && url.pathname==='/auth/v1/authorize'){
        evidence.approvedFrontendRedirect=url.searchParams.get('redirect_to')===evidence.frontendCallback;
        evidence.pkcePresent=!!url.searchParams.get('code_challenge') && url.searchParams.get('code_challenge_method')==='s256';
      }
    });
    await button.click();
    await page.waitForURL(u=>u.hostname==='accounts.google.com',{timeout:25000});
    await page.waitForLoadState('domcontentloaded');
    const text=await page.locator('body').innerText();
    evidence.providerOutcome=/redirect_uri_mismatch/i.test(text)?'redirect_uri_mismatch':/invalid_client/i.test(text)?'invalid_client':/access blocked|access_denied/i.test(text)?'provider_access_blocked':'google_login_requires_approved_account';
    assert.equal(evidence.approvedFrontendRedirect,true,'approved frontend redirect');
    assert.equal(evidence.pkcePresent,true,'PKCE required');
    evidence.status=evidence.providerOutcome==='google_login_requires_approved_account'?'BLOCKED_OWNER_CONSENT':'BLOCKED_PROVIDER_CONFIGURATION';
    if(evidence.status==='BLOCKED_OWNER_CONSENT') assert.equal(evidence.approvedProviderRedirect,true,'approved provider redirect');
  }else{
    evidence.status='BLOCKED_GOOGLE_NOT_ENABLED';
  }
  const callback=await context.newPage();
  const response=await callback.goto(evidence.frontendCallback);
  assert.equal(response.status(),200,'SPA callback available');
  await callback.getByRole('alert').waitFor();
  evidence.callbackWithoutSessionDenied=true;
  await context.close();
}catch{
  evidence.status='FAILED_REDACTED';
  process.exitCode=1;
}finally{
  await browser?.close();
  writeFileSync('docs/evidence/google-oauth-browser.json',JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence));
}
