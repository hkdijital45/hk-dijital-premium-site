import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export function encryptContent(records,key){
 const nonce=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key,nonce);
 const payload=Buffer.concat([cipher.update(JSON.stringify(records),'utf8'),cipher.final()]);
 return Buffer.concat([Buffer.from('HKAC1'),nonce,cipher.getAuthTag(),payload]);
}
export function decryptContent(bundle,key){
 if(bundle.subarray(0,5).toString()!=='HKAC1')throw new Error('Unsupported academy content package.');
 const decipher=createDecipheriv('aes-256-gcm',key,bundle.subarray(5,17));decipher.setAuthTag(bundle.subarray(17,33));
 const data=JSON.parse(Buffer.concat([decipher.update(bundle.subarray(33)),decipher.final()]).toString('utf8'));
 if(!data||typeof data!=='object'||Array.isArray(data)||!data['index.json'])throw new Error('Invalid academy manifest.');
 for(const [name,value] of Object.entries(data))if(!/^[a-z0-9-]+\.json$/.test(name)||typeof value!=='string')throw new Error('Invalid academy record.');
 const index=JSON.parse(data['index.json']);if(!Array.isArray(index)||index.some(row=>!data[`${row.id}.json`]))throw new Error('Incomplete academy manifest.');
 return data;
}
function run(){
 const action=process.argv[2];const root=resolve('content/academy');const bundlePath=resolve('content/academy.bundle.enc');
 if(action==='prepare'&&existsSync(resolve(root,'index.json')))return;
 let encoded=process.env.ACADEMY_CONTENT_KEY;
 const local=resolve('.env.academy.local');
 if(!encoded&&existsSync(local))encoded=readFileSync(local,'utf8').match(/^ACADEMY_CONTENT_KEY=([a-f0-9]{64})$/m)?.[1];
 if(action==='pack'&&!encoded){encoded=randomBytes(32).toString('hex');writeFileSync(local,`ACADEMY_CONTENT_KEY=${encoded}\n`,{mode:0o600,flag:'wx'});}
 if(!encoded||!/^[a-f0-9]{64}$/i.test(encoded))throw new Error('ACADEMY_CONTENT_KEY must be configured for the private academy content package.');
 const key=Buffer.from(encoded,'hex');
 if(action==='pack'){
  const index=JSON.parse(readFileSync(resolve(root,'index.json'),'utf8'));
  const names=['index','modules','sources','solutions','workflows','editorial','tables',...index.map(row=>row.id)];
  const records=Object.fromEntries(names.map(name=>[`${name}.json`,readFileSync(resolve(root,`${name}.json`),'utf8')]));
  writeFileSync(bundlePath,encryptContent(records,key));console.log(`Encrypted ${names.length} private academy records. Key remains outside Git.`);
 }else if(action==='prepare'||action==='unpack'){
  const records=decryptContent(readFileSync(bundlePath),key);mkdirSync(root,{recursive:true});
  for(const [name,value] of Object.entries(records))writeFileSync(resolve(root,name),value);
  console.log(`Prepared ${Object.keys(records).length} private academy records for the server build.`);
 }else throw new Error('Use pack, unpack, or prepare.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{run();}catch(error){console.error(error instanceof Error?error.message:'Academy content preparation failed.');process.exitCode=1;}}
