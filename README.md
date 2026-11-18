# teenoi-web

เว็บหาสาขาสุกี้ตี๋น้อยใกล้ตัว พร้อมผลวิเคราะห์รีวิว 5 ด้าน (แผนที่ OpenStreetMap + Leaflet, static ล้วน ไม่มี build)

```
index.html          โครงหน้า
css/style.css       หน้าตา
js/config.js        ค่าคงที่ (path ข้อมูล, จุดเริ่มแผนที่, จำนวนสาขาที่แสดง, สีตาม label)
js/geo.js           ระยะทาง, GPS, ค้นที่อยู่ (Nominatim), ลิงก์นำทาง Google Maps
js/map.js           แผนที่ Leaflet และหมุด
js/ui.js            รายการสาขา, popup, ข้อความสถานะ
js/main.js          จุดเริ่ม: โหลดข้อมูลและผูก event
output/             ไฟล์จาก teenoi-predict (เว็บใช้แค่ branch_summary.json)
```

## รันในเครื่อง
```
python -m http.server 8000
```
เปิด http://localhost:8000 (ดับเบิลคลิกเปิดไฟล์ตรงๆ ไม่ได้ เพราะ ES module และ fetch ใช้กับ `file://` ไม่ได้)

## Deploy (Vercel)
```
vercel login
vercel --prod
```
Framework เลือก **Other**, build command เว้นว่าง

## อัปเดตข้อมูล
รัน teenoi-predict ใหม่ → คัดลอก `branch_summary.json` ทับ `output/` → `vercel --prod`
