// Unit test KPI nhóm cán bộ (GĐ14 PR 14D, CH-2): đánh giá theo Owner tài khoản HOẶC Owner là chính phòng của nhóm
// (owner_tai_khoan NULL, owner_don_vi_ma = mã phòng); việc chỉ theo dõi đếm riêng. Chạy `npm test` trong frontend/.
// PR-2b (Mới 2): "Đỏ" tính theo người / phòng CHỊU CHẬM do DB trả (nguoi_chiu_cham, phong_chiu_cham) — việc quá hạn ở bước nghiệm thu thuộc lãnh đạo.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateGroupKPI, laOwnerPhong } from '../src/views/shared/kpi.js';

const A = 'a', B = 'b', L = 'l';   // L: lãnh đạo nghiệm thu
const rows = [
  { id: 1, owner_tai_khoan: A, owner_don_vi_ma: 'TONG_HOP', nguoi_theo_doi: B, tien_do_ma: 'DANG_THUC_HIEN', muc_canh_bao: 'DO', nguoi_chiu_cham: A, phong_chiu_cham: 'TONG_HOP' },
  { id: 2, owner_tai_khoan: null, owner_don_vi_ma: 'TONG_HOP', nguoi_theo_doi: A, tien_do_ma: 'DANG_THUC_HIEN', muc_canh_bao: 'DO_DAC_BIET', nguoi_chiu_cham: A, phong_chiu_cham: 'TONG_HOP' },   // Owner là phòng: chịu chậm = người theo dõi
  { id: 3, owner_tai_khoan: null, owner_don_vi_ma: 'TONG_HOP', nguoi_theo_doi: B, tien_do_ma: 'HOAN_THANH', muc_canh_bao: 'KHONG_AP_DUNG' },   // Owner là phòng, đã đóng
  { id: 4, owner_tai_khoan: null, owner_don_vi_ma: 'QUAN_TRI', nguoi_theo_doi: A, tien_do_ma: 'DANG_THUC_HIEN', muc_canh_bao: 'XANH' },        // phòng khác, A theo dõi
  { id: 5, owner_tai_khoan: null, owner_don_vi_ma: 'DANG_UY_UBND', nguoi_theo_doi: A, tien_do_ma: 'DANG_THUC_HIEN', muc_canh_bao: 'VANG' },     // đơn vị ngoài, A theo dõi
  // Quá hạn ở bước nghiệm thu: A chủ trì đã nộp, Đỏ thuộc lãnh đạo L (phòng của L), không thuộc A hay phòng TONG_HOP
  { id: 6, owner_tai_khoan: A, owner_don_vi_ma: 'TONG_HOP', nguoi_theo_doi: A, tien_do_ma: 'DANG_THUC_HIEN', muc_canh_bao: 'DO', trang_thai: 'QUA_HAN_NGHIEM_THU', nguoi_chiu_cham: L, phong_chiu_cham: 'LANH_DAO_VAN_PHONG' },
];

const CL0 = { KHONG_DAT: 0, DAT: 0, DAT_TOT: 0, DAT_XUAT_SAC: 0 };   // PR-3: dòng mẫu không có chất lượng
describe('calculateGroupKPI — Owner tài khoản, Owner là phòng, theo dõi', () => {
  test('nhóm cá nhân [A]: chỉ việc A là Owner tài khoản; việc A theo dõi (kể cả Owner là phòng mình) đếm riêng', () => {
    assert.deepEqual(calculateGroupKPI([A], rows), { owner: 2, dangMo: 2, quaHan: 2, doDacBiet: 1, hoanThanh: 0, theoDoi: 3, chatLuong: CL0 });
    assert.deepEqual(calculateGroupKPI([L], rows), { owner: 0, dangMo: 0, quaHan: 1, doDacBiet: 0, hoanThanh: 0, theoDoi: 0, chatLuong: CL0 }, 'lãnh đạo nghiệm thu chịu Đỏ của việc 6');
  });
  test('nhóm là phòng TONG_HOP [A, B] + mã phòng: việc Owner = phòng (không gắn cá nhân) cộng vào đánh giá, không vào theo dõi', () => {
    assert.deepEqual(calculateGroupKPI([A, B], rows, 'TONG_HOP'), { owner: 4, dangMo: 3, quaHan: 2, doDacBiet: 1, hoanThanh: 1, theoDoi: 2, chatLuong: CL0 });
    // Không truyền mã phòng → hai việc Owner = phòng không được tính là Owner; việc 2 rơi về "theo dõi" của A (Đỏ vẫn tính cho A — người chịu chậm).
    assert.deepEqual(calculateGroupKPI([A, B], rows), { owner: 2, dangMo: 2, quaHan: 2, doDacBiet: 1, hoanThanh: 0, theoDoi: 3, chatLuong: CL0 });
  });
  test('laOwnerPhong: đúng khi không gắn tài khoản và đơn vị = phòng; sai khi có tài khoản, phòng khác hoặc không có mã phòng', () => {
    assert.equal(laOwnerPhong(rows[1], 'TONG_HOP'), true);
    assert.equal(laOwnerPhong(rows[0], 'TONG_HOP'), false);
    assert.equal(laOwnerPhong(rows[3], 'TONG_HOP'), false);
    assert.equal(laOwnerPhong(rows[1], null), false);
  });
});
