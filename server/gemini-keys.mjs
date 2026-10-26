import {GoogleGenAI} from '@google/genai';
import {env} from './security.mjs';
const bundled=await import('./gemini-keys.generated.json',{with:{type:'json'}}).then(m=>m.default,()=>({keys:[]}));

const NAMES=['GEMINI_API_KEY_1','GEMINI_API_KEY_2','GEMINI_API_KEY_3','GEMINI_API_KEY_4','GEMINI_API_KEY_5','GEMINI_API_KEY','GOOGLE_API_KEY'];
// Up to five keys, from environment variables first and then the deploy-time bundle from .env.local.
export function geminiKeys(read=env){
 const fromEnv=NAMES.map(k=>(typeof read==='function'?read(k):read[k])?.trim()).filter(Boolean);
 return [...new Set([...fromEnv,...(read===env?bundled.keys??[]:[])])].slice(0,5);
}
const exhausted=new Map();let cursor=0;
const retryable=e=>[429,403,401,400].includes(e?.status)||/quota|exhaust|rate|api key/i.test(e?.message??'');
// Use one key at a time; when it is out of quota, skip it for an hour and move to the next.
export async function withGeminiKey(run,{keys=geminiKeys(),client}={}){
 if(client)return run(client);
 if(!keys.length)throw Object.assign(new Error('ยังไม่ได้ตั้งค่า Gemini API key'),{status:503});
 const now=Date.now(),order=keys.map((_,i)=>(cursor+i)%keys.length).filter(i=>(exhausted.get(keys[i])??0)<now);
 let last;
 for(const i of order.length?order:keys.map((_,i)=>i)){
  try{const result=await run(new GoogleGenAI({apiKey:keys[i]}));cursor=i;return result;}
  catch(e){last=e;if(!retryable(e))throw e;exhausted.set(keys[i],now+3600000);cursor=(i+1)%keys.length;}
 }
 throw last;
}
