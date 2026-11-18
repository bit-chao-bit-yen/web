// ===== เรื่องตำแหน่ง: ระยะทาง, GPS, ค้นหาที่อยู่, ลิงก์นำทาง =====

const RAD = Math.PI / 180; // ตัวคูณแปลงองศาเป็นเรเดียน
const EARTH_DIAMETER_KM = 12742; // เส้นผ่านศูนย์กลางโลก (กม.) = 2 × รัศมี 6,371

// ระยะทาง (กม.) ระหว่างจุด a กับ b ({ lat, lng }) ด้วยสูตร Haversine (คิดความโค้งของโลกแล้ว)
export function km(a, b) {
  const dLat = (b.lat - a.lat) * RAD; // ผลต่างละติจูด (เรเดียน)
  const dLng = (b.lng - a.lng) * RAD; // ผลต่างลองจิจูด (เรเดียน)
  const h = Math.sin(dLat / 2) ** 2 // ส่วนของละติจูด
    + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2; // ส่วนของลองจิจูด (ยิ่งใกล้ขั้วโลก ยิ่งแคบ)
  return EARTH_DIAMETER_KM * Math.asin(Math.sqrt(h)); // แปลงเป็นระยะทางจริงบนผิวโลก
}

// ขอตำแหน่งจาก GPS ของเบราว์เซอร์ (ใช้ได้เฉพาะ HTTPS หรือ localhost)
export function myLocation() {
  return new Promise((resolve, reject) => { // ห่อเป็น Promise ให้เรียกด้วย await ได้
    if (!navigator.geolocation) return reject(new Error('เบราว์เซอร์นี้ไม่รองรับการหาตำแหน่ง')); // เบราว์เซอร์เก่าไม่มี API นี้
    navigator.geolocation.getCurrentPosition( // ขอตำแหน่งปัจจุบัน (เบราว์เซอร์จะถามผู้ใช้ก่อน)
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), // สำเร็จ → ส่งพิกัดกลับ
      () => reject(new Error('หาตำแหน่งไม่ได้ (ไม่ได้อนุญาต?) ลองพิมพ์ที่อยู่แทน')), // ไม่อนุญาต / หาไม่เจอ / หมดเวลา
      { enableHighAccuracy: true, timeout: 10000 }); // ขอความแม่นยำสูง รอไม่เกิน 10 วินาที
  });
}

// ponytail: Nominatim จำกัด 1 req/วินาที เลยเรียกเฉพาะตอนกดค้นหา; ถ้าคนใช้เยอะค่อยย้ายไป geocoder แบบเสียเงิน
let lastSearch = 0; // เวลาที่ค้นหาครั้งล่าสุด (มิลลิวินาที) ไว้กันค้นถี่เกิน

// แปลงข้อความที่อยู่ → พิกัด ด้วย Nominatim (บริการค้นหาฟรีของ OpenStreetMap)
export async function geocode(q) {
  if (Date.now() - lastSearch < 1100) throw new Error('ค้นหาถี่เกินไป รอสักครู่'); // ห่างจากครั้งก่อนไม่ถึง 1.1 วินาที → ไม่ยิง
  lastSearch = Date.now(); // จำเวลาของครั้งนี้
  const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=th&accept-language=th&q=' // ขอผลเดียว เฉพาะในไทย ชื่อภาษาไทย
    + encodeURIComponent(q); // ต่อคำค้น (encode กันอักขระพิเศษทำ URL พัง)
  let hit; // ผลลัพธ์อันดับแรก
  try { [hit] = await (await fetch(url)).json(); } // เรียก API → แปลง JSON → เอาตัวแรกของ array
  catch { throw new Error('เชื่อมต่อบริการค้นหาไม่ได้ ลองใหม่อีกครั้ง'); } // เน็ตหลุด / บริการล่ม
  if (!hit) throw new Error('ไม่พบที่อยู่นี้ ลองพิมพ์ชื่อเขต/จังหวัดเพิ่ม'); // ค้นแล้วไม่เจอ
  return { lat: +hit.lat, lng: +hit.lon, label: hit.display_name }; // พิกัด (แปลงข้อความเป็นตัวเลขด้วย +) + ชื่อเต็มของสถานที่
}

// ลิงก์นำทาง Google Maps (คนไทยใช้เยอะสุด)
export function navLink(to, from) {
  return `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}` // ปลายทาง = สาขา
    + (from ? `&origin=${from.lat},${from.lng}` : ''); // รู้ตำแหน่งผู้ใช้ → ใส่เป็นจุดเริ่ม, ไม่รู้ → Google ใช้ตำแหน่งเครื่องเอง
}
