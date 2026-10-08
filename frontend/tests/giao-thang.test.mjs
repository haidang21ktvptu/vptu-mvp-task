// Đợt E v3.18 (0085): chuyên viên giao thẳng — ô Chịu trách nhiệm của biểu mẫu Giao việc theo vai / thay mặt (them-owner.js; giao_viec ở DB là chốt).
// Dữ liệu hư cấu. Chạy `npm test` trong frontend/ (node:test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canBoOwner, ownerOptionsHtml, laGiaoThang } from '../src/views/shared/kl/them-owner.js';

const CVP = { id: 'cvp', full_name: 'Hoàng Văn Bình', role_group: 'A1', is_chief: true, department: 'LANH_DAO_VAN_PHONG' };
const TP = { id: 'tp', full_name: 'Đàm Văn Khánh', role_group: 'A2', department: 'TONG_HOP' };
const CV = { id: 'cv', full_name: 'Trần Thu Hà', role_group: 'A3', department: 'TONG_HOP' };
const CV2 = { id: 'cv2', full_name: 'Nông Văn Long', role_group: 'A3', department: 'QUAN_TRI' };
const TT = { id: 'tt', full_name: 'Nguyễn Văn Thường', role_group: 'A0' };
const HT = { id: 'ht', full_name: 'Hệ thống', role_group: 'A3', is_system: true };
const DS = [CVP, TP, CV, CV2, TT, HT];
const DM = { donVi: [{ ma: 'VAN_PHONG_TINH_UY', ten: 'Văn phòng Tỉnh ủy', trong_van_phong: true, phong: null }, { ma: 'TONG_HOP', ten: '1. Phòng Tổng hợp', trong_van_phong: true, phong: 'TONG_HOP' }] };
const ids = (ds) => ds.map((a) => a.id).sort();

test('chuyên viên không thay mặt: chỉ chuyên viên (mọi phòng, kể cả chính mình), không phòng, không lãnh đạo; không có tài khoản hệ thống', () => {
  assert.ok(laGiaoThang(CV) && laGiaoThang({ ...CV, quan_tri_kl: true }, '') && !laGiaoThang({ ...CV, quan_tri_kl: true }, 'cvp') && !laGiaoThang(TP));
  assert.deepEqual(ids(canBoOwner(DS, CV)), ['cv', 'cv2']);
  const html = ownerOptionsHtml(DM, DS, CV);
  assert.match(html, /Chọn chuyên viên thực hiện \(hoặc chính tôi\)/); assert.match(html, /<optgroup label="Chuyên viên">/);
  assert.ok(html.indexOf('tk:cv"') < html.indexOf('tk:cv2"'), 'chính tôi xếp đầu'); assert.match(html, /Trần Thu Hà \(chính tôi\)/);
  assert.doesNotMatch(html, /dv:TONG_HOP|dv:VAN_PHONG_TINH_UY|tk:tp|tk:cvp/);
});

test('người quản trị KL: không thay mặt → như chuyên viên; chọn thay mặt → đủ cán bộ, Văn phòng và các phòng như trước', () => {
  const qtkl = { ...CV, quan_tri_kl: true };
  assert.deepEqual(ids(canBoOwner(DS, qtkl, false, '')), ['cv', 'cv2']);
  assert.deepEqual(ids(canBoOwner(DS, qtkl, false, 'nhom:LANH_DAO_VP')), ['cv', 'cv2', 'cvp', 'tp']);
  assert.match(ownerOptionsHtml(DM, DS, qtkl, false, 'cvp'), /dv:TONG_HOP.*dv:VAN_PHONG_TINH_UY|dv:VAN_PHONG_TINH_UY.*dv:TONG_HOP/);
  assert.deepEqual(ids(canBoOwner(DS, qtkl, true, 'nhom:THUONG_TRUC')), ['cvp'], 'thay mặt Thường trực: chỉ lãnh đạo Văn phòng');
});

test('lãnh đạo không đổi: Trưởng phòng = chuyên viên phòng mình + chính mình; Chánh VP = mọi cán bộ', () => {
  assert.deepEqual(ids(canBoOwner(DS, TP)), ['cv', 'tp']);
  assert.deepEqual(ids(canBoOwner(DS, CVP)), ['cv', 'cv2', 'cvp', 'tp']);
});
