// v3.25 — bảng nhiệm vụ theo cột (mẫu 16/10/2026): ô hạn, nhãn trạng thái, giờ Việt Nam, tên văn bản ngắn, cách nhập, phân trang, chân bảng
// (lib/kl/bang-o.js). Chạy `npm test` trong frontend/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hanO, trangThaiO, gioVN, vanBanNgan, cachNhap, phanTrang, chuHienThi, ngayNgan, CO_TRANG } from '../src/lib/kl/bang-o.js';

const HOM_NAY = '2026-10-16';
const viec = (o = {}) => ({ id: 'v', nhom_dem: 'DANG_THUC_HIEN', muc_canh_bao: 'XANH', han_xu_ly: '2026-10-19', tien_do_ma: 'DANG_THUC_HIEN', ...o });

test('ô hạn: còn / đến hạn hôm nay / trễ N ngày; hoàn thành ghi ngày xong + tiến độ; mốc rà soát không bao giờ "trễ"; chưa có hạn', () => {
  assert.deepEqual(hanO(viec(), HOM_NAY), { ngay: '19/10/2026', chu: 'còn 3 ngày' });
  assert.deepEqual(hanO(viec({ han_xu_ly: HOM_NAY }), HOM_NAY), { ngay: '16/10/2026', chu: 'đến hạn hôm nay' });
  assert.deepEqual(hanO(viec({ han_xu_ly: '2026-10-12', nhom_dem: 'QUA_HAN' }), HOM_NAY), { ngay: '12/10/2026', chu: 'trễ 4 ngày' });
  const xong = { nhom_dem: 'HOAN_THANH', tien_do_ma: 'HOAN_THANH', han_xu_ly: '2026-09-30' };
  assert.deepEqual(hanO(viec({ ...xong, ngay_hoan_thanh: '2026-09-29', tien_do_hoan_thanh: 'TRUOC_HAN' }), HOM_NAY), { ngay: '30/9/2026', chu: 'xong 29/9 · trước hạn 1 ngày' });
  assert.deepEqual(hanO(viec({ ...xong, ngay_hoan_thanh: '2026-09-30', tien_do_hoan_thanh: 'DUNG_HAN' }), HOM_NAY).chu, 'xong 30/9 · đúng hạn');
  assert.deepEqual(hanO(viec({ ...xong, ngay_hoan_thanh: '2026-10-08', tien_do_hoan_thanh: 'TRE', han_xu_ly: '2026-10-06' }), HOM_NAY).chu, 'xong 8/10 · trễ 2 ngày');
  assert.equal(hanO(viec({ ...xong, ngay_hoan_thanh: null, han_xu_ly: null }), HOM_NAY).chu, 'không có ngày hoàn thành');
  assert.deepEqual(hanO(viec({ nhom_dem: 'THUONG_XUYEN', han_xu_ly: '2026-08-01' }), HOM_NAY), { ngay: '1/8/2026', chu: 'thường xuyên · mốc rà soát' });
  assert.deepEqual(hanO(viec({ han_xu_ly: null, nhom_dem: 'CAN_DIEN_HAN' }), HOM_NAY), { ngay: 'Chưa có hạn', chu: 'cần điền hạn' });
  assert.equal(hanO(viec({ han_xu_ly: null, nhom_dem: 'CHO_DIEU_KIEN', loai_thoi_han_ten: '3. Chờ điều kiện' }), HOM_NAY).chu, 'chờ điều kiện');
});

test('nhãn trạng thái: lớp theo nhóm (Đỏ đặc biệt tím, đang thực hiện lam, người nộp chờ xác nhận vàng)', () => {
  assert.deepEqual(trangThaiO(viec(), 'me'), { chu: 'Đang thực hiện', lop: 'tt-lam' });
  assert.deepEqual(trangThaiO(viec({ nhom_dem: 'SAP_DEN_HAN' }), 'me'), { chu: 'Sắp đến hạn', lop: 'tt-cho' });
  assert.deepEqual(trangThaiO(viec({ nhom_dem: 'QUA_HAN', so_ngay_qua: 4, muc_canh_bao: 'DO_DAC_BIET' }), 'me'), { chu: 'Quá hạn · 4 ngày', lop: 'tt-ddb' });
  assert.equal(trangThaiO(viec({ nhom_dem: 'QUA_HAN', so_ngay_qua: 1, muc_canh_bao: 'DO' }), 'me').lop, 'tt-qua');
  assert.deepEqual(trangThaiO(viec({ nhom_dem: 'HOAN_THANH', ket_qua: 'DUNG_HAN' }), 'me'), { chu: 'Hoàn thành đúng hạn', lop: 'tt-xong' });
  assert.deepEqual(trangThaiO(viec({ nhom_dem: 'CHO_NGHIEM_THU', owner_tai_khoan: 'me' }), 'me'), { chu: 'Đã nộp — chờ xác nhận', lop: 'tt-cho' });
  assert.equal(trangThaiO(viec({ nhom_dem: 'CHO_NGHIEM_THU', owner_tai_khoan: 'khac' }), 'me').lop, 'tt-lam');
  assert.equal(trangThaiO(viec({ nhom_dem: 'THUONG_XUYEN' }), 'me').lop, 'tt-xam');
});

