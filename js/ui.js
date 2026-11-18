// ===== สร้าง HTML ของหน้าเว็บ + คำนวณสรุปรีวิว =====
import { LABEL_CLASS, LABEL_TEXT, THRESHOLDS } from './config.js'; // ค่าตั้งค่าเรื่อง label
import { navLink } from './geo.js'; // ลิงก์นำทาง Google Maps

const NODATA = 'ข้อมูลไม่พอ'; // label ที่ pipeline ใช้เมื่อพูดถึงน้อยกว่า min_mentions

// ---------- ตัวช่วยเรื่องข้อความ ----------

// รีวิวมาจากคนทั่วไป ต้อง escape ทุกครั้งก่อนใส่ลง HTML (กันโค้ดแปลกปลอม / XSS)
export const esc = s => String(s).replace(/[&<>"']/g, c => // หาอักขระที่มีความหมายพิเศษใน HTML
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); // แทนด้วยรหัสที่แสดงผลเหมือนเดิมแต่ไม่ถูกตีความเป็นโค้ด

// ตัดอักขระล่องหน (zero-width) ที่ติดมากับชื่อสาขา แล้วจัดช่องว่างให้เรียบร้อย
export const clean = s => s == null ? s : String(s) // null / undefined คืนค่าเดิม
  .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '') // ลบ zero-width space / joiner, word joiner, BOM
  .replace(/\s+/g, ' ') // ช่องว่างหลายตัวติดกัน → ตัวเดียว
  .trim(); // ตัดช่องว่างหัวท้าย

// แสดงข้อความสถานะใต้ช่องค้นหา (err = true → ตัวแดง)
export const setMsg = (text, err = false) => {
  const el = document.getElementById('msg'); // กล่องข้อความสถานะ
  el.textContent = text; // ใส่ข้อความ (textContent ไม่ตีความ HTML จึงปลอดภัย)
  el.classList.toggle('err', err); // ใส่ / เอาออก สีแดง ตามสถานะ error
};

// ---------- ตัวเลขของแต่ละด้าน (a = { label, positive, neutral, negative }) ----------

const mentions = a => (a.positive || 0) + (a.neutral || 0) + (a.negative || 0); // จำนวนครั้งที่พูดถึงทั้งหมด
const pctPos = a => Math.round(100 * a.positive / mentions(a)); // % ที่ชม (ผู้เรียกต้องเช็กก่อนว่า mentions > 0)
const cls = a => LABEL_CLASS[a.label] || 'nodata'; // label → class สี (ไม่รู้จัก = เทา)
const labelText = a => a.label === NODATA // ข้อความบนป้าย:
  ? `พูดถึง ${mentions(a)} ครั้ง` // ข้อมูลไม่พอ → บอกจำนวนครั้งแทน
  : LABEL_TEXT[a.label] ?? a.label; // อื่นๆ → คำที่แปลงแล้ว (เฉยๆ → ปานกลาง) หรือคำเดิม

// รายละเอียดจำนวนครั้ง เช่น "ลูกค้าพูดถึง 4 ครั้ง (บวก 4 · ลบ 0)"
export function countText(a) {
  const m = mentions(a); // จำนวนครั้งทั้งหมด
  if (!m) return 'ลูกค้ายังไม่ได้พูดถึง'; // 0 ครั้ง
  const neutral = a.neutral ? ` · กลาง ${a.neutral}` : ''; // แสดง "กลาง" เฉพาะเมื่อมี (โมเดลแทบไม่ทาย)
  return `ลูกค้าพูดถึง ${m} ครั้ง (บวก ${a.positive} · ลบ ${a.negative}${neutral})`; // ประกอบเป็นประโยค
}

// ---------- ภาพรวมทั้งเครือ ----------

