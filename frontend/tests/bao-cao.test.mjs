// v3.29 (chủ dự án 22/10/2026): Báo cáo theo phòng chuyên môn, theo chuyên viên — sáu cột cộng đủ tổng, xếp mức như Tổng quan, bỏ cột chất lượng.
// Dữ liệu hư cấu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cotBaoCao, cotCua, demCot, locBaoCao, phongCuaViec, theoPhongChuyenMon, theoChuyenVien, theoNguon, PHONG_CHUNG, PHONG_NGOAI } from '../src/lib/kl/bao-cao.js';
import { soLieuChinh, khoangKy } from '../src/lib/kl/tong-quan.js';

const v = (o) => ({ nhom_dem: 'DANG_THUC_HIEN', muc_canh_bao: 'XANH', owner_trong_van_phong: true, ...o });
const ROWS = [
  v({ id: 1, owner_tai_khoan: 'cv1', owner_tai_khoan_ten: 'Nông Văn A', owner_phong: 'TONG_HOP', muc_canh_bao: 'DO_DAC_BIET', nhom_dem: 'QUA_HAN', nguon_nhiem_vu_ma: 'KL', nguon_nhiem_vu_ten: 'Kết luận' }),
  v({ id: 2, owner_tai_khoan: 'cv1', owner_tai_khoan_ten: 'Nông Văn A', owner_phong: 'TONG_HOP', muc_canh_bao: 'DO', nhom_dem: 'QUA_HAN' }),
  v({ id: 3, owner_tai_khoan: 'cv2', owner_tai_khoan_ten: 'Bế Thị B', owner_phong: 'TONG_HOP', muc_canh_bao: 'VANG', nhom_dem: 'SAP_DEN_HAN' }),
  v({ id: 4, owner_tai_khoan: 'cv2', owner_tai_khoan_ten: 'Bế Thị B', owner_phong: 'TONG_HOP', muc_canh_bao: 'XANH', nhom_dem: 'SAP_DEN_HAN' }),   // còn 6 ngày: đang thực hiện
  v({ id: 5, owner_phong: 'TONG_HOP', muc_canh_bao: 'KHONG_AP_DUNG', nhom_dem: 'THUONG_XUYEN' }),   // phòng chưa giao cán bộ, thường xuyên
  v({ id: 6, owner_tai_khoan: 'cv3', owner_tai_khoan_ten: 'Hoàng Văn C', owner_phong: 'QUAN_TRI', nhom_dem: 'HOAN_THANH', tien_do_hoan_thanh: 'TRUOC_HAN', ngay_hoan_thanh: '2026-03-01' }),
  v({ id: 7, owner_tai_khoan: 'cv3', owner_tai_khoan_ten: 'Hoàng Văn C', owner_phong: 'QUAN_TRI', nhom_dem: 'HOAN_THANH', tien_do_hoan_thanh: 'DUNG_HAN', ngay_hoan_thanh: '2026-03-02' }),
  v({ id: 8, owner_tai_khoan: 'cv3', owner_tai_khoan_ten: 'Hoàng Văn C', owner_phong: 'QUAN_TRI', nhom_dem: 'DANG_DINH_CHINH', muc_canh_bao: 'DO' }),   // đang tra soát
  v({ id: 9, owner_don_vi_ma: 'VAN_PHONG_TINH_UY', owner_phong: null }),
  v({ id: 10, owner_don_vi_ma: 'UBND', owner_phong: null, owner_trong_van_phong: false, muc_canh_bao: 'DO', nhom_dem: 'QUA_HAN' }),
  v({ id: 11, owner_tai_khoan: 'ld1', owner_tai_khoan_ten: 'Lãnh đạo D', owner_phong: null, owner_don_vi_ma: 'VAN_PHONG_TINH_UY', nhom_dem: 'CHO_NGHIEM_THU', muc_canh_bao: 'XANH' }),
];
const CTX = { phongCua: { cv1: 'TONG_HOP', cv2: 'TONG_HOP', cv3: 'QUAN_TRI', ld1: 'LANH_DAO_VAN_PHONG' },
  tenPhong: { LANH_DAO_VAN_PHONG: 'Lãnh đạo Văn phòng', TONG_HOP: 'Phòng Tổng hợp', HC_LT: 'Phòng Hành chính - Lưu trữ', QUAN_TRI: 'Phòng Quản trị' } };

