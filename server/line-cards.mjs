import {localDate,thaiDate,occursOn} from '../src/model.mjs';
import {money} from '../src/finance.mjs';

const colors={ink:'#40364F',muted:'#82778B',lavender:'#EEE7F8',cream:'#FFFCF4',accent:'#9577B8'};
const text=(value,extra={})=>({type:'text',text:String(value||'—').slice(0,2000),wrap:true,size:'sm',color:colors.ink,...extra});
const open=(origin,page,label='เปิดในแอป',query='')=>({type:'button',height:'sm',action:{type:'uri',label,uri:`${origin}/?page=${page}${query}`}});
const done=(action,id)=>({type:'button',style:'primary',height:'sm',color:colors.accent,action:{type:'postback',label:'✓ ทำเสร็จแล้ว',data:JSON.stringify({action,id})}});
function bubble({origin,label,title,date,lines=[],buttons=[]}){
 return {type:'bubble',size:'mega',header:{type:'box',layout:'horizontal',spacing:'md',alignItems:'center',backgroundColor:colors.lavender,paddingAll:'16px',contents:[{type:'image',url:`${origin}/dayzi-card-mascot.png`,size:'48px',aspectRatio:'1:1',aspectMode:'fit',flex:0},{type:'box',layout:'vertical',spacing:'xs',contents:[text('Dayzi',{weight:'bold',size:'lg'}),text(label,{size:'xs',color:colors.muted})]}]},body:{type:'box',layout:'vertical',backgroundColor:colors.cream,paddingAll:'20px',spacing:'md',contents:[text(title,{size:'xl',weight:'bold'}),...(date?[text(date,{size:'xs',color:colors.muted})]:[]),...lines.map(line=>text(line))]},...(buttons.length?{footer:{type:'box',layout:'vertical',backgroundColor:colors.cream,paddingAll:'16px',spacing:'sm',contents:buttons}}:{})};
}
function message(summary,bubbles){return {type:'flex',altText:String(summary||'Dayzi 🌼').slice(0,400),contents:bubbles.length===1?bubbles[0]:{type:'carousel',contents:bubbles.slice(0,10)}};}
export function taskMessage(tasks,summary,origin){
 if(!tasks.length)return summaryMessage('งานเรียบร้อยแล้ว',summary,origin,'tasks');
 return message(summary,tasks.slice(0,10).map(task=>bubble({origin,label:task.done?'งานเสร็จแล้ว':'งานที่ต้องทำ',title:task.title,date:task.date?thaiDate(task.date):'ยังไม่มีกำหนด',lines:[task.done?'เรียบร้อยแล้วค่ะ ✓':'เดซี่จดไว้ให้แล้วค่ะ 🌼'],buttons:[...(task.done?[]:[done('task-done',task.id)]),open(origin,'tasks')]})));
}
export function eventMessage(event,summary,origin,{reminder=false,date=event.date,fileCount=0}={}){
 return message(summary,[bubble({origin,label:reminder?'ถึงเวลาเตือนแล้วค่ะ':'บันทึกนัดหมายแล้ว',title:event.title,date:`${thaiDate(date)} · ${event.allDay?'ทั้งวัน':`${event.time} น.`}`,lines:[...(event.location?[`สถานที่: ${event.location}`]:[]),...(reminder?['เตรียมตัวสำหรับนัดนี้ได้เลยค่ะ 🌼']:['เดซี่เก็บนัดนี้ในปฏิทินให้แล้วค่ะ 🌼']),...(fileCount?[`เอกสารแนบ ${fileCount} ไฟล์`]:[])],buttons:[...(event.status==='active'&&(!event.repeat||event.repeat==='none')?[done('event-done',event.id)]:[]),open(origin,'calendar','เปิดนัดหมาย',`&event=${encodeURIComponent(event.id)}`)]})]);
}
export function financeMessage(entry,summary,origin){
 return message(summary,[bubble({origin,label:'บันทึกการเงินแล้ว',title:entry.title,date:thaiDate(entry.date),lines:[`${entry.type==='income'?'รายรับ':entry.type==='transfer'?'โอนระหว่างบัญชี':'รายจ่าย'} · ${money(entry.amount)}`,entry.category?`หมวด: ${entry.category}`:'บันทึกในสมุดการเงินแล้วค่ะ 🌼'],buttons:[open(origin,'finance','ดูสมุดการเงิน')]})]);
}
export function fileMessage(file,origin){
 const summary=`เก็บไฟล์ “${file.name}” แล้วค่ะ 🌼`;
 return message(summary,[bubble({origin,label:'คลังไฟล์ของคุณ',title:'เก็บไฟล์ให้แล้วค่ะ',lines:[file.name,'เปิดแอปเพื่อดูและดาวน์โหลดไฟล์ได้เลย 🌼'],buttons:[open(origin,'files','เปิดคลังไฟล์'),...(file.mimeType?.startsWith('image/')?[open(origin,'finance','อ่านเป็นใบเสร็จ',`&receipt=${encodeURIComponent(file.id)}`)]:[])]})]);
}
export function summaryMessage(title,summary,origin,page='calendar'){
 // Keep each text node within LINE limits even when a local query returns many items.
 const lines=String(summary).split('\n').filter(Boolean).slice(0,22);
 return message(summary,[bubble({origin,label:'ผู้ช่วยส่วนตัวของคุณ',title,date:thaiDate(localDate()),lines,buttons:[open(origin,page,'ดูทั้งหมดในแอป')]})]);
}
export function todayMessage(data,summary,origin,date=localDate()){
 const events=(data.events??[]).filter(e=>e.status!=='cancelled'&&occursOn(e,date)).sort((a,b)=>(a.time??'').localeCompare(b.time??''));
 const tasks=(data.tasks??[]).filter(t=>!t.done&&t.date===date);
 return message(summary,[bubble({origin,label:'เริ่มวันไปด้วยกัน',title:'วันนี้ของคุณ',date:thaiDate(date),lines:[`นัดหมาย ${events.length} · งานวันนี้ ${tasks.length}`,...(events.length?events.slice(0,7).map(e=>`${e.allDay?'ทั้งวัน':`${e.time} น.`} · ${e.title}${e.status==='done'?' ✓':''}`):['ยังไม่มีนัดหมายค่ะ']),...tasks.slice(0,7).map(t=>`☐ ${t.title}`),...(events.length>7||tasks.length>7?['ดูรายการที่เหลือในแอปได้เลยค่ะ']:[]),...(!events.length&&!tasks.length?['วันนี้ยังว่างอยู่เลยค่ะ 🌼']:[])],buttons:[open(origin,'calendar','เปิดปฏิทิน'),open(origin,'tasks','ดูงานทั้งหมด')]})]);
}
// Asks a new friend to connect their own storage. With Google sign-in configured it links straight to Google;
// otherwise it opens the web settings, where they log in with LINE and paste their Sheet and Drive links.
export function connectMessage(origin,token,{welcome=false,viaWeb=false}={}){
 const lines=viaWeb?['เดซี่จะเก็บนัด งาน และไฟล์ไว้ใน Google Sheet และ Drive ของคุณเอง ไม่ปนกับของคนอื่น','กดปุ่มด้านล่าง เข้าสู่ระบบด้วย LINE แล้ววางลิงก์ Sheet และโฟลเดอร์ Drive 2 อันก็เสร็จ','ระหว่างนี้ยังคุยทั่วไปกับเดซี่ได้ตามปกติ 🌼']:['เดซี่จะเก็บนัด งาน และไฟล์ไว้ใน Google Drive และ Sheets ของคุณเอง ไม่ปนกับของคนอื่น','กดปุ่มด้านล่าง เลือกบัญชี Google แล้วกดอนุญาตครั้งเดียว','ระหว่างนี้ยังคุยทั่วไปกับเดซี่ได้ตามปกติ 🌼'];
 const button=viaWeb?{type:'uri',label:'เชื่อมพื้นที่ของฉัน',uri:`${origin}/?page=settings`}:{type:'uri',label:'เชื่อม Google ของฉัน',uri:`${origin}/api/google/start?link=${encodeURIComponent(token)}`};
 return message('เชื่อมพื้นที่เก็บข้อมูลของคุณก่อนเริ่มใช้งาน',[bubble({origin,label:welcome?'ยินดีต้อนรับค่ะ':'ต้องเชื่อมก่อนนะคะ',title:'เชื่อมพื้นที่ของคุณ',lines,buttons:[{type:'button',style:'primary',height:'sm',color:colors.accent,action:button}]})]);
}
export function noteMessage(note,summary,origin){
 return message(summary,[bubble({origin,label:'โน้ตของคุณ',title:note.title||'โน้ต',lines:[String(note.content).slice(0,300)],buttons:[open(origin,'notes','เปิดโน้ต')]})]);
}
// Confirmation card for an action Gemini proposed; the action rides in the postback so nothing is stored until tapped.
export function proposalMessage(action,origin){
 const a=action.arguments,label={add_event:'ยืนยันนัดหมาย',add_task:'ยืนยันงานที่ต้องทำ',add_transaction:'ยืนยันรายการเงิน',add_note:'ยืนยันโน้ต'}[action.name]??'ยืนยันรายการ';
 const data=JSON.stringify({a:'ok',n:action.name,g:a});
 if(data.length>300)return null;
 const lines=[...(a.date?[`📅 ${thaiDate(a.date)}`]:[]),...(action.name==='add_event'?[`🕒 ${a.allDay||!a.time?'ทั้งวัน':`${a.time}${a.endTime?`–${a.endTime}`:''} น.`}`]:[]),...(a.location?[`📍 ${a.location}`]:[]),...(action.name==='add_transaction'?[`${a.type==='income'?'รายรับ':a.type==='transfer'?'โอน':'รายจ่าย'} ${money(a.amount)}`]:[]),...(action.name==='add_note'?[String(a.content).slice(0,200)]:[])];
 return message(`${label}: ${a.title??'โน้ต'}`,[bubble({origin,label:'ให้เดซี่บันทึกแบบนี้ไหมคะ',title:a.title??'โน้ตใหม่',lines,buttons:[{type:'button',style:'primary',height:'sm',color:colors.accent,action:{type:'postback',label:'✓ ยืนยันบันทึก',data,displayText:'ยืนยันบันทึก'}},{type:'button',style:'secondary',height:'sm',action:{type:'postback',label:'ยกเลิก',data:JSON.stringify({a:'cancel'}),displayText:'ยกเลิก'}}]})]);
}
