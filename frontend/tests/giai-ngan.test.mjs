// Unit test giải ngân vốn (v3.28, 0119): số kiểu Việt Nam, tỷ lệ, tiến độ đều theo ngày số liệu (tính cả ngày đầu, ngày cuối), bốn mức và ngưỡng,
// số liệu cũ, kiểm tra một kỳ (lệch tổng, lũy kế giảm, kế hoạch đổi), tổng hợp năm (kỳ mới nhất, chủ đầu tư thấp trước, số mới nhất của từng đối
// tượng), nhiệm vụ theo dõi; đọc bảng dán / chữ PDF / HTML Excel, đơn vị, kiểu số, tên chuẩn (dấu thanh kiểu cũ), khớp tên với kỳ trước.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { soVN, soCoDau, ptVN, tyLe, namHienThi, canDatTai, mucGiaiNgan, nhanMuc, moTaMuc, kiemTraKy, lechTong, tongHopNam, soCuaNhiemVu, mucCuaNhiemVu,
  dienBienDoiTuong, viecTheoDoi, duoiMucChung, nguoiNhap, duocNhapKy } from '../src/lib/kl/giai-ngan.js';
import { docSo, doanKieuSo, bangTuChu, bangTuChuPdf, bangTuHtml, bangTuDan, doanCot, nhanCot, docBang, goiYDonVi, donViTheoChu, dongTong, tenGon, tenChuan, khopTen, laDongChiSo }
  from '../src/lib/kl/giai-ngan-bang.js';

const NAM = 2026;
const muc = (o) => mucGiaiNgan({ nam: NAM, homNay: '2026-10-21', ...o });

describe('số và tỷ lệ', () => {
  test('số kiểu Việt Nam, có dấu, phần trăm', () => {
    assert.equal(soVN(2054.516), '2.054,516');
    assert.equal(soVN(8473.913), '8.473,913');
    assert.equal(soVN(0), '0');
    assert.equal(soVN(null), '—');
    assert.equal(soVN(24.24, 1), '24,2');
    assert.equal(soCoDau(12.5), '+12,5'); assert.equal(soCoDau(-3.2), '−3,2'); assert.equal(soCoDau(0), '0');
    assert.equal(ptVN(24.2), '24,2%'); assert.equal(ptVN(null), '—');
  });
  test('tỷ lệ một chữ số thập phân; kế hoạch 0 / thiếu → null', () => {
    assert.equal(tyLe(2054.516, 8473.913), 24.2);
    assert.equal(tyLe(1249.896, 8473.913), 14.7, 'UBND tỉnh làm tròn "15%"');
    assert.equal(tyLe(5, 0), null); assert.equal(tyLe(null, 10), null);
  });
  test('năm hiển thị: tháng 1 vẫn là năm trước (giải ngân tới 31/1 năm sau)', () => {
    assert.equal(namHienThi('2027-01-15'), 2026);
    assert.equal(namHienThi('2026-10-21'), 2026);
    assert.equal(namHienThi('2027-02-01'), 2027);
  });
});

