/** Paste into Extensions > Apps Script in your own Google Sheet.
 * Run setupDayzi once. Deploy > New deployment > Web app; execute as Me,
 * access Anyone. Enter its /exec URL and the displayed secret in Dayzi.
 * Anyone knowing both URL and secret can access this data; keep them private.
 * This connector does not link LINE or upload original files to Google Drive.
 */
function setupDayzi(){
 var props=PropertiesService.getScriptProperties(),book=SpreadsheetApp.getActiveSpreadsheet();
 if(!book)throw Error('Open this script from your own Google Sheet');
 var previous=props.getProperty('DAYZI_SHEET_ID');if(previous&&previous!==book.getId())throw Error('This script is already bound to a different Sheet');
 props.setProperty('DAYZI_SHEET_ID',book.getId());
 if(!props.getProperty('DAYZI_SECRET'))props.setProperty('DAYZI_SECRET',Utilities.getUuid()+Utilities.getUuid());
 if(!props.getProperty('DAYZI_OWNER_ID'))props.setProperty('DAYZI_OWNER_ID','personal-'+Utilities.getUuid());
 if(!props.getProperty('DAYZI_REVISION'))props.setProperty('DAYZI_REVISION','0');
 SpreadsheetApp.getUi().alert('Dayzi รหัสลับส่วนตัว (เก็บเป็นความลับ)\n'+props.getProperty('DAYZI_SECRET')+'\n\nเผยแพร่ Web app: Execute as Me / Anyone แล้วนำ URL /exec และรหัสนี้ไปใส่ในแอป');
}
function doPost(e){
 var lock=LockService.getScriptLock();
 try{
  var text=e&&e.postData&&e.postData.contents||'';if(text.length>950000)throw {status:413,message:'Too large'};
  var request=JSON.parse(text),props=PropertiesService.getScriptProperties(),secret=props.getProperty('DAYZI_SECRET'),sheetId=props.getProperty('DAYZI_SHEET_ID'),owner=props.getProperty('DAYZI_OWNER_ID');
  if(!secret||request.secret!==secret)throw {status:401,message:'Unauthorized'};
  if(!sheetId||!owner)throw {status:503,message:'Run setupDayzi first'};
  if(!lock.tryLock(15000))throw {status:503,message:'Busy'};
  var book=SpreadsheetApp.openById(sheetId),revision=Number(props.getProperty('DAYZI_REVISION')||0),payload=request.payload||{};
  if(request.action==='read')return personalOutput_({ownerId:owner,data:personalReadData_(book,owner),revision:revision});
  if(request.action==='write'){
   if(payload.expectedRevision!==revision)throw {status:409,message:'Revision changed'};
   var data=personalData_(payload.data,owner),tables={};
   ['events','tasks','notes','files','transactions'].forEach(function(name){tables[name]=data[name].map(function(item){return [item.id,owner,JSON.stringify(item)];});});
   tables.settings=[['settings',owner,JSON.stringify(data.settings)],['delivered',owner,JSON.stringify(data.delivered)]];
   Object.keys(tables).forEach(function(name){personalRows_(book,name,owner);tables[name].forEach(function(row){if(row[2].length>45000)throw {status:400,message:'Row too large'};});});
   Object.keys(tables).forEach(function(name){personalReplace_(book,name,tables[name]);});
   SpreadsheetApp.flush();props.setProperty('DAYZI_REVISION',String(revision+1));return personalOutput_({revision:revision+1});
  }
  if(request.action==='chats')return personalOutput_({chats:personalRows_(book,'chats',owner).map(function(row){return personalChat_(JSON.parse(row[2]));}).sort(function(a,b){return b.updatedAt-a.updatedAt;})});
  if(request.action==='saveChat'){
   if(Object.keys(payload).some(function(key){return key!=='chat'&&key!=='deletedId';})||Object.prototype.hasOwnProperty.call(payload,'chat')===Object.prototype.hasOwnProperty.call(payload,'deletedId'))throw {status:400,message:'Invalid chat mutation'};
   var chat=payload.chat?personalChat_(payload.chat):null,id=chat?chat.id:payload.deletedId;
   if(!personalId_(id))throw {status:400,message:'Invalid id'};
   var rows=personalRows_(book,'chats',owner),index=-1;rows.forEach(function(row,i){if(row[0]===id)index=i;});
   if(chat){var row=[id,owner,JSON.stringify(chat)];if(row[2].length>45000)throw {status:400,message:'Chat too large'};if(index>=0)rows[index]=row;else rows.push(row);if(rows.length>1000)throw {status:400,message:'Too many chats'};}
   else if(index>=0)rows.splice(index,1);
   personalReplace_(book,'chats',rows);SpreadsheetApp.flush();return personalOutput_(chat?{chat:chat}:{deletedId:id});
  }
  throw {status:400,message:'Unknown action'};
 }catch(error){return personalOutput_({error:error.message||'Personal Sheet error',status:error.status||500});}finally{if(lock.hasLock())lock.releaseLock();}
}
function personalOutput_(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
function personalId_(id){return typeof id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(id);}
function personalRows_(book,name,owner){
 var sheet=book.getSheetByName('dayzi_'+name);if(!sheet)return [];
 var values=sheet.getDataRange().getValues();if(values.length===1&&values[0].every(function(v){return v==='';}))return [];
 if(JSON.stringify(values[0])!==JSON.stringify(['id','owner_id','json']))throw {status:409,message:'Existing tab has a different format'};
 var rows=[];values.slice(1).forEach(function(row){if(!row[0])return;if(row[1]!==owner)throw {status:403,message:'Owner mismatch'};rows.push(row);});return rows;
}
function personalReplace_(book,name,rows){
 var sheet=book.getSheetByName('dayzi_'+name)||book.insertSheet('dayzi_'+name),count=Math.max(sheet.getLastRow(),rows.length+1),values=[['id','owner_id','json']].concat(rows);
 if(sheet.getMaxRows&&sheet.getMaxRows()<count)sheet.insertRowsAfter(sheet.getMaxRows(),count-sheet.getMaxRows());
 while(values.length<count)values.push(['','','']);sheet.getRange(1,1,count,3).setValues(values);
}
function personalReadData_(book,owner){
 var data={settings:{name:'คุณ',quietStart:'22:00',quietEnd:'07:00',lineEnabled:false,pushEnabled:false},delivered:{}};
 ['events','tasks','notes','files','transactions'].forEach(function(name){data[name]=personalRows_(book,name,owner).map(function(row){var item=JSON.parse(row[2]);item.ownerId=owner;return item;});});
 personalRows_(book,'settings',owner).forEach(function(row){if(row[0]==='settings')data.settings=JSON.parse(row[2]);if(row[0]==='delivered')data.delivered=JSON.parse(row[2]);});return data;
}
function personalData_(data,owner){
 if(!data||typeof data!=='object'||Array.isArray(data)||JSON.stringify(data).length>900000)throw {status:400,message:'Invalid data'};
 var clean={};['events','tasks','notes','files','transactions'].forEach(function(name){var items=data[name]||[];if(!Array.isArray(items)||items.length>1000)throw {status:400,message:'Invalid rows'};var seen={};clean[name]=items.map(function(item){if(!item||!personalId_(item.id)||seen[item.id])throw {status:400,message:'Invalid id'};seen[item.id]=true;var copy=JSON.parse(JSON.stringify(item));copy.ownerId=owner;if(JSON.stringify(copy).length>45000)throw {status:400,message:'Row too large'};return copy;});});
 ['settings','delivered'].forEach(function(name){var value=data[name]||{};if(typeof value!=='object'||Array.isArray(value))throw {status:400,message:'Invalid settings'};clean[name]=value;});if(JSON.stringify(clean).length>900000)throw {status:400,message:'Data too large'};return clean;
}
function personalChat_(chat){
 if(!chat||!personalId_(chat.id)||typeof chat.title!=='string'||chat.title.length>200||!Array.isArray(chat.messages)||chat.messages.length>200)throw {status:400,message:'Invalid chat'};
 var updated=typeof chat.updatedAt==='number'?chat.updatedAt:Date.parse(chat.updatedAt);if(!Number.isSafeInteger(updated)||updated<=0)throw {status:400,message:'Invalid chat date'};
 var messages=chat.messages.map(function(message){
  if(!message||['user','assistant'].indexOf(message.role)<0||typeof (message.text||'')!=='string'||(message.text||'').length>20000)throw {status:400,message:'Invalid message'};
  var clean={role:message.role,text:message.text||''};if(message.id!==undefined){if(!personalId_(message.id))throw {status:400,message:'Invalid message id'};clean.id=message.id;}
  if(message.source!==undefined){if(typeof message.source!=='string'||message.source.length>80)throw {status:400,message:'Invalid source'};clean.source=message.source;}
  if(message.attachments!==undefined){if(!Array.isArray(message.attachments)||message.attachments.length>10)throw {status:400,message:'Invalid attachments'};clean.attachments=message.attachments.map(function(file){if(!file||!personalId_(file.id)||typeof file.name!=='string'||file.name.length>255||typeof file.mimeType!=='string'||file.mimeType.length>150)throw {status:400,message:'Invalid attachment'};var result={id:file.id,name:file.name,mimeType:file.mimeType};if(file.driveId!==undefined){if(typeof file.driveId!=='string'||!/^[A-Za-z0-9_-]{1,200}$/.test(file.driveId))throw {status:400,message:'Invalid drive id'};result.driveId=file.driveId;}if(typeof file.local==='boolean')result.local=file.local;if(file.source!==undefined){if(typeof file.source!=='string'||file.source.length>80||/^(blob:|data:)/i.test(file.source))throw {status:400,message:'Invalid attachment source'};result.source=file.source;}return result;});}
  if(!clean.text&&!(clean.attachments&&clean.attachments.length))throw {status:400,message:'Empty message'};return clean;
 });
 if(JSON.stringify(messages).length>44000)throw {status:400,message:'Messages too large'};return {id:chat.id,title:chat.title,updatedAt:updated,messages:messages};
}