test('giờ Việt Nam, tên văn bản ngắn, cách nhập', () => {
  assert.deepEqual(gioVN('2026-10-16T02:05:00Z'), { ngay: '16/10/2026', gio: '09:05', ymd: '2026-10-16' });
  assert.deepEqual(gioVN('2026-10-15T17:30:00Z'), { ngay: '16/10/2026', gio: '00:30', ymd: '2026-10-16' }, 'qua nửa đêm theo giờ Việt Nam');
  assert.deepEqual(gioVN(null), { ngay: '', gio: '', ymd: '' });
  assert.deepEqual(vanBanNgan({ van_ban_id: 'x', van_ban_loai: 'KL_BTV', so_ket_luan: '32-KL/TU', so_hoi_nghi: 39, ngay_ban_hanh: '2026-09-01' }),
    { ten: 'Kết luận 32-KL/TU', phu: 'Hội nghị 39 · ban hành 1/9/2026' });
  for (const [loai, ten] of [['TB_THUONG_TRUC', 'Thông báo'], ['KL_BCH', 'Kết luận'], ['NQ_BCH', 'Nghị quyết'], ['NQ_TW', 'Nghị quyết'], ['CONG_VAN', 'Công văn'], ['KHAC', 'Văn bản']]) {
    assert.equal(vanBanNgan({ van_ban_id: 'x', van_ban_loai: loai, so_ket_luan: '1' }).ten, `${ten} 1`);
  }
  assert.deepEqual(vanBanNgan({ van_ban_id: null }), { ten: 'Không gắn văn bản', phu: '' });
  assert.equal(vanBanNgan({ van_ban_id: 'x', van_ban_loai: 'CONG_VAN', so_ket_luan: null }).ten, 'Công văn (không số)');
  assert.equal(cachNhap({ nguon: 'excel' }), 'nhập Excel'); assert.equal(cachNhap({ nguon: 'app', nhiem_vu_cha: 'c' }), 'giao tiếp xuống');
  assert.equal(cachNhap({ nguon: 'app' }), ''); assert.equal(ngayNgan('2026-01-05'), '5/1'); assert.equal(ngayNgan(null), '');
});

test('phân trang 50 dòng: kẹp trang, biên, chân bảng', () => {
  assert.equal(CO_TRANG, 50);
  assert.deepEqual(phanTrang(0, 3), { trang: 1, soTrang: 1, tu: 0, den: 0 });
  assert.deepEqual(phanTrang(50, 1), { trang: 1, soTrang: 1, tu: 0, den: 50 });
  assert.deepEqual(phanTrang(51, 2), { trang: 2, soTrang: 2, tu: 50, den: 51 });
  assert.deepEqual(phanTrang(230, 9), { trang: 5, soTrang: 5, tu: 200, den: 230 }, 'trang quá lớn → trang cuối');
  assert.deepEqual(phanTrang(230, 0), { trang: 1, soTrang: 5, tu: 0, den: 50 });
  assert.deepEqual(phanTrang(230, 'x'), phanTrang(230, 1));
  assert.equal(chuHienThi(phanTrang(12, 1), 12, 812), 'Hiển thị 12 / 812 nhiệm vụ');
  assert.equal(chuHienThi(phanTrang(230, 2), 230, 812), 'Hiển thị 51–100 trong 230 nhiệm vụ (lọc từ 812)');
  assert.equal(chuHienThi(phanTrang(230, 5), 230, 230), 'Hiển thị 201–230 trong 230 nhiệm vụ');
  assert.equal(chuHienThi(phanTrang(6, 1), 6, 10, 'việc'), 'Hiển thị 6 / 10 việc');
});
