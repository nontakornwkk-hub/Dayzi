import test from 'node:test'; import assert from 'node:assert/strict';
const security=await import('../server/security.mjs').catch(()=>({}));
test('signed sessions reject modification and expiry',()=>{
  assert.equal(typeof security.signSession,'function');
  const token=security.signSession({sub:'user-a'},'test-key',1000);
  assert.equal(security.verifySession(token,'test-key',1001).sub,'user-a');
  assert.throws(()=>security.verifySession(token+'x','test-key',1001));
  assert.throws(()=>security.verifySession(token,'test-key',1000+86401));
});
test('credential encryption binds ciphertext to the owning user',()=>{
  assert.equal(typeof security.encryptSecret,'function'); const key=Buffer.alloc(32,7).toString('base64');
  const enc=security.encryptSecret('refresh-token','user-a',key);
  assert.equal(security.decryptSecret(enc,'user-a',key),'refresh-token');
  assert.throws(()=>security.decryptSecret(enc,'user-b',key));
});
test('only verified owner can resolve a stored file',()=>{
  assert.equal(typeof security.ownedFile,'function');
  assert.throws(()=>security.ownedFile([{id:'x',ownerId:'user-b',driveId:'drive-b'}],'x','user-a'));
  assert.equal(security.ownedFile([{id:'x',ownerId:'user-a',driveId:'drive-a'}],'x','user-a').driveId,'drive-a');
});
