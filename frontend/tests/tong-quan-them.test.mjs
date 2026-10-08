// Đợt C1 v3.19: thanh lọc Tổng quan, lãnh đạo VP phụ trách (phân công cả phòng / kiêm nhiệm — cùng quy tắc pcvp_phu_trach), khối theo loại
// văn bản, thanh tải; A3 trong chiDaoPhan. Dữ liệu hư cấu. Chạy `npm test` trong frontend/ (node:test).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { locTongQuan, tuyChonLoc, theoLoaiVanBan, theoLanhDaoVP, lanhDaoPhuTrach, phanTai, coLoc, LOC_TRONG, NGOAI_VP, CHUA_LDVP, KHONG_VB } from '../src/lib/kl/tong-quan-them.js';
import { khoangKy, chiDaoPhan } from '../src/lib/kl/tong-quan.js';
import { locChiTieu } from '../src/lib/kl/tong-quan-loc.js';

const K = khoangKy('nam', '2026-10-02');
const viec = (o) => ({ nhom_dem: 'DANG_THUC_HIEN', muc_canh_bao: 'XANH', owner_trong_van_phong: true, owner_phong: 'TONG_HOP', nguoi_theo_doi_phong: 'TONG_HOP',
  nguoi_theo_doi: 'tp-th', owner_tai_khoan: 'cv-a', owner_tai_khoan_ten: 'Nông Văn A', van_ban_loai: 'KL_BTV', do_khan: 'THUONG', nganh_ma: null, linh_vuc_ma: null, ...o });
const ROWS = [
  viec({ id: 1 }),
  viec({ id: 2, muc_canh_bao: 'VANG', nhom_dem: 'SAP_DEN_HAN', do_khan: 'KHAN', van_ban_loai: 'CONG_VAN', tao_boi: 'cv-a' }),
  viec({ id: 3, muc_canh_bao: 'DO', nhom_dem: 'QUA_HAN', owner_tai_khoan: 'cv-b', owner_tai_khoan_ten: 'Hoàng Thị B', nganh_ma: 'KT', linh_vuc_ma: 'TC' }),
  viec({ id: 4, nhom_dem: 'HOAN_THANH', muc_canh_bao: 'KHONG_AP_DUNG', ngay_hoan_thanh: '2026-09-20', ket_qua: 'DUNG_HAN', van_ban_loai: null, owner_tai_khoan: 'cv-c', owner_tai_khoan_ten: 'Lý Văn C', owner_phong: 'QUAN_TRI', nguoi_theo_doi_phong: 'QUAN_TRI', nguoi_theo_doi: 'tp-qt' }),
  viec({ id: 5, owner_trong_van_phong: false, owner_phong: null, owner_tai_khoan: null, owner_tai_khoan_ten: null, nguoi_theo_doi_phong: 'LANH_DAO_VAN_PHONG', nguoi_theo_doi: 'cvp', do_khan: 'HOA_TOC', giao_thay_mat_cho: 'cvp' }),
];
const PHAN_CONG = [{ lanh_dao_id: 'pcvp-1', phong: 'TONG_HOP', nganh_ma: null, linh_vuc_ma: null }, { lanh_dao_id: 'pcvp-2', phong: 'QUAN_TRI', nganh_ma: null, linh_vuc_ma: null },
  { lanh_dao_id: 'pcvp-2', phong: 'TONG_HOP', nganh_ma: 'KT', linh_vuc_ma: 'TC' }];
const LD = [{ id: 'pcvp-1', full_name: 'Phó A' }, { id: 'pcvp-2', full_name: 'Phó B' }];
const ids = (ds) => ds.map((r) => r.id);

