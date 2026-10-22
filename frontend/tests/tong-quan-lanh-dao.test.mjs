// Unit test Tổng quan cho lãnh đạo (v3.24 — bố cục 9 khối): mục tiêu then chốt (gắn riêng / theo văn bản, lọc), khối lĩnh vực (đoạn cộng đủ tổng,
// sắp xếp), điểm nghẽn + cấp quyết định, xếp hạng, đúng hạn theo quý, kỳ nhiệm kỳ / tuỳ chọn, bộ lọc chi tiết + chip, danh sách bấm-xem đúng số.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ganMucTieuVaoDong, gomGan, khopMucTieu, nhanLocMucTieu, laTheoVanBan, CHUA_GAN, khoiCuaNganh } from '../src/lib/kl/muc-tieu.js';
import { DOAN, doanCua, theoKhoi, diemNghen, capNghen, locCapNghen, theoMucTieu, ketQuaMoiNhat, tenKy, xepHang, dungHanQuy, vuongMacCho, chatLuongDuLieu, theoChuTri, khoaChuTri, khoaXepHang } from '../src/lib/kl/tong-quan-lanh-dao.js';
import { khoangKy, khoangTuyChon } from '../src/lib/kl/tong-quan.js';
import { locTongQuan, coLoc, coGiaTri, LOC_TRONG } from '../src/lib/kl/tong-quan-them.js';
import { doiNhanh, dsNhanh, tuyChonLocMoi, tuyChonMucTieu, chipLoc, trangThaiCua } from '../src/lib/kl/tq-bo-loc.js';
import { locRows } from '../src/lib/kl/tong-hop.js';
import { KHOA_THEM, demLocThem } from '../src/lib/kl/loc-them.js';
import { locChiTieu } from '../src/lib/kl/tong-quan-loc.js';
import { HIEN_MUC_TIEU } from '../src/lib/kl/muc-tieu.js';

const HOM = '2026-10-16';
const K = khoangKy('nam', HOM);
const MT = [{ ma: 'DP_A', nhom: 'DOT_PHA', ten_ngan: 'Đột phá A', dang_dung: true }, { ma: 'DP_B', nhom: 'DOT_PHA', ten_ngan: 'Đột phá B', dang_dung: true },
  { ma: 'NQ_57', nhom: 'NQ_TW', ten_ngan: 'Nghị quyết 57-NQ/TW', dang_dung: true }, { ma: 'CHT_X', nhom: 'CHI_TIEU', ten_ngan: 'Chỉ tiêu X', dang_dung: true },
  { ma: 'DP_CU', nhom: 'DOT_PHA', ten_ngan: 'Đột phá cũ', dang_dung: false }];
const KHOI = [{ ma: 'XD', ten: 'Xây dựng Đảng', thu_tu: 1 }, { ma: 'KT', ten: 'Kinh tế', thu_tu: 2 }];
const NGANH = [{ ma: 'TUYEN_GIAO', ten: '2. Tuyên giáo', thu_tu: 2, khoi_ma: 'XD' }, { ma: 'KTTH', ten: '8. Kinh tế tổng hợp', thu_tu: 8, khoi_ma: 'KT' },
  { ma: 'XDGT', ten: '9. Xây dựng giao thông', thu_tu: 9, khoi_ma: 'KT' }];
const v = (o) => ({ nhom_dem: 'DANG_THUC_HIEN', muc_canh_bao: 'XANH', ngay_nhan_van_ban: '2026-09-10', owner_trong_van_phong: true, owner_phong: 'TONG_HOP',
  owner_don_vi_ma: 'TONG_HOP', owner_don_vi_ten: '1. Phòng Tổng hợp', van_ban_id: 'vb1', so_ket_luan: '10-KL/TU', ...o });
const xong = (o) => v({ nhom_dem: 'HOAN_THANH', muc_canh_bao: null, ngay_hoan_thanh: '2026-08-20', ket_qua: 'DUNG_HAN', tien_do_ma: 'HOAN_THANH', ...o });
const GAN = { rieng: gomGan([{ nhiem_vu_id: 1, muc_tieu_ma: 'DP_A' }, { nhiem_vu_id: 1, muc_tieu_ma: 'NQ_57' }, { nhiem_vu_id: 4, muc_tieu_ma: 'DP_CU' }], 'nhiem_vu_id'),
  vanBan: gomGan([{ van_ban_id: 'vb2', muc_tieu_ma: 'DP_B' }], 'van_ban_id') };
