# Per-user Google Sheets & Drive URL Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มหน้าตั้งค่าให้ผู้ใช้แต่ละคนใส่ URL ของ Google Sheets และโฟลเดอร์ Google Drive เพื่อแยกนัดหมาย งาน โน้ต การเตือน และไฟล์งานของตนเอง

**Architecture:** เว็บปฏิทินบน Netlify ติดต่อ Google ผ่าน Netlify Functions โดยเลือกพื้นที่เก็บข้อมูลจากบัญชีผู้ใช้ที่ผ่านการยืนยันตัวตนฝั่งเซิร์ฟเวอร์เท่านั้น ผู้ใช้กรอก URL แล้วอนุญาตการเข้าถึงผ่าน Google; URL ไม่ใช่หลักฐานสิทธิ์ ส่วนทะเบียนการเชื่อมต่อกลางเก็บใน Google Sheets ส่วนตัวของระบบ แยกจาก Sheets ข้อมูลงานของผู้ใช้

**Tech Stack:** Google Sheets API, Google Drive API, Google OAuth, Google Picker, Netlify Functions; เสนอ React + TypeScript + Vite สำหรับหน้าเว็บ และ Vitest สำหรับการทดสอบเมื่อเริ่มพัฒนา เพราะพื้นที่งานปัจจุบันยังไม่มีโค้ด

**Spec:** ข้อกำหนดและพฤติกรรมในเอกสารนี้ โดยเฉพาะส่วน “ขอบเขตฟังก์ชัน” และ “กติกาการแยกข้อมูล” เป็นข้อกำหนดของแผนนี้ ยังไม่ใช่การอนุมัติเริ่มเขียนระบบหรือเผยแพร่

## Global Constraints

- ใช้ Google Sheets เป็นที่เก็บข้อมูล และ Netlify เป็นโฮสต์/ระบบหลังบ้านตามที่ผู้ใช้เลือก
- แต่ละคนมีช่อง Google Sheets URL และ Google Drive Folder URL ของตนเอง
- ปฏิทิน ใช้เวลา Asia/Bangkok เป็นค่าเริ่มต้น; เก็บเวลาที่เป็นจุดเวลาเป็น ISO 8601 UTC และแปลงตอนแสดงผล
- แจ้งเตือนรองรับ LINE และ Web Push โดยใช้การเชื่อมต่อของเจ้าของรายการ
- API ทุกตัวตรวจผู้ใช้ฝั่งเซิร์ฟเวอร์ ไม่รับ user_id จากหน้าเว็บมาใช้เป็นเจ้าของโดยตรง
- ไม่มีการเปิด Sheets หรือโฟลเดอร์เป็นสาธารณะเพื่อให้ระบบเข้าถึง
- ไม่เก็บ Google token แบบอ่านได้ในหน้าเว็บ, localStorage, URL, log หรือ Sheets ข้อมูลงานของผู้ใช้
- ไม่ลบข้อมูลเดิมหรือย้ายข้อมูลข้ามพื้นที่อัตโนมัติเมื่อเปลี่ยน URL หรือยกเลิกการเชื่อมต่อ
- เอกสารนี้วางแผนฟังก์ชันเชื่อมต่อพื้นที่เก็บข้อมูล; ไม่ครอบคลุมการสร้างแอปปฏิทินและระบบ AI ทั้งหมด

## Review Focus

