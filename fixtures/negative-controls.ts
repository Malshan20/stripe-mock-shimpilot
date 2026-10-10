// Lookalikes must not be attributed to vendors by identifier spelling alone.
class Stripe { subscriptions={del:async(id:string)=>({id,status:'local'})}; }
class OpenAIApi { createChatCompletion=async()=>({data:{choices:[]}}); }
const stripe=new Stripe();
const openai=new OpenAIApi();
export async function localLookalikes() {return [await stripe.subscriptions.del('local'),await openai.createChatCompletion()];}
export const documentationString='stripe.orders.create and supabase.auth.signIn are example strings';
export async function signIn(email:string) {return {email,provider:'local'};}
