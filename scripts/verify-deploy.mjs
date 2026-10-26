import assert from 'node:assert/strict';
const base=process.argv[2]??process.env.SITE_URL;
if(!base)throw new Error('Pass the site URL as an argument or set SITE_URL');
const htmlResponse=await fetch(base,{signal:AbortSignal.timeout(30000)});assert.equal(htmlResponse.status,200);const html=await htmlResponse.text();assert.match(html,/Dayzi/);assert.doesNotMatch(html,/Log in to Vercel/);
const assets=[...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(m=>m[1]);assert.ok(assets.length>=2);for(const asset of assets){const r=await fetch(base+asset,{signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);console.log('Asset OK',asset);}
const statusResponse=await fetch(base+'/api/status',{signal:AbortSignal.timeout(30000)});assert.equal(statusResponse.status,200);const status=await statusResponse.json();assert.equal(status.user,null);assert.equal(status.connection,null);assert.equal(status.config.google,false);console.log('Public application API OK; Google setup correctly reports not configured');
const crossOrigin=await fetch(base+'/api/data',{method:'PUT',headers:{Origin:'https://attacker.example','Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(30000)});assert.equal(crossOrigin.status,403);console.log('Cross-origin mutation correctly rejected');
const manifest=await fetch(base+'/manifest.webmanifest');assert.equal(manifest.status,200);assert.equal((await manifest.json()).short_name,'Dayzi');console.log('PWA manifest OK');
console.log('Deployment verified:',base);
