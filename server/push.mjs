import webpush from 'web-push';
import {env,decryptSecret} from './security.mjs';
export const pushReady=()=>['VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT'].every(k=>!!env(k));
export function checkReminderConnection(req){const secret=env('CRON_SECRET')||env('REMINDER_WORKER_SECRET');if(!secret||req.headers.get('authorization')!==`Bearer ${secret}`)return new Response('Unauthorized',{status:401});return Response.json({ok:pushReady(),notificationsSent:0},{status:pushReady()?200:503,headers:{'Cache-Control':'no-store'}});}
export async function sendTestPush(account){
 if(!pushReady())throw Object.assign(new Error('ยังไม่ได้ตั้งค่าระบบส่งแจ้งเตือน'),{status:503});
 if(!account.push)throw Object.assign(new Error('เปิดแจ้งเตือนบนเครื่องนี้ก่อน'),{status:409});
 try{await webpush.sendNotification(JSON.parse(decryptSecret(account.push,account.uid,env('TOKEN_ENCRYPTION_KEY'))),JSON.stringify({title:'Dayzi พร้อมเตือนคุณแล้ว 🌼',body:'นี่คือการแจ้งเตือนทดสอบจาก Dayzi',url:'/',tag:'dayzi-test'}),{vapidDetails:{subject:env('VAPID_SUBJECT'),publicKey:env('VAPID_PUBLIC_KEY'),privateKey:env('VAPID_PRIVATE_KEY')},TTL:60});}
 catch(error){throw Object.assign(new Error([404,410].includes(error.statusCode)?'สิทธิ์รับเตือนหมดอายุ กรุณาเชื่อมเครื่องนี้อีกครั้ง':'ส่งแจ้งเตือนไม่สำเร็จ กรุณาลองใหม่'),{status:[404,410].includes(error.statusCode)?409:502});}
 return {ok:true};
}
