import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceShortcut} from '../../src/lib/academy/shortcut.ts';
import {calculate,triage} from '../../src/lib/academy/calculators.ts';
import {gradeAnswers,nextReviewDate,progressSummary,performanceBreakdown} from '../../src/lib/academy/learning.ts';
import {readFileSync} from 'node:fs';
const input={metaKey:true,ctrlKey:false,shiftKey:true,altKey:false,repeat:false};
test('academy shortcut accepts physical digit sequence on macOS and Windows',()=>{
 for(const modifier of [{metaKey:true,ctrlKey:false},{metaKey:false,ctrlKey:true}]){
 let state={position:0,time:0};for(const [i,code] of ['Digit1','Digit1','Digit2'].entries()){const result=advanceShortcut(state,{...input,...modifier,code},100+i*100);state=result.state;assert.equal(result.open,i===2);}
 }
});
test('academy shortcut rejects repeat, missing modifier and expired sequence',()=>{
 assert.equal(advanceShortcut({position:2,time:100},{...input,code:'Digit2',repeat:true},200).open,false);
 assert.equal(advanceShortcut({position:2,time:100},{...input,code:'Digit2'},2000).open,false);
 assert.equal(advanceShortcut({position:2,time:100},{...input,code:'Digit2',metaKey:false},200).open,false);
});
test('calculators reject empty, zero denominator, nonfinite and inconsistent values',()=>{
 for(const [id,values] of [['ctr',['','1']],['cpc',['10','0']],['cpl',['Infinity','10']],['retention',['10','20','11']],['ctr',['30','20']],['breakeven',['101']]] as [string,string[]][]){assert.ok('error' in calculate(id,values));}
 assert.deepEqual(calculate('roas',['12000','3000']),{value:4,unit:'×'});
 assert.deepEqual(calculate('roi',['80','100']),{value:-20,unit:'%'});
 assert.deepEqual(calculate('breakeven',['25']),{value:4,unit:'×'});
});
test('triage prioritizes measurement failure and extreme cost over learning',()=>{
 const data={spend:100,conversions:5,tracking:true,cpa:20,targetCpa:30,roas:4,targetRoas:3,learning:false,frequencyRising:false,stable:true};
 assert.equal(triage(data).color,'green');assert.equal(triage({...data,tracking:false,learning:true}).color,'red');assert.equal(triage({...data,cpa:61,learning:true}).color,'red');assert.equal(triage({...data,learning:true}).color,'yellow');
});
test('grading ignores invented answer IDs and counts unanswered questions',()=>{const result=gradeAnswers({'1':'B','999':'A'},{'1':'B','2':'C'});assert.equal(result.correct,1);assert.equal(result.total,2);});
test('review intervals and empty analytics remain real',()=>{assert.equal(nextReviewDate(0,3,new Date('2026-09-05T00:00:00Z')).due,'2026-09-06T00:00:00.000Z');assert.equal(nextReviewDate(4,1,new Date('2026-09-05T00:00:00Z')).due,'2026-09-12T00:00:00.000Z');assert.equal(progressSummary([],[]).correct,null);assert.equal(progressSummary([],[]).percent,0);});
test('source import has exactly 14 modules, 73 diagnostics and all 44 glossary terms',()=>{
 const index=JSON.parse(readFileSync('content/academy/index.json','utf8')) as {id:string;section:string;category?:string}[];
 assert.equal(new Set(index.map(r=>r.id)).size,index.length);
 assert.equal(JSON.parse(readFileSync('content/academy/modules.json','utf8')).length,14);
 const diagnostics=index.filter(r=>r.section==='diagnostics');assert.equal(diagnostics.length,73);
 for(const [category,count] of Object.entries({'Meta Ads':20,'Google Ads':14,'CRO / Funnel':8,'Sosyal Medya':10,'SEO':10,Ajans:11}))assert.equal(diagnostics.filter(r=>r.category===category).length,count);
 assert.equal(index.filter(r=>r.section==='glossary').length,44);
 for(const r of index){const content=JSON.parse(readFileSync(`content/academy/${r.id}.json`,'utf8'));assert.equal(typeof content.text,'string');assert.ok(content.text.length>0);assert.ok(!/Cevap Anahtarı:|HIZLI CEVAPLAR — SINAV/.test(content.text),r.id);}
});
import {validateActivities} from '../../src/lib/academy/activity-validation.ts';
test('workbook validates matching and exact source budget on server',()=>{
 const base={id:'1',label:'Bütçe',prompt:'',items:[],options:[]};
 assert.match(validateActivities([{...base,kind:'budget',budget:15000}],{'1':[{name:'İçerik',value:'10000',reason:'Üretim'}]})||'',/15000/);
 assert.equal(validateActivities([{...base,kind:'budget',budget:15000}],{'1':[{name:'İçerik',value:'10000',reason:'Üretim'},{name:'Ölçüm',value:'5000',reason:'Kurulum'}]}),null);
 assert.ok(validateActivities([{...base,kind:'matching',items:[{id:'1',text:'Owned'}],options:[{id:'C',text:'Web sitesi'}]}],{'1':{'1':'A'}}));
});
import {startConversation,chooseConversation,presentConversation} from '../../src/lib/academy/conversation.ts';
test('conversation branches, rejects forged choices and derives scores only from decisions',()=>{
 let state=startConversation();assert.throws(()=>chooseConversation(state,'invented'));
 for(const choice of ['permission','discover','specific','pilot','schedule'])state=chooseConversation(state,choice);
 assert.equal(state.finished,true);assert.equal(state.scores.professionalism,4);assert.ok(state.scores.discovery>0);assert.equal(presentConversation(startConversation()).scores,undefined);
 const price=chooseConversation(startConversation(),'pitch');assert.equal(price.node,'price');
});
import {scoreProspect,assessProspectOrder} from '../../src/lib/academy/prospect.ts';
test('prospect ranking uses disclosed source weights and rejects missing ratings',()=>{
 assert.equal(scoreProspect({need:5,capacity:4,reachability:3}),50);
 assert.throws(()=>scoreProspect({need:5} as {need:number;capacity:number;reachability:number}));
 const ratings={'cases-9':{need:5,capacity:5,reachability:5},'cases-69':{need:3,capacity:3,reachability:3},'final-166':{need:1,capacity:1,reachability:1}};
 assert.equal(assessProspectOrder(ratings,['cases-9','cases-69','final-166']).score,4);
 assert.equal(assessProspectOrder(ratings,['final-166','cases-69','cases-9']).score,0);
});
import {sameOriginRequest} from '../../src/lib/academy/request-security.ts';
test('academy CSRF supports internal proxy URL but rejects cross-site and forged forwarded host',()=>{
 const request=(origin:string,host:string)=>({url:'http://localhost:4181/api/academy',headers:new Headers({origin,host,'x-forwarded-host':'attacker.test'})});
 assert.equal(sameOriginRequest(request('https://academy.test','academy.test')),true);
 assert.equal(sameOriginRequest(request('https://attacker.test','academy.test')),false);
 assert.equal(sameOriginRequest(request('null','academy.test')),false);
});

