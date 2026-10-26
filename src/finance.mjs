import {localDate,dateAdd} from './model.mjs';
export const MONEY_CATEGORIES=[['food','อาหารและเครื่องดื่ม'],['transport','เดินทาง'],['shopping','ซื้อของ'],['home','บ้านและค่าเช่า'],['utilities','น้ำ ไฟ อินเทอร์เน็ต'],['health','สุขภาพ'],['subscription','สมาชิก/บริการ'],['education','การเรียน'],['entertainment','พักผ่อน'],['salary','เงินเดือน'],['freelance','งานเสริม'],['bonus','โบนัส'],['gift','ของขวัญ/เงินให้'],['invest','ลงทุน/ดอกเบี้ย'],['refund','เงินคืน'],['income_other','รายรับอื่น ๆ'],['transfer','โอนเงิน'],['other','อื่น ๆ']];
export const CATEGORY_ICONS={food:'🍜',transport:'🚌',shopping:'🛍️',home:'🏠',utilities:'💡',health:'💊',subscription:'📺',education:'📚',entertainment:'🎮',salary:'💼',freelance:'🧑‍💻',bonus:'🎁',gift:'💝',invest:'🌱',refund:'↩️',income_other:'✨',transfer:'🔁',other:'🧸'};
const EXPENSE_IDS=['food','transport','shopping','home','utilities','health','subscription','education','entertainment','other'],INCOME_IDS=['salary','freelance','bonus','gift','invest','refund','income_other'];
// Expense and income get separate category lists so people never scroll past the wrong kind.
export const categoriesFor=type=>MONEY_CATEGORIES.filter(([id])=>type==='income'?INCOME_IDS.includes(id):type==='transfer'?id==='transfer':EXPENSE_IDS.includes(id));
export const categoryLabel=id=>{const c=MONEY_CATEGORIES.find(([x])=>x===id);return c?`${CATEGORY_ICONS[id]??''} ${c[1]}`.trim():'';};
const digits=text=>String(text).replace(/[๐-๙]/g,c=>String('๐๑๒๓๔๕๖๗๘๙'.indexOf(c)));
export function toSatang(value){const raw=digits(value).trim();if(raw.includes(',')&&!/^\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?$/.test(raw))return null;const s=raw.replace(/,/g,'');if(!/^\d+(?:\.\d{1,2})?$/.test(s))return null;const [whole,fraction='']=s.split('.'),n=Number(whole)*100+Number(fraction.padEnd(2,'0'));return Number.isSafeInteger(n)&&n<=999999999999?n:null;}
export const money=value=>new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'}).format(value/100);
export const moneyCategory=text=>/อาหาร|กาแฟ|ข้าว|กิน|เครื่องดื่ม|ชานม/.test(text)?'food':/รถ|เดินทาง|น้ำมัน|แท็กซี่/.test(text)?'transport':/ค่าเช่า|บ้าน/.test(text)?'home':/ค่าไฟ|ค่าน้ำ|เน็ต|โทรศัพท์/.test(text)?'utilities':/ยา|หมอ|สุขภาพ/.test(text)?'health':/สมาชิก|netflix|spotify|subscription|claude|chatgpt|gemini|บริการ/i.test(text)?'subscription':/เงินเดือน/.test(text)?'salary':/งานเสริม|ฟรีแลนซ์/.test(text)?'freelance':/ช้อป|ซื้อของ/.test(text)?'shopping':'other';
export function validateTransaction(item){if(!item||typeof item.id!=='string'||item.id.length>100||!item.id||!['income','expense','transfer'].includes(item.type)||!Number.isSafeInteger(item.amount)||item.amount<=0||item.amount>999999999999||typeof item.title!=='string'||!item.title.trim()||item.title.length>200||!/^\d{4}-\d{2}-\d{2}$/.test(item.date)||!MONEY_CATEGORIES.some(([id])=>id===item.category)||(item.note??'').length>1000)throw new Error('รายการรายรับรายจ่ายไม่ถูกต้อง');const parsed=new Date(`${item.date}T12:00Z`);if(Number.isNaN(+parsed)||parsed.toISOString().slice(0,10)!==item.date)throw new Error('วันที่รายการไม่ถูกต้อง');return item;}
export function financeSummary(items=[],month=localDate().slice(0,7)){
 let income=0,expense=0,count=0;const categories={};for(const item of items){if(item.date?.slice(0,7)!==month)continue;count++;if(item.type==='income')income+=item.amount;else if(item.type==='expense'){expense+=item.amount;categories[item.category]=(categories[item.category]??0)+item.amount;}}
 return {income,expense,net:income-expense,count,categories};
}
export function parseFinanceCommand(message,today=localDate()){
 const text=digits(message).trim();if(/ช่วยคิด|วิเคราะห์|จัดลำดับ|วางแผน|แนะนำ|เท่าไหร่|เท่าไร|โดยทั่วไป|ควร|ดีไหม|หรือเปล่า/.test(text))return null;
 const normalized=text.replace(/^(?:ช่วย\s*)?(?:บันทึก|จด)(?:ให้)?\s*/,'');
 const income=/^(?:รายรับ|รับเงิน|เงินเข้า|ได้เงิน|เงินเดือน)/.test(normalized),expense=/^(?:รายจ่าย|จ่าย|ซื้อ|ค่า(?=.{0,100}\d))/.test(normalized),transfer=/^โอน(?:ระหว่างบัญชี|เข้าบัญชีตัวเอง)/.test(normalized);
 if(!income&&!expense&&!transfer)return null;
 const withoutDate=text.replace(/\d{4}-\d{2}-\d{2}/g,''),matches=[...withoutDate.matchAll(/(?<![\d.,])(\d[\d,]*(?:\.\d+)?)(?![\d.,])/g)];
 const amounts=[...new Set(matches.map(m=>toSatang(m[1])))];
 const match=matches[0];
 const amount=match?toSatang(match[1]):null;
 if(!amount||amounts.length!==1)return {error:amounts.length>1?'รายการนี้เป็นยอดเงินเท่าไหร่คะ':'ยอดเงินเท่าไหร่คะ'};
 const date=/\d{4}-\d{2}-\d{2}/.exec(text)?.[0]??(text.includes('เมื่อวาน')?dateAdd(today,-1):text.includes('พรุ่งนี้')?dateAdd(today,1):today);
 const title=normalized.replace(/\d{4}-\d{2}-\d{2}/g,'').replace(/\d[\d,]*(?:\.\d+)?/g,' ').replace(/^(?:รายรับ|รายจ่าย|รับเงิน|เงินเข้า|ได้เงิน|จ่าย)(?:อะ)?\s*/,'').replace(/(?:ช่วย)?บันทึก(?:ให้)?(?:หน่อย|เลย)?|ให้หน่อย|วันนี้|เมื่อวาน|พรุ่งนี้|บาท|฿|(?:ค่ะ|ครับ|คะ|ไง)\s*$/g,'').trim();
 return {type:transfer?'transfer':income?'income':'expense',amount,date,title:title|| (income?'รับเงิน':transfer?'โอนระหว่างบัญชี':'จ่ายเงิน'),category:moneyCategory(text),note:''};
}
export function parseSlipText(raw,today=localDate()){
 const text=digits(raw??'').replace(/\r/g,''),lines=text.split('\n').map(line=>line.trim()).filter(Boolean),candidates=[];
 // Accept only complete labelled money fields. In particular, never extract a
 // numeric substring from a subtotal, an account number or an invalid decimal.
 const totalLabel=/^(?:จำนวนเงิน(?:ที่ชำระ|รวม)?|ยอดโอน|ยอดเงิน(?:โอน)?|ยอดรวมสุทธิ|ยอดสุทธิ|ยอดชำระ(?:เงิน)?|ยอดที่ต้องชำระ|ยอดรวมทั้งสิ้น|รวมทั้งสิ้น|รวมเป็นเงิน|รวมเงิน|ยอดรวม|grand\s+total|total\s+amount|amount\s+(?:due|paid)|net\s+(?:total|amount)|balance\s+due|total|amount)(?=\s|[:：฿\d(]|$)\s*(?:\(THB\)\s*)?[:：]?\s*/i;
 const excluded=/ภาษี|ก่อนภาษี|เงินทอน|รับเงินสด|ค่าธรรมเนียม|เลขบัญชี|เลขอ้างอิง|sub\s*total|\btax\b|\bvat\b|\bchange\b|\bcash\b|\btendered\b|\baccount\b|\breference\b/i;
 for(let i=0;i<lines.length;i++){
  const line=lines[i];if(excluded.test(line))continue;
  const label=totalLabel.exec(line);if(!label)continue;
  const value=line.slice(label[0].length).trim()||lines[i+1]||'';
  const match=/^(?:THB\s*|฿\s*)?([\d,]+(?:\.\d+)?)(?:\s*(?:บาท|THB|฿))?\s*$/i.exec(value);
  const amount=match?toSatang(match[1]):null;
  if(amount>0&&!candidates.includes(amount))candidates.push(amount);
 }
 const months=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'],fullMonths=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
 const numeric=/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/.exec(text),thai=/(\d{1,2})\s*(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s*(?:พ\.?ศ\.?\s*)?(\d{4})/.exec(text),iso=/\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
 let date=today,dateDetected=false;
 if(iso||numeric||thai){const match=iso||numeric||thai;let year=Number(iso?match[1]:match[3]);if(year>2400)year-=543;const month=iso||numeric?Number(match[2]):Math.max(months.indexOf(match[2]),fullMonths.indexOf(match[2]))+1;const day=iso?match[3]:match[1];const candidate=`${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${day.padStart(2,'0')}`;const parsed=new Date(`${candidate}T12:00Z`);if(!Number.isNaN(+parsed)&&parsed.toISOString().slice(0,10)===candidate){date=candidate;dateDetected=true;}}
 const merchant=/(?:^|\n)[ \t]*(?:ผู้รับเงิน|ผู้รับ|โอนให้|ร้านค้า|merchant)[ \t]*[:：]?[ \t]*([^\n]*)/i.exec(text)?.[1]?.trim().slice(0,120)??'';
 const documentType=/โอนเงิน|โอนสำเร็จ|ยอดโอน|ยอดเงินโอน|ผู้รับเงิน|transfer\s+(?:successful|completed)|funds\s+transfer/i.test(text)?'transfer':/ใบเสร็จ|ใบกำกับภาษี|receipt|tax\s+invoice|grand\s+total|ยอดรวมสุทธิ|เงินทอน/i.test(text)?'receipt':'unknown';
 return {amount:candidates.length===1?candidates[0]:null,amountCandidates:candidates,date,dateDetected,type:null,merchant,title:merchant||(documentType==='receipt'?'รายการจากใบเสร็จ':'รายการจากสลิป'),category:'other',note:'',documentType};
}
export function financeCsv(items){const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';return '\uFEFF'+[['วันที่','ประเภท','รายการ','หมวด','จำนวนบาท','บันทึก'],...items.map(t=>[t.date,t.type,t.title,MONEY_CATEGORIES.find(([id])=>id===t.category)?.[1],(t.amount/100).toFixed(2),t.note])].map(row=>row.map(cell).join(',')).join('\r\n');}
