import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHmac} from 'node:crypto';
import {handle} from '../src/lib/api';
import {db,billingFor} from '../src/lib/db';
import {stripeKey} from '../src/lib/config';
const directory=mkdtempSync(join(tmpdir(),'shimpilot-tests-'));
before(()=>{process.env.DEMO_MODE='true';process.env.APP_URL='http://localhost:3000';process.env.DATABASE_PATH=join(directory,'test.sqlite');process.env.SESSION_SECRET='test-secret-never-production';});
after(()=>{db().close();rmSync(directory,{recursive:true,force:true});});
let cookie='',projectId='',fileId='';
async function call(path:string,method='GET',payload?:unknown,session=cookie,origin='http://localhost:3000') {
 const form=payload instanceof FormData;
 return handle(new Request(`http://localhost:3000/api/${path}`,{method,headers:{Origin:origin,Cookie:session,...(payload&&!form?{'Content-Type':'application/json'}:{})},body:payload?form?payload:JSON.stringify(payload):undefined}),path.split('/'));
}
test('unauthenticated workspace is private',async()=>{assert.equal((await call('dashboard')).status,401);});
test('cross-origin mutations and wrong passwords are rejected',async()=>{
 assert.equal((await call('auth/login','POST',{email:'demo@shimpilot.test',password:'DemoPass123!'},'','https://evil.example')).status,403);
 assert.equal((await call('auth/login','POST',{email:'demo@shimpilot.test',password:'WrongPass123!'})).status,401);
});
test('login creates an HttpOnly cookie and safe user response',async()=>{
 const r=await call('auth/login','POST',{email:'demo@shimpilot.test',password:'DemoPass123!'});assert.equal(r.status,200);
 assert.match(r.headers.get('set-cookie')!,/HttpOnly; SameSite=Lax/);cookie=r.headers.get('set-cookie')!.split(';')[0];
 const data=await (await call('dashboard')).json();assert.equal(data.user.email,'demo@shimpilot.test');assert.ok(data.projects.length>=3);assert.equal(data.user.accessToken,undefined);
});
test('tampered sessions fail',async()=>{assert.equal((await call('dashboard','GET',undefined,cookie.replace(/.$/,'z'))).status,401);});
test('CRUD and AI actions preserve application output contracts',async()=>{
 const r=await call('projects','POST',{title:'Contract test',description:'Test baseline contracts.'});assert.equal(r.status,201);projectId=(await r.json()).id;
 assert.equal((await call(`projects/${projectId}`,'PATCH',{title:'Updated contract',description:'Updated description'})).status,200);
 const summary=await (await call(`projects/${projectId}/summary`,'POST')).json();assert.equal(summary.mode,'mock');assert.match(summary.text,/Mock AI/);
 assert.equal((await (await call(`projects/${projectId}/embedding`,'POST')).json()).dimensions,8);
 assert.equal((await (await call(`projects/${projectId}/moderation`,'POST')).json()).flagged,false);
 assert.equal((await (await call(`projects/${projectId}/review`,'POST')).json()).fixture,'retired-model');
 const data=await (await call('dashboard')).json();assert.equal(data.projects.find((p:{id:string})=>p.id===projectId).summary,summary.text);
});
test('file upload and download preserve bytes and MIME',async()=>{
 const form=new FormData();form.append('file',new File(['fixture content'],'contract.txt',{type:'text/plain'}));
 const r=await call('files','POST',form);assert.equal(r.status,201);fileId=(await r.json()).id;
 const download=await call(`files/${fileId}`);assert.equal(download.headers.get('content-type'),'text/plain');assert.equal(await download.text(),'fixture content');
});
test('other users cannot read or mutate owned records',async()=>{
 const r=await call('auth/register','POST',{email:'other@example.test',password:'OtherPass123!',name:'Other'});assert.equal(r.status,201);const other=r.headers.get('set-cookie')!.split(';')[0];
 const data=await (await call('dashboard','GET',undefined,other)).json();assert.equal(data.projects.length,0);assert.equal(data.files.length,0);
 assert.notEqual((await call(`projects/${projectId}`,'PATCH',{title:'Stolen',description:'Forbidden'},other)).status,200);
 assert.notEqual((await call(`files/${fileId}`,'GET',undefined,other)).status,200);
 assert.equal((await (await call(`projects/${projectId}`,'DELETE',undefined,other)).json()).deleted,false);
});
test('mock checkout checks ownership, and cancellation preserves status',async()=>{
 const checkout=await (await call('billing/checkout','POST',{requestId:crypto.randomUUID()})).json();assert.equal(checkout.mode,'mock');
 assert.notEqual((await call('billing/complete-mock','POST',{id:'cs_test_mock_wrong'})).status,200);
 assert.equal((await call('billing/complete-mock','POST',{id:checkout.id})).status,200);
 assert.equal((await (await call('dashboard')).json()).billing.status,'active');
 assert.equal((await (await call('billing/cancel','POST')).json()).status,'canceled');
 assert.equal((await (await call('cloud/export','POST')).json()).mode,'mock');
});
test('Stripe rejects live keys',()=>{
 process.env.STRIPE_SECRET_KEY='sk_live_forbidden';assert.throws(()=>stripeKey(),/Only Stripe/);
 process.env.STRIPE_SECRET_KEY='rk_test_fixture';assert.equal(stripeKey(),'rk_test_fixture');
});
test('signed raw webhooks reject tampering/live events and deduplicate receipts',async()=>{
 process.env.DEMO_MODE='false';process.env.STRIPE_MODE='remote';process.env.STRIPE_SECRET_KEY='sk_test_fixture';process.env.STRIPE_WEBHOOK_SECRET='whsec_fixture';
 const uid='00000000-0000-4000-8000-000000000001';billingFor(uid);
 db().prepare("UPDATE billing SET customer_id='cus_contract',checkout_id='cs_contract',status='free',subscription_id=null WHERE user_id=?").run(uid);
 async function webhook(event:unknown,bad=false) {
  const raw=JSON.stringify(event),time=Math.floor(Date.now()/1000),sig=createHmac('sha256','whsec_fixture').update(`${time}.${raw}`).digest('hex');
  return handle(new Request('http://localhost:3000/api/stripe/webhook',{method:'POST',headers:{'Stripe-Signature':`t=${time},v1=${bad?'00':sig}`},body:raw}),['stripe','webhook']);
 }
 const event={id:'evt_checkout_contract',type:'checkout.session.completed',livemode:false,data:{object:{id:'cs_contract',customer:'cus_contract',subscription:'sub_contract',client_reference_id:uid,payment_status:'paid'}}};
 assert.equal((await webhook(event,true)).status,400);assert.equal(billingFor(uid).status,'free');
 assert.equal((await webhook(event)).status,200);assert.equal(billingFor(uid).status,'active');
 assert.equal((await (await webhook(event)).json()).duplicate,true);
 assert.equal((await webhook({...event,id:'evt_live',livemode:true})).status,400);
 const deleted={id:'evt_delete',type:'customer.subscription.deleted',livemode:false,data:{object:{id:'sub_contract',customer:'cus_contract',status:'canceled'}}};
 await webhook(deleted);assert.equal(billingFor(uid).status,'canceled');
 db().prepare("UPDATE billing SET subscription_id='sub_new',status='active' WHERE user_id=?").run(uid);
 await webhook({...deleted,id:'evt_stale_old'});assert.equal(billingFor(uid).status,'active');
 process.env.DEMO_MODE='true';process.env.STRIPE_MODE='mock';
});
test('validation and logout revoke access',async()=>{
 assert.equal((await call('projects','POST',{title:'',description:''})).status,400);
 assert.equal((await call(`projects/${projectId}`,'DELETE')).status,200);
 assert.equal((await call('auth/logout','POST')).status,200);assert.equal((await call('dashboard')).status,401);
});
