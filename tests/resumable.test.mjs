import test from 'node:test';
import assert from 'node:assert/strict';
import * as uploads from '../server/files.mjs';
import {encryptSecret} from '../server/security.mjs';
const key=Buffer.alloc(32,9).toString('base64');
const account={uid:'alice',version:2,connection:{folderId:'folder-a'}};
test('upload sessions accept large files and hide the Google upload URL',async()=>{
 const result=await uploads.startUpload(account,'google-secret',{id:'file-a',name:'large.zip',size:30*1024*1024,mimeType:'application/zip'},{key,fetchImpl:async(url,options)=>{
  assert.equal(JSON.parse(options.body).parents[0],'folder-a');
  assert.equal(options.headers['X-Upload-Content-Length'],String(30*1024*1024));
  return new Response(null,{status:200,headers:{Location:'https://www.googleapis.com/upload/drive/v3/files?upload_id=private'}});
 }});
 assert.ok(result.ticket);assert.ok(!result.ticket.includes('private'));assert.equal(result.chunkSize,3*1024*1024);
});
test('upload tickets reject another owner, changed connection and expiry before contacting Google',async()=>{
 const ticket=encryptSecret(JSON.stringify({url:'https://www.googleapis.com/upload/drive/v3/files?upload_id=x',id:'file-a',size:10,version:2,expires:Date.now()+10000}),account.uid,key);
 const opts={key,fetchImpl:()=>{throw new Error('must not fetch');}};
 await assert.rejects(()=>uploads.uploadChunk({...account,uid:'bob'},'token',ticket,0,Buffer.alloc(10),opts),/สิทธิ์/);
 await assert.rejects(()=>uploads.uploadChunk({...account,version:3},'token',ticket,0,Buffer.alloc(10),opts),/สิทธิ์/);
 const expired=encryptSecret(JSON.stringify({version:2,expires:0}),account.uid,key);
 await assert.rejects(()=>uploads.uploadChunk(account,'token',expired,0,Buffer.alloc(10),opts),/สิทธิ์/);
});
test('chunks report acknowledged offset and register only after Drive completes',async()=>{
 const ticket=encryptSecret(JSON.stringify({url:'https://www.googleapis.com/upload/drive/v3/files?upload_id=x',id:'file-a',size:4*1024*1024,version:2,expires:Date.now()+10000}),account.uid,key);
 let registered=0;
 const opts={key,register:async(action,owner,payload)=>{registered++;assert.equal(owner,'alice');assert.equal(payload.file.driveId,'drive-a');},fetchImpl:async(url,options)=>{
  if(options.headers['Content-Range']==='bytes 0-3145727/4194304')return new Response(null,{status:308,headers:{Range:'bytes=0-3145727'}});
  assert.equal(options.headers['Content-Range'],'bytes 3145728-4194303/4194304');
  return Response.json({id:'drive-a'});
 }};
 assert.deepEqual(await uploads.uploadChunk(account,'token',ticket,0,Buffer.alloc(3*1024*1024),opts),{offset:3145728,done:false});assert.equal(registered,0);
 assert.deepEqual(await uploads.uploadChunk(account,'token',ticket,3145728,Buffer.alloc(1024*1024),opts),{done:true,driveId:'drive-a',offset:4194304});assert.equal(registered,1);
 await assert.rejects(()=>uploads.uploadChunk(account,'token',ticket,0,Buffer.alloc(4*1024*1024),opts),/ชิ้น/);
});
test('LINE media streams beyond 4 MB in bounded chunks without knowing total size upfront',async()=>{
 let position=0,registered=0;const size=7*1024*1024+17;
 const media=new Response(new ReadableStream({pull(c){if(position===size){c.close();return;}const length=Math.min(64*1024,size-position);position+=length;c.enqueue(new Uint8Array(length));}}));
 const ranges=[];
 const result=await uploads.uploadDriveStream(account,'token',{id:'line-file',name:'media.zip'},media,{key,register:async()=>{registered++;},fetchImpl:async(url,options)=>{
  if(options.method==='POST')return new Response(null,{headers:{Location:'https://www.googleapis.com/upload/drive/v3/files?upload_id=stream'}});
  ranges.push(options.headers['Content-Range']);assert.ok(options.body.length<=3*1024*1024);
  if(ranges.length<3)return new Response(null,{status:308,headers:{Range:`bytes=0-${ranges.length*3*1024*1024-1}`}});
  return Response.json({id:'stream-id'});
 }});
 assert.deepEqual(ranges,['bytes 0-3145727/*','bytes 3145728-6291455/*','bytes 6291456-7340048/7340049']);
 assert.deepEqual(result,{driveId:'stream-id',size});assert.equal(registered,1);
});
