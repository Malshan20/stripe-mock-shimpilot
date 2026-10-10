import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db } from './db';
import { mode, required, appUrl } from './config';
export type User = { id:string;email:string;name:string;provider:string;accessToken?:string };
export class HttpError extends Error { constructor(public status:number, message:string) { super(message); } }
function secret() { return process.env.SESSION_SECRET || (process.env.DEMO_MODE !== 'false' ? 'local-demo-only-secret-not-for-remote-use' : required('SESSION_SECRET')); }
function sign(token:string) { return createHmac('sha256', secret()).update(token).digest('hex'); }
const digest = (token:string) => createHash('sha256').update(token).digest('hex');
export function makeSession(userId:string, accessToken?:string, remoteExpires?:number) {
  const token = randomBytes(32).toString('hex');
  const expires = remoteExpires ? Math.min(remoteExpires * 1000, Date.now() + 3600_000) : Date.now()+86400_000;
  db().prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(token),userId,expires,accessToken ?? null);
  const seconds = Math.max(0, Math.floor((expires-Date.now())/1000));
  return `lab_session=${token}.${sign(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${appUrl().startsWith('https:') ? '; Secure' : ''}`;
}
function cookieToken(request:Request) {
  const value = request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('lab_session='))?.slice(12);
  if (!value) return null;
  const [token,signature] = value.split('.');
  if (!token || !signature || !/^[a-f0-9]{64}$/.test(token) || !/^[a-f0-9]{64}$/.test(signature)) return null;
  if (!timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(sign(token),'hex'))) return null;
  return token;
}
export function getUser(request:Request): User | null {
  const token=cookieToken(request); if (!token) return null;
  const row=db().prepare('SELECT users.id,email,name,provider,access_token,expires FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.id=?').get(digest(token)) as (User & {expires:number;access_token:string|null}) | undefined;
  if (!row || row.expires < Date.now()) return null;
  if (row.provider === 'mock' && mode('supabase') === 'remote') return null;
  return {id:row.id,email:row.email,name:row.name,provider:row.provider,accessToken:row.access_token ?? undefined};
}
export function requireUser(request:Request) { const user=getUser(request);if (!user) throw new HttpError(401,'Please sign in');return user; }
export function endSession(request:Request) {const token=cookieToken(request);if(token) db().prepare('DELETE FROM sessions WHERE id=?').run(digest(token));return 'lab_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';}
export function checkOrigin(request:Request) {
  if (request.headers.get('origin') !== appUrl()) throw new HttpError(403,'Origin does not match APP_URL');
}
export function passwordMatches(password:string, stored:string) {
  const [salt,hex]=stored.split(':');const expected=Buffer.from(hex,'hex');const actual=scryptSync(password,salt,64);
  return expected.length===actual.length && timingSafeEqual(expected,actual);
}
