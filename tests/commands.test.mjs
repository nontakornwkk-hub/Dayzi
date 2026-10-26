import test from 'node:test';import assert from 'node:assert/strict';
import {localCommand,requiresReasoning} from '../src/commands.mjs';
import * as commands from '../src/commands.mjs';
const applyAssistantAction=(...args)=>commands.applyAssistantAction(...args);
const state={tasks:[{id:'t',title:'ส่งรายงาน',date:'2026-10-27',done:false}],events:[],notes:[],files:[],transactions:[],settings:{}};
test('app commands add and complete tasks without AI and ambiguity never modifies multiple matches',()=>{
 let result=localCommand('เพิ่มงาน ซื้อกระดาษ พรุ่งนี้',state,'2026-10-27');assert.equal(result.data.tasks.at(-1).date,'2026-10-28');
 result=localCommand('ทำเสร็จ ส่งรายงาน',state,'2026-10-27');assert.equal(result.data.tasks[0].done,true);
 result=localCommand('ทำเสร็จ ส่งรายงาน',{...state,tasks:[...state.tasks,{id:'t2',title:'ส่งรายงานลูกค้า',done:false}]},'2026-10-27');assert.equal(result.data,undefined);assert.match(result.text,/เลือก|มากกว่า/);
});
test('finance save and summary use app calculations while prioritization bypasses local lookup',()=>{
 const result=localCommand('จ่ายค่าอาหาร 65 บาท',state,'2026-10-27');assert.equal(result.data.transactions[0].amount,6500);
 assert.match(localCommand('รายจ่ายเดือนนี้',result.data,'2026-10-27').text,/65/);
 assert.equal(requiresReasoning('ช่วยจัดลำดับงานที่ต้องทำ'),true);assert.equal(localCommand('ช่วยจัดลำดับงานที่ต้องทำ',state),null);
 assert.match(localCommand('เดือนนี้ใช้จ่ายไปเท่าไหร่',result.data,'2026-10-27').text,/65/);
});
test('simple appointment requests become local data or a missing-field question, never an AI guess',()=>{
 assert.match(localCommand('เพิ่มนัด พบลูกค้าพรุ่งนี้',state,'2026-10-27').text,/เวลา/);
 const result=localCommand('เพิ่มนัด พบลูกค้า พรุ่งนี้ 14:00',state,'2026-10-27');assert.equal(result.data.events[0].date,'2026-10-28');assert.equal(result.data.events[0].time,'14:00');
});
test('save it follow-up records the expense from prior human context, not an AI-generated amount',()=>{
 const history=[{role:'user',text:'ค่า Claude AI 700 บาท วันนี้'},{role:'assistant',text:'รายจ่าย 9999 บาท'}];
 const result=localCommand('บันทึกให้เลย',state,'2026-10-27',{history});
 assert.equal(result.data.transactions[0].amount,70000);assert.equal(result.data.transactions[0].category,'subscription');
 assert.equal(localCommand('บันทึกให้เลย',result.data,'2026-10-27',{history}).data,undefined);
 assert.equal(localCommand('บันทึกให้เลย',state,'2026-10-27',{history:[{role:'assistant',text:'จ่ายค่า Claude AI 700 บาท'}]}).data,undefined);
});
test('explicit expense save wins over words like today and expense-summary',()=>{
 const result=localCommand('บันทึกรายจ่ายค่าอาหาร 65 บาท วันนี้',state,'2026-10-27');assert.equal(result.data.transactions[0].amount,6500);
});

