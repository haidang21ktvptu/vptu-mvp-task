// Unit test số liệu màn hình Tổng quan (giao diện v9): kỳ, dải đầu, cơ cấu cộng đủ tổng, gom theo vai, văn bản, lĩnh vực, chất lượng,
// chỉ đạo, dải cảnh báo; v9 đợt 2: danh sách bấm-xem của từng chỉ tiêu (locChiTieu) bằng đúng con số. Chạy `npm test` trong frontend/ (node:test, không cần trình duyệt hay Supabase).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { khoangKy, soLieuChinh, theoThang, khoaNhom, theoNhom, theoVanBan, theoLinhVuc, chatLuongKy, chiDaoKy, canhBaoDo, mucMo, ngayGiao } from '../src/lib/kl/tong-quan.js';
import { locChiTieu } from '../src/lib/kl/tong-quan-loc.js';

const HOM_NAY = '2026-10-02';
const viec = (o) => ({ nhom_dem: 'DANG_THUC_HIEN', muc_canh_bao: 'XANH', ngay_nhan_van_ban: '2026-09-10', owner_trong_van_phong: true, owner_phong: 'TONG_HOP',
  owner_don_vi_ma: 'VP_TH', owner_don_vi_ten: '1. Phòng Tổng hợp', van_ban_id: 'vb1', so_ket_luan: '102-KL/TU', van_ban_loai: 'KL_BTV', ngay_ban_hanh: '2026-09-01', ...o });
const MAU = [
  viec({ id: 1 }),
  viec({ id: 2, muc_canh_bao: 'VANG', nhom_dem: 'SAP_DEN_HAN' }),
  viec({ id: 3, muc_canh_bao: 'DO', nhom_dem: 'QUA_HAN', owner_tai_khoan: 'u-phuc', owner_tai_khoan_ten: 'Lý Văn Phúc' }),
  viec({ id: 4, muc_canh_bao: 'DO_DAC_BIET', nhom_dem: 'QUA_HAN', owner_tai_khoan: 'u-phuc', owner_tai_khoan_ten: 'Lý Văn Phúc', linh_vuc_ma: 'LV1', linh_vuc_ten: 'Kinh tế' }),
  viec({ id: 5, nhom_dem: 'CHO_NGHIEM_THU', owner_phong: 'QUAN_TRI', owner_don_vi_ma: 'VP_QT', owner_don_vi_ten: '5. Phòng Quản trị' }),
  viec({ id: 6, nhom_dem: 'HOAN_THANH', muc_canh_bao: 'KHONG_AP_DUNG', ngay_hoan_thanh: '2026-09-20', ket_qua: 'DUNG_HAN', chat_luong: 'DAT_TOT', so_lan_tra_lai: 1 }),
  viec({ id: 7, nhom_dem: 'HOAN_THANH', muc_canh_bao: 'KHONG_AP_DUNG', ngay_hoan_thanh: '2026-10-01', ket_qua: 'TRE', chat_luong: 'DAT' }),
  viec({ id: 8, nhom_dem: 'HOAN_THANH', muc_canh_bao: 'KHONG_AP_DUNG', ngay_hoan_thanh: '2025-12-20', ket_qua: 'DUNG_HAN', ngay_nhan_van_ban: '2025-11-01' }),
  viec({ id: 9, nhom_dem: 'THUONG_XUYEN', muc_canh_bao: 'KHONG_AP_DUNG', owner_trong_van_phong: false, owner_phong: null, owner_don_vi_ma: 'SO_TC', owner_don_vi_ten: 'Sở Tài chính' }),
  viec({ id: 10, owner_trong_van_phong: false, owner_phong: null, owner_don_vi_ma: 'SO_TC', owner_don_vi_ten: 'Sở Tài chính', van_ban_id: 'vb2', so_ket_luan: '98-TB/TU', ngay_ban_hanh: '2026-08-15' }),
];

describe('khoangKy', () => {
  test('tháng, quý, năm chứa hôm nay', () => {
    assert.deepEqual(khoangKy('thang', HOM_NAY), { ky: 'thang', tu: '2026-10-01', den: '2026-10-31', ten: 'Tháng 10', trong: 'trong tháng 10' });
    assert.equal(khoangKy('quy', HOM_NAY).ten, 'Quý IV');
    assert.equal(khoangKy('quy', '2026-02-28').den, '2026-03-31');
    assert.deepEqual([khoangKy('nam', HOM_NAY).tu, khoangKy('nam', HOM_NAY).den], ['2026-01-01', '2026-12-31']);
    assert.equal(khoangKy('thang', '2028-02-10').den, '2028-02-29');
  });
});

