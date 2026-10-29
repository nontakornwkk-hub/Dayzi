# Dayzi — AI เลขาส่วนตัว

เว็บแอปปฏิทินภาษาไทย ออกแบบจากภาพอ้างอิงโทนพาสเทลม่วง–เหลือง พร้อมหน้าภาพรวม ปฏิทิน งาน โน้ต คลังไฟล์ ผู้ช่วย และการตั้งค่า URL ส่วนตัว ใช้ Vercel และ Google Sheets ตามที่กำหนด

## Deploy: GitHub + Vercel

Google storage connection uses the user's own Google consent on first use; a returning user can select **เข้าสู่ระบบ Google ใหม่** in Settings or the connection error banner. Reconnect with the same Google account to keep the existing Sheet and Drive folder. The app refreshes authorization automatically while the refresh token remains valid. Verified Google/LINE profile photos appear in the account controls, with initials as a fallback.

Google sign-in requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on Vercel, plus the exact OAuth redirect `https://dayzi-lyart.vercel.app/api/google/callback` in the Google Cloud web client. It requests `openid`, `email`, `profile`, and `drive.file`; users approve their own first connection. Creating or editing that client currently requires the project owner's Google Cloud two-step verification. Never commit client secrets or refresh tokens.

1. Push this folder to a **private** GitHub repository (`.gitignore` already excludes `.env.local`, `netlify-import.env`, the service-account JSON and zip files).
2. In Vercel choose **Add New → Project**, import the repository, keep the detected settings (`vercel.json` sets build `npm run build`, output `dist`). Every push to the main branch then deploys automatically.
3. In **Project → Settings → Environment Variables** add the server values (never commit them): `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY`, `REGISTRY_URL`, `REGISTRY_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `LINE_BOT_ID`, `LINE_LOGIN_CHANNEL_ID`, `LINE_LOGIN_CHANNEL_SECRET`, `GEMINI_API_KEY_1`…`GEMINI_API_KEY_5`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `REMINDER_WORKER_SECRET`.
4. After the first deploy, update the new site address in: LINE webhook (`/api/line/webhook`), LINE Login callback (`/api/line/callback`), Google OAuth redirect URI (`/api/google/callback`) and the Google Auth Platform branding links (`/privacy.html`, `/terms.html`). Re-run `SITE_URL=https://YOUR_SITE.vercel.app node scripts/line-richmenu.mjs --apply` so the Rich Menu points to the new address.
5. Reminders: Vercel's free plan allows only a daily cron, so `.github/workflows/reminders.yml` calls `/api/cron/reminders` every 5 minutes. Add repository secrets `SITE_URL` and `REMINDER_WORKER_SECRET` on GitHub.

## แนวทางล่าสุด: LINE เป็นบัญชีผู้ใช้หลัก (พัฒนา local ก่อน)

ผู้ใช้ทั่วไปไม่ต้องเชื่อม Google เองแล้ว: เพิ่มเพื่อนบอต → คุยเรื่องทั่วไปด้วย Gemini หรือฝากไฟล์ → เปิดปฏิทินด้วย LINE Login ตัวตนในเว็บยืนยันด้วย state/nonce/PKCE และตรวจ ID token กับ LINE; การเพิ่มเพื่อนอย่างเดียวไม่ใช่หลักฐานสิทธิ์ในเว็บ

เจ้าของระบบตั้ง Google/Apps Script ครั้งเดียว แอปสร้าง Sheets และโฟลเดอร์แยกตาม LINE user ID โดยอัตโนมัติ ไฟล์เป็นของบัญชี Google ระบบและเข้าถึงผ่านแอปตามเจ้าของรายการ ไม่ได้แชร์ให้ทุกคน บัญชี LINE ไม่มีสิทธิ์ขอ Google token ของระบบหรือผูก LINE เป็นคนอื่น

การตั้งค่าเจ้าของระบบ:

