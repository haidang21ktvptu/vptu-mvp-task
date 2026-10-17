// Unit test Thống kê sử dụng (0104, v3.24): khoảng thời gian giờ Việt Nam, giờ hiển thị, nhãn thiết bị, tóm tắt đăng nhập, kỳ ngày / tuần (thứ
// Hai) / tháng / năm khớp date_trunc của Postgres, gom số nhập mới có lọc. Chạy `npm test` trong frontend/.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { gioVN, khoangDangNhap, thietBi, tomTatDangNhap, dauKy, kyKe, khoangMacDinh, cacKy, nhanKy, khoangCuaKy, gomNhapMoi,
  cachNhapCua, trucDep } from '../src/lib/thong-ke.js';

describe('Đăng nhập', () => {
  test('giờ hiển thị theo giờ Việt Nam', () => {
    assert.equal(gioVN('2026-10-15T17:30:00Z'), '16/10/2026 00:30');
    assert.equal(gioVN('2026-10-16T01:05:00Z'), '16/10/2026 08:05');
    assert.equal(gioVN(null), '');
  });
  test('kỳ: biên là 00:00 giờ Việt Nam, đến = 00:00 ngày sau; khoảng sai → null', () => {
    assert.deepEqual(khoangDangNhap('hom-nay', '2026-10-16'), { tuNgay: '2026-10-16', denNgay: '2026-10-16', tu: '2026-10-16T00:00:00+07:00', den: '2026-10-17T00:00:00+07:00' });
    assert.equal(khoangDangNhap('7-ngay', '2026-10-16').tuNgay, '2026-10-10');
    assert.equal(khoangDangNhap('30-ngay', '2026-10-16').tuNgay, '2026-09-17');
    assert.equal(khoangDangNhap('thang-nay', '2026-10-16').tuNgay, '2026-10-01');
    assert.equal(khoangDangNhap('tat-ca', '2026-10-16').tuNgay, '2026-01-01');
    assert.equal(khoangDangNhap('tuy-chon', '2026-10-16', { tu: '2026-10-01', den: '2026-10-05' }).den, '2026-10-06T00:00:00+07:00');
    assert.equal(khoangDangNhap('tuy-chon', '2026-10-16', { tu: '2026-10-05', den: '2026-10-01' }), null);
    assert.equal(khoangDangNhap('tuy-chon', '2026-10-16', { tu: '', den: '2026-10-01' }), null);
  });
  test('nhãn trình duyệt, hệ điều hành', () => {
    assert.equal(thietBi('Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36'), 'Chrome 109 · Windows 7');
    assert.equal(thietBi('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.2792.79'), 'Edge 129 · Windows 10/11');
    assert.equal(thietBi('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) coc_coc_browser/131.0.256 Chrome/125.0.0.0 Safari/537.36'), 'Cốc Cốc 131 · Windows 10/11');
    assert.equal(thietBi('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'), 'Safari 17 · iOS');
    assert.equal(thietBi('Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36'), 'Chrome 129 · Android');
    assert.equal(thietBi(''), 'Không rõ');
  });
  test('tóm tắt: đã / chưa đăng nhập trong kỳ, lượt, hôm nay, đang hoạt động 15 phút', () => {
    const now = Date.parse('2026-10-16T08:40:00Z');   // 15:40 giờ VN
    const ds = [
      { so_lan: 3, lan_cuoi_tong: '2026-10-16T01:00:00Z', hoat_dong_cuoi_tong: '2026-10-16T08:30:00Z' },
      { so_lan: 1, lan_cuoi_tong: '2026-10-15T16:59:00Z', hoat_dong_cuoi_tong: '2026-10-16T08:20:00Z' },   // 23:59 hôm qua giờ VN
      { so_lan: 0, lan_cuoi_tong: null, hoat_dong_cuoi_tong: null },
    ];
    const t = tomTatDangNhap(ds, { homNay: '2026-10-16', now });
    assert.deepEqual({ tong: t.tong, da: t.da, chua: t.chua, luot: t.luot, homNay: t.homNay, dangHd: t.dangHd }, { tong: 3, da: 2, chua: 1, luot: 4, homNay: 1, dangHd: 1 });
    assert.equal(ds.filter(t.loc.chua).length, 1);
  });
});