describe('tiến độ đều và mức', () => {
  test('tiến độ đều tính cả ngày đầu và ngày cuối; sau mốc = mục tiêu', () => {
    assert.ok(Math.abs(canDatTai('2026-07-31', { nam: NAM }) - (212 / 365) * 100) < 1e-9);
    assert.equal(canDatTai('2026-12-31', { nam: NAM }), 100);
    assert.equal(canDatTai('2027-01-20', { nam: NAM }), 100);
    assert.ok(Math.abs(canDatTai('2026-06-30', { nam: NAM, mucTieuPt: 80, mucTieuNgay: '2026-09-30' }) - (80 * 181) / 273) < 1e-9);
    assert.equal(canDatTai('2026-10-15', { nam: NAM, mucTieuPt: 80, mucTieuNgay: '2026-09-30' }), 80);
  });
  test('số liệu thật của Cao Bằng: 31/7 ước 24% → chậm nhiều; 30/6 15% → chậm nhiều', () => {
    const m = muc({ da: 2054.516, kh: 8473.913, ngaySoLieu: '2026-07-31' });
    assert.equal(m.muc, 'CHAM_NHIEU'); assert.equal(m.pt, 24.2); assert.equal(m.canDat, 58.1); assert.equal(m.thieu, 33.9);
    assert.equal(nhanMuc(m), 'Chậm nhiều 33,9 điểm %');
    assert.equal(moTaMuc(m), 'Tiến độ đều đến 31/7/2026: 58,1% — mục tiêu 100% kế hoạch vốn trước 31/12/2026');
    assert.equal(m.cu, true, 'đến 21/10 đã 82 ngày — nhắc cập nhật');
    assert.equal(muc({ da: 1249.896, kh: 8473.913, ngaySoLieu: '2026-06-30' }).muc, 'CHAM_NHIEU');
  });
  test('ngưỡng: thiếu ≤ 10 đúng tiến độ, ≤ 20 chậm, > 20 chậm nhiều; đạt; tới mốc chưa đạt', () => {
    const can = Math.round((273 / 365) * 1000) / 10;   // 30/9: 74,8%
    assert.equal(can, 74.8);
    assert.equal(muc({ da: 64.8, kh: 100, ngaySoLieu: '2026-09-30' }).muc, 'DUNG', 'thiếu đúng 10,0');
    assert.equal(muc({ da: 64.7, kh: 100, ngaySoLieu: '2026-09-30' }).muc, 'CHAM', 'thiếu 10,1');
    assert.equal(muc({ da: 54.8, kh: 100, ngaySoLieu: '2026-09-30' }).muc, 'CHAM', 'thiếu đúng 20,0');
    assert.equal(muc({ da: 54.7, kh: 100, ngaySoLieu: '2026-09-30' }).muc, 'CHAM_NHIEU', 'thiếu 20,1');
    assert.equal(nhanMuc(muc({ da: 60, kh: 100, ngaySoLieu: '2026-09-30' })), 'Chậm 14,8 điểm %');
    assert.equal(muc({ da: 80, kh: 100, ngaySoLieu: '2026-09-30' }).muc, 'DUNG', 'vượt tiến độ đều');
    assert.equal(muc({ da: 100, kh: 100, ngaySoLieu: '2026-09-30' }).muc, 'DAT');
    assert.equal(muc({ da: 81, kh: 100, ngaySoLieu: '2026-09-30', mucTieuPt: 80, mucTieuNgay: '2026-11-30' }).muc, 'DAT', 'mục tiêu riêng 80%');
    const qua = muc({ da: 85, kh: 100, ngaySoLieu: '2026-12-31' });
    assert.equal(qua.muc, 'CHAM_NHIEU'); assert.equal(qua.quaMoc, true); assert.equal(nhanMuc(qua), 'Đến mốc 31/12/2026 còn thiếu 15 điểm %');
    const cu = mucGiaiNgan({ nam: NAM, da: 70, kh: 100, ngaySoLieu: '2026-09-30', homNay: '2027-01-05' });
    assert.equal(cu.muc, 'DUNG', 'hôm nay qua mốc nhưng số liệu chưa tới mốc: xét theo ngày số liệu');
    assert.equal(cu.cu, true, 'trước 31/1 năm sau vẫn nhập được kỳ mới');
    assert.equal(mucGiaiNgan({ nam: NAM, da: 70, kh: 100, ngaySoLieu: '2026-09-30', homNay: '2027-06-01' }).cu, false, 'năm đã khép (qua 31/1 năm sau): không nhắc');
    assert.equal(mucGiaiNgan({ nam: NAM, da: 85, kh: 100, ngaySoLieu: '2026-11-30', mucTieuNgay: '2026-11-30', homNay: '2027-01-20' }).cu, false, 'số liệu đã tới mốc (51 ngày): không nhắc');
    assert.equal(mucGiaiNgan({ nam: NAM, da: 85, kh: 100, ngaySoLieu: '2026-11-30', homNay: '2027-01-20' }).cu, true, 'chưa tới mốc 31/12, 51 ngày: nhắc');
    assert.equal(muc({ da: null, kh: 100, ngaySoLieu: '2026-09-30' }).muc, 'CHUA_CO');
    assert.equal(nhanMuc({ muc: 'CHUA_CO' }), 'Chưa có số liệu');
  });
  test('quyền hiển thị: không Thường trực / khoá / hệ thống; lãnh đạo VP hoặc chủ trì, người theo dõi việc toàn tỉnh', () => {
    assert.equal(nguoiNhap({ role_group: 'A0' }), false);
    assert.equal(nguoiNhap({ role_group: 'A3', bi_khoa: true }), false);
    assert.equal(duocNhapKy({ id: 'a', role_group: 'A1' }, null), true);
    assert.equal(duocNhapKy({ id: 'c', role_group: 'A3' }, { owner_tai_khoan: 'c' }), true);
    assert.equal(duocNhapKy({ id: 'c', role_group: 'A3' }, { owner_tai_khoan: 'x', nguoi_theo_doi: 'y' }), false);
  });
});

