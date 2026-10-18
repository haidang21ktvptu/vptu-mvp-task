// Ô của các bảng nhiệm vụ theo cột (v3.25 — kiểu V-Office, mẫu 16/10/2026: Nhiệm vụ, Việc của tôi, Việc tôi theo dõi, Theo văn bản). Hàm THUẦN
// (không DOM, không state — unit test frontend/tests/bang-o.test.mjs): ô hạn (ngày + "còn / trễ N ngày", "xong 29/9 · đúng hạn"), nhãn trạng
// thái (một chỗ cho mọi bảng; lớp tt-* viết nguyên văn để Tailwind giữ lớp), giờ:phút + ngày theo giờ Việt Nam, tên văn bản ngắn, cách nhập,
// phân trang 50 dòng. Màu ngày hạn theo lớp mức của dòng (lopMep — CSS), không tính ở đây.
import { formatNgay, soNgay } from './ngay.js';
import { MOC_RA_SOAT, laBenNop, lopQuaHan, nhanTrangThai, tenTienDoHoanThanh, boSoThuTu } from './nhan.js';

export const CO_TRANG = 50;   // số dòng mỗi trang của màn Nhiệm vụ (mẫu: "50 dòng mỗi trang")
const thuong = (s) => (s ? s[0].toLowerCase() + s.slice(1) : '');
// '2026-09-29' → '29/9' (dòng phụ, không năm).
export const ngayNgan = (s) => (s ? `${Number(s.slice(8, 10))}/${Number(s.slice(5, 7))}` : '');

// Ô hạn xử lý: { ngay, chu } — ngày (đậm) và dòng phụ. Việc thường xuyên / chờ điều kiện: hạn là mốc rà soát, không bao giờ ghi "trễ".
export function hanO(r, homNay) {
  if (r.nhom_dem === 'HOAN_THANH') {
    const xong = r.ngay_hoan_thanh ? `xong ${ngayNgan(r.ngay_hoan_thanh)}` : 'không có ngày hoàn thành';
    const td = thuong(tenTienDoHoanThanh(r));
    return { ngay: r.han_xu_ly ? formatNgay(r.han_xu_ly) : 'Không có hạn', chu: td ? `${xong} · ${td}` : xong };
  }
  if (!r.han_xu_ly) return { ngay: 'Chưa có hạn', chu: r.nhom_dem === 'CAN_DIEN_HAN' ? 'cần điền hạn' : thuong(boSoThuTu(r.loai_thoi_han_ten)) };
  if (MOC_RA_SOAT[r.nhom_dem]) return { ngay: formatNgay(r.han_xu_ly), chu: `${MOC_RA_SOAT[r.nhom_dem]} · mốc rà soát` };
  const n = soNgay(homNay, r.han_xu_ly);
  return { ngay: formatNgay(r.han_xu_ly), chu: n < 0 ? `trễ ${-n} ngày` : n === 0 ? 'đến hạn hôm nay' : `còn ${n} ngày` };
}

// Nhãn trạng thái { chu, lop }: hoàn thành lục; quá hạn đỏ (Đỏ đặc biệt tím); sắp đến hạn / cần điền hạn / người nộp chờ xác nhận vàng; đang
// thực hiện, chờ xác nhận minh chứng lam; thường xuyên, chờ điều kiện xám. me = id người xem (góc nhìn người nộp — nhanTrangThai).
const QUA = ['QUA_HAN', 'QUA_HAN_NGHIEM_THU', 'DANG_DINH_CHINH'];
export function trangThaiO(r, me) {
  const chu = nhanTrangThai(r, me);
  if (r.nhom_dem === 'HOAN_THANH') return { chu, lop: 'tt-xong' };
  if (laBenNop(r, me)) return { chu, lop: 'tt-cho' };
  if (QUA.includes(r.nhom_dem)) return { chu, lop: lopQuaHan(r) };
  if (['SAP_DEN_HAN', 'CAN_DIEN_HAN'].includes(r.nhom_dem)) return { chu, lop: 'tt-cho' };
  if (['DANG_THUC_HIEN', 'CHO_NGHIEM_THU'].includes(r.nhom_dem)) return { chu, lop: 'tt-lam' };
  return { chu, lop: 'tt-xam' };
}

// Giờ Việt Nam của một mốc timestamptz: { ngay: '16/10/2026', gio: '09:05', ymd: '2026-10-16' }; trống → chuỗi rỗng.
const FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function gioVN(iso) {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return { ngay: '', gio: '', ymd: '' };
  const p = Object.fromEntries(FMT.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  const ymd = `${p.year}-${p.month}-${p.day}`;
  return { ngay: formatNgay(ymd), gio: `${p.hour}:${p.minute}`, ymd };
}

// Tên văn bản ngắn cho ô "Văn bản giao": "Kết luận 32-KL/TU", "Công văn 1650-CV/VPTU"; phụ: "Hội nghị 39 · ban hành 1/9/2026".
const TEN_NGAN = { KL_BTV: 'Kết luận', KL_BCH: 'Kết luận', TB_THUONG_TRUC: 'Thông báo', NQ_BCH: 'Nghị quyết', NQ_TW: 'Nghị quyết', CONG_VAN: 'Công văn', KHAC: 'Văn bản' };
export function vanBanNgan(r) {
  if (!r?.van_ban_id) return { ten: 'Không gắn văn bản', phu: '' };
  const ten = `${TEN_NGAN[r.van_ban_loai] || 'Văn bản'} ${r.so_ket_luan || '(không số)'}`;
  const phu = [r.so_hoi_nghi ? `Hội nghị ${r.so_hoi_nghi}` : '', r.ngay_ban_hanh ? `ban hành ${formatNgay(r.ngay_ban_hanh)}` : ''].filter(Boolean).join(' · ');
  return { ten, phu };
}

// Cách việc lên hệ thống (ô "Thời gian nhập"): dòng nhập từ tệp cũ (nguon = excel), việc giao tiếp xuống; giao thường không ghi thêm.
export const cachNhap = (r) => (r.nguon === 'excel' ? 'nhập Excel' : r.nhiem_vu_cha ? 'giao tiếp xuống' : '');

// Phân trang: trang (bắt đầu 1) kẹp trong [1, soTrang]; tu / den là chỉ số mảng (den không gồm).
export function phanTrang(tong, trang = 1, co = CO_TRANG) {
  const soTrang = Math.max(1, Math.ceil(Math.max(0, tong) / co));
  const t = Math.min(Math.max(1, Math.floor(Number(trang) || 1)), soTrang);
  return { trang: t, soTrang, tu: (t - 1) * co, den: Math.min(Math.max(0, tong), t * co) };
}
// Chân bảng: một trang "Hiển thị 12 / 812 nhiệm vụ" (đang lọc / trong phạm vi); nhiều trang "Hiển thị 51–100 trong 230 nhiệm vụ (lọc từ 812)".
export function chuHienThi(p, soLoc, soGoc, don = 'nhiệm vụ') {
  if (p.soTrang > 1) return `Hiển thị ${p.tu + 1}–${p.den} trong ${soLoc} ${don}${soGoc > soLoc ? ` (lọc từ ${soGoc})` : ''}`;
  return `Hiển thị ${soLoc} / ${soGoc} ${don}`;
}
