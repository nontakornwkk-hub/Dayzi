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
