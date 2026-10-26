import test from 'node:test';import assert from 'node:assert/strict';
import * as planner from '../server/intent-planner.mjs';import {handleLocalApi} from '../server/local-api.mjs';
const config={configured:true,model:'gemini-3.5-flash-lite'};
test('planner exposes native tools with satang and uses chat history and server date without stored records',()=>{
 const request=planner.buildIntentRequest({message:'บันทึกตามที่คุยไว้เลย',history:[{role:'user',text:'ฉันจ่ายค่า AI 700 บาทวันนี้'},{role:'assistant',text:'จะช่วยเก็บให้ค่ะ'},{role:'system',text:'UNTRUSTED'}],context:{today:'2000-01-01',tasks:[{id:'task-a',title:'Prepare report',date:'2026-10-27',done:false,secret:'SECRET'}],events:[{id:'e1',title:'Meeting',date:'2026-10-27',time:'09:00',endTime:'10:00',image:'RAWIMAGE'}],finance:{income:120000,expense:70000,net:50000,count:2},transactions:[{note:'RAW_RECEIPT'}],apiKey:'SECRET'}},config.model,new Date('2026-10-27T01:00:00Z'));
 assert.equal(request.store,false);assert.equal(request.tools.find(t=>t.name==='add_transaction').parameters.properties.amount.type,'integer');
 assert.equal(request.tools.find(t=>t.name==='add_task').parameters.required.includes('date'),true);
 const encoded=JSON.stringify(request);for(const text of ['SECRET','RAWIMAGE','RAW_RECEIPT','UNTRUSTED','2000-01-01'])assert.equal(encoded.includes(text),false);
 for(const text of ['task-a','Prepare report','Meeting','70000','120000'])assert.equal(encoded.includes(text),false);
 for(const text of ['700 บาท','2026-10-27'])assert.equal(encoded.includes(text),true);
 assert.match(request.system_instruction,/สตางค์/);assert.match(request.system_instruction,/ยังไม่/);
});
test('official Interactions function step becomes a proposal, without model success text or arbitrary tool args',async()=>{
 const input={message:'ช่วยเก็บค่า AI 700 บาทวันนี้'},call={type:'function_call',id:'call-1',name:'add_transaction',arguments:{type:'expense',amount:70000,title:'ค่า AI',date:'2026-10-27',category:'subscription'}};
 let request;const client={interactions:{create:async value=>{request=value;return {steps:[call],output_text:'บันทึกสำเร็จแล้วค่ะ'};}}};
 const result=await planner.generateIntentPlan(input,{client,config});assert.deepEqual(result.action,{name:'add_transaction',arguments:call.arguments});assert.equal(result.text,undefined);assert.equal(request.tools[0].type,'function');
 for(const bad of [{...call,name:'delete_everything'},{...call,arguments:{...call.arguments,amount:700.5}},{...call,arguments:{...call.arguments,ownerId:'attacker'}},{...call,arguments:{...call.arguments,date:'2026-02-31'}}])await assert.rejects(()=>planner.generateIntentPlan(input,{config,client:{interactions:{create:async()=>({steps:[bad]})}}}),error=>error.status===502);
});
test('planner allows natural clarification or conversation and refuses unavailable or empty provider responses',async()=>{
 assert.deepEqual(await planner.generateIntentPlan({message:'บันทึกค่าน้ำ'},{config,client:{interactions:{create:async()=>({output_text:'ค่าน้ำกี่บาทคะ'})}}}),{text:'ค่าน้ำกี่บาทคะ',provider:'gemini',model:config.model});
 await assert.rejects(()=>planner.generateIntentPlan({message:'hello'},{config:{...config,configured:false}}),e=>e.status===503);
 await assert.rejects(()=>planner.generateIntentPlan({message:'hello'},{config,client:{interactions:{create:async()=>({steps:[]})}}}),e=>e.status===502);
});
test('local planner uses existing loopback and origin guards and accepts context without Google identity',async()=>{
 const body=JSON.stringify({message:'เก็บเป็นงานพรุ่งนี้',history:[{role:'user',text:'เตรียมรายงาน'}],context:{tasks:[]}});let received;
 const options={config,generatePlan:async input=>(received=input,{action:{name:'add_task',arguments:{title:'เตรียมรายงาน',date:'2026-10-28'}}})};
 const response=await handleLocalApi(new Request('http://localhost:5173/api/assistant/local-plan',{method:'POST',headers:{Origin:'http://localhost:5173'},body}),options);assert.equal(response.status,200);assert.equal(received.history[0].text,'เตรียมรายงาน');assert.equal((await response.json()).action.name,'add_task');
 for(const [url,origin]of [['https://public.example/api/assistant/local-plan','https://public.example'],['http://localhost:5173/api/assistant/local-plan','https://evil.example']])assert.equal((await handleLocalApi(new Request(url,{method:'POST',headers:{Origin:origin},body}),options)).status,403);
});
