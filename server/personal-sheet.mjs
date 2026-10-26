import {sanitizeChat} from './chat-history.mjs';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const bad=()=>fail(400,'URL หรือข้อมูลการเชื่อมต่อ Sheets ส่วนตัวไม่ถูกต้อง');
function endpoint(value,redirect=false){
 let url;try{url=new URL(value);}catch{if(redirect)fail(502,'Apps Script ส่งต่อไปยัง URL ที่ไม่ถูกต้อง');bad();}
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash||(redirect?url.hostname!=='script.googleusercontent.com':url.hostname!=='script.google.com'||url.search||!/^\/macros\/s\/[A-Za-z0-9_-]{10,200}\/exec$/.test(url.pathname)))redirect?fail(502,'บริการส่งต่อไปยัง URL ที่ไม่ได้รับอนุญาต'):bad();
 return url.href;
}
async function boundedJson(response){
 if(!response.ok)fail(502,'ติดต่อ Apps Script ไม่สำเร็จ ตรวจ URL และสิทธิ์ Web app');
 const reader=response.body?.getReader();if(!reader)fail(502,'Apps Script ไม่ส่งข้อมูล');let bytes=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>2000000){await reader.cancel();fail(502,'ข้อมูลจาก Sheets ใหญ่เกินกำหนด');}chunks.push(value);}}finally{reader.releaseLock();}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail(502,'Apps Script ไม่ได้ส่ง JSON ตรวจว่าเผยแพร่ Web app ให้เข้าถึงได้');}
}
function cleanData(data){
 if(!data||typeof data!=='object'||Array.isArray(data)||JSON.stringify(data).length>900000)bad();
 const out={};for(const name of ['events','tasks','notes','files','transactions']){if(!Array.isArray(data[name]??[])||(data[name]??[]).length>1000)bad();out[name]=data[name]??[];}
 for(const name of ['settings','delivered']){if(data[name]!==undefined&&(!data[name]||typeof data[name]!=='object'||Array.isArray(data[name])))bad();out[name]=data[name]??{};}return out;
}
export async function personalSheetRequest(input,fetcher=fetch){
 if(!input||!['read','write','chats','saveChat'].includes(input.action)||typeof input.secret!=='string'||input.secret.length<16||input.secret.length>200||/[\x00-\x1f]/.test(input.secret))bad();
 const url=endpoint(input.deploymentUrl);let payload={};
 if(input.action==='write'){if(!Number.isSafeInteger(input.payload?.expectedRevision)||input.payload.expectedRevision<0)bad();payload={data:cleanData(input.payload.data),expectedRevision:input.payload.expectedRevision};}
 if(input.action==='saveChat'){
  const p=input.payload;if(!p||Object.keys(p).some(k=>!['chat','deletedId'].includes(k))||Object.hasOwn(p,'chat')===Object.hasOwn(p,'deletedId'))bad();
  if(p.chat)payload={chat:sanitizeChat(p.chat)};else{if(typeof p.deletedId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(p.deletedId))bad();payload={deletedId:p.deletedId};}
 }
 const signal=AbortSignal.timeout(22000);let response;
 try{
  response=await fetcher(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:input.secret,action:input.action,payload}),redirect:'manual',signal});
  for(let hop=0;[301,302,303,307,308].includes(response.status);hop++){
   if(hop>=2)fail(502,'Apps Script ส่งต่อหลายครั้งเกินกำหนด');
   const next=endpoint(response.headers.get('location'),true);await response.body?.cancel();
   response=await fetcher(next,{method:'GET',redirect:'manual',signal});
  }
 }catch(error){if(error.status)throw error;fail(502,'ติดต่อ Apps Script ไม่สำเร็จ กรุณาลองใหม่');}
 const result=await boundedJson(response);
 if(result?.error){const status=[400,401,403,409,413,429,503].includes(result.status)?result.status:502;fail(status,status===401?'รหัสลับ Sheets ส่วนตัวไม่ถูกต้อง':status===409?'ข้อมูลใน Sheets เปลี่ยนแล้ว กรุณาโหลดใหม่':status===400?'ข้อมูลไม่ถูกต้องหรือใหญ่เกินกำหนด':'Apps Script บันทึกไม่สำเร็จ ตรวจการตั้งค่าแล้วลองใหม่');}
 if(input.action==='read'){if(typeof result?.ownerId!=='string'||!Number.isSafeInteger(result.revision)||result.revision<0)fail(502,'คำตอบจาก Apps Script ไม่ถูกต้อง');return {ownerId:result.ownerId,data:cleanData(result.data),revision:result.revision};}
 if(input.action==='write'){if(!Number.isSafeInteger(result?.revision)||result.revision<0)fail(502,'คำตอบจาก Apps Script ไม่ถูกต้อง');return {revision:result.revision};}
 if(input.action==='chats'){if(!Array.isArray(result?.chats)||result.chats.length>1000)fail(502,'คำตอบจาก Apps Script ไม่ถูกต้อง');return {chats:result.chats.map(sanitizeChat)};}
 if(payload.chat)return {chat:sanitizeChat(result?.chat)};
 if(result?.deletedId!==payload.deletedId)fail(502,'คำตอบจาก Apps Script ไม่ถูกต้อง');return {deletedId:result.deletedId};
}