describe('Nhiệm vụ nhập mới — kỳ', () => {
  test('đầu kỳ: tuần bắt đầu thứ Hai, tháng, năm', () => {
    assert.equal(dauKy('2026-10-16', 'tuan'), '2026-10-12');   // thứ Sáu → thứ Hai
    assert.equal(dauKy('2026-10-12', 'tuan'), '2026-10-12');
    assert.equal(dauKy('2026-10-18', 'tuan'), '2026-10-12');   // Chủ nhật vẫn thuộc tuần bắt đầu thứ Hai trước đó
    assert.equal(dauKy('2026-10-16', 'thang'), '2026-10-01');
    assert.equal(dauKy('2026-10-16', 'nam'), '2026-01-01');
    assert.equal(dauKy('2026-10-16', 'ngay'), '2026-10-16');
  });
  test('kỳ kế / lùi, khoảng mặc định, danh sách kỳ có kỳ trống', () => {
    assert.equal(kyKe('2026-12-01', 'thang'), '2027-01-01');
    assert.equal(kyKe('2026-01-01', 'thang', -1), '2025-12-01');
    assert.deepEqual(khoangMacDinh('ngay', '2026-10-16'), { tu: '2026-10-03', den: '2026-10-16' });
    assert.deepEqual(khoangMacDinh('tuan', '2026-10-16'), { tu: '2026-08-24', den: '2026-10-16' });
    assert.deepEqual(khoangMacDinh('thang', '2026-10-16'), { tu: '2025-11-01', den: '2026-10-16' });
    assert.deepEqual(khoangMacDinh('nam', '2026-10-16'), { tu: '2022-01-01', den: '2026-10-16' });
    assert.deepEqual(cacKy('2026-10-14', '2026-10-16', 'ngay'), ['2026-10-14', '2026-10-15', '2026-10-16']);
    assert.deepEqual(cacKy('2026-10-14', '2026-10-27', 'tuan'), ['2026-10-12', '2026-10-19', '2026-10-26']);
    assert.equal(cacKy('2026-01-01', '2026-12-31', 'thang').length, 12);
    const dai = cacKy('2025-01-01', '2026-10-16', 'ngay');
    assert.equal(dai.length, 400, 'tối đa 400 kỳ');
    assert.equal(dai[dai.length - 1], '2026-10-16', 'giữ các kỳ gần nhất');
  });
  test('nhãn kỳ, khoảng ngày của kỳ', () => {
    assert.equal(nhanKy('2026-10-12', 'tuan'), 'tuần 12/10 – 18/10/2026');
    assert.equal(nhanKy('2026-10-16', 'ngay', true), '16/10');
    assert.equal(nhanKy('2026-10-01', 'thang'), 'tháng 10/2026');
    assert.deepEqual(khoangCuaKy('2026-10-12', 'tuan'), { tu: '2026-10-12', den: '2026-10-18' });
    assert.deepEqual(khoangCuaKy('2026-02-01', 'thang'), { tu: '2026-02-01', den: '2026-02-28' });
  });
  test('gom theo kỳ và người nhập, lọc người / cách nhập; kỳ trống giữ 0', () => {
    const dong = [
      { ky: '2026-10-14', nguoi_nhap: 'a', cach: 'GIAO_VIEC', so_viec: 2 },
      { ky: '2026-10-14', nguoi_nhap: 'b', cach: 'EXCEL', so_viec: 20 },
      { ky: '2026-10-16', nguoi_nhap: 'a', cach: 'TIEP_XUONG', so_viec: 1 },
      { ky: '2026-10-16', nguoi_nhap: null, cach: 'EXCEL', so_viec: 3 },
    ];
    const g = gomNhapMoi(dong, { tu: '2026-10-14', den: '2026-10-16', donVi: 'ngay' });
    assert.deepEqual(g.ky.map((x) => [x.ky, x.tong]), [['2026-10-14', 22], ['2026-10-15', 0], ['2026-10-16', 4]]);
    assert.deepEqual(g.tong, { tong: 26, GIAO_VIEC: 2, TIEP_XUONG: 1, EXCEL: 23, soNguoi: 2 }, 'bộ dữ liệu ban đầu (không người nhập) không tính là cán bộ');
    assert.deepEqual(g.nguoi.map((x) => [x.nguoi, x.tong]), [['b', 20], ['a', 3], ['', 3]], 'nhiều trước; bằng nhau giữ thứ tự xuất hiện');
    assert.equal(gomNhapMoi(dong, { tu: '2026-10-14', den: '2026-10-16', donVi: 'ngay', nguoi: 'a' }).tong.tong, 3);
    assert.equal(gomNhapMoi(dong, { tu: '2026-10-14', den: '2026-10-16', donVi: 'ngay', cach: 'EXCEL' }).tong.tong, 23);
    assert.equal(gomNhapMoi(dong, { tu: '2026-10-14', den: '2026-10-16', donVi: 'ngay', nguoi: '' }).tong.tong, 26);
  });
});

describe('Cách nhập, trục biểu đồ', () => {
  test('cách nhập khớp hàm SQL: lô Excel tạo việc / nguồn excel → Excel; có việc cha → giao tiếp xuống; còn lại giao việc', () => {
    const lo = new Set(['x']);
    assert.equal(cachNhapCua({ id: 'x', nhiem_vu_cha: 'c' }, lo), 'EXCEL');
    assert.equal(cachNhapCua({ id: 'y', nguon: 'excel' }, lo), 'EXCEL');
    assert.equal(cachNhapCua({ id: 'y', nhiem_vu_cha: 'c' }, lo), 'TIEP_XUONG');
    assert.equal(cachNhapCua({ id: 'y', nguon: 'app' }), 'GIAO_VIEC');
  });
  test('trục: bước 1/2/5/10…, tối đa 5 khoảng, đỉnh ≥ một bước', () => {
    assert.deepEqual(trucDep(0), { dinh: 1, vach: [0, 1] });
    assert.deepEqual(trucDep(4), { dinh: 4, vach: [0, 1, 2, 3, 4] });
    assert.deepEqual(trucDep(7), { dinh: 8, vach: [0, 2, 4, 6, 8] });
    assert.deepEqual(trucDep(23), { dinh: 25, vach: [0, 5, 10, 15, 20, 25] });
    assert.deepEqual(trucDep(230), { dinh: 250, vach: [0, 50, 100, 150, 200, 250] });
  });
});
