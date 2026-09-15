// Unit test module thuần của KL (GĐ10): tổng hợp, sắp xếp, lọc, ngày theo giờ Việt Nam. Chạy `npm test` trong frontend/
// (node:test, không cần trình duyệt hay Supabase). Bộ số 146/16/8/6/6/3/0 = 185 là bộ số chuẩn 14/9/2026 của chủ dự án.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { demTheoNhom, tongHop, sapXep, locRows, theoNganhLinhVuc, theoChuTriMo, theoHoiNghi, chatLuong, kiemBatBien, CHUA_PHAN_LOAI, CHUA_CO_NGANH } from '../src/lib/kl/tong-hop.js';
import { homNayVN, soNgay, formatNgay, congNgay, ghiChuHan, ngayTruoc, ngayTrongMinhChung } from '../src/lib/kl/ngay.js';
import { nhanTrangThai, THU_TU_NHOM } from '../src/lib/kl/nhan.js';

const MOC = { HOAN_THANH: 146, THUONG_XUYEN: 16, QUA_HAN: 8, DANG_THUC_HIEN: 6, CHO_DIEU_KIEN: 6, CAN_DIEN_HAN: 3, SAP_DEN_HAN: 0 };

// Sinh 185 dòng giả theo bộ số chuẩn: 52 dòng có lĩnh vực, 133 NULL (như production 15/9), 1 dòng không ngành.
function boMau() {
  const rows = [];
  let i = 0;
  for (const [nhom, so] of Object.entries(MOC)) {
    for (let k = 0; k < so; k++, i++) {
      const coLV = i < 52;
      rows.push({
        id: `id-${i}`, ma: `NV-${String(i + 1).padStart(3, '0')}`, noi_dung: `Nhiệm vụ ${i + 1}`, nhom_dem: nhom,
        so_hoi_nghi: 1 + (i % 38), ngay_ban_hanh: '2025-11-01', chu_tri_id: `cv${i % 9}`, chu_tri_ten: `Chuyên viên ${i % 9}`, chu_tri_phong: 'TONG_HOP',
        nganh_ma: i === 100 ? null : `N${i % 12}`, nganh_ten: i === 100 ? null : `${(i % 12) + 1}. Ngành ${i % 12}`,
        linh_vuc_ma: coLV ? `LV${i % 5}` : null, linh_vuc_ten: coLV ? `Lĩnh vực ${i % 5}` : null,
        han_xu_ly: nhom === 'QUA_HAN' ? '2026-08-20' : nhom === 'THUONG_XUYEN' ? null : '2026-10-01',
        so_ngay_qua: nhom === 'QUA_HAN' ? 5 + k : null, tuoi_ngay: 300 - k, so_chi_dao_cho_phan_hoi: 0,
        thieu_minh_chung: nhom === 'HOAN_THANH' && k < 78, ngay_hoan_thanh: nhom === 'HOAN_THANH' && k >= 78 ? '2026-08-01' : null,
        ket_qua: nhom === 'HOAN_THANH' ? (k >= 78 ? 'DUNG_HAN' : 'KHONG_DANH_GIA') : null, so_ngay_tre: null,
        do_tre_nhap_lieu: nhom === 'HOAN_THANH' && k >= 140 ? k - 140 : null, dang_dinh_chinh: false,
        cap_nhat_luc: nhom === 'DANG_THUC_HIEN' && k < 2 ? '2026-06-01T03:00:00Z' : '2026-09-14T03:00:00Z',
      });
    }
  }
  return rows;
}

