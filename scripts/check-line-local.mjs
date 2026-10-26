import fs from 'node:fs/promises';
process.loadEnvFile('.env.local');
if(process.env.LINE_BOT_ID?.trim()) {
  console.log('LINE bot ID already configured.');
} else if(process.env.LINE_CHANNEL_ACCESS_TOKEN) {
  const response=await fetch('https://api.line.me/v2/bot/info',{headers:{Authorization:`Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`},signal:AbortSignal.timeout(15000)});
  if(!response.ok)console.log('LINE bot info could not be verified; HTTP',response.status);
  else {
    const result=await response.json();
    if(typeof result.basicId==='string'&&/^@[a-z0-9_.-]+$/i.test(result.basicId)) {
      let text=await fs.readFile('.env.local','utf8');
      if(/^LINE_BOT_ID=.*$/m.test(text))text=text.replace(/^LINE_BOT_ID=.*$/m,`LINE_BOT_ID=${result.basicId}`);else text+=`\nLINE_BOT_ID=${result.basicId}\n`;
      await fs.writeFile('.env.local',text);console.log('Verified LINE bot ID and saved it locally. No message sent.');
    } else console.log('LINE bot info did not include a usable bot ID.');
  }
} else console.log('LINE token not configured.');