1. ผู้ใช้ B เดารหัสรายการหรือปลอม user_id ของ A: เซิร์ฟเวอร์ต้องปฏิเสธโดยไม่เรียก Google ด้วยสิทธิ์ของ A — ทดสอบใน Task 1 และ 4
2. URL ถูกต้องแต่ไม่มีสิทธิ์ หรือเป็นไฟล์ผิดประเภท: ห้ามบันทึกเป็นพร้อมใช้งาน — ทดสอบใน Task 2
3. Sheets มีข้อมูลเดิม/หัวตารางไม่ตรง: ห้ามเขียนทับ ต้องแจ้งปัญหาและให้เลือกพื้นที่ที่เหมาะสม — ทดสอบใน Task 3
4. เปลี่ยน URL ระหว่างงานเบื้องหลังทำงาน: งานที่ถือ connection_version เก่าต้องไม่เริ่มส่งหรือเขียนข้อมูลใหม่ — ทดสอบใน Task 4
5. Google ถอนสิทธิ์หรือเชื่อมต่อไม่สำเร็จ: แสดงสถานะตามจริง เก็บค่าการเชื่อมต่อเดิม และไม่ย้อนกลับไปใช้พื้นที่ของผู้ใช้รายอื่น — ทดสอบใน Task 2–4

## ขอบเขตฟังก์ชัน

### 1. หน้าตั้งค่า > พื้นที่เก็บข้อมูลของฉัน

แสดงบัญชี Google ที่เชื่อมต่อ พร้อมช่องและปุ่มดังนี้:

| รายการ | พฤติกรรม |
|---|---|
| Google Sheets URL | รับ URL เช่น https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit |
| Google Drive Folder URL | รับ URL เช่น https://drive.google.com/drive/folders/FOLDER_ID |
| เชื่อมต่อ Google | อนุญาตสิทธิ์ผ่าน Google ไม่รับรหัสผ่าน Google ในแอป |
| อนุญาตไฟล์/โฟลเดอร์ที่เลือก | เปิด Google Picker เมื่อจำเป็น เพื่อให้สิทธิ์กับรายการที่กรอก URL |
| ตรวจสอบการเชื่อมต่อ | ตรวจรูปแบบ URL ประเภททรัพยากร สิทธิ์ และโครงสร้าง Sheets |
| เตรียมตารางเริ่มต้น | แสดงรายการแท็บที่จะสร้างก่อนสร้างจริง ไม่เขียนทับข้อมูลเดิม |
| บันทึก | ใช้งานได้เมื่อ Google ทั้งสองรายการและโครงสร้าง Sheets ผ่านการตรวจสอบ |
| เปิด Sheets / เปิดโฟลเดอร์ | เปิด URL ปกติที่ระบบจัดรูปแบบแล้ว |
| ยกเลิกการเชื่อมต่อกับระบบ | หยุดการใช้งานและงานเบื้องหลังของการเชื่อมต่อนี้ โดยเก็บข้อมูลต้นฉบับไว้ |

สถานะ: ยังไม่ตั้งค่า / กำลังตรวจสอบ / ต้องอนุญาตสิทธิ์ / ต้องเตรียมตาราง / พร้อมใช้งาน / ต้องเชื่อมต่อใหม่ / ขัดข้องชั่วคราว / ยกเลิกแล้ว

### 2. ขั้นตอนใช้งานครั้งแรก

1. ผู้ใช้เข้าสู่ระบบและเชื่อมบัญชี Google ของตัวเอง
2. วาง URL ของ Sheets และ URL ของโฟลเดอร์ Drive
3. หากแอปยังไม่มีสิทธิ์ในรายการนั้น ให้ยืนยันรายการผ่าน Google Picker
4. กดตรวจสอบ แสดงชื่อ Sheets ชื่อโฟลเดอร์ และสถานะสิทธิ์ให้ตรวจทาน
5. หาก Sheets ยังไม่มีตารางของระบบ ให้แสดงตัวอย่างแล้วกดเตรียมตารางเริ่มต้น
6. กดบันทึก ระบบตรวจซ้ำฝั่งเซิร์ฟเวอร์และผูกทรัพยากรกับบัญชีปัจจุบัน
7. ปฏิทิน งาน โน้ต และไฟล์เริ่มใช้งานพื้นที่นี้

การกรอก URL เป็นวิธีหลักตามที่ผู้ใช้ต้องการ; Picker เป็นขั้นตอนให้สิทธิ์ ไม่ใช่การแทนช่อง URL

