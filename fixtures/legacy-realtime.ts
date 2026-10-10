// Scan-only: v1 auth helpers and Realtime workflow need response/cleanup review.
import { createClient } from '@supabase/supabase-js';
export function legacyRealtime() {
  const supabase=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_ANON_KEY!);
  const currentUser=supabase.auth.user();
  const session=supabase.auth.session();
  const subscription=supabase.from('projects').on('INSERT',payload=>console.log(payload.new.id)).subscribe();
  return {currentUser,session,stop:()=>supabase.removeSubscription(subscription)};
}
export async function legacyProfileUpdate(name:string) {
  const supabase=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_ANON_KEY!);
  const {user,error}=await supabase.auth.update({data:{name}});
  return {user,error};
}
