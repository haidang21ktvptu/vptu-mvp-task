# Cắt vùng cần thiết của ảnh chụp màn hình (1536px) để chữ trong tài liệu to, dễ đọc → tệp cùng tên với hậu tố -cat.
# Chạy: python3 cat.py [ten-anh ...] (không tham số = cắt mọi ảnh có trong bảng CAT và có tệp gốc trong anh/).
import sys, json
from PIL import Image
CAT = {
  'chung-02-banh-rang': (1080, 0, 1536, 682),
  'chung-03-chuong': (770, 0, 1536, 560),
  'chung-06-doi-mat-khau': (520, 30, 1016, 640),
  'qt-07-tao-tai-khoan': (515, 10, 1005, 730),
  'nx-07-ket-qua-lo': (240, 90, 1536, 560),
  'nx-09-hoan-tac': (240, 190, 1536, 600),
  'nx-08-cho-hoan-thien': (240, 90, 1536, 480),
  'chung-03-chuong': (840, 0, 1536, 545),
  'chung-08-tim-nhanh': (890, 0, 1536, 200),
  'a3-02-the-viec': (268, 285, 1135, 545),
  'a3-06-tu-choi': (268, 425, 1135, 600),
  'a3-07-de-nghi-sua': (440, 140, 1082, 540),
  'a3-04-cap-nhat-tien-do': (440, 90, 1082, 595),
  'a3-05-nop-minh-chung': (268, 70, 1135, 390),
  'a3-05b-nop-minh-chung-dien': (268, 430, 1135, 680),
  'a3-05c-da-nop': (268, 430, 1135, 560),
  'a3-10-dien-bien': (268, 160, 1135, 560),
  'a3-03-dang-thuc-hien': (268, 230, 1135, 620),
  'nx-10-hoan-thien-form': (240, 90, 1536, 682),
  'a2-02-can-xu-ly': (268, 90, 1536, 590),
  'a2-02b-viec-do': (268, 90, 1536, 682),
  'a2-04-nghiem-thu': (268, 120, 1135, 620),
  'a2-09-duyet-de-nghi-sua': (268, 310, 1536, 545),
  'a2-10-ngan-chi-tiet': (962, 0, 1536, 682),
  'a2-05-nhiem-vu-phong': (268, 90, 1536, 682),
  'a2-06-can-bo': (268, 90, 1536, 682),
  'a1-02-can-xu-ly': (268, 90, 1536, 682),
  'a1-02b-nghen': (268, 0, 1536, 620),
  'a1-05-theo-van-ban': (268, 90, 1536, 682),
  'a1-07-bao-cao': (268, 90, 1536, 682),
  'a1-01b-tong-quan-phong': (268, 260, 1536, 682),
  'a0-02-can-xu-ly': (268, 90, 1536, 682),
  'a0-02b-chi-dao-the': (584, 20, 1500, 320),
  'a0-04-chi-dao-da-gui': (268, 90, 1536, 300),
  'a0-03b-giao-viec-khoi-2': (268, 250, 1135, 620),
}
if len(sys.argv) > 1: CAT = {k: v for k, v in CAT.items() if k in sys.argv[1:]}
import os
for ten, box in CAT.items():
    if not os.path.exists(f'anh/{ten}.jpg'): continue
    im = Image.open(f'anh/{ten}.jpg')
    w, h = im.size
    x0, y0, x1, y1 = box
    im.crop((x0, y0, min(x1, w), min(y1, h))).save(f'anh/{ten}-cat.jpg', quality=90)
    print(ten, im.size, '->', (min(x1, w) - x0, min(y1, h) - y0))
