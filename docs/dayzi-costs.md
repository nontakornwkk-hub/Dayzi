# ค่าใช้จ่าย Dayzi (ตรวจ27ตุลาคม2569)

| ส่วน | การทำงาน/ค่าใช้จ่าย |
|---|---|
| เพิ่ม/ดู/ติ๊กงาน เพิ่มนัด จดโน้ต บันทึกเงิน รวมยอด | ระบบแอปทำเอง ไม่ใช้ Gemini; งานออนไลน์ยังใช้ Sheets/LINE ตามปกติ |
| อ่านสลิปจากรูปในหน้าเว็บ | Tesseract.js อ่านบนอุปกรณ์ ไม่มีค่าต่อภาพจาก OCR API; โหลดภาษา/โปรแกรมจากเว็บ จึงใช้ bandwidth และทรัพยากรเครื่อง |
| ช่วยคิด จัดลำดับงาน วิเคราะห์เงิน | Gemini คิดตาม token และ tier บัญชี ไม่ได้คิดทุกคำสั่ง |
| LINE ตอบข้อความที่ผู้ใช้ส่งมา | Reply messages ไม่รวมในโควตาข้อความของแพ็กเกจ Messaging API |
| LINE เตือนเชิงรุกตามเวลา | Push messages ใช้โควตาตามผู้รับ; แพ็กเกจฟรีไทยมี300ข้อความ/เดือน |
| เว็บและฟังก์ชัน Netlify | ตามแพ็กเกจและการใช้งาน deploy/compute/bandwidth/requests; แผนเครดิต Free มี300เครดิต/เดือน ไม่ใช่จำนวนครั้งเรียก AI |
| Google Sheets/Drive | ตามโควตาและพื้นที่ของบัญชีระบบ; ไม่ได้ซื้อแพ็กเกจเพิ่มในงานนี้ |

ตัวอย่างประมาณค่า Gemini3.5Flash-Lite แบบ Standard paid: input0.30USD/1ล้านtoken, output2.50USD/1ล้านtoken. ถ้าหนึ่งคำขอใช้ input1000token และ output500token รวม0.00155USD;1000คำขอประมาณ1.55USD. เป็นสมมติฐาน ไม่รวมเครื่องมืออื่น ภาษี และค่าเงิน ไม่ใช่ยอดบิลจริง. คำสั่งที่แอปทำเองและอ่านสลิปในเว็บไม่เกิดค่า Gemini นี้.

แหล่งทางการ:
- https://ai.google.dev/gemini-api/docs/pricing
- https://developers.line.biz/en/docs/messaging-api/pricing/
- https://lineforbusiness.com/th/service/line-oa-features/broadcast-message
- https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/
- https://github.com/naptha/tesseract.js

สลิป: อ่านเพื่อช่วยกรอก ไม่ใช่การตรวจว่าสลิปจริงหรือเงินเข้าจริง ต้องตรวจยอดและเลือกประเภทก่อนบันทึก รูปและเลขบัญชีไม่ส่งให้ Gemini; ปุ่มวิเคราะห์ส่งเฉพาะยอดสรุปที่แสดงให้เห็น.