const ROWS = [
  v({ id: 1, ma: 'NV-1', nganh_ma: 'TUYEN_GIAO', linh_vuc_ma: 'LV1', muc_canh_bao: 'DO', nhom_dem: 'QUA_HAN', so_ngay_qua: 40, cap_quyet_dinh: 'THUONG_TRUC', cap_quyet_dinh_ten: 'Thường trực Tỉnh ủy', vuong_mac: 'Chờ ý kiến', uu_tien: 'THUONG_TRUC' }),
  v({ id: 2, ma: 'NV-2', van_ban_id: 'vb2', so_ket_luan: '20-TB/TU', nganh_ma: 'KTTH', linh_vuc_ma: 'LV8', muc_canh_bao: 'DO_DAC_BIET', nhom_dem: 'QUA_HAN', so_ngay_qua: 5, co_quan_trinh: 'UBND', co_quan_trinh_ten: '6. Đảng ủy UBND tỉnh', do_khan: 'HOA_TOC' }),
  v({ id: 3, ma: 'NV-3', van_ban_id: 'vb2', so_ket_luan: '20-TB/TU', nganh_ma: 'KTTH', muc_canh_bao: 'VANG', nhom_dem: 'SAP_DEN_HAN', thuong_truc_chi_dao: 'tt1', thuong_truc_chi_dao_ten: 'Đồng chí Một', muc_quan_trong: 'A' }),
  xong({ id: 4, ma: 'NV-4', nganh_ma: 'XDGT', linh_vuc_ma: 'LV9', ket_qua: 'TRE', ngay_hoan_thanh: '2026-07-10' }),
  xong({ id: 5, ma: 'NV-5', ngay_hoan_thanh: '2025-12-01' }),   // hoàn thành ngoài kỳ, không ngành
  v({ id: 6, ma: 'NV-6', nganh_ma: 'XDGT', linh_vuc_ma: 'LV9', nhom_dem: 'CHO_DIEU_KIEN', muc_canh_bao: 'KHONG_AP_DUNG' }),
].map((r) => ganMucTieuVaoDong(r, GAN));
const ids = (ds) => ds.map((r) => r.id);

describe('mục tiêu then chốt', () => {
  test('gắn riêng thay mặc định văn bản; việc chưa gắn riêng theo văn bản; lọc theo mã / nhóm / chưa gắn; nhãn lọc', () => {
    assert.deepEqual(ROWS[0].muc_tieu, ['DP_A', 'NQ_57']); assert.deepEqual(ROWS[1].muc_tieu, ['DP_B']); assert.ok(laTheoVanBan(ROWS[1]) && !laTheoVanBan(ROWS[0]));
    assert.deepEqual(ids(ROWS.filter((r) => khopMucTieu(r, 'NHOM:DOT_PHA', MT))), [1, 2, 3, 4]);
    assert.deepEqual(ids(ROWS.filter((r) => khopMucTieu(r, 'NQ_57', MT))), [1]);
    assert.deepEqual(ids(ROWS.filter((r) => khopMucTieu(r, CHUA_GAN, MT))), [5, 6]);
    assert.equal(nhanLocMucTieu('NHOM:DOT_PHA', MT), 'Mọi nội dung đột phá'); assert.equal(nhanLocMucTieu('NQ_57', MT), 'Nghị quyết 57-NQ/TW');
    assert.equal(khoiCuaNganh(NGANH, 'KTTH'), 'KT'); assert.equal(khoiCuaNganh(NGANH, null), null);
  });
  test('danh sách Nhiệm vụ: ô lọc mục tiêu (nhóm + từng mục tiêu có việc + chưa gắn), locRows lọc đúng, đếm trong "Thêm bộ lọc"', () => {
    const tc = tuyChonMucTieu(ROWS, MT);
    assert.deepEqual(tc.map((g) => g.nhom), ['Nội dung đột phá', 'Nghị quyết Trung ương', '']);
    assert.deepEqual(tc[0].ds.map((o) => [o.ma, o.n]), [['NHOM:DOT_PHA', 4], ['DP_A', 1], ['DP_B', 2], ['DP_CU', 1]]);
    assert.deepEqual(tc[2].ds.map((o) => [o.ma, o.n]), [[CHUA_GAN, 2]]);
    assert.deepEqual(ids(locRows(ROWS, { mucTieu: 'NHOM:DOT_PHA', mucTieuDm: MT })), [1, 2, 3, 4]);
    assert.deepEqual(ids(locRows(ROWS, { mucTieu: 'DP_B', mucTieuDm: MT })), [2, 3]);
    assert.deepEqual(ids(locRows(ROWS, { mucTieu: CHUA_GAN })), [5, 6]);
    assert.equal(locRows(ROWS, { mucTieu: '' }).length, ROWS.length);
    assert.ok(KHOA_THEM.includes('mucTieu')); assert.equal(demLocThem({ mucTieu: 'DP_A', doKhan: 'KHAN' }), 2);
  });
  test('thẻ mục tiêu: tổng mọi kỳ, hoàn thành, đúng hạn / được đánh giá, cảnh báo, văn bản; mục tiêu ngừng dùng chỉ hiện khi đang có việc', () => {
    const dp = theoMucTieu(ROWS, MT, 'DOT_PHA');
    assert.deepEqual(dp.map((m) => m.ma), ['DP_A', 'DP_B', 'DP_CU']);
    const b = dp[1];
    assert.deepEqual([b.tong, b.xong, b.mo, b.ddb, b.vang, b.do], [2, 0, 2, 1, 1, 0]); assert.deepEqual(b.vanBan, ['20-TB/TU']);
    const cu = dp[2]; assert.deepEqual([cu.tong, cu.xong, cu.dung, cu.dg, cu.pct], [1, 1, 0, 1, 100]);
    assert.deepEqual(theoMucTieu(ROWS.slice(0, 3), MT, 'DOT_PHA').map((m) => m.ma), ['DP_A', 'DP_B'], 'không còn việc → ẩn mục ngừng dùng');
    const kq = ketQuaMoiNhat([{ muc_tieu_ma: 'CHT_X', ky: '2026-Q2', gia_tri: '7%' }, { muc_tieu_ma: 'CHT_X', ky: '2026-08', gia_tri: '8%' }, { muc_tieu_ma: 'CHT_X', ky: '2025', gia_tri: '6%' }]);
    assert.equal(kq.get('CHT_X').gia_tri, '8%'); assert.equal(tenKy('2026-Q3'), 'quý III/2026'); assert.equal(tenKy('2026-09'), 'tháng 9/2026'); assert.equal(tenKy('2025'), 'năm 2025');
  });
});

