import {answerLocalQuery} from './local-query.mjs';
import {localDate,parseQuickEvent,dateAdd,thaiDate,CATEGORIES} from './model.mjs';
import {parseFinanceCommand,financeSummary,money,validateTransaction} from './finance.mjs';
export const requiresReasoning=text=>/ช่วยคิด|วิเคราะห์|จัดลำดับ|วางแผน|แนะนำ|เปรียบเทียบ|ควรทำอะไรก่อน/.test(text);
const financeReply=text=>/^(?:(?:วันนี้|เมื่อวาน|พรุ่งนี้)|(?:[๐-๙\d][๐-๙\d,.]*\s*(?:บาท)?(?:ไง|ค่ะ|ครับ|คะ)?)|(?:(?:ช่วย)?(?:บันทึก|เพิ่ม)(?:ให้)?(?:เลย|ได้เลย|หน่อย|ให้เลย)?(?:ค่ะ|ครับ|คะ)?))$/.test(text.replace(/\s/g,''));
const sameTransaction=(items,draft)=>items.find(t=>t.amount===draft.amount&&t.date===draft.date&&t.title===draft.title&&t.type===draft.type);
const placeholderTitle=text=>/[\[<【](?:เรื่องที่คุย|ชื่องาน|ชื่อรายการ|ชื่อนัด|หัวข้อ|เรื่อง|title|task|topic)[\]>】]/i.test(text);
export function localCommand(message,data,today=localDate(),options={}){
 const text=message.trim();if(requiresReasoning(text))return null;
 if(financeReply(text)){
  const humans=(options.history??[]).filter(m=>m.role==='user'&&typeof m.text==='string').slice(-8);
  let base=-1;for(let i=humans.length-1;i>=0;i--){if(financeReply(humans[i].text))continue;if(parseFinanceCommand(humans[i].text,today)){base=i;break;}break;}
  if(base>=0){
   const fragments=[...humans.slice(base+1).map(m=>m.text),text].filter(t=>financeReply(t)&&!/บันทึก|เพิ่ม/.test(t));
   const latestDate=[...fragments].reverse().find(t=>/วันนี้|เมื่อวาน|พรุ่งนี้/.test(t));
   const source=humans[base].text.replace(latestDate?/วันนี้|เมื่อวาน|พรุ่งนี้/g:/$^/g,'');
   const draft=parseFinanceCommand([source,...fragments].join(' '),today);
   if(draft?.error)return {text:draft.error,needsPlanner:true};
   if(draft){const existing=sameTransaction(data.transactions??[],draft);if(existing)return {text:`รายการ “${existing.title}” ${money(existing.amount)} บันทึกไว้แล้วค่ะ`,entry:existing,kind:'finance'};return applyAssistantAction({name:'add_transaction',arguments:draft},data,today);}
  }
 }
 if(/^(?:ช่วย)?(?:บันทึก|เพิ่ม)(?:ให้)?(?:เลย|ได้เลย|หน่อย|ให้เลย)?(?:ค่ะ|ครับ|คะ)?$/.test(text.replace(/\s/g,''))){
  const previous=[...(options.history??[])].reverse().find(m=>m.role==='user'&&!/^(?:ช่วย)?(?:บันทึก|เพิ่ม)(?:ให้)?(?:เลย|ได้เลย|หน่อย)?$/.test(m.text?.replace(/\s/g,'')??''));
  const draft=previous&&!requiresReasoning(previous.text)?parseFinanceCommand(previous.text,today):null;
  if(!draft||draft.error)return {text:'ต้องการบันทึกเรื่องไหนคะ',needsPlanner:true};
  const existing=(data.transactions??[]).find(t=>t.amount===draft.amount&&t.date===draft.date&&t.title===draft.title&&t.type===draft.type);
  if(existing)return {text:`รายการ “${existing.title}” ${money(existing.amount)} บันทึกไว้แล้วค่ะ`,entry:existing,kind:'finance'};
  return localCommand(previous.text,data,today);
 }
 const id=()=>crypto.randomUUID();
 const finance=parseFinanceCommand(text,today);
 if(finance&&!finance.error){
  const existing=sameTransaction(data.transactions??[],finance);
  const recentHuman=(options.history??[]).filter(m=>m.role==='user'&&typeof m.text==='string').slice(-8);
  if(existing&&recentHuman.some(m=>{const draft=parseFinanceCommand(m.text,today);return draft&&!draft.error&&sameTransaction([finance],draft);}))return {text:`รายการ “${existing.title}” ${money(existing.amount)} บันทึกไว้แล้วค่ะ`,entry:existing,kind:'finance'};
 }
 if((!finance||finance.error)&&! /^(?:ช่วย)?(?:บันทึก|จ่าย|ซื้อ|รับเงิน|เงินเข้า|ได้เงิน)/.test(text)&&/(?:รายรับ|รายจ่าย|ใช้เงิน|ใช้จ่าย|จ่ายเงิน|คงเหลือ|การเงิน).*(?:เท่าไหร่|เท่าไร|บ้าง|วันนี้|เดือนนี้)|^(?:สรุปการเงิน|รายรับเดือนนี้|รายจ่ายเดือนนี้)/.test(text)){
  const items=(data.transactions??[]).filter(t=>!text.includes('วันนี้')||t.date===today),summary=financeSummary(items,today.slice(0,7));
  return {text:`${text.includes('วันนี้')?'วันนี้':'เดือนนี้'} รับ ${money(summary.income)} · จ่าย ${money(summary.expense)}\nยอดสุทธิ ${money(summary.net)}\n${summary.count} รายการ (ไม่รวมโอนระหว่างบัญชีในยอดสุทธิ)`,source:'local'};
 }
 if(finance){if(finance.error)return {text:finance.error,needsPlanner:true};if(placeholderTitle(finance.title))return {text:'รายการนี้ชื่ออะไรคะ',needsPlanner:true};const entry=validateTransaction({...finance,id:id(),createdAt:new Date().toISOString(),source:'chat'});return {data:{...data,transactions:[...(data.transactions??[]),entry]},text:`บันทึก${entry.type==='income'?'รายรับ':entry.type==='transfer'?'โอนระหว่างบัญชี':'รายจ่าย'} “${entry.title}” ${money(entry.amount)} วันที่ ${thaiDate(entry.date)} แล้วค่ะ`,entry,kind:'finance'};}
 if(/^(?:ช่วย)?(?:เพิ่มงาน|บันทึกงาน|เพิ่ม\s*to.?do)/i.test(text)){
  const raw=text.replace(/^(?:ช่วย)?(?:เพิ่มงาน|บันทึกงาน|เพิ่ม\s*to.?do)\s*/i,''),parsed=parseQuickEvent(raw,today),title=parsed.title.replace(/\d{4}-\d{2}-\d{2}|พรุ่งนี้|วันนี้|มะรืน(?:นี้)?/g,'').trim();
  if(!raw||!title||placeholderTitle(title))return {text:'งานนี้ชื่ออะไรคะ',needsPlanner:true};
  const entry={id:id(),title,date:parsed.date,done:false,category:parsed.category};return {data:{...data,tasks:[...(data.tasks??[]),entry]},text:`เพิ่มงาน “${title}” วันที่ ${thaiDate(entry.date)} แล้วค่ะ`,entry,kind:'task'};
 }
 if(/^(?:ทำเสร็จ|เสร็จแล้ว|งานเสร็จ)\s*/.test(text)){
  const name=text.replace(/^(?:ทำเสร็จ|เสร็จแล้ว|งานเสร็จ)\s*/,''),found=(data.tasks??[]).filter(t=>name&&t.title.includes(name)&&!t.done);
  if(found.length!==1)return {text:found.length?'พบงานมากกว่าหนึ่งรายการค่ะ เลือกจากรายการงานหรือพิมพ์ชื่อเต็มนะคะ':'หมายถึงงานไหนคะ',needsPlanner:true};
  const entry={...found[0],done:true};return {data:{...data,tasks:data.tasks.map(t=>t.id===entry.id?entry:t)},text:`ติ๊ก “${entry.title}” ว่าทำเสร็จแล้วค่ะ ✓`,entry,kind:'task'};
 }
 if(/^(?:จดโน้ต|บันทึกโน้ต|จำไว้ว่า)\s*/.test(text)){
  const content=text.replace(/^(?:จดโน้ต|บันทึกโน้ต|จำไว้ว่า)\s*/, '');if(!content)return {text:'พิมพ์ข้อความที่อยากจดต่อท้ายได้เลยค่ะ'};
  const entry={id:id(),title:content.slice(0,80),content,color:'sunny',updatedAt:new Date().toISOString()};return {data:{...data,notes:[...(data.notes??[]),entry]},text:'จดโน้ตให้แล้วค่ะ',entry,kind:'note'};
 }
 if(/^(?:ช่วย)?(?:เพิ่มนัด|บันทึกนัด|เตือน)/.test(text)){
  const parsed=parseQuickEvent(text.replace(/^(?:ช่วย)?(?:เพิ่มนัด|บันทึกนัด)\s*/,''),today);
  const eventTitle=parsed.title.replace(/\d{4}-\d{2}-\d{2}/g,'').replace(/(?:เวลา\s*)?\d{1,2}[:.]\d{2}\s*(?:น\.|นาฬิกา)?/g,'').trim();
  if(!eventTitle||placeholderTitle(eventTitle))return {text:'นัดเรื่องอะไรคะ',needsPlanner:true};
  if(!/\d{4}-\d{2}-\d{2}|วันนี้|พรุ่งนี้|มะรืน|วัน(?:จันทร์|อังคาร|พุธ|พฤหัส|ศุกร์|เสาร์|อาทิตย์)/.test(text))return {text:'นัดนี้วันไหนคะ',needsPlanner:true};
  if(!parsed.time)return {text:'นัดนี้เริ่มเวลาไหนคะ',needsPlanner:true};
  if(+parsed.time.slice(0,2)===23)return {text:'นัดที่ข้ามเที่ยงคืนให้เลือกวันและเวลาสิ้นสุดในปฏิทินนะคะ'};
  const entry={...parsed,id:id(),title:eventTitle,endTime:`${String(+parsed.time.slice(0,2)+1).padStart(2,'0')}:${parsed.time.slice(3)}`,status:'active',repeat:'none',reminders:[30],channels:['line'],note:'',fileIds:[],updatedAt:new Date().toISOString()};
  return {data:{...data,events:[...(data.events??[]),entry]},text:`เพิ่มนัด “${entry.title}” ${thaiDate(entry.date)} ${entry.time} น. แล้วค่ะ`,entry,kind:'event'};
 }
 const query=answerLocalQuery(text,data,today);if(query)return query;
 if(/^(?:เพิ่ม|แก้ไข|แก้|ลบ|ยกเลิก|เลื่อน|ค้นหา|ค้น|ดู|แสดง|บันทึก).*(?:งาน|นัด|เตือน|ไฟล์|โน้ต|รายรับ|รายจ่าย)/.test(text))return {text:'ต้องการจัดการรายการไหนคะ',needsPlanner:true};
 return null;
}

