import {occursOn,dateAdd,localDate,thaiDate} from './model.mjs';
export function answerLocalQuery(message,data,today=localDate()) {
  const text=message.trim().toLowerCase().replace(/[?？!]+$/,'').replace(/(?:ให้หน่อย|หน่อย|ค่ะ|ครับ|คะ|นะ)\s*$/,'').trim();
  const tasks=data.tasks??[],events=data.events??[],files=data.files??[],notes=data.notes??[];
  if(/^(?:วันนี้|พรุ่งนี้|มะรืน)(?:ฉัน)?(?:มีอะไร(?:บ้าง)?|มีนัด(?:อะไร|บ้าง|กี่นัด)?|ต้องทำอะไร(?:บ้าง)?)$/.test(text)||/^(?:ขอ)?(?:ดู|สรุป|เช็ก|เช็ค|แสดง).*(?:ตาราง|นัดหมาย|ปฏิทิน)/.test(text)||/^(?:ตาราง|นัดหมาย|ปฏิทิน).*(?:วันนี้|พรุ่งนี้|อะไร|บ้าง)/.test(text)){
    const day=text.includes('พรุ่งนี้')?dateAdd(today,1):text.includes('มะรืน')?dateAdd(today,2):today;
    const es=events.filter(e=>e.status!=='cancelled'&&occursOn(e,day)).sort((a,b)=>a.time.localeCompare(b.time));
    const pending=tasks.filter(t=>!t.done&&(!t.date||t.date<=day));
    return {source:'local',text:`${thaiDate(day)} 🌼\n${es.length?es.map(e=>`${e.allDay?'ทั้งวัน':e.time+' น.'} · ${e.title}${e.status==='done'?' ✓':''}`).join('\n'):'ยังไม่มีนัดหมายค่ะ'}\n\n${pending.length?'งานที่ยังไม่เสร็จ '+pending.length+' รายการ:\n'+pending.slice(0,12).map(t=>'☐ '+t.title).join('\n'):'งานเรียบร้อยแล้ว มีเวลาให้ตัวเองได้เลยค่ะ'}`};
  }
  if(/(?:งานค้าง|งานที่ค้าง|งานที่เหลือ|งานที่ต้องทำ|มีงาน|งานวันนี้|to.?do)/.test(text)&&!/(?:ไอเดีย|แนะนำ|ช่วยคิด|วิธี)/.test(text)){
    const done=/เสร็จแล้ว|ทำเสร็จ/.test(text),list=tasks.filter(t=>done?t.done:!t.done);
    return {source:'local',text:list.length?`${done?'ทำเสร็จแล้ว':'ยังมีงาน'} ${list.length} รายการค่ะ\n`+list.slice(0,20).map(t=>`${done?'✓':'☐'} ${t.title}`).join('\n'):'ไม่มีงานค้างแล้วค่ะ เก่งมากเลย 🌼'};
  }
  if(/^(?:หา|ค้นหา|ค้น|ขอดู|ดู|แสดง|มี).*(?:ไฟล์|เอกสาร)|^ไฟล์.*(?:อะไร|บ้าง|มี)/.test(text)){
    const name=text.replace(/^(?:ค้นหา|ขอดู|แสดง|ค้น|หา|ดู|มี)/,'').replace(/ไฟล์|เอกสาร|อะไร|บ้าง|ให้|หน่อย/g,'').trim();
    const found=files.filter(f=>!name||f.name.toLowerCase().includes(name));
    return {source:'local',text:found.length?`พบ ${found.length} ไฟล์ค่ะ 📁\n${found.slice(0,20).map(f=>'• '+f.name).join('\n')}\nเปิดดาวน์โหลดได้ที่คลังไฟล์งาน`:'ยังไม่พบไฟล์ที่ตรงกัน ลองใช้บางส่วนของชื่อไฟล์นะคะ'};
  }
  if(/^(?:ดู|หา|ค้นหา)โน้ต/.test(text)){const name=text.replace(/^(?:ดู|หา|ค้นหา)โน้ต/,'').trim();const found=notes.filter(n=>!name||`${n.title} ${n.content}`.includes(name));return {source:'local',text:found.length?found.slice(0,10).map(n=>`${n.title}\n${n.content}`).join('\n\n'):'ยังไม่พบโน้ตที่ตรงกันค่ะ'};}
  return null;
}