### 3. ข้อมูลใน Sheets ของแต่ละคน

สร้างเฉพาะแท็บของระบบ พร้อม schema_version ในแท็บ app_meta:

| แท็บ | คอลัมน์เริ่มต้น |
|---|---|
| app_meta | key, value — schema_version=1 |
| events | id, owner_id, title, starts_at, ends_at, timezone, all_day, start_date, end_date_exclusive, location, note, status, created_at, updated_at |
| tasks | id, owner_id, title, due_at, status, event_id, created_at, updated_at |
| notes | id, owner_id, title, content, event_id, created_at, updated_at |
| reminders | id, owner_id, event_id, task_id, remind_at, channel, status, attempts, next_attempt_at, sent_at, last_error, connection_version |
| files | id, owner_id, drive_file_id, name, mime_type, size_bytes, event_id, task_id, created_at |
| settings | key, value — timezone=Asia/Bangkok, line_enabled=false, web_push_enabled=false |

นัดหมายทั้งวันใช้ start_date และ end_date_exclusive รูปแบบ YYYY-MM-DD; ไม่แปลงวันล้วนเป็นเที่ยงคืน UTC โดยพลการ

reminders แยกหนึ่งแถวต่อช่องทาง เพื่อให้ LINE ล้มเหลวแล้วลองใหม่ได้โดยไม่ส่ง Web Push ที่สำเร็จแล้วซ้ำ ช่องทางยังปิดอยู่จนกว่าผู้ใช้จะเชื่อม LINE/อนุญาต Web Push สำเร็จ

Drive เก็บไฟล์ต้นฉบับ ส่วน files เก็บรายการอ้างอิง ไม่ใส่ไฟล์ไบนารีหรือ base64 ลง Sheets รุ่นแรกค้นจากรายการที่ระบบบันทึก ไม่สแกนไฟล์เดิมทั้งหมดใน Drive

### 4. กติกาการแยกข้อมูล

- ใช้ Google ID token ที่ตรวจสอบแล้วเพื่อระบุผู้ใช้ด้วย issuer + sub; อีเมลเป็นข้อมูลแสดงผล ไม่ใช่กุญแจเจ้าของ
- ผูก user_id กับ spreadsheet_id และ drive_folder_id ฝั่งเซิร์ฟเวอร์
- รุ่นแรกหนึ่งคนมีพื้นที่ที่ใช้งานอยู่ได้หนึ่งชุด และไม่รองรับการใช้ Sheets/โฟลเดอร์เดียวกันร่วมหลายบัญชีในระบบ
- ก่อน initialize ต้องจอง ID ทั้งสองในทะเบียนกลางแบบ atomic ภายใต้ล็อก และปฏิเสธ ID ที่ผูก/จองกับคนอื่น การตรวจสอบอย่างเดียวไม่เขียนทะเบียน; การจองที่ยังไม่บันทึกมีอายุ 15 นาทีและใช้เวลาฝั่งเซิร์ฟเวอร์
- มี owner_id ในทุกแถวข้อมูลงาน และตรวจเจ้าของทั้งระดับการเชื่อมต่อและรายการ
- ไม่อนุญาตให้ผู้ใช้ส่ง spreadsheet_id, folder_id หรือ drive_file_id ใดก็ได้เข้ามาแล้วให้เซิร์ฟเวอร์ใช้ทันที
- การเปิด/ดาวน์โหลดไฟล์ต้องตรวจว่าไฟล์อยู่ในทะเบียน files ของผู้ใช้ก่อน ไม่สร้างลิงก์สาธารณะอัตโนมัติ
- LINE user ID และ Web Push subscription ผูกกับ user_id ผ่านขั้นตอนยืนยันบัญชี ไม่รับการกรอก LINE user ID เป็นหลักฐานเจ้าของ
- การแยกในแอปไม่เปลี่ยนสิทธิ์แชร์เดิมของ Google ผู้ใช้ยังต้องดูแลการแชร์ Sheets/โฟลเดอร์ของตนเอง

