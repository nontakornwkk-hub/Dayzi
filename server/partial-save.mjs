import {validateData,encodeData} from './google.mjs';
export function partialRanges(data,uid,tables,knownFiles=[]){
 if(!Array.isArray(tables)||!tables.length||tables.length>2||tables.some(t=>!['notes','files'].includes(t)))throw Object.assign(new Error('รายการที่บันทึกไม่ถูกต้อง'),{status:400});
 const clean={events:[],tasks:[],notes:tables.includes('notes')?data?.notes:[],files:tables.includes('files')?data?.files:[],settings:{},delivered:{}};
 validateData(clean,knownFiles);
 for(const note of clean.notes)if(typeof note.content!=='string'||note.content.length>20000)throw Object.assign(new Error('เนื้อหาโน้ตไม่ถูกต้องหรือยาวเกินไป'),{status:400});
 const ranges=encodeData(clean,uid);return Object.fromEntries([...new Set(tables)].map(t=>[t,ranges[t]]));
}
