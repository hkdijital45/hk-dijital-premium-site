export type Formula={id:string;title:string;inputs:string[];formula:string;unit:string;compute:(n:number[])=>number};
export const formulas:Formula[]=[
 {id:'ctr',title:'CTR · Tıklama Oranı',inputs:['Tıklama','Gösterim'],formula:'Tıklama / Gösterim × 100',unit:'%',compute:([a,b])=>a/b*100},
 {id:'cpc',title:'CPC · Tıklama Başına Maliyet',inputs:['Harcama','Tıklama'],formula:'Harcama / Tıklama',unit:'TL',compute:([a,b])=>a/b},
 {id:'cpm',title:'CPM · Bin Gösterim Maliyeti',inputs:['Harcama','Gösterim'],formula:'Harcama / Gösterim × 1000',unit:'TL',compute:([a,b])=>a/b*1000},
 {id:'cpl',title:'CPL · Lead Başına Maliyet',inputs:['Harcama','Lead'],formula:'Harcama / Lead',unit:'TL',compute:([a,b])=>a/b},
 {id:'cpa',title:'CPA · Edinme Başına Maliyet',inputs:['Harcama','Dönüşüm'],formula:'Harcama / Dönüşüm',unit:'TL',compute:([a,b])=>a/b},
 {id:'cvr',title:'Conversion Rate · Dönüşüm Oranı',inputs:['Dönüşüm','Ziyaret'],formula:'Dönüşüm / Ziyaret × 100',unit:'%',compute:([a,b])=>a/b*100},
 {id:'roas',title:'ROAS · Reklam Harcaması Getirisi',inputs:['Reklama atfedilen gelir','Reklam harcaması'],formula:'Gelir / Reklam harcaması',unit:'×',compute:([a,b])=>a/b},
 {id:'roi',title:'ROI · Yatırım Getirisi',inputs:['Gelir','Toplam maliyet'],formula:'(Gelir − Toplam maliyet) / Toplam maliyet × 100',unit:'%',compute:([a,b])=>(a-b)/b*100},
 {id:'aov',title:'AOV · Ortalama Sipariş Değeri',inputs:['Gelir','Sipariş'],formula:'Gelir / Sipariş',unit:'TL',compute:([a,b])=>a/b},
 {id:'cac',title:'CAC · Müşteri Edinme Maliyeti',inputs:['Pazarlama ve satış harcaması','Yeni müşteri'],formula:'Toplam edinme harcaması / Yeni müşteri',unit:'TL',compute:([a,b])=>a/b},
 {id:'ltv',title:'LTV · Yaşam Boyu Değer',inputs:['Ortalama sipariş tutarı','Yıllık satın alma sıklığı','Müşteri ömrü (yıl)'],formula:'Ortalama sipariş × Yıllık sıklık × Müşteri ömrü',unit:'TL',compute:([a,b,c])=>a*b*c},
 {id:'retention',title:'Retention · Elde Tutma',inputs:['Dönem sonu müşteri','Dönem başı müşteri','Dönemde yeni müşteri'],formula:'(Dönem sonu − Yeni müşteri) / Dönem başı × 100',unit:'%',compute:([a,b,c])=>(a-c)/b*100},
 {id:'churn',title:'Churn · Müşteri Kaybı',inputs:['Kaybedilen müşteri','Dönem başı müşteri'],formula:'Kaybedilen / Dönem başı × 100',unit:'%',compute:([a,b])=>a/b*100},
 {id:'margin',title:'Profit Margin · Kâr Marjı',inputs:['Net kâr','Gelir'],formula:'Net kâr / Gelir × 100',unit:'%',compute:([a,b])=>a/b*100},
 {id:'breakeven',title:'Break-even ROAS · Başabaş',inputs:['Katkı marjı (%)'],formula:'1 / (Katkı marjı / 100)',unit:'×',compute:([a])=>100/a},
 {id:'frequency',title:'Frequency · Sıklık',inputs:['Gösterim','Erişim'],formula:'Gösterim / Erişim',unit:'×',compute:([a,b])=>a/b},
];
export function calculate(id:string,raw:string[]){const item=formulas.find(f=>f.id===id);if(!item||raw.length!==item.inputs.length)return {error:'Formül girdileri eksik.'};if(raw.some(v=>!v.trim()))return {error:'Tüm alanları doldurun.'};const n=raw.map(v=>Number(v.replace(',','.')));if(n.some((v,i)=>!Number.isFinite(v)||(v<0&&!(id==='margin'&&i===0))))return {error:'Sonlu sayılar girin; yalnız net kâr negatif olabilir.'};if(id==='breakeven'&&(n[0]<=0||n[0]>100))return {error:'Katkı marjı 0’dan büyük, en fazla 100 olmalı.'};if(id==='retention'&&(n[2]>n[0]||n[0]-n[2]>n[1]))return {error:'Müşteri sayıları birbiriyle tutarlı olmalı.'};if(['ctr','cvr','churn'].includes(id)&&n[0]>n[1])return {error:'Pay, toplam sayıyı aşamaz.'};const value=item.compute(n);if(!Number.isFinite(value))return {error:'Bölen sıfır olamaz.'};return {value,unit:item.unit};}
export function triage(data:{spend:number;conversions:number;tracking:boolean;cpa:number;targetCpa:number;roas:number;targetRoas:number;learning:boolean;frequencyRising:boolean;stable:boolean;cpl?:number;targetCpl?:number}){
 if(data.spend>0&&!data.tracking)return {color:'red',title:'Acil müdahale',reason:'Harcama var, takip verisi doğrulanmamış. Önce ölçüm kurulumunu test edin.'};
 if((data.targetCpl||0)>0&&(data.cpl||0)>(data.targetCpl||0)*2)return {color:'red',title:'Acil müdahale',reason:'CPL, sizin belirlediğiniz kabul edilebilir eşiğin iki katından fazla.'};
 if(data.targetCpa>0&&data.cpa>data.targetCpa*2)return {color:'red',title:'Acil müdahale',reason:'CPA, sizin belirlediğiniz kabul edilebilir eşiğin iki katından fazla.'};
 if(data.learning||data.frequencyRising)return {color:'yellow',title:'İzle / optimize et',reason:'Öğrenme durumu veya artan frequency nedeniyle veri ve trendleri izleyin; yeterli kanıt olmadan çoklu değişiklik yapmayın.'};
 if(data.conversions>0&&data.targetCpa>0&&data.cpa<=data.targetCpa&&data.roas>=data.targetRoas&&data.stable)return {color:'green',title:'Dokunma / veri topla',reason:'Girdiğiniz hedefler karşılanıyor ve trend stabil. Kontrollü ölçüme devam edin.'};
 return {color:'yellow',title:'İzle / optimize et',reason:'Sağlıklı veya acil kararı için kanıt yeterli değil. Dönüşüm hacmini, hedefleri ve trendi birlikte inceleyin.'};
}
