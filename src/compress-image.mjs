const MIN_BYTES=1_000_000,MAX_SIDE=3840,SAVES=0.85;
const TYPES=['image/jpeg','image/png','image/webp'];
// Big photos and screenshots are re-saved as high-quality WebP (visually the same) to save storage.
// The original is kept whenever the result would not be clearly smaller, and non-images are never touched.
export async function compressImage(file){
 try{
  if(!TYPES.includes(file?.type)||file.size<MIN_BYTES||typeof createImageBitmap!=='function')return file;
  const bitmap=await createImageBitmap(file),scale=Math.min(1,MAX_SIDE/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
  canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.92));
  if(!blob||blob.type!=='image/webp'||blob.size>file.size*SAVES)return file;
  return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.webp',{type:'image/webp',lastModified:file.lastModified});
 }catch{return file;}
}
