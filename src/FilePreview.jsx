import React,{useEffect,useState} from 'react';
import {Download,Loader2,FileText,ExternalLink} from 'lucide-react';
import {readBlob} from './storage.mjs';

const kind=type=>type?.startsWith('image/')?'image':type==='application/pdf'?'pdf':type?.startsWith('video/')?'video':type?.startsWith('audio/')?'audio':type?.startsWith('text/')||type==='application/json'?'text':'none';
// Open a saved file right inside the app; downloading stays an optional extra.
export default function FilePreview({file,onDownload}){
 const [state,setState]=useState({status:'loading'}),type=file.mimeType||'',k=kind(type),driveUrl=file.driveId?`https://drive.google.com/file/d/${encodeURIComponent(file.driveId)}`:null;
 useEffect(()=>{let active=true,url;
  (async()=>{try{
   setState({status:'loading'});let blob;
   if(file.driveId&&k==='none'){setState({status:'ready',native:true,url:driveUrl+'/preview'});return;}
   if(file.driveId&&['image','pdf','audio','video'].includes(k)){setState({status:'ready',url:`/api/file?id=${encodeURIComponent(file.id)}&preview=1`});return;}
   if(file.driveId){const res=await fetch(`/api/file?id=${encodeURIComponent(file.id)}`,{credentials:'same-origin'});if(!res.ok)throw new Error();blob=await res.blob();}
   else{blob=await readBlob(file.id);if(!blob)throw new Error();}
   const typed=blob.type?blob:new Blob([blob],{type});
   if(kind(type)==='text'){const text=await typed.text();if(active)setState({status:'ready',text:text.slice(0,200000)});return;}
   url=URL.createObjectURL(new Blob([typed],{type:type||typed.type}));if(active)setState({status:'ready',url});
  }catch{if(active)setState({status:'error'});}})();
  return()=>{active=false;if(url)URL.revokeObjectURL(url);};},[file.id,file.driveId,type]);
 return <div className="file-preview">
  {state.status==='loading'&&<p className="file-preview-note"><Loader2 className="spin" size={18}/> กำลังเปิดไฟล์…</p>}
  {state.status==='error'&&<p className="file-preview-note">เปิดไฟล์นี้ไม่ได้ในตอนนี้ ไฟล์อาจอยู่ในอุปกรณ์เครื่องอื่น</p>}
  {state.status==='ready'&&state.native&&<iframe src={state.url} title={file.name} allow="fullscreen"/>}
  {state.status==='ready'&&k==='image'&&<img src={state.url} alt={file.name} onError={()=>setState({status:'error'})}/>}
  {state.status==='ready'&&k==='pdf'&&<iframe src={state.url} title={file.name}/>}
  {state.status==='ready'&&k==='video'&&<video src={state.url} controls/>}
  {state.status==='ready'&&k==='audio'&&<audio src={state.url} controls/>}
  {state.status==='ready'&&k==='text'&&<pre>{state.text}</pre>}
  {state.status==='ready'&&k==='none'&&!state.native&&<p className="file-preview-note"><FileText size={22}/>ไฟล์ชนิดนี้ดูในแอปไม่ได้ ดาวน์โหลดไปเปิดด้วยโปรแกรมของเครื่องได้</p>}
  <div className="file-preview-actions">{driveUrl&&<a className="secondary-button small" href={driveUrl+'/view'} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/>เปิดใน Google Drive</a>}<button className="secondary-button small" onClick={onDownload}><Download size={15}/>ดาวน์โหลด</button></div>
 </div>;
}
