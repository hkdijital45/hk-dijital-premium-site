export async function academyAction(id:string,action:string,values:Record<string,unknown>={}){
 const response=await fetch('/api/academy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action,...values})});
 const result=await response.json();if(!response.ok)throw new Error(result.error||'İşlem başarısız.');return result;
}
