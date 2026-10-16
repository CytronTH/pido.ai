export const nodeSimulators = {
  logicNode: { type: 'boolean-slider' },
  digitalInputNode: { type: 'boolean-toggle' },
  digitalOutputNode: { type: 'boolean-toggle' },
  ledNode: { type: 'boolean-toggle' },
  buzzerNode: { type: 'boolean-toggle' },
  rs485Node: { type: 'boolean-toggle' },
  dashboardMetricNode: { type: 'number-input' },
  dashboardTextNode: { type: 'text-input' },
  dashboardLogNode: { type: 'text-input' },
  counterNode: { type: 'number-slider' },
  flowCounterNode: { type: 'number-input' },
  forkliftZoneNode: { type: 'number-slider' },
  snapshotNode: { type: 'boolean-toggle' },
};

export const nodeUseCases = {
  inputNode: [{ title: 'ดึงภาพจากกล้องวงจรปิด', description: 'เชื่อมต่อกล้อง IP Camera ผ่าน RTSP เพื่อดึงภาพสด', videoUrl: 'REQUEST_VIDEO_URL' }],
  aiNode: [{ title: 'ตรวจจับคนบุกรุก', description: 'ใช้ AI โมเดลเพื่อหาตำแหน่งคนในภาพวิดีโอ', videoUrl: 'REQUEST_VIDEO_URL' }],
  logicNode: [
    { title: 'ตรวจจับคนบุกรุก (Presence Detection)', description: 'ตรวจสอบว่าพบคนในกล้องหรือไม่ (has("person")) พร้อมตั้ง Debounce 300ms เพื่อส่งสัญญาณแจ้งเตือน ไซเรน หรือเปิดไฟสปอตไลท์', videoUrl: 'REQUEST_VIDEO_URL' },
    { title: 'ตรวจจับความแออัดคนเกิน 5 คน (Capacity Monitoring)', description: 'นับจำนวนคนในเฟรมว่าเกินพิกัดหรือไม่ (label_count("person") >= 5) เพื่อสั่งให้ระบบนับยอดหรือแจ้งเตือนเจ้าหน้าที่คุมพื้นที่', videoUrl: 'REQUEST_VIDEO_URL' },
    { title: 'ตรวจจับความปลอดภัยร่วม (Co-occurrence Safety)', description: 'แจ้งเตือนทันทีเมื่อตรวจพบคนและรถยนต์/โฟล์คลิฟท์อยู่ในพื้นที่เดียวกันพร้อมกัน (has("person") and has("car")) เพื่อป้องกันอุบัติเหตุ', videoUrl: 'REQUEST_VIDEO_URL' },
    { title: 'กรองความแม่นยำสูง (High Confidence Filter)', description: 'คัดกรองเฉพาะผลตรวจจับที่ AI มั่นใจเกิน 80% ขึ้นไป เพื่อลด False Positive ก่อนสั่งบันทึกภาพ Snapshot หรือส่ง LINE', videoUrl: 'REQUEST_VIDEO_URL' },
    { title: 'ตรวจจับสิ่งผิดปกติ (Absence Detection)', description: 'ตรวจจับยานพาหนะหรือเครื่องจักรที่เปิดทำงานทิ้งไว้โดยไม่มีเจ้าหน้าที่คุม (has("car") and not has("person")) ต่อเนื่องเกิน 1 วินาที', videoUrl: 'REQUEST_VIDEO_URL' }
  ],
  actionNode: [{ title: 'ส่งข้อความ LINE Notify', description: 'ส่งรูปและข้อความแจ้งเตือนเข้ากลุ่ม LINE', videoUrl: 'REQUEST_VIDEO_URL' }],
  digitalInputNode: [{ title: 'สวิตช์เซ็นเซอร์ประตู (GPIO 17)', description: 'รับสัญญาณจากแม่เหล็กประตูหรือสวิตช์ปุ่มกดต่อลง GND', videoUrl: 'REQUEST_VIDEO_URL' }],
  digitalOutputNode: [{ title: 'สั่งการรีเลย์เปิดประตู (GPIO 23)', description: 'สั่งจ่ายสัญญาณ Active LOW/HIGH ให้บอร์ดรีเลย์แยกภายนอก', videoUrl: 'REQUEST_VIDEO_URL' }],
  ledNode: [{ title: 'ไฟเตือนสถานะหรี่แสง (Hardware PWM)', description: 'ปรับความสว่างไฟ LED สว่าง 0-100% ผ่านพิน Hardware PWM ของ RP1', videoUrl: 'REQUEST_VIDEO_URL' }],
  buzzerNode: [{ title: 'เสียงเตือนภัย (External Buzzer)', description: 'ส่งเสียงเตือนปี๊บตามระยะเวลาที่กำหนดแล้วตัดเสียงอัตโนมัติเมื่อตรวจพบผู้บุกรุก', videoUrl: 'REQUEST_VIDEO_URL' }],
  rs485Node: [{ title: 'สั่งงาน PLC ผ่าน USB-to-RS485', description: 'ส่งคำสั่ง Modbus RTU ผ่านพอร์ต /dev/ttyUSB0 ไปควบคุมเครื่องจักร', videoUrl: 'REQUEST_VIDEO_URL' }],
  dashboardVideoNode: [{ title: 'แสดงภาพสด', description: 'ดูกล้องวงจรปิดพร้อมกรอบ AI (Bounding Box) บนหน้าเว็บ', videoUrl: 'REQUEST_VIDEO_URL' }],
  dashboardMetricNode: [{ title: 'แสดงจำนวนคนสุทธิ', description: 'แสดงตัวเลขขนาดใหญ่บน Dashboard เช่น จำนวนคนในร้าน', videoUrl: 'REQUEST_VIDEO_URL' }],
  dashboardTextNode: [{ title: 'แสดงสถานะเครื่องจักร', description: 'แสดงข้อความ "ทำงานปกติ" หรือ "เครื่องหยุด"', videoUrl: 'REQUEST_VIDEO_URL' }],
  dashboardLogNode: [{ title: 'ประวัติคนเข้าออก', description: 'แสดงรายการบันทึกเวลาคนเข้าออกแบบเรียงลำดับ', videoUrl: 'REQUEST_VIDEO_URL' }],
  debugNode: [{ title: 'ตรวจสอบข้อมูลดิบ', description: 'ดูข้อมูล JSON ที่ไหลผ่านระหว่างโหนดเพื่อใช้ตรวจสอบบั๊ก', videoUrl: 'REQUEST_VIDEO_URL' }],
  counterNode: [{ title: 'นับยอดของเสียสะสม (NG Counter)', description: 'นับสะสมจำนวนครั้งที่เงื่อนไขจาก Logic Node ตรวจพบของเสีย หรือนับรอบการเกิดสัญญาณเตือน', videoUrl: 'REQUEST_VIDEO_URL' }],
  flowCounterNode: [{ title: 'นับคนหรือวัตถุข้ามเส้นเข้า-ออก', description: 'ติดตามการเคลื่อนที่ของวัตถุและลากเส้นหน้าประตูหรือบนสายพานเพื่อนับจำนวนแบบไม่นับซ้ำ', videoUrl: 'REQUEST_VIDEO_URL' }],
  shelfSlotMonitorNode: [{ title: 'ตรวจจับของขาดชั้นวาง', description: 'ตรวจสอบว่าช่องไหนบนชั้นวางว่างอยู่บ้าง เพื่อแจ้งพนักงานเติมของ', videoUrl: 'REQUEST_VIDEO_URL' }],
  forkliftZoneNode: [{ title: 'แจ้งเตือนโฟล์คลิฟท์ใกล้คน', description: 'เมื่อรถโฟล์คลิฟท์ขับเข้าใกล้พนักงานในรัศมี 3 เมตร จะสั่งให้รถหยุดหรือส่งเสียงเตือน', videoUrl: 'REQUEST_VIDEO_URL' }],
  snapshotNode: [{ title: 'ถ่ายภาพทะเบียนรถ', description: 'บันทึกภาพนิ่งเมื่อมีรถขับผ่านเกตเวย์เพื่อเก็บเป็นหลักฐาน', videoUrl: 'REQUEST_VIDEO_URL' }],
  commentNode: [
    { title: 'บันทึกคำอธิบายขั้นตอนการทำงาน', description: 'เขียนโน้ตสรุปการทำงานของ Pipeline เช่น ตำแหน่งติดตั้งกล้อง พินเชื่อมต่อ หรือขั้นตอนการตรวจจับ', videoUrl: 'REQUEST_VIDEO_URL' },
    { title: 'ทำป้ายหัวข้อแบ่งหมวดหมู่ (Section Banner)', description: 'ใช้แบ่งพื้นที่บน Canvas ออกเป็นส่วนๆ เช่น ขั้นตอนดึงภาพ, ขั้นตอนกรอง AI, และขั้นตอนแจ้งเตือน', videoUrl: 'REQUEST_VIDEO_URL' }
  ]
};
