import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { db, hashPassword, billingFor, logEvent } from './db';
import { HttpError, checkOrigin, requireUser, getUser, makeSession, endSession, passwordMatches } from './auth';
import { mode, configurations, required } from './config';
import * as supabase from './providers/supabase';
import * as stripe from './providers/stripe';
import * as ai from './providers/openai';
import { legacyReview } from './providers/anthropic';
import { exportToCloud } from './providers/aws';
import { saveFile, readOwnedFile } from './files';
import { scenarios } from './scenarios';
const authInput=z.object({email:z.string().email().max(200),password:z.string().min(8).max(128),name:z.string().min(1).max(80).optional()});
const projectInput=z.object({title:z.string().trim().min(1).max(100),description:z.string().trim().min(1).max(5000)});
const json=(data:unknown,status=200,headers:HeadersInit={})=>Response.json(data,{status,headers});
async function body(request:Request) {
  if(Number(request.headers.get('content-length') ?? 0)>20_000) throw new HttpError(413,'Request too large');
  const text=await request.text();if(text.length>20_000) throw new HttpError(413,'Request too large');
  try {return JSON.parse(text);}catch {throw new HttpError(400,'Invalid JSON');}
}
// Bounded in-process limiter for this single-instance demo, not distributed infrastructure.
const rates=new Map<string,{count:number;until:number}>();
function limit(key:string,max:number) {
  if(rates.size>5000) for(const [k,v] of rates) if(v.until<Date.now()) rates.delete(k);
  const entry=rates.get(key);if(!entry || entry.until<Date.now()) {rates.set(key,{count:1,until:Date.now()+60_000});return;}
  if(++entry.count>max) throw new HttpError(429,'Too many requests; try again in a minute');
}
export async function handle(request:Request,path:string[]) {
  const route=path.join('/'), method=request.method;
  try {
    if(route==='health' && method==='GET') return json({ok:true,app:'Shimpilot Demo Lab',providers:configurations()});
    if(route==='stripe/webhook' && method==='POST') {
      if(mode('stripe')!=='remote') throw new HttpError(409,'Real webhooks require STRIPE_MODE=remote');
      const signature=request.headers.get('stripe-signature');if(!signature) throw new HttpError(400,'Missing Stripe signature');
      const raw=await request.text();if(raw.length>1_000_000) throw new HttpError(413,'Webhook too large');
      let event;try {event=stripe.constructWebhook(raw,signature,required('STRIPE_WEBHOOK_SECRET'));}catch {throw new HttpError(400,'Webhook signature verification failed');}
      if(event.livemode) throw new HttpError(400,'Live events rejected');
      return json({received:true,...stripe.applyWebhook(event)});
    }
    if(method!=='GET') checkOrigin(request);
    if(route==='auth/me' && method==='GET') {const u=getUser(request);return json({user:u ? {id:u.id,email:u.email,name:u.name,provider:u.provider} : null});}
    if(['auth/login','auth/register'].includes(route) && method==='POST') {
      limit('auth',40);
      const input=authInput.parse(await body(request));input.email=input.email.toLowerCase();
      if(mode('supabase')==='remote') {
        const remote=route==='auth/login' ? await supabase.signIn(input.email,input.password) : await supabase.signUp(input.email,input.password,input.name ?? 'Developer');
        if(!remote.user) throw new HttpError(401,'Authentication failed');
        if(!remote.session) return json({confirmationRequired:true,message:'Check your email to confirm your account, then sign in.'});
        db().prepare('INSERT INTO users VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name').run(remote.user.id,input.email,null,remote.user.user_metadata?.name ?? input.name ?? 'Developer','supabase');
        return json({ok:true},200,{'Set-Cookie':makeSession(remote.user.id,remote.session.access_token,remote.session.expires_at)});
      }
      if(route==='auth/register') {
        if(db().prepare('SELECT id FROM users WHERE email=?').get(input.email)) throw new HttpError(409,'Email already registered');
        const id=randomUUID();db().prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(id,input.email,hashPassword(input.password),input.name ?? 'Developer','mock');
        return json({ok:true},201,{'Set-Cookie':makeSession(id)});
      }
      const row=db().prepare('SELECT * FROM users WHERE email=? AND provider=?').get(input.email,'mock') as {id:string;password:string}|undefined;
      if(!row || !passwordMatches(input.password,row.password)) throw new HttpError(401,'Incorrect email or password');
      return json({ok:true},200,{'Set-Cookie':makeSession(row.id)});
    }
    if(route==='auth/logout' && method==='POST') return json({ok:true},200,{'Set-Cookie':endSession(request)});
    const user=requireUser(request);
    if(route==='dashboard' && method==='GET') return json({
      user:{id:user.id,email:user.email,name:user.name,provider:user.provider},
      projects:await supabase.listProjects(user),billing:billingFor(user.id),providers:configurations(),scenarios,
      files:db().prepare('SELECT id,name,mime,size,provider,created_at FROM files WHERE user_id=? ORDER BY created_at DESC').all(user.id),
      events:db().prepare('SELECT id,provider,action,status,detail,created_at FROM events WHERE user_id=? ORDER BY created_at DESC LIMIT 40').all(user.id)
    });
    if(route==='projects' && method==='POST') {
      const p=projectInput.parse(await body(request));const row=await supabase.createProject(user,p.title,p.description);
      logEvent(user.id,'supabase','Project created','success',`Database mode: ${mode('supabase')}`);return json(row,201);
    }
    if(path[0]==='projects' && path[1]) {
      const id=z.string().uuid().parse(path[1]);
      if(path.length===2 && method==='PATCH') return json(await supabase.updateProject(user,id,projectInput.parse(await body(request))));
      if(path.length===2 && method==='DELETE') return json(await supabase.deleteProject(user,id));
      if(method==='POST' && ['summary','embedding','moderation','review'].includes(path[2])) {
        limit(`ai:${user.id}`,12);
        const project=(await supabase.listProjects(user)).find(p=>p.id===id);if(!project) throw new HttpError(404,'Project not found');
        const action=path[2],text=`${project.title}\n${project.description}`;
        try {
          const result=action==='summary' ? await ai.summarize(text) : action==='embedding' ? await ai.embed(text) : action==='moderation' ? await ai.moderate(text) : await legacyReview(text);
          if(action==='summary' && 'text' in result) await supabase.updateProject(user,id,{summary:result.text});
          logEvent(user.id,action==='review'?'anthropic':'openai',action,'success',`Provider mode: ${result.mode}`);return json(result);
        } catch(error) {logEvent(user.id,action==='review'?'anthropic':'openai',action,'failed','Provider request failed; check credentials/model and server logs');throw error;}
      }
    }
    if(route==='files' && method==='POST') {
      if(Number(request.headers.get('content-length') ?? 0)>2_200_000) throw new HttpError(413,'File too large');
      const form=await request.formData(),file=form.get('file');if(!(file instanceof File)) throw new HttpError(400,'Select a file');
      const result=await saveFile(user,file);logEvent(user.id,'supabase','File uploaded','success',`${result.name} (${result.provider})`);return json(result,201);
    }
    if(path[0]==='files' && path[1] && method==='GET') {
      const id=z.string().uuid().parse(path[1]);const {file,bytes}=await readOwnedFile(user,id);
      return new Response(new Uint8Array(bytes),{headers:{'Content-Type':file.mime,'Content-Disposition':`attachment; filename="${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}"`,'X-Content-Type-Options':'nosniff'}});
    }
    if(route==='billing/checkout' && method==='POST') {
      const {requestId}=z.object({requestId:z.string().uuid()}).parse(await body(request));
      const result=await stripe.checkout(user,requestId);logEvent(user.id,'stripe','Checkout created','success',`Mode: ${result.mode}`);return json(result);
    }
    if(route==='billing/complete-mock' && method==='POST') {
      const {id}=z.object({id:z.string().min(1).max(200)}).parse(await body(request));const result=stripe.completeMockCheckout(user,id);
      logEvent(user.id,'stripe','Mock checkout confirmed','success','Simulated subscription; no Stripe call');return json(result);
    }
    if(route==='billing/portal' && method==='POST') return json(await stripe.portal(user));
    if(route==='billing/cancel' && method==='POST') {const result=await stripe.cancelSubscription(user);logEvent(user.id,'stripe','Subscription canceled','success',`Mode: ${result.mode}`);return json(result);}
    if(route==='cloud/export' && method==='POST') {
      limit(`cloud:${user.id}`,8);const result=await exportToCloud(user.id,await supabase.listProjects(user));
      logEvent(user.id,'aws','Projects exported','success',`${result.mode}: ${result.key}`);return json(result);
    }
    throw new HttpError(404,'Endpoint not found');
  } catch(error) {
    if(error instanceof HttpError) return json({error:error.message},error.status);
    if(error instanceof z.ZodError) return json({error:error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')},400);
    const message=error instanceof Error?error.message:'Request failed';
    // Do not echo provider response bodies or credentials to the browser.
    const safe=/^(Configure |Only Stripe |No subscription|No project|No updated|Project not found|File not found|Upload a |Use TXT|Complete checkout|Cancel the existing|Mock completion|Checkout does not belong)/.test(message);
    return json({error:safe?message:'Request failed. Check provider configuration and compatibility; no mock fallback was used.'},502);
  }
}