1. ใช้ LINE Messaging API และ LINE Login channel ภายใต้ provider เดียวกัน ตั้ง `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `LINE_BOT_ID`, `LINE_LOGIN_CHANNEL_ID`, `LINE_LOGIN_CHANNEL_SECRET` ใน `.env.local`
2. ตั้ง LINE callback เป็น `http://localhost:5173/api/line/callback` สำหรับทดสอบที่ LINE Console ยอมรับ หรือ URL HTTPS ที่กำหนดเมื่อเตรียมเปิดใช้งานจริง โดยค่าต้องตรงกับ origin ที่เปิดแอป
3. อัปเดต Apps Script ด้วย `apps-script/registry-coordinator.gs` แล้วตั้ง Script Properties: `REGISTRY_SHEET_ID`, `REGISTRY_SECRET` และ optionally `STORAGE_ROOT_FOLDER_ID` หากไม่ตั้ง root script จะสร้างโฟลเดอร์ส่วนตัวให้เจ้าของระบบ
4. เจ้าของ script อนุญาตสิทธิ์สร้าง Sheets/Drive และเรียก API จากนั้นตั้ง `REGISTRY_URL`, `REGISTRY_SECRET`, `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY` ฝั่ง local การตั้งค่านี้ยังจำเป็นแม้ผู้ใช้ปลายทางไม่ต้องล็อกอิน Google
5. LINE webhook ต้องเข้าถึงได้ผ่าน HTTPS; LINE เรียก localhost บนเครื่องของคุณจากภายนอกไม่ได้ หากตั้ง tunnel เอง ให้ตั้ง `LOCAL_LINE_WEBHOOK_HOST` เป็น hostname ตรงตัว endpoint นี้เปิดเฉพาะ webhook ที่ตรวจ LINE signature ส่วน local Gemini guest API ยังคงรับเฉพาะ loopback และ browser Origin เดียวกัน ไม่สร้าง tunnel หรือ deploy ให้อัตโนมัติ

หน้า Sheets/Drive URL เดิมเก็บเป็นตัวเลือกขั้นสูงสำหรับผู้ดูแล ไม่ใช่ขั้นตอนบังคับของผู้ใช้ LINE ปกติ โค้ด Google OAuth เดิมยังอยู่สำหรับบัญชีเก่า แต่ไม่ได้แสดงปุ่ม Google ในหน้าปกติ

เดซี่เป็นแชทบอทเรื่องทั่วไปได้ ไม่จำกัดเรื่องงาน ส่งบริบทสูงสุด 12 ข้อความและจำกัดข้อความย้อนหลังรวม 6,000 ตัวอักษร; ประวัติใน LINE เข้ารหัสแยกเจ้าของ ส่วนในเว็บจำระหว่างที่เปิดบทสนทนาอยู่ ก่อนโมเดลบันทึกข้อมูลใด ๆ ยังต้องใช้ฟอร์มของแอป ไม่ถือว่าคำตอบของ AI คือการบันทึกสำเร็จ

การแก้ชุดนี้ทำในเครื่องเท่านั้นตามคำสั่งล่าสุดของผู้ใช้ ไม่ deploy เพิ่ม จึงต้องเปิด `http://localhost:5173/` เพื่อดูหน้าตาและฟังก์ชันล่าสุด เว็บ Vercel ยังคงเป็นรุ่นที่เผยแพร่ก่อนหน้านี้

## ใช้งานได้ทันทีโดยไม่เชื่อม Google

- ปฏิทินเดือน/สัปดาห์/วัน เพิ่ม แก้ ลบนัด ทำซ้ำ ตรวจนัดทับ และลากวันเพื่อเปิดฟอร์มย้าย
- รายการงานและโน้ต บันทึกใน localStorage ของเบราว์เซอร์
- เก็บไฟล์ต้นฉบับใน IndexedDB ดาวน์โหลด และผูกกับนัด โดยไม่มีเพดาน 4 MB ของแอป (ขึ้นกับพื้นที่เบราว์เซอร์หรือ Google Drive)
- ผู้ช่วยแปลคำสั่งภาษาไทยพื้นฐานเป็นร่างนัดที่ต้องตรวจสอบก่อนบันทึก ดูตารางวันนี้ และค้นชื่อไฟล์
- ฟอร์ม URL ของ Sheets และโฟลเดอร์ Drive ตรวจรูปแบบได้ แต่ไม่อ้างว่ามีสิทธิ์หรือซิงก์สำเร็จ
- การเตือนในเครื่องทำงานขณะเปิดเว็บและอนุญาต Notification เท่านั้น ไม่ใช่การเตือนขณะปิดแอป

