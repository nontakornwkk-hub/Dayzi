import test from 'node:test';
import assert from 'node:assert/strict';
import {OAuth2Client} from 'google-auth-library';
import handler from '../server/api.mjs';
import {signSession,verifySession,encryptSecret} from '../server/security.mjs';

test('Google reconnect keeps LINE identity, refresh token and existing storage and updates the profile',async t=>{
 const vars={SESSION_SECRET:'test-secret',TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,1).toString('base64'),REGISTRY_URL:'https://registry.example/exec',REGISTRY_SECRET:'secret',GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'client-secret'};
 const prior=Object.fromEntries(Object.keys(vars).map(k=>[k,process.env[k]]));Object.assign(process.env,vars);
 const uid='line:U'+'a'.repeat(32),calls=[];
 const existing={uid,name:'ต้น',authProvider:'line',email:'me@example.com',encryptedToken:encryptSecret('existing-refresh',uid,vars.TOKEN_ENCRYPTION_KEY),connection:{status:'ready',auth:'oauth',spreadsheetId:'existing-sheet',folderId:'existing-folder'}};
 t.mock.method(OAuth2Client.prototype,'getToken',async()=>({tokens:{access_token:'access',id_token:'verified-id'}}));
 t.mock.method(OAuth2Client.prototype,'verifyIdToken',async()=>({getPayload:()=>({sub:'google-id',email:'me@example.com',email_verified:true,name:'ต้น Google',picture:'https://lh3.googleusercontent.com/photo'})}));
 t.mock.method(globalThis,'fetch',async(url,options)=>{assert.equal(String(url),vars.REGISTRY_URL);const p=JSON.parse(options.body);calls.push(p);return Response.json(p.action==='get'?existing:{ok:true});});
 try{
  const state=signSession({sub:'state',verifier:'verifier',link:uid,linkSession:true},vars.SESSION_SECRET);
  const originalSession=signSession({sub:uid,provider:'line'},vars.SESSION_SECRET);
  const r=await handler(new Request('https://dayzi.test/api/google/callback?state=state&code=code',{headers:{Cookie:'dayzi_oauth='+state+'; dayzi_session='+originalSession}}));
  assert.equal(r.headers.get('location'),'/?googleLinked=1');
  assert.deepEqual(calls.map(p=>p.action),['get','oauth']);assert.equal(calls[1].encryptedToken,existing.encryptedToken);
  const cookie=r.headers.getSetCookie().find(c=>c.startsWith('dayzi_session='));assert.ok(cookie);
  const session=verifySession(cookie.split(';')[0].slice('dayzi_session='.length),vars.SESSION_SECRET);
  assert.equal(session.sub,uid);assert.equal(session.provider,'line');assert.equal(session.picture,'https://lh3.googleusercontent.com/photo');
  const count=calls.length,otherSession=signSession({sub:'line:U'+'b'.repeat(32),provider:'line'},vars.SESSION_SECRET);
  const switched=await handler(new Request('https://dayzi.test/api/google/callback?state=state&code=code',{headers:{Cookie:'dayzi_oauth='+state+'; dayzi_session='+otherSession}}));
  assert.equal(switched.headers.get('location'),'/?error=google');assert.equal(calls.length,count);assert.equal(switched.headers.getSetCookie().some(c=>c.startsWith('dayzi_session=')),false);
 }finally{for(const [k,v]of Object.entries(prior))if(v===undefined)delete process.env[k];else process.env[k]=v;}
});
