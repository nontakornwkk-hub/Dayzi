import React,{useEffect,useRef,useState} from 'react';
import {Check,Loader2,Trash2,RefreshCw} from 'lucide-react';
import {createAutosave} from './autosave.mjs';
const PAPERS=[['sunny','เหลืองสดใส'],['blossom','ชมพูดอกไม้'],['mint','มิ้นต์ปักหมุด'],['notebook','สมุดมีเส้น'],['kraft','กระดาษคราฟต์']];
export default function NoteEditor({note,ownerKey,onDraft,onSave,onDelete,onClose,cloud}){
 const key=`dayzi:note-draft:${ownerKey}:${note.id}`,latest=useRef({onSave,onDraft}),[value,setValue]=useState(()=>{try{return JSON.parse(localStorage.getItem(key))??note;}catch{return note;}}),[status,setStatus]=useState('idle');
 latest.current={onSave,onDraft};const queue=useRef();
 if(!queue.current)queue.current=createAutosave({save:async draft=>{await latest.current.onSave(draft);try{if(localStorage.getItem(key)===JSON.stringify(draft))localStorage.removeItem(key);}catch{}},onStatus:setStatus});
 useEffect(()=>{if(value!==note){latest.current.onDraft(value);queue.current.update(value);}return()=>{queue.current.flush();};},[]);
 function edit(patch){const next={...value,...patch,updatedAt:new Date().toISOString()};setValue(next);latest.current.onDraft(next);try{localStorage.setItem(key,JSON.stringify(next));}catch{}queue.current.update(next);}
 async function remove(){await queue.current.cancel();try{if(await onDelete(value)!==false){localStorage.removeItem(key);onClose();}else queue.current.resume(value);}catch{queue.current.resume(value);}}
 const label=status==='error'?'ยังไม่ซิงก์ · ร่างยังอยู่ในเครื่อง':status==='saving'?'กำลังซิงก์…':status==='waiting'?'เก็บร่างแล้ว · รอซิงก์':status==='saved'?(cloud?'บันทึกออนไลน์แล้ว':'บันทึกในเครื่องแล้ว'):'บันทึกอัตโนมัติเมื่อพิมพ์';
 return <form className="note-editor" onSubmit={e=>{e.preventDefault();queue.current.flush();onClose();}}>
  <label className="field"><span>ชื่อโน้ต</span><input autoFocus maxLength={200} value={value.title} onChange={e=>edit({title:e.target.value})} placeholder="ตั้งชื่อให้ความคิดนี้…"/></label>
  <label className="field"><span>เนื้อหา</span><textarea rows={9} maxLength={20000} value={value.content} onChange={e=>edit({content:e.target.value})} placeholder="เขียนได้เต็มที่เลย"/></label>
  <div className="paper-picker" role="radiogroup" aria-label="เลือกแบบกระดาษ">{PAPERS.map(([id,label])=><button type="button" role="radio" aria-checked={value.color===id} key={id} className={value.color===id?'selected':''} onClick={()=>edit({color:id})}><span className={`paper-swatch paper-${id}`}><span className="paper-deco"/></span>{label}</button>)}</div>
  <div className={`note-save-status ${status}`} role="status">{status==='saving'?<Loader2 size={14} className="spin"/>:<Check size={14}/>}<span>{label}</span>{status==='error'&&<button type="button" onClick={()=>queue.current.flush()}><RefreshCw size={14}/>ลองใหม่</button>}</div>
  <div className="modal-actions"><button type="button" className="icon-button danger" aria-label="ลบโน้ต" onClick={remove}><Trash2 size={17}/></button><button type="submit" className="primary-button"><Check size={16}/>เสร็จแล้ว</button></div>
 </form>;
}
