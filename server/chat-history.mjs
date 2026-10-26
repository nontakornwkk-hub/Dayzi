const invalid=()=>{throw Object.assign(new Error('ประวัติการสนทนาไม่ถูกต้องหรือใหญ่เกินกำหนด'),{status:400});};
const validId=value=>typeof value==='string'&&value.trim().length>0&&value.length<=100&&!/[\x00-\x1f]/.test(value);
const bounded=(value,max)=>typeof value==='string'&&value.length<=max;

// A Sheets cell supports at most 50,000 characters. Keep message JSON below that limit.
export function sanitizeChat(chat){
 if(!chat||!validId(chat.id)||!bounded(chat.title,200)||!Array.isArray(chat.messages)||chat.messages.length>200)invalid();
 const updatedAt=typeof chat.updatedAt==='number'?chat.updatedAt:Date.parse(chat.updatedAt);
 if(!Number.isSafeInteger(updatedAt)||updatedAt<=0||updatedAt>8640000000000000)invalid();
 const messages=chat.messages.map(message=>{
  if(!message||!['user','assistant'].includes(message.role)||!bounded(message.text??'',20000))invalid();
  const clean={role:message.role,text:message.text??''};
  if(message.id!==undefined){if(!validId(message.id))invalid();clean.id=message.id;}
  if(message.source!==undefined){if(!bounded(message.source,80))invalid();clean.source=message.source;}
  if(message.attachments!==undefined){
   if(!Array.isArray(message.attachments)||message.attachments.length>10)invalid();
   clean.attachments=message.attachments.map(file=>{
    if(!file||!validId(file.id)||!bounded(file.name,255)||!bounded(file.mimeType,150))invalid();
    const attachment={id:file.id,name:file.name,mimeType:file.mimeType};
    if(file.driveId!==undefined){if(!/^[A-Za-z0-9_-]{1,200}$/.test(file.driveId))invalid();attachment.driveId=file.driveId;}
    if(typeof file.local==='boolean')attachment.local=file.local;
    if(file.source!==undefined){if(!bounded(file.source,80)||/^(?:blob:|data:)/i.test(file.source))invalid();attachment.source=file.source;}
    return attachment;
   });
  }
  if(!clean.text&&!clean.attachments?.length)invalid();
  return clean;
 });
 if(JSON.stringify(messages).length>45000)invalid();
 return {id:chat.id,title:chat.title,updatedAt,messages};
}
export function sanitizeChatMutation(input,knownFiles=[]){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['chat','deletedId'].includes(key))||Object.hasOwn(input,'chat')===Object.hasOwn(input,'deletedId'))invalid();
 if(Object.hasOwn(input,'deletedId')){if(!validId(input.deletedId))invalid();return {deletedId:input.deletedId};}
 const chat=sanitizeChat(input.chat);
 for(const message of chat.messages)for(const file of message.attachments??[])if(file.driveId&&!knownFiles.some(known=>known.id===file.id&&known.driveId===file.driveId))throw Object.assign(new Error('ไม่มีสิทธิ์ใช้รหัสไฟล์นี้'),{status:403});
 return {chat};
}
export function encodeChat(chat,ownerId){const clean=sanitizeChat(chat);return [clean.id,ownerId,clean.title,clean.updatedAt,JSON.stringify(clean.messages)];}
export function decodeChats(rows,ownerId){const chats=[];for(const row of (rows??[]).slice(1)){if(row[1]!==ownerId||!row[0])continue;try{chats.push(sanitizeChat({id:row[0],title:row[2],updatedAt:Number(row[3]),messages:JSON.parse(row[4])}));}catch{ /* Ignore malformed rows instead of exposing foreign or corrupt records. */ }}return chats.sort((a,b)=>b.updatedAt-a.updatedAt);}