describe('tổng hợp — bất biến và bộ số chuẩn', () => {
  const rows = boMau();
  test('185 dòng → đếm theo nhóm đúng 146/16/8/6/6/3/0; tổng các nhóm = tổng dòng', () => {
    const d = demTheoNhom(rows);
    assert.deepEqual(d, { ...Object.fromEntries(THU_TU_NHOM.map((k) => [k, 0])), ...MOC });
    assert.equal(Object.values(d).reduce((a, b) => a + b, 0), 185);
    const bb = kiemBatBien(rows);
    assert.equal(bb.dung, true); assert.deepEqual(bb.nhomLa, []);
  });
  test('tongHop: tỷ lệ, chưa minh chứng 78, tuổi cần điền hạn lớn nhất, đang mở', () => {
    const t = tongHop(rows);
    assert.equal(t.tong, 185); assert.equal(t.tyLeHoanThanh, 79); assert.equal(t.hoanThanhChuaMinhChung, 78);
    assert.equal(t.tuoiLonNhatCanDienHan, 300); assert.equal(t.dangMo, 8 + 6 + 6 + 3);
  });
  test('lọc theo nhóm cho đúng số dòng của ô; lĩnh vực NULL thành "Chưa phân loại" = 133, không mất khỏi tổng', () => {
    for (const [nhom, so] of Object.entries(MOC)) assert.equal(locRows(rows, { nhom }).length, so, nhom);
    assert.equal(locRows(rows, { linhVuc: CHUA_PHAN_LOAI }).length, 133);
    assert.equal(locRows(rows, { linhVuc: 'LV0' }).length + locRows(rows, { linhVuc: 'LV1' }).length + locRows(rows, { linhVuc: 'LV2' }).length
      + locRows(rows, { linhVuc: 'LV3' }).length + locRows(rows, { linhVuc: 'LV4' }).length + 133, 185);
    assert.equal(locRows(rows, { nganh: CHUA_CO_NGANH }).length, 1);
    assert.equal(locRows(rows, { tuKhoa: 'nv-001' }).length, 1);
    assert.equal(locRows(rows, { nhom: 'HOAN_THANH', thieuMinhChung: true }).length, 78);
  });
  test('theoNganhLinhVuc: tổng mọi ô = 185, ngành không tên xếp cuối, "Chưa phân loại" xếp cuối mỗi ngành', () => {
    const n = theoNganhLinhVuc(rows);
    assert.equal(n.reduce((s, x) => s + x.so, 0), 185);
    assert.equal(n.reduce((s, x) => s + x.linhVuc.reduce((t, l) => t + l.so, 0), 0), 185);
    assert.equal(n.at(-1).ma, CHUA_CO_NGANH);
    n.slice(0, -1).forEach((x) => { const cpl = x.linhVuc.findIndex((l) => l.ma === CHUA_PHAN_LOAI); if (cpl >= 0) assert.equal(cpl, x.linhVuc.length - 1); });
    assert.equal(n.flatMap((x) => x.linhVuc).filter((l) => l.ma === CHUA_PHAN_LOAI).reduce((s, l) => s + l.so, 0), 133);
  });
  test('theoChuTriMo chỉ đếm việc đang mở (23), tổng theo chủ trì = 23; theoHoiNghi lấy 8 hội nghị số lớn nhất, tỷ lệ 0–100', () => {
    const c = theoChuTriMo(rows);
    assert.equal(c.reduce((s, x) => s + x.so, 0), 23);
    assert.ok(c.every((x) => x.nhom.HOAN_THANH === 0 && x.nhom.THUONG_XUYEN === 0));
    const h = theoHoiNghi(rows, 8);
    assert.equal(h.length, 8); assert.equal(h[0].so_hoi_nghi, 38);
    assert.ok(h.every((x) => x.tyLe >= 0 && x.tyLe <= 100 && x.hoanThanh <= x.tong));
    assert.equal(theoHoiNghi(rows, 100).reduce((s, x) => s + x.tong, 0), 185);
  });
  test('chatLuong: 78 chưa minh chứng, 78 không ngày gốc, 2 việc mở không cập nhật > 30 ngày, độ trễ TB/max', () => {
    const q = chatLuong(rows, 30, new Date('2026-09-15T08:00:00Z'));
    assert.equal(q.hoanThanhChuaMinhChung, 78); assert.equal(q.hoanThanhKhongNgayGoc, 78); assert.equal(q.moKhongCapNhat, 2);
    assert.equal(q.doTreLonNhat, 5); assert.equal(q.doTreTrungBinh, 2.5); assert.equal(q.soDongCoDoTre, 6);
  });
  test('sapXep: chỉ đạo chờ phản hồi lên đầu, rồi quá hạn nhiều ngày trước, hoàn thành cuối', () => {
    const r = rows.map((x) => ({ ...x }));
    r[184].so_chi_dao_cho_phan_hoi = 1; // một dòng cần điền hạn có chỉ đạo chờ
    const s = sapXep(r);
    assert.equal(s[0].id, r[184].id);
    assert.equal(s[1].nhom_dem, 'QUA_HAN'); assert.equal(s[1].so_ngay_qua, 12);
    assert.equal(s.at(-1).nhom_dem, 'HOAN_THANH');
    assert.equal(s.length, 185);
  });
  test('nhanTrangThai', () => {
    assert.equal(nhanTrangThai({ nhom_dem: 'QUA_HAN', so_ngay_qua: 30 }), 'Quá hạn · 30 ngày');
    assert.equal(nhanTrangThai({ nhom_dem: 'HOAN_THANH', ket_qua: 'TRE', so_ngay_tre: 5 }), 'Hoàn thành trễ 5 ngày');
    assert.equal(nhanTrangThai({ nhom_dem: 'CAN_DIEN_HAN', tuoi_ngay: 290 }), 'Cần điền hạn · 290 ngày tuổi');
  });
});
describe('ngày theo giờ Việt Nam', () => {
  test('homNayVN: 18:30 UTC ngày 14/9 = 01:30 ngày 15/9 giờ VN; 16:59 UTC vẫn là 14/9', () => {
    assert.equal(homNayVN(new Date('2026-09-14T18:30:00Z')), '2026-09-15');
    assert.equal(homNayVN(new Date('2026-09-14T16:59:00Z')), '2026-09-14');
    assert.equal(homNayVN(new Date('2026-09-14T17:00:00Z')), '2026-09-15');
  });
  test('soNgay, congNgay, formatNgay, ghiChuHan, ngayTruoc (mốc 18:30 UTC tính là hôm sau)', () => {
    assert.equal(soNgay('2026-08-15', '2026-09-14'), 30);
    assert.equal(congNgay('2026-08-31', 1), '2026-09-01');
    assert.equal(formatNgay('2026-09-05'), '5/9/2026'); assert.equal(formatNgay(null), '');
    assert.equal(ghiChuHan('2026-09-10', '2026-09-14'), 'Quá 4 ngày');
    assert.equal(ghiChuHan('2026-09-14', '2026-09-14'), 'Đến hạn hôm nay');
    assert.equal(ghiChuHan('2026-09-21', '2026-09-14'), 'Còn 7 ngày');
    assert.equal(ghiChuHan(null, '2026-09-14'), '');
    assert.equal(ngayTruoc('2026-09-13T18:30:00Z', new Date('2026-09-15T02:00:00Z')), 1, '18:30 UTC 13/9 = 14/9 VN → 1 ngày trước 15/9');
  });
  test('ngayTrongMinhChung: "Số 12/CV-VPTU ngày 5/9/2026" → 2026-09-05; không có ngày → null; tháng 13 → null', () => {
    assert.equal(ngayTrongMinhChung('Số 12/CV-VPTU ngày 5/9/2026'), '2026-09-05');
    assert.equal(ngayTrongMinhChung('CV 12'), null);
    assert.equal(ngayTrongMinhChung('1/13/2026'), null);
  });
});