// ตัดสิน label จาก score — ตรรกะเดียวกับ verdict() ใน teenoi-predict/src/teenoi_predict/summarizer.py
export const verdict = (score, m, min) => // m = จำนวนครั้งที่พูดถึง, min = min_mentions จาก JSON
  m < min ? NODATA // พูดถึงน้อยกว่าเกณฑ์ → ข้อมูลไม่พอ (เช็กก่อนเสมอ)
    : score >= THRESHOLDS.positive ? 'ดี' // score ≥ 0.3
      : score <= THRESHOLDS.negative ? 'แย่' // score ≤ -0.3
        : 'เฉยๆ'; // อยู่ระหว่างนั้น (เว็บแสดงเป็น "ปานกลาง")

// รวมตัวเลขทุกสาขาเป็นภาพรวมทั้งเครือ ทุกด้าน (คำนวณจาก JSON ทุกครั้ง ไม่มีตัวเลขตายตัว)
export function overall(branches, codes, min) {
  return Object.fromEntries(codes.map(k => { // ทำทีละด้าน แล้วรวมเป็น { food: {...}, service: {...}, ... }
    const a = { positive: 0, neutral: 0, negative: 0 }; // ตัวนับเริ่มที่ 0
    for (const b of branches) { // วนทุกสาขา
      for (const s in a) a[s] += b.aspects?.[k]?.[s] ?? 0; // บวกจำนวนของสาขานั้นเข้าไป (ไม่มีข้อมูล = 0)
    }
    const m = mentions(a); // จำนวนครั้งรวมทั้งเครือ
    a.score = m ? (a.positive - a.negative) / m : null; // สูตรเดียวกับ pipeline: (บวก − ลบ) ÷ ทั้งหมด
    a.label = verdict(a.score, m, min); // ตัดสิน label
    return [k, a]; // คู่ [รหัสด้าน, ผล]
  }));
}

// ข้อความใต้แถบในภาพรวม เช่น "บวก 84% จาก 337 รีวิว"
export const overallText = a => mentions(a) // มีคนพูดถึงไหม
  ? `บวก ${pctPos(a)}% จาก ${mentions(a)} รีวิว` // มี → % ที่ชม
  : 'ลูกค้ายังไม่ได้พูดถึง'; // ไม่มีเลย

// ---------- ชิ้นส่วน HTML ----------

const tip = a => a.label === NODATA // ข้อความตอนชี้เมาส์ (tooltip):
  ? countText(a) // ข้อมูลไม่พอ → บอกจำนวน
  : `${labelText(a)} (บวก ${a.positive} · ลบ ${a.negative})`; // อื่นๆ → label + จำนวน

const chip = a => `<span class="chip ${cls(a)}">${esc(labelText(a))}</span>`; // ป้ายสีพร้อมข้อความ label

const bar = a => `<span class="bar ${cls(a)}"><i style="width:${mentions(a) ? pctPos(a) : 0}%"></i></span>`; // แถบสี: ความยาวส่วนที่ระบายสี = % ที่ชม

// ป้ายชื่อด้านในการ์ดรายการ (สีบอก label, ชี้แล้วเห็นรายละเอียด)
const chips = (b, names) => '<div class="chips">' // กล่องรวมป้าย
  + Object.entries(b.aspects).map(([k, a]) => // ทีละด้าน
    `<span class="chip ${cls(a)}" title="${esc(names[k])}: ${esc(tip(a))}">${esc(names[k])}</span>`) // ป้ายชื่อด้าน + tooltip
    .join('') // ต่อทุกป้ายเป็นข้อความเดียว
  + '</div>'; // ปิดกล่อง

// แถวสรุป 1 ด้าน: ชื่อด้าน | แถบสี | ป้าย label (ใช้ทั้งใน popup และการ์ดภาพรวม)
const aspectRow = (name, a, extra = '') => // extra = HTML ต่อท้ายแถว (ภาพรวมใช้ใส่ % ที่ชม)
  `<div class="asp" title="${esc(tip(a))}"><span>${esc(name)}</span>${bar(a)}${chip(a)}${extra}</div>`; // ประกอบแถว

