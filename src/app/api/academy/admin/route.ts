import {sameOriginRequest} from '@/lib/academy/request-security';
import {NextResponse} from 'next/server';
import {getAcademyMember} from '@/lib/academy/server';
import {supabaseRest} from '@/lib/supabase';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow, noarchive'}});
export async function GET(request:Request){
 const member=await getAcademyMember();if(member?.role!=='academy_admin')return json({error:'Akademi yönetici yetkisi gerekli.'},403);
 const url=new URL(request.url);const user=url.searchParams.get('user');
 try{
 if(user){if(!/^[a-f0-9-]{36}$/.test(user))return json({error:'Geçersiz kullanıcı.'},400);const state=await supabaseRest(`academy_learning_state?user_id=eq.${encodeURIComponent(user)}&kind=in.(progress,result,assessment)&select=content_id,kind,value,updated_at&order=updated_at.desc&limit=500`);return json({state});}
 const page=Math.max(0,Math.min(10000,Number(url.searchParams.get('page'))||0));
 const members=await supabaseRest<{user_id:string;role:string;active:boolean}[]>(`academy_memberships?select=user_id,role,active&order=created_at.desc&limit=100&offset=${page*100}`);
 const profiles=members.length?await supabaseRest<{id:string;full_name:string;email:string}[]>(`users?id=in.(${members.map(m=>m.user_id).join(',')})&select=id,full_name,email`):[];
 return json({members:members.map(m=>({...m,...profiles.find(p=>p.id===m.user_id)})),hasMore:members.length===100});
 }catch{return json({error:'Yönetim verileri yüklenemedi.'},503);}
}
export async function POST(request:Request){
 if(!sameOriginRequest(request))return json({error:'İstek kaynağı doğrulanamadı.'},403);
 const member=await getAcademyMember();if(member?.role!=='academy_admin')return json({error:'Akademi yönetici yetkisi gerekli.'},403);
 try{const raw=await request.text();if(raw.length>2000)return json({error:'İstek çok büyük.'},413);const body=JSON.parse(raw);
 if(typeof body.email!=='string'||body.email.length>254||!['academy_user','academy_admin'].includes(body.role)||typeof body.active!=='boolean')return json({error:'E-posta, rol ve etkinlik bilgisi gerekli.'},400);
 const profiles=await supabaseRest<{id:string}[]>(`users?email=eq.${encodeURIComponent(body.email.trim().toLowerCase())}&is_active=eq.true&deleted_at=is.null&select=id&limit=1`);
 const profile=profiles[0];if(!profile)return json({error:'Etkin bir mevcut kullanıcı profili bulunamadı.'},404);
 if(profile.id===member.userId&&(!body.active||body.role!=='academy_admin'))return json({error:'Kendi yönetici erişiminizi bu ekrandan kaldıramazsınız.'},409);
 await supabaseRest('academy_memberships?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:profile.id,role:body.role,active:body.active})});
 return json({ok:true});
 }catch{return json({error:'Üyelik kaydedilemedi.'},503);}
}