const KY = [
  { id: 'k1', nam: NAM, ngay_so_lieu: '2026-06-30', ke_hoach: 8473.913, da_giai_ngan: 1249.896, uoc_tinh: false },
  { id: 'k2', nam: NAM, ngay_so_lieu: '2026-07-31', ke_hoach: 8473.913, da_giai_ngan: 2054.516, uoc_tinh: true },
];
const D = (ky_id, loai, ten, kh, da, thu_tu = 1) => ({ ky_id, loai, ten, ten_chuan: tenChuan(ten), kh, ke_hoach: kh, da_giai_ngan: da, thu_tu });
const DONG = [
  D('k1', 'CHU_DAU_TU', 'Ban QLDA đầu tư xây dựng tỉnh', 3000, 300), D('k1', 'CHU_DAU_TU', 'UBND huyện Hoà An', 500, 100, 2),
  D('k2', 'NGUON', 'Vốn kéo dài', 667.417, 213.573), D('k2', 'NGUON', 'Vốn kế hoạch năm 2026', 7806.496, 1840.943, 2),
  D('k2', 'CHU_DAU_TU', 'Ban QLDA đầu tư xây dựng tỉnh', 3000, 900), D('k2', 'CHU_DAU_TU', 'Sở Giao thông vận tải', 1000, 50, 2),
];
const GAN = [
  { nhiem_vu_id: 'tt', nam: NAM, loai: 'TOAN_TINH', ten: null, ten_chuan: null, muc_tieu_pt: 100, muc_tieu_ngay: '2026-12-31' },
  { nhiem_vu_id: 'hoa-an', nam: NAM, loai: 'CHU_DAU_TU', ten: 'UBND huyện Hòa An', ten_chuan: tenChuan('UBND huyện Hòa An'), muc_tieu_pt: 60, muc_tieu_ngay: '2026-12-31' },
  { nhiem_vu_id: 'ban', nam: NAM, loai: 'CHU_DAU_TU', ten: 'Ban QLDA đầu tư xây dựng tỉnh', ten_chuan: tenChuan('Ban QLDA đầu tư xây dựng tỉnh'), muc_tieu_pt: 100, muc_tieu_ngay: '2026-12-31' },
  { nhiem_vu_id: 'khac-nam', nam: 2025, loai: 'TOAN_TINH', ten: null, ten_chuan: null, muc_tieu_pt: 100, muc_tieu_ngay: '2025-12-31' },
];

