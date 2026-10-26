import {GoogleGenAI} from '@google/genai';
process.loadEnvFile('.env.local');
const start=Date.now();
try {
 const client=new GoogleGenAI({});
 const response=await client.interactions.create({model:process.env.GEMINI_MODEL||'gemini-3.5-flash-lite',input:'ตอบสั้น ๆ ว่าสวัสดีค่ะ จากเดซี่',store:false});
 console.log(JSON.stringify({ok:true,milliseconds:Date.now()-start,text:response.output_text??'',model:response.model??'configured'}));
}catch(error){console.log(JSON.stringify({ok:false,name:error.name,status:error.statusCode??error.status,milliseconds:Date.now()-start}));}
