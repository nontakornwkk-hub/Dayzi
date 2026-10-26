import test from 'node:test';import assert from 'node:assert/strict';
const slug=await import('../api/[...slug].mjs'),cron=await import('../api/cron/reminders.mjs');
test('Vercel catch-all route serves every HTTP method through the shared API handler',async()=>{
 for(const method of ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'])assert.equal(typeof slug[method],'function',method);
 const response=await slug.GET(new Request('https://dayzi.example/api/status'));
 assert.equal(response.status,200);const body=await response.json();assert.equal(body.user,null);assert.equal(typeof body.config,'object');
 const crossOrigin=await slug.PUT(new Request('https://dayzi.example/api/data',{method:'PUT',headers:{Origin:'https://attacker.example','Content-Type':'application/json'},body:'{}'}));
 assert.ok([401,403,503].includes(crossOrigin.status));
});
test('reminder endpoint refuses callers without the shared secret',async()=>{
 assert.equal((await cron.POST(new Request('https://dayzi.example/api/cron/reminders',{method:'POST'}))).status,401);
 assert.equal((await cron.GET(new Request('https://dayzi.example/api/cron/reminders',{headers:{authorization:'Bearer wrong'}}))).status,401);
});