describe('kiểm tra kỳ và tổng hợp năm', () => {
  test('lệch tổng theo loại (kèm số tiền), vượt kế hoạch, lũy kế giảm / cao hơn kỳ sau, kế hoạch đổi', () => {
    const k2 = KY[1]; const dong2 = DONG.filter((d) => d.ky_id === 'k2');
    assert.equal(lechTong(k2, dong2, 'NGUON').lech, false, 'hai nguồn cộng đúng số tổng');
    const l = lechTong(k2, dong2, 'CHU_DAU_TU');
    assert.equal(l.lech, true); assert.equal(l.lechKh, -4473.913); assert.equal(l.lechDa, -1104.516);
    const kq = kiemTraKy(k2, dong2, KY);
    assert.equal(kq.length, 1); assert.match(kq[0], /Tổng các chủ đầu tư, đơn vị \(2 dòng\) lệch số tổng của kỳ: kế hoạch −4\.473,913, đã giải ngân −1\.104,516 tỷ đồng\./);
    const giam = kiemTraKy({ ngay_so_lieu: '2026-08-31', ke_hoach: 9000, da_giai_ngan: 2000 }, [], KY);
    assert.ok(giam.some((x) => /thấp hơn kỳ đến 31\/7\/2026 \(2\.054,516 tỷ đồng\)/.test(x)));
    assert.ok(giam.some((x) => /Kế hoạch vốn năm đổi từ 8\.473,913 thành 9\.000 tỷ đồng/.test(x)));
    const bu = kiemTraKy({ ngay_so_lieu: '2026-05-31', ke_hoach: 8473.913, da_giai_ngan: 1500 }, [], KY);
    assert.ok(bu.some((x) => /cao hơn kỳ sau đến 30\/6\/2026/.test(x)), 'nhập bù kỳ cũ');
    assert.ok(kiemTraKy({ ngay_so_lieu: '2026-09-30', ke_hoach: 10, da_giai_ngan: 11 }, [], []).some((x) => /lớn hơn kế hoạch/.test(x)));
    const motPhan = kiemTraKy(k2, [D('k2', 'NGUON', 'A', 8473.913, 2000)], []);
    assert.deepEqual(motPhan, ['Tổng các nguồn vốn (1 dòng) lệch số tổng của kỳ: đã giải ngân −54,516 tỷ đồng.'], 'chỉ ghi phần lệch');
  });
  test('tổng hợp: kỳ mới nhất, mức theo mục tiêu việc toàn tỉnh, điểm biểu đồ, chủ đầu tư thấp trước, số mới nhất từng đối tượng', () => {
    const th = tongHopNam({ nam: NAM, ky: KY, dong: DONG, gan: GAN }, '2026-08-05');
    assert.equal(th.moi.id, 'k2'); assert.equal(th.tt.nhiem_vu_id, 'tt');
    assert.equal(th.muc.muc, 'CHAM_NHIEU'); assert.equal(th.muc.pt, 24.2);
    assert.deepEqual(th.diem.map((d) => [d.ngay, d.pt, d.uoc]), [['2026-06-30', 14.7, false], ['2026-07-31', 24.2, true]]);
    assert.deepEqual(th.nguon.map((d) => d.ten), ['Vốn kéo dài', 'Vốn kế hoạch năm 2026']);
    assert.deepEqual(th.chuDauTu.map((d) => d.ten), ['Sở Giao thông vận tải', 'Ban QLDA đầu tư xây dựng tỉnh'], 'tỷ lệ thấp trước (5% < 30%)');
    assert.equal(duoiMucChung(th.chuDauTu[0], th.muc.pt), true); assert.equal(duoiMucChung(th.chuDauTu[1], th.muc.pt), false);
    assert.equal(th.canhBao.length, 1, 'lệch tổng chủ đầu tư của kỳ mới nhất');
    // Hòa An chỉ có ở kỳ 30/6 ("Hoà An" — cùng tên chuẩn): việc gắn vẫn có số, ghi đúng ngày số liệu.
    const hoaAn = soCuaNhiemVu(GAN[1], th);
    assert.deepEqual([hoaAn.da, hoaAn.kh, hoaAn.ngay], [100, 500, '2026-06-30']);
    const mHoaAn = mucCuaNhiemVu(GAN[1], th, '2026-08-05');
    assert.equal(mHoaAn.mucTieu, 60); assert.equal(mHoaAn.pt, 20);
    assert.equal(soCuaNhiemVu(GAN[0], th).da, 2054.516);
    assert.equal(soCuaNhiemVu(GAN[3], th), null, 'việc của năm khác');
    assert.deepEqual(dienBienDoiTuong(GAN[2], th, DONG).map((x) => [x.ky.id, x.pt]), [['k1', 10], ['k2', 30]]);
    assert.deepEqual(dienBienDoiTuong(GAN[0], th, DONG).map((x) => x.pt), [14.7, 24.2]);
    const rows = [{ id: 'ban', ma: 'NV-2' }, { id: 'tt', ma: 'NV-1' }, { id: 'hoa-an', ma: 'NV-3' }, { id: 'khong-gan', ma: 'NV-4' }];
    const ds = viecTheoDoi(rows, GAN, th, '2026-08-05');
    assert.deepEqual(ds.map((x) => [x.r.id, x.m.muc, x.m.thieu]), [['tt', 'CHAM_NHIEU', 33.9], ['ban', 'CHAM_NHIEU', 28.1], ['hoa-an', 'DUNG', 9.8]],
      'chậm nhiều, thiếu nhiều trước (Hòa An mục tiêu 60%: cần 29,8% tại 30/6, đạt 20%); việc không gắn bị bỏ');
  });
  test('năm chưa có kỳ: chưa có số liệu, không lỗi', () => {
    const th = tongHopNam({ nam: NAM, ky: [], dong: [], gan: [] }, '2026-10-21');
    assert.equal(th.moi, null); assert.equal(th.muc.muc, 'CHUA_CO'); assert.deepEqual(th.diem, []); assert.deepEqual(th.canhBao, []);
  });
});

