import {dateAdd,occursOn} from './model.mjs';
export const TASK_PERIODS=[['today','วันนี้'],['week','สัปดาห์นี้'],['month','เดือนนี้'],['all','ทั้งหมด'],['overdue','เลยกำหนด'],['undated','ไม่มีกำหนด']];
export function taskDates(start,end=start,weekdays=false){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||end<start)throw new Error('วันสิ้นสุดต้องไม่อยู่ก่อนวันเริ่ม');
 const dates=[];let count=0;
 for(let date=start;date<=end;date=dateAdd(date,1)){if(++count>366)throw new Error('เลือกช่วงวันที่ได้ครั้งละไม่เกินหนึ่งปี');const day=new Date(`${date}T12:00Z`).getUTCDay();if(!weekdays||(day!==0&&day!==6))dates.push(date);}
 return dates;
}
export function inTaskPeriod(task,period,today){
 if(period==='all')return true;
 if(period==='undated')return !task.date;
 if(period==='overdue')return Boolean(task.date&&task.date<today&&!task.done);
 if(period==='today')return task.date===today;
 if(period==='month')return task.date?.slice(0,7)===today.slice(0,7);
 const weekday=new Date(`${today}T12:00Z`).getUTCDay(),start=dateAdd(today,-((weekday+6)%7));
 return Boolean(task.date&&task.date>=start&&task.date<=dateAdd(start,6));
}
export function agendaItems(data,start,end,{category='all',search=''}={}){
 const items=[],matches=item=>(category==='all'||item.category===category)&&(!search||item.title.toLowerCase().includes(search.toLowerCase()));
 for(let date=start;date<=end;date=dateAdd(date,1)){
  for(const event of data.events)if(event.status!=='cancelled'&&matches(event)&&occursOn(event,date))items.push({kind:'event',date,item:event});
  for(const task of data.tasks)if(matches(task)&&task.date===date)items.push({kind:'task',date,item:task});
 }
 return items.sort((a,b)=>a.date.localeCompare(b.date)||(a.kind==='event'?a.item.allDay?'00:00':a.item.time??'00:00':'25:00').localeCompare(b.kind==='event'?b.item.allDay?'00:00':b.item.time??'00:00':'25:00'));
}
