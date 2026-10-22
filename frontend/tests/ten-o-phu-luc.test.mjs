// v3.28.1 (chủ dự án 22/10/2026: "Phải theo đúng như các cột ở file excel … để thuận tiện sử dụng"): tên các ô nhiệm vụ trên mọi màn hình theo đúng
// tên cột bảng Phụ lục (mẫu nhập chuẩn COT_MAU). Chốt ở các bảng tên dùng chung: tên ô của Nhập Excel, cột Xuất Excel, tên ô trong Diễn biến; tệp
// mẫu 29 cột cũ (tiêu đề cũ "Hạn hoàn thành", "Cơ quan trình"…) vẫn ghép đúng cột. Chạy `npm test` trong frontend/ (node:test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COT_MAU, HO_SO_MAU_CU, doanTruong, nhanTruong, chuanTieuDe, truong } from '../src/lib/kl/nhap/truong.js';
import { COT_NHIEM_VU } from '../src/lib/kl/xuat.js';
import { TEN_COT } from '../src/lib/kl/nhan.js';

const PL = Object.fromEntries(COT_MAU);   // khoá → tên cột bảng Phụ lục

test('Nhập Excel: mọi ô có cột trong bảng Phụ lục mang đúng tên cột; tên cột nào cũng tự ghép về đúng ô', () => {
  COT_MAU.filter(([k]) => k !== 'stt').forEach(([k, ten]) => {
    if (truong(k)) assert.equal(nhanTruong(k), ten, k);
    assert.equal(doanTruong(ten), k, ten);
  });
  assert.equal(doanTruong('Đơn vị chủ trì theo dõi'), 'don_vi');
});

test('Tệp mẫu 29 cột cũ (tiêu đề trước v3.28.1) vẫn ghép đúng cột', () => {
  const cu = { 'Số/ký hiệu văn bản': 'so_ket_luan', 'Nội dung nhiệm vụ': 'noi_dung', 'Đơn vị chủ trì': 'don_vi', 'Hạn hoàn thành': 'han_xu_ly',
    'Ngành': 'nganh', 'Mô tả kết quả': 'kq_mo_ta', 'Cơ quan trình': 'co_quan_trinh' };
  Object.entries(cu).forEach(([ten, k]) => {
    assert.equal(HO_SO_MAU_CU.anh_xa[chuanTieuDe(ten)], k, `hồ sơ mẫu cũ: ${ten}`);
    assert.equal(doanTruong(ten), k, `đoán cột: ${ten}`);
  });
});

test('Xuất Excel: cột ứng với ô bảng Phụ lục mang đúng tên cột, không còn tên cũ', () => {
  const ten = COT_NHIEM_VU.map((c) => c.nhan);
  [PL.ma, PL.noi_dung, PL.so_ket_luan, PL.chu_tri, PL.han_xu_ly, PL.co_quan_trinh, 'Người theo dõi', 'Sản phẩm đầu ra', 'Cấp nhận sản phẩm']
    .forEach((t) => assert.ok(ten.includes(t), t));
  ['Mã', 'Nội dung', 'Văn bản', 'Chủ trì', 'Hạn hoàn thành', 'Sản phẩm', 'Cấp nhận', 'Cơ quan trình'].forEach((t) => assert.ok(!ten.includes(t), `còn tên cũ: ${t}`));
});

test('Diễn biến: tên ô theo bảng Phụ lục; chủ trì theo dõi tách cán bộ / phòng, đơn vị', () => {
  assert.equal(TEN_COT.noi_dung, PL.noi_dung); assert.equal(TEN_COT.nganh_ma, PL.nganh); assert.equal(TEN_COT.co_quan_trinh, PL.co_quan_trinh);
  assert.equal(TEN_COT.han_xu_ly, PL.han_xu_ly); assert.equal(TEN_COT.loai_thoi_han_ma, PL.loai_thoi_han); assert.equal(TEN_COT.tien_do_ma, PL.tien_do);
  assert.equal(TEN_COT.owner_tai_khoan, 'Chủ trì theo dõi (cán bộ)'); assert.equal(TEN_COT.owner_don_vi_ma, 'Chủ trì theo dõi (phòng, đơn vị)');
  assert.equal(TEN_COT.nguoi_theo_doi, 'Người theo dõi'); assert.equal(TEN_COT.san_pham_loai, 'Sản phẩm đầu ra');
});
