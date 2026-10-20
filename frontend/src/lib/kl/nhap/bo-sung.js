// Bổ sung dữ liệu chuyển đổi (v3.27 — hàm DB bo_sung_chuyen_doi của 0118, CHỈ tài khoản toàn quyền; chủ dự án 20/10/2026: chỉ cho hai tệp chủ dự án gửi,
// giai đoạn chuyển đổi). Tệp JSON { viec: [{ ma, co_quan_trinh?, linh_vuc_chi_tiet?, han_xu_ly?, van_ban_trien_khai?, ghi_chu?, ket_qua?, owner_tai_khoan?,
// nguoi_theo_doi?, ghi_de? }], van_ban: [{ so_ket_luan, ngay_ban_hanh, so_hoi_nghi?, loai }] } do Claude dựng từ tệp đã được chủ dự án duyệt bản xem trước.
// Kiểm dạng tệp, chia lượt (mỗi lượt một giao dịch ngắn — như nhập Excel gửi từng phần), gộp kết quả, chữ "ô: cũ → mới". Thuần (không DOM, không mạng).
import { chuanGiaTri } from './chuan-hoa.js';
export const LUOT = 50;   // việc mỗi lần gọi (DB nhận tối đa 300) — tránh quá giờ chạy câu lệnh; chạy lại an toàn (ô đã điền → giữ nguyên)
export const TOI_DA_VB = 20;

export function docDuLieuBoSung(chu) {
  let o; try { o = JSON.parse(chu); } catch { throw new Error('Tệp không phải JSON hợp lệ.'); }
  if (!o || typeof o !== 'object' || Array.isArray(o) || (!Array.isArray(o.viec) && !Array.isArray(o.van_ban))) throw new Error('Tệp phải có dạng { "viec": [...], "van_ban": [...] }.');
  const viec = Array.isArray(o.viec) ? o.viec : []; const vanBan = Array.isArray(o.van_ban) ? o.van_ban : [];
  if (!viec.length && !vanBan.length) throw new Error('Tệp chưa có dòng nào để bổ sung.');
  if (vanBan.length > TOI_DA_VB) throw new Error(`Mỗi tệp đổi loại tối đa ${TOI_DA_VB} văn bản.`);
  const sai = viec.findIndex((x) => !x || typeof x !== 'object' || !String(x.ma ?? '').trim());
  if (sai >= 0) throw new Error(`Dòng việc thứ ${sai + 1} thiếu mã nhiệm vụ.`);
  return { viec, van_ban: vanBan };
}
// Lượt gửi: văn bản (đổi loại) đi cùng lượt đầu — các việc của văn bản đó bổ sung sau khi loại đã đổi.
export function chiaLuot(d, n = LUOT) {
  const ds = []; for (let i = 0; i < Math.max(1, d.viec.length); i += n) ds.push({ viec: d.viec.slice(i, i + n), van_ban: i ? [] : d.van_ban });
  return ds;
}
export const gopKetQua = (ds) => ({ so_viec: ds.reduce((s, x) => s + (x.so_viec || 0), 0), so_doi: ds.reduce((s, x) => s + (x.so_doi || 0), 0),
  so_loi: ds.reduce((s, x) => s + (x.so_loi || 0), 0), van_ban: ds.flatMap((x) => x.van_ban || []), viec: ds.flatMap((x) => x.viec || []),
  da_ghi: ds.length > 0 && ds.every((x) => x.da_ghi) });
export const soGiu = (kq) => (kq.viec || []).filter((x) => x.ket_qua === 'GIU').length;

// Cột "chu_tri" của tệp (họ tên cán bộ, hoặc "VPTU" / tên phòng — như cột "Chủ trì theo dõi" của bảng Phụ lục, cùng cách khớp của nhập Excel) → ghi đè
// chủ trì: cán bộ → owner_tai_khoan + người theo dõi là chính cán bộ đó; đơn vị → owner_tai_khoan trống + owner_don_vi_ma, người theo dõi mặc định (Chánh
// Văn phòng / Trưởng phòng — như nhập Excel). ctx: { dm, accounts, tenPhong }. → { du, loi: [chữ] } — có lỗi thì không gửi tệp.
export function chuanHoaChuTri(d, ctx) {
  const loi = [];
  const viec = d.viec.map((x, i) => {
    if (x.chu_tri === undefined || x.chu_tri === null || x.chu_tri === '') return x;
    const { chu_tri: ten, ...con } = x;
    const k = chuanGiaTri('chuTri', ten, { ...ctx, tuDien: new Map() });
    if (!k?.ma) { loi.push(`Dòng việc thứ ${i + 1} (${x.ma}): chưa xác định được chủ trì "${ten}"${k?.loi ? ` — ${k.loi}` : ''}.`); return con; }
    const [loai, ma] = String(k.ma).split(':');
    if (loai === 'tk') return { ...con, owner_tai_khoan: ma, nguoi_theo_doi: ma, ghi_de: ['owner_tai_khoan', 'nguoi_theo_doi'] };
    const dv = (ctx.dm?.donVi || []).find((v) => v.ma === ma);
    const td = (ctx.accounts || []).find((a) => !a.is_system && !a.bi_khoa && (dv?.phong ? a.role_group === 'A2' && a.department === dv.phong : a.role_group === 'A1' && a.is_chief));
    return { ...con, owner_tai_khoan: '', owner_don_vi_ma: ma, ...(td ? { nguoi_theo_doi: td.id } : {}), ghi_de: ['owner_tai_khoan', ...(td ? ['nguoi_theo_doi'] : [])] };
  });
  return { du: { ...d, viec }, loi };
}

export const TEN_O = { co_quan_trinh: 'Cơ quan trình', linh_vuc_chi_tiet: 'Lĩnh vực chi tiết', han_xu_ly: 'Hạn xử lý', van_ban_trien_khai: 'Văn bản triển khai',
  ghi_chu: 'Ghi chú', ket_qua: 'Kết quả (minh chứng chữ)', owner_tai_khoan: 'Chủ trì theo dõi', owner_don_vi_ma: 'Đơn vị chủ trì', nguoi_theo_doi: 'Người theo dõi' };
const rut = (t, n = 140) => (String(t).length > n ? `${String(t).slice(0, n - 1)}…` : String(t));
// x: một việc trong kết quả; ten(k, v): tên hiển thị của giá trị (đơn vị, cán bộ, ngày). → ['Cơ quan trình: (trống) → 6. Đảng ủy …', …]
export function chuDoi(x, ten = (k, v) => v) {
  const cu = x.cu || {}; const moi = x.moi || {};
  const hien = (k, v) => (v === null || v === undefined || v === '' ? '(trống)' : rut(ten(k, v)));
  return Object.keys(moi).map((k) => `${TEN_O[k] || k}: ${k === 'ket_qua' ? '' : `${hien(k, cu[k])} → `}${hien(k, moi[k])}`);
}
