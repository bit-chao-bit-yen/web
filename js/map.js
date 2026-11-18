// ===== แผนที่ Leaflet: หมุดสาขา, ป้ายจำนวน, ตำแหน่งผู้ใช้ =====
import { DEFAULT_VIEW } from './config.js'; // จุดเริ่มต้นของแผนที่

const L = window.L; // Leaflet โหลดจาก CDN ใน index.html (เป็นตัวแปร global)
let map; // ตัวแผนที่ (สร้างใน initMap)
let meMarker; // จุดสีฟ้าตำแหน่งผู้ใช้ (มีได้ทีละจุด)
let countEl; // กล่องป้ายจำนวนสาขามุมขวาบน
const all = []; // หมุดสาขาทั้งหมด ไว้นับจำนวนและซูมให้เห็นทุกสาขา

// หน้าตาหมุด: หยดน้ำขอบส้มมี 🍲 ตรงกลาง (สไตล์อยู่ที่ .pin ใน CSS)
const icon = L.divIcon({
  className: 'pin', // class ให้ CSS จัดหน้าตา
  html: '<span><b>🍲</b></span>', // span = ตัวหยดน้ำ (หมุน 45°), b = อีโมจิ (หมุนกลับให้ตั้งตรง)
  iconSize: [34, 42], // ขนาดหมุด (กว้าง, สูง) หน่วย px
  iconAnchor: [17, 42], // จุดที่ปักลงพิกัด = กึ่งกลางด้านล่าง (ปลายหยดน้ำ)
  popupAnchor: [0, -38], // popup เปิดเหนือหมุด
});

// สร้างแผนที่ใน element ที่มี id = el
export function initMap(el) {
  map = L.map(el, { zoomControl: false }) // ปิดปุ่มซูมตำแหน่งเดิม (มุมซ้ายบน)
    .setView([DEFAULT_VIEW.lat, DEFAULT_VIEW.lng], DEFAULT_VIEW.zoom); // ตั้งจุดกลางและระดับซูมเริ่มต้น
  L.control.zoom({ position: 'bottomright' }).addTo(map); // ปุ่ม + / − ย้ายไปมุมขวาล่าง
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { // ภาพแผนที่จาก OpenStreetMap
    maxZoom: 19, // ซูมได้ลึกสุดระดับ 19
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', // เครดิตที่ OSM กำหนดให้แสดง
  }).addTo(map); // ใส่ภาพแผนที่ลงไป

  const count = L.control({ position: 'topright' }); // ป้ายจำนวนสาขา มุมขวาบน
  count.onAdd = () => (countEl = L.DomUtil.create('div', 'count')); // สร้าง <div class="count"> ตอนใส่ลงแผนที่ แล้วจำไว้
  count.addTo(map); // ใส่ป้ายลงแผนที่
  map.on('moveend', updateCount); // เลื่อน/ซูมเสร็จ → นับใหม่ว่าเห็นกี่สาขาบนจอ

  // กาง/หุบรีวิว (<details>) แล้ว popup สูงขึ้น → เลื่อนแผนที่ให้ popup อยู่ในจอ
  // ponytail: ใช้ _adjustPan (private, Leaflet 1.9.4) เพราะ popup.update() จะ render ใหม่แล้ว details หุบเอง
  document.addEventListener('toggle', e => { // ดัก event กาง/หุบ <details> ทั้งหน้า
    if (e.target.closest?.('.leaflet-popup')) map._popup?._adjustPan(); // ถ้าอยู่ใน popup → ขยับแผนที่ให้ popup พอดีจอ
  }, true); // true = capture (event toggle ไม่ไหลขึ้นไปหา document เอง ต้องดักขาลง)
}

