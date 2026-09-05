// Training adaptation of workbook PDF pages 117–118 and 116 model approach.
// Scoring is educational rule-based feedback, never a predicted sales outcome.
export type ConversationScore={trust:number;professionalism:number;discovery:number;pressure:number;value:number};
type Choice={id:string;text:string;next:string;delta:Partial<ConversationScore>;feedback:string};
type Node={id:string;prompt:string;choices:Choice[]};
const nodes:Record<string,Node>={
 start:{id:'start',prompt:'Müşteri: “Alo, evet?”',choices:[
 {id:'permission',text:'Kendimi kısaca tanıtıp görüşme için uygun olup olmadığını sorarım.',next:'needs',delta:{trust:1,professionalism:1,pressure:1},feedback:'İzin ve zaman kontrolü, görüşmeye saygılı bir başlangıç sağlar.'},
 {id:'pitch',text:'Doğrudan hizmet paketimi ve fiyatımı anlatmaya başlarım.',next:'price',delta:{pressure:-1,discovery:-1},feedback:'İhtiyaç anlaşılmadan fiyat anlatmak, görüşmeyi fiyat karşılaştırmasına sıkıştırabilir.'}]},
 needs:{id:'needs',prompt:'Müşteri: “Zaten bir ajansla çalışıyoruz ama pek memnun değiliz.”',choices:[
 {id:'discover',text:'Hangi hedefin karşılanmadığını, mevcut sonuçları ve beklentiyi sorarım.',next:'difference',delta:{discovery:2,trust:1,professionalism:1},feedback:'Kaynak profesyonel ipucu: rakibi kötülemeden beklenti ve KPI farkını keşfet.'},
 {id:'attack',text:'Mevcut ajansın işi bilmediğini söyler, bizim daha iyi olduğumuzu vurgularım.',next:'repair',delta:{trust:-1,professionalism:-2},feedback:'Rakibi kötülemek kaynakta açıkça yanlış yaklaşım olarak belirtilir.'}]},
 repair:{id:'repair',prompt:'Görüşme değerlendirmesi: Rakip hakkında kanıtsız yargı kurdun. Nasıl düzeltirsin?',choices:[
 {id:'repair',text:'Yargımı geri alır, mevcut veriyi ve müşterinin beklentisini sorarım.',next:'difference',delta:{professionalism:1,discovery:1},feedback:'Kanıtsız iddiayı geri almak ve veriye dönmek profesyonelliği destekler.'},
 {id:'insist',text:'Daha çok sonuç garantisi sunarak ikna etmeye çalışırım.',next:'guarantee',delta:{trust:-1,pressure:-1},feedback:'Garanti, henüz anlaşılmamış iş problemini çözmez.'}]},
 difference:{id:'difference',prompt:'Müşteri: “Peki, neyi farklı yapıyorsunuz?”',choices:[
 {id:'specific',text:'İş hedefi, ölçüm ve düzenli raporlama yaklaşımını anlatır; kısa bir denetim öneririm.',next:'trial',delta:{value:2,professionalism:1,discovery:1},feedback:'Somut süreç ve ölçüm yaklaşımı, genel “daha iyiyiz” iddiasından daha değerlidir.'},
 {id:'guarantee',text:'Kesin satış artışı ve kısa sürede birincilik sözü veririm.',next:'guarantee',delta:{trust:-2,professionalism:-1},feedback:'Kontrol edilemeyen sonuçlara kesin garanti vermek gerçekçi beklenti yönetimine aykırıdır.'}]},
 price:{id:'price',prompt:'Müşteri: “Daha ucuza yapan var.”',choices:[
 {id:'scope',text:'Kapsamı, hedefi ve beklentiyi karşılaştırır; gerekirse daha dar kapsamlı başlangıç sunarım.',next:'needs',delta:{value:1,professionalism:1,pressure:1},feedback:'Kaynak örnek çözüm, kapsamı daraltarak başlangıcı kolaylaştırmayı önerir.'},
 {id:'discount',text:'Kapsamı konuşmadan fiyatı hemen düşürürüm.',next:'trial',delta:{value:-1,discovery:-1},feedback:'Gerekçesiz indirim, kapsam ve kârlılık problemini görünmez bırakır.'}]},
 guarantee:{id:'guarantee',prompt:'Müşteri: “Sonuçtan emin olamıyorum, garanti var mı?”',choices:[
 {id:'realistic',text:'Kontrol edebildiğimiz süreçleri, ölçüm planını ve riskleri açıklar; sonuç garantisi vermem.',next:'trial',delta:{trust:1,professionalism:1,value:1},feedback:'Şeffaf süreç ve ölçülebilir hedef, gerçekçi beklenti oluşturur.'},
 {id:'promise',text:'Sözleşmeyi kazanmak için kesin sonuç sözü veririm.',next:'finish-risk',delta:{trust:-2,professionalism:-2,pressure:-1},feedback:'Bu seçim beklenti ve güven riski yaratır. Kaynakta önerilen gerçekçi hedef yaklaşımına geri dön.'}]},
 trial:{id:'trial',prompt:'Müşteri: “Önce bir ay deneyelim, uzun sözleşme istemiyorum.”',choices:[
 {id:'pilot',text:'Deneme kapsamı, başarı ölçütü, veri ihtiyacı ve değerlendirme tarihini birlikte netleştiririm.',next:'meeting',delta:{value:1,discovery:1,pressure:1},feedback:'Süreyi tek başına değil, kapsam ve ölçüm koşullarıyla birlikte tanımla.'},
 {id:'push',text:'Bugün karar vermezse fırsatı kaçıracağını söyleyerek baskı kurarım.',next:'finish-risk',delta:{pressure:-2,trust:-1},feedback:'Satış baskısı, ihtiyaç keşfi ve güvenin yerini alamaz.'}]},
 meeting:{id:'meeting',prompt:'Müşteri: “Tamam, bir toplantı ayarlayalım.”',choices:[
 {id:'schedule',text:'Gün, saat, katılımcılar ve görüşme gündemini netleştiririm.',next:'finish',delta:{professionalism:1,pressure:1},feedback:'Kaynak örnek çözüm: sonraki adımı ve tarihi somutlaştır, belirsiz bırakma.'},
 {id:'vague',text:'İleride haberleşiriz diyerek görüşmeyi kapatırım.',next:'finish',delta:{professionalism:-1},feedback:'Somut sonraki adım belirlenmediği için takip belirsiz kaldı.'}]}
};
export type ConversationState={node:string;scores:ConversationScore;history:{node:string;choice:string;feedback:string}[];finished:boolean};
export function startConversation():ConversationState{return {node:'start',scores:{trust:0,professionalism:0,discovery:0,pressure:0,value:0},history:[],finished:false};}
export function chooseConversation(state:ConversationState,choiceId:string):ConversationState{
 if(state.finished||state.history.length>=12)throw new Error('Görüşme tamamlandı.');const node=nodes[state.node];const choice=node?.choices.find(c=>c.id===choiceId);if(!choice)throw new Error('Geçersiz görüşme seçimi.');
 const scores={...state.scores};for(const key of Object.keys(scores) as (keyof ConversationScore)[])scores[key]=Math.max(0,Math.min(4,scores[key]+(choice.delta[key]||0)));
 return {node:choice.next,scores,history:[...state.history,{node:node.id,choice:choice.id,feedback:choice.feedback}],finished:choice.next.startsWith('finish')};
}
export function presentConversation(state:ConversationState){const node=nodes[state.node];return {finished:state.finished,node:state.node,prompt:node?.prompt||'Görüşme çalışması tamamlandı.',choices:node?.choices.map(c=>({id:c.id,text:c.text}))||[],feedback:state.history.at(-1)?.feedback,...(state.finished?{scores:state.scores}:{}),step:state.history.length};}
