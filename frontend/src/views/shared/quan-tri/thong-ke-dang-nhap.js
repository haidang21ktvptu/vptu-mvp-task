// Thống kê sử dụng › Đăng nhập (0104, v3.24): qt_thong_ke_dang_nhap (theo cán bộ, chỉ quản trị hệ thống) + nhat_ky_dang_nhap (từng lần đăng
// nhập, RLS chỉ quản trị đọc). Kỳ / khoảng ngày theo giờ Việt Nam; dải số vừa là tóm tắt vừa là bộ lọc; lọc phòng, vai trò, tìm tên; xem theo
// cán bộ (bấm tên mở từng lần đăng nhập trong kỳ) hoặc theo thời gian (mới nhất trước, đọc từng trang 100 lượt; xuất Excel đọc đủ). Lượt nạp
// cũ về sau lượt mới bị bỏ (tk.lanNap). #tkDnBody[data-nap] = đã nạp xong (e2e chờ).
import { supabase } from '../../../lib/supabase.js';
import { $, show, setText, escapeHtml, showInlineError } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { DEPT_NAMES } from '../../../lib/constants.js';
import { notifyError } from '../../../components/toast.js';
import { homNayVN } from '../../../lib/kl/ngay.js';
import { taiTheoTrang } from '../../../lib/kl/cot.js';
import { khoangDangNhap, gioVN, thietBi, tomTatDangNhap } from '../../../lib/thong-ke.js';

const VAI = { A0: 'Thường trực Tỉnh ủy', A1: 'Lãnh đạo Văn phòng', A2: 'Trưởng phòng', A3: 'Chuyên viên' };
const MOI_LAN = 100;
const tk = { ky: '30-ngay', khoang: null, dong: [], loc: 'tat', xem: 'can-bo', mo: new Set(), phien: new Map(), thoiGian: [], conNua: false, tomTat: null, lanNap: 0 };
const tkCua = (id) => state.accounts.find((a) => a.id === id) || {};
const tenCua = (id) => tkCua(id).full_name || 'Tài khoản đã xoá';
const phongCua = (a) => DEPT_NAMES[a.department] || a.department || (a.role_group === 'A0' ? 'Thường trực Tỉnh ủy' : '');

