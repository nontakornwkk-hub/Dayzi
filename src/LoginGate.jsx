import React,{useEffect,useState} from 'react';
import {Lock,Loader2} from 'lucide-react';

const AUTO_KEY='dayzi:auto-login';
const RETRY_MS=30000;
const POLL_MS=2500,WAIT_MS=600000;
const LineMark=()=><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3C6.48 3 2 6.6 2 11.04c0 3.98 3.55 7.31 8.35 7.94.33.07.77.22.88.5.1.25.07.64.03.9l-.14.85c-.04.25-.2.98.86.53 1.06-.45 5.71-3.36 7.79-5.76C21.2 14.43 22 12.82 22 11.04 22 6.6 17.52 3 12 3Zm-3.93 10.4H6.08a.53.53 0 0 1-.53-.53V8.9a.53.53 0 1 1 1.06 0v3.44h1.46a.53.53 0 1 1 0 1.06Zm2.05-.53a.53.53 0 1 1-1.06 0V8.9a.53.53 0 1 1 1.06 0v3.97Zm4.79 0a.53.53 0 0 1-.95.32l-2.03-2.77v2.45a.53.53 0 1 1-1.06 0V8.9a.53.53 0 0 1 .95-.32l2.03 2.77V8.9a.53.53 0 1 1 1.06 0v3.97Zm3.22-2.51a.53.53 0 1 1 0 1.06h-1.46v.92h1.46a.53.53 0 1 1 0 1.06h-1.99a.53.53 0 0 1-.53-.53V8.9c0-.29.24-.53.53-.53h1.99a.53.53 0 1 1 0 1.06h-1.46v.92h1.46Z"/></svg>;

const ua=()=>navigator.userAgent||'';
// ในแอป LINE เข้าสู่ระบบได้ทันทีโดยไม่ต้องสลับแอป
export const insideLine=()=>/\bLine\//i.test(ua());
// มือถือนอก LINE (เบราว์เซอร์หรือแอปที่ติดตั้งไว้) ให้ไปยืนยันในแอป LINE แทนการเด้งผ่านหน้าเว็บ LINE
export const handoffDevice=()=>!insideLine()&&(/Android|iPhone|iPad|iPod/i.test(ua())||(/Macintosh/.test(ua())&&navigator.maxTouchPoints>1));