### 5. การเปลี่ยน URL และการตัดการเชื่อมต่อ

- ค่าใหม่ยังไม่แทนค่าเดิมจนกว่าจะตรวจสอบและบันทึกสำเร็จ
- ก่อนเปลี่ยน แสดงชื่อพื้นที่เก่าและใหม่ พร้อมข้อความว่าไม่ย้ายหรือลบข้อมูลเก่า และนัด/การเตือนจากพื้นที่เก่าจะหยุดทำงานในแอป
- เพิ่ม connection_version เมื่อเปลี่ยนพื้นที่หรือยกเลิกการเชื่อมต่อ งานที่อ่านเวอร์ชันเก่าต้องยกเลิกก่อนเริ่มทำผลข้างเคียง
- ถ้ามีคำขอส่งแจ้งเตือนออกไปแล้ว อาจเรียกคืนไม่ได้; ไม่รับประกันการถอนข้อความที่ส่งแล้ว
- เมื่อยกเลิกจากแอป ให้หยุดใช้งานการเชื่อมต่อและลบ token ที่ระบบเก็บไว้ ผู้ใช้ถอนสิทธิ์แอปในบัญชี Google ได้เพิ่มเติม
- 401/invalid_grant -> ต้องเชื่อมต่อใหม่; 403/404 -> ตรวจสิทธิ์หรือรายการ; 429/5xx -> ขัดข้องชั่วคราวและลองใหม่แบบหน่วงเวลา
- ห้ามนำเข้าทรัพยากรของบัญชีอื่นเป็นค่าทดแทนเมื่อการเชื่อมต่อเดิมเสีย

## การตัดสินใจที่เสนอโดยผู้เขียนแผน

- แต่ละคนอนุญาตด้วยบัญชี Google ของตัวเอง และวาง URL ของทรัพยากรที่บัญชีนั้นแก้ไข/อัปโหลดได้
- ใช้ scope openid email profile และ drive.file; ใช้ Google Picker เพื่อให้สิทธิ์กับ Sheets/โฟลเดอร์เดิมที่กรอก URL ตามกลไกของ Google
- ทะเบียนระบบใช้ Google Sheets กลางที่ไม่แชร์ให้ผู้ใช้ และเข้าถึงด้วย service account ฝั่ง Netlify เท่านั้น มี users, integrations, resource_reservations, line_links และ push_subscriptions
- integrations เก็บ user_id, URLs/IDs, status, schema_version, connection_version, updated_at และ encrypted_refresh_token; ไม่เก็บ refresh token ไว้ใน Sheets ของผู้ใช้
- เข้ารหัส refresh token และ push subscription ด้วย AES-256-GCM ใช้ nonce ใหม่ทุกครั้งและผูก user_id เป็น additional authenticated data; เก็บกุญแจใน Netlify environment variables ฝั่งเซิร์ฟเวอร์
- ทะเบียนกลางไม่ได้เก็บเนื้อหานัดหมาย งาน โน้ต หรือไฟล์งานแทนพื้นที่ส่วนตัว
- การจองทรัพยากร/แก้ config ต้องมี single-writer coordinator ที่ล็อกได้จริง เช่น Apps Script LockService ที่จำกัดสิทธิ์เฉพาะ backend ใช้กับทะเบียนกลางเท่านั้น; ห้ามอ้างว่า Sheets API read-then-write ป้องกันการแข่งขันได้
- Apps Script เป็นข้อเสนอเพิ่มสำหรับการล็อกทะเบียน หากไม่ใช้ ต้องเลือกกลไกล็อกที่รองรับ atomic conditional write ก่อนเริ่มพัฒนาเส้นทางบันทึกการเชื่อมต่อ

