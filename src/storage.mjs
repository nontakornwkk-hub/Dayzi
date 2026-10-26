export async function api(path,options={}) {
  const res=await fetch(`/api/${path}`,{...options,headers:{'Content-Type':'application/json',...options.headers},credentials:'same-origin'});
  const data=await res.json().catch(()=>({error:'ยังไม่พร้อมเชื่อมต่อระบบออนไลน์'}));
  if(!res.ok)throw Object.assign(new Error(data.error??'เชื่อมต่อไม่สำเร็จ'),{status:res.status});return data;
}
export async function uploadCloudFile(file,id){
  const session=await api('upload/start',{method:'POST',body:JSON.stringify({id,name:file.name,size:file.size,mimeType:file.type})});
  let offset=0;
  do {
    const response=await fetch(`/api/upload/chunk?offset=${offset}`,{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/octet-stream','X-Upload-Ticket':session.ticket},body:file.slice(offset,offset+session.chunkSize)});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error??'อัปโหลดไฟล์ไม่สำเร็จ');
    if(result.done)return result;
    if(!Number.isSafeInteger(result.offset)||result.offset<=offset||result.offset>file.size)throw new Error('การอัปโหลดสะดุด กรุณาเลือกไฟล์แล้วลองใหม่');
    offset=result.offset;
  }while(offset<=file.size);
}
export async function streamAssistant(path,payload,onText){
  const response=await fetch(`/api/${path}`,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/x-ndjson'},credentials:'same-origin',body:JSON.stringify({...payload,stream:true})});
  if(!response.ok){const error=await response.json().catch(()=>({}));throw new Error(error.error??'เชื่อม Gemini ไม่สำเร็จ');}
  if(!response.headers?.get('content-type')?.includes('application/x-ndjson')||!response.body){const result=await response.json();onText(result.text);return result;}
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',text='',doneEvent=null;
  const accept=line=>{if(!line.trim())return;const event=JSON.parse(line);if(event.type==='error')throw new Error(event.error);if(event.type==='chunk'){text+=event.text;onText(text);}if(event.type==='done')doneEvent=event;};
  try{for(;;){const {value,done}=await reader.read();buffer+=decoder.decode(value,{stream:!done});let end;while((end=buffer.indexOf('\n'))>=0){accept(buffer.slice(0,end));buffer=buffer.slice(end+1);}if(done)break;}if(buffer.trim())accept(buffer);}finally{reader.releaseLock();}
  if(!doneEvent)throw new Error('การเชื่อมต่อคำตอบสะดุด กรุณาลองอีกครั้ง');return {text,...doneEvent};
}
function db(){return new Promise((resolve,reject)=>{const req=indexedDB.open('dayzi-files',1);req.onupgradeneeded=()=>req.result.createObjectStore('files');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
export async function storeBlob(id,file){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('files','readwrite');tx.objectStore('files').put(file,id);tx.oncomplete=()=>{d.close();resolve();};tx.onerror=()=>{d.close();reject(tx.error);};});}
export async function readBlob(id){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('files','readonly'),r=tx.objectStore('files').get(id);r.onsuccess=()=>{d.close();resolve(r.result);};r.onerror=()=>{d.close();reject(r.error);};});}
export async function deleteBlob(id){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('files','readwrite');tx.objectStore('files').delete(id);tx.oncomplete=()=>{d.close();resolve();};tx.onerror=()=>reject(tx.error);});}
