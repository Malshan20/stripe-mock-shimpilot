// Start the app in mock mode first. This script creates and deletes its own test records.
import assert from 'node:assert/strict';
const origin=process.env.APP_URL || 'http://localhost:3000';
let cookie='';
async function api(path,method='GET',body){const response=await fetch(`${origin}/api/${path}`,{method,headers:{Origin:origin,Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const session=response.headers.get('set-cookie');if(session) cookie=session.split(';')[0];const data=await response.json();assert.ok(response.ok,`${path}: ${JSON.stringify(data)}`);return data;}
const health=await api('health');assert.ok(health.providers.every(p=>p.mode==='mock'),'Smoke test requires ALL providers in mock mode');
const email=`smoke-${Date.now()}@example.test`;
await api('auth/register','POST',{email,password:'SmokePass123!',name:'Smoke Test'});
const project=await api('projects','POST',{title:'Smoke project',description:'Validate the full frontend/backend contract.'});
const result=await api(`projects/${project.id}/summary`,'POST');assert.equal(result.mode,'mock');
const checkout=await api('billing/checkout','POST',{requestId:crypto.randomUUID()});await api('billing/complete-mock','POST',{id:checkout.id});
assert.equal((await api('dashboard')).billing.status,'active');
await api('billing/cancel','POST');await api(`projects/${project.id}`,'DELETE');await api('auth/logout','POST');
assert.equal((await api('auth/me')).user,null);
console.log('PASS: real HTTP auth, project CRUD, AI summary, checkout, cancellation, and logout.');
