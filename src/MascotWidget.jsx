import React,{useState,useRef,useEffect} from 'react';
import {X,ArrowUp} from 'lucide-react';

const KEY='dayzi:mascot';
const SIZE=124;
const load=()=>{try{const v=JSON.parse(localStorage.getItem(KEY));if(Number.isFinite(v?.right)&&Number.isFinite(v?.bottom))return {right:v.right,bottom:v.bottom};}catch{}return {right:28,bottom:28};};
// Floating Dayzi: drag it anywhere, tap to chat, one button on the right removes it (the top bar calls it back).
export default function MascotWidget({capabilities=[],onSend,onHide}){
 const [pos,setPos]=useState(load),[panel,setPanel]=useState(false),[text,setText]=useState(''),drag=useRef(null);
 useEffect(()=>{try{localStorage.setItem(KEY,JSON.stringify(pos));}catch{}},[pos]);
 const clamp=(right,bottom)=>({right:Math.max(8,Math.min(window.innerWidth-SIZE-8,right)),bottom:Math.max(8,Math.min(window.innerHeight-SIZE-8,bottom))});
 const down=e=>{if(e.target.closest('.mascot-tools'))return;e.currentTarget.setPointerCapture?.(e.pointerId);drag.current={x:e.clientX,y:e.clientY,right:pos.right,bottom:pos.bottom,moved:false};};
 const move=e=>{const d=drag.current;if(!d)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(!d.moved&&Math.hypot(dx,dy)<5)return;d.moved=true;setPos(clamp(d.right-dx,d.bottom-dy));};
 const up=()=>{const d=drag.current;drag.current=null;if(d&&!d.moved)setPanel(p=>!p);};
 const send=e=>{e.preventDefault();const v=text.trim();if(!v)return;setText('');setPanel(false);onSend(v);};
 return <div className="mascot" style={{right:pos.right,bottom:pos.bottom}}>
  {panel&&<div className="mascot-panel" role="dialog" aria-label="คุยกับเดซี่">
   <div className="mascot-panel-head"><strong>เดซี่ 🌼</strong><button aria-label="ปิด" onClick={()=>setPanel(false)}><X size={16}/></button></div>
   <p>สั่งเดซี่มาได้เลยค่ะ</p>
   <ul>{capabilities.map(([icon,label,prompt])=><li key={label}><button type="button" onClick={()=>{setPanel(false);onSend(prompt);}}><span>{icon}</span>{label}</button></li>)}</ul>
   <form onSubmit={send}><input aria-label="คุยกับเดซี่" value={text} maxLength={2000} onChange={e=>setText(e.target.value)} placeholder="พิมพ์ถึงเดซี่…" autoFocus/><button type="submit" aria-label="ส่ง" disabled={!text.trim()}><ArrowUp size={16}/></button></form>
  </div>}
  <div className="mascot-body" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{drag.current=null;}} role="button" tabIndex={0} aria-label="คุยกับเดซี่ ลากเพื่อย้ายได้" onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setPanel(p=>!p);}}}>
   <img src="/dayzi-mascot.png" alt="" draggable={false} width={SIZE} height={SIZE}/>
   <span className="mascot-tools"><button className="mascot-hide" aria-label="เอาเดซี่ออก" title="เอาออก (เรียกกลับได้จากแถบด้านบน)" onClick={e=>{e.stopPropagation();setPanel(false);onHide?.();}}><X size={14}/></button></span>
  </div>
 </div>;
}