// อัปเดตป้ายมุมขวาบน: จำนวนสาขาทั้งหมด + ที่เห็นบนจอตอนนี้
function updateCount() {
  if (!all.length) return; // ยังไม่มีหมุด (ข้อมูลยังไม่โหลด) → ไม่ต้องทำ
  const view = map.getBounds(); // ขอบเขตแผนที่ที่เห็นบนจอ
  const seen = all.filter(m => view.contains(m.getLatLng())).length; // นับหมุดที่อยู่ในขอบเขตนั้น
  countEl.innerHTML = `<b>${all.length}</b> สาขา<small>บนจอตอนนี้ ${seen}</small>`; // แสดงผล (มีแต่ตัวเลข ไม่ต้อง escape)
}

// ปักหมุดสาขา b; popup = ฟังก์ชันสร้าง HTML ของ popup, onOpen = เรียกตอนเปิด popup
// popup เป็นฟังก์ชัน เพื่อให้สร้างใหม่ทุกครั้งที่เปิด (ลิงก์นำทางเปลี่ยนตามตำแหน่งผู้ใช้)
// ความสูงสูงสุดคุมด้วย CSS (.leaflet-popup-content) ไม่ใช้ option maxHeight เพราะ Leaflet เช็กแค่ตอนเปิด
export function addBranch(b, popup, onOpen) {
  const m = L.marker([b.lat, b.lng], { icon, title: b.name, alt: b.name }) // หมุดที่พิกัดสาขา (title = ข้อความตอนชี้เมาส์)
    .addTo(map) // ใส่ลงแผนที่
    .bindPopup(popup, { minWidth: 280, maxWidth: 330, autoPanPadding: [16, 16] }) // ผูก popup กว้าง 280–330px เลื่อนให้ห่างขอบจอ 16px
    .on('popupopen', () => { // ตอนเปิด popup
      m.getElement()?.classList.add('on'); // ไฮไลต์หมุด (CSS .pin.on)
      m.setZIndexOffset(1000); // ยกหมุดนี้ขึ้นบนสุด ไม่ให้หมุดอื่นบัง
      onOpen(); // แจ้ง main.js ให้ไฮไลต์การ์ดในรายการ
    })
    .on('popupclose', () => { // ตอนปิด popup
      m.getElement()?.classList.remove('on'); // เลิกไฮไลต์หมุด
      m.setZIndexOffset(0); // คืนลำดับชั้นปกติ
    });
  all.push(m); // เก็บไว้ในรายการหมุดทั้งหมด
  return m; // ส่งหมุดกลับให้ main.js ใช้ตอนกดการ์ด
}

// ซูมให้เห็นทุกสาขา แล้วอัปเดตป้ายจำนวน
export function fitAll() {
  if (all.length) map.fitBounds(L.featureGroup(all).getBounds().pad(0.1)); // กรอบที่ครอบทุกหมุด + เผื่อขอบ 10%
  updateCount(); // นับใหม่หลังซูม
}

// ปักจุดตำแหน่งผู้ใช้ แล้วซูมให้เห็นทั้งผู้ใช้และสาขาที่ใกล้สุด
export function showMe(me, label, nearest) {
  if (meMarker) meMarker.remove(); // ลบจุดเก่าก่อน (กรณีค้นหาหลายรอบ)
  meMarker = L.circleMarker([me.lat, me.lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#1565c0', fillOpacity: 1 }) // วงกลมฟ้าขอบขาว
    .addTo(map) // ใส่ลงแผนที่
    .bindPopup(label); // กดแล้วขึ้นชื่อสถานที่ (label ถูก escape มาจาก main.js แล้ว)
  const points = [[me.lat, me.lng], ...nearest.map(b => [b.lat, b.lng])]; // พิกัดผู้ใช้ + สาขาใกล้สุด
  map.fitBounds(L.latLngBounds(points).pad(0.2)); // ซูมให้เห็นทุกจุด + เผื่อขอบ 20%
}

// ซูมไปที่สาขา b แล้วเปิด popup (ใช้ตอนกดการ์ดในรายการ)
export function focus(b, marker) {
  map.setView([b.lat, b.lng], 15); // ซูมระดับถนน
  marker.openPopup(); // เปิดรายละเอียดสาขา
}
