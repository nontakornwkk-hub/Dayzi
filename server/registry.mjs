import {env} from './security.mjs';
export async function registry(action,uid,payload={}){
  const url=env('REGISTRY_URL'),secret=env('REGISTRY_SECRET');
  if(!url||!secret)throw Object.assign(new Error('เจ้าของระบบยังไม่ได้ตั้งค่าทะเบียนบัญชี Google'),{status:503});
  const r=await fetch(url,{method:'POST',redirect:'follow',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret,action,uid,...payload}),signal:AbortSignal.timeout(22000)});
  if(!r.ok)throw Object.assign(new Error('ติดต่อทะเบียนบัญชีไม่สำเร็จ'),{status:503});
  const data=await r.json();if(data?.error)throw Object.assign(new Error(data.error),{status:data.status??400});return data;
}
