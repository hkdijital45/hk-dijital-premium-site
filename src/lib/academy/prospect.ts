export const prospectIds=['cases-9','cases-69','final-166'] as const;
export type ProspectRating={need:number;capacity:number;reachability:number};
export function scoreProspect(rating:ProspectRating){for(const v of [rating?.need,rating?.capacity,rating?.reachability])if(!Number.isInteger(v)||v<1||v>5)throw new Error('Her kriter 1–5 arası olmalı.');return rating.need*5+rating.capacity*4+rating.reachability*3;}
export function assessProspectOrder(ratings:Record<string,ProspectRating>,order:string[]){
 if(order.length!==3||new Set(order).size!==3||order.some(id=>!prospectIds.includes(id as typeof prospectIds[number])))throw new Error('Üç kaynak işletmesini birer kez sıralayın.');
 const scores=Object.fromEntries(prospectIds.map(id=>[id,scoreProspect(ratings[id])]));let correctPairs=0;
 for(let i=0;i<order.length;i++)for(let j=i+1;j<order.length;j++)if(scores[order[i]]>=scores[order[j]])correctPairs++;
 return {scores,score:Math.round(correctPairs/3*4),basis:'Kullanıcının kaynak verisine dayanarak girdiği kriter puanları; ağırlıklar workbook PDF s.116: 5 / 4 / 3.'};
}
