import {useEffect,useRef,useState} from 'react';
import {api} from './storage.mjs';
import {personalRequest} from './personal-sheet.mjs';
export function cleanChatMessages(messages){return messages.filter(m=>m.text||m.attachments?.length).map(({id,role,text='',source,attachments})=>({...(id?{id}:{}),role,text,...(source?{source}:{}),...(attachments?.length?{attachments:attachments.map(({id,name,mimeType,driveId,local})=>({id,name,mimeType,...(driveId?{driveId}:{}),...(local?{local:true}:{})}))}:{})}));}
export default function useChatHistory({messages,busy,chatId,ownerKey,mode,personal,onError}){
 const [chats,setChats]=useState([]),[status,setStatus]=useState('local'),hashes=useRef(new Map()),queue=useRef(Promise.resolve()),saveSequence=useRef(0),owner=useRef(ownerKey);
 const cloud=mode==='cloud'||mode==='personal';
 useEffect(()=>{owner.current=ownerKey;hashes.current=new Map();let cached=[];try{cached=JSON.parse(localStorage.getItem(ownerKey)??'[]');}catch{}setChats(cached);for(const chat of cached)hashes.current.set(chat.id,JSON.stringify(chat.messages));let active=true;
  if(cloud){setStatus('loading');const request=mode==='personal'?personalRequest(personal,'chats'):api('chats');request.then(({chats:remote})=>{if(!active)return;setChats(remote??[]);hashes.current=new Map((remote??[]).map(c=>[c.id,JSON.stringify(c.messages)]));localStorage.setItem(ownerKey,JSON.stringify(remote??[]));setStatus('synced');}).catch(error=>{if(active){setStatus('error');onError?.('โหลดประวัติจาก Sheet ไม่สำเร็จ: '+error.message);}});}else setStatus('local');
  return()=>{active=false;};
 },[ownerKey,mode,personal?.deploymentUrl]);
 useEffect(()=>{const first=messages.find(m=>m.role==='user');if(!first)return;const cleaned=cleanChatMessages(messages),hash=JSON.stringify(cleaned);if(hashes.current.get(chatId)===hash)return;
  if(busy){return;}
  const chat={id:chatId,title:(first.text||first.attachments?.[0]?.name||'แชทรูปภาพ').slice(0,48),updatedAt:Date.now(),messages:cleaned};
  const sequence=++saveSequence.current,scope=ownerKey;
  const timer=setTimeout(()=>{if(owner.current!==scope)return;hashes.current.set(chatId,hash);setChats(list=>{const next=[chat,...list.filter(c=>c.id!==chat.id)].slice(0,1000);try{localStorage.setItem(scope,JSON.stringify(next));}catch{}return next;});if(!cloud)return;setStatus('saving');queue.current=queue.current.catch(()=>{}).then(async()=>{if(owner.current!==scope)return;try{if(mode==='personal')await personalRequest(personal,'saveChat',{chat});else await api('chats',{method:'PUT',body:JSON.stringify({chat})});if(sequence===saveSequence.current)setStatus('synced');}catch(error){hashes.current.delete(chatId);setStatus('error');onError?.('ประวัติยังไม่ซิงก์กับ Sheet: '+error.message);}});},cloud?600:0);
  return()=>clearTimeout(timer);
 },[messages,busy,chatId,mode,ownerKey]);
 async function removeChat(id){if(cloud){if(mode==='personal')await personalRequest(personal,'saveChat',{deletedId:id});else await api('chats',{method:'PUT',body:JSON.stringify({deletedId:id})});}hashes.current.delete(id);setChats(list=>{const next=list.filter(c=>c.id!==id);localStorage.setItem(ownerKey,JSON.stringify(next));return next;});}
 return {chats,status,removeChat};
}
