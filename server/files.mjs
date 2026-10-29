import {registry} from './registry.mjs';
import {googleFetch} from './google.mjs';
import {env,encryptSecret,decryptSecret} from './security.mjs';
export const CHUNK_SIZE=3*1024*1024;
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const mime=value=>/^[\w.+-]+\/[\w.+-]+$/.test(value??'')?value:'application/octet-stream';
export async function trashDriveFile(account,token,file,trashed=true){
 if(file.ownerId!==account.uid||!file.driveId||!account.connection?.folderId)throw fail('ไฟล์นี้ไม่ได้เป็นของคุณ',403);
 const url=`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.driveId)}`;
 const meta=await googleFetch(token,url+'?fields=id,parents,trashed').then(r=>r.json());
 if(!meta.parents?.includes(account.connection.folderId))throw fail('ไฟล์ไม่ได้อยู่ในโฟลเดอร์ที่คุณเชื่อมต่อ',403);
 if(!!meta.trashed===trashed)return {changed:false};
 await googleFetch(token,url,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({trashed})});
 return {changed:true};
}
function uploadUrl(value){const u=new URL(value);if(u.origin!=='https://www.googleapis.com'||u.pathname!=='/upload/drive/v3/files'||!u.searchParams.get('upload_id'))throw fail('ที่อยู่อัปโหลดไม่ถูกต้อง',502);return u.href;}
export async function limitedBytes(response,max=Infinity){const reader=response.body.getReader(),parts=[];let total=0;try{for(;;){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>max){await reader.cancel();throw fail('ข้อมูลชิ้นอัปโหลดใหญ่เกินกำหนด',413);}parts.push(Buffer.from(value));}return Buffer.concat(parts);}finally{reader.releaseLock?.();}}
export async function startUpload(account,token,file,options={}){
 if(!/^[\w-]{1,100}$/.test(file.id??'')||(!(options.allowUnknown&&file.size===null)&&(!Number.isSafeInteger(file.size)||file.size<0))||typeof file.name!=='string'||!file.name.trim())throw fail('ข้อมูลไฟล์ไม่ถูกต้อง');
 const r=await (options.fetchImpl??fetch)('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','X-Upload-Content-Type':mime(file.mimeType),...(file.size===null?{}:{'X-Upload-Content-Length':String(file.size)})},body:JSON.stringify({name:file.name.slice(0,200),parents:[account.connection.folderId]}),signal:AbortSignal.timeout(18000),redirect:'error'});
 if(!r.ok)throw fail('เริ่มอัปโหลด Drive ไม่สำเร็จ กรุณาตรวจสิทธิ์และพื้นที่ว่าง',r.status);
 const url=uploadUrl(r.headers.get('location'));
 const ticket=encryptSecret(JSON.stringify({url,id:file.id,size:file.size,version:account.version,expires:Date.now()+24*60*60*1000}),account.uid,options.key??env('TOKEN_ENCRYPTION_KEY'));
 return {ticket,chunkSize:CHUNK_SIZE};
}
export async function uploadChunk(account,token,ticket,offset,bytes,options={}){
 let session;try{session=JSON.parse(decryptSecret(ticket,account.uid,options.key??env('TOKEN_ENCRYPTION_KEY')));if(session.version!==account.version||session.expires<=Date.now())throw new Error();uploadUrl(session.url);}catch{throw fail('สิทธิ์อัปโหลดหมดอายุหรือพื้นที่เก็บข้อมูลเปลี่ยนแล้ว',403);}
 const end=offset+bytes.length;
 if(session.size===null){if(!options.allowUnknown)throw fail('สิทธิ์อัปโหลดไม่ถูกต้อง',403);session.size=options.total??null;}
 if(!Number.isSafeInteger(offset)||offset<0||(session.size!==null&&end>session.size)||bytes.length>CHUNK_SIZE||(!bytes.length&&session.size!==0)||((session.size===null||end<session.size)&&bytes.length%262144!==0))throw fail('ข้อมูลชิ้นอัปโหลดไม่ถูกต้อง');
 const r=await (options.fetchImpl??fetch)(session.url,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/octet-stream','Content-Range':session.size===0?'bytes */0':`bytes ${offset}-${end-1}/${session.size??'*'}`},body:bytes,redirect:'manual',signal:AbortSignal.timeout(45000)});
 if(r.status===308){const range=r.headers.get('range'),next=range?Number(/^bytes=0-(\d+)$/.exec(range)?.[1])+1:0;if(!Number.isSafeInteger(next)||next<0||(session.size!==null&&next>session.size))throw fail('Drive ตอบตำแหน่งไฟล์ไม่ถูกต้อง',502);return {done:false,offset:next};}
 if(!r.ok)throw fail(r.status===404?'การอัปโหลดหมดอายุ กรุณาเลือกไฟล์ใหม่':'อัปโหลด Drive ไม่สำเร็จ กรุณาตรวจพื้นที่ว่างแล้วลองใหม่',r.status);
 const file=await r.json();if(!file.id)throw fail('Drive ไม่ส่งรหัสไฟล์กลับมา',502);
 await (options.register??registry)('registerUpload',account.uid,{connectionVersion:account.version,file:{id:session.id,driveId:file.id}});
 return {done:true,driveId:file.id,offset:session.size};
}
export async function uploadDrive(account,token,{id,name,mimeType,bytes}){
 const {ticket}=await startUpload(account,token,{id,name,mimeType,size:bytes.length});let offset=0,result;
 do{result=await uploadChunk(account,token,ticket,offset,bytes.subarray(offset,offset+CHUNK_SIZE));if(!result.done&&result.offset<=offset)throw fail('การอัปโหลดไม่คืบหน้า กรุณาลองใหม่',502);offset=result.offset;}while(!result.done);
 return result.driveId;
}
export async function uploadDriveStream(account,token,file,response,options={}){
 const opts={...options,allowUnknown:true};
 const {ticket}=await startUpload(account,token,{...file,size:null},opts);
 const reader=response.body.getReader();let pending=Buffer.alloc(0),offset=0;
 try{for(;;){let timer;const read=reader.read();const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{reader.cancel().catch(()=>{});reject(fail('รอรับไฟล์จาก LINE นานเกินไป กรุณาส่งใหม่',504));},60000);});let part;try{part=await Promise.race([read,timeout]);}finally{clearTimeout(timer);}const {value,done}=part;if(done)break;pending=Buffer.concat([pending,Buffer.from(value)]);
   while(pending.length>CHUNK_SIZE){const result=await uploadChunk(account,token,ticket,offset,pending.subarray(0,CHUNK_SIZE),opts);if(result.done||result.offset!==offset+CHUNK_SIZE)throw fail('การอัปโหลดสะดุด กรุณาส่งไฟล์ใหม่',502);offset=result.offset;pending=pending.subarray(CHUNK_SIZE);}
  }
  const result=await uploadChunk(account,token,ticket,offset,pending,{...opts,total:offset+pending.length});if(!result.done)throw fail('Drive ยังรับไฟล์ไม่ครบ กรุณาส่งใหม่',502);return {driveId:result.driveId,size:offset+pending.length};
 }catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
}
