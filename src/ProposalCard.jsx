import React from 'react';
import {CalendarDays,CheckCheck,Wallet,StickyNote,Check,X,Clock,MapPin} from 'lucide-react';
import {thaiDate} from './model.mjs';
import {money} from './finance.mjs';

const KIND={add_event:[CalendarDays,'นัดหมาย'],add_task:[CheckCheck,'งานที่ต้องทำ'],add_transaction:[Wallet,'รายรับรายจ่าย'],add_note:[StickyNote,'โน้ต']};
// Shows what Dayzi understood so nothing is saved until the user confirms it.
export default function ProposalCard({action,state='pending',onDecide}){
 const a=action.arguments,[Icon,label]=KIND[action.name]??[Check,'รายการ'];
 const rows=[];
 if(a.date)rows.push([CalendarDays,thaiDate(a.date)]);
 if(action.name==='add_event')rows.push([Clock,a.allDay||!a.time?'ทั้งวัน':`${a.time}${a.endTime?`–${a.endTime}`:''} น.`]);
 if(a.location)rows.push([MapPin,a.location]);
 if(action.name==='add_transaction')rows.push([Wallet,`${a.type==='income'?'รายรับ':a.type==='transfer'?'โอน':'รายจ่าย'} ${money(a.amount)}`]);
 return <div className={`proposal-card is-${state}`}>
  <div className="proposal-head"><span className="proposal-icon"><Icon size={18}/></span><div><small>{label}</small><strong>{a.title??a.content?.slice(0,80)}</strong></div></div>
  {rows.length>0&&<ul className="proposal-rows">{rows.map(([I,t],i)=><li key={i}><I size={14}/>{t}</li>)}</ul>}
  {state==='pending'?<div className="proposal-actions"><button className="primary-button small" onClick={()=>onDecide(true)}><Check size={15}/>ยืนยันบันทึก</button><button className="ghost-button small" onClick={()=>onDecide(false)}><X size={15}/>ยกเลิก</button></div>
  :<p className="proposal-status">{state==='saved'?'✓ บันทึกแล้ว':'ยกเลิกแล้ว'}</p>}
 </div>;
}
