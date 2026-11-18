// ===== ค่าตั้งค่าที่ใช้ทั้งเว็บ (แก้ที่นี่ที่เดียว) =====

export const DATA_URL = 'output/branch_summary.json'; // ที่อยู่ไฟล์ข้อมูลสาขา (คัดลอกมาจาก teenoi-predict)
export const DEFAULT_VIEW = { lat: 13.75, lng: 100.5, zoom: 10 }; // จุดกลางแผนที่ก่อนโหลดข้อมูลเสร็จ (กรุงเทพฯ)
export const NEAREST_COUNT = 10; // รู้ตำแหน่งผู้ใช้แล้ว ให้แสดงสาขาที่ใกล้ที่สุดกี่สาขา

// label จาก JSON → ชื่อ class สีใน css/style.css
export const LABEL_CLASS = { 'ดี': 'good', 'เฉยๆ': 'neutral', 'แย่': 'bad', 'ข้อมูลไม่พอ': 'nodata' }; // เขียว / ส้ม / แดง / เทา

// คำที่แสดงแทน label ดิบ: "เฉยๆ" จริงๆ คือรีวิวบวกกับลบพอๆ กัน (score อยู่ระหว่าง ±0.3) ไม่ใช่ลูกค้าบอกว่าเฉยๆ
export const LABEL_TEXT = { 'เฉยๆ': 'ปานกลาง' }; // label ที่ไม่อยู่ในนี้ แสดงตามเดิม

// เกณฑ์ตัดสิน label ต้องตรงกับ teenoi-predict/configs/Predict_config.yml (summary.positive_threshold / negative_threshold)
// JSON ไม่ได้ส่งค่านี้มา ถ้าแก้ฝั่ง pipeline ต้องแก้ที่นี่ด้วย (ใช้ตอนสรุปภาพรวมทั้งเครือ)
export const THRESHOLDS = { positive: 0.3, negative: -0.3 }; // score ≥ 0.3 = ดี, ≤ -0.3 = แย่