ข้อมูลตัวอย่างอยู่เฉพาะโหมดอุปกรณ์นี้ มีปุ่มล้างตัวอย่าง การล้างข้อมูลเว็บไซต์อาจทำให้ไฟล์และข้อมูลเฉพาะเครื่องหาย ไม่มีการนำข้อมูล Guest เข้า Google โดยอัตโนมัติ

## รันและตรวจสอบ

ต้องมี Node.js 20.19+ หรือ 22.12+ ตาม Vite ที่ติดตั้ง

```powershell
npm install
npm test
npm run dev
npm run build
```

โครงสร้างหลัก: `src/` หน้าเว็บ, `server/` ตัวกลาง Google/ทะเบียน/ความปลอดภัย, `api/` เส้นทาง Vercel, `server/api.mjs` ตัวจัดการ API และ `server/reminders.mjs` งานเตือน, `apps-script/` coordinator, `tests/` การทดสอบ

## เปิดระบบ Google สำหรับผู้ใช้จริง

การกรอก URL ไม่ได้ทำให้แอปได้รับสิทธิ์ใน Google โดยอัตโนมัติ ต้องตั้ง OAuth และอนุญาตรายการผ่าน Google Picker

### 1. Google Cloud

1. สร้าง Google Cloud project เปิด Google Sheets API, Google Drive API และ Google Picker API
2. ตั้ง OAuth consent ให้ตรงกับผู้ใช้จริง เพิ่ม test users ระหว่างพัฒนา และวางแผน publishing/verification ก่อนเปิดใช้ถาวร
3. สร้าง OAuth Client แบบ Web application ตั้ง authorized JavaScript origin เป็นโดเมนแอป และ redirect URI เป็น `https://YOUR_SITE.vercel.app/api/google/callback`
4. เพิ่ม `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_PROJECT_NUMBER` ลง Vercel environment variables
5. สร้าง API key สำหรับ Picker จำกัด website referrers ให้โดเมนนี้ และจำกัด API เป็น Google Picker API ตั้ง `GOOGLE_PICKER_API_KEY`
6. ใช้ scopes `openid email profile https://www.googleapis.com/auth/drive.file` แล้วให้ผู้ใช้เลือก Sheets และโฟลเดอร์ผ่าน Picker เพื่อให้สิทธิ์กับทรัพยากรเดิม

### 2. ทะเบียนบัญชีกลางและการล็อกการเขียน

ทะเบียนนี้เก็บเพียงบัญชี การเชื่อมต่อ และ credentials ที่เข้ารหัส ไม่เก็บเนื้อหานัดหมาย/ไฟล์แทน Sheets ส่วนตัว

1. เจ้าของระบบสร้าง Sheets กลางสำหรับทะเบียน ไม่แชร์ให้ผู้ใช้แอป
2. เปิด Apps Script project วางโค้ด `apps-script/registry-coordinator.gs`
3. ใน Script Properties ตั้ง `REGISTRY_SHEET_ID` และ `REGISTRY_SECRET` เป็น secret สุ่มที่มีความยาวอย่างน้อย 32 ไบต์
4. Deploy เป็น Web app: Execute as เจ้าของทะเบียน และให้ endpoint รับคำขอจาก backend ได้ โดยทุกคำขอต้องผ่าน `REGISTRY_SECRET` โค้ดจะไม่ส่งข้อมูลเมื่อ secret ไม่ตรง
5. ตั้ง `REGISTRY_URL` เป็น deployment `/exec` URL และ `REGISTRY_SECRET` ค่าเดียวกันบน Vercel เท่านั้น ห้ามใส่ในหน้าเว็บหรือแชร์ URL ที่มี secret
6. Coordinator ใช้ LockService ก่อนจองทรัพยากรหรือเขียน Sheets ข้อมูลผู้ใช้ การเขียน Sheets ส่วนตัวใช้ OAuth token ของผู้ใช้ ไม่ใช้สิทธิ์เจ้าของทะเบียน

