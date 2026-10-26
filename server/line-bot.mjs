import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {env,json,encryptSecret,decryptSecret} from './security.mjs';
import {registry as defaultRegistry} from './registry.mjs';
import {uploadDriveStream} from './files.mjs';
import {localCommand,applyAssistantAction} from '../src/commands.mjs';
import {generateIntentPlan} from './intent-planner.mjs';
import {encodeData,validateData} from './google.mjs';
import {geminiConfig,generateGeminiReply,conversationHistory} from './assistant.mjs';
import {localDate,occursOn,dateAdd,thaiDate} from '../src/model.mjs';
import {taskMessage,eventMessage,financeMessage,fileMessage,summaryMessage,todayMessage,proposalMessage,noteMessage,connectMessage} from './line-cards.mjs';
import {createLinkToken} from './google-link.mjs';

// Thrown when a request needs the user's own Google storage and they have not connected it yet.
class NeedConnect extends Error{}
function connectReply(origin,uid,options){try{return connectMessage(origin,createLinkToken(uid,env('SESSION_SECRET')),options);}catch{return `ต้องเชื่อม Google ของคุณก่อนนะคะ เปิดเว็บเพื่อเชื่อม: ${origin}`;}}

export async function handleLineWebhook(request,options={}) {
  const secret=options.channelSecret??env('LINE_CHANNEL_SECRET');
  const channelToken=options.channelToken??env('LINE_CHANNEL_ACCESS_TOKEN');
  if(request.method!=='POST'||!secret||!channelToken)return json({error:'LINE ยังไม่ได้ตั้งค่า'},503);
  const raw=await request.text();
  const expected=createHmac('sha256',secret).update(raw).digest();
  const supplied=Buffer.from(request.headers.get('x-line-signature')??'','base64');
  if(expected.length!==supplied.length||!timingSafeEqual(expected,supplied))return json({error:'Invalid signature'},401);
  let payload;try{payload=JSON.parse(raw);}catch{return json({error:'Invalid payload'},400);}
  const registry=options.registry??defaultRegistry,fetchImpl=options.fetch??fetch;
  const origin=options.origin??new URL(request.url).origin;
  const afterReply=[];
  for(const event of payload.events??[]) {
    if(event.source?.type!=='user'||!/^U[0-9a-f]{32}$/i.test(event.source.userId??'')||!event.replyToken)continue;
    if(!['follow','message','postback'].includes(event.type))continue;
    let reply,linkUid=null;
    try {
      const lineId=event.source.userId,uid=`line:${lineId}`;linkUid=uid;
      if(event.type==='follow') {
        await registry('lineOnboard',uid,{lineId});
        reply=connectReply(origin,uid,{welcome:true});
      } else {
        const text=event.message?.text??'';
        const legacyLink=text.match(/^เชื่อม\s+([A-F0-9]{10})$/i);
        if(legacyLink) {
          await registry('consumeLink',null,{code:legacyLink[1].toUpperCase(),lineId});
          reply='เชื่อมบัญชี LINE แล้วค่ะ 🌼';
        } else {
          let account=await registry('findLine',null,{lineId});
          if(!account)account=await registry('lineOnboard',uid,{lineId});
          if(event.type==='postback') {
            const change=JSON.parse(event.postback?.data??'{}');
            if(change.a!=='cancel'&&account.connection?.status!=='ready')throw new NeedConnect();
            if(change.a==='cancel')reply='ยกเลิกแล้วค่ะ ไม่ได้บันทึกอะไร 🌼';
            else if(change.a==='ok'){
              const {data,token}=await options.accountData(account,origin);
              const result=applyAssistantAction({name:change.n,arguments:change.g},data,localDate());
              const collection={finance:'transactions',task:'tasks',event:'events',note:'notes'}[result.kind];
              const stableId='line-'+createHash('sha256').update(account.uid+':'+(event.postback?.data??'')).digest('hex').slice(0,40);
              if(result.data&&collection){
                if(data[collection]?.some(t=>t.id===stableId))reply='รายการนี้บันทึกไว้แล้วค่ะ ✓';
                else{result.entry.id=stableId;result.data[collection]=[...data[collection],result.entry];validateData(result.data,[...data.files,...(account.uploads??[])]);await registry('saveData',account.uid,{accessToken:token,ranges:encodeData(result.data,account.uid),connectionVersion:account.version,expectedRevision:account.revision});}
              }
              if(!reply)reply=result.kind==='task'?taskMessage([result.entry],result.text,origin):result.kind==='event'?eventMessage(result.entry,result.text,origin):result.kind==='finance'?financeMessage(result.entry,result.text,origin):result.kind==='note'?noteMessage(result.entry,result.text,origin):result.text;
            } else {
            const {data,token}=await options.accountData(account,origin);
            const collection=change.action==='task-done'?'tasks':change.action==='event-done'?'events':null;
            const item=collection&&data[collection].find(t=>t.id===change.id);
            if(!item)reply='ไม่พบรายการนี้ในบัญชีของคุณค่ะ';
            else if(collection==='events'&&(item.status==='cancelled'||item.repeat&&item.repeat!=='none'))reply='จัดการนัดนี้จากปฏิทินได้เลยค่ะ';
            else if(item.done||item.status==='done')reply='รายการนี้ทำเสร็จแล้วค่ะ ✓';
            else {
              const next={...data,[collection]:data[collection].map(t=>t.id===item.id?{...t,...(collection==='tasks'?{done:true}:{status:'done',updatedAt:new Date().toISOString()})}:t)};
              validateData(next,[...data.files,...(account.uploads??[])]);
              await registry('saveData',account.uid,{accessToken:token,ranges:encodeData(next,account.uid),connectionVersion:account.version,expectedRevision:account.revision});
              reply=`ติ๊ก “${item.title}” ว่าทำเสร็จแล้วค่ะ ✓`;
            }
            }
          } else if(event.message?.type==='text') {
            const connected=account.connection?.status==='ready';
            const {data:commandData,token:commandToken}=connected?await options.accountData(account,origin):{data:{events:[],tasks:[],notes:[],files:[],transactions:[],settings:{}},token:null};
            let commandHistory=[];if(account.chatHistory){try{commandHistory=JSON.parse(decryptSecret(account.chatHistory,account.uid,env('TOKEN_ENCRYPTION_KEY')));}catch{}}
            const command=QUICK_TEXTS.includes(text.trim())?{text:quickSummary(text.trim(),commandData,origin)}:localCommand(text,commandData,localDate(),{history:commandHistory});
            if(!connected&&command&&!command.needsPlanner)throw new NeedConnect();
            if(command&&!(command.needsPlanner&&(options.geminiReady??geminiConfig().configured))) {
              if(command.data&&command.entry){const stableId='line-'+createHash('sha256').update(account.uid+':'+(event.webhookEventId??event.message.id??event.replyToken)).digest('hex').slice(0,40),collection=command.kind==='finance'?'transactions':command.kind==='task'?'tasks':command.kind==='event'?'events':command.kind==='note'?'notes':null;
                if(collection){const oldId=command.entry.id;if(!commandData[collection]?.some(t=>t.id===oldId)){if(commandData[collection]?.some(t=>t.id===stableId)){command.data=null;command.text='รายการนี้บันทึกไว้แล้วค่ะ';command.entry=null;command.kind='reply';}else{command.entry.id=stableId;command.data[collection]=command.data[collection].map(t=>t.id===oldId?{...t,id:stableId}:t);}}}}
              if(command.data){validateData(command.data,[...commandData.files,...(account.uploads??[])]);await registry('saveData',account.uid,{accessToken:commandToken,ranges:encodeData(command.data,account.uid),connectionVersion:account.version,expectedRevision:account.revision});}
              if(command.kind==='task'&&command.entry)reply=taskMessage([command.entry],command.text,origin);
              else if(command.kind==='event'&&command.entry)reply=eventMessage(command.entry,command.text,origin);
              else if(command.kind==='finance'&&command.entry)reply=financeMessage(command.entry,command.text,origin);
              else if(!command.data&&/งานค้าง|งานที่ต้องทำ|งานที่ยังไม่เสร็จ|งานที่ค้าง|งานที่เหลือ|มีงาน|to.?do/i.test(text)&&!/เสร็จแล้ว|ทำเสร็จ/.test(text))reply=taskMessage(commandData.tasks.filter(t=>!t.done).slice(0,10),command.text,origin);
              else if(QUICK_TEXTS.includes(text.trim())&&text.startsWith('วันนี้'))reply=todayMessage(commandData,command.text,origin);
              else if(QUICK_TEXTS.includes(text.trim())||command.source==='local')reply=summaryMessage(text.includes('ไฟล์')?'คลังไฟล์ของคุณ':/การเงิน|รายรับ|รายจ่าย/.test(text)?'สรุปการเงิน':'สรุปให้แล้วค่ะ',command.text,origin,text.includes('ไฟล์')?'files':/การเงิน|รายรับ|รายจ่าย/.test(text)?'finance':'calendar');
              else reply=command.text;
              const compact=conversationHistory([...commandHistory,{role:'user',text},{role:'assistant',text:command.text}]).map(m=>({role:m.role==='model'?'assistant':'user',text:m.parts[0].text}));
              const encrypted=options.encryptHistory?options.encryptHistory(compact):env('TOKEN_ENCRYPTION_KEY')?encryptSecret(JSON.stringify(compact),account.uid,env('TOKEN_ENCRYPTION_KEY')):null;
              if(encrypted)afterReply.push(()=>registry('chatHistory',account.uid,{encryptedHistory:encrypted,connectionVersion:account.version}));
            } else if(options.geminiReady??geminiConfig().configured) {
              showLoading(fetchImpl,channelToken,lineId);
              await registry('aiQuota',account.uid);const data=commandData;
              let history=[];
              if(account.chatHistory){try{history=JSON.parse(decryptSecret(account.chatHistory,account.uid,env('TOKEN_ENCRYPTION_KEY')));}catch{}}
              const context={today:localDate(),events:data.events.filter(e=>e.date===localDate()).map(({title,time})=>({title,time})),tasks:data.tasks.filter(t=>!t.done).map(t=>t.title+' | กำหนด '+(t.date||'ยังไม่ระบุ')+' | หมวด '+t.category)};
              const answer=options.generateReply?await options.generateReply({message:text,context,history}):await (options.generatePlan??generateIntentPlan)({message:text,history});
              if(!connected&&answer.action)throw new NeedConnect();
              reply=answer.action?(proposalMessage(answer.action,origin)??'รายการนี้ยาวเกินจะยืนยันในไลน์ค่ะ เปิดแอปเพื่อบันทึกได้เลยนะคะ'):answer.text;
              const replyText=typeof reply==='string'?reply:reply.altText;
              const compact=conversationHistory([...history,{role:'user',text},{role:'assistant',text:replyText}]).map(m=>({role:m.role==='model'?'assistant':'user',text:m.parts[0].text}));
              const encrypted=options.encryptHistory?options.encryptHistory(compact):encryptSecret(JSON.stringify(compact),account.uid,env('TOKEN_ENCRYPTION_KEY'));
              // บันทึกประวัติหลังส่งคำตอบ ผู้ใช้ไม่ต้องรอขั้นนี้
              if(encrypted)afterReply.push(()=>registry('chatHistory',account.uid,{encryptedHistory:encrypted,connectionVersion:account.version}));
            } else {
              reply=`ฉันคุยเรื่องทั่วไปได้ค่ะ 🌼 ตอนนี้รอเจ้าของระบบใส่ Gemini API key ก่อนนะคะ\nเปิดปฏิทินหรือฝากงานได้ที่ ${origin}/api/line/start`;
            }
          } else if(['file','image'].includes(event.message?.type)) {
            if(account.connection?.status!=='ready')throw new NeedConnect();
            const old=await options.accountData(account,origin),id=`line-${event.message.id}`;
            if(old.data.files.some(f=>f.id===id))reply='ไฟล์นี้อยู่ในคลังของคุณแล้วค่ะ';
            else {
              const media=await fetchImpl(`https://api-data.line.me/v2/bot/message/${encodeURIComponent(event.message.id)}/content`,{headers:{Authorization:`Bearer ${channelToken}`}});
              if(!media.ok)throw new Error('อ่านไฟล์ไม่สำเร็จ');
              const mimeType=media.headers.get('content-type')??'application/octet-stream';
              const name=(event.message.fileName??`LINE-${localDate()}-${event.message.id}.${mimeType.includes('png')?'png':'jpg'}`).slice(0,200);
              const {driveId,size}=await uploadDriveStream(account,old.token,{id,name,mimeType},media);
              const latest=await registry('get',account.uid);
              if(latest.version!==account.version)throw new Error('พื้นที่เก็บข้อมูลเปลี่ยนแล้ว');
              const current=await options.accountData(latest,origin);
              if(!current.data.files.some(f=>f.id===id)) {
                current.data.files.push({id,ownerId:account.uid,name,size,mimeType,driveId,eventId:'',createdAt:new Date().toISOString()});
                await registry('saveData',account.uid,{accessToken:current.token,ranges:encodeData(current.data,account.uid),connectionVersion:account.version,expectedRevision:latest.revision});
              }
              reply=fileMessage({id,name,mimeType},origin);
            }
          } else reply='ส่งข้อความคุยกันได้เลยค่ะ หรือส่งไฟล์/รูปที่อยากเก็บไว้ 🌼';
        }
      }
    } catch(error) {
      if(error instanceof NeedConnect)reply=connectReply(origin,linkUid);
      else reply=error.status===429?'เดซี่รับข้อความครบโควตาชั่วคราวแล้วค่ะ ลองอีกครั้งภายหลังนะคะ':'ยังทำรายการไม่สำเร็จค่ะ เจ้าของระบบอาจยังตั้งค่าพื้นที่เก็บข้อมูลหรือ Gemini ไม่ครบ กรุณาลองใหม่ภายหลัง';
    }
    await fetchImpl('https://api.line.me/v2/bot/message/reply',{method:'POST',headers:{Authorization:`Bearer ${channelToken}`,'Content-Type':'application/json'},body:JSON.stringify({replyToken:event.replyToken,messages:[typeof reply==='string'?{type:'text',text:reply.slice(0,4900)}:reply]})});
    for(const task of afterReply.splice(0))await task().catch(()=>{});
  }
  return json({ok:true});
}

