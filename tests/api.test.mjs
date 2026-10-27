import test from 'node:test';import assert from 'node:assert/strict';
import handler from '../server/api.mjs';
import {signSession} from '../server/security.mjs';
test('unconfigured live API reports setup state without exposing accounts or credentials',async()=>{
 const response=await handler(new Request('https://dayzi.test/api/status'));
 assert.equal(response.status,200);const payload=await response.json();assert.equal(payload.user,null);assert.equal(payload.config.google,false);assert.equal(payload.connection,null);
 assert.equal(JSON.stringify(payload).includes('encryptedToken'),false);
});
test('cross-origin write is rejected before reaching user storage',async()=>{
 const response=await handler(new Request('https://dayzi.test/api/data',{method:'PUT',headers:{Origin:'https://attacker.test','Content-Type':'application/json'},body:'{}'}));assert.equal(response.status,403);
});
test('Google setup cannot pretend to succeed without configured credentials',async()=>{
 const response=await handler(new Request('https://dayzi.test/api/google/start'));assert.equal(response.status,503);assert.equal(response.headers.get('set-cookie'),null);
});
test('LINE sessions work without Google user OAuth and can never request the system Google token',async()=>{
 const keys=['SESSION_SECRET','TOKEN_ENCRYPTION_KEY','REGISTRY_URL','REGISTRY_SECRET'];const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));const oldFetch=globalThis.fetch;const actions=[];
 try{for(const key of keys)process.env[key]=key==='REGISTRY_URL'?'https://registry.example/exec':'test-secret';globalThis.fetch=async(url,options)=>{const p=JSON.parse(options.body);actions.push(p.action);return Response.json({uid:'line:U'+'a'.repeat(32),authProvider:'line',name:'LINE user',version:1,connection:{status:'ready',spreadsheetId:'personal-sheet',folderId:'personal-folder'}});};
  const session=signSession({sub:'line:U'+'a'.repeat(32),name:'LINE user',provider:'line'},'test-secret');
  const status=await handler(new Request('https://dayzi.test/api/status',{headers:{Cookie:`dayzi_session=${session}`}}));const data=await status.json();assert.equal(data.user.provider,'line');assert.equal(data.config.google,false);
  const token=await handler(new Request('https://dayzi.test/api/picker-token',{headers:{Cookie:`dayzi_session=${session}`}}));assert.equal(token.status,403);assert.equal(actions.includes('ownerToken'),false);
  const relink=await handler(new Request('https://dayzi.test/api/line/link',{method:'POST',headers:{Cookie:`dayzi_session=${session}`,Origin:'https://dayzi.test'}}));assert.equal(relink.status,403);assert.equal(actions.includes('linkCode'),false);
 }finally{globalThis.fetch=oldFetch;for(const key of keys)if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}
});
test('a phone or installed app signs in by confirming in the LINE app, once, for a long-lived session',async()=>{
 const keys=['SESSION_SECRET','TOKEN_ENCRYPTION_KEY','REGISTRY_URL','REGISTRY_SECRET','LINE_LOGIN_CHANNEL_ID','LINE_LOGIN_CHANNEL_SECRET','LINE_CHANNEL_ACCESS_TOKEN','LINE_CHANNEL_SECRET','LINE_BOT_ID'];const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));const oldFetch=globalThis.fetch;const rows={};const uid='line:U'+'b'.repeat(32);
 try{for(const key of keys)process.env[key]=key==='REGISTRY_URL'?'https://registry.example/exec':key==='LINE_BOT_ID'?'@dayzi':'test-secret';
  globalThis.fetch=async(url,options)=>{const p=JSON.parse(options.body);if(p.action==='linkCode'){rows[p.uid]={linkCode:{code:p.code,expires:Date.now()+600000}};return Response.json({ok:true});}if(p.action==='get')return Response.json(rows[p.uid]??null);if(p.action==='lineOnboard')return Response.json({uid:p.uid,name:'คุณบี',authProvider:'line'});return Response.json({});};
  const start=await handler(new Request('https://dayzi.test/api/line/handoff',{method:'POST'}));const {id,url}=await start.json();
  assert.match(id,/^[a-f0-9]{24}$/);assert.ok(url.startsWith('https://line.me/R/oaMessage/%40dayzi/?'));assert.ok(decodeURIComponent(url).endsWith('เข้าสู่ระบบ '+id));
  const ticket=start.headers.get('set-cookie').match(/dayzi_handoff=([^;]+)/)[1],poll=()=>handler(new Request('https://dayzi.test/api/line/handoff',{headers:{Cookie:`dayzi_handoff=${ticket}`}}));
  assert.deepEqual(await (await poll()).json(),{pending:true});
  assert.equal((await handler(new Request('https://dayzi.test/api/line/handoff'))).status,410);
  rows['handoff:'+id]={linkCode:{code:uid,expires:Date.now()+600000}};
  const done=await poll();assert.deepEqual(await done.json(),{ok:true});const cookies=done.headers.getSetCookie();
  const session=cookies.find(c=>c.startsWith('dayzi_session='));assert.match(session,/Max-Age=15552000/);
  const status=await handler(new Request('https://dayzi.test/api/status',{headers:{Cookie:session.split(';')[0]}}));assert.equal((await status.json()).user.sub,uid);
  assert.deepEqual(await (await poll()).json(),{pending:true},'a confirmation is used only once');
 }finally{globalThis.fetch=oldFetch;for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}}
});
