// Đợt D v3.20: gợi ý số hiệu, ngày, trích yếu từ chữ trang đầu văn bản / tên tệp; tên tệp an toàn cho kho tệp; kiểm loại, cỡ tệp.
// Văn bản hư cấu. Chạy `npm test` trong frontend/ (node:test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tachSoHieu, tachNgay, tachTrichYeu, doanTuChu, doanTuTenTep } from '../src/lib/kl/doc-van-ban.js';
import { tenAnToan, loiTep, kieuTep } from '../src/lib/kl/tep-ten.js';

const BAO_CAO = `ĐẢNG BỘ TỈNH CAO BẰNG
TỈNH ỦY
*
Số 15-BC/VPTU
ĐẢNG CỘNG SẢN VIỆT NAM
Cao Bằng, ngày 05 tháng 10 năm 2026
BÁO CÁO
kết quả rà soát hồ sơ lưu trữ
quý III năm 2026
-----
Thực hiện Kế hoạch số 01-KH/VPTU…`;

test('số hiệu: "Số 15-BC/VPTU", "Số: 1400-CV/VPTU", "So 12/BC-VPTU"; không có → rỗng', () => {
  assert.equal(tachSoHieu(BAO_CAO), '15-BC/VPTU');
  assert.equal(tachSoHieu('Số: 1400 - CV/VPTU V/v xây dựng phần mềm'), '1400-CV/VPTU');
  assert.equal(tachSoHieu('So 12/BC-VPTU'), '12/BC-VPTU');
  assert.equal(tachSoHieu('Điện thoại 0206-3852 123'), '');
});

test('ngày: "ngày 05 tháng 10 năm 2026" → 2026-10-05; không dấu cũng nhận; ngày không có thật → rỗng', () => {
  assert.equal(tachNgay(BAO_CAO), '2026-10-05');
  assert.equal(tachNgay('Cao Bang, ngay 7 thang 9 nam 2026'), '2026-09-07');
  assert.equal(tachNgay('ngày 31 tháng 02 năm 2026'), '');
  assert.equal(tachNgay('không có ngày'), '');
});

test('trích yếu: tên loại viết hoa + dòng sau (dừng ở gạch / "Thực hiện"); công văn lấy dòng V/v', () => {
  assert.equal(tachTrichYeu(BAO_CAO), 'Báo cáo kết quả rà soát hồ sơ lưu trữ quý III năm 2026');
  assert.equal(tachTrichYeu('Số 03-CV/VPTU\nV/v đôn đốc báo cáo số liệu\nKính gửi: …'), 'Đôn đốc báo cáo số liệu');
  assert.equal(tachTrichYeu('Không có tên loại'), '');
  assert.deepEqual(doanTuChu(BAO_CAO), { so_hieu: '15-BC/VPTU', ngay_van_ban: '2026-10-05', trich_yeu: 'Báo cáo kết quả rà soát hồ sơ lưu trữ quý III năm 2026' });
});

test('tên tệp: "15-BC-VPTU.pdf", "BC_15.docx", V-Office "<năm>-<loại>-<số>" — không lấy năm làm số', () => {
  assert.equal(doanTuTenTep('15-BC-VPTU.pdf').so_hieu, '15-BC/VPTU');
  assert.equal(doanTuTenTep('Bao cao 07 TTr.pdf').so_hieu, '7-TTr');
  assert.equal(doanTuTenTep('BC_15.docx').so_hieu, '15-BC');
  assert.equal(doanTuTenTep('A14_01-VBNB_2026-CV-1400-2026_daky.pdf').so_hieu, '1400-CV');
  assert.equal(doanTuTenTep('anh-chup-man-hinh.png').so_hieu, '');
});

test('tên tệp an toàn: bỏ dấu, ký tự lạ → gạch, giữ đuôi; kiểu tệp theo đuôi khi trình duyệt không báo', () => {
  assert.equal(tenAnToan('Báo cáo số 15 (bản ký).pdf'), 'Bao-cao-so-15-ban-ky.pdf');
  assert.equal(tenAnToan('Đề án.docx'), 'De-an.docx');
  assert.equal(kieuTep({ name: 'x.DOC', type: '' }), 'application/msword');
  assert.equal(kieuTep({ name: 'x.pdf', type: 'application/pdf' }), 'application/pdf');
  assert.equal(loiTep({ name: 'a.pdf', type: 'application/pdf', size: 11 * 1024 * 1024 }), 'Tệp vượt 10 MB — chọn tệp nhỏ hơn hoặc nén lại.');
  assert.equal(loiTep({ name: 'a.exe', type: 'application/x-msdownload', size: 10 }), 'Chỉ nhận tệp PDF, Word, Excel hoặc ảnh (JPG, PNG).');
  assert.equal(loiTep({ name: 'a.xlsx', type: '', size: 10 }), null);
});
