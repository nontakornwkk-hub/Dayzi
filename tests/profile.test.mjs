import test from 'node:test';
import assert from 'node:assert/strict';
import {safeProfilePicture} from '../src/profile.mjs';
import {validateLineClaims,lineProfilePicture} from '../server/line.mjs';

test('only HTTPS profile images from Google or LINE are accepted',()=>{
 for(const url of ['https://lh3.googleusercontent.com/a/photo','https://profile.line-scdn.net/photo'])assert.equal(safeProfilePicture(url),url);
 for(const url of ['javascript:alert(1)','http://lh3.googleusercontent.com/a','https://evil.test/a','https://lh3.googleusercontent.com.evil.test/a','https://user:pass@lh3.googleusercontent.com/a',null])assert.equal(safeProfilePicture(url),'');
});
test('existing LINE sessions can retrieve their profile photo without logging in again',async t=>{
 const id='U'+'a'.repeat(32),old=process.env.LINE_CHANNEL_ACCESS_TOKEN;process.env.LINE_CHANNEL_ACCESS_TOKEN='bot-token';
 t.mock.method(globalThis,'fetch',async(url,options)=>{assert.equal(url,'https://api.line.me/v2/bot/profile/'+id);assert.equal(options.headers.Authorization,'Bearer bot-token');return Response.json({userId:id,pictureUrl:'https://profile.line-scdn.net/current'});});
 try{assert.equal(await lineProfilePicture(id),'https://profile.line-scdn.net/current');assert.equal(await lineProfilePicture('invalid'),'');}finally{if(old===undefined)delete process.env.LINE_CHANNEL_ACCESS_TOKEN;else process.env.LINE_CHANNEL_ACCESS_TOKEN=old;}
});
test('verified LINE profile retains its photo',()=>{
 const profile=validateLineClaims({iss:'https://access.line.me',aud:'123',sub:'U'+'a'.repeat(32),exp:2000,nonce:'n',picture:'https://profile.line-scdn.net/photo'},{channelId:'123',nonce:'n',now:1000});
 assert.equal(profile.picture,'https://profile.line-scdn.net/photo');
});
