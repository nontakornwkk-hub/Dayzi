export async function readReceipt(file,onProgress=()=>{}){
 if(!['image/png','image/jpeg','image/webp','image/bmp'].includes(file?.type))throw new Error('เลือกรูปภาพ JPG, PNG, WebP หรือ BMP นะคะ');
 const {createWorker}=await import('tesseract.js');
 let worker;
 try{
  worker=await createWorker(['tha','eng'],1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr/core',langPath:'/ocr/lang',workerBlobURL:false,gzip:true,logger:event=>onProgress({stage:event.status,progress:event.progress??0})});
  const {data}=await worker.recognize(file);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
  return {text:data.text,confidence:data.confidence,hash};
 }finally{await worker?.terminate();}
}
