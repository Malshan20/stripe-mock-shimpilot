// Scan-only historical workflow. Never imported by the app or called remotely.
import Stripe from 'stripe';
export async function legacyOrderWorkflow(customerId:string,sku:string) {
  const stripe=new Stripe(process.env.STRIPE_SECRET_KEY!,{apiVersion:'2020-08-27' as Stripe.LatestApiVersion});
  return stripe.orders.create({currency:'usd',customer:customerId,items:[{type:'sku',parent:sku,quantity:1}]});
}