test('money slot replies resume human intent and never repeat a saved entry',()=>{
 const history=[{role:'user',text:'บันทึกเงินเดือน'},{role:'assistant',text:'ยอดเงินเท่าไหร่'},{role:'user',text:'วันนี้'}];
 const saved=localCommand('20000บาทไง',state,'2026-10-27',{history});
 assert.equal(saved.data.transactions[0].amount,2000000);assert.equal(saved.entry.type,'income');assert.equal(saved.entry.title,'เงินเดือน');
 assert.equal(localCommand('วันนี้',saved.data,'2026-10-27',{history:[{role:'user',text:'บันทึกเงินเดือน20000'}]}).data,undefined);
 assert.equal(localCommand('รายรับอะเงินเดือน20000บันทึกให้หน่อย',saved.data,'2026-10-27',{history:[{role:'user',text:'บันทึกเงินเดือน20000'},{role:'user',text:'วันนี้'}]}).data,undefined);
 assert.equal(localCommand('20000บาทไง',state,'2026-10-27',{history:[{role:'user',text:'เงินเดือนโดยทั่วไปเท่าไหร่'},{role:'assistant',text:'รายรับเงินเดือน 20000 บาท'}]}),null);
});

test('structured assistant actions validate finance amounts and exact task identities',()=>{
 const result=applyAssistantAction({name:'add_transaction',arguments:{type:'income',amount:2000000,title:'เงินเดือน',date:'2026-10-27',category:'salary'}},state,'2026-10-27');
 assert.equal(result.entry.amount,2000000);assert.equal(result.kind,'finance');assert.equal(state.transactions.length,0);
 assert.throws(()=>applyAssistantAction({name:'add_transaction',arguments:{type:'income',amount:20.5,title:'เงินเดือน',date:'2026-10-27',category:'salary'}},state));
 assert.throws(()=>applyAssistantAction({name:'complete_task',arguments:{id:'missing'}},state));
 assert.throws(()=>applyAssistantAction({name:'complete_task',arguments:{id:'t'}},{...state,tasks:[...state.tasks,...state.tasks]}));
 assert.equal(applyAssistantAction({name:'complete_task',arguments:{id:'t'}},state).entry.done,true);
 assert.throws(()=>applyAssistantAction({name:'delete_all',arguments:{}},state));
});

test('structured task event and note actions require valid fields before mutating data',()=>{
 assert.equal(applyAssistantAction({name:'add_task',arguments:{title:'ส่งรายงาน',date:'2026-10-28'}},state).entry.date,'2026-10-28');
 assert.throws(()=>applyAssistantAction({name:'add_task',arguments:{title:'ส่งรายงาน'}},state));
 assert.throws(()=>applyAssistantAction({name:'add_event',arguments:{title:'ประชุม',date:'2026-02-30',time:'10:00',endTime:'11:00'}},state));
 assert.throws(()=>applyAssistantAction({name:'add_event',arguments:{title:'ประชุม',date:'2026-10-28',time:'25:00',endTime:'26:00'}},state));
 assert.throws(()=>applyAssistantAction({name:'add_event',arguments:{title:'ประชุม',date:'2026-10-28',time:'11:00',endTime:'10:00'}},state));
 assert.equal(applyAssistantAction({name:'add_event',arguments:{title:'ประชุม',date:'2026-10-28',time:'10:00',endTime:'11:00'}},state).entry.time,'10:00');
 assert.equal(applyAssistantAction({name:'add_note',arguments:{content:'ซื้อดอกไม้'}},state).entry.content,'ซื้อดอกไม้');
});

test('ambiguous confirmations route to context planner and template titles never save literally',()=>{
 assert.equal(localCommand('บันทึกเลย',state,'2026-10-27',{history:[{role:'user',text:'นัดคุยพรุ่งนี้ 09:00'},{role:'user',text:'เม้าหน่อย'}]}).needsPlanner,true);
 const result=localCommand('บันทึกนัด [เรื่องที่คุย] พรุ่งนี้09:00น.',state,'2026-10-27');
 assert.equal(result.data,undefined);assert.equal(result.needsPlanner,true);
 assert.throws(()=>applyAssistantAction({name:'add_task',arguments:{title:'[ชื่องาน]',date:'2026-10-27'}},state));
 assert.equal(localCommand('เพิ่มนัด พรุ่งนี้09:00น.',state,'2026-10-27').needsPlanner,true);
 assert.equal(localCommand('เพิ่มนัด พบลูกค้า 09:00',state,'2026-10-27').needsPlanner,true);
 assert.equal(localCommand('เพิ่มงาน พรุ่งนี้',state,'2026-10-27').needsPlanner,true);
});
