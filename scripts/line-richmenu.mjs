// Publish the six-tile Dayzi menu only after the matching image is ready. The previous menu is kept for rollback.
import {readFileSync,writeFileSync} from 'node:fs';
import {sixButtonRichMenu} from '../src/navigation.mjs';
process.loadEnvFile(new URL('../.env.local',import.meta.url));
const site=process.argv.find(a=>a.startsWith('https://'))??process.env.SITE_URL;
if(!site)throw new Error('Pass the site URL as an argument or set SITE_URL');
const menu=sixButtonRichMenu(site,process.env.LINE_BOT_ID?.trim()),image=readFileSync(new URL('../assets/line/richmenu-new.jpg',import.meta.url));
if(image.length>1_000_000)throw new Error('Rich Menu image must be under 1MB');
const token=process.env.LINE_CHANNEL_ACCESS_TOKEN;
if(!token)throw new Error('Missing LINE token in server environment');
async function line(path,init={},host='api.line.me'){
 const response=await fetch(`https://${host}/v2/bot/${path}`,{...init,headers:{Authorization:`Bearer ${token}`,...init.headers},signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error(`LINE ${path} failed (${response.status})`);
 const text=await response.text();return text?JSON.parse(text):{};
}
await line('richmenu/validate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(menu)});
if(!process.argv.includes('--apply')){console.log(JSON.stringify({validated:true,menu}));process.exit(0);}
let previous=null;try{previous=(await line('user/all/richmenu')).richMenuId;}catch{}
writeFileSync(new URL('../.qa/previous-richmenu.json',import.meta.url),JSON.stringify({previous}));
const {richMenuId}=await line('richmenu',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(menu)});
await line(`richmenu/${richMenuId}/content`,{method:'POST',headers:{'Content-Type':'image/jpeg'},body:image},'api-data.line.me');
await line(`user/all/richmenu/${richMenuId}`,{method:'POST'});
const active=await line('user/all/richmenu'),actual=await line(`richmenu/${richMenuId}`);
if(active.richMenuId!==richMenuId||actual.areas.length!==6)throw new Error('Published menu verification failed');
console.log(JSON.stringify({published:true,richMenuId,areas:actual.areas,previousRetained:previous}));