ทะเบียนกลางและ endpoint เป็นโครงสร้างความปลอดภัยสำคัญ ให้จำกัดสิทธิ์แก้ไข script/ทะเบียนเฉพาะผู้ดูแล ตรวจสิทธิ์ผู้ดูแลและ quota ของ Apps Script ก่อนเปิดใช้หลายคน

### 3. กุญแจของระบบ

สร้างค่าจาก cryptographically secure randomness เช่น Node `crypto.randomBytes(32)` สำหรับ `SESSION_SECRET`, `REGISTRY_SECRET`, `REMINDER_WORKER_SECRET` และตั้ง `TOKEN_ENCRYPTION_KEY` เป็น 32 bytes แบบ base64 ทั้งหมดอยู่ใน Vercel runtime environment ฝั่งเซิร์ฟเวอร์

Refresh token เข้ารหัสด้วย AES-256-GCM และผูก Google user ID เป็น AAD; session เป็น signed HttpOnly/Secure/SameSite cookie ตัว API ตรวจ Origin สำหรับ mutation คำขอ

ตั้งค่า environment variables แล้ว deploy ใหม่ ค่าเหล่านี้ไม่ได้ใส่ใน `vercel.json` หรือไฟล์ frontend

### 4. ให้ผู้ใช้เชื่อม URL

1. เปิด ตั้งค่า > เชื่อมต่อ Google และอนุญาต
2. วาง URL ของ Sheets และ URL โฟลเดอร์ Drive ของตนเอง
3. กดอนุญาตไฟล์และโฟลเดอร์ผ่าน Google Picker หากยังไม่ได้ให้สิทธิ์
4. กดตรวจสอบ จากนั้นกดเตรียมตารางเริ่มต้นและบันทึก
5. ถ้ามีแท็บของระบบที่หัวตารางไม่ตรง จะไม่เขียนทับ ให้ใช้ Sheets ใหม่

Schema implementation version 2 ใช้คอลัมน์อ่านได้ เช่น date/time/หมวดหมู่ พร้อม JSON เฉพาะรายการซ้อนอย่างช่องทางเตือน แยกแท็บ events/tasks/notes/files/settings/reminders/app_meta เป็นการขยายจากแผน schema 1 เพื่อรองรับแอปเต็มรูปแบบ ไม่มี migration อัตโนมัติ

หนึ่งคนมีหนึ่งชุดที่ใช้งานอยู่ ไม่อนุญาตให้สองบัญชีในแอปผูก Sheets หรือโฟลเดอร์เดียวกัน การแชร์ผ่าน Google โดยตรงยังอยู่ภายใต้สิทธิ์ที่เจ้าของทรัพยากรตั้งเอง

## LINE

1. สร้าง LINE Official Account และ Messaging API channel
2. ตั้ง `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `LINE_BOT_ID` บน Vercel
3. ตั้ง webhook URL เป็น `https://YOUR_SITE.vercel.app/api/line/webhook` และเปิด Use webhook
4. ในแอป ผู้ใช้กดเชื่อม LINE เพื่อรับรหัสใช้ครั้งเดียวอายุ 10 นาที แล้วส่งข้อความเชื่อมให้บอต
5. ผู้ใช้เลือกช่องทาง LINE ในแต่ละนัด การส่งอยู่ภายใต้โควตา/แพ็กเกจของบัญชี LINE

Webhook ตรวจ signature ของ LINE ก่อนทำงาน คำสั่งภาษาพูดสร้างเพียงร่างให้เปิดตรวจสอบในแอป ไม่บันทึกนัดที่กำกวมเงียบ ๆ

## Web Push และงานเตือนเมื่อปิดแอป

1. สร้าง VAPID key pair ด้วย `npx web-push generate-vapid-keys` แล้วเก็บ private key เฉพาะฝั่งเซิร์ฟเวอร์
2. ตั้ง `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` และ `REMINDER_WORKER_SECRET`
3. ผู้ใช้กดเปิดแจ้งเตือนในตั้งค่า; iPhone ต้องเพิ่มเว็บแอปไว้หน้าจอโฮมและใช้ iOS ที่รองรับก่อน
4. `reminder-tick` รันทุกนาทีบน published deploy แล้วเรียก background worker ที่ตรวจ shared secret
5. แต่ละ reminder มี claim แยกผู้ใช้/นัด/วัน/นาทีล่วงหน้า/ช่องทาง พร้อมตรวจ connection version ก่อนส่ง และใช้ retry key สำหรับ LINE

