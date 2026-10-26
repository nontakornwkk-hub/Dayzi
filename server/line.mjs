import {createHash} from 'node:crypto';
import {env} from './security.mjs';

export function lineLoginConfig() {
  return { channelId:env('LINE_LOGIN_CHANNEL_ID'), channelSecret:env('LINE_LOGIN_CHANNEL_SECRET') };
}

export function safeLineDraft(raw) {
  try {
    if(typeof raw!=='string'||raw.length>1500)return null;
    const draft=JSON.parse(raw);
    if(typeof draft.title!=='string'||!draft.title.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(draft.date))return null;
    if(new Date(`${draft.date}T00:00:00Z`).toISOString().slice(0,10)!==draft.date)return null;
    if(draft.time!==null&&draft.time!==undefined&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time))return null;
    return {title:draft.title.trim().slice(0,200),date:draft.date,time:draft.time??null,category:['work','meeting','personal','important'].includes(draft.category)?draft.category:'work'};
  } catch {return null;}
}

export function lineAuthorizationUrl(origin,{state,nonce,verifier},config=lineLoginConfig()) {
  const query=new URLSearchParams({response_type:'code',client_id:config.channelId,redirect_uri:`${origin}/api/line/callback`,state,nonce,scope:'openid profile',bot_prompt:'aggressive',code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
  return `https://access.line.me/oauth2/v2.1/authorize?${query}`;
}

export function validateLineClaims(claims,{channelId,nonce,now=Math.floor(Date.now()/1000)}) {
  if(claims?.iss!=='https://access.line.me'||String(claims.aud)!==String(channelId)||claims.nonce!==nonce||!Number.isFinite(claims.exp)||claims.exp<=now||!/^U[0-9a-f]{32}$/i.test(claims.sub??'')) {
    throw Object.assign(new Error('ยืนยันบัญชี LINE ไม่สำเร็จ'),{status:401});
  }
  return {uid:`line:${claims.sub}`,lineId:claims.sub,name:String(claims.name??'คุณ').slice(0,100),provider:'line'};
}

export async function exchangeLineIdentity(origin,{code,verifier,nonce},config=lineLoginConfig()) {
  const response=await fetch('https://api.line.me/oauth2/v2.1/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:`${origin}/api/line/callback`,client_id:config.channelId,client_secret:config.channelSecret,code_verifier:verifier}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Object.assign(new Error('LINE Login ไม่สำเร็จ'),{status:401});
  const tokens=await response.json();
  const verification=await fetch('https://api.line.me/oauth2/v2.1/verify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({id_token:tokens.id_token,client_id:config.channelId,nonce}),signal:AbortSignal.timeout(15000)});
  if(!verification.ok)throw Object.assign(new Error('ยืนยัน LINE ID token ไม่สำเร็จ'),{status:401});
  return validateLineClaims(await verification.json(),{channelId:config.channelId,nonce});
}
