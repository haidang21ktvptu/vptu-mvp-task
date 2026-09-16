// Unit test KPI nhóm cán bộ (GĐ14 PR 14D, CH-2): đánh giá theo Owner tài khoản HOẶC Owner là chính phòng của nhóm
// (owner_tai_khoan NULL, owner_don_vi_ma = mã phòng); việc chỉ theo dõi đếm riêng. Chạy `npm test` trong frontend/.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateGroupKPI, laOwnerPhong } from '../src/views/shared/kpi.js';

const A = 'a', B = 'b';
const rows = [
  { id: 1, owner_tai_khoan: A, owner_don_vi_ma: 'TONG_HOP', nguoi_theo_doi: B, tien_do_ma: 'DANG_THUC_HIEN', muc_canh_bao: 'DO' },
  { id: 2, owner_tai_khoan: null, owner_don_vi_ma: 'TONG_HOP', nguoi_theo_doi: A, tien_do_ma: 'DANG_THUC_HIEN', muc_canh_bao: 'DO_DAC_BIET' },   // Owner là phòng
  { id: 3, owner_tai_khoan: null, owner_don_vi_ma: 'TONG_HOP', nguoi_theo_doi: B, tien_do_ma: 'HOAN_THANH', muc_canh_bao: 'KHONG_AP_DUNG' },   // Owner là phòng, đã đóng
  { id: 4, owner_tai_khoan: null, owner_don_vi_ma: 'QUAN_TRI', nguoi_theo_doi: A, tien_do_ma: 'DANG_THUC_HIEN', muc_canh_bao: 'XANH' },        // phòng khác, A theo dõi
  { id: 5, owner_tai_khoan: null, owner_don_vi_ma: 'DANG_UY_UBND', nguoi_theo_doi: A, tien_do_ma: 'DANG_THUC_HIEN', muc_canh_bao: 'VANG' },     // đơn vị ngoài, A theo dõi
];

describe('calculateGroupKPI — Owner tài khoản, Owner là phòng, theo dõi', () => {
  test('nhóm cá nhân [A]: chỉ việc A là Owner tài khoản; việc A theo dõi (kể cả Owner là phòng mình) đếm riêng', () => {
    assert.deepEqual(calculateGroupKPI([A], rows), { owner: 1, dangMo: 1, quaHan: 1, doDacBiet: 0, hoanThanh: 0, theoDoi: 3 });
  });
  test('nhóm là phòng TONG_HOP [A, B] + mã phòng: việc Owner = phòng (không gắn cá nhân) cộng vào đánh giá, không vào theo dõi', () => {
    assert.deepEqual(calculateGroupKPI([A, B], rows, 'TONG_HOP'), { owner: 3, dangMo: 2, quaHan: 2, doDacBiet: 1, hoanThanh: 1, theoDoi: 2 });
    // Không truyền mã phòng → hai việc Owner = phòng không được tính là Owner; việc 2 rơi về "theo dõi" của A.
    assert.deepEqual(calculateGroupKPI([A, B], rows), { owner: 1, dangMo: 1, quaHan: 1, doDacBiet: 0, hoanThanh: 0, theoDoi: 3 });
  });
  test('laOwnerPhong: đúng khi không gắn tài khoản và đơn vị = phòng; sai khi có tài khoản, phòng khác hoặc không có mã phòng', () => {
    assert.equal(laOwnerPhong(rows[1], 'TONG_HOP'), true);
    assert.equal(laOwnerPhong(rows[0], 'TONG_HOP'), false);
    assert.equal(laOwnerPhong(rows[3], 'TONG_HOP'), false);
    assert.equal(laOwnerPhong(rows[1], null), false);
  });
});
