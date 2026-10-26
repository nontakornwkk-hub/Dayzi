import test from 'node:test';
import assert from 'node:assert/strict';
const model = await import('../src/model.mjs').catch(() => ({}));
test('Google URLs accept sharing parameters and account-specific folder URLs', () => {
  assert.equal(typeof model.parseStorageUrls, 'function');
  assert.deepEqual(model.parseStorageUrls('https://docs.google.com/spreadsheets/d/abc_123/edit?usp=sharing#gid=0','https://drive.google.com/drive/u/0/folders/xyz-123'),{spreadsheetId:'abc_123',folderId:'xyz-123'});
});
test('rejects deceptive Google hosts and file URLs in folder field', () => {
  assert.equal(typeof model.parseStorageUrls,'function');
  for (const url of ['https://docs.google.com.evil.test/spreadsheets/d/abc/edit','http://docs.google.com/spreadsheets/d/abc/edit','https://x@docs.google.com/spreadsheets/d/abc/edit']) assert.throws(()=>model.parseStorageUrls(url,'https://drive.google.com/drive/folders/xyz'));
  assert.throws(()=>model.parseStorageUrls('https://docs.google.com/spreadsheets/d/abc/edit','https://drive.google.com/file/d/xyz/view'));
});
test('month grid keeps consecutive dates and Monday-first alignment',()=>{
  assert.equal(typeof model.monthDays,'function');
  const days=model.monthDays(2026,9);
  assert.equal(days.length,35);
  assert.equal(days[0],'2026-09-28');
  assert.equal(days.at(-1),'2026-11-01');
});
test('calendar overlap excludes touching intervals and cancelled events',()=>{
  assert.equal(typeof model.findConflicts,'function');
  const events=[{id:'a',date:'2026-10-26',time:'09:00',endTime:'10:00',status:'active'},{id:'b',date:'2026-10-26',time:'09:30',endTime:'10:30',status:'cancelled'}];
  assert.equal(model.findConflicts(events,{id:'c',date:'2026-10-26',time:'10:00',endTime:'11:00'}).length,0);
  assert.equal(model.findConflicts(events,{id:'c',date:'2026-10-26',time:'09:30',endTime:'11:00'}).length,1);
});
test('reminder recurrence advances weekly at Bangkok wall time',()=>{
  assert.equal(typeof model.nextOccurrence,'function');
  assert.equal(model.nextOccurrence({date:'2026-10-26',time:'14:00',endTime:'15:00',repeat:'weekly'},'2026-11-03'),'2026-11-09');
});
test('assistant parses Thai relative dates without silently guessing a missing time',()=>{
  assert.equal(typeof model.parseQuickEvent,'function');
  const event=model.parseQuickEvent('พรุ่งนี้บ่ายสองประชุมกับคุณเอ','2026-10-26');
  assert.equal(event.date,'2026-10-27'); assert.equal(event.time,'14:00');
  assert.equal(model.parseQuickEvent('พรุ่งนี้ประชุมกับคุณเอ','2026-10-26').time,null);
});
test('reminder delivery tracks channels separately and ignores completed events',()=>{
  assert.equal(typeof model.dueReminders,'function');
  const event={id:'a',date:'2026-10-26',time:'14:00',reminders:[30],channels:['line','push'],status:'active',repeat:'none'};
  const due=model.dueReminders([event],new Date('2026-10-26T06:35:00Z'),{'a:2026-10-26:30:line':true});
  assert.equal(due.length,1); assert.equal(due[0].channel,'push');
  assert.equal(model.dueReminders([{...event,status:'done'}],new Date('2026-10-26T06:35:00Z'),{}).length,0);
});
test('one-day advance reminders are sent on the previous day',()=>{
  const e={id:'tomorrow',date:'2026-10-27',time:'09:00',status:'active',repeat:'none',reminders:[1440],channels:['push']};
  assert.equal(model.dueReminders([e],new Date('2026-10-26T02:00:00Z'),{}).length,1);
});
test('previous-day reminder remains eligible after quiet hours end',()=>{
  const e={id:'late',date:'2026-10-26',time:'23:00',status:'active',repeat:'none',reminders:[0],channels:['push']};
  assert.equal(model.dueReminders([e],new Date('2026-10-27T00:01:00Z'),{}).length,1);
});
test('all-day event reminders use the documented 09:00 Bangkok time',()=>{
  const e={id:'all',date:'2026-10-26',allDay:true,status:'active',repeat:'none',reminders:[0],channels:['push']};
  assert.equal(model.dueReminders([e],new Date('2026-10-26T02:00:00Z'),{}).length,1);
});
