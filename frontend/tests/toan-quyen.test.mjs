// v3.22 (0100): tài khoản toàn quyền — hồ sơ hiệu dụng như Chánh Văn phòng (vai thật giữ ở vai_goc), chức danh riêng, menu Chánh VP + Quản trị,
// nhập Excel đi đường lãnh đạo (không cần cột Lãnh đạo giao, người theo dõi mặc định = cán bộ chủ trì). Dữ liệu hư cấu. Chạy `npm test` trong frontend/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { laToanQuyen, hoSoHieuDung } from '../src/lib/toan-quyen.js';
import { nhanChucDanh } from '../src/lib/constants.js';
import { menuCuaVai, MENU } from '../src/views/shell/menu.js';
import { danhGia } from '../src/lib/kl/nhap/danh-gia.js';

const QT = { id: 'qt', username: 'qt_thu', full_name: 'Quản trị thử', role_group: 'A3', department: 'CDS_CY', is_chief: false, quan_tri_he_thong: true, toan_quyen: true };

test('Hồ sơ hiệu dụng: toàn quyền → A1 + is_chief, giữ vai thật; gọi lại không đổi; không cờ hoặc Thường trực → giữ nguyên', () => {
  const h = hoSoHieuDung(QT);
  assert.equal(h.role_group, 'A1'); assert.equal(h.is_chief, true); assert.equal(h.vai_goc, 'A3'); assert.equal(h.department, 'CDS_CY');
  assert.equal(QT.role_group, 'A3', 'không sửa hồ sơ gốc');
  assert.deepEqual(hoSoHieuDung(h), h); assert.ok(laToanQuyen(h));
  const thuong = { ...QT, toan_quyen: false };
  assert.equal(hoSoHieuDung(thuong), thuong); assert.equal(laToanQuyen(thuong), false);
  const a0 = { ...QT, role_group: 'A0', department: null };
  assert.equal(hoSoHieuDung(a0), a0); assert.equal(laToanQuyen(a0), false);
  assert.equal(laToanQuyen(null), false);
});

test('Chức danh "Quản trị toàn quyền" (không xưng Chánh Văn phòng); Chánh VP thật giữ nhãn cũ', () => {
  assert.equal(nhanChucDanh(hoSoHieuDung(QT)), 'Quản trị toàn quyền');
  assert.equal(nhanChucDanh({ role_group: 'A1', is_chief: true }), 'Chánh Văn phòng');
  assert.equal(nhanChucDanh({ ...QT, toan_quyen: false }), 'Chuyên viên · Phòng Chuyển đổi số - Cơ yếu');
});

test('Menu: như Chánh Văn phòng + Quản trị (v3.23: không còn Nhắn tin); không thêm "Nhập từ Excel" riêng (đã có Giao việc)', () => {
  const ids = menuCuaVai(hoSoHieuDung(QT)).map((m) => m.id);
  assert.deepEqual(ids, [...MENU.A1.map((m) => m.id), 'navQuanTri']);
  assert.ok(!ids.includes('navNhapExcel'));
});

const DM = {
  donVi: [{ ma: 'VAN_PHONG_TINH_UY', ten: 'Văn phòng Tỉnh ủy', trong_van_phong: true, phong: null }, { ma: 'QUAN_TRI', ten: 'Phòng Quản trị', trong_van_phong: true, phong: 'QUAN_TRI' }],
  linhVuc: [{ ma: 'LV_TC', ten: 'Tài chính', nganh_ma: 'KTTH' }],
};
const ACC = [
  { id: 'cvp', full_name: 'Chánh VP thử', role_group: 'A1', is_chief: true, department: 'LANH_DAO_VAN_PHONG' },
  { id: 'tpqt', full_name: 'Trưởng phòng QT thử', role_group: 'A2', department: 'QUAN_TRI' },
  { id: 'cvqt', full_name: 'Chuyên viên QT thử', role_group: 'A3', department: 'QUAN_TRI' },
  { ...QT },
];
const o = (x) => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, { ma: v }]));
const DONG = { soDong: 3, goc: {}, o: o({ loai_van_ban: 'CONG_VAN', so_ket_luan: '12/CV-TQ', ngay_ban_hanh: '2026-09-01', noi_dung: 'Việc thử', don_vi: 'QUAN_TRI',
  can_bo: 'tpqt', san_pham: 'BAO_CAO', han_xu_ly: '2026-12-31', nguon: 'NHIEM_VU_PHAT_SINH' }) };
const CTX = { dm: DM, accounts: ACC, cheDoXong: 'DA_XONG_NGOAI', homNay: '2026-10-13', maDaCo: new Set() };

test('Nhập Excel: toàn quyền đi đường lãnh đạo — không cần Lãnh đạo giao, không gửi thay mặt, người theo dõi = cán bộ chủ trì', () => {
  const kq = danhGia(DONG, { ...CTX, me: hoSoHieuDung(QT) });
  assert.equal(kq.ket_qua, 'GIAO'); assert.deepEqual(kq.thieu, []);
  assert.ok(!kq.macDinh.has('lanh_dao_giao')); assert.equal(kq.du_lieu.thay_mat_cho, null); assert.equal(kq.du_lieu.thay_mat_nhom, null);
  assert.equal(kq.du_lieu.nguoi_theo_doi, 'tpqt');
  const cv = danhGia(DONG, { ...CTX, me: { ...QT, toan_quyen: false } });   // cùng dòng, chuyên viên thường: ghi thay mặt Trưởng phòng của phòng chủ trì
  assert.equal(cv.du_lieu.thay_mat_cho, 'tpqt'); assert.ok(cv.macDinh.has('lanh_dao_giao'));
});
