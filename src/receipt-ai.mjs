import {api} from './storage.mjs';
import {readReceipt} from './receipt-ocr.mjs';
import {parseSlipText} from './finance.mjs';

const hashOf=async file=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
// Shrink phone photos so the upload stays small and quick.
async function shrink(file,max=1600){
 const bitmap=await createImageBitmap(file),scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
 const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
 canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
 const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',0.85));
 return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(String(fr.result).split(',')[1]);fr.onerror=reject;fr.readAsDataURL(blob);});
}
// Gemini reads bank slips and shop receipts far better than local OCR; fall back to OCR when it is unavailable.
export async function readReceiptSmart(file,{ai=false,local=false,onProgress=()=>{}}={}){
 if(!['image/png','image/jpeg','image/webp','image/bmp'].includes(file?.type))throw new Error('เลือกรูปภาพ JPG, PNG, WebP หรือ BMP นะคะ');
 if(ai){
  try{
   onProgress({stage:'ai',progress:.3});
   const image=await shrink(file),draft=await api(local?'assistant/local-receipt':'assistant/receipt',{method:'POST',body:JSON.stringify({image,mimeType:'image/jpeg'})});
   return {draft,hash:await hashOf(file),confidence:100};
  }catch{/* fall through to on-device OCR */}
 }
 const result=await readReceipt(file,onProgress);
 return {draft:parseSlipText(result.text),hash:result.hash,confidence:result.confidence};
}
