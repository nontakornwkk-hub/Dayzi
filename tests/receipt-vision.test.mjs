import test from 'node:test';import assert from 'node:assert/strict';
import {readReceiptImage,cleanReceipt} from '../server/receipt-vision.mjs';
const config={configured:true,model:'gemini-3.5-flash-lite'};
test('receipt reader returns satang, validated date and a known category from Gemini JSON',async()=>{
 let request;const client={models:{generateContent:async value=>{request=value;return {text:JSON.stringify({amount:1234.5,date:'2026-10-25',title:'ร้านกาแฟ',documentType:'receipt',category:'food',note:''})};}}};
 const result=await readReceiptImage({image:'QUJD',mimeType:'image/jpeg'},{client,config,today:'2026-10-27'});
 assert.equal(result.amount,123450);assert.equal(result.date,'2026-10-25');assert.equal(result.dateDetected,true);assert.equal(result.category,'food');
 assert.equal(request.config.responseMimeType,'application/json');assert.equal(request.contents[0].parts[1].inlineData.data,'QUJD');
});
test('receipt reader never trusts bad model output or oversized and non-image input',async()=>{
 const bad=cleanReceipt({amount:-5,date:'2026-02-31',title:'',documentType:'x',category:'hack'},'2026-10-27');
 assert.equal(bad.amount,null);assert.equal(bad.date,'2026-10-27');assert.equal(bad.dateDetected,false);assert.equal(bad.category,'other');assert.equal(bad.title,'รายการจากสลิป');
 await assert.rejects(()=>readReceiptImage({image:'QUJD',mimeType:'image/svg+xml'},{client:{},config}),e=>e.status===400);
 await assert.rejects(()=>readReceiptImage({image:'A'.repeat(4_000_001),mimeType:'image/jpeg'},{client:{},config}),e=>e.status===400);
 await assert.rejects(()=>readReceiptImage({image:'QUJD',mimeType:'image/jpeg'},{client:{},config:{configured:false}}),e=>e.status===503);
});
