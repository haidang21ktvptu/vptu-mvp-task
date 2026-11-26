// Unit test Tổng quan ba tầng (v3.36): năm thẻ tầng 1 (các phần cộng đủ số thẻ, danh sách bấm-xem bằng đúng số thẻ), tỷ lệ đúng hạn chỉ ghi khi đủ
// dữ liệu, so với tuần trước theo bản chụp (chỉ trên tập việc đang xem), chỉ đạo chờ phản hồi tại hôm nay − 7, câu kết luận, 12 tuần, ma trận đơn vị.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { khoangKy, khoaNhom } from '../src/lib/kl/tong-quan.js';
import { theTang1, tuanTruoc, soSanh, cauKetLuan, nhieuQuaHanNhat, tuanGanDay, xuHuongTuan, maTran, tyLeDungHan, canYKien } from '../src/lib/kl/tong-quan-tang.js';
import { locChiTieu } from '../src/lib/kl/tong-quan-loc.js';
import { ghiBoSungNht } from '../src/lib/kl/nhan.js';

const HOM_NAY = '2026-11-25';   // thứ Tư
const nam = khoangKy('nam', HOM_NAY);
const viec = (o) => ({ nhom_dem: 'DANG_THUC_HIEN', muc_canh_bao: 'XANH', ngay_nhan_van_ban: '2026-10-10', owner_trong_van_phong: true, owner_phong: 'TONG_HOP',
  owner_don_vi_ma: 'VP_TH', owner_don_vi_ten: '1. Phòng Tổng hợp', van_ban_id: 'vb1', han_xu_ly: '2026-12-30', ...o });
const QT = { owner_phong: 'QUAN_TRI', owner_don_vi_ma: 'VP_QT', owner_don_vi_ten: '5. Phòng Quản trị' };
const MAU = [
  viec({ id: 1 }),
  viec({ id: 2, nhom_dem: 'SAP_DEN_HAN', muc_canh_bao: 'VANG' }),
  viec({ id: 3, nhom_dem: 'QUA_HAN', muc_canh_bao: 'DO', vuong_mac: 'Chờ ý kiến về kinh phí' }),
  viec({ id: 4, nhom_dem: 'QUA_HAN', muc_canh_bao: 'DO_DAC_BIET', cap_quyet_dinh: 'TT', ...QT }),
  viec({ id: 5, nhom_dem: 'QUA_HAN', muc_canh_bao: 'DO_DAC_BIET', ...QT }),
  viec({ id: 6, nhom_dem: 'CHO_NGHIEM_THU', muc_canh_bao: 'XANH' }),
  viec({ id: 7, nhom_dem: 'THUONG_XUYEN', muc_canh_bao: 'KHONG_AP_DUNG', han_xu_ly: null, vuong_mac: 'Đề xuất bổ sung' }),
  viec({ id: 8, nhom_dem: 'DANG_DINH_CHINH', muc_canh_bao: 'DO' }),
  viec({ id: 9, nhom_dem: 'HOAN_THANH', muc_canh_bao: 'KHONG_AP_DUNG', ngay_hoan_thanh: '2026-11-20', han_xu_ly: '2026-11-30', ket_qua: 'DUNG_HAN' }),
  viec({ id: 10, nhom_dem: 'HOAN_THANH', muc_canh_bao: 'KHONG_AP_DUNG', ngay_hoan_thanh: '2026-10-05', han_xu_ly: '2026-10-01', ket_qua: 'TRE', ...QT }),
  viec({ id: 11, nhom_dem: 'HOAN_THANH', muc_canh_bao: 'KHONG_AP_DUNG', ngay_hoan_thanh: null, han_xu_ly: '2026-10-01', ket_qua: 'KHONG_DANH_GIA' }),
];
const A1 = { vai: 'A1', me: 'u-cvp', laLanhDaoVP: (id) => id === 'u-pcvp' || id === 'u-cvp', laTruongPhong: () => false };
const CDS = [
  { id: 'c1', nhiem_vu_id: 3, loai: 'CHI_DAO', nguoi_gui: 'u-pcvp', created_at: '2026-11-10T02:00:00Z', han_phan_hoi: '2026-11-20', trang_thai: 'CHO_PHAN_HOI', phan_hoi_luc: null },
  { id: 'c2', nhiem_vu_id: 3, loai: 'CHI_DAO', nguoi_gui: 'u-pcvp', created_at: '2026-11-24T02:00:00Z', han_phan_hoi: '2026-11-30', trang_thai: 'CHO_PHAN_HOI', phan_hoi_luc: null },
  { id: 'c3', nhiem_vu_id: 1, loai: 'CHI_DAO', nguoi_gui: 'u-cvp', created_at: '2026-11-24T02:00:00Z', han_phan_hoi: null, trang_thai: 'CHO_PHAN_HOI', phan_hoi_luc: null },
  { id: 'c4', nhiem_vu_id: 2, loai: 'CHI_DAO', nguoi_gui: 'u-cvp', created_at: '2026-11-05T02:00:00Z', han_phan_hoi: null, trang_thai: 'DA_PHAN_HOI', phan_hoi_luc: '2026-11-21T03:00:00Z' },
  { id: 'c5', nhiem_vu_id: 2, loai: 'CHI_DAO_TT', nguoi_gui: 'u-tt', created_at: '2026-11-05T02:00:00Z', han_phan_hoi: null, trang_thai: 'CHO_PHAN_HOI', phan_hoi_luc: null },
];
const ctx = { cds: CDS, ctxCd: A1, homNay: HOM_NAY };

