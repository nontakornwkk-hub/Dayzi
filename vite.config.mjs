import { defineConfig, loadEnv } from 'vite';
import { localApiPlugin } from './server/vite-local-api.mjs';

export default defineConfig(({ mode }) => {
  const keys=['GEMINI_API_KEY','GOOGLE_API_KEY','GEMINI_MODEL','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_PICKER_API_KEY','GOOGLE_PROJECT_NUMBER','SESSION_SECRET','TOKEN_ENCRYPTION_KEY','REGISTRY_URL','REGISTRY_SECRET','REMINDER_WORKER_SECRET','LINE_CHANNEL_ACCESS_TOKEN','LINE_CHANNEL_SECRET','LINE_BOT_ID','LINE_LOGIN_CHANNEL_ID','LINE_LOGIN_CHANNEL_SECRET','LOCAL_LINE_WEBHOOK_HOST','VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT'];
  const state=Symbol.for('dayzi.local.env.original');
  if(!globalThis[state])globalThis[state]=Object.fromEntries(keys.map(key=>[key,process.env[key]||undefined]));
  for(const key of keys)if(globalThis[state][key]===undefined)delete process.env[key];else process.env[key]=globalThis[state][key];
  const values = loadEnv(mode, process.cwd(), '');
  // Server credentials have no VITE_ prefix and are never injected into the browser bundle.
  for (const key of keys)if(values[key]!==undefined)process.env[key]=values[key];
  return {
    cacheDir: '.cache/vite-local',
    plugins: [localApiPlugin()],
    ...(values.LOCAL_LINE_WEBHOOK_HOST&&/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(values.LOCAL_LINE_WEBHOOK_HOST)?{server:{allowedHosts:[values.LOCAL_LINE_WEBHOOK_HOST]}}:{}),
  };
});
