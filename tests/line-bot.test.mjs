import test from 'node:test';import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';
const bot=await import('../server/line-bot.mjs').catch(()=>({}));
process.env.SESSION_SECRET??='test-session-secret';process.env.GOOGLE_CLIENT_ID??='test-client';process.env.GOOGLE_CLIENT_SECRET??='test-secret';
const lineId='U'+'a'.repeat(32),uid='line:'+lineId;
test('redelivered LINE expense message does not create a second ledger entry',async()=>{
 const {decodeData}=await import('../server/google.mjs');let saves=0;
 let data={events:[],tasks:[],notes:[],files:[],transactions:[],settings:{},delivered:{}};
 const account={uid,version:1,revision:0,connection:{status:'ready'}};
 const options={origin:'https://dayzi.test',channelSecret:'secret',channelToken:'token',registry:async(action,owner,payload)=>{if(action==='saveData'){data=decodeData(payload.ranges,uid);saves++;}return account;},accountData:async()=>({data,token:'t'}),fetch:async()=>new Response('{}')};
 const events=[{type:'message',webhookEventId:'event-one',source:{type:'user',userId:lineId},replyToken:'r',message:{id:'message-one',type:'text',text:'จ่ายค่าข้าว 65 บาท'}}];
 await bot.handleLineWebhook(request(events),options);await bot.handleLineWebhook(request(events),options);
 assert.equal(data.transactions.length,1);assert.equal(saves,1);
});
test('LINE task commands save directly and return a done button without consuming AI',async()=>{
 let reply,saved;const actions=[];const account={uid,version:1,revision:0,connection:{status:'ready'}};
 await bot.handleLineWebhook(request([{type:'message',source:{type:'user',userId:lineId},replyToken:'r',message:{type:'text',text:'เพิ่มงาน ส่งรายงาน พรุ่งนี้'}}]),{origin:'https://dayzi.test',channelSecret:'secret',channelToken:'token',geminiReady:true,registry:async(action,owner,payload)=>{actions.push(action);if(action==='saveData')saved=payload;return account;},accountData:async()=>({token:'t',data:{events:[],tasks:[],notes:[],files:[],settings:{},delivered:{}}}),generateReply:async()=>{throw new Error('must not call AI');},fetch:async(url,options)=>{reply=JSON.parse(options.body);return new Response('{}');}});
 assert.ok(saved?.ranges.tasks[1]);assert.equal(actions.includes('aiQuota'),false);assert.equal(reply.messages[0].type,'flex');assert.match(JSON.stringify(reply.messages[0]),/ทำเสร็จแล้ว/);
});
test('LINE done postback only updates a task in the verified owner data',async()=>{
 let saved,reply;const account={uid,version:1,revision:0,connection:{status:'ready'}};
 const options={origin:'https://dayzi.test',channelSecret:'secret',channelToken:'token',registry:async(action,owner,payload)=>{if(action==='saveData')saved=payload;return account;},accountData:async()=>({token:'t',data:{events:[],tasks:[{id:'mine',title:'Task',date:'2026-10-27',done:false}],notes:[],files:[],settings:{}}}),fetch:async(url,options)=>{reply=JSON.parse(options.body);return new Response('{}');}};
 const postback=id=>request([{type:'postback',source:{type:'user',userId:lineId},replyToken:'r',postback:{data:JSON.stringify({action:'task-done',id})}}]);
 await bot.handleLineWebhook(postback('somebody-else'),options);assert.equal(saved,undefined);
 await bot.handleLineWebhook(postback('mine'),options);assert.equal(saved.ranges.tasks[1][4],true);assert.match(reply.messages[0].text,/เสร็จ/);
});
test('LINE media does not retain a short timeout while waiting for Drive backpressure',async()=>{
 let mediaSignal;
 const account={uid,authProvider:'line',version:1,connection:{status:'ready'}};
 await bot.handleLineWebhook(request([{type:'message',source:{type:'user',userId:lineId},replyToken:'r',message:{type:'file',id:'media-1'}}]),{origin:'https://dayzi.test',channelSecret:'secret',channelToken:'token',registry:async()=>account,accountData:async()=>({data:{files:[]},token:'t'}),fetch:async(url,options)=>{if(url.includes('api-data.line.me')){mediaSignal=options.signal;throw new Error('stop before cloud upload');}return new Response('{}');}});
 assert.equal(mediaSignal,undefined);
});
test('appointment done buttons update only owned nonrecurring appointments and are idempotent',async()=>{
 const {decodeData}=await import('../server/google.mjs');let saves=0;
 let data={events:[{id:'mine',title:'ประชุม',date:'2026-10-27',time:'14:00',endTime:'15:00',status:'active',repeat:'none'},{id:'recurring',title:'ทุกสัปดาห์',date:'2026-10-27',time:'14:00',endTime:'15:00',status:'active',repeat:'weekly'}],tasks:[],files:[],notes:[],settings:{}};
 const account={uid,version:1,revision:0,connection:{status:'ready'}};
 const options={origin:'https://dayzi.test',channelSecret:'secret',channelToken:'token',registry:async(action,owner,payload)=>{if(action==='saveData'){data=decodeData(payload.ranges,uid);saves++;}return account;},accountData:async()=>({data,token:'t'}),fetch:async()=>new Response('{}')};
 const postback=id=>request([{type:'postback',source:{type:'user',userId:lineId},replyToken:'r',postback:{data:JSON.stringify({action:'event-done',id})}}]);
 await bot.handleLineWebhook(postback('foreign'),options);await bot.handleLineWebhook(postback('recurring'),options);assert.equal(saves,0);
 await bot.handleLineWebhook(postback('mine'),options);await bot.handleLineWebhook(postback('mine'),options);
 assert.equal(saves,1);assert.equal(data.events[0].status,'done');assert.equal(data.events[1].status,'active');
});
test('deterministic appointment, finance and daily queries return branded Flex cards without AI',async()=>{
 for(const text of ['เพิ่มนัด ประชุม พรุ่งนี้ 14:00','จ่ายค่าข้าว 65 บาท','วันนี้มีนัดและงานอะไรบ้าง']){
  let reply;const actions=[];const account={uid,version:1,revision:0,connection:{status:'ready'}};
  await bot.handleLineWebhook(request([{type:'message',source:{type:'user',userId:lineId},replyToken:'r',message:{id:'m',type:'text',text}}]),{origin:'https://dayzi.test',channelSecret:'secret',channelToken:'token',geminiReady:true,registry:async action=>{actions.push(action);return account;},accountData:async()=>({data:{events:[],tasks:[],notes:[],files:[],transactions:[],settings:{},delivered:{}},token:'t'}),fetch:async(url,options)=>{reply=JSON.parse(options.body);return new Response('{}');}});
  assert.equal(reply.messages[0].type,'flex',text);assert.match(JSON.stringify(reply),/dayzi-card-mascot.png/);assert.equal(actions.includes('aiQuota'),false);
 }
});
function request(events,signature=true){const raw=JSON.stringify({events});return new Request('https://dayzi.test/api/line/webhook',{method:'POST',headers:{'x-line-signature':signature?createHmac('sha256','secret').update(raw).digest('base64'):'invalid'},body:raw});}
test('LINE bot rejects unsigned identities before accessing any account',async()=>{
 assert.equal(typeof bot.handleLineWebhook,'function');let called=false;
 const r=await bot.handleLineWebhook(request([],false),{channelSecret:'secret',channelToken:'token',registry:async()=>{called=true;}});
 assert.equal(r.status,401);assert.equal(called,false);
});
test('adding the bot creates only an empty account and asks the friend to connect their own Google',async()=>{
 assert.equal(typeof bot.handleLineWebhook,'function');const actions=[];let reply;
 const r=await bot.handleLineWebhook(request([{type:'follow',source:{type:'user',userId:lineId},replyToken:'r'}]),{origin:'https://dayzi.test',channelSecret:'secret',channelToken:'token',registry:async(action,id)=>{actions.push([action,id]);return {uid:id,authProvider:'line',version:1,connection:{status:'ready'}};},fetch:async(url,options)=>{reply=JSON.parse(options.body);return new Response('{}');}});
 assert.equal(r.status,200);assert.deepEqual(actions[0],['lineOnboard',uid]);assert.equal(reply.messages[0].type,'flex');const url=JSON.stringify(reply.messages[0]);assert.match(url,/dayzi\.test\/api\/google\/start\?link=/);assert.doesNotMatch(url,/ไม่ต้องเชื่อม Google/);
});
test('ordinary LINE conversation is answered by Gemini rather than converted into a work appointment',async()=>{
 assert.equal(typeof bot.handleLineWebhook,'function');let reply,modelInput;
 const account={uid,authProvider:'line',line:lineId,version:1,connection:{status:'ready'}};
 await bot.handleLineWebhook(request([{type:'message',source:{type:'user',userId:lineId},replyToken:'r',message:{type:'text',text:'ชอบแมวไหม คุยเล่นกัน'}}]),{origin:'https://dayzi.test',channelSecret:'secret',channelToken:'token',geminiReady:true,registry:async(action)=>action==='findLine'?account:{ok:true},accountData:async()=>({data:{events:[],tasks:[],files:[],settings:{},delivered:{}}}),generateReply:async input=>{modelInput=input;return {text:'แมวน่ารักมากค่ะ 🌼'};},encryptHistory:()=>'',fetch:async(url,options)=>{reply=JSON.parse(options.body);return new Response('{}');}});
 assert.equal(modelInput.message,'ชอบแมวไหม คุยเล่นกัน');assert.equal(reply.messages[0].text,'แมวน่ารักมากค่ะ 🌼');assert.doesNotMatch(reply.messages[0].text,/draft=/);
});

