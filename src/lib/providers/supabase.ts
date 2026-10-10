import { createClient } from '@supabase/supabase-js';
import { mode, required } from '../config';
import { db, type Project } from '../db';
import type { User } from '../auth';
export function supabaseClient(token?:string) {
  // POSITIVE CASE: v2 nests schema/persistSession. Anon key only; RLS is enforced.
  const supabase=createClient(required('SUPABASE_URL'),required('SUPABASE_ANON_KEY'),{
    schema:'public',persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,
    headers:token ? {Authorization:`Bearer ${token}`} : {}
  });
  return supabase;
}
export async function signIn(email:string,password:string) {
  const supabase=createClient(required('SUPABASE_URL'),required('SUPABASE_ANON_KEY'),{schema:'public',persistSession:false,autoRefreshToken:false,detectSessionInUrl:false});
  const {user,session,error}=await supabase.auth.signIn({email,password});
  if(error) throw new Error(error.message);
  if(!user || !session) throw new Error('Sign-in did not return a session');
  return {user,session};
}
export async function signUp(email:string,password:string,name:string) {
  const supabase=createClient(required('SUPABASE_URL'),required('SUPABASE_ANON_KEY'),{schema:'public',persistSession:false,autoRefreshToken:false,detectSessionInUrl:false});
  const {user,session,error}=await supabase.auth.signUp({email,password},{data:{name}});
  if(error) throw new Error(error.message);return {user,session};
}
export async function listProjects(user:User):Promise<Project[]> {
  if(mode('supabase')==='mock') return db().prepare('SELECT * FROM projects WHERE user_id=? ORDER BY created_at DESC').all(user.id) as Project[];
  const supabase=createClient(required('SUPABASE_URL'),required('SUPABASE_ANON_KEY'),{schema:'public',persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,headers:{Authorization:`Bearer ${user.accessToken}`}});
  const {data,error}=await supabase.from<Project>('projects').select('*').eq('user_id',user.id).order('created_at',{ascending:false});
  if(error) throw new Error(error.message);return data ?? [];
}
export async function createProject(user:User,title:string,description:string):Promise<Project> {
  if(mode('supabase')==='mock') {
    const row={id:crypto.randomUUID(),user_id:user.id,title,description,summary:null,created_at:new Date().toISOString()};
    db().prepare('INSERT INTO projects VALUES(?,?,?,?,?,?)').run(row.id,user.id,title,description,null,row.created_at);return row;
  }
  const supabase=createClient(required('SUPABASE_URL'),required('SUPABASE_ANON_KEY'),{schema:'public',persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,headers:{Authorization:`Bearer ${user.accessToken}`}});
  // POSITIVE CASE: v1 returns inserted rows implicitly; v2 needs .select().
  const {data,error}=await supabase.from<Project>('projects').insert({user_id:user.id,title,description}).single();
  if(error || !data) throw new Error(error?.message ?? 'No project returned');return data;
}
export async function updateProject(user:User,id:string,patch:Partial<Pick<Project,'title'|'description'|'summary'>>) {
  if(mode('supabase')==='mock') {
    const current=db().prepare('SELECT * FROM projects WHERE id=? AND user_id=?').get(id,user.id) as Project|undefined;
    if(!current) throw new Error('Project not found');const merged={...current,...patch};
    db().prepare('UPDATE projects SET title=?,description=?,summary=? WHERE id=? AND user_id=?').run(merged.title,merged.description,merged.summary,id,user.id);return merged;
  }
  const supabase=createClient(required('SUPABASE_URL'),required('SUPABASE_ANON_KEY'),{schema:'public',persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,headers:{Authorization:`Bearer ${user.accessToken}`}});
  const {data,error}=await supabase.from<Project>('projects').update(patch).eq('id',id).eq('user_id',user.id).single();
  if(error || !data) throw new Error(error?.message ?? 'No updated project returned');return data;
}
export async function deleteProject(user:User,id:string) {
  if(mode('supabase')==='mock') return {deleted:Number(db().prepare('DELETE FROM projects WHERE id=? AND user_id=?').run(id,user.id).changes)>0};
  const supabase=createClient(required('SUPABASE_URL'),required('SUPABASE_ANON_KEY'),{schema:'public',persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,headers:{Authorization:`Bearer ${user.accessToken}`}});
  const {data,error}=await supabase.from<Project>('projects').delete().eq('id',id).eq('user_id',user.id);
  if(error) throw new Error(error.message);return {deleted:Boolean(data?.length)};
}
export async function uploadToSupabase(user:User,path:string,bytes:Buffer,mime:string) {
  const supabase=createClient(required('SUPABASE_URL'),required('SUPABASE_ANON_KEY'),{schema:'public',persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,headers:{Authorization:`Bearer ${user.accessToken}`}});
  const {data,error}=await supabase.storage.from(process.env.SUPABASE_BUCKET || 'demo-files').upload(path,bytes,{contentType:mime,upsert:false});
  if(error || !data) throw new Error(error?.message ?? 'Upload failed');return data;
}
export async function downloadFromSupabase(user:User,path:string) {
  const supabase=createClient(required('SUPABASE_URL'),required('SUPABASE_ANON_KEY'),{schema:'public',persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,headers:{Authorization:`Bearer ${user.accessToken}`}});
  const {data,error}=await supabase.storage.from(process.env.SUPABASE_BUCKET || 'demo-files').download(path);
  if(error || !data) throw new Error(error?.message ?? 'Download failed');return Buffer.from(await data.arrayBuffer());
}
