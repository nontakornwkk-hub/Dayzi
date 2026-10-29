// One active save, one latest pending draft; typing never waits for the network.
export function createAutosave({save,onStatus=()=>{},delay=500}){
 let pending,hasPending=false,timer,running=null,stopped=false;
 const flush=()=>{clearTimeout(timer);if(running)return running;if(!hasPending||stopped)return Promise.resolve();
  running=(async()=>{while(hasPending&&!stopped){const value=pending;hasPending=false;onStatus('saving');try{await save(value);}catch(error){if(!hasPending){pending=value;hasPending=true;}onStatus('error',error);return;} }if(!hasPending)onStatus('saved');})().finally(()=>{running=null;});return running;
 };
 return {update(value){if(stopped)return;pending=value;hasPending=true;clearTimeout(timer);onStatus('waiting');timer=setTimeout(flush,delay);},flush,resume(value){stopped=false;pending=value;hasPending=true;onStatus('error');},async cancel(){stopped=true;hasPending=false;clearTimeout(timer);await running;}};
}
export function restoreNoteDrafts(data,owner,storage=localStorage){
 const prefix=`dayzi:note-draft:${owner}:`,notes=new Map((data.notes??[]).map(n=>[n.id,n]));
 try{for(let i=0;i<storage.length;i++){const key=storage.key(i);if(!key?.startsWith(prefix))continue;try{const n=JSON.parse(storage.getItem(key));if(typeof n?.id!=='string'||key!==prefix+n.id||typeof n.title!=='string'||typeof n.content!=='string'||n.title.length>200||n.content.length>20000)continue;const saved=notes.get(n.id);if(!saved||String(n.updatedAt)>String(saved.updatedAt))notes.set(n.id,n);}catch{}}}catch{}
 return {...data,notes:[...notes.values()]};
}
