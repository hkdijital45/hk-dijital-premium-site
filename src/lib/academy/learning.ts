import type {LearningState,ContentIndex} from './types.ts';
export function nextReviewDate(score:number,previousStage=0,now=new Date()){
 const stage=score<3?0:Math.min(previousStage+1,3);
 const date=new Date(now);date.setUTCDate(date.getUTCDate()+[1,3,7,14][stage]);
 return {stage,due:date.toISOString()};
}
export function progressSummary(index:ContentIndex[],states:LearningState[]){
 const completed=new Set(states.filter(s=>s.kind==='progress'&&s.value.completed===true).map(s=>s.content_id));
 const eligible=index.filter(r=>['book','workbook','cases','diagnostics','lab','final','exams'].includes(r.section));
 const percent=(rows:ContentIndex[])=>rows.length?Math.round(rows.filter(r=>completed.has(r.id)).length/rows.length*100):0;
 const answers=states.filter(s=>s.kind==='result'&&typeof s.value.correct==='number'&&typeof s.value.total==='number');
 const total=answers.reduce((sum,s)=>sum+Number(s.value.total),0);const correct=answers.reduce((sum,s)=>sum+Number(s.value.correct),0);
 const finalRecord=index.find(r=>r.section==='final'&&r.stepCount);let finalProgress=0;
 if(finalRecord){if(completed.has(finalRecord.id))finalProgress=100;else{const finalState=states.find(s=>s.content_id===finalRecord.id&&s.kind==='submission')||states.find(s=>s.content_id===finalRecord.id&&s.kind==='draft');try{const fields=JSON.parse(String(finalState?.value.text||'{}'));const count=Array.from({length:finalRecord.stepCount!},(_,i)=>fields[String(i)]).filter(v=>typeof v==='string'&&v.trim()).length;finalProgress=Math.round(count/finalRecord.stepCount!*100);}catch{}}}
 return {percent:percent(eligible),book:percent(index.filter(r=>r.section==='book')),workbook:percent(index.filter(r=>r.section==='workbook')),completed:completed.size,correct:total?Math.round(correct/total*100):null,total,final:finalProgress};
}
export function gradeAnswers(answers:Record<string,string>,key:Record<string,string>){
 const details=Object.entries(key).map(([id,expected])=>({id,expected,answer:answers[id]||'',correct:answers[id]===expected}));
 return {correct:details.filter(d=>d.correct).length,total:details.length,details};
}

export function performanceBreakdown(index:ContentIndex[],states:LearningState[]){
 const byId=new Map(index.map(row=>[row.id,row]));
 const completed=new Set(states.filter(s=>s.kind==='progress'&&s.value.completed===true).map(s=>s.content_id));
 const results=states.filter(s=>s.kind==='result'&&Number(s.value.total)>0&&byId.has(s.content_id));
 const summarize=(rows:LearningState[])=>{const total=rows.reduce((n,s)=>n+Number(s.value.total),0);return {total,percent:total?Math.round(rows.reduce((n,s)=>n+Number(s.value.correct),0)/total*100):null};};
 const matchesLevel=(id:string,level:string)=>{const row=byId.get(id);return row?.levels?.length?row.levels.length===1&&row.levels[0]===level:row?.difficulty===level;};
 const levels=['basic','medium','hard'].map(level=>{const self=states.filter(s=>s.kind==='assessment'&&s.value.method==='self'&&Number.isFinite(Number(s.value.score))&&matchesLevel(s.content_id,level));return {level,...summarize(results.filter(s=>matchesLevel(s.content_id,level))),selfPercent:self.length?Math.round(self.reduce((n,s)=>n+Number(s.value.score),0)/self.length/4*100):null,selfCount:self.length};});
 const skills=[['Strateji',1],['Hedef Kitle',2],['Marka',3],['Sosyal Medya',4],['Copywriting',5],['Meta Ads',7],['Google Ads',8],['SEO',9],['CRO',10],['Analytics',11],['Ajans Yönetimi',12],['AI Marketing',14]].map(([label,module])=>({label:String(label),module:Number(module),...summarize(results.filter(s=>byId.get(s.content_id)?.module===module))}));
 const count=(section:string)=>index.filter(row=>row.section===section&&completed.has(row.id)).length;
 const exercises=states.filter(s=>s.kind==='submission'&&byId.get(s.content_id)?.section==='workbook').reduce((n,s)=>n+(byId.get(s.content_id)?.activityCount||1),0);
 return {levels,skills,exercises,cases:count('cases'),diagnostics:count('diagnostics'),exams:results.filter(s=>byId.get(s.content_id)?.section==='exams').map(s=>({id:s.content_id,title:byId.get(s.content_id)!.title,correct:Number(s.value.correct),total:Number(s.value.total)}))};
}