describe('soLieuChinh', () => {
  test('năm: giao/xong theo ngày, đang mở và cảnh báo hiện tại, đúng hạn trên việc được đánh giá', () => {
    const s = soLieuChinh(MAU, khoangKy('nam', HOM_NAY));
    assert.equal(s.giao, 9);          // trừ việc 8 nhận 2025
    assert.equal(s.xong, 2);          // việc 6, 7 (việc 8 xong 2025)
    assert.equal(s.tyLeDungHan, 50);
    assert.equal(s.dangMo, 6);        // 1–5, 10 (Thường xuyên không tính mở)
    assert.deepEqual(s.mo, { trongHan: 2, nt: 1, khac: 0, vang: 1, do: 1, ddb: 1 });
    assert.equal(s.canhBao, 3);
    assert.equal(Object.values(s.mo).reduce((a, b) => a + b, 0), s.dangMo, 'các mức cộng đủ số đang mở');
  });
  test('tháng 10: chỉ việc 7 xong; không có việc đánh giá thì tỷ lệ null', () => {
    const s = soLieuChinh(MAU, khoangKy('thang', HOM_NAY));
    assert.equal(s.xong, 1); assert.equal(s.tyLeDungHan, 0);
    assert.equal(soLieuChinh([], khoangKy('thang', HOM_NAY)).tyLeDungHan, null);
  });
  test('mucMo: Đỏ đặc biệt trước Đỏ trước Vàng trước chờ nghiệm thu', () => {
    assert.equal(mucMo({ muc_canh_bao: 'DO', nhom_dem: 'QUA_HAN_NGHIEM_THU' }), 'do');
    assert.equal(mucMo({ muc_canh_bao: 'XANH', nhom_dem: 'QUA_HAN_NGHIEM_THU' }), 'nt');
  });
  test('mucMo: việc DB không áp mức cảnh báo (cần điền hạn, chờ điều kiện, đang đính chính) không tính là trong hạn', () => {
    ['CAN_DIEN_HAN', 'CHO_DIEU_KIEN', 'DANG_DINH_CHINH'].forEach((n) => assert.equal(mucMo({ muc_canh_bao: 'KHONG_AP_DUNG', nhom_dem: n }), 'khac'));
    const s = soLieuChinh([...MAU, viec({ id: 11, nhom_dem: 'CAN_DIEN_HAN', muc_canh_bao: 'KHONG_AP_DUNG' })], khoangKy('nam', HOM_NAY));
    assert.deepEqual([s.dangMo, s.mo.trongHan, s.mo.khac], [7, 2, 1]);
  });
  test('ngày giao: ngày nhận văn bản → ngày ban hành → ngày tạo (giờ Việt Nam)', () => {
    assert.equal(ngayGiao({ ngay_nhan_van_ban: null, ngay_ban_hanh: null, created_at: '2026-09-30T18:30:00Z' }), '2026-10-01');
  });
});

describe('theoThang', () => {
  test('đủ tháng tới hiện tại, đếm đúng tháng', () => {
    const t = theoThang(MAU, HOM_NAY);
    assert.equal(t.length, 10);
    assert.deepEqual(t[8], { thang: 9, giao: 9, xong: 1, tyLe: 100 });
    assert.deepEqual(t[9], { thang: 10, giao: 0, xong: 1, tyLe: 0 });
    assert.equal(t[0].tyLe, null);
  });
});

describe('theoNhom', () => {
  const nam = khoangKy('nam', HOM_NAY);
  test('A1 theo phòng: phòng có việc Đỏ lên đầu, đơn vị ngoài gom theo mã', () => {
    const ds = theoNhom(MAU, nam, khoaNhom('A1', { TONG_HOP: 'Phòng Tổng hợp', QUAN_TRI: 'Phòng Quản trị' }));
    assert.deepEqual(ds.map((d) => d.ten), ['Phòng Tổng hợp', 'Phòng Quản trị', 'Sở Tài chính']);
    assert.deepEqual([ds[0].xong, ds[0].dangMo, ds[0].do, ds[0].ddb, ds[0].tyLe], [2, 4, 1, 1, 50]);
    assert.equal(ds[2].donVi, 'SO_TC');
  });
  test('A0 gộp mọi đơn vị trong Văn phòng một dòng', () => {
    const ds = theoNhom(MAU, nam, khoaNhom('A0'));
    assert.deepEqual(ds.map((d) => d.ten), ['Văn phòng Tỉnh ủy', 'Sở Tài chính']);
    assert.equal(ds[0].tong, 8);
  });
  test('A2 theo cán bộ; việc phòng chủ trì chưa giao cán bộ gom một dòng, việc đơn vị khác chủ trì gom theo đơn vị', () => {
    const ds = theoNhom(MAU, nam, khoaNhom('A2', {}, 'TONG_HOP'));
    assert.ok(ds.some((d) => d.ten === 'Lý Văn Phúc' && d.ddb === 1));
    assert.deepEqual(ds.map((d) => [d.ten, d.tong]).sort(), [['Lý Văn Phúc', 2], ['Phòng Quản trị', 1], ['Phòng, chưa giao cán bộ', 5], ['Sở Tài chính', 2]]);
  });
});

