// "Việc tôi theo dõi" dạng bảng (v3.25, mẫu ViecTheoDoi 16/10/2026) — phần THUẦN (unit test frontend/tests/tinh-hinh.test.mjs): cột "Tình
// hình" (việc cần đôn đốc gì), tám ô số, quan hệ của tôi với việc (tôi đã giao / tôi theo dõi). Dòng là việc tôi theo dõi hoặc đã giao mà người
// khác chủ trì (locRows theoDoiCuaToi, tong-hop.js). Lớp th-* viết nguyên văn (Tailwind giữ lớp).
import { ngayNgan, gioVN } from './bang-o.js';
import { mo, GAP, choNghiemThu } from './viec-toi.js';   // một định nghĩa dùng chung với "Việc của tôi"

const chuaNhan = (r) => mo(r) && Boolean(r.theo_1400) && !r.da_xac_nhan_nhan && !r.bi_tu_choi;   // CHỦ TRÌ chưa xác nhận nhận việc (khác chuaNhan của tôi)
const chuaSanPham = (r) => mo(r) && GAP.includes(r.muc_canh_bao) && (r.so_minh_chung_hop_le || 0) === 0 && !choNghiemThu(r);
const rutGon = (s, n = 90) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s || '');

// Tình hình một việc: { lop, tieu, chu } — đỏ (th-vm): bị từ chối, chỉ đạo chờ trả lời, vướng mắc; vàng (th-canh): đề nghị từ chối, chưa nhận
// việc, chưa có sản phẩm khi đã Vàng / Đỏ; lục (th-ok): đã nộp minh chứng / hoàn thành; xám (th-thuong): bình thường.
export function tinhHinh(r) {
  if (!mo(r)) {
    if (r.thieu_minh_chung) return { lop: 'th-canh', tieu: 'Hoàn thành, chưa có minh chứng', chu: r.ngay_hoan_thanh ? `hoàn thành ${ngayNgan(r.ngay_hoan_thanh)}` : '' };
    return { lop: 'th-ok', tieu: 'Đã nộp minh chứng', chu: r.ngay_hoan_thanh ? `hoàn thành ${ngayNgan(r.ngay_hoan_thanh)}` : '' };
  }
  if (r.bi_tu_choi) return { lop: 'th-vm', tieu: 'Bị từ chối', chu: 'chờ giao lại' };
  if ((r.so_chi_dao_cho_phan_hoi || 0) > 0) return { lop: 'th-vm', tieu: 'Có chỉ đạo chờ trả lời', chu: `${r.so_chi_dao_cho_phan_hoi} chỉ đạo chờ phản hồi` };
  if (r.vuong_mac) return { lop: 'th-vm', tieu: 'Vướng mắc', chu: rutGon(r.vuong_mac) };
  if (r.tu_choi_cho) return { lop: 'th-canh', tieu: 'Đề nghị từ chối', chu: 'chờ duyệt' };
  if (chuaNhan(r)) return { lop: 'th-canh', tieu: 'Chưa nhận việc', chu: r.created_at ? `giao ${ngayNgan(gioVN(r.created_at).ymd)}` : '' };
  if (chuaSanPham(r)) return { lop: 'th-canh', tieu: 'Chưa có sản phẩm', chu: r.san_pham_ten ? `chưa có ${r.san_pham_ten.toLowerCase()}` : 'chưa có minh chứng' };
  if ((r.so_minh_chung_hop_le || 0) > 0 || choNghiemThu(r)) return { lop: 'th-ok', tieu: 'Đã nộp minh chứng', chu: choNghiemThu(r) ? 'chờ xác nhận' : '' };
  const phu = [r.da_xac_nhan_nhan ? 'đã nhận việc' : '', r.cap_nhat_luc ? `cập nhật ${ngayNgan(gioVN(r.cap_nhat_luc).ymd)}` : ''].filter(Boolean).join(', ');
  return { lop: 'th-thuong', tieu: 'Bình thường', chu: phu };
}

// Quan hệ của tôi với việc: 'giao' (tôi đã giao / nhập) | 'theo' (tôi theo dõi); việc vừa do tôi giao vừa do tôi theo dõi tính cả hai khi lọc.
export const quanHe = (r, me) => (r.tao_boi === me ? 'giao' : 'theo');
export const QUAN_HE = [['', 'Mọi việc'], ['giao', 'Tôi đã giao'], ['theo', 'Tôi theo dõi']];
export const khopQuanHe = (r, me, qh) => !qh || (qh === 'giao' ? r.tao_boi === me : r.nguoi_theo_doi === me);

// Tám ô số (mặc định "Cần đôn đốc": việc đang mở chưa nhận, có vướng mắc, chỉ đạo chờ trả lời, đề nghị từ chối, hoặc đã Vàng / Đỏ).
export const O_SO_TD = [
  ['don', 'Cần đôn đốc', (r) => mo(r) && (chuaNhan(r) || Boolean(r.vuong_mac) || (r.so_chi_dao_cho_phan_hoi || 0) > 0 || Boolean(r.tu_choi_cho)
    || Boolean(r.bi_tu_choi) || GAP.includes(r.muc_canh_bao))],
  ['nhan', 'Chưa nhận việc', chuaNhan],
  ['vm', 'Có vướng mắc', (r) => mo(r) && Boolean(r.vuong_mac)],
  ['sap', 'Sắp đến hạn', (r) => mo(r) && r.muc_canh_bao === 'VANG'],
  ['qua', 'Quá hạn', (r) => mo(r) && ['DO', 'DO_DAC_BIET'].includes(r.muc_canh_bao)],
  ['mo', 'Đang thực hiện', mo],
  ['xong', 'Đã hoàn thành', (r) => !mo(r)],
  ['tat', 'Tất cả', () => true],
];
const VI_TU = Object.fromEntries(O_SO_TD.map(([k, , f]) => [k, f]));
export const locOTd = (rows, khoa) => rows.filter(VI_TU[khoa] || VI_TU.tat);
export const demOTd = (rows) => Object.fromEntries(O_SO_TD.map(([k, , f]) => [k, rows.filter(f).length]));
