const pages=new Set(['overview','calendar','tasks','files','notes','assistant','settings','finance']);
export function initialPage(search=''){const page=new URLSearchParams(search).get('page');return pages.has(page)?page:'overview';}
export function twoButtonRichMenu(site){
 const home=new URL('/',site),calendar=new URL('/?page=calendar',site);
 if(home.protocol!=='https:')throw new Error('Rich Menu requires HTTPS');
 return {size:{width:2500,height:843},selected:true,name:'Dayzi app and calendar',chatBarText:'เปิดเดซี่ 🌼',areas:[
  {bounds:{x:0,y:0,width:1250,height:843},action:{type:'uri',label:'เข้าแอป Dayzi',uri:home.href}},
  {bounds:{x:1250,y:0,width:1250,height:843},action:{type:'uri',label:'ปฏิทินของฉัน',uri:calendar.href}},
 ]};
}

// Six equal tiles (3 x 2) matching the Dayzi menu artwork. Message tiles reuse the bot's no-AI quick answers.
export const MENU_MESSAGES={today:'วันนี้มีนัดและงานอะไรบ้าง',tasks:'งานที่ยังไม่เสร็จมีอะไรบ้าง',files:'ไฟล์ของฉันมีอะไรบ้าง',chat:'คุยกับเดซี่หน่อย'};
export function sixButtonRichMenu(site,botId){
 const home=new URL('/',site);
 if(home.protocol!=='https:')throw new Error('Rich Menu requires HTTPS');
 if(!/^@[A-Za-z0-9_.-]+$/.test(botId??''))throw new Error('LINE bot id is required');
 const widths=[833,834,833],height=843,tile=(col,row,action)=>({bounds:{x:widths.slice(0,col).reduce((a,b)=>a+b,0),y:row*height,width:widths[col],height},action});
 const message=(label,text)=>({type:'message',label,text});
 return {size:{width:2500,height:1686},selected:true,name:'Dayzi six tiles',chatBarText:'เมนูเดซี่ 🌼',areas:[
  tile(0,0,{type:'uri',label:'เข้าแอป Dayzi',uri:home.href}),
  tile(1,0,message('วันนี้มีอะไร',MENU_MESSAGES.today)),
  tile(2,0,{type:'uri',label:'เพิ่มนัด / ตั้งเตือน',uri:`https://line.me/R/oaMessage/${encodeURIComponent(botId)}/?${encodeURIComponent('เพิ่มนัด ')}`}),
  tile(0,1,message('งานที่ต้องทำ',MENU_MESSAGES.tasks)),
  tile(1,1,message('คลังไฟล์',MENU_MESSAGES.files)),
  tile(2,1,message('คุยกับเดซี่',MENU_MESSAGES.chat)),
 ]};
}