describe('theTang1 — năm thẻ, các phần cộng đủ', () => {
  const t = theTang1(MAU, nam, ctx);
  test('quá hạn: Đỏ + Đỏ đặc biệt đang mở; việc đang đính chính không tính quá hạn', () => {
    assert.deepEqual(t.qh, { so: 3, do: 1, ddb: 2 });
    assert.equal(t.qh.do + t.qh.ddb, t.qh.so);
  });
  test('cần lãnh đạo cho ý kiến: vướng mắc (kể cả việc thường xuyên) + quá hạn đã ghi cấp cần quyết định; hai phần rời nhau', () => {
    assert.deepEqual(t.quyet, { so: 3, vm: 2, cq: 1 });
    assert.equal(canYKien(MAU[4]), false, 'quá hạn chưa ghi cấp, không vướng mắc');
  });
  test('đang thực hiện trong hạn = mọi việc mở không quá hạn; quá hạn + trong hạn = đang thực hiện', () => {
    assert.deepEqual(t.th, { so: 5, trongHan: 2, vang: 1, khac: 2 });
    assert.equal(t.qh.so + t.th.so, MAU.filter((r) => r.nhom_dem !== 'HOAN_THANH').length);
  });
  test('chỉ đạo chờ phản hồi: số VIỆC (của vai người xem), mỗi việc vào đúng một phần; chỉ đạo Thường trực không tính cho lãnh đạo Văn phòng', () => {
    assert.deepEqual(t.cd, { so: 2, quaHan: 1, trongHan: 1, yKien: 3 });
  });
  test('hoàn thành trong kỳ: tỷ lệ đúng hạn không ghi khi dưới 5 việc xét được; 7 ngày qua theo ngày hoàn thành', () => {
    assert.equal(t.xong.so, 3); assert.equal(t.xong.xet, 2); assert.equal(t.xong.canXet, 3);
    assert.equal(t.xong.tyLe, null); assert.equal(t.xong.tuan, 1); assert.equal(t.xong.boSung, 0);
  });
  test('0141: ghi kèm ngày bổ sung — gọn ở ô, đủ ở ngăn chi tiết; ngày người dùng ghi thì không ghi gì', () => {
    assert.equal(ghiBoSungNht({ ngay_hoan_thanh_bo_sung: 'UOC_TINH' }), ' (bổ sung)');
    assert.equal(ghiBoSungNht({ ngay_hoan_thanh_bo_sung: 'LICH_SU' }, false), ' · ngày bổ sung theo lịch sử cập nhật');
    assert.equal(ghiBoSungNht({ ngay_hoan_thanh_bo_sung: null }), '');
  });
  test('0141: đếm việc xét đúng hạn có ngày hoàn thành bổ sung; "hoàn thành trong 7 ngày qua" chỉ tính ngày thật', () => {
    const t2 = theTang1(MAU.map((r) => (r.id === 9 ? { ...r, ngay_hoan_thanh_bo_sung: 'UOC_TINH' } : r)), nam, ctx);
    assert.equal(t2.xong.boSung, 1);
    assert.equal(t2.xong.tuan, 0, 'ngày ước tính rơi vào 7 ngày qua không tính là vừa hoàn thành');
  });
});