describe('lọc Tổng quan', () => {
  test('không lọc trả nguyên mảng; từng ô lọc đúng; phạm vi "tôi" = theo dõi / chủ trì / người tạo / thay mặt', () => {
    assert.equal(locTongQuan(ROWS, LOC_TRONG), ROWS); assert.ok(!coLoc(LOC_TRONG) && coLoc({ ...LOC_TRONG, loai: 'KL_BTV' }));
    assert.deepEqual(ids(locTongQuan(ROWS, { phamVi: 'toi' }, { me: 'cv-a' })), [1, 2]);
    assert.deepEqual(ids(locTongQuan(ROWS, { phamVi: 'toi' }, { me: 'cvp' })), [5]);
    assert.deepEqual(ids(locTongQuan(ROWS, { loai: 'CONG_VAN' })), [2]); assert.deepEqual(ids(locTongQuan(ROWS, { loai: KHONG_VB })), [4]);
    assert.deepEqual(ids(locTongQuan(ROWS, { phong: 'QUAN_TRI' })), [4]); assert.deepEqual(ids(locTongQuan(ROWS, { phong: NGOAI_VP })), [5]);
    assert.deepEqual(ids(locTongQuan(ROWS, { canBo: 'cv-b' })), [3]); assert.deepEqual(ids(locTongQuan(ROWS, { doKhan: 'HOA_TOC' })), [5]);
    assert.deepEqual(ids(locTongQuan(ROWS, { loai: 'KL_BTV', doKhan: 'THUONG', canBo: 'cv-a' })), [1]);
  });
  test('lãnh đạo VP phụ trách: cả phòng theo phòng theo dõi / chủ trì; kiêm nhiệm đúng ngành + lĩnh vực thắng; ngoài phân công = CHUA', () => {
    assert.deepEqual(lanhDaoPhuTrach(ROWS[0], PHAN_CONG), ['pcvp-1']);
    assert.deepEqual(lanhDaoPhuTrach(ROWS[2], PHAN_CONG), ['pcvp-2'], 'kiêm nhiệm KT/TC của phòng Tổng hợp');
    assert.deepEqual(lanhDaoPhuTrach(ROWS[4], PHAN_CONG), []);
    assert.deepEqual(lanhDaoPhuTrach(viec({ nguoi_theo_doi_phong: 'QUAN_TRI', owner_phong: 'TONG_HOP' }), PHAN_CONG).sort(), ['pcvp-1', 'pcvp-2'], 'hai phòng → hai lãnh đạo');
    assert.deepEqual(ids(locTongQuan(ROWS, { ldvp: 'pcvp-2' }, { phanCong: PHAN_CONG })), [3, 4]);
    assert.deepEqual(ids(locTongQuan(ROWS, { ldvp: CHUA_LDVP }, { phanCong: PHAN_CONG })), [5]);
  });
  test('tuỳ chọn ô lọc đếm trên toàn bộ dòng, chỉ giá trị có trong dữ liệu', () => {
    const tc = tuyChonLoc(ROWS, { tenPhong: { TONG_HOP: 'Phòng Tổng hợp', QUAN_TRI: 'Phòng Quản trị' }, lanhDaoVP: LD, tenLoai: (m) => `L-${m}` });
    assert.deepEqual(tc.loai.map((o) => [o.ma, o.n]), [['KL_BTV', 3], ['CONG_VAN', 1], [KHONG_VB, 1]]);
    assert.deepEqual(tc.phong.map((o) => o.ten), ['Phòng Quản trị', 'Phòng Tổng hợp', 'Đơn vị ngoài Văn phòng']);
    assert.deepEqual(tc.canBo.map((o) => [o.ten, o.n]), [['Hoàng Thị B', 1], ['Lý Văn C', 1], ['Nông Văn A', 2]]);
    assert.deepEqual(tc.doKhan.map((o) => o.ma), ['HOA_TOC', 'KHAN', 'THUONG']); assert.deepEqual(tc.ldvp.map((o) => o.ten), ['Phó A', 'Phó B']);
  });
});

describe('khối mới', () => {
  test('theo loại văn bản: tổng / hoàn thành / đang làm / cảnh báo, tỷ lệ trên tổng, nhiều việc trước', () => {
    const ds = theoLoaiVanBan(ROWS);
    assert.deepEqual(ds.map((d) => [d.ma, d.tong, d.xong, d.dangMo, d.canhBao, d.tyLe]), [['KL_BTV', 3, 0, 3, 1, 60], ['CONG_VAN', 1, 0, 1, 1, 20], [KHONG_VB, 1, 1, 0, 0, 20]]);
  });
  test('bấm số của một loại văn bản: danh sách (ba phần) cộng đúng bằng tổng của loại, kể cả việc thường xuyên', () => {
    const rows = [...ROWS, viec({ id: 6, nhom_dem: 'THUONG_XUYEN', muc_canh_bao: 'KHONG_AP_DUNG' })];
    theoLoaiVanBan(rows).forEach((d) => {
      const kq = locChiTieu(rows, { t: 'loai', ma: d.ma, ten: d.ma }, K);
      assert.equal(kq.nhom.reduce((s, n) => s + n.rows.length, 0), d.tong, d.ma);
      assert.equal(kq.nhom[0].rows.length, d.dangMo); assert.equal(kq.nhom[1].rows.length, d.xong);
    });
  });
  test('theo lãnh đạo VP: mỗi Phó một dòng với phòng cả phòng; việc kiêm nhiệm tính cho người kiêm nhiệm; cuối là chưa có lãnh đạo', () => {
    const ds = theoLanhDaoVP(ROWS, K, PHAN_CONG, LD, { TONG_HOP: 'Phòng Tổng hợp', QUAN_TRI: 'Phòng Quản trị' });
    assert.deepEqual(ds.map((d) => [d.ma, d.tong, d.xong, d.dangMo, d.do, d.phong]), [['pcvp-1', 2, 0, 2, 0, ['Phòng Tổng hợp']], ['pcvp-2', 2, 1, 1, 1, ['Phòng Quản trị']], [CHUA_LDVP, 1, 0, 1, 0, []]]);
  });
  test('thanh tải: phần trăm trên tổng, đang làm trừ phần cảnh báo', () => {
    assert.deepEqual(phanTai({ tong: 10, xong: 4, dangMo: 5, vang: 1, do: 1, ddb: 0 }), { xong: 40, mo: 30, vang: 10, do: 10, ddb: 0 });
    assert.deepEqual(phanTai({ tong: 0, xong: 0, dangMo: 0, vang: 0, do: 0, ddb: 0 }), { xong: 0, mo: 0, vang: 0, do: 0, ddb: 0 });
  });
  test('chỉ đạo: A3 (xem cả phòng) đếm chỉ đạo của Trưởng phòng mình', () => {
    const cds = [{ loai: 'DON_DOC', nguoi_gui: 'tp-th', created_at: '2026-09-01T02:00:00Z', trang_thai: 'CHO_PHAN_HOI', nhiem_vu_id: 1 }, { loai: 'DON_DOC', nguoi_gui: 'tp-qt', created_at: '2026-09-01T02:00:00Z', trang_thai: 'CHO_PHAN_HOI', nhiem_vu_id: 4 }];
    assert.equal(chiDaoPhan(cds, K, { vai: 'A3', me: 'cv-a', laTruongPhong: (id) => id === 'tp-th' }).banHanh.length, 1);
  });
});