## ขอบเขตการพัฒนาครั้งนี้

พัฒนาหน้าตั้งค่า การยืนยันตัวตน การตรวจ/เตรียมพื้นที่ และตัวกลางสำหรับให้ฟังก์ชันปฏิทิน/ไฟล์/การเตือนเรียกใช้ การสร้างปฏิทินเต็มรูปแบบ การส่ง LINE/Web Push จริง การย้ายข้อมูล และการค้นหาเนื้อหาไฟล์ด้วย AI เป็นแผนต่อเนื่อง ไม่ถือว่าพร้อมใช้เพียงเพราะเชื่อม URL สำเร็จ

## File Structure ที่เสนอเมื่อเริ่มพัฒนา

- src/features/storage/StorageSettings.tsx — หน้า URL และสถานะการเชื่อมต่อ
- src/features/storage/google-picker.ts — ให้สิทธิ์ทรัพยากรที่กรอก URL
- netlify/functions/auth-google.ts — start/callback/logout และ session
- netlify/functions/storage-settings.ts — GET, POST validate, PUT save, POST initialize, DELETE disconnect
- server/auth.ts — requireActor และการตรวจ session/CSRF
- server/google-auth.ts — Google OAuth, token refresh และการเข้ารหัส token
- server/registry.ts — ทะเบียนกลางและการเรียก coordinator
- apps-script/registry-coordinator.gs — single-writer coordinator ของทะเบียนกลาง
- server/storage/contracts.ts — types และ schema
- server/storage/urls.ts — แปลง URL เป็นรหัส โดยไม่ fetch URL ที่รับจากผู้ใช้
- server/storage/google.ts — ตรวจ Google resources และเตรียมแท็บ
- server/storage/connections.ts — ตรวจ/บันทึก/ตัดการเชื่อมต่อ
- server/storage/access.ts — ให้ส่วนอื่นเข้าถึงเฉพาะข้อมูลของเจ้าของ
- tests/storage/{auth,urls,google,connections,access}.test.ts — ทดสอบการแยกข้อมูลและความผิดพลาดที่สำคัญ
- tests/e2e/storage-settings.spec.ts — ทดสอบหน้า URL และผู้ใช้สองราย

## Interfaces ร่วม

```ts
type Actor = { userId: string; googleSub: string };
type StorageInput = { spreadsheetUrl: string; driveFolderUrl: string };
type ResourceIds = { spreadsheetId: string; folderId: string };
type ConnectionStatus = 'not_configured' | 'needs_permission' | 'needs_schema'
  | 'ready' | 'needs_reconnect' | 'temporary_error' | 'disconnected';
type ValidationResult = {
  ids: ResourceIds; status: ConnectionStatus;
  spreadsheetName: string; folderName: string; issues: string[];
};
type Connection = ResourceIds & {
  userId: string; version: number; status: ConnectionStatus; schemaVersion: number;
};
type PublicConnection = Connection & { spreadsheetUrl: string; driveFolderUrl: string };
```

Actor มาจาก session เท่านั้น; API response ไม่รวม token หรือทะเบียนของคนอื่น

expectedVersion=0 สำหรับผู้ใช้ที่ยังไม่มี connection; ใช้เลข version ปัจจุบันสำหรับการเปลี่ยนหรือตัดการเชื่อมต่อ การหมดอายุการจองไม่ถอนสิทธิ์ Google และไม่ลบแท็บที่สร้างแล้ว

### Task 1: ตัวตนและทะเบียนการเชื่อมต่อของแต่ละคน

**Files:** Create server/auth.ts, server/google-auth.ts, server/registry.ts, server/storage/contracts.ts, netlify/functions/auth-google.ts, apps-script/registry-coordinator.gs, tests/storage/auth.test.ts