describe('tyLeDungHan — chỉ ghi khi đủ dữ liệu', () => {
  test('ít nhất 5 việc xét được và ít nhất 70% việc có hạn', () => {
    assert.equal(tyLeDungHan(4, 4, 4), null);
    assert.equal(tyLeDungHan(62, 48, 337), null, 'rà soát 25/11: 62/337 không đại diện');
    assert.equal(tyLeDungHan(7, 5, 10), 71);
    assert.equal(tyLeDungHan(6, 3, 10), null);
  });
});

describe('locChiTieu — danh sách bấm từ thẻ bằng đúng số thẻ', () => {
  const t = theTang1(MAU, nam, ctx);
  const dem = (kq) => (kq.rows ? kq.rows.length : kq.nhom.reduce((s, n) => s + n.rows.length, 0));
  const opt = { cds: CDS, ctxCd: A1, homNay: HOM_NAY };
  for (const [khoa, so] of [['qh', t.qh.so], ['quyet', t.quyet.so], ['cdCho', t.cd.so], ['th', t.th.so], ['xong', t.xong.so]]) {
    test(khoa, () => assert.equal(dem(locChiTieu(MAU, { t: khoa }, nam, opt)), so));
  }
  test('mỗi việc chỉ ở một phần của danh sách', () => {
    for (const khoa of ['qh', 'quyet', 'cdCho', 'th']) {
      const ids = locChiTieu(MAU, { t: khoa }, nam, opt).nhom.flatMap((n) => n.rows.map((r) => r.id));
      assert.equal(new Set(ids).size, ids.length, khoa);
    }
  });
  test('tuần: giao mới và hoàn thành của đúng tuần', () => {
    const kq = locChiTieu(MAU, { t: 'tuan', tu: '2026-11-16', den: '2026-11-22', ten: '16/11–22/11' }, nam, opt);
    assert.equal(kq.tieuDe, 'Tuần 16/11–22/11');
    assert.deepEqual(kq.nhom.map((n) => n.rows.map((r) => r.id)), [[], [9]]);
  });
});

describe('tuanTruoc, soSanh — so với bản chụp tuần trước', () => {
  const chup = { ngay: '2026-11-18', rows: [
    { nhiem_vu_id: 3, nhom_dem: 'QUA_HAN', muc_canh_bao: 'DO', co_vuong_mac: false, cap_quyet_dinh: null },
    { nhiem_vu_id: 9, nhom_dem: 'QUA_HAN', muc_canh_bao: 'DO', co_vuong_mac: true, cap_quyet_dinh: null },   // đã hoàn thành trong tuần
    { nhiem_vu_id: 1, nhom_dem: 'DANG_THUC_HIEN', muc_canh_bao: 'XANH', co_vuong_mac: false, cap_quyet_dinh: null },
    { nhiem_vu_id: 99, nhom_dem: 'QUA_HAN', muc_canh_bao: 'DO', co_vuong_mac: false, cap_quyet_dinh: null },  // ngoài tập đang xem
  ] };
  test('chỉ đếm việc trong tập đang xem; việc hoàn thành trong tuần vẫn tính theo lúc chụp', () => {
    assert.deepEqual(tuanTruoc(MAU, chup, ctx), { ngay: '2026-11-18', qh: 2, quyet: 1, th: 1, cd: 2 });
  });
  test('chưa có bản chụp: chỉ còn số chỉ đạo (tính lại từ mốc gửi, phản hồi)', () => {
    assert.deepEqual(tuanTruoc(MAU, null, ctx), { ngay: null, cd: 2 });
  });
  test('soSanh: ghi bằng chữ, con số kèm danh từ', () => {
    assert.equal(soSanh(15, 12).chu, 'tăng 3 nhiệm vụ so với tuần trước');
    assert.equal(soSanh(10, 12).chu, 'giảm 2 nhiệm vụ so với tuần trước');
    assert.equal(soSanh(4, 4).chu, 'không đổi so với tuần trước');
    assert.equal(soSanh(4, null), null);
  });
});