การส่งสำเร็จจาก provider ไม่รับประกันว่ามือถือแสดงทันที เพราะขึ้นกับเครือข่าย สิทธิ์ ระบบปฏิบัติการ และ Focus mode การเตือนอาจช้าได้ Scheduler นี้ไม่ใช่นาฬิกาปลุกที่รับประกันเวลาถึงวินาที รองรับการตรวจย้อนหลังถึง 24 ชั่วโมง และจำกัด registry list ครั้งละ 30 บัญชีสำหรับ MVP

## ผู้ช่วย Gemini API และการทดสอบในเครื่อง

ผู้ช่วยสนทนาใช้ Google Gemini API ผ่าน SDK ทางการ `@google/genai` เท่านั้น ส่วนคำสั่งดูตาราง/ค้นไฟล์/เตรียมร่างนัดแบบพื้นฐานยังทำงานในเครื่องได้เมื่อยังไม่มี API key

1. เปิด `.env.local` ในโฟลเดอร์โปรเจกต์ ใส่ key ที่สร้างจาก [Google AI Studio](https://aistudio.google.com/apikey) หลัง `GEMINI_API_KEY=` โดยไม่ส่ง key ผ่านแชต
2. ตั้ง `GEMINI_MODEL=gemini-3.5-flash-lite` หรือ model ID ของ Gemini ที่บัญชีเข้าถึงได้
3. รัน `npm run dev -- --port 5173 --strictPort` แล้วเปิด `http://localhost:5173/` หากแก้ `.env.local` ให้รีสตาร์ตเซิร์ฟเวอร์
4. หน้าแชตแสดง `Gemini · รอ API key` เมื่อยังไม่ได้ตั้งค่า และแสดงชื่อโมเดลเมื่อมี key การมี key ไม่ได้ยืนยันว่า key/โควตาใช้งานจริงได้จนกว่าจะส่งคำขอสำเร็จ
5. local API อยู่ใน Vite middleware ฝั่งเซิร์ฟเวอร์ รับเฉพาะ loopback host และคำขอจาก origin เดียวกัน จึงทดสอบ Gemini ด้วยตารางในเครื่องได้โดยไม่ต้องตั้ง Google OAuth/Sheets ก่อน

API key ไม่ถูกใส่ใน frontend bundle, localStorage หรือ public status ห้ามตั้งชื่อเป็น `VITE_GEMINI_API_KEY` เพราะตัวแปร `VITE_` ใช้สำหรับข้อมูลสาธารณะของหน้าเว็บ คำขอส่งเพียงข้อความ ตารางวันนี้ และชื่องานค้าง ไม่ส่งไฟล์หรือโน้ตทั้งคลัง และไม่ได้ให้โมเดลเขียนข้อมูลหรือส่งข้อความแทนผู้ใช้

แอปไม่จำกัดจำนวนคำขอ AI ต่อวันแล้ว ทั้งเว็บ LINE และ local โดยยังเว้นคำขอใน local อย่างน้อย 2 วินาที และทะเบียนกลางอย่างน้อย 5 วินาทีต่อผู้ใช้เพื่อป้องกันการส่งซ้ำถี่เกินไป โควตาและข้อจำกัดของ Gemini API ยังเป็นไปตามโปรเจกต์ Google ที่ใช้ ส่วน Vercel production ยังคงต้องเข้าสู่ระบบ และไม่มี endpoint แบบ guest local บน Vercel

เมื่อต้องการ deploy ภายหลัง ให้ตั้ง `GEMINI_API_KEY` และ `GEMINI_MODEL` ใน Vercel runtime environment หรือใช้ provider credentials ของ Gemini ที่ Vercel AI Gateway ฉีดให้ ไม่ใช้ OpenAI SDK/API แล้ว การทดสอบและเปลี่ยน provider ครั้งนี้ทำเฉพาะในเครื่องตามคำสั่งผู้ใช้ ไม่ deploy เพิ่ม

อ้างอิง [Google Gen AI SDK](https://github.com/googleapis/js-genai) และ [Gemini text generation](https://ai.google.dev/gemini-api/docs/generate-content/text-generation)

## ข้อจำกัดและการเปิดใช้จริง

- ไม่มีการตั้งค่า Google/LINE ให้โดยอัตโนมัติเมื่อยังไม่มี project credentials; UI แสดงสถานะตามจริง
- พื้นที่ที่ยังไม่เชื่อม Google เป็นข้อมูลเฉพาะเบราว์เซอร์ ไม่ใช่บัญชีหลายผู้ใช้ที่มีความปลอดภัย
- ก่อนใช้กับข้อมูลจริง ให้ตั้งค่าและทดสอบ OAuth, Apps Script, การแยกบัญชีสองราย, อัปโหลด/ดาวน์โหลด และเตือนทั้งสองช่องทางแบบ end-to-end
- ไฟล์ใน Drive ไม่ถูกลบเมื่อเอาออกจากรายการในแอป การยกเลิกการเชื่อมต่อไม่ลบต้นฉบับ
- เปลี่ยนพื้นที่ไม่ย้ายข้อมูลและหยุดงานเก่าผ่าน connection version; ข้อความที่ provider รับไปแล้วอาจเรียกคืนไม่ได้
- ไม่มีการอ้างว่า Google/LINE/Web Push ผ่านการทดสอบบัญชีจริงก่อนตั้งค่าบริการครบ


### Local update: calendar, chat and uploads

- Calendar and chat pages fit the viewport; chat automatically scrolls to the latest reply. Theme choice persists locally.
- Existing schedule/tasks/files/notes questions use deterministic local answers, without calling Gemini. General chat uses the official Gemini Interactions streaming API, with store:false and minimal thinking for Flash-Lite. Provider first-token latency still applies; the measured local smoke test returned its first text in about21.6seconds.
- Browser cloud uploads use authenticated /api/upload/start and /api/upload/chunk with encrypted owner/connection-bound upload tickets. Each request contains at most3MiB; total file size has no app-imposed4MiB cap. LINE media is read and uploaded incrementally, with an idle read deadline rather than a short timeout spanning Drive backpressure. Storage/provider/runtime limits still apply.
- Google resumable protocol reference: https://developers.google.com/workspace/drive/api/guides/manage-uploads
- Cloud/LINE storage remains unverified until REGISTRY_URL and the admin Apps Script coordinator are configured. No new deployment was made.


### Local finance and deterministic commands

- New finance page: /?page=finance. Exact integer-satang entries, monthly income/expense/net, categories, monthly budget, CSV, optional own-account transfers excluded from net. Uses existing per-user persistence/error handling.
- Slip OCR in the web app uses self-hosted Tesseract.js7 runtime and official tessdata_fast Thai/English models under public/ocr. Models were downloaded from https://github.com/tesseract-ocr/tessdata_fast . Original image stays in browser memory, requires direction and explicit save. OCR is not authenticity verification. PDF slips are not supported; use a PNG/JPEG/WebP image.
- Local command router handles standard actions before Gemini in browser and LINE; reasoning requests bypass lookup. Example: บันทึกค่าClaude AI700บาทวันนี้; บันทึกให้เลย uses preceding HUMAN context, refuses invented assistant-only values and suppresses repeated confirmation. LINE entries have stable webhook-derived IDs for redelivery safety. Task cards include signed-webhook-owner-checked done postbacks.
- Google storage has additive transactions tab. Update/redeploy apps-script/registry-coordinator.gs before using finance online: new code creates that tab under its existing write lock. Existing workbooks without it read as empty until migration; existing files are preserved. No coordinator or Vercel deployment was performed in this work session. Actual LINE/cloud saving still needs configured registry/OAuth/LINE backend.
- This version reads slips in the web app. Sending a photo in LINE still uses the existing file-storage flow; it does not silently OCR/store a financial transaction.
- See docs/dayzi-costs.md for cost model and official references.