describe('khối lĩnh vực, điểm nghẽn, xếp hạng, quý', () => {
  test('đoạn trạng thái: hoàn thành ngoài kỳ không tính; đoạn cộng đủ tổng; nhiều quá hạn trước; chưa phân ngành riêng', () => {
    assert.deepEqual(ROWS.map((r) => doanCua(r, K)), ['qh', 'qh', 'vang', 'cham', null, 'ch']);
    const t = theoKhoi(ROWS, K, { khoi: KHOI, nganh: NGANH });
    assert.equal(t.toan.tong, 5); assert.equal(Object.values(t.toan.dem).reduce((a, b) => a + b, 0), 5);
    assert.deepEqual(t.khoi.map((x) => [x.ma, x.tong, x.qh]), [['KT', 4, 1], ['XD', 1, 1]]);
    assert.deepEqual(t.khoi[0].nganh.map((n) => [n.ma, n.tong, n.qh, n.tyLe]), [['KTTH', 2, 1, null], ['XDGT', 2, 0, 0]]);
    assert.equal(theoKhoi(ROWS, K, { khoi: KHOI, nganh: NGANH }, 'dm').khoi[0].ma, 'XD', 'theo danh mục');
    assert.equal(t.chuaNganh, null, 'việc không ngành duy nhất đã hoàn thành ngoài kỳ');
    assert.deepEqual(DOAN.length, 7);
    // v3.26.1: hoàn thành không xét được hạn (chưa có ngày hoàn thành — việc nhập Excel) ghi "Hoàn thành", màu xanh nhạt, ngay sau "đúng hạn"
    assert.deepEqual(DOAN.slice(0, 3), [['dung', 'Hoàn thành đúng hạn', '--f-tot'], ['cdg', 'Hoàn thành', '--f-d'], ['cham', 'Hoàn thành chậm', '--f-tre']]);
    assert.equal(doanCua(xong({ ngay_hoan_thanh: null, ket_qua: null }), K), 'cdg');   // chưa rõ ngày hoàn thành → theo ngày giao, trong kỳ
    assert.equal(trangThaiCua(xong({ ngay_hoan_thanh: null, ket_qua: null })), 'cdg');
  });
  test('điểm nghẽn: Đỏ đặc biệt trước rồi trễ nhiều; nút cấp theo danh mục, cuối "chưa xác định"; xếp hạng theo đơn vị / Thường trực', () => {
    const ds = diemNghen(ROWS); assert.deepEqual(ids(ds), [2, 1]);
    assert.deepEqual(capNghen(ds, [{ ma: 'THUONG_TRUC', ten: 'Thường trực Tỉnh ủy' }]), [{ ma: 'THUONG_TRUC', ten: 'Thường trực Tỉnh ủy', n: 1 }, { ma: 'CHUA', ten: 'Chưa xác định cấp', n: 1 }]);
    assert.deepEqual(ids(locCapNghen(ds, 'CHUA')), [2]);
    const dv = xepHang(ROWS, K, 'dv');   // cùng 1 việc quá hạn → đúng hạn thấp trước (Văn phòng 0% — một việc trễ; UBND chưa có việc đánh giá)
    assert.deepEqual(dv.map((d) => [d.ma, d.ten, d.ddb + d.do, d.tyLe]), [['VP', 'Văn phòng Tỉnh ủy', 1, 0], ['UBND', 'Đảng ủy UBND tỉnh', 1, null]]);
    const vp = khoaXepHang('dv');   // v3.27 (0117): cơ quan trình "Văn phòng Tỉnh ủy" chung dòng với việc không ghi cơ quan trình
    assert.deepEqual([vp({ co_quan_trinh: 'VAN_PHONG_TINH_UY', co_quan_trinh_ten: '1. Văn phòng Tỉnh ủy' }), vp({ owner_trong_van_phong: true, owner_don_vi_ma: 'TONG_HOP' })],
      [['VP', 'Văn phòng Tỉnh ủy'], ['VP', 'Văn phòng Tỉnh ủy']]);
    const tt = xepHang(ROWS, K, 'tt'); assert.deepEqual(tt.map((d) => d.ma), ['KHONG', 'tt1']);
    const q = dungHanQuy(ROWS, HOM); assert.deepEqual(q.map((x) => [x.ten, x.dung, x.dg]), [['quý III', 0, 1], ['quý IV (đến nay)', 0, 0]]);
    assert.deepEqual(ids(vuongMacCho(ROWS)), [1]); assert.deepEqual(ids(chatLuongDuLieu(ROWS).chuaNganh), [5], 'v3.29: chỉ việc chưa có ngành');
  });
  test('kỳ nhiệm kỳ và kỳ tuỳ chọn (đảo ngược → đổi chỗ, trống đầu → từ đầu dữ liệu)', () => {
    assert.deepEqual([khoangKy('nhiem-ky', HOM).tu, khoangKy('nhiem-ky', HOM).ten], ['2025-09-15', 'Nhiệm kỳ 2025–2030']);
    assert.deepEqual([khoangTuyChon('2026-09-30', '2026-07-01', HOM).tu, khoangTuyChon('2026-09-30', '2026-07-01', HOM).den], ['2026-07-01', '2026-09-30']);
    assert.equal(khoangTuyChon('', '', HOM).den, HOM); assert.equal(khoangTuyChon('2026-01-01', '', HOM).trong, 'từ 1/1/2026 đến 16/10/2026');
  });
});

