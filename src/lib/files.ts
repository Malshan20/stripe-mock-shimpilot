import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
const dataDir=()=>dirname(resolve(process.env.DATABASE_PATH ?? '.data/demo.sqlite')); 
import { randomUUID } from 'node:crypto';
import { db, type FileRecord } from './db';
import { mode } from './config';
import { uploadToSupabase, downloadFromSupabase } from './providers/supabase';
import type { User } from './auth';
export async function saveFile(user:User,file:File) {
  if(file.size>2*1024*1024 || file.size===0) throw new Error('Upload a nonempty file up to 2 MB');
  const allowed=['text/plain','application/json','application/pdf','image/png','image/jpeg'];
  if(!allowed.includes(file.type)) throw new Error('Use TXT, JSON, PDF, PNG, or JPG');
  const id=randomUUID(), path=`${user.id}/${id}`, bytes=Buffer.from(await file.arrayBuffer());
  const provider=mode('supabase');
  if(provider==='remote') await uploadToSupabase(user,path,bytes,file.type);
  else {const dir=resolve(dataDir(),'files',user.id);await mkdir(dir,{recursive:true});await writeFile(resolve(dir,id),bytes);}
  db().prepare('INSERT INTO files VALUES(?,?,?,?,?,?,?,?)').run(id,user.id,file.name.slice(0,180),file.type,file.size,path,provider,new Date().toISOString());
  return {id,name:file.name,size:file.size,provider};
}
export async function readOwnedFile(user:User,id:string) {
  const file=db().prepare('SELECT * FROM files WHERE id=? AND user_id=?').get(id,user.id) as FileRecord|undefined;
  if(!file) throw new Error('File not found');
  const bytes=file.provider==='remote' ? await downloadFromSupabase(user,file.storage_path) : await readFile(resolve(dataDir(),'files',user.id,file.id));
  return {file,bytes};
}
