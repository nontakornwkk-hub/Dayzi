import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
import * as bridge from '../server/personal-sheet.mjs';
import handler from '../server/api.mjs';
const deploymentUrl='https://script.google.com/macros/s/ABCDEFGHIJKLMNO/exec',secret='private-test-secret-1234';
test('personal bridge rejects unsafe URLs before any network call',async()=>{
 let calls=0;for(const url of ['https://evil.test/macros/s/ABC/exec','http://script.google.com/macros/s/ABC/exec','https://x@script.google.com/macros/s/ABC/exec',deploymentUrl+'?secret=x',deploymentUrl+'#x','https://script.google.com:444/macros/s/ABC/exec','https://script.google.com/macros/s/../exec'])await assert.rejects(()=>bridge.personalSheetRequest({deploymentUrl:url,secret,action:'read'},async()=>{calls++;}),e=>e.status===400);assert.equal(calls,0);
});
test('bridge redirects only to Google content, never forwards secret, and strips extra response keys',async()=>{
 const calls=[];const result=await bridge.personalSheetRequest({deploymentUrl,secret,action:'read'},async(url,options)=>{calls.push({url,options});if(calls.length===1)return new Response(null,{status:302,headers:{Location:'https://script.googleusercontent.com/macros/echo?key=123'}});return Response.json({ownerId:'personal-owner',data:{events:[],tasks:[],notes:[],files:[],transactions:[],settings:{},delivered:{}},revision:0,secret:'do not expose',encryptedToken:'bad'});});
 assert.equal(calls[0].options.redirect,'manual');assert.equal(JSON.parse(calls[0].options.body).secret,secret);assert.equal(calls[1].options.method,'GET');assert.equal(calls[1].options.body,undefined);assert.equal(result.secret,undefined);assert.equal(result.encryptedToken,undefined);assert.equal(result.ownerId,'personal-owner');
 await assert.rejects(()=>bridge.personalSheetRequest({deploymentUrl,secret,action:'read'},async()=>new Response(null,{status:302,headers:{Location:'http://127.0.0.1/private'}})),e=>e.status===502);
 await assert.rejects(()=>bridge.personalSheetRequest({deploymentUrl,secret,action:'read'},async()=>Response.json({error:'secret='+secret,status:401})),e=>e.status===401&&!e.message.includes(secret));
});
test('personal bridge endpoint works without registry configuration and rejects cross-origin requests',async()=>{
 const old=globalThis.fetch;try{globalThis.fetch=async()=>Response.json({chats:[],secret});const response=await handler(new Request('https://dayzi.test/api/personal-sheet',{method:'POST',headers:{Origin:'https://dayzi.test'},body:JSON.stringify({deploymentUrl,secret,action:'chats'})}));assert.equal(response.status,200);assert.deepEqual(await response.json(),{chats:[]});const denied=await handler(new Request('https://dayzi.test/api/personal-sheet',{method:'POST',headers:{Origin:'https://evil.test'},body:'{}'}));assert.equal(denied.status,403);}finally{globalThis.fetch=old;}
});
const source=await readFile('apps-script/personal-sheet.gs','utf8');
function script(){
 const tabs=new Map(),props=new Map([['DAYZI_SHEET_ID','own-sheet'],['DAYZI_SECRET',secret],['DAYZI_OWNER_ID','personal-owner'],['DAYZI_REVISION','0']]);let locked=false;
 function tab(){const values=[];return {values,getLastRow:()=>values.length,getDataRange:()=>({getValues:()=>values.length?values:[['']]}),getRange:(row,col,count,width)=>({getValues:()=>Array.from({length:count},(_,i)=>Array.from({length:width},(_,j)=>values[row-1+i]?.[col-1+j]??'')),setValues:rows=>rows.forEach((r,i)=>{values[row-1+i]??=[];r.forEach((v,j)=>{values[row-1+i][col-1+j]=v;});}),clearContent:()=>{for(let i=0;i<count;i++)for(let j=0;j<width;j++)if(values[row-1+i])values[row-1+i][col-1+j]='';}})};}
 const book={getId:()=> 'own-sheet',getSheetByName:name=>tabs.get(name),insertSheet:name=>{const t=tab();tabs.set(name,t);return t;}};
 const context={PropertiesService:{getScriptProperties:()=>({getProperty:key=>props.get(key),setProperty:(key,value)=>props.set(key,value)})},SpreadsheetApp:{getActiveSpreadsheet:()=>book,openById:id=>{assert.equal(id,'own-sheet');return book;},flush:()=>{}},LockService:{getScriptLock:()=>({tryLock:()=>{locked=true;return true;},hasLock:()=>locked,releaseLock:()=>{locked=false;}})},ContentService:{MimeType:{JSON:'json'},createTextOutput:value=>({setMimeType:()=>value})},JSON,Date,Array,Object,Number,isFinite};vm.createContext(context);vm.runInContext(source,context);
 return {tabs,props,run:request=>JSON.parse(context.doPost({postData:{contents:JSON.stringify({secret,...request})}}))};
}
test('personal workbook RPC authenticates, binds ownership and separates chat writes from app revision',()=>{
 const s=script();assert.equal(s.run({secret:'wrong',action:'read'}).status,401);
 const initial=s.run({action:'read'});assert.equal(initial.ownerId,'personal-owner');assert.equal(initial.revision,0);assert.deepEqual(initial.data.tasks,[]);
 const data={events:[],tasks:[{id:'t',ownerId:'attacker',title:'=IMPORTDATA("bad")'}],notes:[],files:[],transactions:[],settings:{name:'Me'},delivered:{}};
 assert.equal(s.run({action:'write',payload:{data,expectedRevision:0}}).revision,1);
 assert.equal(s.run({action:'write',payload:{data,expectedRevision:0}}).status,409);
 assert.equal(s.run({action:'read'}).data.tasks[0].ownerId,'personal-owner');
 const row=s.tabs.get('dayzi_tasks').values[1];assert.equal(row[1],'personal-owner');assert.equal(row[2].startsWith('{'),true);
 const chat={id:'c',title:'Chat',updatedAt:1,messages:[{role:'user',text:'Hello',attachments:[{id:'f',name:'f.png',mimeType:'image/png',base64:'SECRET',url:'blob:bad',local:true}]}]};
 assert.equal(s.run({action:'saveChat',payload:{chat}}).chat.id,'c');assert.equal(s.run({action:'read'}).revision,1);
 assert.equal(JSON.stringify(s.run({action:'chats'})).includes('SECRET'),false);
 assert.equal(s.run({action:'saveChat',payload:{deletedId:'c'}}).deletedId,'c');assert.deepEqual(s.run({action:'chats'}).chats,[]);
 assert.equal(s.run({action:'write',payload:{expectedRevision:1,data:{...data,tasks:[{id:'huge',title:'x'.repeat(45001)}]}}}).status,400);
});
test('personal writes preserve existing tabs on schema or owner conflicts and reject formula ids',()=>{
 const s=script(),data={tasks:[{id:'t',title:'Keep'}],settings:{name:'Me'}};
 assert.equal(s.run({action:'write',payload:{data,expectedRevision:0}}).revision,1);
 const tasks=s.tabs.get('dayzi_tasks').values;
 s.tabs.get('dayzi_settings').values[0]=['unrelated','business','records'];
 assert.equal(s.run({action:'write',payload:{data:{...data,tasks:[]},expectedRevision:1}}).status,409);
 assert.equal(tasks[1][0],'t');assert.equal(s.props.get('DAYZI_REVISION'),'1');
 s.tabs.get('dayzi_settings').values[0]=['id','owner_id','json'];tasks[1][1]='another-person';
 assert.equal(s.run({action:'write',payload:{data:{...data,tasks:[]},expectedRevision:1}}).status,403);assert.equal(tasks[1][0],'t');
 assert.equal(s.run({action:'write',payload:{data:{tasks:[{id:'=IMPORTDATA("bad")',title:'bad'}]},expectedRevision:1}}).status,400);
});