// แถบสรุปทุกด้านของสาขาใน popup
const bars = (b, names) => '<div class="asps">' // กล่องรวมทุกแถว
  + Object.entries(b.aspects).map(([k, a]) => aspectRow(names[k], a)).join('') // แถวละด้าน
  + '</div>'; // ปิดกล่อง

// เลือกรีวิวตัวอย่างตามสัดส่วนจริง: ฝั่งส่วนน้อยได้ floor(n × สัดส่วน) ช่อง
// เช่น บวก 11 ลบ 2 → 3 บวก 0 ลบ, บวก 6 ลบ 9 → 2 ลบ 1 บวก (ฝั่งน้อยต้อง ≥ 1/3 ถึงจะโผล่)
// ข้อมูลไม่พอ → โชว์ทุกตัวอย่างที่มี (มีน้อยอยู่แล้ว และไม่ควรเลือกข้าง)
export function pickSamples(a, s, n = 3) {
  const P = (s.positive || []).map(t => ['👍', t]); // รีวิวบวก ติดไอคอน 👍
  const N = (s.negative || []).map(t => ['👎', t]); // รีวิวลบ ติดไอคอน 👎
  if (a.label === NODATA) return [...P, ...N]; // ข้อมูลไม่พอ → เอาทุกอัน
  const total = a.positive + a.negative; // จำนวนบวก + ลบ (ไม่นับกลาง)
  const [major, minor] = a.negative > a.positive ? [N, P] : [P, N]; // ฝั่งที่มากกว่า = ฝั่งหลัก (เท่ากัน → บวกเป็นหลัก)
  const share = total ? Math.min(a.positive, a.negative) / total : 0; // สัดส่วนของฝั่งส่วนน้อย
  const nMinor = Math.min(minor.length, Math.floor(n * share)); // ฝั่งน้อยได้กี่ช่อง (ไม่เกินที่มีจริง)
  return [...major.slice(0, n - nMinor), ...minor.slice(0, nMinor)]; // ฝั่งหลักขึ้นก่อน ตามด้วยฝั่งน้อย
}

// ส่วน "ตัวอย่างรีวิว" ใน popup: หัวข้อพับได้ทีละด้าน
function samples(b, names) {
  const parts = Object.entries(b.sample_reviews || {}).map(([k, s]) => { // ทีละด้านที่มีรีวิวตัวอย่าง
    const a = b.aspects[k]; // ตัวเลขของด้านนี้
    const items = a ? pickSamples(a, s) : []; // เลือกรีวิวที่จะโชว์
    if (!items.length) return ''; // ไม่มีรีวิว → ไม่ต้องมีหัวข้อนี้
    const open = a.label === NODATA ? ' open' : ''; // ข้อมูลไม่พอ → กางไว้เลยให้อ่านได้ทันที
    const list = items.map(([icon, text]) => `<li><span>${icon}</span>${esc(text)}</li>`).join(''); // รายการรีวิว (escape ข้อความ)
    return `<details${open}><summary>${esc(names[k])} ${chip(a)}</summary><ul>${list}</ul></details>`; // หัวข้อพับได้ + รายการ
  }).join(''); // ต่อทุกด้าน
  return parts ? `<div class="sec">ตัวอย่างรีวิว</div>${parts}` : ''; // มีอย่างน้อย 1 ด้าน → ใส่หัวข้อใหญ่ด้วย
}

// ดาว Google + จำนวนรีวิวที่วิเคราะห์ เช่น "★ 4.6 · 62 รีวิว"
const rating = b => `<span class="star">★ ${b.google_rating ?? '-'}</span> · ${b.reviews_analyzed} รีวิว`; // ไม่มีดาว → แสดง -

