// ===== ทดสอบ logic ใน ui.js (ไม่ต้องเปิดเบราว์เซอร์) — รัน: node js/ui.test.mjs =====
import assert from 'node:assert'; // ตัวตรวจผลของ Node: ผิดเมื่อไหร่ โยน error ทันที
import { readFileSync } from 'node:fs'; // อ่านไฟล์ JSON จริงมาลองคำนวณ
import { pickSamples, overall, overallText, countText, clean, verdict } from './ui.js'; // ฟังก์ชันที่จะทดสอบ

// ---------- pickSamples: เลือกรีวิวตัวอย่างตามสัดส่วน ----------
const s = { positive: ['p1', 'p2', 'p3'], negative: ['n1', 'n2', 'n3'] }; // รีวิวตัวอย่างปลอม ฝั่งละ 3 อัน
const signs = (a, ss = s) => pickSamples(a, ss).map(([e]) => e).join(''); // แปลงผลเป็นสตริงไอคอน เช่น '👍👍👎' ให้เทียบง่าย

assert.equal(signs({ positive: 11, negative: 2 }), '👍👍👍'); // ดีชัด → ไม่มีรีวิวลบปน
assert.equal(signs({ positive: 7, negative: 2 }), '👍👍👍'); // ลบ 22% < 1/3 → ไม่โชว์รีวิวลบ
assert.equal(signs({ positive: 6, negative: 9 }), '👎👎👍'); // ลบเป็นหลัก → รีวิวลบขึ้นก่อน
assert.equal(signs({ positive: 5, negative: 5 }), '👍👍👎'); // ครึ่งๆ → ฝั่งน้อยได้ 1 ช่อง
assert.equal(signs({ positive: 0, negative: 0 }), '👍👍👍'); // ไม่มีตัวเลข → บวกอย่างเดียว
assert.equal(signs({ positive: 1, negative: 9 }, { positive: ['p'], negative: ['n'] }), '👎'); // ตัวอย่างมีไม่พอ → ไม่เติมฝั่งตรงข้าม
assert.equal(signs({ label: 'ข้อมูลไม่พอ', positive: 3, negative: 1 }), '👍👍👍👎👎👎'); // ข้อมูลไม่พอ → โชว์ทุกอัน ไม่เลือกข้าง

// ---------- countText: ข้อความจำนวนครั้ง ----------
assert.equal(countText({ positive: 4, neutral: 0, negative: 0 }), 'ลูกค้าพูดถึง 4 ครั้ง (บวก 4 · ลบ 0)'); // มีคนพูดถึง
assert.equal(countText({ positive: 0, neutral: 0, negative: 0 }), 'ลูกค้ายังไม่ได้พูดถึง'); // ไม่มีเลย

// ---------- verdict: ต้องตรงกับ pipeline (min_mentions, ±0.3) ----------
assert.equal(verdict(0.9, 4, 5), 'ข้อมูลไม่พอ'); // score ดีแต่พูดถึงแค่ 4 < 5 → ข้อมูลไม่พอ
assert.equal(verdict(0.3, 5, 5), 'ดี'); // ขอบพอดี 0.3 → ดี
assert.equal(verdict(0, 5, 5), 'เฉยๆ'); // 0 → เฉยๆ (แสดงเป็น ปานกลาง)
assert.equal(verdict(-0.3, 5, 5), 'แย่'); // ขอบพอดี -0.3 → แย่

// ---------- overall: รวมทั้งเครือ (สาขาที่ข้อมูลไม่พอก็ถูกนับรวม) ----------
const ov = overall([ // ข้อมูลปลอม 3 สาขา ด้านเดียวชื่อ c
  { aspects: { c: { positive: 4, neutral: 0, negative: 0 } } }, // สาขาที่ 1: บวก 4
  { aspects: { c: { positive: 1, neutral: 0, negative: 1 } } }, // สาขาที่ 2: บวก 1 ลบ 1
  { aspects: {} }, // สาขาที่ 3: ไม่มีข้อมูลด้านนี้เลย (ต้องไม่พัง)
], ['c'], 5); // รหัสด้าน = c, min_mentions = 5
assert.deepEqual([ov.c.positive, ov.c.negative, ov.c.label], [5, 1, 'ดี']); // รวมได้ บวก 5 ลบ 1 → score 0.67 → ดี
assert.equal(overallText(ov.c), 'บวก 83% จาก 6 รีวิว'); // 5 ÷ 6 = 83%

// ---------- clean: ตัดอักขระล่องหนออกจากชื่อสาขา ----------
assert.equal(clean('สุกี้ตี๋น้อย\u200B เจ้าคุณ\u200Bวิลล่า'), 'สุกี้ตี๋น้อย เจ้าคุณวิลล่า'); // ชื่อจริงที่เจอในข้อมูล

// ---------- ลองกับไฟล์จริง (ข้ามถ้าไม่มีไฟล์) ----------
try { // อ่านไฟล์ข้อมูลจริงของเว็บ
  const d = JSON.parse(readFileSync(new URL('../output/branch_summary.json', import.meta.url), 'utf8')); // path อิงจากตำแหน่งไฟล์เทสต์นี้
  const c = overall(d.branches, Object.keys(d.aspect_names), d.settings.min_mentions).cleanliness; // ภาพรวมด้านความสะอาด
  console.log('ความสะอาดโดยรวม:', c.label, '·', overallText(c)); // พิมพ์ให้ดูด้วยตา
} catch (e) { if (e.code !== 'ENOENT') throw e; } // ไม่มีไฟล์ = ข้าม, error อื่น = ให้เทสต์พัง

console.log('ok'); // มาถึงบรรทัดนี้ = ผ่านทุกข้อ
