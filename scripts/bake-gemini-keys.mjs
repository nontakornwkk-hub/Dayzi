// Copy GEMINI_API_KEY_1..5 from .env.local into a server-only file so a local deploy needs no Netlify env step.
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
const source=new URL('../.env.local',import.meta.url),target=new URL('../server/gemini-keys.generated.json',import.meta.url);
const vars=existsSync(source)?Object.fromEntries(readFileSync(source,'utf8').split(/\r?\n/).map(l=>l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map(m=>[m[1],m[2].replace(/^(['"])(.*)\1$/,'$2')])):{};
const keys=[...new Set(['GEMINI_API_KEY_1','GEMINI_API_KEY_2','GEMINI_API_KEY_3','GEMINI_API_KEY_4','GEMINI_API_KEY_5','GEMINI_API_KEY'].map(k=>vars[k]?.trim()).filter(Boolean))];
writeFileSync(target,JSON.stringify({keys}));
console.log(`Gemini keys bundled: ${keys.length}`);
