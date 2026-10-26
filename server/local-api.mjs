import cloudHandler from './api.mjs';
import { geminiConfig, publicGeminiConfig, generateGeminiReply, geminiStreamResponse } from './assistant.mjs';
import { json } from './security.mjs';
import { generateIntentPlan } from './intent-planner.mjs';
import { readReceiptImage } from './receipt-vision.mjs';

let quota = { day: '', count: 0, last: 0 };

export async function handleLocalApi(request, options = {}) {
  const url = new URL(request.url);
  const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  const webhookHost=options.webhookHost??process.env.LOCAL_LINE_WEBHOOK_HOST;
  if(url.pathname==='/api/line/webhook'&&request.method==='POST'&&(loopback||(webhookHost&&url.hostname===webhookHost))) {
    // LINE uses a signature, not browser Origin. The shared handler verifies it before reading identities.
    return (options.cloudHandler??cloudHandler)(request);
  }
  if (!loopback) {
    return json({ error: 'Local API ใช้ได้เฉพาะในเครื่องนี้' }, 403);
  }
  if (request.method !== 'GET' && request.headers.get('origin') !== url.origin) {
    return json({ error: 'คำขอไม่ได้มาจากหน้า local ของแอปนี้' }, 403);
  }
  const config = options.config ?? geminiConfig();
  if (url.pathname === '/api/status') {
    const response = await (options.cloudHandler ?? cloudHandler)(request);
    const data = await response.json();
    return json({ ...data, config: { ...data.config, ...publicGeminiConfig(config), localAI: true } });
  }
  if (url.pathname === '/api/assistant/local-receipt' && request.method === 'POST') {
    if (!config.configured) return json({ error: 'ยังไม่ได้ตั้ง GEMINI_API_KEY ในไฟล์ .env.local' }, 503);
    try {
      const raw = await request.text();
      if (raw.length > 5_500_000) return json({ error: 'รูปใหญ่เกินกำหนด' }, 413);
      const data = JSON.parse(raw);
      return json(await (options.readReceipt ?? readReceiptImage)({ image: data.image, mimeType: data.mimeType }, { config }));
    } catch (error) { return json({ error: error.message ?? 'อ่านรูปไม่สำเร็จ' }, error.status ?? 400); }
  }
  if (url.pathname === '/api/assistant/local-plan' && request.method === 'POST') {
    if (!config.configured) return json({ error: 'ยังไม่ได้ตั้ง GEMINI_API_KEY ในไฟล์ .env.local' }, 503);
    try {
      const data = JSON.parse(await request.text());
      return json(await (options.generatePlan ?? generateIntentPlan)({ message: data.message, history: data.history }, { config }));
    } catch (error) { return json({ error: error.message ?? 'ติดต่อ Gemini ไม่สำเร็จ' }, error.status ?? 400); }
  }
  if (url.pathname !== '/api/assistant/local') return (options.cloudHandler ?? cloudHandler)(request);
  if (request.method !== 'POST') return json({ error: 'กรุณาใช้ POST' }, 405);
  if (!config.configured) return json({ error: 'ยังไม่ได้ตั้ง GEMINI_API_KEY ในไฟล์ .env.local' }, 503);
  try {
    const raw = await request.text();
    if (raw.length > 65536) return json({ error: 'ข้อมูลคำขอมีขนาดใหญ่เกินกำหนด' }, 413);
    let data;
    try { data = JSON.parse(raw); } catch { return json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, 400); }
    if (typeof data.message !== 'string' || !data.message.trim() || data.message.length > 2000) {
      return json({ error: 'กรุณาใส่ข้อความไม่เกิน 2,000 ตัวอักษร' }, 400);
    }
    const now = Date.now(), day = new Date(now).toISOString().slice(0,10);
    if (quota.day !== day) quota = { day, count: 0, last: 0 };
    if (!options.generateReply) {
      if (quota.count >= 30 || now - quota.last < 2000) return json({ error: 'ส่งคำขอ Gemini ถี่เกินไปหรือครบโควตาทดสอบวันนี้แล้ว' }, 429);
      quota.count++; quota.last = now;
    }
    if(data.stream&&!options.generateReply)return geminiStreamResponse({message:data.message,context:data.context,history:data.history},{config});
    const result = await (options.generateReply ?? generateGeminiReply)({ message: data.message, context: data.context, history: data.history }, { config });
    return json(result);
  } catch (error) {
    return json({ error: error.message ?? 'ติดต่อ Gemini ไม่สำเร็จ' }, error.status ?? 500);
  }
}
