export const CATEGORIES = [{id:'work',name:'งาน',color:'#c9b7fa',bg:'#eee7ff'},{id:'personal',name:'ส่วนตัว',color:'#e8c66c',bg:'#fbf0cf'},{id:'meeting',name:'ประชุม',color:'#96c8b7',bg:'#e0f0e8'},{id:'important',name:'สำคัญ',color:'#efa9a8',bg:'#fbe5e2'}];
export const localDate = (d = new Date()) => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
export const dateAdd = (date,days) => new Date(Date.parse(`${date}T12:00:00Z`)+days*86400000).toISOString().slice(0,10);
export const thaiDate = (date,opts={}) => new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'long',...opts,timeZone:'Asia/Bangkok'}).format(new Date(`${date}T12:00:00+07:00`));
export function parseStorageUrls(sheetUrl,folderUrl) {
  const s=new URL(sheetUrl.trim()),f=new URL(folderUrl.trim());
  if ([s,f].some(u=>u.protocol!=='https:'||u.username||u.password||u.port)) throw new Error('กรุณาใช้ลิงก์ HTTPS ของ Google เท่านั้น');
  const sm=s.pathname.match(/^\/spreadsheets\/d\/([\w-]+)(?:\/.*)?$/),fm=f.pathname.match(/^\/drive\/(?:u\/\d+\/)?folders\/([\w-]+)\/?$/);
  if(s.hostname!=='docs.google.com'||!sm) throw new Error('ลิงก์ Google Sheets ไม่ถูกต้อง');
  if(f.hostname!=='drive.google.com'||!fm) throw new Error('กรุณาใช้ลิงก์โฟลเดอร์ Google Drive ไม่ใช่ลิงก์ไฟล์');
  return {spreadsheetId:sm[1],folderId:fm[1]};
}
export function monthDays(year,month) {
  const first=new Date(Date.UTC(year,month,1)),offset=(first.getUTCDay()+6)%7;
  const count=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  const start=new Date(Date.UTC(year,month,1-offset));
  return Array.from({length:Math.ceil((offset+count)/7)*7},(_,i)=>new Date(+start+i*86400000).toISOString().slice(0,10));
}
export function occursOn(e,date) {
  if(e.date>date) return false;
  if(e.date===date) return true;
  const delta=Math.round((Date.parse(`${date}T12:00Z`)-Date.parse(`${e.date}T12:00Z`))/86400000);
  if(e.repeat==='daily')return true;
  if(e.repeat==='weekly')return delta%7===0;
  if(e.repeat==='monthly')return e.date.slice(8)===date.slice(8);
  return false;
}
export function findConflicts(events,item) {
  if(item.allDay)return [];
  return events.filter(e=>e.id!==item.id&&e.status==='active'&&!e.allDay&&occursOn(e,item.date)&&e.time<item.endTime&&e.endTime>item.time);
}
export function nextOccurrence(e,after) {
  for(let i=0;i<370;i++) {const d=dateAdd(after,i);if(occursOn(e,d))return d;}
  return null;
}
export function parseQuickEvent(text,today=localDate()) {
  let date=today,time=null,title=text.trim();
  const explicit=text.match(/(\d{4}-\d{2}-\d{2})/);
  if(explicit)date=explicit[1];
  else if(text.includes('มะรืน'))date=dateAdd(today,2);
  else if(text.includes('พรุ่งนี้'))date=dateAdd(today,1);
  else {const m=text.match(/วัน(จันทร์|อังคาร|พุธ|พฤหัส(?:บดี)?|ศุกร์|เสาร์|อาทิตย์)/);if(m){const weekdays={อาทิตย์:0,จันทร์:1,อังคาร:2,พุธ:3,พฤหัส:4,พฤหัสบดี:4,ศุกร์:5,เสาร์:6};const dow=new Date(`${today}T12:00Z`).getUTCDay();date=dateAdd(today,((weekdays[m[1]]-dow+7)%7)||7);}}
  const hhmm=text.match(/(?:เวลา\s*)?(\d{1,2})[:.](\d{2})/);
  if(hhmm&&+hhmm[1]<24&&+hhmm[2]<60)time=`${hhmm[1].padStart(2,'0')}:${hhmm[2]}`;
  if(!time){const nums={หนึ่ง:1,สอง:2,สาม:3,สี่:4,ห้า:5,หก:6,เจ็ด:7,แปด:8,เก้า:9,สิบ:10,สิบเอ็ด:11}; const m=text.match(/(บ่าย|เช้า|เย็น)(หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบเอ็ด|สิบ|\d{1,2})(?:โมง)?(ครึ่ง)?/);if(m){let h=nums[m[2]]??+m[2];if((m[1]==='บ่าย'||m[1]==='เย็น')&&h<12)h+=12;if(h<24)time=`${String(h).padStart(2,'0')}:${m[3]?'30':'00'}`;}else if(text.includes('เที่ยง'))time='12:00';else {const m2=text.match(/(\d{1,2})\s*(?:โมง|นาฬิกา)/);if(m2&&+m2[1]<24)time=`${m2[1].padStart(2,'0')}:00`;}}
  title=title.replace(/(?:ช่วย)?เตือน(?:ฉัน)?(?:ให้)?/g,'').replace(/พรุ่งนี้|วันนี้|มะรืน(?:นี้)?/g,'').replace(/เวลา\s*\d{1,2}[:.]\d{2}/,'').replace(/(?:บ่าย|เช้า|เย็น)(?:สิบเอ็ด|สิบ|หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|\d{1,2})(?:โมง)?(?:ครึ่ง)?/,'').trim();
  return {title:title||text,date,time,category:/ประชุม|คุย|meeting/i.test(text)?'meeting':'work'};
}
export function dueReminders(events,now,delivered={}) {
  const today=localDate(now),out=[];
  for(const e of events){if(e.status!=='active')continue;const maxDays=Math.min(7,Math.ceil(Math.max(0,...(e.reminders??[]))/1440));
    for(let offset=-1;offset<=maxDays+1;offset++){const date=dateAdd(today,offset);if(!occursOn(e,date))continue;
      for(const min of e.reminders??[]){const at=Date.parse(`${date}T${e.allDay?'09:00':e.time}:00+07:00`)-min*60000;if(+now<at||+now-at>86400000)continue;
        for(const channel of e.channels??[]){const key=`${e.id}:${date}:${min}:${channel}${e.updatedAt?':'+e.updatedAt:''}`;if(!delivered[key])out.push({key,event:e,channel,date,at});}}
    }
  }return out;
}
export function isQuiet(settings,now=new Date()){const start=settings.quietStart,end=settings.quietEnd;if(!start||!end||start===end)return false;const t=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',hour12:false}).format(now);return start>end?t>=start||t<end:t>=start&&t<end;}
export function seedData(today=localDate()) {
  return {events:[
    {id:'sample-e1',title:'วางแผนงานประจำสัปดาห์',date:today,time:'09:00',endTime:'10:00',category:'work',status:'active',reminders:[30],channels:[],note:'จัดลำดับสิ่งสำคัญ แล้วเริ่มวันอย่างสบายใจ',repeat:'none',sample:true},
    {id:'sample-e2',title:'คุยงานกับทีมออกแบบ',date:today,time:'13:30',endTime:'14:30',category:'meeting',status:'active',reminders:[30],channels:[],note:'ทบทวนแนวทางการออกแบบและขั้นตอนถัดไป',repeat:'none',sample:true},
    {id:'sample-e3',title:'เวลาสำหรับตัวเอง',date:today,time:'17:00',endTime:'18:00',category:'personal',status:'active',reminders:[],channels:[],note:'พักสายตา เดินเล่น และเติมพลัง',repeat:'none',sample:true},
    {id:'sample-e4',title:'ส่งข้อเสนอโครงการ',date:dateAdd(today,2),time:'10:00',endTime:'11:00',category:'important',status:'active',reminders:[60],channels:[],repeat:'none',sample:true},
    {id:'sample-e5',title:'อ่านหนังสือเล่มโปรด',date:dateAdd(today,4),time:'19:00',endTime:'20:00',category:'personal',status:'active',reminders:[],channels:[],repeat:'none',sample:true}
  ],tasks:[{id:'sample-t1',title:'เตรียมเอกสารสำหรับประชุม',done:false,date:today,category:'work',sample:true},{id:'sample-t2',title:'เช็กตารางงานสัปดาห์นี้',done:true,date:today,category:'personal',sample:true},{id:'sample-t3',title:'สรุปไอเดียโปรเจกต์ใหม่',done:false,date:today,category:'work',sample:true}],notes:[],files:[],transactions:[],settings:{name:'คุณ',sheetUrl:'',folderUrl:'',lineEnabled:false,pushEnabled:false,quietStart:'22:00',quietEnd:'07:00',digestTime:'08:00'},delivered:{}};
}