// In LINE and on computers one button goes straight to LINE Login (computers get a QR). On phones outside
// LINE, including the installed app, the button opens the LINE app to confirm and this page waits for it.
export default function LoginGate({config}){
 const params=new URLSearchParams(location.search),blocked=params.has('error')||params.has('loggedout');
 const handoff=!!config.lineLogin&&!!config.line&&handoffDevice();
 let recent=false;try{recent=Date.now()-Number(sessionStorage.getItem(AUTO_KEY)||0)<RETRY_MS;}catch{}
 const auto=!!config.lineLogin&&!handoff&&!blocked&&!recent;
 const [wait,setWait]=useState(null),[failed,setFailed]=useState(''),[ticket,setTicket]=useState(null);
 // เตรียมคำขอไว้ก่อน เพื่อให้การแตะปุ่มเปิดแอป LINE ได้ทันที (iOS ไม่ยอมเปิดแอปถ้ารอเซิร์ฟเวอร์หลังแตะ)
 const prepare=async()=>{const r=await fetch('/api/line/handoff',{method:'POST',credentials:'same-origin'});const d=await r.json().catch(()=>({}));if(!r.ok||!d.url)throw new Error(d.error||'เปิดแอป LINE ไม่สำเร็จ ลองอีกครั้งนะคะ');const next={at:Date.now(),url:d.url};setTicket(next);return next;};
 useEffect(()=>{if(handoff)prepare().catch(()=>{});},[handoff]);
 useEffect(()=>{if(!auto)return;try{sessionStorage.setItem(AUTO_KEY,String(Date.now()));}catch{}location.replace('/api/line/start');},[auto]);
 useEffect(()=>{if(!wait)return;let stop=false,busy=false;
  const check=async()=>{if(stop||busy||document.visibilityState==='hidden')return;if(Date.now()-wait.at>WAIT_MS){setWait(null);setFailed('หมดเวลารอยืนยัน กดเข้าสู่ระบบอีกครั้งนะคะ');return;}busy=true;
   try{const r=await fetch('/api/line/handoff',{credentials:'same-origin',cache:'no-store'});const d=await r.json().catch(()=>({}));if(stop)return;if(d.ok){location.replace('/?connected=line');return;}if(!r.ok&&r.status!==503){setWait(null);setFailed(d.error||'เข้าสู่ระบบไม่สำเร็จ ลองอีกครั้งนะคะ');}}catch{}finally{busy=false;}};
  const id=setInterval(check,POLL_MS);document.addEventListener('visibilitychange',check);window.addEventListener('focus',check);check();
  return()=>{stop=true;clearInterval(id);document.removeEventListener('visibilitychange',check);window.removeEventListener('focus',check);};},[wait]);
 const startHandoff=async e=>{setFailed('');
  if(ticket&&Date.now()-ticket.at<WAIT_MS-60000){setWait({at:Date.now(),url:ticket.url});return;}
  e.preventDefault();try{const next=await prepare();setWait({at:Date.now(),url:next.url});location.href=next.url;}catch(error){setFailed(error.message);}};
 const busy=auto||!!wait;
 return <main className="login-gate">
  <section className="lg-card" aria-labelledby="lg-title">
   <span className="lg-icon"><Lock size={22}/></span>
   <h1 id="lg-title">เข้าสู่ระบบ Dayzi</h1>
   <p className="lg-sub">{wait?'กด “ยืนยัน” ในแชตเดซี่บนแอป LINE แล้วกลับมาที่นี่ ระบบจะเข้าให้เอง':'ใช้บัญชี LINE ของคุณเข้าพื้นที่ส่วนตัว ไม่ต้องตั้งรหัสผ่านใหม่ และคุยกับเดซี่ในแชต LINE ได้เลย'}</p>
   {params.has('error')&&!failed&&<p className="lg-error" role="alert">เข้าสู่ระบบไม่สำเร็จ ลองอีกครั้งนะคะ</p>}
   {failed&&<p className="lg-error" role="alert">{failed}</p>}
   {!config.lineLogin
    ?<p className="lg-wait">ระบบเข้าสู่ระบบยังตั้งค่าไม่เสร็จ กรุณาลองใหม่ภายหลัง</p>
    :handoff
     ?(wait
       ?<a className="lg-line" href={wait.url} aria-busy="true"><Loader2 className="spin" size={20}/>รอยืนยันในแอป LINE… แตะเพื่อเปิดอีกครั้ง</a>
       :<a className="lg-line" href={ticket?.url??'/api/line/start'} onClick={startHandoff}><LineMark/>เข้าสู่ระบบด้วยแอป LINE</a>)
     :<a className="lg-line" href="/api/line/start" aria-busy={busy}>{busy?<Loader2 className="spin" size={20}/>:<LineMark/>}{busy?'กำลังเข้าสู่ระบบ…':'เข้าสู่ระบบด้วย LINE'}</a>}
   <p className="lg-note">{handoff?'แอป LINE จะเปิดแชตเดซี่พร้อมข้อความขอเข้าสู่ระบบ กดส่ง แล้วกด “ยืนยัน” ครั้งเดียว ใช้ได้นานโดยไม่ต้องเข้าใหม่':'บนคอมพิวเตอร์จะมี QR ให้สแกนด้วยแอป LINE บนมือถือ เราไม่เห็นรหัสผ่าน LINE ของคุณ'}</p>
   <nav className="lg-links"><a href="/privacy.html">นโยบายความเป็นส่วนตัว</a><a href="/terms.html">เงื่อนไขการใช้งาน</a></nav>
  </section>
 </main>;
}
