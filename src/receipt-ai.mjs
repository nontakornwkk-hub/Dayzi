import {api} from './storage.mjs';
import {readReceipt} from './receipt-ocr.mjs';
import {parseSlipText} from './finance.mjs';

const hashOf=async file=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
// Shrink phone photos so the upload stays small and quick.
async function shrink(file,max=1600){
 let bitmap,url;
 try{try{if(typeof createImageBitmap!=='function')throw new Error();bitmap=await createImageBitmap(file);}catch{url=URL.createObjectURL(file);bitmap=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('เปิดรูปไม่ได้ ลองใช้รูป JPG หรือ PNG นะคะ'));img.src=url;});}
 const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
 const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
 const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',0.85));if(!blob)throw new Error('เตรียมรูปไม่สำเร็จ กรุณาเลือกรูปใหม่');
 return await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(String(fr.result).split(',')[1]);fr.onerror=reject;fr.readAsDataURL(blob);});
 }finally{bitmap?.close?.();if(url)URL.revokeObjectURL(url);}
}
// Gemini reads bank slips and shop receipts far better than local OCR; fall back to OCR when it is unavailable.
export async function readReceiptSmart(file,{ai=false,local=false,onProgress=()=>{}}={}){
 if(!file||(!['image/png','image/jpeg','image/webp','image/bmp','image/heic','image/heif'].includes(file.type)&&!(!file.type&&/\.(jpe?g|png|webp|bmp)$/i.test(file.name))))throw new Error('เลือกรูปภาพ JPG, PNG, WebP หรือ BMP นะคะ');
 const mime=file.type||({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',bmp:'image/bmp'}[file.name.split('.').pop().toLowerCase()]);
 const normalized=file.type?file:new File([file],file.name,{type:mime});let aiError;
 if(ai){
  try{
   onProgress({stage:'ai',progress:.3});
   const image=await shrink(normalized),draft=await api(local?'assistant/local-receipt':'assistant/receipt',{method:'POST',body:JSON.stringify({image,mimeType:'image/jpeg'})});
   return {draft,hash:await hashOf(file),confidence:100};
  }catch(error){aiError=error;onProgress({stage:'ocr',progress:0});}
 }
 let result;try{result=await readReceipt(normalized,onProgress);}catch(error){throw new Error(aiError?`${aiError.message} · อ่านในเครื่องไม่สำเร็จ กรุณาใช้รูป JPG/PNG ที่ชัดเจนแล้วลองใหม่`:error.message);}
 return {draft:parseSlipText(result.text),hash:result.hash,confidence:result.confidence};
}