describe('văn bản, lĩnh vực, chất lượng, cảnh báo', () => {
  test('theoVanBan: văn bản có việc Đỏ lên trước', () => {
    const ds = theoVanBan(MAU);
    assert.equal(ds[0].soHieu, '102-KL/TU');
    assert.deepEqual([ds[0].tong, ds[0].xong, ds[0].do], [9, 3, 2]);
  });
  test('theoLinhVuc: chỉ việc đang mở, lĩnh vực trống = Chưa phân loại', () => {
    assert.deepEqual(theoLinhVuc(MAU).map((d) => [d.ten, d.so]), [['Chưa phân loại', 5], ['Kinh tế', 1]]);
  });
  test('chatLuongKy: tỷ lệ đạt tốt trở lên trên việc đã đánh giá, cộng lượt trả lại', () => {
    const c = chatLuongKy(MAU, khoangKy('nam', HOM_NAY));
    assert.deepEqual([c.tot, c.dat, c.coDanhGia, c.tyLeTot, c.traLai], [1, 1, 2, 50, 1]);
  });
  test('canhBaoDo: người chủ trì nhiều việc Đỏ trước', () => {
    assert.deepEqual(canhBaoDo(MAU), { ddb: 1, do: 1, nguoi: ['Lý Văn Phúc'] });
  });
});

describe('chiDaoKy', () => {
  const cd = (o) => ({ loai: 'Y_KIEN', trang_thai: 'DA_PHAN_HOI', nguoi_gui: 'lanh-dao', created_at: '2026-09-01T01:00:00Z', han_phan_hoi: '2026-09-03', phan_hoi_luc: '2026-09-02T02:00:00Z', ...o });
  const ds = [cd({}), cd({ phan_hoi_luc: '2026-09-05T02:00:00Z' }), cd({ phan_hoi_luc: null, trang_thai: 'CHO_PHAN_HOI', han_phan_hoi: '2026-09-30' }),
    cd({ loai: 'PHAN_HOI' }), cd({ tra_loi_cho: 'x' }), cd({ loai: 'CHI_DAO_TT', nguoi_gui: 'tt' }), cd({ nguoi_gui: 'chuyen-vien' })];
  const nam = khoangKy('nam', HOM_NAY);
  test('A1: chỉ đạo gốc của lãnh đạo Văn phòng, không tính phản hồi', () => {
    const s = chiDaoKy(ds, nam, { vai: 'A1', laLanhDaoVP: (id) => id === 'lanh-dao' }, new Date('2026-10-02T03:00:00Z'));
    assert.deepEqual([s.banHanh, s.daPhanHoi, s.dangCho, s.quaHan, s.tyLeDungHan], [3, 2, 1, 1, 50]);
    assert.equal(s.tbNgay, 2.5);
  });
  test('A0: chỉ đạo Thường trực; A2: của chính mình', () => {
    assert.equal(chiDaoKy(ds, nam, { vai: 'A0' }).banHanh, 1);
    assert.equal(chiDaoKy(ds, nam, { vai: 'A2', me: 'chuyen-vien' }).banHanh, 1);
  });
});

