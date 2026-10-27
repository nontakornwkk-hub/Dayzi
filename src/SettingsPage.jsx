import React,{useState} from 'react';
import {Bell,MessageCircle,LogOut,Check,Moon,UserRound,ExternalLink,Loader2} from 'lucide-react';
import {api} from './storage.mjs';
import StorageConnect from './StorageConnect.jsx';
import ProfilePhoto from './ProfilePhoto.jsx';

// Mobile-first settings: who you are, where your data lives, how Dayzi reaches you.
export default function SettingsPage({data,user,config,connection,persist,tell,onLogout,loadError=false}){
 const [form,setForm]=useState({...data.settings}),[busy,setBusy]=useState(false);
 const update=(key,value)=>setForm(f=>({...f,[key]:value}));
 const dirty=['name','quietStart','quietEnd'].some(k=>(form[k]??'')!==(data.settings[k]??''));
 const lineUser=user?.provider==='line';
 const openBot=()=>{if(config.lineBotId)window.open(`https://line.me/R/ti/p/${encodeURIComponent(config.lineBotId)}`,'_blank','noopener,noreferrer');};
 async function save(){setBusy(true);try{if(await persist({...data,settings:{...data.settings,...form}}))tell('บันทึกการตั้งค่าแล้ว');}finally{setBusy(false);}}
 async function enablePush(){
  if(!('Notification'in window)||!('serviceWorker'in navigator)){tell('เบราว์เซอร์นี้ยังไม่รองรับการแจ้งเตือน','error');return;}
  if(await Notification.requestPermission()!=='granted'){tell('ยังไม่ได้อนุญาต เปิดสิทธิ์ได้ในตั้งค่าเบราว์เซอร์','info');return;}
  setBusy(true);
  try{
   if(user&&config.vapidPublicKey){const sw=await navigator.serviceWorker.ready,raw=atob(config.vapidPublicKey.replace(/-/g,'+').replace(/_/g,'/'));const sub=await sw.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(raw,c=>c.charCodeAt(0))});await api('push',{method:'POST',body:JSON.stringify(sub)});}
   const next={...form,pushEnabled:true};setForm(next);await persist({...data,settings:{...data.settings,...next}});tell(user&&config.vapidPublicKey?'เปิดแจ้งเตือนบนเครื่องนี้แล้ว':'เปิดแล้ว จะเตือนขณะเปิดเว็บอยู่','info');
  }catch(e){tell(e.message,'error');}finally{setBusy(false);}
 }
 return <div className="settings-v2">
  <header className="sv-head"><h1>ตั้งค่า</h1><p>บัญชี พื้นที่เก็บข้อมูล และการแจ้งเตือน</p></header>

  {user&&<section className="card sv-account">
   <span className="sv-avatar"><ProfilePhoto user={user}/></span>
   <div><strong>{user.name}</strong><small>{lineUser?<><MessageCircle size={13}/> เข้าสู่ระบบด้วย LINE</>:'บัญชีของคุณ'}</small></div>
   <button className="icon-button sv-logout" aria-label="ออกจากระบบ" onClick={onLogout}><LogOut size={18}/></button>
  </section>}

  <StorageConnect user={user} config={config} connection={connection} tell={tell} loadError={loadError}/>

  {config.lineBotId&&<section className="card sv-row-card">
   <span className="sv-icon line"><MessageCircle size={20}/></span>
   <div><strong>คุยกับเดซี่ใน LINE</strong><small>สั่งงาน ถามตาราง หรือส่งไฟล์ผ่านแชต LINE ได้เลย</small></div>
   <button className="line-button small" onClick={openBot}>เปิดแชต<ExternalLink size={13}/></button>
  </section>}

  <section className="card sv-section">
   <h2><Bell size={18}/>การแจ้งเตือน</h2>
   <div className="sv-option"><div><strong>เตือนผ่าน LINE</strong><small>{lineUser&&config.line?'เปิดอยู่ เดซี่ส่งเตือนเข้าแชต LINE ของคุณ':config.line?'เข้าสู่ระบบด้วย LINE เพื่อรับเตือนในแชต':'ผู้ดูแลยังไม่ได้เปิดการเตือนผ่าน LINE'}</small></div>{lineUser&&config.line?<span className="connection-label ready"><Check size={13}/>เปิดอยู่</span>:null}</div>
   <div className="sv-option"><div><strong>เตือนบนเครื่องนี้</strong><small>{form.pushEnabled?'อนุญาตแล้ว':'แจ้งเตือนแบบ Web Push'} · iPhone ต้องเพิ่มเว็บไว้ที่หน้าจอโฮมก่อน</small></div><button className="secondary-button small" disabled={busy} onClick={enablePush}>{form.pushEnabled?'ตรวจสิทธิ์':'เปิด'}</button></div>
   <div className="sv-quiet"><span><Moon size={16}/>ช่วงเงียบ ไม่ส่งเตือน</span><div><label>เริ่ม<input type="time" value={form.quietStart??'22:00'} onChange={e=>update('quietStart',e.target.value)}/></label><label>ถึง<input type="time" value={form.quietEnd??'07:00'} onChange={e=>update('quietEnd',e.target.value)}/></label></div></div>
  </section>

  <section className="card sv-section">
   <h2><UserRound size={18}/>ให้เดซี่เรียกคุณว่า</h2>
   <input className="sv-input" aria-label="ชื่อที่อยากให้เดซี่เรียก" maxLength={40} value={form.name??''} onChange={e=>update('name',e.target.value)} placeholder="เช่น ต้น"/>
  </section>

  {dirty&&<div className="sv-save"><button className="primary-button" disabled={busy} onClick={save}>{busy?<Loader2 size={16} className="spin"/>:<Check size={16}/>}บันทึกการตั้งค่า</button></div>}
  <p className="sv-foot"><a href="/privacy.html">นโยบายความเป็นส่วนตัว</a> · <a href="/terms.html">เงื่อนไขการใช้งาน</a></p>
 </div>;
}
