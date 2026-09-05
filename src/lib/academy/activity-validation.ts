import type {Activity} from './types.ts';
export function validateActivities(activities:Activity[],answers:Record<string,unknown>):string|null{
 for(const activity of activities){const answer=answers[activity.id];const label=`Egzersiz ${activity.id}`;
 if(['choice','fill','short'].includes(activity.kind)){if(typeof answer!=='string'||!answer.trim())return `${label}: Cevabınızı girin.`;if(activity.kind==='choice'&&!activity.options.some(o=>o.id===answer))return `${label}: Geçerli bir seçenek seçin.`;}
 else if(['matching','boolean'].includes(activity.kind)&&activity.items.length){
 if(!answer||typeof answer!=='object'||Array.isArray(answer))return `${label}: Tüm maddeleri cevaplayın.`;
 for(const item of activity.items){const v=(answer as Record<string,unknown>)[item.id];const allowed=activity.kind==='boolean'?['D','Y']:activity.options.map(o=>o.id);if(typeof v!=='string'||!allowed.includes(v))return `${label}: Tüm maddeler için seçim yapın.`;}
 }else if(activity.kind==='ordering'&&activity.items.length){if(!Array.isArray(answer)||answer.length!==activity.items.length||new Set(answer).size!==answer.length||answer.some(v=>!activity.items.some(item=>item.id===v)))return `${label}: Tüm adımları sıralayın.`;
 }else if(activity.kind==='budget'||activity.kind==='table'){
 if(!Array.isArray(answer)||!answer.length||answer.length>20)return `${label}: Tabloyu doldurun.`;
 if(answer.some(row=>!row||typeof row!=='object'||['name','value','reason'].some(k=>typeof row[k]!=='string'||!row[k].trim())))return `${label}: Her satırda başlık, değer ve gerekçe gerekli.`;
 if(activity.kind==='budget'){const values=answer.map(row=>Number(row.value.replace(',','.')));if(values.some(n=>!Number.isFinite(n)||n<0))return `${label}: Bütçe tutarları negatif olamaz.`;if(activity.budget!==undefined&&Math.abs(values.reduce((a,b)=>a+b,0)-activity.budget)>.01)return `${label}: Dağılım toplamı ${activity.budget} TL olmalı.`;}
 }else{if(!answer||typeof answer!=='object'||Array.isArray(answer)||['observation','decision','measurement'].some(k=>typeof (answer as Record<string,unknown>)[k]!=='string'||!(answer as Record<string,string>)[k].trim()))return `${label}: Gözlem, karar ve doğrulama alanlarını doldurun.`;}
 }
 return null;
}
