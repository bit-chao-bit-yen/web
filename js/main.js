// ===== จุดเริ่มต้นของเว็บ: โหลดข้อมูล, ผูกปุ่ม, จัดลำดับรายการ =====
import { DATA_URL, NEAREST_COUNT } from './config.js'; // ที่อยู่ไฟล์ข้อมูล, จำนวนสาขาใกล้สุดที่จะแสดง
import { km, myLocation, geocode } from './geo.js'; // ระยะทาง, GPS, ค้นหาที่อยู่
import { initMap, addBranch, showMe, focus, fitAll } from './map.js'; // จัดการแผนที่
import { esc, clean, setMsg, popupHtml, renderList, markActive, overall, renderOverall } from './ui.js'; // สร้าง HTML + สรุปผล

let branches = []; // สาขาที่มีพิกัด (ลำดับตรงกับ markers)
let markers = []; // หมุดบนแผนที่: markers[i] คู่กับ branches[i]
let names = {}; // ชื่อด้านภาษาไทย เช่น { food: 'อาหาร' }
let me = null; // ตำแหน่งผู้ใช้ { lat, lng } (null = ยังไม่รู้)
let active = null; // ลำดับสาขาที่เปิด popup อยู่

// วาดรายการสาขาใหม่ แล้วคืนรายการที่เรียงแล้ว
function render() {
  const rows = branches.map((b, i) => ({ b, i, d: me ? km(me, b) : null })); // ทุกสาขา + ระยะทางจากผู้ใช้ (ถ้ารู้ตำแหน่ง)
  const byDistance = (x, y) => x.d - y.d; // ใกล้ก่อน
  const byRating = (x, y) => (y.b.google_rating ?? 0) - (x.b.google_rating ?? 0); // ดาวมากก่อน (ไม่มีดาว = 0)
  rows.sort(me ? byDistance : byRating); // รู้ตำแหน่ง → เรียงตามระยะ, ไม่รู้ → เรียงตามดาว
  renderList(me ? rows.slice(0, NEAREST_COUNT) : rows, names); // รู้ตำแหน่ง → แสดงแค่ N สาขาใกล้สุด
  markActive(active); // คงไฮไลต์การ์ดที่เลือกไว้
  return rows; // ส่งกลับให้ setMe ใช้ต่อ
}

// ตั้งตำแหน่งผู้ใช้ (จาก GPS หรือการค้นหา) แล้วอัปเดตรายการ + แผนที่
function setMe(pos, label) {
  me = pos; // จำตำแหน่ง
  const rows = render(); // เรียงรายการใหม่ตามระยะทาง
  if (!rows.length) return; // ไม่มีสาขาเลย → จบ
  showMe(me, label, rows.slice(0, 3).map(r => r.b)); // ปักจุดผู้ใช้ + ซูมให้เห็น 3 สาขาใกล้สุด
  setMsg(`${NEAREST_COUNT} สาขาที่ใกล้ที่สุด · ใกล้สุดห่าง ${rows[0].d.toFixed(1)} กม.`); // บอกผล
}

