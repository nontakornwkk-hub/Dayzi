import React,{useState} from 'react';
import {MessageCircle,Cloud,Link2,FileSpreadsheet,FolderOpen,Copy,Check,ExternalLink,Loader2,ShieldCheck,Plus,AlertCircle} from 'lucide-react';
import {api} from './storage.mjs';
import {parseStorageUrls} from './model.mjs';

const safe=(url,host)=>{try{const u=new URL(url);return u.protocol==='https:'&&u.hostname===host&&!u.username&&!u.password?u.href:'#';}catch{return '#';}};

// One place to connect storage: log in with LINE first, then either one-tap Google or paste exactly two links.
export default function StorageConnect({user,config,connection,tell,loadError=false}){
 const connected=connection?.status==='ready',googleLinked=connected&&connection.auth==='oauth';
 const [tab,setTab]=useState(config.googleLink?'google':'links'),[sheetUrl,setSheetUrl]=useState(''),[folderUrl,setFolderUrl]=useState(''),[busy,setBusy]=useState(false),[copied,setCopied]=useState(false);
 const addFriend=()=>{if(config.lineBotId)window.open(`https://line.me/R/ti/p/${encodeURIComponent(config.lineBotId)}`,'_blank','noopener,noreferrer');};
 const copy=()=>{navigator.clipboard?.writeText(config.serviceEmail).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);}).catch(()=>tell('คัดลอกไม่สำเร็จ กรุณาคัดลอกเอง','error'));};
 async function connectLinks(){
  setBusy(true);
  try{
   parseStorageUrls(sheetUrl,folderUrl);const body=JSON.stringify({sheetUrl,folderUrl});
   let r=await api('storage/validate',{method:'POST',body});if(r.status==='needs_schema')r=await api('storage/initialize',{method:'POST',body});
   const saved=await api('storage/save',{method:'PUT',body:JSON.stringify({sheetUrl,folderUrl,expectedVersion:connection?.version??0})});
   tell('เชื่อมเรียบร้อยแล้ว กำลังโหลดข้อมูลของคุณ');setTimeout(()=>location.reload(),600);return saved;
  }catch(e){tell(/permission|403|สิทธิ์|access|ไม่พบ/i.test(e.message)?`เข้าไม่ได้ ตรวจว่าแชร์ Sheet และโฟลเดอร์ให้ ${config.serviceEmail} เป็น Editor แล้ว`:e.message,'error');}
  finally{setBusy(false);}
 }
 async function disconnect(){
  if(!confirm('หยุดเชื่อมต่อพื้นที่นี้ ข้อมูลใน Sheet และ Drive ของคุณจะไม่ถูกลบ'))return;
  try{await api('storage/disconnect',{method:'DELETE',body:JSON.stringify({expectedVersion:connection.version})});location.reload();}catch(e){tell(e.message,'error');}
 }

 const status=loadError?['ต้องเชื่อมต่อใหม่','']:connected?['พร้อมใช้งาน','ready']:user?['ยังไม่เชื่อมพื้นที่เก็บข้อมูล','']:['ยังไม่ได้เข้าสู่ระบบ',''];
 return <section className="card storage-connect">
  <header className="sc-head"><span className="sc-icon">{connected?<ShieldCheck size={22}/>:<Cloud size={22}/>}</span><div><h3>พื้นที่เก็บข้อมูลของคุณ</h3><p>ข้อมูลทั้งหมดอยู่ใน Sheet และ Drive ของคุณเอง ไม่ปนกับของคนอื่น</p></div><span className={`connection-label ${status[1]}`}>{status[0]}</span></header>

  {!user&&<div className="sc-body">
   <ol className="sc-steps"><li className="on"><b>1</b>เข้าสู่ระบบด้วย LINE</li><li><b>2</b>วางลิงก์ Sheet และ Drive</li><li><b>3</b>เสร็จ ใช้ได้ทั้งเว็บและ LINE</li></ol>
   <div className="sc-actions">
    {config.lineLogin?<a className="line-button sc-big" href="/api/line/start"><MessageCircle size={19}/>เข้าสู่ระบบด้วย LINE</a>:<div className="setup-notice"><AlertCircle size={17}/><span>ระบบเข้าสู่ระบบด้วย LINE ยังตั้งค่าไม่เสร็จ ผู้ดูแลกำลังดำเนินการ</span></div>}
    {config.lineBotId&&<button className="secondary-button" onClick={addFriend}><Plus size={16}/>เพิ่มเพื่อน Dayzi ใน LINE</button>}
   </div>
   <p className="sc-note">บนคอมจะมี QR ให้สแกนด้วยแอป LINE บนมือถือ เราไม่เห็นรหัสผ่าน LINE ของคุณ</p>
  </div>}

  {user&&connected&&<div className="sc-body">
   <ul className="sc-linked">
    <li><span><FileSpreadsheet size={18}/></span><div><strong>Google Sheet</strong><small>นัดหมาย งาน โน้ต และรายการเงิน</small></div><a className="secondary-button small" href={safe(connection.spreadsheetUrl,'docs.google.com')} target="_blank" rel="noopener noreferrer">เปิด<ExternalLink size={12}/></a></li>
    <li><span><FolderOpen size={18}/></span><div><strong>Google Drive</strong><small>โฟลเดอร์เก็บไฟล์ของคุณ</small></div><a className="secondary-button small" href={safe(connection.driveFolderUrl,'drive.google.com')} target="_blank" rel="noopener noreferrer">เปิด<ExternalLink size={12}/></a></li>
   </ul>
   <p className="sc-note">{googleLinked?'เชื่อมด้วยบัญชี Google ของคุณ ถอนสิทธิ์ได้ที่ myaccount.google.com/permissions':'เชื่อมด้วยการแชร์ให้บัญชีระบบของ Dayzi เป็น Editor'}</p>
   <div className="sc-actions">{config.googleLink&&<a className="primary-button sc-big" href="/api/google/start?link=1">{googleLinked?'เข้าสู่ระบบ Google ใหม่':'เชื่อม Google ของฉัน'}</a>}<button className="text-button danger" onClick={disconnect}>ยกเลิกการเชื่อมต่อ</button></div>
   {!googleLinked&&config.googleLink&&<p className="sc-note">เข้าสู่ Google ครั้งแรกเพื่อสร้าง Sheet และโฟลเดอร์ใหม่ในบัญชีของคุณ ข้อมูลเดิมจะยังอยู่ที่เดิม</p>}
   {googleLinked&&<p className="sc-note">เข้าสู่บัญชี Google เดิมอีกครั้งได้เมื่อสิทธิ์หมดอายุ ระบบจะใช้ Sheet และโฟลเดอร์เดิม</p>}
   {!config.googleLink&&<p className="sc-note" role="status">การเข้าสู่ระบบด้วย Google ยังไม่พร้อม ผู้ดูแลต้องเปิดการเชื่อมต่อก่อน</p>}
  </div>}

  {user&&!connected&&<div className="sc-body">
   {config.googleLink&&<div className="sc-tabs" role="tablist"><button role="tab" aria-selected={tab==='links'} className={tab==='links'?'active':''} onClick={()=>setTab('links')}>วางลิงก์ 2 อัน</button><button role="tab" aria-selected={tab==='google'} className={tab==='google'?'active':''} onClick={()=>setTab('google')}>หรือเชื่อม Google</button></div>}
   {tab==='google'&&config.googleLink?<div className="sc-pane">
    <p>เข้าสู่ Google และกดอนุญาตครั้งแรก เดซี่จะสร้าง Sheet และโฟลเดอร์ให้ในบัญชีของคุณเอง ครั้งต่อไปเชื่อมให้อัตโนมัติ และเข้าสู่ระบบใหม่ได้เมื่อสิทธิ์หมดอายุ</p>
    <a className="primary-button sc-big" href="/api/google/start?link=1"><Cloud size={19}/>เชื่อม Google ของฉัน</a>
    <p className="sc-note">เดซี่เห็นเฉพาะไฟล์ที่เดซี่สร้างเอง ไม่เห็นไฟล์อื่นใน Drive ของคุณ</p>
   </div>:<div className="sc-pane">
    <ol className="sc-how"><li><b>1</b><span>แชร์ Sheet และโฟลเดอร์ของคุณให้อีเมลนี้เป็น <em>Editor</em></span></li></ol>
    {config.serviceEmail?<button type="button" className="sc-email" onClick={copy}><code>{config.serviceEmail}</code><span>{copied?<><Check size={14}/>คัดลอกแล้ว</>:<><Copy size={14}/>คัดลอก</>}</span></button>:<p className="sc-note">ผู้ดูแลยังไม่ได้ตั้งค่าบัญชีระบบ</p>}
    <ol className="sc-how" start="2"><li><b>2</b><span>วางลิงก์ทั้งสองอย่างด้านล่าง แล้วกดเชื่อมต่อ</span></li></ol>
    <label className="sc-field"><span><FileSpreadsheet size={16}/>ลิงก์ Google Sheet</span><input type="url" inputMode="url" placeholder="https://docs.google.com/spreadsheets/d/…" value={sheetUrl} onChange={e=>setSheetUrl(e.target.value.trim())}/></label>
    <label className="sc-field"><span><FolderOpen size={16}/>ลิงก์โฟลเดอร์ Google Drive</span><input type="url" inputMode="url" placeholder="https://drive.google.com/drive/folders/…" value={folderUrl} onChange={e=>setFolderUrl(e.target.value.trim())}/></label>
    <button className="primary-button sc-big" disabled={busy||!sheetUrl||!folderUrl} onClick={connectLinks}>{busy?<Loader2 size={18} className="spin"/>:<Link2 size={18}/>}เชื่อมต่อเลย</button>
   </div>}
  </div>}
 </section>;
}
