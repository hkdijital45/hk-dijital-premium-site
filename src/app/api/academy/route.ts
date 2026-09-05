import {sameOriginRequest} from '@/lib/academy/request-security';
import {NextResponse} from 'next/server';
import {contentIndex,getContent,getSolution,getAnswerKey} from '@/lib/academy/content';
import {getAcademyMember,getLearningState,saveLearningState} from '@/lib/academy/server';
import {gradeAnswers,nextReviewDate} from '@/lib/academy/learning';
import {validateActivities} from '@/lib/academy/activity-validation';
import {startConversation,chooseConversation,presentConversation,type ConversationState} from '@/lib/academy/conversation';
import {assessProspectOrder} from '@/lib/academy/prospect';
import workflows from '../../../../content/academy/workflows.json';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow, noarchive'};
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
export async function GET(request:Request){
 const member=await getAcademyMember();if(!member)return json({error:'Yetkili akademi oturumu gerekli.'},401);
 try{
 const query=new URL(request.url).searchParams.get('q');
 if(query!==null){const q=query.trim().toLocaleLowerCase('tr').slice(0,100);if(q.length<2)return json({results:[]});
 const results=[];
 for(const row of contentIndex){const title=`${row.title} ${row.category||''} ${row.reference||''}`.toLocaleLowerCase('tr');
 if(title.includes(q)){results.push(row);}else{const record=await getContent(row.id);if(record?.text.toLocaleLowerCase('tr').includes(q))results.push(row);}
 if(results.length===30)break;
 }return json({results});}
 return json({state:await getLearningState(member.userId)});
 }catch{return json({error:'Veriler yüklenemedi. Lütfen tekrar deneyin.'},503);}
}
export async function POST(request:Request){
 if(!sameOriginRequest(request))return json({error:'İstek kaynağı doğrulanamadı.'},403);
 const member=await getAcademyMember();if(!member)return json({error:'Yetkili akademi oturumu gerekli.'},401);
 try{
 const raw=await request.text();if(raw.length>65000)return json({error:'Gönderim çok büyük.'},413);
 const body=JSON.parse(raw);const {id,action}=body;
 if(typeof id!=='string'||typeof action!=='string')return json({error:'Geçersiz istek.'},400);
 const record=await getContent(id);if(!record)return json({error:'İçerik bulunamadı.'},404);
 const states=await getLearningState(member.userId);const get=(kind:string)=>states.find(s=>s.content_id===id&&s.kind===kind)?.value;
 const save=(kind:string,value:Record<string,unknown>)=>saveLearningState(member.userId,id,kind,value);
 const isExam=record.section==='exams'||Boolean(record.questions?.length);
 if(action==='prospect'){
 if(id!=='lab-113')return json({error:'Simülasyon bulunamadı.'},400);
 try{const result=assessProspectOrder(body.ratings,body.order);await save('simulation',{ratings:body.ratings,order:body.order,result});return json({result});}catch{return json({error:'Tüm kriterleri 1–5 puanlayın ve üç işletmeyi birer kez sıralayın.'},400);}
 }
 if(action==='conversation'){
 if(id!=='lab-117')return json({error:'Görüşme kaydı bulunamadı.'},400);
 const previous=get('simulation') as unknown as ConversationState|undefined;
 let state=previous&&!previous.finished?previous:startConversation();
 if(body.choice!==undefined){if(typeof body.choice!=='string')return json({error:'Seçim geçersiz.'},400);try{state=chooseConversation(state,body.choice);}catch{return json({error:'Görüşme seçimi geçersiz veya tamamlandı.'},409);}}
 await save('simulation',state);
 if(state.finished){await save('progress',{completed:true});await save('assessment',{method:'rule',score:Object.values(state.scores).reduce((a,b)=>a+b,0)/5,categories:state.scores});}
 return json({conversation:presentConversation(state)});
 }
 if(action==='bookmark'){
 if(typeof body.active!=='boolean')return json({error:'Geçersiz yer imi.'},400);
 await save('bookmark',{active:body.active});return json({ok:true});}
 if(action==='note'||action==='draft'){
 if(typeof body.text!=='string'||body.text.length>20000)return json({error:'Metin en fazla 20.000 karakter olabilir.'},400);
 await save(action,{text:body.text});return json({ok:true});}
 if(action==='start'){
 if(!isExam)return json({error:'Bu içerik sınav değil.'},400);
 const attempt=get('attempt');if(attempt&&!attempt.finished)return json({attempt});
 const next={started:new Date().toISOString(),expires:new Date(Date.now()+20*60*1000).toISOString(),finished:false};
 await save('attempt',next);return json({attempt:next});}
 if(action==='submit'){
 if(typeof body.text!=='string'||!body.text.trim()||body.text.length>20000)return json({error:'Gerekçeli cevabınızı yazın (en fazla 20.000 karakter).'},400);
 if(record.caseQuestions?.length){let answers;try{answers=JSON.parse(body.text);}catch{return json({error:'Vaka cevap biçimi geçersiz.'},400);}
 if(!answers||typeof answers!=='object'||record.caseQuestions.some(q=>typeof answers[q.id]!=='string'||!answers[q.id].trim()))return json({error:'Tüm vaka sorularını cevaplayın.'},400);}
 if(record.activities?.length){let answers;try{answers=JSON.parse(body.text);}catch{return json({error:'Egzersiz cevap biçimi geçersiz.'},400);}
 if(!answers||typeof answers!=='object'||Array.isArray(answers))return json({error:'Egzersiz cevap biçimi geçersiz.'},400);
 const validation=validateActivities(record.activities,answers);if(validation)return json({error:validation},400);}
 const workflow=(workflows as Record<string,{steps:string[]}>)[id];
 if(workflow){let fields;try{fields=JSON.parse(body.text);}catch{return json({error:'Çalışma alanı biçimi geçersiz.'},400);}
 if(!fields||typeof fields!=='object'||workflow.steps.some((_,i)=>typeof fields[String(i)]!=='string'||!fields[String(i)].trim()))return json({error:'Tüm çalışma alanlarını doldurun.'},400);}
 if(isExam){
 const attempt=get('attempt');if(!attempt||attempt.finished)return json({error:'Önce sınavı başlatın.'},409);
 const answers=body.answers;
 if(!answers||typeof answers!=='object'||Array.isArray(answers)||Object.values(answers).some(a=>typeof a!=='string'||a.length>3000))return json({error:'Cevap biçimi geçersiz.'},400);
 const expired=Date.now()>Date.parse(String(attempt.expires));
 const fullKey=await getAnswerKey(id);
 const key=Object.fromEntries(Object.entries(fullKey).filter(([qid])=>record.questions?.some(q=>q.id===qid)));
 const result=gradeAnswers(expired?{}:answers,key);
 const previousResult=get('result');const history=Array.isArray(previousResult?.history)?previousResult.history.slice(-8):[];if(previousResult)history.push({correct:previousResult.correct,total:previousResult.total,submitted:previousResult.submitted});
 await save('result',{...result,expired,submitted:new Date().toISOString(),history});
 await save('attempt',{...attempt,finished:true});
 await save('submission',{text:body.text,answers:expired?{}:answers});
 await save('progress',{completed:true});
 if(result.total)await save('review',nextReviewDate(result.correct===result.total?4:0,Number(get('review')?.stage||0)));
 return json({ok:true,result,solution:await getSolution(id)});
 }
 await save('submission',{text:body.text});return json({ok:true,solution:record.section==='final'&&id!=='final-168'?null:await getSolution(id)});
 }
 if(action==='solution'){
 if(record.section==='final'&&!states.some(s=>s.content_id==='final-168'&&s.kind==='submission'))return json({error:'Finalin 20 çalışma alanını tamamlayın.'},403);
 if(isExam&&!get('attempt')?.finished)return json({error:'Sınav bitmeden çözüm açılamaz.'},403);
 return json({solution:await getSolution(id)});}
 if(action==='assess'){
 if(!get('submission'))return json({error:'Önce cevabınızı kaydedin.'},409);
 if(!Number.isInteger(body.score)||body.score<0||body.score>4)return json({error:'Puan 0–4 arasında olmalı.'},400);
 const categories=body.categories;
 if(categories!==undefined&&(categories===null||typeof categories!=='object'||Array.isArray(categories)||Object.keys(categories).length>20||Object.values(categories).some(v=>!['0','1','2','3','4'].includes(String(v)))))return json({error:'Kategori puanları geçersiz.'},400);
 await save('assessment',{score:body.score,method:'self',...(categories?{categories}:{})});await save('progress',{completed:true});
 const previous=Number(get('review')?.stage||0);await save('review',nextReviewDate(body.score,previous));return json({ok:true});}
 if(action==='complete'){
 if(!['book','diagnostics','reference','glossary'].includes(record.section)||isExam)return json({error:'Önce uygulamayı tamamlayın.'},400);
 if(record.section==='diagnostics'&&(typeof body.text!=='string'||body.text.trim().length<15))return json({error:'Teşhis gerekçenizi ve yeniden ölçüm planınızı yazın.'},400);
 await save('progress',{completed:true,...(record.section==='diagnostics'?{text:body.text}:{})});return json({ok:true});}
 return json({error:'Desteklenmeyen işlem.'},400);
 }catch{return json({error:'İşlem kaydedilemedi. Bağlantıyı kontrol edip tekrar deneyin.'},503);}
}
