import test from 'node:test';import assert from 'node:assert/strict';
const files=await import('../server/files.mjs').catch(()=>({}));
test('LINE media download stops at the upload limit rather than buffering unlimited data',async()=>{
 assert.equal(typeof files.limitedBytes,'function');let cancelled=false;
 const response={body:{getReader:()=>({read:async()=>({value:new Uint8Array(8),done:false}),cancel:async()=>{cancelled=true;}})}};
 await assert.rejects(()=>files.limitedBytes(response,4));assert.equal(cancelled,true);
});
test('LINE media within the limit preserves the original bytes',async()=>{
 assert.equal(typeof files.limitedBytes,'function');let done=false;
 const response={body:{getReader:()=>({read:async()=>done?{done:true}:(done=true,{value:new Uint8Array([1,2,3]),done:false}),cancel:async()=>{}})}};
 assert.deepEqual([...await files.limitedBytes(response,4)],[1,2,3]);
});
