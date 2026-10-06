// v3.16 xuất Excel theo kỳ (lib/kl/ky.js): tuần ISO, khoảng kỳ, phân loại việc theo kỳ, bảng tổng hợp theo phòng / đơn vị.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tuanIso, khoangKyChon, phanLoaiTheoKy, tongHopTheoKy, moCuoiKy, quaHanCuoiKy } from '../src/lib/kl/ky.js';

test('tuanIso: ISO 8601 (tuần bắt đầu thứ Hai; đầu/cuối năm thuộc tuần của năm kề)', () => {
  assert.deepEqual(tuanIso('2026-10-06'), { nam: 2026, tuan: 41 });
  assert.deepEqual(tuanIso('2026-01-01'), { nam: 2026, tuan: 1 });     // thứ Năm → tuần 1/2026
  assert.deepEqual(tuanIso('2027-01-01'), { nam: 2026, tuan: 53 });    // thứ Sáu → vẫn tuần 53 của 2026
  assert.deepEqual(tuanIso('2024-12-30'), { nam: 2025, tuan: 1 });     // thứ Hai → tuần 1/2025
});

test('khoangKyChon: tuần theo một ngày bất kỳ (T2–CN), tháng, quý, năm; nhãn và mã tệp', () => {
  assert.deepEqual(khoangKyChon({ ky: 'tuan', ngay: '2026-10-06' }), { ky: 'tuan', tu: '2026-10-05', den: '2026-10-11', ten: 'Tuần 41/2026 (5/10/2026 – 11/10/2026)', ma: 'tuan-2026-41' });
  assert.equal(khoangKyChon({ ky: 'tuan', ngay: '2026-10-11' }).tu, '2026-10-05');   // Chủ nhật vẫn cùng tuần
  assert.deepEqual(khoangKyChon({ ky: 'thang', nam: '2026', thang: '2' }), { ky: 'thang', tu: '2026-02-01', den: '2026-02-28', ten: 'Tháng 2/2026', ma: 'thang-2026-02' });
  assert.deepEqual(khoangKyChon({ ky: 'quy', nam: 2026, quy: 4 }), { ky: 'quy', tu: '2026-10-01', den: '2026-12-31', ten: 'Quý IV/2026', ma: 'quy-2026-4' });
  assert.deepEqual(khoangKyChon({ ky: 'nam', nam: '2025' }), { ky: 'nam', tu: '2025-01-01', den: '2025-12-31', ten: 'Năm 2025', ma: 'nam-2025' });
});

const viec = (ma, o = {}) => ({ ma, owner_trong_van_phong: true, owner_phong: 'TONG_HOP', nhom_dem: 'DANG_THUC_HIEN', ...o });
const K = khoangKyChon({ ky: 'thang', nam: 2026, thang: 10 });
const ROWS = [
  viec('NV-1', { ngay_nhan_van_ban: '2026-10-03', han_xu_ly: '2026-10-20' }),                                                   // giao + đến hạn, còn mở
  viec('NV-2', { ngay_ban_hanh: '2026-09-20', han_xu_ly: '2026-10-05', nhom_dem: 'HOAN_THANH', ngay_hoan_thanh: '2026-10-04', ket_qua: 'DUNG_HAN' }),  // xong đúng hạn trong kỳ
  viec('NV-3', { ngay_nhan_van_ban: '2026-09-01', han_xu_ly: '2026-09-25', nhom_dem: 'HOAN_THANH', ngay_hoan_thanh: '2026-11-02', ket_qua: 'TRE', owner_phong: 'HC_LT' }),  // xong SAU kỳ → còn mở cuối kỳ, quá hạn
  viec('NV-4', { created_at: '2026-10-28T03:00:00Z', han_xu_ly: '2026-11-15', owner_phong: 'HC_LT' }),                        // giao theo created_at, còn mở, chưa quá hạn
  viec('NV-5', { ngay_nhan_van_ban: '2026-11-01', han_xu_ly: '2026-11-10' }),                                                   // ngoài kỳ
  viec('NV-6', { ngay_nhan_van_ban: '2026-08-01', han_xu_ly: '2026-10-15', owner_trong_van_phong: false, owner_don_vi_ten: '3. Ban Tổ chức', owner_phong: null }), // đơn vị ngoài: đến hạn, mở, quá hạn
];

test('phanLoaiTheoKy: bốn danh sách, xếp theo mã; mở / quá hạn cuối kỳ', () => {
  const pl = phanLoaiTheoKy(ROWS, K);
  assert.deepEqual(pl.giao.map((r) => r.ma), ['NV-1', 'NV-4']);
  assert.deepEqual(pl.xong.map((r) => r.ma), ['NV-2']);
  assert.deepEqual(pl.denHan.map((r) => r.ma), ['NV-1', 'NV-2', 'NV-6']);
  assert.deepEqual(pl.mo.map((r) => r.ma), ['NV-1', 'NV-3', 'NV-4', 'NV-6']);
  assert.equal(moCuoiKy(ROWS[4], K), false);                 // giao sau kỳ
  assert.equal(quaHanCuoiKy(ROWS[0], K), true);              // hạn 20/10 < 31/10 và còn mở
  assert.equal(quaHanCuoiKy(ROWS[3], K), false);             // hạn 15/11
});

test('tongHopTheoKy: theo phòng / đơn vị + Tổng cộng', () => {
  const th = tongHopTheoKy(ROWS, K);
  assert.deepEqual(th.cot, ['Phòng / đơn vị', 'Giao trong kỳ', 'Hoàn thành trong kỳ', 'Trong đó đúng hạn', 'Trong đó trễ hạn', 'Đến hạn trong kỳ', 'Còn mở cuối kỳ', 'Trong đó quá hạn']);
  const theoTen = Object.fromEntries(th.dong.map((d) => [d[0], d.slice(1)]));
  assert.deepEqual(theoTen['Phòng Tổng hợp'], [1, 1, 1, 0, 2, 1, 1]);
  assert.deepEqual(theoTen['Phòng Hành chính - Lưu trữ'], [1, 0, 0, 0, 0, 2, 1]);
  assert.deepEqual(theoTen['Ban Tổ chức'], [0, 0, 0, 0, 1, 1, 1]);
  assert.deepEqual(theoTen['Tổng cộng'], [2, 1, 1, 0, 3, 4, 3]);
  assert.equal(th.dong[th.dong.length - 1][0], 'Tổng cộng');
});