// HTML ของ popup สาขา (me = ตำแหน่งผู้ใช้ ใช้ทำลิงก์นำทาง)
export function popupHtml(b, names, me) {
  const gmaps = b.gmaps_url // มีลิงก์หน้าสาขาใน Google Maps ไหม
    ? `<a href="${esc(b.gmaps_url)}" target="_blank" rel="noopener">Google Maps</a>` // มี → ปุ่มเปิดหน้าสาขา (แท็บใหม่)
    : ''; // ไม่มี → ไม่ต้องมีปุ่ม
  return [
    '<div class="popup">', // กล่องหลัก
    `<div class="name">${esc(b.name)}</div>`, // ชื่อสาขา
    `<div class="meta">${rating(b)}</div>`, // ดาว + จำนวนรีวิว
    bars(b, names), // แถบสรุป 5 ด้าน
    samples(b, names), // ตัวอย่างรีวิว
    '<div class="links">', // แถวปุ่ม
    `<a href="${navLink(b, me)}" target="_blank" rel="noopener">🧭 นำทาง</a>`, // ปุ่มนำทาง (แท็บใหม่)
    gmaps, // ปุ่ม Google Maps
    '</div></div>', // ปิดแถวปุ่ม + กล่องหลัก
  ].join(''); // ต่อเป็นข้อความเดียว
}

// การ์ด "ภาพรวมทั้งเครือ" ในแถบซ้าย (ov = ผลจาก overall())
export function renderOverall(ov, names, nBranches) {
  const el = document.getElementById('overall'); // กล่อง <details id="overall">
  const rows = Object.entries(ov) // ทีละด้าน
    .map(([k, a]) => aspectRow(names[k], a, `<small class="sub">${esc(overallText(a))}</small>`)) // แถว + บรรทัด % ที่ชม
    .join(''); // ต่อทุกแถว
  el.innerHTML = `<summary>📊 ภาพรวมทั้งเครือ <small>จาก ${nBranches} สาขา</small></summary><div class="asps">${rows}</div>`; // หัวข้อพับได้ + แถว
  el.hidden = false; // ตอนแรกซ่อนไว้ (กันกล่องว่าง) โหลดเสร็จค่อยโชว์
}

// รายการสาขาในแถบซ้าย; rows = [{ b, i, d }] (i = ลำดับใน branches, d = ระยะทาง กม. หรือ null)
export function renderList(rows, names) {
  document.getElementById('list').innerHTML = rows.map(({ b, i, d }) => [ // สร้างการ์ดทีละสาขา
    `<button class="item" data-i="${i}">`, // การ์ดเป็นปุ่ม (กด Tab ถึงได้) จำลำดับสาขาไว้ใน data-i
    `<div class="head"><span class="name">${esc(b.name)}</span>`, // แถวบน: ชื่อสาขา
    d != null ? `<span class="dist">${d.toFixed(1)} กม.</span>` : '', // ระยะทาง (เฉพาะเมื่อรู้ตำแหน่งผู้ใช้)
    '</div>', // ปิดแถวบน
    b.address ? `<div class="addr">${esc(b.address)}</div>` : '', // ที่อยู่ (ถ้ามี)
    `<div class="meta">${rating(b)}</div>`, // ดาว + จำนวนรีวิว
    chips(b, names), // ป้าย 5 ด้าน
    '</button>', // ปิดการ์ด
  ].join('')).join(''); // ต่อส่วนต่างๆ เป็นการ์ด แล้วต่อทุกการ์ด
}

// ไฮไลต์การ์ดของสาขาที่เลือก (i = ลำดับสาขา, null = ไม่มี)
export function markActive(i) {
  document.querySelectorAll('.item.active').forEach(el => el.classList.remove('active')); // เอาไฮไลต์เก่าออก
  const el = document.querySelector(`.item[data-i="${i}"]`); // หาการ์ดของสาขานี้
  if (!el) return; // ไม่อยู่ในรายการ (เช่น ไม่ติด 10 สาขาใกล้สุด) → จบ
  el.classList.add('active'); // ใส่ไฮไลต์
  el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); // เลื่อนรายการให้เห็นการ์ด
}
