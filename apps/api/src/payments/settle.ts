import type {Pool} from 'pg';
import type {PaymentEvent} from './snippe.js';
export async function settlePayment(pool:Pool,event:PaymentEvent,digest:string):Promise<'accepted'|'duplicate'|'denied'> {
 const c=await pool.connect();
 try {
  await c.query('begin');
  const p=(await c.query('select * from payment_intents where id=$1 for update',[event.intentId])).rows[0];
  if(!p||p.amount_tzs!==event.amount||p.currency!==event.currency||(p.provider_reference&&p.provider_reference!==event.reference)){await c.query('rollback');return 'denied';}
  const previous=(await c.query('select * from payment_events where webhook_event_id=$1',[event.id])).rows[0];
  if(previous){await c.query('rollback');return previous.payment_intent_id===p.id&&previous.payload_digest===digest?'duplicate':'denied';}
  // Terminal states cannot be reversed or a failed/cancelled attempt resurrected.
  if(['completed','failed','voided','expired'].includes(p.status)&&p.status!==event.type){await c.query('rollback');return 'denied';}
  await c.query('insert into payment_events(webhook_event_id,payment_intent_id,event_type,provider_reference,amount_tzs,currency,payload_digest) values($1,$2,$3,$4,$5,$6,$7)',[event.id,p.id,event.type,event.reference,event.amount,event.currency,digest]);
  await c.query('update payment_intents set status=$2,provider_reference=$3,updated_at=now() where id=$1',[p.id,event.type,event.reference]);
  if(event.type==='completed')await c.query(`insert into paid_entitlements(user_id,payment_intent_id,downloads_per_day,plan_code,downloads_total,expires_at) values($1,$2,$3,$4,$5,now()+make_interval(secs=>$6)) on conflict(payment_intent_id) do nothing`,[p.user_id,p.id,p.downloads_per_day,p.plan_code,p.downloads_total,p.duration_seconds]);
  await c.query('commit');return 'accepted';
 }catch{await c.query('rollback');throw new Error('payment_settlement_failed');}finally{c.release();}
}
