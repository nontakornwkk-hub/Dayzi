import React,{useEffect} from 'react';
import {Lock,Loader2} from 'lucide-react';

const AUTO_KEY='dayzi:auto-login';
const RETRY_MS=30000;
const LineMark=()=><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3C6.48 3 2 6.6 2 11.04c0 3.98 3.55 7.31 8.35 7.94.33.07.77.22.88.5.1.25.07.64.03.9l-.14.85c-.04.25-.2.98.86.53 1.06-.45 5.71-3.36 7.79-5.76C21.2 14.43 22 12.82 22 11.04 22 6.6 17.52 3 12 3Zm-3.93 10.4H6.08a.53.53 0 0 1-.53-.53V8.9a.53.53 0 1 1 1.06 0v3.44h1.46a.53.53 0 1 1 0 1.06Zm2.05-.53a.53.53 0 1 1-1.06 0V8.9a.53.53 0 1 1 1.06 0v3.97Zm4.79 0a.53.53 0 0 1-.95.32l-2.03-2.77v2.45a.53.53 0 1 1-1.06 0V8.9a.53.53 0 0 1 .95-.32l2.03 2.77V8.9a.53.53 0 1 1 1.06 0v3.97Zm3.22-2.51a.53.53 0 1 1 0 1.06h-1.46v.92h1.46a.53.53 0 1 1 0 1.06h-1.99a.53.53 0 0 1-.53-.53V8.9c0-.29.24-.53.53-.53h1.99a.53.53 0 1 1 0 1.06h-1.46v.92h1.46Z"/></svg>;

// One button. On the first visit we go straight to LINE Login without waiting; if the person comes back
// (cancelled, failed, or logged out) the button stays put instead of looping.
export default function LoginGate({config}){
 const params=new URLSearchParams(location.search),blocked=params.has('error')||params.has('loggedout');
 let recent=false;try{recent=Date.now()-Number(sessionStorage.getItem(AUTO_KEY)||0)<RETRY_MS;}catch{}
 const auto=!!config.lineLogin&&!blocked&&!recent;
 useEffect(()=>{if(!auto)return;try{sessionStorage.setItem(AUTO_KEY,String(Date.now()));}catch{}location.replace('/api/line/start');},[auto]);
 return <main className="login-gate">
  <section className="lg-card" aria-labelledby="lg-title">
   <span className="lg-icon"><Lock size={22}/></span>
   <h1 id="lg-title">เข้าสู่ระบบ Dayzi</h1>
   <p className="lg-sub">ใช้บัญชี LINE ของคุณเข้าพื้นที่ส่วนตัว ไม่ต้องตั้งรหัสผ่านใหม่ และคุยกับเดซี่ในแชต LINE ได้เลย</p>
   {params.has('error')&&<p className="lg-error" role="alert">เข้าสู่ระบบไม่สำเร็จ ลองอีกครั้งนะคะ</p>}
   {config.lineLogin
    ?<a className="lg-line" href="/api/line/start" aria-busy={auto}>{auto?<Loader2 className="spin" size={20}/>:<LineMark/>}{auto?'กำลังเข้าสู่ระบบ…':'เข้าสู่ระบบด้วย LINE'}</a>
    :<p className="lg-wait">ระบบเข้าสู่ระบบยังตั้งค่าไม่เสร็จ กรุณาลองใหม่ภายหลัง</p>}
   <p className="lg-note">บนคอมพิวเตอร์จะมี QR ให้สแกนด้วยแอป LINE บนมือถือ เราไม่เห็นรหัสผ่าน LINE ของคุณ</p>
   <nav className="lg-links"><a href="/privacy.html">นโยบายความเป็นส่วนตัว</a><a href="/terms.html">เงื่อนไขการใช้งาน</a></nav>
  </section>
 </main>;
}
