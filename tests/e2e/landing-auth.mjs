import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const base=process.env.TEST_WEB_URL??'http://127.0.0.1:5174';
const browser=await chromium.launch();
const dir='docs/evidence/landing-auth';mkdirSync(dir,{recursive:true});
const checks=[];
try {
 for(const width of [1440,390,320]) {
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
  const page=await context.newPage();
  for(const [name,path] of Object.entries({landing:'/',login:'/login',signup:'/register',forgot:'/forgot-password',reset:'/reset-password',verify:'/verify-email',callback:'/auth/callback'})) {
   await page.goto(base+path); await page.waitForTimeout(400);
   const cta=page.locator('header > div').getByRole('link',{name:'Get Started',exact:true});
   assert(await cta.isVisible(),`${name} CTA ${width}`);
   assert.equal(await cta.getAttribute('href'),'/login');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name} overflow ${width}`);
   assert.equal(await page.locator('img[src*="auth-hero"], img[src*="zahoro"], img[alt="Hasheem Gaming"]').count(),0);
   if(width===390){assert.equal(await page.getByRole('button',{name:'Toggle menu'}).count(),0,'no hamburger on phones');assert.equal(await page.getByRole('navigation',{name:'Primary mobile'}).count(),0);}
   await page.screenshot({path:`${dir}/${name}-${width}.png`,fullPage:true});
   checks.push(`${name} ${width}: navigation, CTA, no overflow`);
  }
  await context.close();
 }
 writeFileSync(`${dir}/results.json`,JSON.stringify({passed:true,scope:'Local browser presentation; does not prove Google or email delivery',checks},null,2));
 console.log('PASS 21 landing/auth route and viewport checks');
} finally {await browser.close();}
