import test from 'node:test';import assert from 'node:assert/strict';
const line=await import('../server/line.mjs').catch(()=>({}));
const sub='U'+'a'.repeat(32);
test('LINE authorization uses verified login with state, nonce and PKCE, not a typed user ID',()=>{
 assert.equal(typeof line.lineAuthorizationUrl,'function');
 const url=new URL(line.lineAuthorizationUrl('http://localhost:5173',{state:'state',nonce:'nonce',verifier:'verifier'},{channelId:'123'}));
 assert.equal(url.hostname,'access.line.me');assert.equal(url.searchParams.get('state'),'state');assert.equal(url.searchParams.get('nonce'),'nonce');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('bot_prompt'),'aggressive');assert.match(url.searchParams.get('redirect_uri'),/\/api\/line\/callback$/);
});
test('LINE identity rejects other channels, bad issuers, nonce mismatch and expired tokens',()=>{
 assert.equal(typeof line.validateLineClaims,'function');
 const valid={iss:'https://access.line.me',aud:'123',sub,exp:2000,nonce:'nonce',name:'ผู้ใช้ LINE'};
 assert.equal(line.validateLineClaims(valid,{channelId:'123',nonce:'nonce',now:1000}).uid,'line:'+sub);
 for(const patch of [{aud:'other'},{iss:'https://evil.example'},{nonce:'wrong'},{exp:500},{exp:undefined},{sub:'forged'}])assert.throws(()=>line.validateLineClaims({...valid,...patch},{channelId:'123',nonce:'nonce',now:1000}));
});
test('drafts can be carried through LINE login without accepting arbitrary redirect destinations',()=>{
 assert.equal(typeof line.safeLineDraft,'function');
 assert.deepEqual(line.safeLineDraft(JSON.stringify({title:'นัดลูกค้า',date:'2026-10-27',time:'14:00',category:'meeting',redirect:'https://evil.test'})),{title:'นัดลูกค้า',date:'2026-10-27',time:'14:00',category:'meeting'});
 assert.equal(line.safeLineDraft('{"date":"2026-99-99"}'),null);
});
