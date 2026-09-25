import type {FastifyInstance} from 'fastify';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {requireActor} from '../actor.js';
import {requireAuth} from '../auth.js';
import {getPool} from '../db.js';
import {PAID_PLANS,checkoutEnabled,findPlan,createPayment,paymentBody,parseEvent,validSignature} from '../payments/snippe.js';
import {settlePayment} from '../payments/settle.js';
const uuid='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
export async function paymentsRoutes(app:FastifyInstance) {
 // Public catalogue. Prices/quotas come from server code; `available` says whether checkout is live.
 app.get('/v1/payments/plans',async()=>({available:checkoutEnabled(),currency:'TZS',methods:['mobile'],free:{videosPerDay:1},plans:Object.values(PAID_PLANS).map(p=>({code:p.code,name:p.name,amountTzs:p.amount,days:p.days,videos:p.videos}))}));
 // What the signed-in account has right now: today's free use plus the active paid quota (if any).
 app.get('/v1/payments/entitlement',{preHandler:requireAuth},async(req)=>{
  const pool=getPool();
  const free=(await pool.query(`select count(*)::int n from download_grants where user_id=$1 and entitlement_id is null and granted_at>=(date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')`,[req.userId])).rows[0].n;
  const rows=(await pool.query(`select e.plan_code,e.downloads_total,e.expires_at,(select count(*)::int from download_grants g where g.entitlement_id=e.id) used from paid_entitlements e join payment_intents p on p.id=e.payment_intent_id where e.user_id=$1 and e.revoked_at is null and e.downloads_total is not null and e.starts_at<=now() and e.expires_at>now() and p.status='completed' order by e.expires_at asc`,[req.userId])).rows;
  const remaining=rows.reduce((n,r)=>n+Math.max(0,r.downloads_total-r.used),0);
  return {free:{perDay:1,usedToday:free},paid:rows.length?{videosRemaining:remaining,videosTotal:rows.reduce((n,r)=>n+r.downloads_total,0),expiresAt:rows[rows.length-1].expires_at,planCodes:rows.map(r=>r.plan_code)}:null};
 });
 app.get('/v1/payments/:id',{preHandler:requireAuth,schema:{params:{type:'object',required:['id'],properties:{id:{type:'string',pattern:uuid}}}}},async(req,reply)=>{
  const {id}=req.params as {id:string};
  const p=(await getPool().query('select id,status,amount_tzs,currency,plan_name,plan_code from payment_intents where id=$1 and user_id=$2',[id,req.userId])).rows[0];
  return p??reply.code(404).send({error:'not_found'});
 });
 app.post('/v1/payments',{preHandler:requireActor,bodyLimit:8192,schema:{body:{type:'object',additionalProperties:false,required:['planCode','method','phone','firstname','lastname'],properties:{planCode:{enum:['weekly','monthly']},method:{enum:['mobile','card']},phone:{type:'string',pattern:'^255[67][0-9]{8}$'},firstname:{type:'string',minLength:1,maxLength:80},lastname:{type:'string',minLength:1,maxLength:80}}}}},async(req,reply)=>{
  if(!req.userId)return reply.code(401).send({error:'login_required'});
  if(!checkoutEnabled())return reply.code(503).send({error:'checkout_unavailable'});
  const b=req.body as {planCode:string;method:'mobile'|'card';phone:string;firstname:string;lastname:string};
  const plan=findPlan(b.planCode);if(!plan)return reply.code(400).send({error:'unknown_plan'});
  // Card checkout is deliberately gated pending approved billing/redirect contract and sandbox.
  if(b.method!=='mobile')return reply.code(409).send({error:'payment_method_unavailable'});
  const pool=getPool();
  const customer=(await pool.query('select email from auth.users where id=$1',[req.userId])).rows[0];
  const id=randomUUID(),key=randomBytes(15).toString('hex');const c=await pool.connect();
  try {
   await c.query('begin');await c.query('select id from profiles where id=$1 for update',[req.userId]);
   const previous=(await c.query(`select id,status from payment_intents where user_id=$1 and status in ('created','pending','unknown')`,[req.userId])).rows[0];
   if(previous){await c.query('rollback');return reply.code(202).send(previous);}
   const count=(await c.query(`select count(*)::int n from payment_intents where user_id=$1 and created_at>now()-interval '1 day'`,[req.userId])).rows[0].n;
   if(count>=5){await c.query('rollback');return reply.code(429).send({error:'payment_rate_limit'});}
   await c.query('insert into payment_intents(id,user_id,amount_tzs,plan_name,plan_code,duration_seconds,downloads_per_day,downloads_total,payment_method,idempotency_key) values($1,$2,$3,$4,$5,$6,$7,$7,$8,$9)',[id,req.userId,plan.amount,plan.name,plan.code,plan.durationSeconds,plan.videos,b.method,key]);
   await c.query('commit');
  }catch{await c.query('rollback');return reply.code(503).send({error:'payment_unavailable'});}finally{c.release();}
  try {
   const payload=paymentBody({id,amount:plan.amount,method:b.method,phone:b.phone,customer:{firstname:b.firstname,lastname:b.lastname,email:customer.email}},'https://api.hasheemstudio.com/webhooks/snippe');
   const reference=await createPayment(payload,process.env.SNIPPE_API_KEY!,key);
   await pool.query(`update payment_intents set provider_reference=coalesce(provider_reference,$2),status=case when status='created' then 'pending' else status end,updated_at=now() where id=$1`,[id,reference]);
   req.log.info({event:'payment_initiated',verdict:'provider_accepted',plan:plan.code});
   return reply.code(202).send({id,status:'pending'});
  }catch{
   await pool.query(`update payment_intents set status='unknown',updated_at=now() where id=$1 and status='created'`,[id]);
   req.log.warn({event:'payment_initiated',verdict:'outcome_unknown'});
   return reply.code(202).send({id,status:'unknown'});
  }
 });
 // Encapsulated raw body parser: signature is checked before JSON parsing. No body logging.
 app.register(async scope=>{
  scope.removeContentTypeParser('application/json');
  scope.addContentTypeParser('application/json',{parseAs:'buffer',bodyLimit:65536},(_r,body,done)=>done(null,body));
  scope.post('/webhooks/snippe',{bodyLimit:65536},async(req,reply)=>{
   const raw=req.body;const secret=process.env.SNIPPE_WEBHOOK_SECRET;
   if(!secret)return reply.code(503).send({error:'webhook_unavailable'});
   if(!Buffer.isBuffer(raw)||!validSignature(raw,req.headers['x-webhook-timestamp'],req.headers['x-webhook-signature'],secret)){
    req.log.warn({event:'payment_webhook',verdict:'invalid_signature_or_timestamp'});return reply.code(401).send({error:'invalid_webhook'});
   }
   const event=parseEvent(raw);if(!event){req.log.warn({event:'payment_webhook',verdict:'invalid_schema'});return reply.code(400).send({error:'invalid_webhook'});}
   try {
    const result=await settlePayment(getPool(),event,createHash('sha256').update(raw).digest('hex'));
    req.log.info({event:'payment_webhook',verdict:result});return reply.code(result==='denied'?400:200).send({status:result});
   }catch{req.log.error({event:'payment_webhook',verdict:'settlement_unavailable'});return reply.code(503).send({error:'webhook_unavailable'});}
  });
 });
}