// จุดสามจุดกำลังพิมพ์ใน LINE ระหว่างรอ Gemini ไม่ต้องรอผล
function showLoading(fetchImpl,token,chatId){
  fetchImpl('https://api.line.me/v2/bot/chat/loading/start',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({chatId,loadingSeconds:20})}).catch(()=>{});
}

// ลิงก์เว็บแสดงเฉพาะเมื่อตั้ง LINE Login แล้ว ไม่งั้นเปิดไม่ได้
const webLink=(origin,label)=>env('LINE_LOGIN_CHANNEL_ID')?`\n${label}: ${origin}/api/line/start`:'';
export const QUICK_TEXTS=['วันนี้มีนัดและงานอะไรบ้าง','งานที่ยังไม่เสร็จมีอะไรบ้าง','ปฏิทิน 7 วันข้างหน้ามีอะไรบ้าง','ไฟล์ของฉันมีอะไรบ้าง'];
const sizeText=n=>n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(0)} KB`:`${(n/1048576).toFixed(1)} MB`;

export function quickSummary(text,data,origin) {
  const today=localDate();
  if(text.startsWith('วันนี้')) {
    const events=data.events.filter(e=>e.date===today&&e.status!=='cancelled').sort((a,b)=>(a.time??'').localeCompare(b.time??''));
    const tasks=data.tasks.filter(t=>!t.done&&t.date===today);
    if(!events.length&&!tasks.length)return `วันนี้ยังว่างอยู่เลยค่ะ 🌼${webLink(origin,'เพิ่มนัดได้ที่')}`;
    return ['☀️ วันนี้ของคุณ',...events.map(e=>`• ${e.allDay?'ทั้งวัน':e.time+' น.'} ${e.title}`),...tasks.map(t=>`☐ ${t.title}`),webLink(origin,'ดูทั้งหมด')].filter(Boolean).join('\n');
  }
  if(text.startsWith('ปฏิทิน')) {
    const lines=[];
    for(let i=0;i<7;i++){
      const date=dateAdd(today,i),events=data.events.filter(e=>e.status!=='cancelled'&&occursOn(e,date)).sort((a,b)=>(a.time??'').localeCompare(b.time??''));
      if(events.length)lines.push(`📅 ${thaiDate(date,{weekday:'short',month:'short'})}`,...events.map(e=>`  • ${e.allDay?'ทั้งวัน':e.time+' น.'} ${e.title}`));
    }
    return lines.length?['🗓️ 7 วันข้างหน้า',...lines,webLink(origin,'เปิดปฏิทิน')].filter(Boolean).join('\n'):`7 วันข้างหน้ายังว่างอยู่เลยค่ะ 🌼${webLink(origin,'เพิ่มนัดได้ที่')}`;
  }
  if(text.startsWith('ไฟล์')) {
    const files=[...data.files].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    if(!files.length)return 'ยังไม่มีไฟล์ในคลังเลยค่ะ ส่งรูปหรือไฟล์ในแชตนี้ได้เลย เดซี่จะเก็บไว้ให้ 🌼';
    return [`🗂️ คลังไฟล์ ${files.length} ไฟล์`,...files.slice(0,10).map(f=>`• ${f.name} (${sizeText(f.size)})`),files.length>10?`…และอีก ${files.length-10} ไฟล์`:'',webLink(origin,'ดูคลังไฟล์')].filter(Boolean).join('\n');
  }
  const tasks=data.tasks.filter(t=>!t.done).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
  if(!tasks.length)return 'ไม่มีงานค้างเลยค่ะ เก่งมาก 🌼';
  return [`✅ งานค้าง ${tasks.length} รายการ`,...tasks.slice(0,15).map(t=>`☐ ${t.title}${t.date?` (${t.date<today?'เลยกำหนด ':''}${t.date})`:''}`),tasks.length>15?`…และอีก ${tasks.length-15} รายการ`:'',webLink(origin,'จัดการงาน')].filter(Boolean).join('\n');
}

