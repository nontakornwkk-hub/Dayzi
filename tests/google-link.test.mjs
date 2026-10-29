import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
import {createLinkToken,readLinkToken,provisionUserStorage,LINK_SCOPES} from '../server/google-link.mjs';
const lineUid='line:U'+'b'.repeat(32),key='k'.repeat(32);

test('link tokens belong to one LINE user, expire quickly and cannot be forged or reused as sessions',()=>{
 const now=1_800_000_000,token=createLinkToken(lineUid,key,now);
 assert.equal(readLinkToken(token,key,now+60),lineUid);
 assert.throws(()=>readLinkToken(token,key,now+901),e=>e.status===400);
 assert.throws(()=>readLinkToken(token,'x'.repeat(32),now),e=>e.status===400);
 assert.throws(()=>readLinkToken(token+'x',key,now),e=>e.status===400);
 assert.throws(()=>readLinkToken('',key,now),e=>e.status===400);
 // a normal login session or a Google (non-LINE) identity must not work as a link token
 assert.throws(()=>readLinkToken(createLinkToken('google-123',key,now),key,now),e=>e.status===400);
});

test('Google link asks only for drive.file and no spreadsheet-wide or full Drive scope',()=>{
 assert.deepEqual(LINK_SCOPES,['openid','email','profile','https://www.googleapis.com/auth/drive.file']);
});

test('provisioning creates Dayzi folder, files folder and sheet inside the user own Drive and prepares tables',async()=>{
 const calls=[],real=globalThis.fetch;
 globalThis.fetch=async(url,options={})=>{url=String(url);calls.push([options.method??'GET',url,options.body?JSON.parse(options.body):null]);
  const reply=body=>new Response(JSON.stringify(body),{status:200});
  if(url.includes('/drive/v3/files?fields=id')){const name=JSON.parse(options.body).name;return reply({id:name==='Dayzi'?'root-folder':'files-folder'});}
  if(url.includes('sheets.googleapis.com/v4/spreadsheets?fields=spreadsheetId'))return reply({spreadsheetId:'book-1'});
  if(url.includes('addParents'))return reply({id:'book-1'});
  if(url.includes('/drive/v3/files/book-1?fields=id,name'))return reply({id:'book-1',name:'Dayzi',mimeType:'application/vnd.google-apps.spreadsheet',capabilities:{canEdit:true}});
  if(url.includes('/drive/v3/files/files-folder?fields=id,name'))return reply({id:'files-folder',name:'ไฟล์',mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true}});
  if(url.includes('?fields=sheets(properties(title))'))return reply({sheets:[{properties:{title:'Sheet1'}}]});
  if(url.includes(':batchUpdate'))return reply({});
  if(url.includes('values:batchGet'))return reply({valueRanges:[]});
  if(url.includes('values:batchUpdate'))return reply({});
  return new Response('{}',{status:404});};
 try{
  const result=await provisionUserStorage('user-token',lineUid);
  assert.deepEqual(result.ids,{spreadsheetId:'book-1',folderId:'files-folder'});
  assert.match(result.sheetUrl,/spreadsheets\/d\/book-1\/edit$/);assert.match(result.folderUrl,/folders\/files-folder$/);
  assert.ok(calls.some(([m,u,b])=>m==='POST'&&u.includes('/drive/v3/files')&&b?.parents?.[0]==='root-folder'));
  assert.ok(calls.every(([,u])=>!u.includes('script.google.com')));
 }finally{globalThis.fetch=real;}
});

const source=await readFile('apps-script/registry-coordinator.gs','utf8');
function registry(accounts=[]){
 const rows=[['user_id','json'],...accounts.map(a=>[a.uid,JSON.stringify(a)])],saved=[];
 const sheet={getDataRange:()=>({getValues:()=>rows}),getRange:()=>({setValues:v=>saved.push(JSON.parse(v[0][1]))}),getLastRow:()=>rows.length};
 const props={REGISTRY_SECRET:'secret',REGISTRY_SHEET_ID:'sheet'};
 const context={LockService:{getScriptLock:()=>({tryLock:()=>true,hasLock:()=>true,releaseLock:()=>{}})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]})},SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush:()=>{}},ContentService:{createTextOutput:t=>({text:t,setMimeType(){return this;}}),MimeType:{JSON:'json'}}};
 vm.createContext(context);vm.runInContext(source,context);
 return {saved,call:payload=>{const out=context.doPost({postData:{contents:JSON.stringify({secret:'secret',...payload})}});return JSON.parse(out.text);}};
}

test('AI chat has no daily message ceiling but still rejects a rapid repeat',()=>{
 const today=new Date().toISOString().slice(0,10);
 const reg=registry([{uid:lineUid,version:1,aiDay:today,aiCount:1000,aiLast:Date.now()-6000}]);
 assert.equal(reg.call({action:'aiQuota',uid:lineUid}).ok,true);
 assert.equal(reg.saved[0].aiCount,1001);
 const burst=registry([{uid:lineUid,version:1,aiDay:today,aiCount:1001,aiLast:Date.now()}]);
 assert.equal(burst.call({action:'aiQuota',uid:lineUid}).status,429);
});
test('registry onboarding no longer builds storage in the owner Drive',()=>{
 const reg=registry(),result=reg.call({action:'lineOnboard',uid:lineUid,lineId:lineUid.slice(5),name:'ต้น'});
 assert.equal(result.error,undefined);assert.equal(result.authProvider,'line');assert.equal(result.connection,undefined);
 assert.equal(reg.saved.length,1);assert.equal(reg.saved[0].uid,lineUid);
});
test('linkGoogle stores the user own token and marks their storage as oauth, and only for LINE accounts',()=>{
 const reg=registry([{uid:lineUid,authProvider:'line',line:lineUid.slice(5),version:0,revision:0,uploads:[]}]);
 const ok=reg.call({action:'linkGoogle',uid:lineUid,email:'me@example.com',encryptedToken:'enc',ids:{spreadsheetId:'s1',folderId:'f1'},sheetUrl:'https://docs.google.com/spreadsheets/d/s1/edit',folderUrl:'https://drive.google.com/drive/folders/f1'});
 assert.equal(ok.error,undefined);assert.equal(ok.connection.auth,'oauth');assert.equal(ok.connection.status,'ready');assert.equal(ok.encryptedToken,'enc');assert.equal(ok.version,1);
 assert.equal(reg.call({action:'linkGoogle',uid:'google-1',encryptedToken:'enc',ids:{spreadsheetId:'s',folderId:'f'}}).status,403);
 assert.equal(reg.call({action:'linkGoogle',uid:lineUid,ids:{spreadsheetId:'s',folderId:'f'}}).status,400);
 const taken=registry([{uid:'line:U'+'c'.repeat(32),authProvider:'line',version:1,connection:{status:'ready',spreadsheetId:'s1',folderId:'f9'}}]);
 assert.equal(taken.call({action:'linkGoogle',uid:lineUid,encryptedToken:'enc',ids:{spreadsheetId:'s1',folderId:'f1'}}).status,409);
});