// รันงานที่ต้องรอ (GPS / ค้นหา) โดยล็อกปุ่มไว้ กันกดซ้ำ (และกันยิง Nominatim ถี่เกิน)
async function busy(btn, text, job) {
  if (btn.disabled) return; // กำลังทำอยู่ → ไม่รับซ้ำ
  btn.disabled = true; // ล็อกปุ่ม
  setMsg(text); // บอกว่ากำลังทำอะไร
  try { // ลองทำงาน
    await job(); // ทำงานจริง
  } catch (err) { // ทำไม่สำเร็จ
    setMsg(err.message || 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง', true); // แสดงข้อความสีแดง
  } finally { // ไม่ว่าสำเร็จหรือไม่
    btn.disabled = false; // ปลดล็อกปุ่ม
  }
}

// กดการ์ดในรายการ → ซูมไปที่สาขา + เปิด popup
document.getElementById('list').onclick = e => { // ดักคลิกที่กล่องรายการทีเดียว (ไม่ต้องผูกทุกการ์ด)
  const el = e.target.closest('.item'); // หาการ์ดที่ถูกคลิก (คลิกโดนข้อความข้างในก็นับ)
  if (el) focus(branches[el.dataset.i], markers[el.dataset.i]); // เจอ → ไปที่สาขานั้น
};

// ปุ่ม "ใช้ตำแหน่งของฉัน"
const geoBtn = document.getElementById('geo'); // ปุ่ม GPS
geoBtn.onclick = () => busy(geoBtn, 'กำลังหาตำแหน่ง...', async () => { // กดแล้วล็อกปุ่มระหว่างรอ
  setMe(await myLocation(), 'คุณอยู่ที่นี่'); // ได้พิกัด → ตั้งเป็นตำแหน่งผู้ใช้
});

// ฟอร์มค้นหาที่อยู่
const form = document.getElementById('search'); // ฟอร์มค้นหา
const input = document.getElementById('q'); // ช่องพิมพ์ที่อยู่
form.onsubmit = e => { // กด Enter หรือปุ่มค้นหา
  e.preventDefault(); // ไม่ให้เบราว์เซอร์รีโหลดหน้า
  const q = input.value.trim(); // ข้อความที่พิมพ์ (ตัดช่องว่างหัวท้าย)
  if (!q) return input.focus(); // ว่าง → ย้ายเคอร์เซอร์กลับไปที่ช่องพิมพ์
  busy(form.querySelector('button'), 'กำลังค้นหา...', async () => { // ล็อกปุ่มค้นหาระหว่างรอ
    const hit = await geocode(q); // แปลงที่อยู่เป็นพิกัด
    setMe(hit, esc(hit.label)); // ตั้งเป็นตำแหน่งผู้ใช้ (escape ชื่อสถานที่ก่อนใส่ popup)
  });
};

// ---------- เริ่มทำงาน ----------
initMap('map'); // สร้างแผนที่ใน <main id="map">
try { // โหลดข้อมูลสาขา
  const d = await (await fetch(DATA_URL)).json(); // ดึงไฟล์ JSON แล้วแปลงเป็น object
  names = d.aspect_names; // ชื่อด้านภาษาไทย
  for (const b of d.branches) { // ทำความสะอาดข้อความทุกสาขา
    b.name = clean(b.name); // ชื่อ: ตัดอักขระล่องหน
    b.address = clean(b.address); // ที่อยู่: ตัดอักขระล่องหน
  }
  const ov = overall(d.branches, Object.keys(names), d.settings?.min_mentions ?? 5); // สรุปภาพรวมทั้งเครือ (ไม่มี min_mentions → ใช้ 5)
  renderOverall(ov, names, d.branches.length); // วาดการ์ดภาพรวม
  document.getElementById('overall').open = matchMedia('(min-width: 761px)').matches; // จอใหญ่กางไว้, มือถือพับไว้ประหยัดที่
  branches = d.branches.filter(b => b.lat != null && b.lng != null); // เอาเฉพาะสาขาที่มีพิกัด
  markers = branches.map((b, i) => addBranch( // ปักหมุดทุกสาขา
    b, // ข้อมูลสาขา
    () => popupHtml(b, names, me), // popup สร้างใหม่ทุกครั้งที่เปิด (ลิงก์นำทางใช้ตำแหน่งล่าสุด)
    () => markActive(active = i), // เปิด popup → จำสาขานี้ + ไฮไลต์การ์ด
  ));
  fitAll(); // ซูมให้เห็นทุกสาขา
  setMsg(`ทั้งหมด ${branches.length} สาขา · อัปเดต ${d.generated_at.slice(0, 10)}`); // บอกจำนวน + วันที่ของข้อมูล
  render(); // วาดรายการ (เรียงตามดาว)
} catch { // โหลดไม่ได้ (ส่วนใหญ่เพราะเปิดไฟล์ตรงๆ แทน http server)
  setMsg('โหลดข้อมูลไม่ได้ (ต้องเปิดผ่าน http server ไม่ใช่ดับเบิลคลิกไฟล์)', true); // แจ้งเป็นสีแดง
}
