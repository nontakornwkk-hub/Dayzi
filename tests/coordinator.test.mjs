import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile('apps-script/registry-coordinator.gs','utf8');
test('first write after reconnect clears actual trailing rows, not only cached sizes',()=>{
 const account={uid:'a',version:3,revision:0,connection:{spreadsheetId:'sheet-a',folderId:'folder-a',status:'ready'},sizes:{}};let write=null;
 const sheet={getDataRange:()=>({getValues:()=>[['user_id','json'],['a',JSON.stringify(account)]]}),getRange:()=>({setValues:()=>{},setValue:()=>{}}),getLastRow:()=>2};
 const context={LockService:{getScriptLock:()=>({tryLock:()=>true,hasLock:()=>true,releaseLock:()=>{}})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='REGISTRY_SECRET'?'secret':'registry-sheet'})},SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush:()=>{}},UrlFetchApp:{fetch:(url,options)=>{if(url.includes('values:batchGet'))return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({valueRanges:[{values:[['id','owner_id','title'],['e1','a','keep'],['e2','a','delete']]}]})};write=JSON.parse(options.payload);return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({})};}},ContentService:{MimeType:{JSON:'json'},createTextOutput:x=>({setMimeType:()=>x})},Date,JSON,Array};
 vm.createContext(context);vm.runInContext(source,context);
 const result=JSON.parse(context.doPost({postData:{contents:JSON.stringify({secret:'secret',action:'saveData',uid:'a',connectionVersion:3,expectedRevision:0,accessToken:'token',ranges:{events:[['id','owner_id','title'],['e1','a','keep']]}})}}));
 assert.equal(result.error,undefined);assert.equal(write.data[0].values.length,3);assert.deepEqual(write.data[0].values[2],['','','']);
});