describe('cauKetLuan', () => {
  const t = theTang1(MAU, nam, ctx);
  const khoa = khoaNhom('A1', { TONG_HOP: 'Phòng Tổng hợp', QUAN_TRI: 'Phòng Quản trị' });
  test('quá hạn, nơi nhiều nhất, cần ý kiến, chỉ đạo chờ', () => {
    const nn = nhieuQuaHanNhat(MAU, khoa);
    assert.deepEqual(nn, [['Phòng Quản trị', 2], ['Phòng Tổng hợp', 1]]);
    assert.equal(cauKetLuan(t, { ngay: '2026-11-18', qh: 2 }, { homNay: HOM_NAY, nhieuNhat: nn }),
      'Đến ngày 25/11/2026, có 3 nhiệm vụ quá hạn chưa hoàn thành (tăng 1 nhiệm vụ so với tuần trước), nhiều nhất ở Phòng Quản trị (2 nhiệm vụ) và Phòng Tổng hợp (1 nhiệm vụ); '
      + '3 nhiệm vụ cần lãnh đạo cho ý kiến; 2 nhiệm vụ có chỉ đạo chờ phản hồi, trong đó 1 nhiệm vụ quá hạn phản hồi.');
  });
  test('không có quá hạn; theo bộ lọc; không có việc', () => {
    const t0 = theTang1(MAU.filter((r) => !['QUA_HAN'].includes(r.nhom_dem)), nam, { ...ctx, cds: [] });
    assert.equal(cauKetLuan(t0, { ngay: '2026-11-18', qh: 2 }, { homNay: HOM_NAY, daLoc: true }),
      'Theo bộ lọc đang áp dụng, đến ngày 25/11/2026, không có nhiệm vụ quá hạn chưa hoàn thành (tuần trước có 2 nhiệm vụ); 1 nhiệm vụ cần lãnh đạo cho ý kiến; 5 nhiệm vụ đang thực hiện trong hạn.');
    assert.equal(cauKetLuan(theTang1([], nam, ctx), null, { homNay: HOM_NAY, tong: 0 }), 'Đến ngày 25/11/2026, chưa có nhiệm vụ trong phạm vi theo dõi.');
  });
});

describe('tuanGanDay, xuHuongTuan', () => {
  test('12 tuần thứ Hai đến Chủ nhật, tuần cuối chứa hôm nay', () => {
    const w = tuanGanDay(HOM_NAY);
    assert.equal(w.length, 12);
    assert.deepEqual(w.at(-1), { tu: '2026-11-23', den: '2026-11-29', nhan: '23/11–29/11' });
    assert.equal(w[0].tu, '2026-09-07');
  });
  test('quá hạn cuối tuần từ bản chụp Chủ nhật (lọc theo tập đang xem); tuần này dùng số hiện tại; chưa có bản chụp: null', () => {
    const w = tuanGanDay(HOM_NAY);
    const x = xuHuongTuan(MAU, w, new Map([['2026-11-22', new Set([3, 4, 99])]]), 3);
    assert.deepEqual(x.slice(-2).map((d) => [d.giao, d.xong, d.qh]), [[0, 1, 2], [0, 0, 3]]);
    assert.equal(x[0].qh, null);
  });
});

describe('maTran — ma trận đơn vị theo trạng thái', () => {
  const khoa = khoaNhom('A1', { TONG_HOP: 'Phòng Tổng hợp', QUAN_TRI: 'Phòng Quản trị' });
  const mt = maTran(MAU, nam, khoa);
  test('nhiều việc quá hạn từ N ngày trước; các cột mức cộng đủ số đang mở', () => {
    assert.deepEqual(mt.dong.map((d) => d.ten), ['Phòng Quản trị', 'Phòng Tổng hợp']);
    for (const d of [...mt.dong, mt.tong]) assert.equal(d.ddb + d.do + d.vang + d.th + d.ch, d.mo, d.ten);
    assert.deepEqual([mt.tong.mo, mt.tong.xong, mt.tong.ddb, mt.tong.do], [8, 3, 2, 1]);
  });
  test('ô bấm → danh sách đúng số ô; ô Tổng cộng (ma *) → toàn bộ việc của cột', () => {
    const d = mt.dong[1];
    for (const m of ['ddb', 'do', 'vang', 'th', 'ch', 'xong']) {
      const kq = locChiTieu(MAU, { t: 'nhom', ma: d.ma, ten: d.ten, m }, nam, { khoa });
      assert.equal(kq.rows.length, d[m], m);
      assert.equal(locChiTieu(MAU, { t: 'nhom', ma: '*', ten: 'Toàn bộ phạm vi', m }, nam, { khoa }).rows.length, mt.tong[m], `tổng ${m}`);
    }
  });
});