**Interfaces:** Produces requireActor(request: Request): Promise<Actor>, getGoogleClient(actor: Actor), getConnection(actor: Actor): Promise<Connection | null>, commitConnection(actor: Actor, input: ResourceIds, expectedVersion: number): Promise<Connection>

- [ ] เขียน auth.test.ts ทดสอบว่า ID token ผิด issuer/audience/หมดอายุถูกปฏิเสธ, session ถูกปลอมแล้วได้ 401, user_id ใน body ไม่เปลี่ยน Actor, OAuth callback state ผิดถูกปฏิเสธ และ token ของ A ถอดรหัสโดยใช้ user_id ของ B ไม่ได้
- [ ] รัน npm test -- tests/storage/auth.test.ts ให้เห็น FAIL ก่อนสร้าง implementation
- [ ] สร้าง OAuth แบบ server-side, state/PKCE และ session cookie Secure/HttpOnly/SameSite=Lax; mutation API ตรวจ Origin และ CSRF token
- [ ] สร้างทะเบียนกลางและ coordinator ที่ตรวจสิทธิ์ backend ล็อกการจอง resource IDs และใช้ expectedVersion; ถ้า A/B จอง ID เดียวกันพร้อมกันต้องสำเร็จได้แค่คนเดียว ทดสอบทั้งกรณีนี้, owner mismatch และอายุการจอง 15 นาที
- [ ] รัน npm test -- tests/storage/auth.test.ts ให้ PASS และตรวจว่าไม่มี token ใน response/log แล้ว commit เฉพาะไฟล์งานนี้หากเป็น Git repository

### Task 2: ตรวจ URL สิทธิ์ และชนิดทรัพยากร

**Files:** Create server/storage/urls.ts, server/storage/google.ts, src/features/storage/google-picker.ts, tests/storage/urls.test.ts, tests/storage/google.test.ts

**Interfaces:** Consumes Actor, StorageInput, ResourceIds, getGoogleClient; produces parseStorageUrls(input: StorageInput): ResourceIds และ validateGoogleStorage(actor: Actor, ids: ResourceIds): Promise<ValidationResult>

- [ ] เขียน urls.test.ts ให้ assert ว่า Sheets URL ที่มี ?usp=sharing#gid=0 และ Drive URL แบบ /drive/u/0/folders/ID แปลงได้; URL http, credentials ใน URL, โดเมนเลียนแบบ, /file/d/ แทน folder และ URL ที่ไม่มี ID ต้องถูกปฏิเสธ
- [ ] เขียน google.test.ts ทดสอบ Sheets แบบอ่านอย่างเดียว, folder ที่อัปโหลดไม่ได้, รายการในถังขยะ, Google Doc แทน Sheets, shortcut แทน folder, ยังไม่อนุญาต Picker, 401, 429 และ 5xx ให้ได้สถานะที่กำหนดโดยไม่มีการเขียนข้อมูล
- [ ] รัน npm test -- tests/storage/urls.test.ts tests/storage/google.test.ts ให้เห็น FAIL
- [ ] สร้าง URL parser แบบ allowlist HTTPS host/path และรหัสที่มีเฉพาะตัวอักษร ตัวเลข _ -; เรียกเฉพาะ Google API endpoints ที่กำหนดไว้ ตรวจ MIME type, trashed และ capabilities ของไฟล์/โฟลเดอร์ ไม่ตาม redirect ของ URL ผู้ใช้
- [ ] เพิ่ม Picker ให้เลือก/ให้สิทธิ์ Sheets และ folder ที่ ID ตรงกับช่อง URL; ถ้าเลือกคนละรายการให้ถามผู้ใช้ก่อนเปลี่ยนช่อง URL
- [ ] รันชุดทดสอบให้ PASS แล้ว commit เฉพาะไฟล์งานนี้หากเป็น Git repository

### Task 3: เตรียม schema และหน้ากรอก URL

