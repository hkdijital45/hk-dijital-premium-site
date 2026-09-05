import 'server-only';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import indexData from '../../../content/academy/index.json';
import moduleData from '../../../content/academy/modules.json';
import type {ContentIndex,ContentRecord} from './types';
export const contentIndex=indexData as ContentIndex[];
export const academyModules=moduleData;
const root=path.join(process.cwd(),'content/academy');
export async function getContent(id:string):Promise<ContentRecord|null>{
 if(!contentIndex.some(row=>row.id===id)) return null;
 return JSON.parse(await readFile(path.join(root,`${id}.json`),'utf8'));
}
export async function getSolution(id:string):Promise<string|null>{
 if(!contentIndex.some(row=>row.id===id)) return null;
 const data=JSON.parse(await readFile(path.join(root,'solutions.json'),'utf8')) as Record<string,string>;
 return data[id] || null;
}
export async function getAnswerKey(id:string):Promise<Record<string,string>>{
 const solution=await getSolution(id); if(!solution) return {};
 const keys:Record<string,string>={};
 for(const match of solution.matchAll(/(?:^|[·\s])([0-9]+)-([A-DY])(?=\s|·|$)/g)) keys[match[1]]=match[2];
 return keys;
}