test('Sáu cột: tên theo ngưỡng; mỗi việc vào đúng một cột; Tổng = quá hạn + sắp đến hạn + đang thực hiện + hoàn thành; trước hạn thuộc hoàn thành', () => {
  assert.deepEqual(cotBaoCao(3).map(([k]) => k), ['tong', 'qua', 'sap', 'dang', 'xong', 'truoc']);
  assert.equal(cotBaoCao(4)[2][1], 'Sắp đến hạn (còn ≤ 4 ngày)');
  assert.deepEqual(ROWS.map(cotCua), ['qua', 'qua', 'sap', 'dang', 'dang', 'xong', 'xong', 'dang', 'dang', 'qua', 'dang']);
  const d = demCot(ROWS);
  assert.deepEqual(d, { tong: 11, qua: 3, sap: 1, dang: 5, xong: 2, truoc: 1 });
  assert.equal(d.qua + d.sap + d.dang + d.xong, d.tong);
});

test('Khớp Tổng quan: quá hạn = Đỏ + Đỏ đặc biệt, sắp đến hạn = mức Vàng (đang tra soát không tính quá hạn)', () => {
  const s = soLieuChinh(ROWS, khoangKy('nam', '2026-10-22'));
  const d = demCot(ROWS);
  assert.equal(d.qua, s.mo.do + s.mo.ddb); assert.equal(d.sap, s.mo.vang);
});

test('Theo phòng chuyên môn: phòng của cán bộ chủ trì (danh bạ), không thì phòng của đơn vị; thứ tự danh bạ; ba dòng cuối', () => {
  assert.equal(phongCuaViec({ owner_tai_khoan: 'cv1', owner_phong: 'QUAN_TRI' }, CTX.phongCua), 'TONG_HOP', 'danh bạ trước');
  assert.equal(phongCuaViec(ROWS[8], CTX.phongCua), PHONG_CHUNG); assert.equal(phongCuaViec(ROWS[9], CTX.phongCua), PHONG_NGOAI);
  const p = theoPhongChuyenMon(ROWS, CTX);
  assert.deepEqual(p.map((x) => [x.ma, x.rows.length]), [['TONG_HOP', 5], ['QUAN_TRI', 3], ['LANH_DAO_VAN_PHONG', 1], [PHONG_CHUNG, 1], [PHONG_NGOAI, 1]]);
  assert.deepEqual(p.slice(-3).map((x) => x.ten), ['Lãnh đạo Văn phòng (trực tiếp chủ trì)', 'Văn phòng Tỉnh ủy (giao chung)', 'Cơ quan, đơn vị ngoài Văn phòng']);
  assert.equal(p.reduce((s, x) => s + x.rows.length, 0), ROWS.length, 'cộng đủ');
});

test('Theo chuyên viên: mỗi cán bộ một dòng, việc chưa giao cán bộ một dòng cuối; tổng của phòng = tổng các dòng cán bộ', () => {
  const cv = theoChuyenVien(ROWS, CTX);
  const th = cv.find((x) => x.ma === 'TONG_HOP');
  assert.deepEqual(th.canBo.map((c) => [c.ten, c.rows.length]), [['Bế Thị B', 2], ['Nông Văn A', 2], ['Phòng, chưa giao cán bộ', 1]]);
  assert.equal(th.canBo.reduce((s, c) => s + c.rows.length, 0), th.rows.length);
  assert.equal(cv.find((x) => x.ma === PHONG_NGOAI).canBo[0].ten, 'Chưa giao cán bộ cụ thể');
});

test('Bấm số: lọc theo phòng, cán bộ, nguồn, kết luận và cột — đúng bằng số trong ô', () => {
  assert.deepEqual(locBaoCao(ROWS, { phong: 'TONG_HOP', cot: 'qua' }, CTX).map((r) => r.id), [1, 2]);
  assert.deepEqual(locBaoCao(ROWS, { phong: 'TONG_HOP', canBo: '' }, CTX).map((r) => r.id), [5]);
  assert.deepEqual(locBaoCao(ROWS, { phong: 'QUAN_TRI', canBo: 'cv3', cot: 'truoc' }, CTX).map((r) => r.id), [6]);
  assert.equal(locBaoCao(ROWS, { b: 'p', phong: 'QUAN_TRI', cot: 'tong' }, CTX).length, 3, 'khoá bảng (b) không lọc');
  const nguon = theoNguon(ROWS, [{ ma: 'KL' }]);
  assert.deepEqual(nguon.map((n) => [n.ten === 'Chưa xác định nguồn' ? 'chua' : n.ma, n.rows.length]), [['KL', 1], ['chua', 10]], 'theo thứ tự danh mục, việc chưa có nguồn cuối');
  assert.equal(locBaoCao(ROWS, { nguon: nguon[1].ma, cot: 'qua' }).length, 2);
});
