import {notFound,redirect} from 'next/navigation';
import Link from 'next/link';
import {getAcademyMember,getLearningState} from '@/lib/academy/server';
import {contentIndex,academyModules} from '@/lib/academy/content';
import {sectionLabels,type Section} from '@/lib/academy/types';
import {AcademyAdmin} from '@/components/academy/Admin';
import {Catalog} from '@/components/academy/Catalog';
import {Calculators,Triage} from '@/components/academy/Calculators';
export default async function Page({params}:{params:Promise<{section:string}>}){
 const member=await getAcademyMember();if(!member)redirect('/academy/login');const {section}=await params;
 if(section==='admin'){if(member.role!=='academy_admin')notFound();return <AcademyAdmin/>;}
 if(section==='notes'||section==='progress'){
 const states=await getLearningState(member.userId);
 if(section==='notes')return <><div className="ac-page-heading"><span className="ac-eyebrow">KİŞİSEL ÇALIŞMA ARŞİVİN</span><h1>Notlar ve Yer İmleri</h1></div><div className="ac-card-grid">{states.filter(s=>s.kind==='note'&&s.value.text||s.kind==='bookmark'&&s.value.active).map(s=>{const r=contentIndex.find(r=>r.id===s.content_id);return r&&<article className="ac-card" key={`${s.content_id}-${s.kind}`}><Link href={`/academy/${r.section}/${r.id}`}><h2>{r.title}</h2></Link><small>{s.kind==='note'?'Kişisel not':'Yer imi'}</small><p className="ac-source-text">{String(s.value.text||'')}</p></article>;})}</div>{!states.some(s=>s.kind==='note'||s.kind==='bookmark')&&<p className="ac-card">Derslerde, vakalarda ve terimlerde oluşturduğun notlar ile yer imlerin burada görünür.</p>}</>;
 const finalCategories=states.find(s=>s.content_id==='final-168'&&s.kind==='assessment')?.value.categories as Record<string,string>|undefined;
 return <><div className="ac-page-heading"><span className="ac-eyebrow">GERÇEK ÇALIŞMA VERİLERİN</span><h1>İlerleme ve Yetkinlik</h1><p>Otomatik sınav sonuçları ve öz değerlendirme puanları ayrı gösterilir.</p></div><div className="ac-card ac-matrix"><table><thead><tr><th>Yetkinlik / Modül</th><th>Tamamlanan</th><th>Sınav doğruluğu</th><th>Öz değerlendirme</th></tr></thead><tbody>{academyModules.map(m=>{const ids=new Set(contentIndex.filter(r=>r.module===m.id).map(r=>r.id));const done=states.filter(s=>ids.has(s.content_id)&&s.kind==='progress'&&s.value.completed).length;const exams=states.filter(s=>ids.has(s.content_id)&&s.kind==='result');const total=exams.reduce((n,s)=>n+Number(s.value.total||0),0);const correct=exams.reduce((n,s)=>n+Number(s.value.correct||0),0);const assessments=states.filter(s=>ids.has(s.content_id)&&s.kind==='assessment'&&s.value.method==='self');return <tr key={m.id}><th>{m.title}</th><td>{done}</td><td>{total?`${Math.round(correct/total*100)}%`:'Henüz ölçülmedi'}</td><td>{assessments.length?`${(assessments.reduce((n,s)=>n+Number(s.value.score),0)/assessments.length).toFixed(1)} / 4`:'Henüz değerlendirilmedi'}</td></tr>;})}</tbody></table></div><section className="ac-card"><h2>360° final yetkinlik sonuçları</h2><p>Kaynak rubriğine ek, kullanıcı öz değerlendirmesi · 0–4</p>{finalCategories?<div className="ac-input-grid">{Object.entries(finalCategories).filter(([key])=>key.startsWith('Yetkinlik: ')).map(([key,value])=><div key={key}><h3>{key.replace('Yetkinlik: ','')}</h3><strong>{value} / 4</strong></div>)}</div>:<p>Final değerlendirmesi henüz kaydedilmedi.</p>}</section></>;
 }
 if(section==='triage')return <Triage/>;
 if(!(section in sectionLabels))notFound();const records=contentIndex.filter(r=>r.section===section||(section==='exercises'&&Boolean(r.activityCount))||(section==='exams'&&r.section==='book'&&r.questionCount));if(section==='glossary')records.sort((a,b)=>a.title.localeCompare(b.title,'tr'));
 return <>{section==='formulas'&&<Calculators/>}<Catalog section={section as Section} records={records} modules={academyModules}/></>;
}
