import test from 'node:test';import assert from 'node:assert/strict';
import {createAutosave,restoreNoteDrafts} from '../src/autosave.mjs';
import {partialRanges} from '../server/partial-save.mjs';
test('autosave coalesces typing and serializes edits made during a slow save',async()=>{
 const calls=[];let release;const queue=createAutosave({delay:10000,save:async value=>{calls.push(value);if(calls.length===1)await new Promise(r=>release=r);}});
 queue.update('a');queue.update('ab');const first=queue.flush();await Promise.resolve();queue.update('abc');queue.update('abcd');release();await first;await queue.flush();assert.deepEqual(calls,['ab','abcd']);
});
test('failed autosave retains the latest draft for retry',async()=>{
 let fail=true;const calls=[],queue=createAutosave({delay:10000,save:async v=>{if(fail)throw new Error('offline');calls.push(v);}});queue.update('draft');await queue.flush();fail=false;await queue.flush();assert.deepEqual(calls,['draft']);
});
test('an unsuccessful deletion can resume autosave in the same editor',async()=>{const calls=[],queue=createAutosave({delay:10000,save:async value=>calls.push(value)});queue.update('old');await queue.cancel();queue.resume('draft');queue.update('edited after failed delete');await queue.flush();assert.deepEqual(calls,['edited after failed delete']);});
test('a new note drafted before reload can be recovered only for its own account',()=>{const entries=[['dayzi:note-draft:alice:new',JSON.stringify({id:'new',title:'Draft',content:'Unsynced'})],['dayzi:note-draft:bob:private',JSON.stringify({id:'private',title:'Other',content:'Private'})]],storage={length:2,key:i=>entries[i][0],getItem:key=>entries.find(e=>e[0]===key)[1]};const restored=restoreNoteDrafts({notes:[]},'alice',storage);assert.deepEqual(restored.notes.map(n=>n.id),['new']);});
test('a note-only save encodes no unrelated tables and always uses the authenticated owner',()=>{
 const result=partialRanges({notes:[{id:'n',title:'Note',content:'Text',ownerId:'other'}]},'owner',['notes']);assert.deepEqual(Object.keys(result),['notes']);assert.equal(result.notes[1][1],'owner');
 assert.throws(()=>partialRanges({notes:[]},'owner',['settings']));
});