describe('bộ lọc chi tiết', () => {
  const ctx = { mucTieuDm: MT, nganhDm: NGANH };
  test('lọc nhanh bật / tắt, AND giữa các lọc; khoá mới; kỳ tuỳ chọn không phải lọc dòng', () => {
    let l = doiNhanh(LOC_TRONG, 'qh30'); l = doiNhanh(l, 'tt'); assert.deepEqual(dsNhanh(l), ['tt', 'qh30']);
    assert.deepEqual(ids(locTongQuan(ROWS, l, ctx)), [1]); assert.deepEqual(dsNhanh(doiNhanh(l, 'tt')), ['qh30']);
    assert.deepEqual(ids(locTongQuan(ROWS, { nhanh: 'dp' }, ctx)), [1, 2, 3, 4]); assert.deepEqual(ids(locTongQuan(ROWS, { nhanh: 'hk' }, ctx)), [2]);
    assert.deepEqual(ids(locTongQuan(ROWS, { nhanh: 'vm' }, ctx)), [1]);
    assert.deepEqual(ids(locTongQuan(ROWS, { khoi: 'KT' }, ctx)), [2, 3, 4, 6]); assert.deepEqual(ids(locTongQuan(ROWS, { khoi: 'CHUA' }, ctx)), [5]);
    assert.deepEqual(ids(locTongQuan(ROWS, { nganh: 'L:LV9' }, ctx)), [4, 6]); assert.deepEqual(ids(locTongQuan(ROWS, { nganh: 'N:KTTH' }, ctx)), [2, 3]);
    assert.deepEqual(ids(locTongQuan(ROWS, { coQuan: 'UBND' }, ctx)), [2]); assert.deepEqual(ids(locTongQuan(ROWS, { thuongTruc: 'tt1' }, ctx)), [3]);
    assert.deepEqual(ids(locTongQuan(ROWS, { trangThai: 'qh' }, ctx)), [1, 2]); assert.deepEqual(ids(locTongQuan(ROWS, { mucQT: 'A' }, ctx)), [3]);
    assert.deepEqual(ids(locTongQuan(ROWS, { nguoi: 'P:TONG_HOP', mucTieu: 'NHOM:DOT_PHA' }, ctx)), [1, 2, 3, 4]);
    assert.ok(!coLoc({ ...LOC_TRONG, tu: '2026-01-01' }) && coGiaTri({ ...LOC_TRONG, tu: '2026-01-01' }));
    assert.equal(trangThaiCua(ROWS[5]), 'ch');
  });
  test('lựa chọn đếm trên toàn bộ dòng; chip đúng từng điều kiện', () => {
    const tc = tuyChonLocMoi(ROWS, { mucTieuDm: MT, khoiDm: KHOI, nganhDm: NGANH, linhVucDm: [{ ma: 'LV9', nganh_ma: 'XDGT', ten: 'Giao thông' }] });
    assert.deepEqual(tc.mucTieu[0].ds.map((o) => [o.ma, o.n]), [['NHOM:DOT_PHA', 4], ['DP_A', 1], ['DP_B', 2], ['DP_CU', 1]]);
    assert.equal(tc.mucTieu.at(-1).ds[0].ma, CHUA_GAN);
    assert.deepEqual(tc.khoi.map((o) => [o.ma, o.n]), [['XD', 1], ['KT', 4], ['CHUA', 1]]);
    const maNganh = tc.nganh.flatMap((g) => g.ds.map((o) => o.ma)); assert.ok(maNganh.includes('N:XDGT') && !maNganh.some((m) => m.startsWith('L:')), 'v3.29: chỉ còn ngành');
    assert.deepEqual(tc.coQuan.map((o) => o.ma), ['UBND', 'VP']);
    const c = chipLoc({ ...LOC_TRONG, nhanh: 'tt,vm', khoi: 'KT', mucTieu: 'NQ_57' }, { ...tc, ldvp: [], phong: [], canBo: [] }, { mucTieuDm: MT });
    assert.deepEqual(c.map((x) => x.ten), ['Việc Thường trực giao', 'Vướng mắc chờ ý kiến', 'Mục tiêu: Nghị quyết 57-NQ/TW', 'Khối: Kinh tế']);
    assert.deepEqual(chipLoc({ ...LOC_TRONG, nguoi: 'LD:CHUA' }, { ...tc, ldvp: [], phong: [], canBo: [] }).map((x) => x.ten), ['Chưa có lãnh đạo phụ trách'], 'không hiện mã CHUA');
  });
  test('danh sách bấm-xem: đúng số của khối, mục tiêu, xếp hạng, quý, vướng mắc, chất lượng dữ liệu', () => {
    const o = { homNay: HOM, nganhDm: NGANH };
    assert.equal(locChiTieu(ROWS, { t: 'khoi', ma: 'KT' }, K, o).nhom.reduce((s, p) => s + p.rows.length, 0), 4);
    assert.deepEqual(ids(locChiTieu(ROWS, { t: 'khoi', ma: 'XDGT', loai: 'nganh', d: 'cham' }, K, o).nhom[0].rows), [4]);
    assert.equal(locChiTieu(ROWS, { t: 'khoi', ma: 'TAT' }, K, o).nhom.reduce((s, p) => s + p.rows.length, 0), 5);
    assert.deepEqual(ids(locChiTieu(ROWS, { t: 'mt', ma: 'DP_B' }, K, o).nhom[0].rows), [2, 3]);
    assert.deepEqual(ids(locChiTieu(ROWS, { t: 'mtm', ma: 'DP_B', m: 'ddb' }, K, o).rows), [2]);
    assert.deepEqual(ids(locChiTieu(ROWS, { t: 'mtm', ma: 'NQ_57', m: 'qh' }, K, o).rows), [1], 'ô Quá hạn của bảng nghị quyết = Đỏ + Đỏ đặc biệt');
    assert.deepEqual(ids(locChiTieu(ROWS, { t: 'mtm', ma: 'NQ_57', m: 'ddb' }, K, o).rows), []);
    assert.deepEqual(ids(locChiTieu(ROWS, { t: 'xh', cach: 'dv', ma: 'UBND' }, K, o).nhom[0].rows), [2]);
    assert.deepEqual(ids(locChiTieu(ROWS, { t: 'nghen', cap: 'THUONG_TRUC' }, K, o).rows), [1]);
    assert.deepEqual(ids(locChiTieu(ROWS, { t: 'quy', tu: '2026-07-01', den: '2026-09-30' }, K, o).nhom[0].rows), [4]);
    assert.deepEqual(ids(locChiTieu(ROWS, { t: 'vm' }, K, o).rows), [1]);
    assert.deepEqual(locChiTieu(ROWS, { t: 'cldl' }, K, o).nhom.map((p) => [p.ten, p.rows.length]),   // + hoàn thành chưa có ngày (18/10); v3.27: mục tiêu tạm ẩn
      [...(HIEN_MUC_TIEU ? [['Chưa phân loại mục tiêu then chốt', 2]] : []), ['Chưa có ngành/lĩnh vực', 1], ['Hoàn thành chưa có ngày hoàn thành', 0]]);
    assert.equal(locChiTieu(ROWS, { t: 'loc' }, K, o).nhom.reduce((s, p) => s + p.rows.length, 0), 6);
  });
});

