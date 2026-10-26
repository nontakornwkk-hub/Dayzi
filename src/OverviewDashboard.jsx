import React from 'react';
import {CalendarDays,CheckCheck,AlertCircle,Wallet,ArrowRight,Plus,CalendarClock} from 'lucide-react';
import {thaiDate,dateAdd} from './model.mjs';
import {inTaskPeriod} from './planning.mjs';
import {financeSummary,money} from './finance.mjs';

export default function OverviewDashboard({data,today,todayEvents,activeTasks,eventsFor,eventRow,taskList,navigate,setModal,ask,setSelected,setView,setTaskPeriod,uid}){
 const overdue=data.tasks.filter(t=>inTaskPeriod(t,'overdue',today)).length;
 const spend=financeSummary(data.transactions??[],today.slice(0,7));
 const upcoming=Array.from({length:7},(_,i)=>dateAdd(today,i+1)).flatMap(d=>eventsFor(d).map(e=>({...e,on:d}))).slice(0,6);
 const stats=[
  ['lavender',CalendarDays,todayEvents.length,'นัดหมายวันนี้',()=>{navigate('calendar');setSelected(today);setView('day');}],
  ['mint',CheckCheck,activeTasks.length,'งานที่ยังไม่เสร็จ',()=>{navigate('tasks');setTaskPeriod('all');}],
  ['rose',AlertCircle,overdue,'งานเลยกำหนด',()=>{navigate('tasks');setTaskPeriod('overdue');}],
  ['sun',Wallet,money(spend.expense),'ใช้จ่ายเดือนนี้',()=>navigate('finance')],
 ];
 return <div className="dashboard">
  <section className="stat-grid">{stats.map(([tone,Icon,value,label,go])=><button key={label} className={`stat-card tone-${tone}`} onClick={go}><span className="stat-icon"><Icon size={20}/></span><strong>{value}</strong><span>{label}</span></button>)}</section>
   <div className="dashboard-grid">
   <section className="card dash-panel"><div className="section-head"><h3><CalendarDays size={18}/>วันนี้</h3><span className="muted">{thaiDate(today,{weekday:'long'})}</span></div>{todayEvents.length?todayEvents.map(eventRow):<p className="dash-empty">วันนี้ยังไม่มีนัดหมาย</p>}<button className="see-all" onClick={()=>setModal({type:'event',isNew:true,value:{id:uid(),title:'',date:today,time:'09:00',endTime:'10:00',category:'work',status:'active',repeat:'none',reminders:[30],channels:['line'],note:'',fileIds:[]}})}><Plus size={14}/>เพิ่มนัดวันนี้</button></section>
   <section className="card dash-panel"><div className="section-head"><h3><CalendarClock size={18}/>7 วันข้างหน้า</h3><button className="text-button" onClick={()=>navigate('calendar')}>ปฏิทิน <ArrowRight size={14}/></button></div>{upcoming.length?<ul className="upcoming-list">{upcoming.map(e=><li key={e.id+e.on}><span className="up-date"><b>{thaiDate(e.on,{month:undefined,day:'numeric'})}</b><small>{thaiDate(e.on,{weekday:'short',day:undefined,month:'short'})}</small></span><span className="up-title">{e.title}<small>{e.allDay?'ทั้งวัน':`${e.time} น.`}</small></span></li>)}</ul>:<p className="dash-empty">ยังไม่มีนัดในสัปดาห์หน้า</p>}</section>
   <section className="card dash-panel dash-tasks"><div className="section-head"><h3><CheckCheck size={18}/>งานที่ต้องทำ</h3><button className="text-button" onClick={()=>navigate('tasks')}>ทั้งหมด <ArrowRight size={14}/></button></div>{taskList(6)}</section>
  </div>
 </div>;
}
