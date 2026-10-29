import {randomBytes,createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {safeProfilePicture,safeLinePicture} from '../src/profile.mjs';
import {generateIntentPlan} from './intent-planner.mjs';
import {readReceiptImage} from './receipt-vision.mjs';
import { generateGeminiReply, geminiStreamResponse, publicGeminiConfig } from './assistant.mjs';
import {env,json,cookie,signSession,verifySession,encryptSecret,ownedFile} from './security.mjs';
import {registry} from './registry.mjs';
import {partialRanges} from './partial-save.mjs';
import {runReminders} from './reminders.mjs';
import {pushReady,sendTestPush,checkReminderConnection} from './push.mjs';
import {LINK_SCOPES,LINE_UID,readLinkToken,provisionUserStorage} from './google-link.mjs';
import {personalSheetRequest} from './personal-sheet.mjs';
import {limitedBytes,startUpload,uploadChunk,CHUNK_SIZE,trashDriveFile,uploadSmallFile} from './files.mjs';
import {lineAuthorizationUrl,exchangeLineIdentity,safeLineDraft,lineProfilePicture} from './line.mjs';
import {handleLineWebhook} from './line-bot.mjs';
import {oauth,accessToken,googleFetch,inspectStorage,initializeStorage,readRanges,encodeData,decodeData,validateData,serviceAccountEmail,encodeChat,sanitizeChatMutation} from './google.mjs';
import {parseStorageUrls,parseQuickEvent,localDate,dateAdd} from '../src/model.mjs';

const required=['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','SESSION_SECRET','TOKEN_ENCRYPTION_KEY','REGISTRY_URL','REGISTRY_SECRET'];
const configured=()=>required.every(k=>!!env(k));
const backendConfigured=()=>['SESSION_SECRET','TOKEN_ENCRYPTION_KEY','REGISTRY_URL','REGISTRY_SECRET'].every(k=>!!env(k));
const lineConfigured=()=>backendConfigured()&&!!(env('LINE_LOGIN_CHANNEL_ID')&&env('LINE_LOGIN_CHANNEL_SECRET'));
// บอกแค่ว่าค่าที่ LINE Login ต้องใช้ตั้งแล้วหรือยัง (true/false) ไม่เปิดเผยค่าจริง แสดงเฉพาะตอนยังตั้งไม่ครบ
const setupStatus=()=>lineConfigured()?undefined:Object.fromEntries(['LINE_LOGIN_CHANNEL_ID','LINE_LOGIN_CHANNEL_SECRET','SESSION_SECRET','TOKEN_ENCRYPTION_KEY','REGISTRY_URL','REGISTRY_SECRET'].map(k=>[k,!!env(k)]));
const options=()=>({setup:setupStatus(),serviceEmail:serviceAccountEmail(),google:configured(),googleLink:configured(),lineLogin:lineConfigured(),lineBotId:env('LINE_BOT_ID')??'',pickerKey:env('GOOGLE_PICKER_API_KEY')??'',googleProjectNumber:env('GOOGLE_PROJECT_NUMBER')??'',vapidPublicKey:env('VAPID_PUBLIC_KEY')??'',pushReady:pushReady(),reminderSchedulerReady:env('REMINDER_SCHEDULER_READY')==='1',line:!!(env('LINE_CHANNEL_ACCESS_TOKEN')&&env('LINE_CHANNEL_SECRET')&&env('LINE_BOT_ID')),...publicGeminiConfig()});
const connection=a=>a?.connection?{...a.connection,version:a.version,schemaVersion:2}:null;
const actor=req=>{if(!backendConfigured())throw Object.assign(new Error('เจ้าของระบบยังไม่ได้ตั้งค่าบัญชีและพื้นที่เก็บข้อมูล'),{status:503});try{return verifySession(cookie(req,'dayzi_session'),env('SESSION_SECRET'));}catch{throw Object.assign(new Error('กรุณายืนยันบัญชี LINE ก่อน'),{status:401});}};
const ready=a=>{if(a?.connection?.status!=='ready')throw Object.assign(new Error('กรุณาตั้งค่า URL และบันทึกการเชื่อมต่อก่อน'),{status:409});};
async function body(req){const text=await req.text();if(text.length>950000)throw Object.assign(new Error('ข้อมูลใหญ่เกินกำหนด'),{status:413});try{return JSON.parse(text);}catch{throw Object.assign(new Error('รูปแบบข้อมูลไม่ถูกต้อง'),{status:400});}}
const redirect=(url,cookies=[])=>{const h=new Headers({Location:url,'Cache-Control':'no-store'});cookies.forEach(c=>h.append('Set-Cookie',c));return new Response(null,{status:302,headers:h});};
const setCookie=(name,value,age=86400)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
// เข้าสู่ระบบครั้งเดียวใช้ได้นาน ไม่ต้องกลับไปยืนยัน LINE ทุกวัน
const SESSION_TTL=180*86400;
const sessionCookie=user=>setCookie('dayzi_session',signSession(user,env('SESSION_SECRET'),undefined,SESSION_TTL),SESSION_TTL);
const HANDOFF_ID=/^[a-f0-9]{24}$/;
// บัญชี LINE เชื่อม Sheet ของตัวเองผ่าน service account ส่วนบัญชี Google เดิมใช้ OAuth ของตัวเอง
const storageMode=a=>a.authProvider==='line'&&!a.encryptedToken?'service':'oauth';
async function accountData(a,origin){ready(a);const token=await accessToken(a,origin);const data=decodeData(await readRanges(token,a.connection.spreadsheetId),a.uid);data.settings={...data.settings,sheetUrl:a.connection.spreadsheetUrl,folderUrl:a.connection.driveFolderUrl};return {data,token};}

export default async function handler(req){const url=new URL(req.url),origin=url.origin;const path=url.pathname.replace(/^\/\.netlify\/functions\/api\/?/,'').replace(/^\/api\/?/,'');try{
 if(path==='cron/reminders')return url.searchParams.get('dryRun')==='1'?checkReminderConnection(req):runReminders(req);
 if(path==='status'){let u=null,a=null;if(backendConfigured()){try{u=actor(req);a=await registry('get',u.sub);if(LINE_UID.test(u.sub)&&!safeLinePicture(u.picture))u.picture=await lineProfilePicture(u.sub.slice(5));}catch{u=null;}}return json({user:u?{sub:u.sub,name:u.name,email:u.email,picture:safeProfilePicture(u.picture),provider:a?.authProvider??u.provider??'google'}:null,connection:connection(a),config:options()});}
 if(path==='line/start'){if(!lineConfigured())return json({error:'เจ้าของระบบต้องตั้ง LINE Login และพื้นที่ Sheets กลางก่อน ผู้ใช้ไม่ต้องเชื่อม Google เอง'},503);const state=randomBytes(24).toString('hex'),nonce=randomBytes(24).toString('hex'),verifier=randomBytes(48).toString('base64url');return redirect(lineAuthorizationUrl(origin,{state,nonce,verifier}),[setCookie('dayzi_line',signSession({sub:state,nonce,verifier,draft:safeLineDraft(url.searchParams.get('draft'))},env('SESSION_SECRET')),600)]);}
 if(path==='line/callback'){try{if(!lineConfigured())throw new Error('Not configured');const state=verifySession(cookie(req,'dayzi_line'),env('SESSION_SECRET'));if(state.sub!==url.searchParams.get('state')||Date.now()/1000-state.iat>600)throw new Error('Invalid state');const identity=await exchangeLineIdentity(origin,{code:url.searchParams.get('code'),nonce:state.nonce,verifier:state.verifier});await registry('lineOnboard',identity.uid,{lineId:identity.lineId,name:identity.name});return redirect('/?connected=line'+(state.draft?'&source=line&draft='+encodeURIComponent(JSON.stringify(state.draft)):''),[sessionCookie({sub:identity.uid,name:identity.name,picture:identity.picture,provider:'line'}),setCookie('dayzi_line','',0)]);}catch{return redirect('/?error=line',[setCookie('dayzi_line','',0)]);}}
 // แอปที่ติดตั้งไว้ (PWA) และเบราว์เซอร์มือถือเก็บคุกกี้แยกจาก LINE จึงให้ยืนยันในแอป LINE แล้วรอผลที่นี่ ไม่ต้องเด้งไปมา
 if(path==='line/handoff'&&req.method==='POST'){if(!lineConfigured()||!options().line)return json({error:'ยังเข้าสู่ระบบผ่านแอป LINE ไม่ได้'},503);const id=randomBytes(12).toString('hex');return json({id,url:`https://line.me/R/oaMessage/${encodeURIComponent(env('LINE_BOT_ID'))}/?${encodeURIComponent('เข้าสู่ระบบ '+id)}`},200,{'Set-Cookie':setCookie('dayzi_handoff',signSession({sub:id},env('SESSION_SECRET'),undefined,600),600)});}
 if(path==='line/handoff'){let id;try{id=verifySession(cookie(req,'dayzi_handoff'),env('SESSION_SECRET')).sub;if(!HANDOFF_ID.test(id))throw new Error('bad');}catch{return json({error:'คำขอเข้าสู่ระบบหมดอายุ กรุณาเริ่มใหม่'},410);}const pending=await registry('get','handoff:'+id),uid=pending?.linkCode?.expires>Date.now()?pending.linkCode.code:null;if(!LINE_UID.test(uid??''))return json({pending:true});await registry('linkCode','handoff:'+id,{code:'used'});const account=await registry('lineOnboard',uid,{lineId:uid.slice(5)});const res=json({ok:true});res.headers.append('Set-Cookie',sessionCookie({sub:uid,name:account?.name??'คุณ',provider:'line'}));res.headers.append('Set-Cookie',setCookie('dayzi_handoff','',0));return res;}
 if(path==='google/start'){if(!configured())return json({error:'เจ้าของระบบต้องตั้งค่า Google OAuth และทะเบียนบัญชีก่อน'},503);const state=randomBytes(24).toString('hex'),verifier=randomBytes(48).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url');let link=null;const linkParam=url.searchParams.get('link');if(linkParam){try{link=linkParam==='1'?(()=>{const u=actor(req);if(!LINE_UID.test(u.sub))throw new Error('not line');return u.sub;})():readLinkToken(linkParam,env('SESSION_SECRET'));}catch{return redirect('/?error=google');}}const stateCookie=signSession({sub:state,verifier,...(link?{link,linkSession:linkParam==='1'}:{})},env('SESSION_SECRET'));const authUrl=oauth(origin).generateAuthUrl({access_type:'offline',prompt:'consent select_account',scope:link?LINK_SCOPES:['openid','email','profile','https://www.googleapis.com/auth/drive.file'],state,code_challenge:challenge,code_challenge_method:'S256'});return redirect(authUrl,[setCookie('dayzi_oauth',stateCookie,600)]);}
 if(path==='google/callback'){
  let stage='state';
  try{
   const state=verifySession(cookie(req,'dayzi_oauth'),env('SESSION_SECRET'));
   if(state.sub!==url.searchParams.get('state')||Date.now()/1000-state.iat>600)throw new Error('Invalid OAuth state');
   let linkedBrowser=null;
   if(state.link){try{linkedBrowser=actor(req);}catch{}if(state.linkSession&&linkedBrowser?.sub!==state.link)throw new Error('LINE session changed during Google connection');}
   stage='token_exchange';
   const client=oauth(origin),{tokens}=await client.getToken({code:url.searchParams.get('code'),codeVerifier:state.verifier});
   stage='identity';
   const ticket=await client.verifyIdToken({idToken:tokens.id_token,audience:env('GOOGLE_CLIENT_ID')}),p=ticket.getPayload();
   if(!p.sub||!p.email_verified)throw new Error('Unverified identity');
   const picture=safeProfilePicture(p.picture);
   if(state.link){
    const uid=state.link;if(!LINE_UID.test(uid))throw new Error('Cannot link');
    stage='registry_read';
    const existing=await registry('get',uid);
    const reuse=existing?.connection?.auth==='oauth'&&!!existing.connection.spreadsheetId&&!!existing.connection.folderId;
    if(reuse&&existing.email?.toLowerCase()!==p.email?.toLowerCase())return redirect('/?error=google_account',[setCookie('dayzi_oauth','',0)]);
    stage='token_storage';
    const encryptedToken=tokens.refresh_token?encryptSecret(tokens.refresh_token,uid,env('TOKEN_ENCRYPTION_KEY')):reuse?existing.encryptedToken:null;
    if(!encryptedToken)throw new Error('Missing offline access');
    stage='registry_save';
    if(reuse)await registry('oauth',uid,{email:p.email,name:existing.name,encryptedToken,restoreConnection:existing.connection.status==='disconnected'});
    else{
     stage='storage_create';
     const stored=await provisionUserStorage(tokens.access_token,uid);
     stage='registry_save';
     await registry('linkGoogle',uid,{email:p.email,encryptedToken,ids:stored.ids,sheetUrl:stored.sheetUrl,folderUrl:stored.folderUrl,rootFolderUrl:stored.rootFolderUrl});
    }
    const linePicture=safeLinePicture(linkedBrowser?.picture)||await lineProfilePicture(uid.slice(5));
    return redirect('/?googleLinked=1',[...(linkedBrowser?.sub===uid?[sessionCookie({sub:uid,name:existing?.name??p.name??p.email,email:p.email,picture:linePicture,provider:'line'})]:[]),setCookie('dayzi_oauth','',0)]);
   }
   const user={sub:p.sub,email:p.email,name:p.name??p.email,picture};
   if(!tokens.refresh_token)throw new Error('Missing offline access');
   stage='registry_save';
   await registry('oauth',p.sub,{email:p.email,name:p.name,encryptedToken:encryptSecret(tokens.refresh_token,p.sub,env('TOKEN_ENCRYPTION_KEY'))});
   return redirect('/?connected=1',[sessionCookie(user),setCookie('dayzi_oauth','',0)]);
  }catch(error){
   const rawStatus=Number(error?.status??error?.response?.status),status=Number.isInteger(rawStatus)&&rawStatus>=400&&rawStatus<=599?rawStatus:0;
   const providerCode=error?.response?.data?.error;
   const reason=['invalid_client','invalid_grant','access_denied','invalid_scope'].includes(providerCode)?providerCode:'failed';
   console.error('dayzi-google-callback',{stage,status,reason});
   return redirect('/?error=google&step='+stage,[setCookie('dayzi_oauth','',0)]);
  }
 }
 if(path==='line/webhook')return await handleLineWebhook(req,{origin,accountData});
 if(req.method!=='GET'&&req.headers.get('origin')!==origin)throw Object.assign(new Error('คำขอไม่ได้มาจากแอปนี้'),{status:403});
 if(path==='personal-sheet'){if(req.method!=='POST')return json({error:'ใช้ POST สำหรับการเชื่อมต่อ Sheets ส่วนตัว'},405);return json(await personalSheetRequest(await body(req)));}
 const user=actor(req),a=await registry('get',user.sub);if(!a)throw Object.assign(new Error('ไม่พบบัญชี กรุณาเชื่อม Google ใหม่'),{status:401});
 if(a.authProvider==='line'&&['picker-token','line/link'].includes(path))return json({error:'บัญชี LINE นี้ผูกตัวตนและพื้นที่ส่วนตัวแล้ว ไม่สามารถเปลี่ยนเป็น LINE ของคนอื่นหรือใช้ Google token ของระบบได้'},403);
 if(path==='logout'&&req.method==='POST')return json({ok:true},200,{'Set-Cookie':setCookie('dayzi_session','',0)});
 if(path==='picker-token'&&req.method==='GET')return json({accessToken:await accessToken(a,origin)});
 if(path==='storage/validate'&&req.method==='POST'){const p=await body(req),ids=parseStorageUrls(p.sheetUrl,p.folderUrl);return json(await inspectStorage(await accessToken(a,origin,storageMode(a)),ids));}
 if(path==='storage/initialize'&&req.method==='POST'){const p=await body(req),ids=parseStorageUrls(p.sheetUrl,p.folderUrl),token=await accessToken(a,origin,storageMode(a));await inspectStorage(token,ids);await registry('reserve',a.uid,{ids});return json(await initializeStorage(token,ids,a.uid));}
 if(path==='storage/save'&&req.method==='PUT'){const p=await body(req),ids=parseStorageUrls(p.sheetUrl,p.folderUrl);const v=await inspectStorage(await accessToken(a,origin,storageMode(a)),ids);if(v.status!=='ready')return json({error:'กรุณาเตรียมตารางเริ่มต้นก่อนบันทึก'},409);const canonicalSheet=`https://docs.google.com/spreadsheets/d/${ids.spreadsheetId}/edit`,canonicalFolder=`https://drive.google.com/drive/folders/${ids.folderId}`;await registry('connect',a.uid,{ids,sheetUrl:canonicalSheet,folderUrl:canonicalFolder,expectedVersion:p.expectedVersion,auth:storageMode(a)==='service'?'service':null});const next=await registry('get',a.uid);return json(connection(next));}
 if(path==='storage/disconnect'&&req.method==='DELETE'){const p=await body(req);return json(await registry('disconnect',a.uid,{expectedVersion:p.expectedVersion}));}
 if(path==='chats'&&req.method==='GET'){ready(a);const token=await accessToken(a,origin);return json({chats:decodeData(await readRanges(token,a.connection.spreadsheetId,['chats']),a.uid).chats});}
 if(path==='chats'&&req.method==='PUT'){const p=await body(req),{data,token}=await accountData(a,origin);const mutation=sanitizeChatMutation(p,[...data.files,...(a.uploads??[])]);await registry('saveChat',a.uid,{accessToken:token,connectionVersion:a.version,...(mutation.chat?{row:encodeChat(mutation.chat,a.uid)}:{deletedId:mutation.deletedId})});return json(mutation);}
 if(path==='data'&&req.method==='GET'){const {data}=await accountData(a,origin);return json({data,version:a.revision});}
 if(path==='data/version'&&req.method==='GET'){ready(a);return json({version:a.revision,connectionVersion:a.version});}
 if(path==='data'&&req.method==='PUT'){const p=await body(req);if(p.tables){ready(a);const token=await accessToken(a,origin),known=p.tables.includes?.('files')?decodeData(await readRanges(token,a.connection.spreadsheetId,['files']),a.uid).files:[];const ranges=partialRanges(p.data,a.uid,p.tables,[...known,...(a.uploads??[])]);return json(await registry('saveData',a.uid,{accessToken:token,ranges,connectionVersion:a.version,expectedRevision:p.expectedVersion}));}const {data:old,token}=await accountData(a,origin);validateData(p.data,[...old.files,...(a.uploads??[])]);const clean={...p.data,settings:{...p.data.settings,sheetUrl:a.connection.spreadsheetUrl,folderUrl:a.connection.driveFolderUrl}};return json(await registry('saveData',a.uid,{accessToken:token,ranges:encodeData(clean,a.uid),connectionVersion:a.version,expectedRevision:p.expectedVersion}));}
 if(path==='upload'&&req.method==='POST'){ready(a);let name;try{name=decodeURIComponent(req.headers.get('x-file-name')??'');}catch{return json({error:'ชื่อไฟล์ไม่ถูกต้อง'},400);}const bytes=await limitedBytes(req,CHUNK_SIZE);return json(await uploadSmallFile(a,await accessToken(a,origin),{id:url.searchParams.get('id'),name,mimeType:req.headers.get('content-type'),bytes}));}
 if(path==='upload/start'&&req.method==='POST'){ready(a);return json(await startUpload(a,await accessToken(a,origin),await body(req)));}
 if(path==='upload/chunk'&&req.method==='PUT'){ready(a);const bytes=await limitedBytes(req,CHUNK_SIZE);return json(await uploadChunk(a,await accessToken(a,origin),req.headers.get('x-upload-ticket'),Number(url.searchParams.get('offset')),bytes));}
 if(path==='push/test'&&req.method==='POST'){ready(a);return json(await sendTestPush(a));}
 if(path==='file'&&req.method==='DELETE'){
  const p=await body(req),{data,token}=await accountData(a,origin),file=ownedFile(data.files,url.searchParams.get('id'),a.uid);
  if(p.expectedVersion!==a.revision)return json({error:'ข้อมูลเปลี่ยนจากอีกอุปกรณ์ กรุณารีเฟรชก่อนลบ'},409);
  const trash=await trashDriveFile(a,token,file);
  try{const next={...data,files:data.files.filter(f=>f.id!==file.id),events:data.events.map(e=>({...e,fileIds:(e.fileIds??[]).filter(id=>id!==file.id)}))};return json(await registry('saveData',a.uid,{accessToken:token,ranges:encodeData(next,a.uid),connectionVersion:a.version,expectedRevision:p.expectedVersion}));}
  catch(error){try{const latest=await registry('get',a.uid);if(latest?.connection?.status==='ready'&&latest.connection.spreadsheetId===a.connection.spreadsheetId&&latest.connection.folderId===a.connection.folderId){const current=await accountData(latest,origin),stillListed=current.data.files.some(f=>f.id===file.id&&f.driveId===file.driveId);if(!stillListed)return json({version:latest.revision});if(trash.changed)await trashDriveFile(latest,current.token,file,false);}}catch{console.error('dayzi-file-trash-rollback-failed');}throw error;}
 }
 if(path==='file'&&req.method==='GET'){const {data,token}=await accountData(a,origin),file=ownedFile(data.files,url.searchParams.get('id'),a.uid);const meta=await googleFetch(token,`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.driveId)}?fields=id,parents,trashed`).then(r=>r.json());if(meta.trashed||!meta.parents?.includes(a.connection.folderId))return json({error:'ไฟล์ไม่ได้อยู่ในโฟลเดอร์ที่คุณเชื่อมต่อ'},403);const headers={};if(req.headers.get('range'))headers.Range=req.headers.get('range');const r=await googleFetch(token,`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.driveId)}?alt=media`,{headers});const type=r.headers.get('content-type')??'application/octet-stream',inline=url.searchParams.get('preview')==='1'&&/^(image\/(jpeg|png|webp|gif|bmp)|application\/pdf|video\/[\w.+-]+|audio\/[\w.+-]+)(;|$)/i.test(type);const resultHeaders={'Content-Type':type,'Content-Disposition':`${inline?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"};for(const h of ['content-range','accept-ranges','content-length'])if(r.headers.get(h))resultHeaders[h]=r.headers.get(h);return new Response(r.body,{status:r.status,headers:resultHeaders});}
 if(path==='push'&&req.method==='POST'){ready(a);const p=await body(req),endpoint=new URL(p.endpoint);const allowed=endpoint.hostname==='fcm.googleapis.com'||endpoint.hostname==='updates.push.services.mozilla.com'||endpoint.hostname.endsWith('.push.apple.com')||endpoint.hostname==='web.push.apple.com'||endpoint.hostname.endsWith('.notify.windows.com');if(endpoint.protocol!=='https:'||endpoint.port||endpoint.username||endpoint.password||!allowed||!p.keys?.p256dh||!p.keys?.auth)return json({error:'Push subscription ไม่ถูกต้อง'},400);await registry('push',a.uid,{connectionVersion:a.version,encryptedSubscription:encryptSecret(JSON.stringify(p),a.uid,env('TOKEN_ENCRYPTION_KEY'))});return json({ok:true});}
 if(path==='line/link'&&req.method==='POST'){if(!options().line)return json({error:'เจ้าของระบบยังไม่ได้ตั้งค่า LINE Messaging API'},503);const code=randomBytes(5).toString('hex').toUpperCase();await registry('linkCode',a.uid,{code});const bot=env('LINE_BOT_ID');return json({code,url:`https://line.me/R/oaMessage/${encodeURIComponent(bot)}/?${encodeURIComponent(`เชื่อม ${code}`)}`});}
 if(path==='assistant/receipt'&&req.method==='POST'){if(!options().ai)return json({error:'ยังไม่ได้ตั้งค่า Gemini API ฝั่งเซิร์ฟเวอร์'},503);const text=await req.text();if(text.length>5500000)return json({error:'รูปใหญ่เกินกำหนด'},413);let p;try{p=JSON.parse(text);}catch{return json({error:'รูปแบบข้อมูลไม่ถูกต้อง'},400);}if(a?.uid)await registry('aiQuota',a.uid);return json(await readReceiptImage({image:p.image,mimeType:p.mimeType}));}
 if(path==='assistant/plan'&&req.method==='POST'){if(!options().ai)return json({error:'ยังไม่ได้ตั้งค่า Gemini API ฝั่งเซิร์ฟเวอร์'},503);const p=await body(req);if(typeof p.message!=='string'||p.message.length>2000)return json({error:'ข้อความยาวเกินกำหนด'},400);if(a?.uid)await registry('aiQuota',a.uid);return json(await generateIntentPlan({message:p.message,history:p.history}));}
if(path==='assistant'&&req.method==='POST'){if(!options().ai)return json({error:'ยังไม่ได้ตั้งค่า Gemini API ฝั่งเซิร์ฟเวอร์'},503);const p=await body(req);if(typeof p.message!=='string'||p.message.length>2000)return json({error:'ข้อความยาวเกินกำหนด'},400);let context;if(p.context&&typeof p.context==='object'){await registry('aiQuota',a.uid);context={...p.context,today:localDate()};}else{const [,{data}]=await Promise.all([registry('aiQuota',a.uid),accountData(a,origin)]);context={today:localDate(),events:data.events.filter(e=>e.date===localDate()).map(({title,time})=>({title,time})),tasks:data.tasks.filter(t=>!t.done).map(t=>t.title+' | กำหนด '+(t.date||'ยังไม่ระบุ')+' | หมวด '+t.category)};}if(p.stream)return geminiStreamResponse({message:p.message,context,history:p.history});return json(await generateGeminiReply({message:p.message,context,history:p.history}));}
 return json({error:'ไม่พบคำสั่งนี้'},404);
}catch(e){const status=e.message==='NOT_FOUND'?404:e.status??500;return json({error:status>=500?'ระบบออนไลน์ยังไม่พร้อม กรุณาลองใหม่หรือตรวจการตั้งค่าบริการ':e.message},status>=400&&status<=599?status:500);}}

