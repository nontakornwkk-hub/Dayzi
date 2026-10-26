import test from 'node:test';import assert from 'node:assert/strict';
const query=await import('../src/local-query.mjs').catch(()=>({}));
const data={events:[{id:'e',title:'ประชุมทีม',date:'2026-10-26',time:'14:00',status:'active'}],tasks:[{title:'ส่งเอกสาร',done:false},{title:'อ่านหนังสือ',done:true}],files:[{name:'ใบเสนอราคา.pdf'}],notes:[]};
test('existing schedule tasks and file questions are answered immediately from local data',()=>{
 assert.equal(typeof query.answerLocalQuery,'function');
 for(const message of ['วันนี้มีอะไรบ้าง','มีงานค้างอะไรบ้าง','หาไฟล์ใบเสนอราคา']){const reply=query.answerLocalQuery(message,data,'2026-10-26');assert.equal(reply.source,'local');assert.ok(reply.text.length);}
 assert.match(query.answerLocalQuery('วันนี้มีอะไรบ้าง',data,'2026-10-26').text,/ประชุมทีม/);
});
test('general conversation and creative work are not captured by local task keywords',()=>{
 assert.equal(typeof query.answerLocalQuery,'function');
 for(const text of ['วันนี้กินอะไรดี','วันนี้เหนื่อยจัง คุยเป็นเพื่อนหน่อย','ช่วยคิดไอเดียทำงานหน่อย','คุณชื่ออะไร'])assert.equal(query.answerLocalQuery(text,data,'2026-10-26'),null);
});