describe('theoChuTri (v3.27 — khối 2 "Theo chủ trì theo dõi", cột như bảng tổng hợp của Văn phòng)', () => {
  const k = khoangKy('nhiem-ky', '2026-10-02');
  const v = (o) => ({ nhom_dem: 'DANG_THUC_HIEN', muc_canh_bao: 'XANH', ngay_nhan_van_ban: '2026-09-10', owner_trong_van_phong: true, owner_phong: 'TONG_HOP',
    owner_don_vi_ma: 'TONG_HOP', owner_don_vi_ten: 'Phòng Tổng hợp', owner_tai_khoan: 'u1', owner_tai_khoan_ten: 'Nguyễn Văn A', ...o });
  const xong = { nhom_dem: 'HOAN_THANH', muc_canh_bao: 'KHONG_AP_DUNG' };
  const rows = [v({ id: 1 }), v({ id: 2, muc_canh_bao: 'DO', nhom_dem: 'QUA_HAN' }), v({ id: 3, ...xong, ngay_hoan_thanh: '2026-09-20', ket_qua: 'DUNG_HAN' }),
    v({ id: 4, ...xong, ngay_hoan_thanh: '2026-09-28', ket_qua: 'TRE' }), v({ id: 5, ...xong, ngay_nhan_van_ban: '2025-10-02' }),
    v({ id: 6, owner_tai_khoan: null, owner_tai_khoan_ten: null, owner_phong: null, owner_don_vi_ma: 'VAN_PHONG_TINH_UY', owner_don_vi_ten: '1. Văn phòng Tỉnh ủy', ...xong }),
    v({ id: 7, owner_tai_khoan: 'u2', owner_tai_khoan_ten: 'Trần Thị B', muc_canh_bao: 'DO_DAC_BIET', nhom_dem: 'QUA_HAN' }),
    v({ id: 8, ...xong, ngay_nhan_van_ban: '2025-06-01' })];   // trước nhiệm kỳ: ngoài kỳ
  test('mỗi chủ trì: tổng = hoàn thành trong kỳ + đang thực hiện + quá hạn; đúng hạn chỉ trên việc xét được; xếp theo tổng', () => {
    const ds = theoChuTri(rows, k);
    assert.deepEqual(ds.map((d) => [d.ten, d.tong, d.xong, d.dangLam, d.qh, d.tyLe, d.xetDuoc]),
      [['Nguyễn Văn A', 5, 3, 1, 1, 50, 2], ['Trần Thị B', 1, 0, 0, 1, null, 0], ['Văn phòng Tỉnh ủy', 1, 1, 0, 0, null, 0]]);
    assert.equal(ds.reduce((t, d) => t + d.tong, 0), 7, 'việc trước kỳ không tính');
    assert.deepEqual(khoaChuTri(rows[5]), ['DV:VAN_PHONG_TINH_UY', 'Văn phòng Tỉnh ủy']);
    assert.deepEqual(theoChuTri([], k), []);
  });
});