const freshAccount={uid,authProvider:'line',line:lineId,version:0,revision:0};
const send=(text,extra={})=>{let reply,calls=[];return bot.handleLineWebhook(request([{type:'message',source:{type:'user',userId:lineId},replyToken:'r',message:{type:'text',text}}]),{origin:'https://dayzi.test',channelSecret:'secret',channelToken:'token',geminiReady:true,registry:async action=>action==='findLine'?freshAccount:{ok:true},accountData:async()=>{calls.push('accountData');throw new Error('must not read storage');},encryptHistory:()=>'',fetch:async(url,options)=>{if(String(url).endsWith('/reply'))reply=JSON.parse(options.body);return new Response('{}');},...extra}).then(()=>({reply:reply?.messages[0],calls}));};
test('a friend without their own Google storage gets a connect card instead of a saved record',async()=>{
 for(const text of ['วันนี้มีนัดและงานอะไรบ้าง','เพิ่มงาน ซื้อนม พรุ่งนี้','จ่ายค่าข้าว 65 บาท']){const {reply,calls}=await send(text);assert.equal(reply.type,'flex',text);assert.match(JSON.stringify(reply),/api\/google\/start\?link=/);assert.deepEqual(calls,[]);}
});
test('Gemini proposals and file uploads also wait for the friend to connect, while plain chat still works',async()=>{
 const planned=await send('ช่วยจดนัดพรุ่งนี้ 10 โมง',{generatePlan:async()=>({action:{name:'add_event',arguments:{title:'นัด',date:'2026-10-28',time:'10:00',endTime:'11:00'}}})});
 assert.equal(planned.reply.type,'flex');assert.match(JSON.stringify(planned.reply),/api\/google\/start\?link=/);
 const chat=await send('ชอบแมวไหม',{generatePlan:async()=>({text:'ชอบมากค่ะ 🌼'})});assert.equal(chat.reply.text,'ชอบมากค่ะ 🌼');
 let reply;await bot.handleLineWebhook(request([{type:'message',source:{type:'user',userId:lineId},replyToken:'r',message:{id:'m1',type:'image'}}]),{origin:'https://dayzi.test',channelSecret:'secret',channelToken:'token',registry:async action=>action==='findLine'?freshAccount:{ok:true},accountData:async()=>{throw new Error('must not read storage');},fetch:async(url,options)=>{if(String(url).endsWith('/reply'))reply=JSON.parse(options.body);return new Response('{}');}});
 assert.equal(reply.messages[0].type,'flex');
});
test('confirm postbacks need a connected account but cancel does not',async()=>{
 const post=data=>{let reply;return bot.handleLineWebhook(request([{type:'postback',source:{type:'user',userId:lineId},replyToken:'r',postback:{data}}]),{origin:'https://dayzi.test',channelSecret:'secret',channelToken:'token',registry:async action=>action==='findLine'?freshAccount:{ok:true},accountData:async()=>{throw new Error('must not read storage');},fetch:async(url,options)=>{if(String(url).endsWith('/reply'))reply=JSON.parse(options.body);return new Response('{}');}}).then(()=>reply.messages[0]);};
 assert.equal((await post(JSON.stringify({a:'ok',n:'add_task',g:{title:'x',date:'2026-10-28'}}))).type,'flex');
 assert.match((await post(JSON.stringify({a:'cancel'}))).text,/ยกเลิกแล้ว/);
});
test('without Google sign-in configured the connect card opens web settings for the two-link setup',async()=>{
 const saved=[process.env.GOOGLE_CLIENT_ID,process.env.GOOGLE_CLIENT_SECRET];delete process.env.GOOGLE_CLIENT_ID;delete process.env.GOOGLE_CLIENT_SECRET;
 try{const {reply}=await send('เพิ่มงาน ซื้อนม พรุ่งนี้');const card=JSON.stringify(reply);assert.equal(reply.type,'flex');assert.ok(card.includes('https://dayzi.test/?page=settings'));assert.ok(!card.includes('google/start'));}
 finally{process.env.GOOGLE_CLIENT_ID=saved[0];process.env.GOOGLE_CLIENT_SECRET=saved[1];}
});
test('a sign-in request from another device needs a confirm tap before it is bound to this LINE account',async()=>{
 const id='c'.repeat(24),calls=[];let reply;const sign=body=>createHmac('sha256','secret').update(body).digest('base64');
 const send=events=>{const body=JSON.stringify({events});return bot.handleLineWebhook(new Request('https://dayzi.test/api/line/webhook',{method:'POST',headers:{'x-line-signature':sign(body)},body}),{origin:'https://dayzi.test',channelSecret:'secret',channelToken:'token',registry:async(action,owner,payload)=>{calls.push([action,owner,payload]);return {uid,connection:null};},fetch:async(url,options)=>{reply=JSON.parse(options.body);return new Response('{}');}});};
 await send([{type:'message',source:{type:'user',userId:lineId},replyToken:'r',message:{type:'text',text:'เข้าสู่ระบบ '+id}}]);
 assert.equal(reply.messages[0].template.type,'confirm');assert.equal(calls.some(c=>c[0]==='linkCode'),false);
 await send([{type:'postback',source:{type:'user',userId:lineId},replyToken:'r',postback:{data:JSON.stringify({a:'login',id})}}]);
 assert.deepEqual(calls.find(c=>c[0]==='linkCode'),['linkCode','handoff:'+id,{code:uid}]);assert.match(reply.messages[0].text,/เข้าสู่ระบบแล้ว/);
});