**Files:** Create src/features/storage/StorageSettings.tsx, server/storage/connections.ts, netlify/functions/storage-settings.ts, tests/storage/connections.test.ts, tests/e2e/storage-settings.spec.ts; Modify server/storage/google.ts

**Interfaces:** Consumes interfaces ใน Task 1–2; produces initializeStorage(actor: Actor, ids: ResourceIds): Promise<ValidationResult>, saveConnection(actor: Actor, input: StorageInput, expectedVersion: number): Promise<PublicConnection>, disconnectConnection(actor: Actor, expectedVersion: number): Promise<void>

- [ ] เขียน connections.test.ts ทดสอบ schema_version=1, จำนวน/ชื่อ/หัวคอลัมน์ตามตาราง, initialization ซ้ำไม่เพิ่มแท็บซ้ำ, ไม่เขียนทับแท็บที่ schema ขัดแย้ง, initialize พื้นที่ที่คนอื่นจองไว้ไม่ได้, ส่ง user_id ปลอมไม่ได้ผล และ save ต้องตรวจ Google ซ้ำแม้หน้าเว็บเคย validate แล้ว
- [ ] เพิ่มกรณีเปลี่ยน URL แล้วล้มเหลวต้องเก็บค่าเดิม, ใช้ expectedVersion เก่าต้องได้ 409 และยกเลิกการเชื่อมต่อแล้วไม่ลบ Sheets/Drive
- [ ] รัน npm test -- tests/storage/connections.test.ts ให้เห็น FAIL
- [ ] สร้าง initializeStorage ให้จอง ID ทั้งสองด้วย coordinator ก่อน แล้ว preflight ทุกแท็บก่อนแก้ไข ใช้ Sheets batchUpdate สร้างเฉพาะส่วนที่ขาด ไม่ทำ normalization ข้อมูลผู้ใช้โดยอัตโนมัติ; save ตรวจ reservation เจ้าของเดิมและเปลี่ยนเป็น active ภายใต้ล็อก
- [ ] สร้าง API และหน้าสองช่อง URL ตามขอบเขตฟังก์ชัน ปุ่มบันทึกต้องสัมพันธ์กับค่าที่ตรวจล่าสุด; หากแก้ URL หลัง validate ให้กลับไปสถานะต้องตรวจใหม่ ส่วน initialization ต้องเป็นการกระทำที่ผู้ใช้กดเอง
- [ ] เขียน E2E: A/B ใส่ URL คนละชุด, refresh แล้วยังเห็นเฉพาะค่าตนเอง, URL ผิดมีข้อความแก้ไขได้, สิทธิ์ไม่พอไม่บันทึก, เปลี่ยนพื้นที่ต้องเห็นผลกระทบก่อนยืนยัน
- [ ] รัน npm test -- tests/storage/connections.test.ts และ npx playwright test tests/e2e/storage-settings.spec.ts ให้ PASS แล้ว commit เฉพาะไฟล์งานนี้หากเป็น Git repository

### Task 4: จุดเชื่อมสำหรับปฏิทิน ไฟล์ และการเตือน

**Files:** Create server/storage/access.ts, tests/storage/access.test.ts; Modify server/storage/connections.ts

**Interfaces:** Consumes Actor, Connection, getConnection; produces requireStorage(actor: Actor): Promise<Connection>, assertCurrentConnection(actor: Actor, expectedVersion: number): Promise<void>, getOwnedFile(actor: Actor, fileId: string): Promise<{ driveFileId: string; name: string }>

