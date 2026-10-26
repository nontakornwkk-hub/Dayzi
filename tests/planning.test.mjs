import test from 'node:test';
import assert from 'node:assert/strict';
import * as planning from '../src/planning.mjs';
test('task periods use calendar weeks and retain explicit overdue and undated views',()=>{
 const today='2026-10-26';
 assert.equal(planning.inTaskPeriod({date:'2026-11-01'},'week',today),true);
 assert.equal(planning.inTaskPeriod({date:'2026-11-02'},'week',today),false);
 assert.equal(planning.inTaskPeriod({date:'2026-10-25'},'today',today),false);
 assert.equal(planning.inTaskPeriod({date:'2026-10-25',done:false},'overdue',today),true);
 assert.equal(planning.inTaskPeriod({date:'2026-10-25',done:true},'overdue',today),false);
 assert.equal(planning.inTaskPeriod({date:''},'undated',today),true);
 assert.equal(planning.inTaskPeriod({date:'2026-10-31'},'month',today),true);
 assert.equal(planning.inTaskPeriod({date:'2026-11-01'},'month',today),false);
});
test('calendar agenda includes every appointment and dated task, including recurring appointments',()=>{
 const data={events:[{id:'a',title:'Weekly',date:'2026-10-19',repeat:'weekly',time:'10:00',status:'active'}],tasks:Array.from({length:7},(_,i)=>({id:'t'+i,title:'Task '+i,date:'2026-10-26',done:false}))};
 const items=planning.agendaItems(data,'2026-10-26','2026-10-26');
 assert.equal(items.length,8);assert.equal(items.filter(i=>i.kind==='task').length,7);
 assert.ok(items.some(i=>i.kind==='event'&&i.item.id==='a'));
});
test('cancelled appointments stay out of the complete agenda and monthly totals',()=>{
 const items=planning.agendaItems({events:[{id:'cancelled',date:'2026-10-27',title:'Cancelled',status:'cancelled',repeat:'none',time:'09:00'}],tasks:[]},'2026-10-01','2026-10-31');
 assert.equal(items.length,0);
});
test('advance task planning expands an inclusive month and can skip weekends',()=>{
 assert.equal(planning.taskDates('2026-11-01','2026-11-30').length,30);
 assert.deepEqual(planning.taskDates('2026-10-30','2026-11-02',true),['2026-10-30','2026-11-02']);
 assert.throws(()=>planning.taskDates('2026-11-02','2026-11-01'),/สิ้นสุด/);
});
