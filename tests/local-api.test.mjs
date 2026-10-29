import test from 'node:test';import assert from 'node:assert/strict';
const local=await import('../server/local-api.mjs').catch(()=>({}));
const config={configured:true,model:'gemini-3.8-flash'};

test('local chat continues past 30 requests while retaining its short burst delay',async t=>{
 let now=Date.UTC(2035,0,1);t.mock.method(Date,'now',()=>now);
 const previous=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='test-key';
 t.mock.method(globalThis,'fetch',async()=>Response.json({status:'completed',steps:[{type:'model_output',content:[{type:'text',text:'พร้อมคุยค่ะ'}]}]}));
 const request=()=>new Request('http://localhost:5173/api/assistant/local',{method:'POST',headers:{Origin:'http://localhost:5173','Content-Type':'application/json'},body:JSON.stringify({message:'hello'})});
 try{for(let i=0;i<35;i++){now+=3000;const r=await local.handleLocalApi(request(),{config});assert.equal(r.status,200,'request '+(i+1));}assert.equal((await local.handleLocalApi(request(),{config})).status,429);}
 finally{if(previous===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=previous;}
});
test('local Gemini endpoint is refused from non-loopback hosts and cross-origin pages',async()=>{
 assert.equal(typeof local.handleLocalApi,'function');
 for(const [url,origin]of[['https://public.example/api/assistant/local','https://public.example'],['http://localhost:5173/api/assistant/local','https://attacker.example']]){
  const r=await local.handleLocalApi(new Request(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({message:'hello'})}),{config});assert.equal(r.status,403);
 }
});
test('local Gemini mode does not need a Google Sheets identity and never exposes credentials',async()=>{
 assert.equal(typeof local.handleLocalApi,'function');
 const cloudHandler=async()=>Response.json({user:null,connection:null,config:{google:false}});
 const r=await local.handleLocalApi(new Request('http://localhost:5173/api/status'),{config,cloudHandler});const data=await r.json();
 assert.equal(data.config.localAI,true);assert.equal(data.config.aiProvider,'gemini');assert.equal(data.user,null);assert.equal(data.config.google,false);
});
test('local assistant forwards bounded message and context through Gemini adapter',async()=>{
 assert.equal(typeof local.handleLocalApi,'function');let input;
 const request=new Request('http://localhost:5173/api/assistant/local',{method:'POST',headers:{Origin:'http://localhost:5173','Content-Type':'application/json'},body:JSON.stringify({message:'ช่วยจัดตาราง',context:{today:'2026-10-26'}})});
 const r=await local.handleLocalApi(request,{config,generateReply:async value=>(input=value,{text:'ได้ค่ะ',provider:'gemini',model:config.model})});
 assert.equal(r.status,200);assert.equal(input.message,'ช่วยจัดตาราง');assert.equal((await r.json()).provider,'gemini');
});
test('LINE webhooks pass to signature verification without a browser Origin but no other tunnel endpoint is opened',async()=>{
 let delegated=0;const cloudHandler=async()=>{delegated++;return Response.json({signatureChecked:true});};
 const webhook=await local.handleLocalApi(new Request('http://localhost:5173/api/line/webhook',{method:'POST',body:'{}'}),{config,cloudHandler});
 assert.equal(webhook.status,200);assert.equal(delegated,1);
 const tunnel=await local.handleLocalApi(new Request('https://dev-tunnel.example/api/line/webhook',{method:'POST',body:'{}'}),{config,cloudHandler,webhookHost:'dev-tunnel.example'});
 assert.equal(tunnel.status,200);assert.equal(delegated,2);
 const ai=await local.handleLocalApi(new Request('https://dev-tunnel.example/api/assistant/local',{method:'POST',headers:{Origin:'https://dev-tunnel.example'},body:'{}'}),{config,cloudHandler,webhookHost:'dev-tunnel.example'});
 assert.equal(ai.status,403);
});
