// Bàn giao tài khoản (v3.15): phần thuần — chọn phạm vi đặt lại mật khẩu hàng loạt (cùng quy tắc bỏ qua với Edge Function quan-tri-tai-khoan,
// ở đó mới là chốt thật), ghép kết quả với danh bạ, dựng sheet .xlsx (lib/xlsx.js) và trang HTML in phiếu từng người. Không giữ mật khẩu ở đâu
// ngoài tham số truyền vào; không chạm DOM (unit test frontend/tests/ban-giao.test.mjs).
import { DEPT_NAMES, ROLE_LABELS } from './constants.js';

export const TOI_DA_HANG_LOAT = 100;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const tenPhong = (a) => DEPT_NAMES[a?.department] || a?.department || (a?.role_group === 'A0' ? 'Thường trực Tỉnh ủy' : '');
const tenVai = (a) => ROLE_LABELS[a?.role_group] || a?.role_group || '';

// Lý do một tài khoản bị bỏ qua khi đặt lại hàng loạt; null = sẽ đặt lại.
export function lyDoBoQua(tk, meId, keCaDangDung = false) {
  if (!tk) return 'không tìm thấy tài khoản';
  if (tk.id === meId) return 'chính tài khoản đang thao tác';
  if (tk.is_system) return 'tài khoản hệ thống';
  if (tk.bi_khoa) return 'đang bị khoá';
  if (!tk.must_change_password && !keCaDangDung) return 'đã đổi mật khẩu lần đầu (đang dùng)';
  return null;
}

// Phạm vi: toan_bo | phong (department) | vai (role_group) → { chon: [tài khoản sẽ đặt lại], boQua: [{ tk, lyDo }] }, xếp theo họ tên.
export function locBanGiao(accounts, { phamVi = 'toan_bo', phong = '', vai = '', keCaDangDung = false } = {}, meId) {
  const trongPhamVi = (a) => (phamVi === 'phong' ? a.department === phong : phamVi === 'vai' ? a.role_group === vai : true);
  const ds = accounts.filter(trongPhamVi).sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'));
  const chon = []; const boQua = [];
  for (const tk of ds) { const lyDo = lyDoBoQua(tk, meId, keCaDangDung); if (lyDo) boQua.push({ tk, lyDo }); else chon.push(tk); }
  return { chon, boQua };
}

// Kết quả Edge Function (dat_lai) + danh bạ → dòng bàn giao đầy đủ (phòng, chức danh, vai).
export function dongBanGiao(datLai, accounts) {
  const theoId = new Map(accounts.map((a) => [a.id, a])); const theoUser = new Map(accounts.map((a) => [a.username, a]));
  return datLai.map((d, i) => {
    const a = theoId.get(d.id) || theoUser.get(d.username) || {};
    return { stt: i + 1, ho_ten: d.full_name || a.full_name || '', username: d.username, phong: tenPhong(a), chuc_danh: a.position_title || '', vai: tenVai(a), mat_khau: d.mat_khau_tam };
  });
}

export const GHI_CHU_LAN_DAU = 'Đăng nhập lần đầu bằng mật khẩu tạm; hệ thống bắt đổi mật khẩu ngay (tối thiểu 8 ký tự, có chữ và số). Không dùng chung tài khoản.';
const BUOC = [
  '1. Mở địa chỉ hệ thống trên máy tính hoặc điện thoại, nhập tên đăng nhập và mật khẩu tạm.',
  '2. Hệ thống yêu cầu đặt mật khẩu mới ngay (tối thiểu 8 ký tự, có chữ và số); ghi nhớ mật khẩu mới, không chia sẻ.',
  '3. Vào Bánh răng (góc trên bên phải) → Trợ giúp để đọc Hướng dẫn sử dụng; vướng mắc liên hệ Quản trị hệ thống (Phòng Chuyển đổi số - Cơ yếu).',
];

