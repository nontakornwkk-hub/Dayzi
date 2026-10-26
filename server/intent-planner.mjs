import {geminiConfig,conversationHistory,DEFAULT_GEMINI_MODEL} from './assistant.mjs';
import {withGeminiKey} from './gemini-keys.mjs';

const FINANCE_CATEGORIES=['food','transport','shopping','home','utilities','health','subscription','education','entertainment','salary','freelance','bonus','gift','invest','refund','income_other','transfer','other'];
const EVENT_CATEGORIES=['work','personal','meeting','important'];
const date={type:'string',description:'วันที่รูปแบบ YYYY-MM-DD'},time={type:'string',description:'เวลา HH:MM แบบ 24 ชั่วโมง'};
const fn=(name,description,properties,required)=>({type:'function',name,description,parameters:{type:'object',properties,required,additionalProperties:false}});
export const INTENT_TOOLS=[
 fn('add_transaction','บันทึกรายรับ รายจ่าย หรือโอนเงิน',{type:{type:'string',enum:['income','expense','transfer']},amount:{type:'integer',description:'จำนวนเงินเป็นสตางค์ (บาท x 100)'},title:{type:'string'},date,category:{type:'string',enum:FINANCE_CATEGORIES},note:{type:'string'}},['type','amount','title','date']),
 fn('add_task','เพิ่มงานที่ต้องทำ (to-do)',{title:{type:'string'},date,category:{type:'string',enum:EVENT_CATEGORIES}},['title','date']),
 fn('add_event','เพิ่มนัดหมายในปฏิทิน ถ้าไม่ระบุเวลาให้ใช้ allDay=true',{title:{type:'string'},date,time,endTime:time,allDay:{type:'boolean'},category:{type:'string',enum:EVENT_CATEGORIES},location:{type:'string'},note:{type:'string'}},['title','date']),
 fn('add_note','จดโน้ต',{content:{type:'string'},title:{type:'string'}},['content']),
];

const bangkokDate=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok'}).format(now);
const weekday=now=>new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',weekday:'long'}).format(now);

// Only the conversation and the server's own date reach the model; stored records never do.
export function buildIntentRequest({message,history=[]},model=DEFAULT_GEMINI_MODEL,now=new Date()){
 if(typeof message!=='string'||!message.trim()||message.length>2000)throw Object.assign(new Error('กรุณาใส่ข้อความไม่เกิน 2,000 ตัวอักษร'),{status:400});
 const today=bangkokDate(now);
 const turns=[...conversationHistory(history),{role:'user',parts:[{text:message.trim()}]}];
 return {model,store:false,tools:INTENT_TOOLS,
  system_instruction:`คุณคือเดซี่ ผู้ช่วยส่วนตัวใน Dayzi วันนี้คือ ${today} (${weekday(now)}) เขตเวลาเอเชีย/กรุงเทพ
เมื่อผู้ใช้ต้องการบันทึกนัด งาน โน้ต หรือรายรับรายจ่าย ให้เรียกฟังก์ชันที่ตรงที่สุดเพียงหนึ่งครั้ง แปลงวันที่แบบพูด เช่น "วันที่ 29" "พรุ่งนี้" "ศุกร์หน้า" เป็น YYYY-MM-DD (ถ้าวันที่ผ่านไปแล้วในเดือนนี้ให้เป็นเดือนถัดไป)
จำนวนเงินต้องเป็นสตางค์ (1 บาท = 100 สตางค์) ใช้ข้อมูลจากบทสนทนาก่อนหน้าได้
ถ้าข้อมูลยังไม่ครบจนเดาไม่ได้ เช่น ไม่รู้จำนวนเงิน ให้ถามกลับสั้น ๆ ห้ามเรียกฟังก์ชัน ระบบจะให้ผู้ใช้กดยืนยันเองก่อนบันทึก จึงห้ามบอกว่าบันทึกแล้ว
ถ้าเป็นการคุยทั่วไปหรือขอคำแนะนำ ให้ตอบเป็นภาษาไทยอบอุ่น กระชับ โดยไม่ต้องเรียกฟังก์ชัน`,
  input:turns.map(m=>({type:m.role==='user'?'user_input':'model_output',content:m.parts.map(p=>({type:'text',text:p.text}))})),
  generation_config:{max_output_tokens:1024,thinking_level:model.includes('flash-lite')?'minimal':'low'}};
}

const isDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&new Date(`${v}T12:00Z`).toISOString().slice(0,10)===v;
const isTime=v=>typeof v==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v);
function checkArgs(tool,args){
 if(!args||typeof args!=='object'||Array.isArray(args))return false;
 const {properties,required}=tool.parameters;
 if(Object.keys(args).some(k=>!properties[k])||required.some(k=>args[k]===undefined))return false;
 return Object.entries(args).every(([k,v])=>{const p=properties[k];
  if(p.type==='integer')return Number.isSafeInteger(v)&&v>0;
  if(p.type==='boolean')return typeof v==='boolean';
  if(typeof v!=='string'||v.length>(k==='content'?10000:k==='note'?1000:200))return false;
  if(p.enum)return p.enum.includes(v);
  if(k==='date')return isDate(v);
  if(k==='time'||k==='endTime')return isTime(v);
  return !!v.trim();});
}

export async function generateIntentPlan(input,{client,config=geminiConfig(),now=new Date()}={}){
 if(!config.configured)throw Object.assign(new Error('ยังไม่ได้ตั้งค่า Gemini API key'),{status:503});
 const request=buildIntentRequest(input,config.model,now);
 let result;
 try{result=await withGeminiKey(ai=>ai.interactions.create(request,{timeout_ms:45000}),{client});}
 catch(e){throw Object.assign(new Error(e.status===429?'Gemini คิวเต็มชั่วคราว ลองใหม่อีกครั้งนะคะ':'เดซี่ยังตอบไม่ได้ชั่วคราว ลองส่งอีกครั้งนะคะ'),{status:e.status===429?429:502});}
 const steps=Array.isArray(result?.steps)?result.steps:Array.isArray(result?.outputs)?result.outputs:[];
 const call=steps.find(s=>s?.type==='function_call');
 if(call){
  const tool=INTENT_TOOLS.find(t=>t.name===call.name);
  const args=typeof call.arguments==='string'?(()=>{try{return JSON.parse(call.arguments);}catch{return null;}})():call.arguments;
  if(!tool||!checkArgs(tool,args))throw Object.assign(new Error('เดซี่อ่านคำสั่งนี้ไม่ออก ลองพิมพ์ใหม่อีกครั้งนะคะ'),{status:502});
  return {action:{name:call.name,arguments:args},provider:'gemini',model:config.model};
 }
 const text=result?.output_text?.trim();
 if(!text)throw Object.assign(new Error('เดซี่ยังตอบไม่ได้ชั่วคราว ลองส่งอีกครั้งนะคะ'),{status:502});
 return {text,provider:'gemini',model:config.model};
}
