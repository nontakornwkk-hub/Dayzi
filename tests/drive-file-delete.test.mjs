import test from 'node:test';import assert from 'node:assert/strict';
import {trashDriveFile} from '../server/files.mjs';
test('deleting a library file uses reversible Drive trash and verifies ownership and parent folder',async t=>{
 const account={uid:'owner',connection:{folderId:'own-folder'}},file={id:'f1',ownerId:'owner',driveId:'drive-file'},calls=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push({url:String(url),...options});return Response.json(options.method==='PATCH'?{}:{id:'drive-file',parents:['own-folder'],trashed:false});});
 assert.equal((await trashDriveFile(account,'token',file)).changed,true);
 assert.equal(calls[1].method,'PATCH');assert.deepEqual(JSON.parse(calls[1].body),{trashed:true});
 await assert.rejects(()=>trashDriveFile(account,'token',{...file,ownerId:'someone-else'}),e=>e.status===403);
 assert.equal(calls.length,2);
});
test('a file outside the connected folder cannot be trashed',async t=>{
 t.mock.method(globalThis,'fetch',async()=>Response.json({parents:['other-folder'],trashed:false}));
 await assert.rejects(()=>trashDriveFile({uid:'owner',connection:{folderId:'own-folder'}},'token',{ownerId:'owner',driveId:'drive-file'}),e=>e.status===403);
});
