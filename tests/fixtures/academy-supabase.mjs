/** LOCAL TEST FIXTURE ONLY. Never imported by application code.
 * Models the Supabase REST contract for deterministic integration tests.
 * This is not a substitute for a live PostgreSQL/RLS verification.
 */
import {createServer} from 'node:http';
const states=new Map();
const ids={a:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',b:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',c:'cccccccc-cccc-4ccc-cccc-cccccccccccc'};
const profiles=Object.entries(ids).map(([key,id])=>({id,auth_user_id:id,email:`academy-${key}@example.invalid`,full_name:`Akademi Test ${key.toUpperCase()}`,role:'admin',is_active:true,deleted_at:null,company_id:null,must_change_password:false}));
const memberships=new Map();const reset=()=>{states.clear();memberships.clear();for(const p of profiles)memberships.set(p.id,{user_id:p.id,role:p.id===ids.c?'academy_admin':'academy_user',active:true});};reset();
const server=createServer(async(req,res)=>{
 let raw='';for await(const chunk of req)raw+=chunk;let body={};try{body=JSON.parse(raw||'{}');}catch{}
 const url=new URL(req.url,'http://127.0.0.1');const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
 if(url.pathname==='/test/reset'){reset();return json(200,{ok:true});}
 if(url.pathname==='/auth/v1/token'){
 const profile=profiles.find(p=>p.email===body.email);if(!profile||body.password!=='academy-fixture-password')return json(400,{error:'invalid_credentials'});
 return json(200,{access_token:`fixture-${profile.id}`,refresh_token:'fixture-refresh',user:{id:profile.id,email:profile.email}});
 }
 if(url.pathname==='/auth/v1/user'){
 const profile=profiles.find(p=>req.headers.authorization===`Bearer fixture-${p.id}`);return profile?json(200,{id:profile.id,email:profile.email}):json(401,{error:'invalid_token'});
 }
 if(!url.pathname.startsWith('/rest/v1/'))return json(404,{});
 if(req.headers.apikey!=='fixture-service-role')return json(403,{error:'fixture_service_role_required'});
 const table=url.pathname.slice('/rest/v1/'.length);const eq=k=>(url.searchParams.get(k)||'').replace(/^eq\./,'');
 if(table==='users'){return json(200,profiles.filter(p=>['id','auth_user_id','email'].every(k=>!url.searchParams.has(k)||(url.searchParams.get(k)?.startsWith('in.(')?url.searchParams.get(k).slice(4,-1).split(',').includes(p[k]):p[k]===eq(k)))));}
 if(table==='academy_memberships'){if(req.method==='POST'){memberships.set(body.user_id,body);return json(200,[body]);}const rows=[...memberships.values()].filter(m=>(!url.searchParams.has('user_id')||m.user_id===eq('user_id'))&&(!url.searchParams.has('active')||String(m.active)===eq('active')));return json(200,rows);}
 if(table==='academy_learning_state'){
 if(req.method==='POST'){states.set(`${body.user_id}:${body.content_id}:${body.kind}`,body);return json(200,[body]);}
 const rows=[...states.values()].filter(r=>r.user_id===eq('user_id')&&(!url.searchParams.has('kind')||url.searchParams.get('kind').slice(4,-1).split(',').includes(r.kind)));const offset=Number(url.searchParams.get('offset')||0);return json(200,rows.slice(offset,offset+Number(url.searchParams.get('limit')||500)));
 }
 if(req.method==='POST')return json(201,[body]);
 return json(200,[]);
});
server.listen(54999,'127.0.0.1',()=>console.log('Academy test fixture listening on 127.0.0.1:54999'));
