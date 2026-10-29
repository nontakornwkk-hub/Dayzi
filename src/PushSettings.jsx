import React,{useEffect,useState} from 'react';
import {Bell,Check,Loader2,Smartphone} from 'lucide-react';
import {api} from './storage.mjs';
import {pushSupport} from './push-support.mjs';
export default function PushSettings({user,config,connection,tell}){
 const [enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false);
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1),standalone=window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone;
 const support=pushSupport({ios,standalone,secure:window.isSecureContext,notification:'Notification'in window,push:'PushManager'in window&&'serviceWorker'in navigator});
 useEffect(()=>{if(support==='ready'&&Notification.permission==='granted')navigator.serviceWorker.ready.then(sw=>sw.pushManager.getSubscription()).then(sub=>setEnabled(!!sub)).catch(()=>{});},[support]);
 async function enable(){if(support!=='ready')return;try{if(await Notification.requestPermission()!=='granted'){tell('กรุณาอนุญาตการแจ้งเตือนในตั้งค่าเว็บไซต์ของเบราว์เซอร์','info');return;}setBusy(true);const sw=await navigator.serviceWorker.ready,raw=atob(config.vapidPublicKey.replace(/-/g,'+').replace(/_/g,'/')),sub=await sw.pushManager.getSubscription()??await sw.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(raw,c=>c.charCodeAt(0))});await api('push',{method:'POST',body:JSON.stringify(sub)});setEnabled(true);tell('เปิดแจ้งเตือนบนเครื่องนี้แล้ว เลือกช่องทาง “แจ้งเตือนมือถือ” ในนัดที่ต้องการ');}catch(error){tell(error.message,'error');}finally{setBusy(false);}}
 async function test(){setBusy(true);try{await api('push/test',{method:'POST',body:'{}'});tell('ส่งการแจ้งเตือนทดสอบไปยังเครื่องนี้แล้ว');}catch(error){tell(error.message,'error');}finally{setBusy(false);}}
 const ready=user&&connection?.status==='ready'&&config.pushReady;
 return <div className="phone-push"><div className="sv-option"><div><strong><Smartphone size={16}/>แจ้งเตือนบนโทรศัพท์ / เครื่องนี้</strong><small>{enabled?'เครื่องนี้เปิดรับการแจ้งเตือนแล้ว':'รับเตือนบนหน้าจอล็อก แม้ปิดหน้าเว็บ'}</small></div><button className="secondary-button small" disabled={busy||support!=='ready'||!ready} onClick={enable}>{busy?<Loader2 size={14} className="spin"/>:enabled?<Check size={14}/>:<Bell size={14}/>} {enabled?'เชื่อมเครื่องนี้อีกครั้ง':'เปิดแจ้งเตือน'}</button></div>
  {support==='install'&&<p className="push-help">iPhone / iPad: เปิด Dayzi ใน Safari → แชร์ → เพิ่มไปยังหน้าจอโฮม แล้วเปิดจากไอคอน Dayzi เพื่อกดอนุญาตแจ้งเตือน</p>}
  {support==='https'&&<p className="push-help">เปิดเว็บ Dayzi ผ่าน HTTPS เพื่อใช้งานแจ้งเตือนบนมือถือ</p>}
  {support==='unsupported'&&<p className="push-help">กรุณาเปิดด้วย Chrome บน Android หรือแอป Dayzi ที่เพิ่มไว้บนหน้าจอโฮม</p>}
  {!user||connection?.status!=='ready'?<p className="push-help">เข้าสู่ระบบ LINE และเชื่อม Google ก่อนเปิดรับการเตือนขณะปิดแอป</p>:!config.pushReady?<p className="push-help">ระบบส่งแจ้งเตือนกำลังตั้งค่า กรุณาลองใหม่ภายหลัง</p>:null}
  {enabled&&ready&&<button className="secondary-button small" disabled={busy} onClick={test}><Bell size={14}/>ส่งแจ้งเตือนทดสอบ</button>}
  <p className="push-help">เปิดครั้งแรกบนโทรศัพท์ที่จะรับเตือน และเลือก “แจ้งเตือนมือถือ” ในนัดหมาย</p>
  <p className="push-help">{config.reminderSchedulerReady?'การเตือนตามเวลาตรวจทุก 5 นาที อาจส่งช้ากว่าเวลาที่ตั้ง':'ส่งแจ้งเตือนทดสอบได้เมื่อเปิดสิทธิ์แล้ว ส่วนการเตือนตามเวลายังรอผู้ดูแลเปิดระบบตั้งเวลา'}</p>
 </div>;
}
