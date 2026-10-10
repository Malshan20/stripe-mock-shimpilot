import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer,type Server} from 'node:http';
import * as ai from '../src/lib/providers/openai';
import * as supabase from '../src/lib/providers/supabase';
import type {User} from '../src/lib/auth';
import * as stripe from '../src/lib/providers/stripe';
import {db,billingFor} from '../src/lib/db';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const directory=mkdtempSync(join(tmpdir(),'provider-contracts-'));

let server:Server;
const requests:{path:string;method:string;body:Record<string,unknown>;authorization?:string}[]=[];
const uid='10000000-0000-4000-8000-000000000001';
const row={id:'10000000-0000-4000-8000-000000000002',user_id:uid,title:'Remote contract',description:'HTTP fixture',summary:null,created_at:new Date().toISOString()};
const user:User={id:uid,email:'http@example.test',name:'HTTP fixture',provider:'supabase',accessToken:'user-fixture-jwt'};
before(async()=>{
 server=createServer(async(req,res)=>{
  const chunks:Buffer[]=[];for await(const chunk of req) chunks.push(Buffer.from(chunk));
  const raw=Buffer.concat(chunks).toString(),body=raw?(req.headers['content-type']?.startsWith('application/x-www-form-urlencoded') ? Object.fromEntries(new URLSearchParams(raw)) : JSON.parse(raw)):{},path=new URL(req.url!,'http://localhost').pathname;
  requests.push({path,method:req.method!,body,authorization:req.headers.authorization});res.setHeader('Content-Type','application/json');
  if(path==='/v1/customers') return res.end(JSON.stringify({id:'cus_sdk_contract',object:'customer'}));
  if(path==='/v1/checkout/sessions') return res.end(JSON.stringify({id:'cs_sdk_contract',url:'https://checkout.stripe.com/c/test_fixture'}));
  if(path==='/v1/billing_portal/sessions') return res.end(JSON.stringify({id:'bps_contract',url:'https://billing.stripe.com/test_fixture'}));
  if(path==='/v1/subscriptions/sub_sdk_contract') return res.end(JSON.stringify({id:'sub_sdk_contract',status:'canceled',customer:'cus_sdk_contract'}));
  if(path==='/v1/chat/completions') return res.end(JSON.stringify({id:'chatcmpl_fixture',choices:[{message:{role:'assistant',content:'A real SDK response contract.'}}]}));
  if(path==='/v1/embeddings') return res.end(JSON.stringify({data:[{embedding:[0.2,0.3,0.4,0.5,0.6]}]}));
  if(path==='/v1/moderations') return res.end(JSON.stringify({results:[{flagged:false}]}));
  if(path==='/auth/v1/token') return res.end(JSON.stringify({access_token:'fixture_access_token',refresh_token:'fixture_refresh_token',token_type:'bearer',expires_in:3600,user:{id:uid,email:user.email,user_metadata:{name:user.name}}}));
  if(path==='/rest/v1/projects') return res.end(JSON.stringify(req.method==='POST'||req.method==='PATCH'?{...row,...(Array.isArray(body)?body[0]:body)}:[row]));
  res.statusCode=404;res.end(JSON.stringify({error:'Unmocked endpoint'}));
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
 Object.assign(process.env,{NODE_ENV:'test'});process.env.DATABASE_PATH=join(directory,'test.sqlite');process.env.STRIPE_MODE='remote';process.env.STRIPE_SECRET_KEY='sk_test_fixture';process.env.STRIPE_TEST_ORIGIN=origin;
 db().prepare('INSERT OR IGNORE INTO users VALUES(?,?,?,?,?)').run(user.id,user.email,null,user.name,user.provider);
 process.env.DEMO_MODE='false';process.env.OPENAI_MODE='remote';process.env.OPENAI_API_KEY='fixture-no-real-key';process.env.OPENAI_BASE_URL=`${origin}/v1`;
 process.env.SUPABASE_MODE='remote';process.env.SUPABASE_URL=origin;process.env.SUPABASE_ANON_KEY='fixture-anon-key';
});
after(async()=>{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));db().close();rmSync(directory,{recursive:true,force:true});});
test('real OpenAI SDK chat preserves summary output shape',async()=>{
 assert.deepEqual(await ai.summarize('Project description'),{text:'A real SDK response contract.',mode:'remote'});
 const r=requests.find(r=>r.path==='/v1/chat/completions')!;assert.equal(r.method,'POST');assert.equal(r.authorization,'Bearer fixture-no-real-key');assert.equal(r.body.model,'gpt-4o-mini');
});
test('real OpenAI SDK embedding and moderation preserve output shapes',async()=>{
 assert.deepEqual(await ai.embed('Project'),{dimensions:5,preview:[0.2,0.3,0.4,0.5],mode:'remote'});assert.deepEqual(await ai.moderate('Safe project'),{flagged:false,mode:'remote'});
});
test('real Supabase SDK password sign-in preserves user and session',async()=>{
 const r=await supabase.signIn(user.email,'Password123!');assert.equal(r.user.id,uid);assert.equal(r.session.access_token,'fixture_access_token');assert.equal(requests.find(r=>r.path==='/auth/v1/token')!.body.email,user.email);
});
test('real Supabase SDK returns mutation rows and sends user JWT',async()=>{
 assert.equal((await supabase.listProjects(user))[0].id,row.id);
 assert.equal((await supabase.createProject(user,row.title,row.description)).id,row.id);
 assert.equal((await supabase.updateProject(user,row.id,{title:'Updated'})).title,'Updated');
 assert.equal((await supabase.deleteProject(user,row.id)).deleted,true);
 assert.ok(requests.filter(r=>r.path==='/rest/v1/projects').every(r=>r.authorization==='Bearer user-fixture-jwt'));
});

test('real Stripe SDK checkout preserves sandbox session and customer contracts',async()=>{
 const result=await stripe.checkout(user,crypto.randomUUID());assert.equal(result.id,'cs_sdk_contract');assert.equal(result.mode,'remote');assert.equal(billingFor(user.id).customer_id,'cus_sdk_contract');
 const request=requests.find(r=>r.path==='/v1/checkout/sessions')!;assert.equal(request.body.mode,'subscription');assert.equal(request.body.customer,'cus_sdk_contract');assert.equal(request.body['line_items[0][price_data][unit_amount]'],'1200');
});
test('real Stripe SDK portal returns hosted portal URL',async()=>{assert.match((await stripe.portal(user)).url,/billing.stripe.com/);});
test('real Stripe SDK cancellation retains DELETE and application status contracts',async()=>{
 db().prepare("UPDATE billing SET subscription_id='sub_sdk_contract',status='active' WHERE user_id=?").run(user.id);
 assert.deepEqual(await stripe.cancelSubscription(user),{status:'canceled',mode:'remote'});assert.equal(requests.find(r=>r.path==='/v1/subscriptions/sub_sdk_contract')!.method,'DELETE');assert.equal(billingFor(user.id).status,'canceled');
});
