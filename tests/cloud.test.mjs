import test from 'node:test'; import assert from 'node:assert/strict';
const cloud=await import('../server/google.mjs').catch(()=>({}));
test('finance rows retain exact satang, enforce owner isolation and reject invalid amounts',()=>{
 const entry={id:'money-a',ownerId:'attacker',title:'กาแฟ',type:'expense',amount:6550,date:'2026-10-27',category:'food',source:'manual'};
 const data={events:[],tasks:[],notes:[],files:[],transactions:[entry],settings:{},delivered:{}};
 const ranges=cloud.encodeData(data,'owner-a');
 assert.equal(ranges.transactions[1][1],'owner-a');assert.equal(cloud.decodeData(ranges,'owner-a').transactions[0].amount,6550);
 assert.equal(cloud.decodeData(ranges,'owner-b').transactions.length,0);
 assert.throws(()=>cloud.validateData({...data,transactions:[{...entry,amount:-10}]}));
 assert.throws(()=>cloud.validateData({...data,transactions:[{...entry,amount:1.5}]}));
});
test('cloud serialization does not allow changing ownership',()=>{
  assert.equal(typeof cloud.encodeData,'function');
  const ranges=cloud.encodeData({events:[{id:'e1',ownerId:'attacker',title:'=IMPORTDATA("evil")',date:'2026-10-26',time:'09:00',endTime:'10:00',status:'active',category:'work',reminders:[30],channels:['push']}],tasks:[],notes:[],files:[],settings:{name:'A'},delivered:{}},'real-owner');
  assert.equal(ranges.events[1][1],'real-owner');
  assert.equal(ranges.events[1][2],'=IMPORTDATA("evil")');
});
test('data decoder filters rows belonging to another user',()=>{
  assert.equal(typeof cloud.decodeData,'function');
  const ranges=cloud.encodeData({events:[{id:'e1',title:'private',date:'2026-10-26',time:'09:00',endTime:'10:00',status:'active'}],tasks:[],notes:[],files:[],settings:{},delivered:{}},'owner-a');
  assert.equal(cloud.decodeData(ranges,'owner-b').events.length,0);
});
test('incoming state is bounded and does not trust forged cloud file ids',()=>{
  assert.equal(typeof cloud.validateData,'function');
  assert.throws(()=>cloud.validateData({events:[{id:'e',title:'x',date:'invalid',time:'09:00',endTime:'10:00'}],tasks:[],notes:[],files:[],settings:{}},[]));
  assert.throws(()=>cloud.validateData({events:[],tasks:[],notes:[],files:[{id:'f',driveId:'other-person-file',name:'stolen',size:10}],settings:{}},[]));
});
test('quiet hours cross midnight without suppressing daytime reminders',()=>{
  assert.equal(typeof cloud.isQuiet,'function');
  assert.equal(cloud.isQuiet({quietStart:'22:00',quietEnd:'07:00'},new Date('2026-10-26T17:00:00Z')),true);
  assert.equal(cloud.isQuiet({quietStart:'22:00',quietEnd:'07:00'},new Date('2026-10-26T06:00:00Z')),false);
});
