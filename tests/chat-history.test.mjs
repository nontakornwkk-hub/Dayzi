import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as history from '../server/google.mjs';
import handler from '../server/api.mjs';
import {signSession} from '../server/security.mjs';

const chat={id:'c1',title:'My chat',updatedAt:1793059200000,messages:[{role:'user',text:'Hello',source:'local',attachments:[{id:'f1',name:'photo.png',mimeType:'image/png',driveId:'drive-1',local:false,source:'upload',base64:'secret',url:'blob:private'}]}]};
test('chat serialization binds owner, preserves safe attachment metadata, and app saves omit chats',()=>{
 assert.equal(typeof history.encodeChat,'function');
 const row=history.encodeChat({...chat,ownerId:'intruder'},'alice');
 assert.equal(row[1],'alice');
 assert.deepEqual(history.decodeData({chats:[history.SCHEMAS.chats,row]},'bob').chats,[]);
 const decoded=history.decodeData({chats:[history.SCHEMAS.chats,row]},'alice').chats[0];
 assert.deepEqual(decoded,{...chat,messages:[{role:'user',text:'Hello',source:'local',attachments:[{id:'f1',name:'photo.png',mimeType:'image/png',driveId:'drive-1',local:false,source:'upload'}]}]});
 assert.equal(JSON.stringify(decoded).includes('secret'),false);
 assert.equal(JSON.stringify(decoded).includes('blob:'),false);
 assert.equal(Object.hasOwn(history.encodeData({chats:[chat]},'alice'),'chats'),false);
});
test('chat mutations reject malformed and oversized records and decode skips corrupt rows',()=>{
 assert.equal(typeof history.sanitizeChatMutation,'function');
 for(const input of [{},{chat,deletedId:'c1'},{deletedId:''},{chat:{...chat,id:'x'.repeat(101)}},{chat:{...chat,messages:[{role:'system',text:'bad'}]}},{chat:{...chat,messages:[{role:'user',text:'x'.repeat(50000)}]}}])assert.throws(()=>history.sanitizeChatMutation(input),e=>e.status===400);
 assert.deepEqual(history.sanitizeChatMutation({deletedId:'c1'}),{deletedId:'c1'});
 assert.deepEqual(history.decodeData({chats:[['id','owner_id','title','updated_at','messages'],['c','alice','broken','1','{bad']]},'alice').chats,[]);
});
test('cloud attachments require registered file ownership and attachment-only messages survive',()=>{
 assert.throws(()=>history.sanitizeChatMutation({chat}),error=>error.status===403);
 const safe=history.sanitizeChatMutation({chat:{...chat,messages:[{role:'user',attachments:chat.messages[0].attachments}]}},[{id:'f1',driveId:'drive-1'}]);
 assert.equal(safe.chat.messages[0].text,'');assert.equal(safe.chat.messages[0].attachments[0].driveId,'drive-1');
});
test('reading an old workbook skips absent chats without requesting a missing range',async()=>{
 const previous=globalThis.fetch;let requested;
 try{globalThis.fetch=async url=>{if(url.includes('?fields='))return Response.json({sheets:[{properties:{title:'events'}}]});requested=url;return Response.json({valueRanges:[{values:[]}]});};
 const ranges=await history.readRanges('token','sheet',['events','chats']);assert.deepEqual(ranges,{events:[]});assert.equal(requested.includes('chats'),false);
 }finally{globalThis.fetch=previous;}
});