function datKhoang() {
  const k = khoangDangNhap(tk.ky, homNayVN(), { tu: $('tkDnTu').value, den: $('tkDnDen').value });
  showInlineError('tkDnLoi', k ? '' : 'Khoảng ngày chưa đúng: chọn Từ ngày trước hoặc bằng Đến ngày.');
  if (!k) return false;
  tk.khoang = k; $('tkDnTu').value = k.tuNgay; $('tkDnDen').value = k.denNgay;
  document.querySelectorAll('[data-action="tkDnKy"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ky === tk.ky)));
  return true;
}

export async function renderThongKeDangNhap() {
  if (!datKhoang()) return;
  $('tkDnBody').removeAttribute('data-nap');
  const lan = ++tk.lanNap; const { tu, den } = tk.khoang;
  const [r, tg] = await Promise.all([
    supabase.rpc('qt_thong_ke_dang_nhap', { p_tu: tu, p_den: den }),
    tk.xem === 'thoi-gian' ? docThoiGian(0) : Promise.resolve(null),
  ]);
  if (lan !== tk.lanNap) return;   // đã đổi kỳ trong lúc đọc
  if (r.error) { notifyError('Không đọc được thống kê đăng nhập: ' + r.error.message); return; }
  tk.dong = r.data || []; tk.phien.clear(); tk.mo.clear();
  if (tg) datThoiGian(tg, false);
  ve();
}

// Từng lượt đăng nhập trong kỳ, mới nhất trước — đọc theo trang (range), không phụ thuộc giới hạn 1000 dòng của PostgREST.
const truyVanThoiGian = (tu, den) => supabase.from('nhat_ky_dang_nhap').select('id, tai_khoan, luc, hoat_dong_cuoi, trinh_duyet, dia_chi_ip')
  .gte('luc', tu).lt('luc', den).order('luc', { ascending: false }).order('id', { ascending: false });
async function docThoiGian(tuDong) {
  if (!tk.khoang) return null;
  const { tu, den } = tk.khoang;
  const r = await truyVanThoiGian(tu, den).range(tuDong, tuDong + MOI_LAN - 1);
  if (r.error) { notifyError('Không đọc được nhật ký đăng nhập: ' + r.error.message); return null; }
  return r.data || [];
}
function datThoiGian(ds, them) { tk.thoiGian = them ? [...tk.thoiGian, ...ds] : ds; tk.conNua = ds.length === MOI_LAN; }

// Lọc theo phòng / vai trò / tìm (áp cho cả hai cách xem) — trên tài khoản.
function hopLoc(id) {
  const a = tkCua(id); const kw = $('tkDnTim').value.trim().toLowerCase();
  return (!$('tkDnPhong').value || a.department === $('tkDnPhong').value) && (!$('tkDnVai').value || a.role_group === $('tkDnVai').value)
    && (!kw || `${a.full_name || ''} ${a.username || ''}`.toLowerCase().includes(kw));
}

function ve() {
  if (!tk.khoang) return;   // chưa nạp lần nào (gõ tìm / bấm lọc trước khi có số liệu)
  const ds = tk.dong.filter((r) => hopLoc(r.tai_khoan));
  const t = tomTatDangNhap(ds); tk.tomTat = t;
  setText('tkDnSo-da', `${t.da} / ${t.tong}`); setText('tkDnSo-tat', t.luot); setText('tkDnSo-chua', t.chua);
  setText('tkDnSo-homNay', t.homNay); setText('tkDnSo-dangHd', t.dangHd);
  document.querySelectorAll('[data-action="tkDnLoc"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.loc === tk.loc)));
  document.querySelectorAll('[data-action="tkDnXem"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.xem === tk.xem)));
  setText('tkDnTomTat', `${tk.khoang.tuNgay.split('-').reverse().join('/')} – ${tk.khoang.denNgay.split('-').reverse().join('/')}`);
  if (tk.xem === 'thoi-gian') veThoiGian(); else veCanBo(ds.filter(t.loc[tk.loc] || t.loc.tat));
  $('tkDnBody').dataset.nap = new Date().toISOString();
}

const lanGanNhat = (r) => (r.lan_cuoi ? gioVN(r.lan_cuoi) : r.lan_cuoi_tong ? `Ngoài kỳ đang xem — lần cuối ${gioVN(r.lan_cuoi_tong)}`
  : r.lan_cuoi_xac_thuc ? `${gioVN(r.lan_cuoi_xac_thuc)} (theo hệ thống xác thực)` : 'Chưa từng đăng nhập');
function veCanBo(ds) {
  $('tkDnDau').innerHTML = '<tr><th class="so">STT</th><th>Cán bộ</th><th>Phòng</th><th class="so">Số lần đăng nhập</th><th>Lần gần nhất</th><th>Hoạt động gần nhất</th><th>Thiết bị gần nhất</th></tr>';
  const dangHd = tk.tomTat.loc.dangHd;
  $('tkDnBody').innerHTML = ds.length ? ds.map((r, i) => {
    const a = tkCua(r.tai_khoan); const mo = tk.mo.has(r.tai_khoan) && r.so_lan > 0;
    return `<tr data-tai-khoan="${r.tai_khoan}" class="${r.so_lan ? '' : 'tk-chua'}"><td class="so">${i + 1}</td>
      <td><button type="button" class="tk-ten" data-action="tkDnMo" data-id="${r.tai_khoan}" aria-expanded="${mo}"${r.so_lan ? '' : ' disabled'}>${escapeHtml(tenCua(r.tai_khoan))}</button>
        <small class="chu-phu">${escapeHtml(a.position_title || VAI[a.role_group] || '')} · ${escapeHtml(a.username || '')}</small></td>
      <td data-nhan="Phòng">${escapeHtml(phongCua(a))}</td>
      <td data-nhan="Số lần đăng nhập" class="so">${r.so_lan ? `<b class="tk-so-lan">${r.so_lan}</b>` : '<span class="trang-thai tt-cho">Chưa đăng nhập</span>'}</td>
      <td data-nhan="Lần gần nhất">${escapeHtml(lanGanNhat(r))}</td>
      <td data-nhan="Hoạt động gần nhất">${r.hoat_dong_cuoi ? escapeHtml(gioVN(r.hoat_dong_cuoi)) : '—'}${dangHd(r) ? ' <span class="trang-thai tt-xong">Đang hoạt động</span>' : ''}</td>
      <td data-nhan="Thiết bị gần nhất">${r.trinh_duyet ? escapeHtml(thietBi(r.trinh_duyet)) : '—'}<small class="chu-phu">${escapeHtml(r.dia_chi_ip || '')}</small></td></tr>
      ${mo ? `<tr class="tk-phien-hang"><td colspan="7">${phienHtml(r.tai_khoan)}</td></tr>` : ''}`;
  }).join('') : '<tr><td colspan="7" class="trong">Không có tài khoản nào phù hợp điều kiện lọc.</td></tr>';
  setText('tkDnChan', `${ds.length} tài khoản · đăng nhập gần nhất trước; bấm tên để xem từng lần đăng nhập trong kỳ`);
  show('tkDnThem', false);
}

function phienHtml(id) {
  const ds = tk.phien.get(id);
  if (!ds) return '<p class="chu-phu">Đang tải các lần đăng nhập…</p>';
  return `<table class="tk-phien"><thead><tr><th>Đăng nhập lúc</th><th>Trình duyệt, thiết bị</th><th>Địa chỉ IP</th><th>Hoạt động gần nhất</th></tr></thead><tbody>${
    ds.map((p) => `<tr><td data-nhan="Đăng nhập lúc">${escapeHtml(gioVN(p.luc))}</td><td data-nhan="Thiết bị">${escapeHtml(thietBi(p.trinh_duyet))}</td>
      <td data-nhan="Địa chỉ IP">${escapeHtml(p.dia_chi_ip || '—')}</td><td data-nhan="Hoạt động gần nhất">${escapeHtml(gioVN(p.hoat_dong_cuoi))}</td></tr>`).join('')}</tbody></table>
    ${ds.length >= 50 ? '<p class="chu-phu">Hiện 50 lần gần nhất trong kỳ; xuất Excel ở cách xem Theo thời gian để có đủ.</p>' : ''}`;
}

function veThoiGian() {
  $('tkDnDau').innerHTML = '<tr><th class="so">STT</th><th>Đăng nhập lúc</th><th>Cán bộ</th><th>Phòng</th><th>Trình duyệt, thiết bị</th><th>Địa chỉ IP</th><th>Hoạt động gần nhất</th></tr>';
  const ds = tk.thoiGian.filter((p) => hopLoc(p.tai_khoan));
  $('tkDnBody').innerHTML = ds.length ? ds.map((p, i) => `<tr data-tai-khoan="${p.tai_khoan}"><td class="so">${i + 1}</td><td data-nhan="Đăng nhập lúc"><b>${escapeHtml(gioVN(p.luc))}</b></td>
      <td data-nhan="Cán bộ">${escapeHtml(tenCua(p.tai_khoan))}</td><td data-nhan="Phòng">${escapeHtml(phongCua(tkCua(p.tai_khoan)))}</td>
      <td data-nhan="Thiết bị">${escapeHtml(thietBi(p.trinh_duyet))}</td><td data-nhan="Địa chỉ IP">${escapeHtml(p.dia_chi_ip || '—')}</td>
      <td data-nhan="Hoạt động gần nhất">${escapeHtml(gioVN(p.hoat_dong_cuoi))}</td></tr>`).join('')
    : '<tr><td colspan="7" class="trong">Chưa có lượt đăng nhập nào trong kỳ phù hợp điều kiện lọc.</td></tr>';
  setText('tkDnChan', `${ds.length} lượt${tk.conNua ? ' gần nhất' : ''} trong kỳ · mới nhất trước${ds.length < tk.thoiGian.length ? ` (đã đọc ${tk.thoiGian.length} lượt, lọc còn ${ds.length})` : ''}`);
  show('tkDnThem', tk.conNua);
}

async function moCanBo({ id }) {
  if (tk.mo.has(id)) { tk.mo.delete(id); ve(); return; }
  tk.mo.add(id); ve();
  const lan = tk.lanNap; const { tu, den } = tk.khoang;
  const r = await supabase.from('nhat_ky_dang_nhap').select('luc, hoat_dong_cuoi, trinh_duyet, dia_chi_ip').eq('tai_khoan', id)
    .gte('luc', tu).lt('luc', den).order('luc', { ascending: false }).limit(50);
  if (lan !== tk.lanNap) return;
  if (r.error) { notifyError('Không đọc được các lần đăng nhập: ' + r.error.message); tk.mo.delete(id); }
  else tk.phien.set(id, r.data || []);
  ve();
}

async function xuatExcel() {
  const { taoXlsx, taiXuong } = await import('../../../lib/xlsx.js');
  const theoTg = tk.xem === 'thoi-gian';
  const tatCa = theoTg ? await taiTheoTrang(() => truyVanThoiGian(tk.khoang.tu, tk.khoang.den), 'đọc nhật ký đăng nhập') : [];   // đủ mọi lượt của kỳ
  const dong = theoTg
    ? tatCa.filter((p) => hopLoc(p.tai_khoan)).map((p) => [gioVN(p.luc), tenCua(p.tai_khoan), phongCua(tkCua(p.tai_khoan)), thietBi(p.trinh_duyet), p.dia_chi_ip || '', gioVN(p.hoat_dong_cuoi)])
    : tk.dong.filter((r) => hopLoc(r.tai_khoan)).filter(tk.tomTat.loc[tk.loc]).map((r) => [tenCua(r.tai_khoan), tkCua(r.tai_khoan).username || '', phongCua(tkCua(r.tai_khoan)),
      r.so_lan, lanGanNhat(r), gioVN(r.hoat_dong_cuoi), r.trinh_duyet ? thietBi(r.trinh_duyet) : '', r.dia_chi_ip || '']);
  const cot = (theoTg ? ['Đăng nhập lúc', 'Cán bộ', 'Phòng', 'Trình duyệt, thiết bị', 'Địa chỉ IP', 'Hoạt động gần nhất']
    : ['Cán bộ', 'Tên đăng nhập', 'Phòng', 'Số lần đăng nhập', 'Lần gần nhất', 'Hoạt động gần nhất', 'Thiết bị gần nhất', 'Địa chỉ IP']).map((nhan) => ({ nhan, rong: 22 }));
  taiXuong(`dang-nhap-${tk.khoang.tuNgay}-${tk.khoang.denNgay}.xlsx`, taoXlsx([{ ten: theoTg ? 'Theo thời gian' : 'Theo cán bộ', cot, dong }]));
}

export const hanhDongDangNhap = {
  tkDnKy: ({ ky }) => { tk.ky = ky; $('tkDnTu').value = ''; $('tkDnDen').value = ''; renderThongKeDangNhap(); },
  tkDnXemKhoang: () => { tk.ky = 'tuy-chon'; renderThongKeDangNhap(); },
  tkDnLoc: ({ loc }) => { tk.loc = loc; if (tk.xem === 'thoi-gian') tk.xem = 'can-bo'; ve(); },
  tkDnXem: async ({ xem }) => {
    tk.xem = xem;
    if (xem === 'thoi-gian') { const lan = tk.lanNap; const ds = await docThoiGian(0); if (lan !== tk.lanNap) return; if (ds) datThoiGian(ds, false); }
    ve();
  },
  tkDnThem: async () => { const lan = tk.lanNap; const ds = await docThoiGian(tk.thoiGian.length); if (lan !== tk.lanNap) return; if (ds) datThoiGian(ds, true); ve(); },
  tkDnMo: moCanBo,
  tkDnXuat: () => xuatExcel().catch((e) => notifyError('Không xuất được tệp: ' + e.message)),
};
export function ganLocDangNhap() {
  $('tkDnTim').addEventListener('input', () => ve());
  ['tkDnPhong', 'tkDnVai'].forEach((id) => $(id).addEventListener('change', () => ve()));
}
