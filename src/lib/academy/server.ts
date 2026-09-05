import 'server-only';
import {getSession,getProfileById} from '@/lib/auth';
import {hasSupabaseConfig,supabaseRest} from '@/lib/supabase';
import type {LearningState} from './types';
export type AcademyMember={userId:string;name:string;role:'academy_admin'|'academy_user'};
export async function getAcademyMember():Promise<AcademyMember|null>{
 if(!hasSupabaseConfig()) return null;
 const session=await getSession();
 if(!session?.profileId||!session.authUserId||!session.accessToken) return null;
 try{
  const authResponse=await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`,{headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'',Authorization:`Bearer ${session.accessToken}`},cache:'no-store'});
  if(!authResponse.ok)return null;
  const identity=await authResponse.json();if(identity.id!==session.authUserId)return null;
  const profile=await getProfileById(session.profileId);
  if(!profile?.is_active||profile.deleted_at||profile.auth_user_id!==session.authUserId||profile.must_change_password) return null;
  const members=await supabaseRest<{role:AcademyMember['role']}[]>(`academy_memberships?user_id=eq.${encodeURIComponent(profile.id)}&active=eq.true&select=role&limit=1`);
  if(!members[0]||!['academy_admin','academy_user'].includes(members[0].role)) return null;
  return {userId:profile.id,name:profile.full_name||'Akademi üyesi',role:members[0].role};
 }catch{return null;}
}
export async function getLearningState(userId:string):Promise<LearningState[]>{
 const all:LearningState[]=[];
 for(let offset=0;offset<10000;offset+=500){
 const rows=await supabaseRest<LearningState[]>(`academy_learning_state?user_id=eq.${encodeURIComponent(userId)}&select=content_id,kind,value,updated_at&order=content_id.asc,kind.asc&limit=500&offset=${offset}`);
 all.push(...rows);if(rows.length<500)break;
 }
 return all;
}
export async function saveLearningState(userId:string,contentId:string,kind:string,value:Record<string,unknown>){
 await supabaseRest('academy_learning_state?on_conflict=user_id,content_id,kind',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:userId,content_id:contentId,kind,value,updated_at:new Date().toISOString()})});
}
