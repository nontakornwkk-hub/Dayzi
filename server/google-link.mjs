import {signSession,verifySession} from './security.mjs';
import {googleFetch,initializeStorage} from './google.mjs';

// Each LINE user connects their own Google account: Dayzi only gets access to files it creates there (drive.file).
export const LINK_SCOPES=['openid','email','profile','https://www.googleapis.com/auth/drive.file'];
export const LINE_UID=/^line:U[0-9a-f]{32}$/i;
const MAX_AGE=900;

export const createLinkToken=(uid,key,now)=>signSession({sub:uid,purpose:'google-link'},key,now);
export function readLinkToken(token,key,now=Math.floor(Date.now()/1000)){
 let payload;
 try{payload=verifySession(token,key,now);}catch{payload=null;}
 if(!payload||payload.purpose!=='google-link'||!LINE_UID.test(payload.sub)||now-payload.iat>MAX_AGE)throw Object.assign(new Error('ลิงก์เชื่อม Google หมดอายุ กรุณากดปุ่มจากแชต LINE อีกครั้ง'),{status:400});
 return payload.sub;
}

// Creates "Dayzi" (Sheet + Files folder) in the user's own Drive and prepares the tables.
export async function provisionUserStorage(accessToken,uid){
 const post=(url,body)=>googleFetch(accessToken,url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());
 const root=await post('https://www.googleapis.com/drive/v3/files?fields=id',{name:'Dayzi',mimeType:'application/vnd.google-apps.folder'});
 const files=await post('https://www.googleapis.com/drive/v3/files?fields=id',{name:'ไฟล์',mimeType:'application/vnd.google-apps.folder',parents:[root.id]});
 const book=await post('https://sheets.googleapis.com/v4/spreadsheets?fields=spreadsheetId',{properties:{title:'Dayzi'}});
 try{await googleFetch(accessToken,`https://www.googleapis.com/drive/v3/files/${book.spreadsheetId}?addParents=${root.id}&removeParents=root&fields=id`,{method:'PATCH'});}catch{/* tidiness only: the sheet still works in My Drive */}
 const ids={spreadsheetId:book.spreadsheetId,folderId:files.id};
 await initializeStorage(accessToken,ids,uid);
 return {ids,sheetUrl:`https://docs.google.com/spreadsheets/d/${ids.spreadsheetId}/edit`,folderUrl:`https://drive.google.com/drive/folders/${ids.folderId}`};
}
