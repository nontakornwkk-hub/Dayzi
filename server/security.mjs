import {createHmac,randomBytes,createCipheriv,createDecipheriv,timingSafeEqual} from 'node:crypto';
export function signSession(payload,key,now=Math.floor(Date.now()/1000)) {
  const body=Buffer.from(JSON.stringify({...payload,iat:now,exp:now+86400})).toString('base64url');
  return `${body}.${createHmac('sha256',key).update(body).digest('base64url')}`;
}
export function verifySession(token,key,now=Math.floor(Date.now()/1000)) {
  const [body,sig,...extra]=String(token??'').split('.');
  if(!body||!sig||extra.length)throw new Error('UNAUTHORIZED');
  const expected=createHmac('sha256',key).update(body).digest();const provided=Buffer.from(sig,'base64url');
  if(provided.length!==expected.length||!timingSafeEqual(expected,provided))throw new Error('UNAUTHORIZED');
  const p=JSON.parse(Buffer.from(body,'base64url').toString());
  if(!p.sub||!p.exp||p.exp<=now)throw new Error('UNAUTHORIZED');return p;
}
export function encryptSecret(value,owner,key) {
  const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(key,'base64'),nonce);cipher.setAAD(Buffer.from(owner));
  const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return Buffer.concat([nonce,cipher.getAuthTag(),encrypted]).toString('base64');
}
export function decryptSecret(value,owner,key) {
  const b=Buffer.from(value,'base64'),decipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'base64'),b.subarray(0,12));decipher.setAAD(Buffer.from(owner));decipher.setAuthTag(b.subarray(12,28));return Buffer.concat([decipher.update(b.subarray(28)),decipher.final()]).toString();
}
export function ownedFile(files,id,ownerId){const file=files.find(f=>f.id===id&&f.ownerId===ownerId);if(!file)throw new Error('NOT_FOUND');return file;}
export function cookie(req,name) {return (req.headers.get('cookie')??'').split(';').map(x=>x.trim()).find(x=>x.startsWith(`${name}=`))?.slice(name.length+1);}
export function env(key){return process.env[key]??globalThis.Netlify?.env?.get(key);}
export const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
