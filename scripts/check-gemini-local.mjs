import {GoogleGenAI} from '@google/genai';
process.loadEnvFile('.env.local');
const key=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY;
if(!key){console.log('Gemini key not configured.');process.exit(0);}
try {
  const client=new GoogleGenAI({});
  console.log('Gemini SDK methods present:',typeof client.models.generateContent==='function');
  const response=await client.models.generateContent({model:process.argv[2]||process.env.GEMINI_MODEL||'gemini-3.5-flash-lite',contents:'ตอบสั้น ๆ ว่าสวัสดีค่ะ',config:{maxOutputTokens:128,httpOptions:{timeout:45000}}});
  console.log(JSON.stringify({ok:true,text:response.text??'',model:response.modelVersion??'configured'}));
}catch(error){
  let message=String(error.message??'');for(const value of [process.env.GEMINI_API_KEY,process.env.GOOGLE_API_KEY])if(value)message=message.split(value).join('[redacted]');message=message.replace(/AIza[\w-]+/g,'[redacted]').replace(/([?&]key=)[^&\s]+/gi,'$1[redacted]');
  console.log(JSON.stringify({ok:false,name:error.name,status:error.status,code:error.code,causeCode:error.cause?.code,message:message.slice(0,800)}));
}
