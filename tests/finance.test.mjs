import test from 'node:test';import assert from 'node:assert/strict';
import * as finance from '../src/finance.mjs';
test('ledger uses exact satang and excludes own-account transfers from income/expense totals',()=>{
 assert.equal(finance.toSatang('1,234.56'),123456);assert.equal(finance.toSatang('0.10'),10);assert.equal(finance.toSatang('1.234'),null);
 const list=[{type:'income',amount:100000,date:'2026-10-01'},{type:'expense',amount:1010,date:'2026-10-02',category:'food'},{type:'transfer',amount:50000,date:'2026-10-03'},{type:'expense',amount:999,date:'2026-09-30'}];
 assert.deepEqual(finance.financeSummary(list,'2026-10'),{income:100000,expense:1010,net:98990,count:3,categories:{food:1010}});
});
test('slip parser prefers explicit transferred amount and never turns an account/ref number into money',()=>{
 const slip='โอนเงินสำเร็จ\n27 ต.ค. 2569 14:32\nผู้รับเงิน: ร้านดาว\nเลขบัญชี 1234567890\nจำนวนเงิน\n1,250.50 บาท\nค่าธรรมเนียม 0.00\nเลขอ้างอิง 99999999999999';
 const draft=finance.parseSlipText(slip,'2026-10-27');
 assert.equal(draft.amount,125050);assert.equal(draft.date,'2026-10-27');assert.equal(draft.type,null);assert.equal(draft.merchant,'ร้านดาว');
 assert.equal(finance.parseSlipText('เลขบัญชี 1234567890\nเลขอ้างอิง 999999999','2026-10-27').amount,null);
});
test('conflicting slip totals require manual selection rather than guessing',()=>{
 const draft=finance.parseSlipText('ยอดโอน 100.00 บาท\nจำนวนเงิน 200.00 บาท','2026-10-27');
 assert.equal(draft.amount,null);assert.deepEqual(draft.amountCandidates,[10000,20000]);
});
test('ordinary finance commands produce deterministic entries while advice remains AI work',()=>{
 const command=finance.parseFinanceCommand('จ่ายค่ากาแฟ 65 บาท วันนี้','2026-10-27');
 assert.equal(command.amount,6500);assert.equal(command.type,'expense');assert.equal(command.category,'food');
 assert.equal(finance.parseFinanceCommand('รับเงินเดือน 25,000 บาท','2026-10-27').type,'income');
 assert.equal(finance.parseFinanceCommand('ช่วยวิเคราะห์รายจ่ายหน่อย','2026-10-27'),null);
});
test('extra decimal places and malformed thousands groups cannot become a different saved amount',()=>{
 assert.ok(finance.parseFinanceCommand('จ่ายค่าข้าว 12.345 บาท').error);
 assert.equal(finance.parseSlipText('จำนวนเงิน 12.345 บาท').amount,null);
 assert.equal(finance.toSatang('1,2.00'),null);
});

test('retail receipts select the payable total rather than subtotal, tax, cash or change',()=>{
 const draft=finance.parseSlipText('ใบเสร็จรับเงิน\nร้านค้า: ร้านทดสอบ\n27 ตุลาคม 2569\nยอดรวมก่อนภาษี 100\nภาษีมูลค่าเพิ่ม 7\nยอดรวมสุทธิ 107\nรับเงินสด 200\nเงินทอน 93','2026-01-01');
 assert.equal(draft.amount,10700);assert.deepEqual(draft.amountCandidates,[10700]);assert.equal(draft.documentType,'receipt');assert.equal(draft.date,'2026-10-27');assert.equal(draft.merchant,'ร้านทดสอบ');
 const english=finance.parseSlipText('TAX INVOICE\n2026-10-25\nSUBTOTAL 99.00\nTAX 6.93\nGRAND TOTAL THB 105.93\nCASH 200.00\nCHANGE 94.07','2026-01-01');
 assert.equal(english.amount,10593);assert.equal(english.date,'2026-10-25');assert.equal(english.documentType,'receipt');
});

test('integer transfers and Thai digits preserve satang and identify transfer documents',()=>{
 const draft=finance.parseSlipText('โอนเงินสำเร็จ\nวันที่ ๒๗/๑๐/๒๕๖๙\nผู้รับ: ทดสอบ\nยอดโอน ฿ ๑,๒๕๐\nค่าธรรมเนียม ๐','2026-01-01');
 assert.equal(draft.amount,125000);assert.equal(draft.documentType,'transfer');assert.equal(draft.date,'2026-10-27');assert.equal(draft.type,null);
});

test('generic totals cannot match inside subtotals, tax totals, account labels or malformed numbers',()=>{
 for(const text of ['SUBTOTAL 123.45','Tax total 7.00','Total tax 7.00','ยอดรวมภาษี 7.00','เลขบัญชี Amount 1234567890','TOTAL 1,2.00','TOTAL 12.345','TOTAL -10.00','TOTAL 12.00.50']){
  assert.equal(finance.parseSlipText(text).amount,null,text);
 }
});

test('conflicting receipt totals require review and invalid dates do not roll forward',()=>{
 const draft=finance.parseSlipText('RECEIPT\nTOTAL 100\nAMOUNT DUE 200\n2026-02-30','2026-10-27');
 assert.equal(draft.amount,null);assert.deepEqual(draft.amountCandidates,[10000,20000]);assert.equal(draft.date,'2026-10-27');assert.equal(draft.dateDetected,false);
 assert.equal(finance.parseSlipText('an ordinary image 1234').documentType,'unknown');
});

test('common payment labels and currency annotations remain explicit totals',()=>{
 for(const text of ['ยอดเงิน 250 บาท','จำนวนเงินที่ชำระ: 250','ยอดชำระเงิน 250','รวมเงิน 250','TOTAL (THB): 250']){
  assert.equal(finance.parseSlipText(text).amount,25000,text);
 }
});

test('next-line totals cannot consume identity fields or become a merchant',()=>{
 const draft=finance.parseSlipText('ร้านค้า:\nจำนวนเงิน\nเลขบัญชี 1234567890');
 assert.equal(draft.amount,null);assert.equal(draft.merchant,'');
});

test('conversational salary commands accept contiguous numbers and polite save requests',()=>{
 for(const message of ['บันทึกเงินเดือน20000','บันทึกเงินเดือน20000 วันนี้','รายรับอะเงินเดือน20000บันทึกให้หน่อย']){
  const draft=finance.parseFinanceCommand(message,'2026-10-27');
  assert.equal(draft.amount,2000000,message);assert.equal(draft.type,'income');assert.equal(draft.title,'เงินเดือน');
 }
 assert.equal(finance.parseFinanceCommand('เงินเดือนควรเท่าไหร่'),null);
 assert.equal(finance.parseFinanceCommand('ซื้อรถ 20000 ดีไหม'),null);
});
