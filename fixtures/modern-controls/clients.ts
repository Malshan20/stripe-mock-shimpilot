// Isolated, exact-version fixture manifest: do not install as part of app setup.
import Stripe from 'stripe';
import OpenAI from 'openai';
import {createClient} from '@supabase/supabase-js';
import {S3Client,ListObjectsV2Command} from '@aws-sdk/client-s3';
export async function modernControls() {
  const stripe=new Stripe(process.env.STRIPE_SECRET_KEY!,{apiVersion:'2023-08-16'});
  const ai=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
  const db=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_ANON_KEY!,{db:{schema:'public'},auth:{persistSession:false}});
  const s3=new S3Client({region:'us-east-1'});
  return Promise.all([
    stripe.subscriptions.cancel('sub_control'),
    ai.chat.completions.create({model:'gpt-4o-mini',messages:[{role:'user',content:'Control'}]}),
    db.from('projects').insert({title:'Control'}).select(),
    s3.send(new ListObjectsV2Command({Bucket:'scan-only-bucket'}))
  ]);
}