const source=await readFile('apps-script/registry-coordinator.gs','utf8');
function coordinator(){
 const account={uid:'alice',version:3,revision:7,connection:{spreadsheetId:'sheet-a',status:'ready'}};
 let rows=[['id','owner_id','title','updated_at','messages'],['c1','alice','old',1,'[]'],['c2','alice','keep',2,'[]'],['foreign','bob','private',2,'[]']],created=false;
 const sheet={getDataRange:()=>({getValues:()=>[['user_id','json'],['alice',JSON.stringify(account)]]}),getRange:()=>({setValues:()=>{throw Error('chat must not rewrite registry');}})};
 const context={LockService:{getScriptLock:()=>({tryLock:()=>true,hasLock:()=>true,releaseLock:()=>{}})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='REGISTRY_SECRET'?'secret':'registry'})},SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet})},UrlFetchApp:{fetch:(url,options={})=>{let response={};if(url.includes('?fields='))response={sheets:created?[{properties:{title:'chats'}}]:[]};else if(url.endsWith(':batchUpdate')&&!url.includes('/values:'))created=true;else if(url.includes('values:batchGet'))response={valueRanges:[{values:rows}]};else if(url.includes('values:batchUpdate')){const payload=JSON.parse(options.payload);assert.equal(payload.valueInputOption,'RAW');for(const update of payload.data){assert.match(update.range,/^'chats'!A\d+$/);const start=Number(update.range.match(/A(\d+)/)[1])-1;update.values.forEach((row,i)=>{rows[start+i]=row;});}}else throw Error('unexpected '+url);return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(response)};}},ContentService:{MimeType:{JSON:'json'},createTextOutput:x=>({setMimeType:()=>x})},Date,JSON,Array};
 vm.createContext(context);vm.runInContext(source,context);
 return {run:p=>JSON.parse(context.doPost({postData:{contents:JSON.stringify({secret:'secret',action:'saveChat',uid:'alice',connectionVersion:3,accessToken:'token',...p})}})),rows:()=>rows,account};
}
test('locked chat upserts/deletes one owner row without app revision or unrelated rows changing',()=>{
 const c=coordinator();
 const result=c.run({row:['c1','alice','updated',3,'[]']});assert.equal(result.ok,true);
 assert.equal(c.rows()[1][2],'updated');assert.equal(c.rows()[2][2],'keep');assert.equal(c.rows()[3][2],'private');assert.equal(c.account.revision,7);
 assert.equal(c.run({row:['new','alice','new chat',4,'[]']}).ok,true);assert.equal(c.rows()[4][0],'new');
 assert.equal(c.run({deletedId:'c1'}).ok,true);assert.deepEqual(c.rows()[1],['','','','','']);assert.equal(c.rows()[2][0],'c2');
 assert.equal(c.run({row:['foreign','alice','steal',4,'[]']}).status,403);
 assert.equal(c.run({deletedId:'foreign'}).status,403);
 assert.equal(c.run({row:['x','bob','forged',4,'[]']}).status,403);
 assert.equal(c.run({deletedId:'c2',connectionVersion:2}).status,409);
});
test('chat API uses authenticated workbook, ignores client ownership, and keeps data revision independent',async()=>{
 const keys=['SESSION_SECRET','TOKEN_ENCRYPTION_KEY','REGISTRY_URL','REGISTRY_SECRET'];const prior=Object.fromEntries(keys.map(key=>[key,process.env[key]]));const previous=globalThis.fetch;let mutation;
 const uid='line:U'+'a'.repeat(32),account={uid,authProvider:'line',version:3,revision:7,connection:{status:'ready',spreadsheetId:'personal-sheet',folderId:'personal-folder'}};
 try{
  for(const key of keys)process.env[key]=key==='REGISTRY_URL'?'https://registry.example/exec':'test-secret';
  globalThis.fetch=async(url,options={})=>{
   if(url==='https://registry.example/exec'){const payload=JSON.parse(options.body);assert.equal(payload.uid,uid);if(payload.action==='get')return Response.json(account);if(payload.action==='ownerToken')return Response.json({accessToken:'test-token'});if(payload.action==='saveChat'){mutation=payload;return Response.json({ok:true});}throw Error('unexpected registry action');}
   assert.equal(new URL(url).pathname.includes('/personal-sheet'),true);
   if(url.includes('?fields='))return Response.json({sheets:Object.keys(history.SCHEMAS).map(title=>({properties:{title}}))});
   const names=new URL(url).searchParams.getAll('ranges').map(range=>range.match(/'([^']+)'/)[1]);
   return Response.json({valueRanges:names.map(name=>({values:name==='chats'?[history.SCHEMAS.chats,['mine',uid,'Mine',5,'[]'],['foreign','bob','Secret',6,'[]']]:[history.SCHEMAS[name]]}))});
  };
  const session=signSession({sub:uid},'test-secret'),headers={Cookie:`dayzi_session=${session}`,Origin:'https://dayzi.test','Content-Type':'application/json'};
  const listed=await handler(new Request('https://dayzi.test/api/chats',{headers}));assert.equal(listed.status,200);assert.deepEqual((await listed.json()).chats.map(c=>c.id),['mine']);
  const safeChat={...chat,ownerId:'bob',messages:[{role:'user',text:'save me'}]};
  const saved=await handler(new Request('https://dayzi.test/api/chats',{method:'PUT',headers,body:JSON.stringify({chat:safeChat})}));assert.equal(saved.status,200);assert.equal((await saved.json()).chat.title,'My chat');assert.equal(mutation.row[1],uid);assert.equal(mutation.connectionVersion,3);assert.equal(Object.hasOwn(mutation,'expectedRevision'),false);
  const forged=await handler(new Request('https://dayzi.test/api/chats',{method:'PUT',headers,body:JSON.stringify({chat})}));assert.equal(forged.status,403);
  const deleted=await handler(new Request('https://dayzi.test/api/chats',{method:'PUT',headers,body:JSON.stringify({deletedId:'mine'})}));assert.equal(deleted.status,200);assert.deepEqual(await deleted.json(),{deletedId:'mine'});assert.equal(mutation.deletedId,'mine');
 }finally{globalThis.fetch=previous;for(const key of keys)if(prior[key]===undefined)delete process.env[key];else process.env[key]=prior[key];}
});