- [ ] เขียน access.test.ts ทดสอบให้ A/B ที่มี row ID เหมือนกันอ่านได้เฉพาะ Sheets ของตน, ห้ามเปิดไฟล์ของอีกคนด้วย drive_file_id, ไม่ fallback ไปทะเบียนคนอื่น และ revoked token ต้องหยุดใช้งาน
- [ ] เพิ่มกรณี background job ถือ version เก่าแล้วต้องถูกยกเลิกก่อนส่ง/เขียน, disconnected account ใช้ requireStorage ไม่ได้ และการเปลี่ยนพื้นที่ไม่คัดลอก reminder เก่ามาส่งในพื้นที่ใหม่
- [ ] รัน npm test -- tests/storage/access.test.ts ให้เห็น FAIL
- [ ] สร้าง access layer ที่ใช้การเชื่อมต่อจาก Actor เท่านั้น ตรวจ owner_id ของรายการและ version ก่อนผลข้างเคียง; API อื่นต้องผ่าน layer นี้
- [ ] รัน npm test, npm run build และ npx playwright test tests/e2e/storage-settings.spec.ts ให้ PASS; ทดสอบจริงบน Netlify preview ด้วยบัญชีทดสอบสองรายและไฟล์ทดสอบเท่านั้น แล้วบันทึกผลก่อน commit หากเป็น Git repository

## สิ่งที่ต้องเตรียมเมื่อเริ่มพัฒนา

- Google Cloud project เปิด Sheets API, Drive API, Picker API และตั้ง OAuth consent/callback สำหรับโดเมนที่ใช้จริง
- บัญชีทดสอบสองราย แต่ละรายมี Sheets และโฟลเดอร์ของตนเอง
- Sheets กลางของระบบและ backend identity ที่มีสิทธิ์เฉพาะทะเบียนกลาง
- ยืนยันวิธี single-writer coordinator ก่อนทำการจอง/บันทึกทรัพยากรจริง
- Netlify environment variables สำหรับ OAuth client secret, session signing, encryption key, backend identity และรหัส Sheets กลาง โดยไม่ใช้ตัวแปร public ของ frontend
- วางแผน OAuth production publishing/verification ตาม scopes และกลุ่มผู้ใช้จริง; โหมดทดสอบไม่ใช่สภาพพร้อมเปิดใช้ถาวร
- ผู้ใช้ไม่ต้องส่ง Google password, private key หรือ refresh token ผ่านแชต

## เกณฑ์ส่งมอบ

- ผู้ใช้สองรายตั้ง URL คนละชุดได้ และอ่าน/เขียน/เปิดไฟล์ของกันและกันผ่านแอปไม่ได้
- URL ถูกต้องแต่ไม่มีสิทธิ์ไม่ทำให้หน้าจอขึ้นว่าพร้อมใช้งาน
- ข้อมูลเดิมไม่ถูกเขียนทับโดยขั้นตอนตั้งค่า
- refresh แล้วค่าการเชื่อมต่อยังคงอยู่ โดยไม่มี credential หลุดไปหน้าเว็บ
- เปลี่ยน URL / ถอนสิทธิ์ / disconnect แล้วงานเบื้องหลังใช้สถานะปัจจุบัน
- ไม่มีการเผยแพร่ production หรือเปลี่ยนไฟล์จริงของผู้ใช้ในขั้นเขียนแผนนี้

## แหล่งอ้างอิง

- [Google Drive scopes และ drive.file](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Google Sheets scopes](https://developers.google.com/workspace/sheets/api/scopes)
- [Google Picker](https://developers.google.com/workspace/drive/api/guides/picker)
- [Google OAuth สำหรับเว็บเซิร์ฟเวอร์](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google Sheets API limits](https://developers.google.com/workspace/sheets/api/limits)

## ผลการตรวจแผนด้วยตัวเอง

ตรวจความครอบคลุมของช่อง URL, Google consent, schema, การแยกเจ้าของ, การเปลี่ยนพื้นที่, การตัดการเชื่อมต่อ และตัวเชื่อมงานเบื้องหลังแล้ว แต่ละจุดผูกกับ Task และการทดสอบข้างต้น ส่วนปฏิทินเต็มรูปแบบ/การส่งแจ้งเตือนจริงแยกไว้ชัดเจน ยังไม่มีการเขียนหรือทดสอบโค้ดระบบ
