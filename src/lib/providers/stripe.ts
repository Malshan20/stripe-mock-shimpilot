import Stripe from 'stripe';
import { appUrl, mode, stripeKey } from '../config';
import { billingFor, db } from '../db';
import type { User } from '../auth';
// Local HTTP transport for contract tests only. Never accepts a remote host.
function testTransport(): {host?:string;port?:number;protocol?:'http'} {
  if(process.env.NODE_ENV!=='test' || !process.env.STRIPE_TEST_ORIGIN) return {};
  const url=new URL(process.env.STRIPE_TEST_ORIGIN);
  if(url.protocol!=='http:' || url.hostname!=='127.0.0.1') throw new Error('Invalid local Stripe test transport');
  return {host:url.hostname,port:Number(url.port),protocol:'http'};
}

// DELIBERATE: historical SDK + API version. Preserve test mode during migrations.
export function stripeClient() {
  const stripe = new Stripe(stripeKey(), { apiVersion: '2020-08-27' as Stripe.LatestApiVersion, maxNetworkRetries: 1, ...testTransport() });
  return stripe;
}
export async function checkout(user:User, requestId:string) {
  const billing=billingFor(user.id);
  if (billing.status === 'active') throw new Error('Cancel the existing subscription before creating another');
  if(mode('stripe')==='mock') {
    const id=`cs_test_mock_${requestId}`;
    db().prepare('UPDATE billing SET checkout_id=? WHERE user_id=?').run(id,user.id);
    return {url:`${appUrl()}/?checkout=${id}`,id,mode:'mock'};
  }
  const stripe=new Stripe(stripeKey(), { apiVersion: '2020-08-27' as Stripe.LatestApiVersion, maxNetworkRetries: 1, ...testTransport() });
  const customerId=billing.customer_id ?? (await stripe.customers.create({email:user.email,name:user.name,metadata:{user_id:user.id}},{idempotencyKey:`lab-customer-${user.id}`})).id;
  db().prepare('UPDATE billing SET customer_id=? WHERE user_id=?').run(customerId,user.id);
  const session=await stripe.checkout.sessions.create({
    mode:'subscription',customer:customerId,client_reference_id:user.id,
    line_items:[{price_data:{currency:'usd',unit_amount:1200,recurring:{interval:'month'},product_data:{name:'Shimpilot Demo Pro'}},quantity:1}],
    success_url:`${appUrl()}/?checkout={CHECKOUT_SESSION_ID}`,cancel_url:`${appUrl()}/?checkout=cancelled`,
    metadata:{user_id:user.id},subscription_data:{metadata:{user_id:user.id}}
  },{idempotencyKey:`lab-checkout-${user.id}-${requestId}`});
  db().prepare('UPDATE billing SET checkout_id=? WHERE user_id=?').run(session.id,user.id);
  return {url:session.url,id:session.id,mode:'remote'};
}
export async function portal(user:User) {
  if(mode('stripe')==='mock') return {url:`${appUrl()}/?portal=mock`,mode:'mock'};
  const customer=billingFor(user.id).customer_id;if(!customer) throw new Error('Complete checkout first');
  const stripe=new Stripe(stripeKey(), { apiVersion: '2020-08-27' as Stripe.LatestApiVersion, maxNetworkRetries: 1, ...testTransport() });
  const session=await stripe.billingPortal.sessions.create({customer,return_url:appUrl()});
  return {url:session.url,mode:'remote'};
}
export async function cancelSubscription(user:User) {
  const subscription=billingFor(user.id).subscription_id;if(!subscription) throw new Error('No subscription to cancel');
  if(mode('stripe')==='mock') { db().prepare("UPDATE billing SET status='canceled' WHERE user_id=?").run(user.id);return {status:'canceled',mode:'mock'}; }
  const stripe=new Stripe(stripeKey(), { apiVersion: '2020-08-27' as Stripe.LatestApiVersion, maxNetworkRetries: 1, ...testTransport() });
  // POSITIVE CASE: v13 removes .del; semantically preserve args/response on rename.
  const result=await stripe.subscriptions.del(subscription);
  db().prepare('UPDATE billing SET status=? WHERE user_id=?').run(result.status,user.id);
  return {status:result.status,mode:'remote'};
}
export function constructWebhook(rawBody:string, signature:string, secret:string) {
  const stripe=new Stripe(stripeKey(), { apiVersion: '2020-08-27' as Stripe.LatestApiVersion, maxNetworkRetries: 1, ...testTransport() });
  return stripe.webhooks.constructEvent(rawBody,signature,secret);
}
export function applyWebhook(event:Stripe.Event) {
  if(event.livemode) throw new Error('Live Stripe events are rejected');
  const database=db();database.exec('BEGIN IMMEDIATE');
  try {
    const receipt=database.prepare('INSERT OR IGNORE INTO webhook_receipts VALUES(?,?,?)').run(event.id,event.type,new Date().toISOString());
    if(!receipt.changes) { database.exec('COMMIT');return {duplicate:true}; }
    if(event.type==='checkout.session.completed') {
      const session=event.data.object as Stripe.Checkout.Session;
      const current=database.prepare('SELECT user_id,checkout_id FROM billing WHERE customer_id=?').get(String(session.customer)) as {user_id:string;checkout_id:string}|undefined;
      if(current && current.checkout_id === session.id && current.user_id === session.client_reference_id && session.payment_status==='paid') {
        database.prepare("UPDATE billing SET status='active',subscription_id=? WHERE user_id=?").run(String(session.subscription),current.user_id);
      }
    }
    if(event.type.startsWith('customer.subscription.')) {
      const sub=event.data.object as Stripe.Subscription;
      database.prepare('UPDATE billing SET status=? WHERE customer_id=? AND subscription_id=?').run(sub.status,String(sub.customer),sub.id);
    }
    database.exec('COMMIT');return {duplicate:false};
  } catch(error) {database.exec('ROLLBACK');throw error;}
}
export function completeMockCheckout(user:User, id:string) {
  if(mode('stripe')!=='mock') throw new Error('Mock completion is disabled');
  if(billingFor(user.id).checkout_id!==id || !id.startsWith('cs_test_mock_')) throw new Error('Checkout does not belong to this user');
  db().prepare("UPDATE billing SET status='active',customer_id=?,subscription_id=? WHERE user_id=?").run(`cus_mock_${user.id}`,`sub_mock_${user.id}`,user.id);
  return {status:'active',mode:'mock'};
}
