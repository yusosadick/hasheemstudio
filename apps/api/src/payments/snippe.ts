import {createHmac, timingSafeEqual} from 'node:crypto';
export const PAYMENT_BASE='https://api.snippe.sh';
// Owner-approved commercial terms (2026-09-25). Prices, quotas and durations live in code so a client can never
// choose them; only the plan *code* travels from the browser.
export type PlanCode='weekly'|'monthly';
export type PaidPlan={code:PlanCode;name:string;amount:number;durationSeconds:number;days:number;videos:number};
export const PAID_PLANS:Record<PlanCode,PaidPlan>={
 weekly:{code:'weekly',name:'Weekly',amount:2000,durationSeconds:7*86400,days:7,videos:20},
 monthly:{code:'monthly',name:'Monthly',amount:5000,durationSeconds:30*86400,days:30,videos:50},
};
export function findPlan(code:unknown):PaidPlan|null {return typeof code==='string'&&Object.hasOwn(PAID_PLANS,code)?PAID_PLANS[code as PlanCode]:null;}
/** Checkout is only live when the operator has provisioned credentials and explicitly enabled + approved it. */
export function checkoutEnabled(e:NodeJS.ProcessEnv=process.env):boolean {
 return e.STUDIO_CHECKOUT_ENABLED==='true'&&e.STUDIO_PAYMENT_APPROVED==='true'&&!!e.SNIPPE_API_KEY?.startsWith('snp_')&&!!e.SNIPPE_WEBHOOK_SECRET;
}
export function validSignature(raw:Buffer,timestamp:unknown,signature:unknown,secret:string,now=Date.now()):boolean {
 if(!secret||typeof timestamp!=='string'||!/^\d{10}$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300||typeof signature!=='string'||! /^[a-f0-9]{64}$/i.test(signature))return false;
 return timingSafeEqual(createHmac('sha256',secret).update(timestamp+'.').update(raw).digest(),Buffer.from(signature,'hex'));
}
export type PaymentEvent={id:string;type:'completed'|'failed'|'voided'|'expired';intentId:string;reference:string;amount:number;currency:'TZS'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseEvent(raw:Buffer):PaymentEvent|null {
 try {
  const e=JSON.parse(raw.toString('utf8')),d=e.data,type=e.type?.replace(/^payment\./,'');
  if(e.api_version!=='2026-01-25'||!['payment.completed','payment.failed','payment.voided','payment.expired'].includes(e.type)||d?.status!==type||typeof e.id!=='string'||! /^[\w-]{1,128}$/.test(e.id)||!uuid.test(d?.metadata?.studio_payment_intent??'')||d?.metadata?.product!=='hasheemstudio'||typeof d.reference!=='string'||! /^[\w-]{1,128}$/.test(d.reference)||!Number.isSafeInteger(d.amount?.value)||d.amount.value<500||d.amount.currency!=='TZS')return null;
  return {id:e.id,type,intentId:d.metadata.studio_payment_intent,reference:d.reference,amount:d.amount.value,currency:'TZS'};
 } catch {return null;}
}
export function paymentBody(p:{id:string;jobId?:string;amount:number;method:'mobile'|'card';phone:string;customer:Record<string,string>},webhookUrl:string) {
 if(!uuid.test(p.id)||(p.jobId!==undefined&&!uuid.test(p.jobId))||!Number.isSafeInteger(p.amount)||p.amount<500||!/^255[67]\d{8}$/.test(p.phone)||!['mobile','card'].includes(p.method))throw new Error('invalid_payment');
 const hook=new URL(webhookUrl);if(hook.protocol!=='https:'||hook.hostname!=='api.hasheemstudio.com'||hook.pathname!=='/webhooks/snippe'||hook.search||hook.username||hook.password||hook.port||hook.hash)throw new Error('invalid_webhook_url');
 const details:Record<string,unknown>={amount:p.amount,currency:'TZS'};
 if(p.method==='card'){
  for(const field of ['address','city','state','postcode','country'])if(!p.customer[field])throw new Error('missing_billing_field');
  details.redirect_url=p.jobId?`https://hasheemstudio.com/app/jobs/${p.jobId}`:'https://hasheemstudio.com/';details.cancel_url=details.redirect_url;
 }
 return {payment_type:p.method,details,phone_number:p.phone,customer:p.customer,webhook_url:webhookUrl,metadata:{studio_payment_intent:p.id,product:'hasheemstudio'}};
}
export async function createPayment(body:ReturnType<typeof paymentBody>,key:string,idempotency:string):Promise<string> {
 if(!key.startsWith('snp_')||! /^[a-f0-9]{30}$/.test(idempotency))throw new Error('invalid_payment_configuration');
 // Fixed provider origin; redirects refused, 15s timeout and 64KiB maximum. No automatic retry:
 // a lost response can mean the provider accepted a real charge.
 const r=await fetch(PAYMENT_BASE+'/v1/payments',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':idempotency},body:JSON.stringify(body)});
 if(!r.ok||!r.body){await r.body?.cancel();throw new Error('provider_outcome_unknown');}
 const reader=r.body.getReader();const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();throw new Error('provider_outcome_unknown');}chunks.push(value);}
 const result=JSON.parse(Buffer.concat(chunks).toString());
 const ref=result?.data?.reference;if(typeof ref!=='string'||! /^[\w-]{1,128}$/.test(ref))throw new Error('provider_outcome_unknown');
 // Never accept provider-response completion as authority to unlock downloads.
 return ref;
}
