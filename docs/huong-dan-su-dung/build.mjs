// Dựng "Hướng dẫn sử dụng" (.docx). Chạy: node build.mjs [--trang trang.json]  → HDSD-VPTU-TASK.docx
// Hai lượt: lượt 1 mục lục chưa có số trang → đổi PDF, đọc số trang từng tiêu đề (trang.json) → lượt 2 điền số trang.
import fs from 'node:fs';
import { taiLieu, h1, h2, h3, p, pCenter, steps, bullets, anh, luuY, bang, ngatTrang, khoangTrong, thieuAnh, mucLucTinh, NAVY } from './lib.mjs';
import { noiDung } from './noi-dung.mjs';

const A = (f) => `${import.meta.dirname}/anh/${f}`;
const trangArg = process.argv.indexOf('--trang');
const soTrang = trangArg > 0 ? JSON.parse(fs.readFileSync(process.argv[trangArg + 1], 'utf8')) : {};

const PHIEN_BAN = 'Phiên bản 3.17 · tháng 10/2026';
const TIEU_DE = 'Hướng dẫn sử dụng Hệ thống quản trị nhiệm vụ';

// Bìa
const bia = [
  khoangTrong(), khoangTrong(), khoangTrong(), khoangTrong(),
  pCenter('TỈNH ỦY CAO BẰNG', { bold: true, size: 28 }),
  pCenter('VĂN PHÒNG', { bold: true, size: 28 }),
  khoangTrong(), khoangTrong(), khoangTrong(), khoangTrong(), khoangTrong(),
  pCenter('HƯỚNG DẪN SỬ DỤNG', { bold: true, size: 48, color: NAVY }),
  pCenter('HỆ THỐNG QUẢN TRỊ NHIỆM VỤ', { bold: true, size: 40, color: NAVY }),
  khoangTrong(),
  pCenter('Dành cho cán bộ, công chức Văn phòng Tỉnh ủy', { italics: true, size: 26 }),
  pCenter('Giao việc – nhận việc – nộp kết quả – nghiệm thu, theo từng vai trò', { italics: true, size: 26 }),
  khoangTrong(), khoangTrong(), khoangTrong(), khoangTrong(), khoangTrong(), khoangTrong(), khoangTrong(), khoangTrong(),
  pCenter(PHIEN_BAN, { size: 24 }),
  pCenter('Địa chỉ truy cập: https://haidang21ktvptu.github.io/vptu-mvp-task/', { size: 24 }),
];

const { tieuDeMucLuc, phan } = noiDung({ A, anh, h1, h2, h3, p, steps, bullets, luuY, bang, khoangTrong });

const buf = await taiLieu({
  tieuDe: TIEU_DE, phienBan: 'v3.17',
  sections: [
    { children: bia },
    { children: [h1('Mục lục', { ngat: false }), ...mucLucTinh(tieuDeMucLuc, soTrang)] },
    { children: phan },
  ],
});
const out = `${import.meta.dirname}/HDSD-VPTU-TASK.docx`;
fs.writeFileSync(out, buf);
fs.writeFileSync(`${import.meta.dirname}/tieu-de.json`, JSON.stringify(tieuDeMucLuc, null, 1));
console.log('Đã ghi', out, Math.round(buf.length / 1024), 'KB');
if (thieuAnh.length) console.log('THIẾU ẢNH:', thieuAnh.join(', '));