test('performance counts assessed questions without assigning mixed difficulty or self-ratings to accuracy',()=>{
 const index=[{id:'a',section:'workbook' as const,title:'A',module:1,source:'workbook',page:7,levels:['basic','hard'],activityCount:3}];
 const states=[{content_id:'a',kind:'result',value:{correct:2,total:4},updated_at:'2026-09-05'},{content_id:'a',kind:'submission',value:{},updated_at:'2026-09-05'},{content_id:'a',kind:'assessment',value:{score:4},updated_at:'2026-09-05'}];
 const report=performanceBreakdown(index,states);assert.equal(report.exercises,3);assert.equal(report.skills[0].percent,50);assert.ok(report.levels.every(level=>level.percent===null));
});

test('negative net profit produces a negative margin without allowing negative spend',()=>{
 assert.equal(calculate('margin',['-200','1000']).value,-20);assert.ok(calculate('cpc',['-200','100']).error);
});

import {encryptContent,decryptContent} from '../../scripts/academy/content-package.mjs';
import {randomBytes} from 'node:crypto';
test('private content package authenticates ciphertext and rejects wrong keys and unsafe paths',()=>{
 const key=randomBytes(32);const records={'index.json':'[]'};const bundle=encryptContent(records,key);
 assert.deepEqual(decryptContent(bundle,key),records);assert.throws(()=>decryptContent(bundle,randomBytes(32)));
 const changed=Buffer.from(bundle);changed[changed.length-1]^=1;assert.throws(()=>decryptContent(changed,key));
 assert.throws(()=>decryptContent(encryptContent({...records,'../outside.json':'{}'},key),key));
});

test('difficulty self-assessment is shown separately from objectively graded accuracy',()=>{
 const index=[{id:'work',section:'workbook' as const,title:'Work',module:1,source:'workbook',page:7,difficulty:'basic' as const}];
 const states=[{content_id:'work',kind:'assessment',value:{score:3,method:'self'},updated_at:'2026-09-05'}];
 const result=performanceBreakdown(index,states);assert.equal(result.levels[0].percent,null);assert.equal(result.levels[0].selfPercent,75);assert.equal(result.levels[1].selfPercent,null);
});