// v9 đợt 2: bấm một số / cột / đoạn / dòng → danh sách trong ngăn chi tiết. Bất biến: số việc trong danh sách = con số đã bấm (cùng dữ liệu, cùng kỳ).
describe('locChiTieu — danh sách của từng chỉ tiêu bằng đúng con số', () => {
  const nam = khoangKy('nam', HOM_NAY); const ids = (kq) => kq.rows.map((r) => r.id).sort((a, b) => a - b);
  const tong = (kq) => new Set(kq.nhom.flatMap((n) => n.rows.map((r) => r.id))).size;
  test('dải đầu: giao, xong, đang mở, cảnh báo, Đỏ', () => {
    const s = soLieuChinh(MAU, nam);
    assert.equal(locChiTieu(MAU, { t: 'giao' }, nam).rows.length, s.giao);
    assert.equal(locChiTieu(MAU, { t: 'xong' }, nam).rows.length, s.xong);
    assert.equal(locChiTieu(MAU, { t: 'mo' }, nam).rows.length, s.dangMo);
    assert.deepEqual(ids(locChiTieu(MAU, { t: 'canh' }, nam)), [2, 3, 4]);
    assert.deepEqual(ids(locChiTieu(MAU, { t: 'do' }, nam)), [3, 4]);
  });
  test('cơ cấu: từng mức và đánh giá cộng đủ tổng', () => {
    const s = soLieuChinh(MAU, nam);
    Object.keys(s.mo).forEach((m) => assert.equal(locChiTieu(MAU, { t: 'muc', m }, nam).rows.length, s.mo[m], m));
    assert.equal(locChiTieu(MAU, { t: 'dg', kq: 'DUNG_HAN' }, nam).rows.length, s.dungHan);
    assert.equal(locChiTieu(MAU, { t: 'dg', kq: 'TRE' }, nam).rows.length, s.tre);
    assert.equal(locChiTieu(MAU, { t: 'dg', kq: 'chua' }, nam).rows.length, s.chuaDanhGia);
    assert.equal(tong(locChiTieu(MAU, { t: 'dg' }, nam)), s.dungHan + s.tre);
  });
  test('tháng: giao mới / hoàn thành đúng cột của biểu đồ', () => {
    const t = theoThang(MAU, HOM_NAY)[8]; const kq = locChiTieu(MAU, { t: 'thang', th: 9 }, nam, { homNay: HOM_NAY });
    assert.equal(kq.tieuDe, 'Tháng 9/2026');
    assert.deepEqual(kq.nhom.map((n) => n.rows.length), [t.giao, t.xong]);
  });
  test('bảng theo phòng: đang làm / hoàn thành / mức cảnh báo của đúng dòng', () => {
    const khoa = khoaNhom('A1', { TONG_HOP: 'Phòng Tổng hợp' }); const d = theoNhom(MAU, nam, khoa)[0];
    const kq = locChiTieu(MAU, { t: 'nhom', ma: d.ma, ten: d.ten }, nam, { khoa });
    assert.deepEqual(kq.nhom.map((n) => n.rows.length), [d.dangMo, d.xong]);
    assert.equal(locChiTieu(MAU, { t: 'nhom', ma: d.ma, ten: d.ten, m: 'ddb' }, nam, { khoa }).rows.length, d.ddb);
  });
  test('văn bản, lĩnh vực (kể cả Chưa phân loại), chất lượng, trả lại', () => {
    const vb = theoVanBan(MAU)[0]; const kq = locChiTieu(MAU, { t: 'vb', id: 'vb1', ten: vb.soHieu }, nam);
    assert.equal(kq.nhom[1].rows.length, vb.xong);
    theoLinhVuc(MAU).forEach((d) => assert.equal(locChiTieu(MAU, { t: 'lv', ma: d.ma, ten: d.ten }, nam).rows.length, d.so, d.ten));
    const c = chatLuongKy(MAU, nam);
    assert.equal(locChiTieu(MAU, { t: 'cl', cl: 'DAT_TOT' }, nam).rows.length, c.tot);
    assert.deepEqual(ids(locChiTieu(MAU, { t: 'traLai' }, nam)), [6]);
  });
  test('chỉ đạo: danh sách là các VIỆC có chỉ đạo; chờ phản hồi tách quá hạn / trong hạn', () => {
    const cd = (o) => ({ loai: 'Y_KIEN', nguoi_gui: 'ld', created_at: '2026-09-01T01:00:00Z', trang_thai: 'CHO_PHAN_HOI', phan_hoi_luc: null, han_phan_hoi: '2026-09-03', ...o });
    const cds = [cd({ id: 'a', nhiem_vu_id: 1 }), cd({ id: 'b', nhiem_vu_id: 1, han_phan_hoi: '2026-12-01' }), cd({ id: 'c', nhiem_vu_id: 2, trang_thai: 'DA_PHAN_HOI', phan_hoi_luc: '2026-09-02T01:00:00Z' })];
    const ctx = { cds, ctxCd: { vai: 'A1', laLanhDaoVP: () => true }, homNay: HOM_NAY };
    const cho = locChiTieu(MAU, { t: 'cd', loai: 'dangCho' }, nam, ctx);
    assert.deepEqual(cho.nhom.map((n) => n.rows.map((r) => r.id)), [[1], [1]]);
    const bh = locChiTieu(MAU, { t: 'cd', loai: 'banHanh' }, nam, ctx);
    assert.deepEqual(bh.nhom.map((n) => n.rows.map((r) => r.id)), [[1], [2]]);
  });
  test('chỉ tiêu lạ → danh sách rỗng, không lỗi', () => {
    assert.deepEqual(locChiTieu(MAU, { t: 'khong-co' }, nam).rows, []);
  });
});