describe('đọc bảng', () => {
  test('ô số: kiểu Việt / Anh, âm trong ngoặc, ô trống, khoảng trắng mảnh, chữ', () => {
    assert.equal(docSo('1.234,567'), 1234.567);
    assert.equal(docSo('1,234.567', 'en'), 1234.567);
    assert.equal(docSo('(12,5)'), -12.5);
    assert.equal(docSo('-'), null); assert.equal(docSo('x'), null); assert.equal(docSo(''), null);
    assert.equal(docSo('12 345,6'), 12345.6);
    assert.ok(Number.isNaN(docSo('abc')));
    assert.equal(docSo(2054.516), 2054.516);
    assert.equal(docSo('24,2%'), 24.2);
  });
  test('kiểu số của bảng: theo ô không mơ hồ; chỉ ô mơ hồ → kiểu Việt', () => {
    assert.equal(doanKieuSo(['1.234,5', '2,054']), 'vi');
    assert.equal(doanKieuSo(['1,234.5', '2,054']), 'en');
    assert.equal(doanKieuSo(['667,417', '420,000']), 'vi');
    assert.equal(doanKieuSo(['1,234,567']), 'en');
  });
  test('dán chữ có tab (ô có xuống dòng trong ngoặc kép như Excel chép)', () => {
    assert.deepEqual(bangTuChu('STT\tTên\tKH\n1\t"Ban QLDA\ntỉnh"\t1.234,5\n\n2\tSở GTVT\t100'), [['STT', 'Tên', 'KH'], ['1', 'Ban QLDA\ntỉnh', '1.234,5'], ['2', 'Sở GTVT', '100']]);
  });
  test('HTML của Excel: giá trị gốc x:num, colspan, ký tự đặc biệt', () => {
    const html = '<table><tr><td colspan=2>Tên &amp; mã</td><td>KH</td></tr><tr><td>1</td><td>Ban<br>QLDA</td><td x:num="1234.567">1.234,567</td></tr></table>';
    assert.deepEqual(bangTuHtml(html), [['Tên & mã', 'Tên & mã', 'KH'], ['1', 'Ban QLDA', 1234.567]], 'ô gộp ngang có chữ: lặp ở các ô nó phủ');
    assert.equal(bangTuHtml('<p>không có bảng</p>'), null);
    assert.deepEqual(bangTuHtml('<table><tr><td>A</td><td sdval="2054.516" sdnum="1066;">2.054,52</td></tr></table>'), [['A', 2054.516]], 'LibreOffice: sdval');
    assert.equal(bangTuDan('a\tb', '<table><tr><td>x</td></tr></table>')[0][0], 'x', 'ưu tiên bảng HTML');
  });
  test('chữ chép từ PDF: tên + số cuối dòng, số thứ tự bị bỏ, tên có số không bị cắt, tên xuống dòng nối lại', () => {
    const t = ['Đơn vị: triệu đồng', 'STT Chủ đầu tư Kế hoạch Giải ngân Tỷ lệ', '1 Ban QLDA đầu tư xây dựng 1.234.567 456.789 37,0',
      'công trình dân dụng', '2 Ban QLDA giao thông số 2 98.000 12.000 12,2', 'Tổng cộng 1.332.567 468.789 35,2'].join('\n');
    const b = bangTuChuPdf(t);
    assert.deepEqual(b[2], ['Ban QLDA đầu tư xây dựng công trình dân dụng', '1.234.567', '456.789', '37,0']);
    assert.deepEqual(b[3], ['Ban QLDA giao thông số 2', '98.000', '12.000', '12,2']);
    assert.equal(donViTheoChu(b), 'trieu');
    const c = doanCot(b);
    assert.deepEqual([c.ten, c.kh, c.da, c.tuDong, c.coTieuDe], [0, 1, 2, 2, false], 'không có tiêu đề nhận ra được: dữ liệu từ dòng có số đầu tiên');
    const ds = docBang(b, { cot: c, tuDong: c.tuDong, kieu: doanKieuSo(b.flat()), donVi: goiYDonVi(b, c, c.tuDong, 'vi') });
    const ban = ds.find((d) => d.ten.startsWith('Ban QLDA đầu tư'));
    assert.deepEqual([ban.kh, ban.da, ban.chon], [1234.567, 456.789, true]);
    assert.equal(dongTong(ds).kh, 1332.567);
  });
  test('tiêu đề hai dòng: "Giải ngân" gộp trên "Trong tháng | Lũy kế" — lấy cột lũy kế (dán tab và HTML có rowspan / colspan); dòng chú thích không làm nhiễu', () => {
    const tsv = bangTuChu(['Đơn vị: tỷ đồng', 'STT\tChủ đầu tư\tKế hoạch\tGiải ngân\t\tTỷ lệ', '\t\t\tTrong tháng\tTừ đầu năm\t', '1\tBan A\t100\t5\t40\t40'].join('\n'));
    assert.deepEqual(doanCot(tsv), { tuDong: 3, ten: 1, kh: 2, da: 4, coTieuDe: true });
    const html = `<table><tr><td colspan="6">Biểu 2 — Đơn vị: triệu đồng</td></tr><tr><td rowspan="2">STT</td><td rowspan="2">Chủ đầu tư</td><td rowspan="2">Kế hoạch vốn năm</td>
      <td colspan="2">Giải ngân</td><td rowspan="2">Tỷ lệ</td></tr><tr><td>Trong tháng</td><td>Lũy kế đến 30/9</td></tr>
      <tr><td>1</td><td>Ban A</td><td x:num="100000">100.000</td><td x:num="5000">5.000</td><td x:num="40000">40.000</td><td>40</td></tr></table>`;
    const b = bangTuHtml(html);
    assert.deepEqual(b[2], ['STT', 'Chủ đầu tư', 'Kế hoạch vốn năm', 'Trong tháng', 'Lũy kế đến 30/9', 'Tỷ lệ'], 'rowspan giữ đúng cột');
    assert.deepEqual(doanCot(b), { tuDong: 3, ten: 1, kh: 2, da: 4, coTieuDe: true });
    assert.deepEqual(nhanCot(b, 3).slice(3, 5), ['Giải ngân Trong tháng', 'Giải ngân Lũy kế đến 30/9'], 'nhãn ô chọn cột ghép hai dòng');
    assert.equal(goiYDonVi(b, doanCot(b), 3, 'vi'), 'trieu');
  });
  test('dòng dữ liệu đầu chỉ có một ô số vẫn giữ; dòng nhóm / chỉ số cột không lẫn vào tiêu đề (rà soát lần 2)', () => {
    const c1 = bangTuChu('Tên\tKế hoạch\tĐã giải ngân\nBan A\t100\t-\nBan B\t200\t50');
    assert.deepEqual(doanCot(c1), { tuDong: 1, ten: 0, kh: 1, da: 2, coTieuDe: true }, 'dòng "Ban A" chỉ một ô số không bị bỏ');
    assert.deepEqual(docBang(c1, { cot: doanCot(c1), tuDong: 1 }).map((d) => [d.ten, d.kh, d.da, d.chon]), [['Ban A', 100, null, true], ['Ban B', 200, 50, true]]);
    const c2 = bangTuChu('Tên\tKế hoạch\tĐã giải ngân\nTổng cộng\t170\t-\nBan A\t100\t-\nBan B\t70\t50');
    assert.equal(dongTong(docBang(c2, { cot: doanCot(c2), tuDong: doanCot(c2).tuDong })).kh, 170, 'dòng tổng đầu bảng vẫn điền số tổng');
    for (const nhom of ['A\tVốn kế hoạch các năm trước kéo dài\t\t', 'I\tCác dự án thực hiện năm 2026\t\t']) {
      assert.deepEqual(doanCot(bangTuChu(`STT\tNguồn vốn\tKế hoạch\tLũy kế\n${nhom}\n1\tVốn X\t100\t50`)), { tuDong: 2, ten: 1, kh: 2, da: 3, coTieuDe: true }, nhom);
    }
    const c3 = bangTuChu('STT\tNguồn vốn\tKế hoạch\tLũy kế\nA\tB\t1\t2\n1\tVốn X\t100\t50');
    assert.deepEqual(doanCot(c3), { tuDong: 2, ten: 1, kh: 2, da: 3, coTieuDe: true }, 'dòng chỉ số cột A | B | 1 | 2 thuộc tiêu đề');
    assert.deepEqual(docBang(c3, { cot: doanCot(c3), tuDong: 1 }).map((d) => d.ten), ['Vốn X'], 'chọn "Dữ liệu từ" lên dòng chỉ số: vẫn bỏ qua');
    assert.deepEqual(nhanCot(c3, 2), ['STT', 'Nguồn vốn', 'Kế hoạch', 'Lũy kế']);
    const h = bangTuHtml(`<table><tr><td>STT</td><td>Đơn vị</td><td>Kế hoạch</td><td>Lũy kế</td></tr><tr><td colspan="4">II. CÁC XÃ, PHƯỜNG</td></tr>
      <tr><td>1</td><td>UBND xã A</td><td>10</td><td>5</td></tr></table>`);
    assert.deepEqual(docBang(h, { cot: { ten: 1, kh: 2, da: 3 }, tuDong: 1 }).map((d) => [d.ten, d.loi]), [['UBND xã A', '']], 'đề mục gộp cả bảng: bỏ qua, không thành dòng lỗi');
  });
  test('tiêu đề có ô năm riêng ("Kế hoạch vốn" trên "2026"), dòng giữa một nhãn ("Trong đó"): vẫn lấy cột lũy kế (rà soát lần 3)', () => {
    const muc = { tuDong: 2, ten: 1, kh: 2, da: 4, coTieuDe: true };
    assert.deepEqual(doanCot(bangTuChu(['STT\tChủ đầu tư\tKế hoạch vốn\tGiải ngân\t\tTỷ lệ', '\t\t2026\tTrong tháng\tLũy kế\t(%)', '1\tBan A\t100\t5\t60\t60'].join('\n'))), muc, 'TSV');
    const x = [['STT', 'Chủ đầu tư', 'Kế hoạch vốn', 'Giải ngân', '', 'Tỷ lệ'], ['', '', 2026, 'Trong tháng', 'Lũy kế', '(%)'], [1, 'Ban A', 100, 5, 60, 60]];
    assert.deepEqual(doanCot(x), muc, '.xlsx (2026 là số)');
    assert.deepEqual(nhanCot(x, 2).slice(2, 5), ['Kế hoạch vốn 2026', 'Giải ngân Trong tháng', 'Giải ngân Lũy kế']);
    const h = bangTuHtml(`<table><tr><td rowspan=2>STT</td><td rowspan=2>Chủ đầu tư</td><td>Kế hoạch vốn năm</td><td colspan=2>Giải ngân</td><td rowspan=2>Tỷ lệ</td></tr>
      <tr><td x:num="2026">2026</td><td>Trong tháng</td><td>Lũy kế</td></tr><tr><td>1</td><td>Ban A</td><td x:num="100">100</td><td x:num="5">5</td><td x:num="60">60</td><td>60</td></tr></table>`);
    assert.deepEqual(doanCot(h), muc, 'HTML x:num="2026"');
    const t = bangTuChu(['STT\tChủ đầu tư\tKế hoạch vốn năm 2026\tGiải ngân\t\t', '\t\t\tTrong đó\t\t', '\t\t\tTrong tháng\tVốn NSĐP\tLũy kế', '1\tBan A\t100\t5\t10\t60'].join('\n'));
    assert.deepEqual(doanCot(t), { tuDong: 3, ten: 1, kh: 2, da: 5, coTieuDe: true }, 'tiêu đề ba dòng, dòng giữa một nhãn');
  });
  test('dòng chỉ số cột: các kiểu thường gặp; dòng dữ liệu có tên một chữ, số nhỏ không bị bỏ', () => {
    for (const d of [['A', 'B', '1', '2', '3', '4=3/1'], ['1', '2', '3', '4', '5=4/3*100%'], ['A', 'B', '1', '2', '3=2/1 (%)'], ['1', '2', '3', '4', '5 = 4 × 100/3'],
      ['(1)', '(2)', '(3)', '(4)', '(5)=(4)/(3)'], ['a', 'b', '1', '2', '3'], ['A', 'B', 1, 2, 3, '4=3/1*100']]) assert.equal(laDongChiSo(d), true, JSON.stringify(d));
    for (const d of [['B', 3, 1], ['B', '3', '1'], ['1', 'Ban A', '12', '5'], ['C', 12, 13]]) assert.equal(laDongChiSo(d), false, JSON.stringify(d));
    const mo = [['Tên', 'Kế hoạch', 'Đã giải ngân'], ['Vốn A', 12, 5], ['B', 3, 1], ['Vốn C', 100, 50]];   // kỳ đã lưu mở lại để sửa
    assert.deepEqual(docBang(mo, { cot: doanCot(mo), tuDong: 1 }).map((d) => d.ten), ['Vốn A', 'B', 'Vốn C']);
  });
  test('số thứ tự chữ cái A, B, C… không nhầm C là số La Mã', () => {
    const phang = docBang([['A', 'Ban A', 100, 50], ['B', 'Ban B', 100, 50], ['C', 'Ban C', 150, 50]], { cot: { ten: 1, kh: 2, da: 3 } });
    assert.deepEqual(phang.map((d) => d.chon), [true, true, true], 'danh sách phẳng A, B, C: tích cả ba');
    const cap = docBang([['A', 'Vốn trong nước', 200, 100], ['I', 'Vốn X', 200, 100], ['B', 'Vốn nước ngoài', 50, 10], ['I', 'Vốn Y', 50, 10],
      ['C', 'Vốn khác', 100, 50], ['I', 'Vốn Z', 60, 30], ['II', 'Vốn W', 40, 20]], { cot: { ten: 1, kh: 2, da: 3 } });
    assert.deepEqual(cap.filter((d) => d.nhom).map((d) => d.ten), ['Vốn trong nước', 'Vốn nước ngoài', 'Vốn khác'], 'C có dòng con I, II: là dòng nhóm');
    assert.equal(cap.filter((d) => d.chon).reduce((t, d) => t + d.kh, 0), 350);
  });
  test('tiêu đề: cột giải ngân ưu tiên lũy kế, bỏ cột tỷ lệ; dòng dữ liệu bắt đầu sau tiêu đề', () => {
    const b = [['Biểu 2'], ['STT', 'Chủ đầu tư', 'Kế hoạch vốn năm 2026', 'Giải ngân trong tháng', 'Lũy kế giải ngân đến 30/9', 'Tỷ lệ giải ngân (%)'], ['1', 'Ban A', '10', '1', '5', '50']];
    assert.deepEqual(doanCot(b), { tuDong: 2, ten: 1, kh: 2, da: 4, coTieuDe: true });
  });
  test('đọc dòng: đơn vị triệu → tỷ, dòng tổng không tích, trùng tên, số âm, thiếu số; "Tổng công ty" không phải dòng tổng', () => {
    const b = [['TỔNG CỘNG (A+B)', '3.000', '1.000'], ['1. Ban QLDA tỉnh', '2.000.000', '500.000'], ['Ban QLDA tỉnh', '1', '1'], ['Sở Y tế', '(5)', '1'],
      ['Tổng công ty Điện lực', '1.000', '500'], ['Trong đó:', '', ''], ['Sở Tài chính', '-', '-']];
    const ds = docBang(b, { cot: { ten: 0, kh: 1, da: 2 }, kieu: 'vi', donVi: 'trieu' });
    assert.deepEqual(ds.map((d) => [d.ten, d.chon, d.loi, d.laTong]), [['TỔNG CỘNG (A+B)', false, '', true], ['Ban QLDA tỉnh', true, '', false], ['Ban QLDA tỉnh', false, 'trùng tên dòng trên', false],
      ['Sở Y tế', false, 'số âm', false], ['Tổng công ty Điện lực', true, '', false], ['Trong đó:', false, 'không có số', true], ['Sở Tài chính', false, 'không có số', false]]);
    assert.deepEqual([ds[1].kh, ds[1].da], [2000, 500]);
  });
  test('bảng nhiều cấp (I / 1): dòng nhóm không tích sẵn để không cộng trùng; số thứ tự ở cột riêng hoặc đầu tên', () => {
    const b = [['', 'Tổng số', 8250, 4450], ['I', 'Vốn ngân sách địa phương', 2100, 1200], ['1', 'Vốn cân đối ngân sách địa phương', 1500, 900], ['2', 'Vốn thu tiền sử dụng đất', 600, 300],
      ['II', 'Vốn ngân sách trung ương', 6150, 3250], ['1', 'Vốn trong nước', 6000, 3200], ['2', 'Vốn nước ngoài', 150, 50]];
    const ds = docBang(b, { cot: { ten: 1, kh: 2, da: 3 } });
    assert.deepEqual(ds.map((d) => [d.ten, d.nhom, d.chon]), [['Tổng số', false, false], ['Vốn ngân sách địa phương', true, false], ['Vốn cân đối ngân sách địa phương', false, true],
      ['Vốn thu tiền sử dụng đất', false, true], ['Vốn ngân sách trung ương', true, false], ['Vốn trong nước', false, true], ['Vốn nước ngoài', false, true]]);
    assert.equal(ds.filter((d) => d.chon).reduce((t, d) => t + d.kh, 0), 8250, 'các dòng được tích cộng đúng số tổng');
    const dau = docBang([['I. Vốn trong nước', 10, 5], ['1. Vốn cân đối', 6, 3], ['2. Vốn khác', 4, 2], ['II. Vốn nước ngoài', 3, 1]], { cot: { ten: 0, kh: 1, da: 2 } });
    assert.deepEqual(dau.map((d) => [d.ten, d.chon]), [['Vốn trong nước', false], ['Vốn cân đối', true], ['Vốn khác', true], ['Vốn nước ngoài', true]], 'nhóm cuối không có dòng con: tích');
    assert.equal(docSo('\u2212'), null, 'ô chỉ có dấu trừ (U+2212) là ô trống');
  });
  test('gợi ý đơn vị theo độ lớn khi bảng không ghi đơn vị', () => {
    const c = { ten: 0, kh: 1, da: 2 };
    assert.equal(goiYDonVi([['A', '8.473,913', '1']], c, 0, 'vi'), 'ty');
    assert.equal(goiYDonVi([['A', '8.473.913', '1']], c, 0, 'vi'), 'trieu');
    assert.equal(goiYDonVi([['A', '8.473.913.000', '1']], c, 0, 'vi'), 'nghin');
    assert.equal(goiYDonVi([['A', '8.473.913.000.000', '1']], c, 0, 'vi'), 'dong');
    assert.equal(goiYDonVi([['ĐVT: tỷ đồng'], ['A', '8.473.913', '1']], c, 1, 'vi'), 'ty', 'dòng đơn vị thắng độ lớn');
  });
  test('tên chuẩn: dấu thanh kiểu cũ, chữ thường, khoảng trắng, số thứ tự, Ð của PDF; khớp tên kỳ trước', () => {
    assert.equal(tenChuan('UBND huyện Hoà An'), tenChuan('UBND  huyện Hòa An'));
    assert.equal(tenChuan('Công ty Thuỷ lợi'), 'công ty thủy lợi');
    assert.equal(tenChuan('Khoẻ'), 'khỏe');
    assert.equal(tenChuan('Quà tặng'), 'quà tặng', 'không đụng "qu"');
    assert.equal(tenChuan('Hoàng Văn Thụ'), 'hoàng văn thụ', 'có phụ âm cuối: giữ nguyên');
    assert.equal(tenGon('1. Ban QLDA tỉnh'), 'Ban QLDA tỉnh');
    assert.equal(tenGon('II. Vốn trong nước'), 'Vốn trong nước');
    assert.equal(tenGon('Vi Văn Định'), 'Vi Văn Định', 'họ Vi không phải số La Mã');
    assert.equal(tenChuan('Ðảng ủy'), 'đảng ủy');
    const truoc = [{ ten: 'Ban QLDA tỉnh', ten_chuan: tenChuan('Ban QLDA tỉnh') }, { ten: 'Sở Giao thông - Vận tải', ten_chuan: tenChuan('Sở Giao thông - Vận tải') }];
    assert.equal(khopTen(tenChuan('BAN QLDA TỈNH'), truoc).kieu, 'khop');
    assert.deepEqual(khopTen(tenChuan('Sở Giao thông Vận tải'), truoc), { kieu: 'gan', ten: 'Sở Giao thông - Vận tải', tenChuan: tenChuan('Sở Giao thông - Vận tải') });
    assert.equal(khopTen(tenChuan('Sở Y tế'), truoc).kieu, 'moi');
  });
});
