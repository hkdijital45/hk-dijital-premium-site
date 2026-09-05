// Compare the browser Origin to the actual Host header, not an internal
// Next.js request URL (which can use localhost behind a reverse proxy).
// Never accept a caller-supplied X-Forwarded-Host as an authorization signal.
export function sameOriginRequest(request:Pick<Request,'headers'|'url'>){
 const raw=request.headers.get('origin');if(!raw)return false;
 try{const origin=new URL(raw);if(!['https:','http:'].includes(origin.protocol)||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)return false;
 const host=request.headers.get('host');const expected=host?new URL(`${origin.protocol}//${host}`).origin:new URL(request.url).origin;
 return origin.origin===expected;
 }catch{return false;}
}