// Sheet .xlsx: "Bàn giao" (một dòng/người) + "Hướng dẫn" (chữ cho người phát tài khoản). luc: chuỗi ngày giờ hiển thị; nguoi: người đặt lại.
export function sheetsBanGiao(rows, { url = '', luc = '', nguoi = '' } = {}) {
  const cot = [{ nhan: 'STT', rong: 6 }, { nhan: 'Họ và tên', rong: 26 }, { nhan: 'Tên đăng nhập', rong: 20 }, { nhan: 'Phòng / đơn vị', rong: 28 },
    { nhan: 'Chức danh', rong: 30 }, { nhan: 'Vai trò', rong: 28 }, { nhan: 'Mật khẩu tạm', rong: 16 }, { nhan: 'Ghi chú', rong: 60 }];
  const dong = rows.map((r) => [r.stt, r.ho_ten, r.username, r.phong, r.chuc_danh, r.vai, r.mat_khau, GHI_CHU_LAN_DAU]);
  const hd = [[`Địa chỉ truy cập: ${url}`], [`Đặt lại lúc ${luc} bởi ${nguoi}. Mật khẩu tạm chỉ dùng cho lần đăng nhập đầu; tệp này giao tận tay hoặc qua kênh an toàn, xoá sau khi bàn giao.`],
    ...BUOC.map((b) => [b])];
  return [{ ten: 'Bàn giao', cot, dong }, { ten: 'Hướng dẫn', cot: [{ nhan: 'Hướng dẫn cho người nhận tài khoản', rong: 120 }], dong: hd }];
}

export const tenTepBanGiao = (d = new Date(), duoi = 'xlsx', hauTo = '') => {
  const p = (n) => String(n).padStart(2, '0');
  return `ban-giao-tai-khoan${hauTo ? `-${hauTo}` : ''}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.${duoi}`;
};

// Trang in: mỗi người một phiếu (đường cắt), A4, tự in khi mở. Chữ thuần, không tải gì từ mạng.
export function htmlPhieuBanGiao(rows, { url = '', luc = '', nguoi = '', tuIn = true } = {}) {
  const phieu = (r) => `<section class="phieu"><h2>PHIẾU BÀN GIAO TÀI KHOẢN</h2><p class="he">Hệ thống quản trị nhiệm vụ — Văn phòng Tỉnh ủy Cao Bằng</p>
<table><tr><th>Họ và tên</th><td>${esc(r.ho_ten)}</td></tr><tr><th>Đơn vị · chức danh</th><td>${esc([r.phong, r.chuc_danh].filter(Boolean).join(' · '))}</td></tr>
<tr><th>Địa chỉ truy cập</th><td class="url">${esc(url)}</td></tr><tr><th>Tên đăng nhập</th><td class="ma">${esc(r.username)}</td></tr><tr><th>Mật khẩu tạm</th><td class="ma mk">${esc(r.mat_khau)}</td></tr></table>
<ol>${BUOC.map((b) => `<li>${esc(b.replace(/^\d+\. /, ''))}</li>`).join('')}</ol><p class="chan">Phát ngày ${esc(luc)} · Người đặt lại: ${esc(nguoi)} · Phiếu này chỉ dùng một lần, không dán nơi công cộng.</p></section>`;
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Phiếu bàn giao tài khoản</title><style>
@page{size:A4;margin:12mm} body{font-family:"Times New Roman",serif;font-size:13pt;color:#111;margin:0}
.phieu{border:1px dashed #777;border-radius:6px;padding:10mm 12mm;margin:0 0 8mm;break-inside:avoid;page-break-inside:avoid}
h2{font-size:15pt;margin:0;letter-spacing:.02em;color:#1F3A5F} .he{margin:2px 0 8px;font-style:italic;color:#444}
table{border-collapse:collapse;width:100%} th,td{text-align:left;padding:4px 8px;border-bottom:1px solid #ddd;vertical-align:top} th{width:34%;font-weight:600;color:#333}
.ma{font-family:Consolas,"Courier New",monospace;font-size:14pt;letter-spacing:.06em} .mk{font-weight:700} .url{word-break:break-all}
ol{margin:8px 0 4px 18px;padding:0;font-size:11.5pt} li{margin:2px 0} .chan{font-size:10.5pt;color:#555;margin:6px 0 0}
@media screen{body{background:#eee;padding:16px} .phieu{background:#fff;max-width:190mm;margin:0 auto 10px}}
</style></head><body>${rows.map(phieu).join('')}${tuIn ? '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),300));</script>' : ''}</body></html>`;
}
