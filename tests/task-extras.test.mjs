import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeData,decodeData} from '../server/google.mjs';

const base={events:[],notes:[],files:[],transactions:[],settings:{},delivered:{}};

test('task priority and time survive the fixed-column Sheet round trip', () => {
  const tasks=[
    {id:'a',title:'ส่งรายงาน',date:'2026-10-27',done:false,category:'work',priority:'high',time:'14:00'},
    {id:'b',title:'ธรรมดา',date:'2026-10-27',done:false,category:'personal'}
  ];
  const encoded=encodeData({...base,tasks},'owner');
  assert.equal(encoded.tasks[0].length,6);
  const back=decodeData(encoded,'owner').tasks;
  assert.deepEqual([back[0].category,back[0].priority,back[0].time],['work','high','14:00']);
  assert.deepEqual([back[1].category,back[1].priority,back[1].time],['personal',undefined,undefined]);
});
