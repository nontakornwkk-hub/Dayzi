import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import Select from './Select.jsx';
import {createPortal} from 'react-dom';
import {CalendarDays,ChevronLeft,ChevronRight,X} from 'lucide-react';
import {dateAdd,localDate,monthDays,thaiDate} from './model.mjs';
import './date-picker.css';

const months=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
export default function DatePicker({value='',onChange,min,max,required=false,'aria-label':label='เลือกวันที่'}){
 const [open,setOpen]=useState(false),[month,setMonth]=useState((value||localDate()).slice(0,7)),[position,setPosition]=useState({});
 const trigger=useRef(),popover=useRef(),today=localDate();
 const [year,monthNumber]=month.split('-').map(Number),days=monthDays(year,monthNumber-1);
 const allowed=date=>(!min||date>=min)&&(!max||date<=max);
 const close=()=>{setOpen(false);trigger.current?.focus();};
 const choose=date=>{if(!date||allowed(date)){onChange?.({target:{value:date}});close();}};
 const moveMonth=amount=>{const d=new Date(Date.UTC(year,monthNumber-1+amount,1));setMonth(d.toISOString().slice(0,7));};
 function show(){setMonth((value||today).slice(0,7));const rect=trigger.current.getBoundingClientRect(),width=Math.min(320,window.innerWidth-24),height=390;setPosition({width,left:Math.max(12,Math.min(rect.left,window.innerWidth-width-12)),top:rect.bottom+height+12<window.innerHeight?rect.bottom+8:Math.max(12,rect.top-height-8)});setOpen(!open);}
 useEffect(()=>{if(!open)return;const outside=e=>{if(!popover.current?.contains(e.target)&&!trigger.current?.contains(e.target))setOpen(false);};const key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}};const reposition=()=>setOpen(false);document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key,true);window.addEventListener('resize',reposition);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key,true);window.removeEventListener('resize',reposition);};},[open]);
 useEffect(()=>{if(open){const button=popover.current?.querySelector('[aria-pressed="true"]')??popover.current?.querySelector('.date-picker-day:not(:disabled):not(.outside-month)');button?.focus();}},[open,month]);
 useLayoutEffect(()=>{if(!open||!popover.current||!trigger.current)return;const box=popover.current.getBoundingClientRect(),rect=trigger.current.getBoundingClientRect();let top=rect.bottom+8;if(top+box.height>window.innerHeight-12)top=rect.top-box.height-8;top=Math.max(12,Math.min(top,window.innerHeight-box.height-12));setPosition(p=>({...p,top}));},[open,month]);
 function moveFocus(event,date){const distance={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key];if(!distance)return;event.preventDefault();const next=dateAdd(date,distance);if(!allowed(next))return;setMonth(next.slice(0,7));requestAnimationFrame(()=>popover.current?.querySelector(`[data-date="${next}"]`)?.focus());}
 const popup=open&&<div className="date-picker-popover" ref={popover} role="dialog" aria-label={`เลือก${label}`} style={position} onClick={e=>e.stopPropagation()}>
  <div className="date-picker-heading"><span><CalendarDays size={16}/>{label}</span><button type="button" aria-label="ปิดปฏิทินเลือกวัน" onClick={close}><X size={17}/></button></div>
  <div className="date-picker-navigation"><button type="button" aria-label="เดือนก่อนหน้า" onClick={()=>moveMonth(-1)}><ChevronLeft size={18}/></button><div><Select aria-label="เลือกเดือน" value={monthNumber} onChange={e=>setMonth(`${year}-${e.target.value.padStart(2,'0')}`)}>{months.map((name,i)=><option key={name} value={i+1}>{name}</option>)}</Select><Select aria-label="เลือกปี" value={year} onChange={e=>setMonth(`${e.target.value}-${String(monthNumber).padStart(2,'0')}`)}>{Array.from({length:121},(_,i)=>year-80+i).map(y=><option key={y} value={y}>{y+543}</option>)}</Select></div><button type="button" aria-label="เดือนถัดไป" onClick={()=>moveMonth(1)}><ChevronRight size={18}/></button></div>
  <div className="date-picker-weekdays">{['จ.','อ.','พ.','พฤ.','ศ.','ส.','อา.'].map(day=><span key={day}>{day}</span>)}</div>
  <div className="date-picker-grid">{days.map(date=><button type="button" className={`date-picker-day ${date.slice(0,7)!==month?'outside-month':''} ${date===today?'today':''}`} data-date={date} key={date} disabled={!allowed(date)} aria-label={thaiDate(date,{year:'numeric',month:'long'})} aria-pressed={date===value} onClick={()=>choose(date)} onKeyDown={e=>moveFocus(e,date)}>{Number(date.slice(8))}</button>)}</div>
  <div className="date-picker-footer">{!required&&<button type="button" onClick={()=>choose('')}>ไม่กำหนดวัน</button>}<button type="button" className="picker-today" disabled={!allowed(today)} onClick={()=>choose(today)}>วันนี้</button></div>
 </div>;
 return <span className="date-picker-field"><input hidden type="date" aria-label={label} value={value} min={min} max={max} onChange={onChange}/><button type="button" className="date-picker-trigger" ref={trigger} aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={show}><span>{value?thaiDate(value,{month:'short',year:'numeric'}):'เลือกวันที่'}</span><CalendarDays size={16}/></button>{popup&&createPortal(popup,trigger.current?.closest('dialog')??document.body)}</span>;
}
