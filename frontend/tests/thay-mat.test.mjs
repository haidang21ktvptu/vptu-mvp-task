// Thay mặt theo nhóm (v3.18, lib/kl/thay-mat.js): giá trị ô "nhom:<mã>" ↔ tham số giao_viec; thành viên nhóm; "người giao" / cấp duyệt theo nhóm
// (cùng quy tắc kl_trong_nhom_thay_mat, kl_duoc_duyet_thay ở DB — đây chỉ ẩn / hiện). Dữ liệu hư cấu. Chạy `npm test` trong frontend/ (node:test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../src/lib/state.js';
import { tachThayMat, giaTriNhom, laThayMatThuongTruc, laThanhVienNhom, laNguoiGiao, duyetThayNhom, tenCapDuyet, tenNhomThayMat } from '../src/lib/kl/thay-mat.js';

const CVP = { id: 'cvp', full_name: 'Hoàng Văn Bình', role_group: 'A1', is_chief: true };
const PCVP = { id: 'pcvp', full_name: 'Lê Thị Hạnh', role_group: 'A1' };
const TT = { id: 'tt', full_name: 'Nguyễn Văn Thường', role_group: 'A0' };
const TP = { id: 'tp', full_name: 'Đàm Văn Khánh', role_group: 'A2', department: 'TONG_HOP' };
const CV = { id: 'cv', full_name: 'Trần Thu Hà', role_group: 'A3', department: 'TONG_HOP', quan_tri_kl: true };
state.accounts = [CVP, PCVP, TT, TP, CV];

test('tachThayMat / giaTriNhom: nhóm → thay_mat_nhom, người → thay_mat_cho, trống → cả hai null', () => {
  assert.deepEqual(tachThayMat(giaTriNhom('LANH_DAO_VP')), { thay_mat_nhom: 'LANH_DAO_VP', thay_mat_cho: null });
  assert.deepEqual(tachThayMat('pcvp'), { thay_mat_nhom: null, thay_mat_cho: 'pcvp' });
  assert.deepEqual(tachThayMat(''), { thay_mat_nhom: null, thay_mat_cho: null }); assert.deepEqual(tachThayMat(null), { thay_mat_nhom: null, thay_mat_cho: null });
  assert.ok(laThayMatThuongTruc('nhom:THUONG_TRUC')); assert.ok(!laThayMatThuongTruc('nhom:LANH_DAO_VP')); assert.ok(!laThayMatThuongTruc('tt'));
  assert.equal(tenNhomThayMat('THUONG_TRUC'), 'Thường trực Tỉnh ủy'); assert.equal(tenNhomThayMat(null), '');
});

test('thành viên nhóm: LANH_DAO_VP = Chánh + Phó Chánh VP; THUONG_TRUC = A0; tài khoản khoá / hệ thống không tính', () => {
  assert.ok(laThanhVienNhom('LANH_DAO_VP', CVP) && laThanhVienNhom('LANH_DAO_VP', PCVP) && !laThanhVienNhom('LANH_DAO_VP', TP) && !laThanhVienNhom('LANH_DAO_VP', TT));
  assert.ok(laThanhVienNhom('THUONG_TRUC', TT) && !laThanhVienNhom('THUONG_TRUC', CVP));
  assert.ok(!laThanhVienNhom('LANH_DAO_VP', { ...PCVP, bi_khoa: true }) && !laThanhVienNhom('LANH_DAO_VP', { ...PCVP, is_system: true }) && !laThanhVienNhom(null, CVP));
});

test('người giao / cấp duyệt theo nhóm: PCVP là người giao và được duyệt việc thay mặt Lãnh đạo VP (cấp duyệt = Chánh VP đại diện); không với thay mặt một người', () => {
  const nhom = { id: 'nv1', tao_boi: 'cv', giao_thay_mat_cho: 'cvp', giao_thay_mat_nhom: 'LANH_DAO_VP' };
  const nguoi = { id: 'nv2', tao_boi: 'cv', giao_thay_mat_cho: 'cvp', giao_thay_mat_nhom: null };
  state.user = PCVP;
  assert.ok(laNguoiGiao(nhom) && duyetThayNhom(nhom, 'cvp') && !duyetThayNhom(nhom, 'tp'));
  assert.ok(!laNguoiGiao(nguoi) && !duyetThayNhom(nguoi, 'cvp'));
  assert.equal(tenCapDuyet(nhom, 'cvp'), 'Lãnh đạo Văn phòng'); assert.equal(tenCapDuyet(nguoi, 'cvp'), 'Hoàng Văn Bình'); assert.equal(tenCapDuyet(nhom, 'tp'), 'Đàm Văn Khánh');
  state.user = TP;
  assert.ok(!laNguoiGiao(nhom) && !duyetThayNhom(nhom, 'cvp'));
  state.user = CV;
  assert.ok(laNguoiGiao(nhom), 'người tạo vẫn là người giao (thẻ "việc tôi giao bị từ chối")'); assert.ok(!duyetThayNhom(nhom, 'cvp'));
  state.user = TT;
  assert.ok(laNguoiGiao({ id: 'nv3', tao_boi: 'cv', giao_thay_mat_cho: 'tt', giao_thay_mat_nhom: 'THUONG_TRUC' }));
  state.user = null;
  assert.ok(!laNguoiGiao(nhom) && !duyetThayNhom(nhom, 'cvp'));
});
