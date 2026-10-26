import test from 'node:test';
import assert from 'node:assert/strict';
import {taskMessage,eventMessage,financeMessage,fileMessage,todayMessage,summaryMessage} from '../server/line-cards.mjs';
const origin='https://dayzi.test';
function actions(card){const found=[];function walk(node){if(!node||typeof node!=='object')return;if(node.action)found.push(node.action);for(const value of Object.values(node))if(typeof value==='object'){if(Array.isArray(value))value.forEach(walk);else walk(value);}}walk(card);return found;}
test('task cards use mascot branding, bounded carousel and real done postbacks',()=>{
 const card=taskMessage(Array.from({length:20},(_,i)=>({id:`task-${i}`,title:`งาน ${i}`,date:'2026-10-27',done:false})),'งานค้าง',origin);
 assert.equal(card.contents.contents.length,10);
 assert.match(JSON.stringify(card),/https:\/\/dayzi.test\/dayzi-card-mascot.png/);
 assert.deepEqual(JSON.parse(actions(card)[0].data),{action:'task-done',id:'task-0'});
 assert.equal(actions(taskMessage([{id:'done',title:'เสร็จแล้ว',done:true}],'เรียบร้อย',origin)).some(a=>a.type==='postback'),false);
});
test('appointment and reminder cards contain date, owned event action and app link',()=>{
 const event={id:'event-1',title:'ประชุม',date:'2026-10-27',time:'14:00',status:'active',repeat:'none'};
 const card=eventMessage(event,'เตือนประชุม',origin,{reminder:true,fileCount:2});
 assert.equal(card.type,'flex');assert.match(JSON.stringify(card),/เอกสารแนบ 2 ไฟล์/);
 assert.ok(actions(card).some(a=>a.uri===`${origin}/?page=calendar&event=event-1`));
 assert.deepEqual(JSON.parse(actions(card)[0].data),{action:'event-done',id:event.id});
 assert.equal(actions(eventMessage({...event,repeat:'weekly'},'นัดซ้ำ',origin)).some(a=>a.type==='postback'),false);
});
test('finance and file cards expose only implemented app destinations',()=>{
 const finance=financeMessage({title:'อาหาร',amount:65,type:'expense',date:'2026-10-27'},'บันทึกแล้ว',origin);
 assert.match(JSON.stringify(finance),/65/);assert.equal(actions(finance)[0].uri,`${origin}/?page=finance`);
 const file=fileMessage({id:'line-image 1',name:'ใบเสร็จ.png',mimeType:'image/png'},origin);
 assert.ok(actions(file).some(a=>a.uri===`${origin}/?page=finance&receipt=line-image%201`));
 assert.equal(actions(fileMessage({id:'pdf',name:'งาน.pdf',mimeType:'application/pdf'},origin)).length,1);
});
test('daily card includes recurring events and summary alt text stays within LINE limits',()=>{
 const card=todayMessage({events:[{id:'weekly',title:'นัดประจำ',date:'2026-10-20',time:'10:00',repeat:'weekly',status:'active'}],tasks:[{title:'งานวันนี้',date:'2026-10-27',done:false}]},'วันนี้',origin,'2026-10-27');
 assert.match(JSON.stringify(card),/นัดประจำ/);assert.match(JSON.stringify(card),/งานวันนี้/);
 assert.equal(summaryMessage('สรุป','x'.repeat(5000),origin).altText.length,400);
});
