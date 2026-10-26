import {GoogleGenAI} from '@google/genai';
process.loadEnvFile('.env.local');
try {
  const page=await new GoogleGenAI({}).models.list({config:{pageSize:100,httpOptions:{timeout:15000}}});
  const names=[];
  for await(const item of page){if(item.name?.includes('flash')&&!/image|tts|live/.test(item.name))names.push(item.name);if(names.length>=15)break;}
  console.log(JSON.stringify({ok:true,models:names}));
} catch(error) {console.log(JSON.stringify({ok:false,status:error.status,name:error.name}));}