// Model plans can request these bounded local writes only. Construct every
// record here rather than spreading model arguments into application state.
export function applyAssistantAction(action,data,today=localDate()){
 const args=action?.arguments;
 if(!args||typeof args!=='object'||Array.isArray(args))throw new Error('ข้อมูลคำสั่งไม่ถูกต้อง');
 const requiredText=(value,max=200)=>{if(typeof value!=='string'||!value.trim()||value.length>max||placeholderTitle(value))throw new Error('กรุณาระบุข้อความให้ครบถ้วน');return value.trim();};
 const note=()=>{if(args.note===undefined)return '';if(typeof args.note!=='string'||args.note.length>1000)throw new Error('บันทึกไม่ถูกต้อง');return args.note;};
 const validDate=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('กรุณาระบุวันที่');const d=new Date(`${value}T12:00Z`);if(Number.isNaN(+d)||d.toISOString().slice(0,10)!==value)throw new Error('วันที่ไม่ถูกต้อง');return value;};
 const category=()=>{if(args.category!==undefined&&!CATEGORIES.some(c=>c.id===args.category))throw new Error('หมวดหมู่ไม่ถูกต้อง');return args.category??'work';};
 const id=()=>crypto.randomUUID(),now=new Date().toISOString();
 let entry,kind,key,text;
 switch(action.name){
  case 'add_transaction':
   entry=validateTransaction({id:id(),type:args.type,amount:args.amount,title:requiredText(args.title),date:validDate(args.date),category:args.category,note:note(),createdAt:now,source:'chat'});
   {const existing=sameTransaction(data.transactions??[],entry);if(existing)return {text:`รายการ “${existing.title}” ${money(existing.amount)} บันทึกไว้แล้วค่ะ`,entry:existing,kind:'finance'};}
   kind='finance';key='transactions';text=`บันทึก${entry.type==='income'?'รายรับ':entry.type==='transfer'?'โอนระหว่างบัญชี':'รายจ่าย'} “${entry.title}” ${money(entry.amount)} วันที่ ${thaiDate(entry.date)} แล้วค่ะ`;break;
  case 'add_task':
   entry={id:id(),title:requiredText(args.title),date:validDate(args.date),category:category(),done:false};kind='task';key='tasks';text=`เพิ่มงาน “${entry.title}” วันที่ ${thaiDate(entry.date)} แล้วค่ะ`;break;
  case 'complete_task':{
   const matches=(data.tasks??[]).filter(t=>typeof args.id==='string'&&t.id===args.id);if(matches.length!==1)throw new Error('กรุณาระบุงานที่ต้องการให้ชัดเจน');
   entry={...matches[0],done:true};return {data:{...data,tasks:data.tasks.map(t=>t.id===entry.id?entry:t)},text:`ติ๊ก “${entry.title}” ว่าทำเสร็จแล้วค่ะ ✓`,entry,kind:'task'};
  }
  case 'add_event':
   if(args.allDay||!args.time){entry={id:id(),title:requiredText(args.title),date:validDate(args.date),allDay:true,time:'09:00',endTime:'10:00',category:category(),status:'active',repeat:'none',reminders:[30],channels:['line'],note:note(),location:typeof args.location==='string'?args.location.slice(0,200):'',fileIds:[],updatedAt:now};kind='event';key='events';text=`เพิ่มนัด “${entry.title}” ${thaiDate(entry.date)} (ทั้งวัน) แล้วค่ะ`;break;}
   if(!args.endTime&&/^dd:dd$/.test(args.time??''))args.endTime=`${String(Math.min(23,+args.time.slice(0,2)+1)).padStart(2,'0')}:${args.time.slice(3)}`;
   if(![args.time,args.endTime].every(v=>typeof v==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v))||args.endTime<=args.time)throw new Error('กรุณาระบุเวลาเริ่มและสิ้นสุดให้ถูกต้อง');
   entry={id:id(),title:requiredText(args.title),date:validDate(args.date),time:args.time,endTime:args.endTime,category:category(),status:'active',repeat:'none',reminders:[30],channels:['line'],note:note(),fileIds:[],updatedAt:now};kind='event';key='events';text=`เพิ่มนัด “${entry.title}” ${thaiDate(entry.date)} ${entry.time} น. แล้วค่ะ`;break;
  case 'add_note':
   entry={id:id(),content:requiredText(args.content,10000),title:args.title===undefined?args.content.trim().slice(0,80):requiredText(args.title,80),color:'sunny',updatedAt:now};kind='note';key='notes';text='จดโน้ตให้แล้วค่ะ';break;
  default:throw new Error('คำสั่งนี้ไม่รองรับ');
 }
 return {data:{...data,[key]:[...(data[key]??[]),entry]},text,entry,kind};
}
