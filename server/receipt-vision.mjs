import {geminiConfig} from './assistant.mjs';
import {withGeminiKey} from './gemini-keys.mjs';

const CATEGORIES=['food','transport','shopping','home','utilities','health','subscription','education','entertainment','salary','freelance','bonus','gift','invest','refund','income_other','transfer','other'];
const MAX_BASE64=4_000_000;
const PROMPT=`อ่านสลิปโอนเงินจากธนาคาร/พร้อมเพย์/ทรูวอลเล็ต หรือใบเสร็จร้านค้าในรูปนี้ แล้วตอบเป็น JSON เท่านั้น
- amount: ยอดเงินสุทธิที่จ่ายหรือโอนจริง เป็นตัวเลขหน่วยบาท (ทศนิยมได้) ไม่รวมเงินทอน ถ้าอ่านไม่ได้ให้ null
- date: วันที่ในรูปแบบ YYYY-MM-DD เป็นปี ค.ศ. (แปลงจาก พ.ศ. ถ้าจำเป็น) ถ้าไม่มีให้ null
- title: ชื่อผู้รับเงินหรือชื่อร้าน สั้น ๆ ถ้าไม่มีให้เขียนว่า "รายการจากสลิป"
- documentType: "transfer" ถ้าเป็นสลิปโอนเงิน, "receipt" ถ้าเป็นใบเสร็จ, อื่น ๆ "unknown"
- category: เลือกหนึ่งค่าจาก ${CATEGORIES.join(', ')} ที่เหมาะกับรายจ่ายนี้ที่สุด
- note: ข้อความสั้น ๆ ที่เป็นประโยชน์ เช่น เลขใบเสร็จ ไม่ต้องใส่เลขบัญชี
ห้ามเดาตัวเลขที่ไม่ชัด`;
const schema={type:'object',properties:{amount:{type:'number',nullable:true},date:{type:'string',nullable:true},title:{type:'string'},documentType:{type:'string',enum:['transfer','receipt','unknown']},category:{type:'string',enum:CATEGORIES},note:{type:'string'}},required:['title','documentType','category']};

export function cleanReceipt(raw,today){
 const amount=Number.isFinite(raw?.amount)&&raw.amount>0&&raw.amount<10_000_000?Math.round(raw.amount*100):null;
 const iso=typeof raw?.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(raw.date)&&new Date(`${raw.date}T12:00Z`).toISOString().slice(0,10)===raw.date?raw.date:null;
 return {amount,amountCandidates:amount?[amount]:[],date:iso??today,dateDetected:!!iso,type:null,
  title:String(raw?.title||'รายการจากสลิป').trim().slice(0,200)||'รายการจากสลิป',merchant:'',documentType:['transfer','receipt'].includes(raw?.documentType)?raw.documentType:'unknown',
  category:CATEGORIES.includes(raw?.category)?raw.category:'other',note:String(raw?.note??'').slice(0,300),source:'gemini'};
}

// The image goes to Gemini only for this one read and is never stored on the server.
export async function readReceiptImage({image,mimeType},{client,config=geminiConfig(),today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok'}).format(new Date())}={}){
 if(!config.configured)throw Object.assign(new Error('ยังไม่ได้ตั้งค่า Gemini API key'),{status:503});
 if(typeof image!=='string'||!image||image.length>MAX_BASE64||!/^[A-Za-z0-9+/=]+$/.test(image))throw Object.assign(new Error('รูปไม่ถูกต้องหรือใหญ่เกินไป'),{status:400});
 if(!['image/jpeg','image/png','image/webp'].includes(mimeType))throw Object.assign(new Error('รองรับเฉพาะ JPG, PNG, WebP'),{status:400});
 let result;
 try{result=await withGeminiKey(ai=>ai.models.generateContent({model:config.model,contents:[{role:'user',parts:[{text:PROMPT},{inlineData:{mimeType,data:image}}]}],config:{responseMimeType:'application/json',responseSchema:schema,maxOutputTokens:600,temperature:0}}),{client});}
 catch(e){throw Object.assign(new Error(e.status===429?'Gemini คิวเต็มชั่วคราว ลองใหม่อีกครั้งนะคะ':'เดซี่อ่านรูปไม่สำเร็จ ลองใหม่อีกครั้งนะคะ'),{status:e.status===429?429:502});}
 let parsed;try{parsed=JSON.parse(result?.text??'');}catch{throw Object.assign(new Error('เดซี่อ่านรูปนี้ไม่ออก ลองรูปที่ชัดขึ้นนะคะ'),{status:502});}
 return cleanReceipt(parsed,today);
}
