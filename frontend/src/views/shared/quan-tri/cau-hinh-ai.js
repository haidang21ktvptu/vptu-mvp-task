// Quản trị › Cấu hình AI (v3.25, migration 0112 — chủ dự án chọn Claude, yêu cầu đổi sang dịch vụ khác nhanh, thuận tiện): đọc cau_hinh_ai (một dòng),
// đổi nhà cung cấp / mô hình / địa chỉ / mức suy nghĩ / bật tắt / cho gửi nội dung / giới hạn lượt qua qt_dat_cau_hinh_ai (quản trị hệ thống hoặc toàn
// quyền, lý do bắt buộc, ghi Nhật ký hệ thống). Khoá API KHÔNG đi qua giao diện: mỗi nhà cung cấp một secret cố định của Edge Function tro-ly-ai —
// ở đây chỉ báo "đã có / chưa có" (trangThaiAi) và tên secret cần thêm. "Kiểm tra kết nối" gọi thử một câu rất ngắn (kiemTraAi). Nhật ký dùng: 50 lượt
// gần nhất của nhat_ky_ai (chỉ quản trị đọc — RLS 0112) và số lượt hôm nay (giờ Việt Nam).
import { supabase } from '../../../lib/supabase.js';
import { $, show, escapeHtml, formatDateTime } from '../../../lib/dom.js';
import { findAccount } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { homNayVN } from '../../../lib/kl/ngay.js';
import { loiDeHieu } from '../../../lib/kl/loi.js';
import { trangThaiAi, kiemTraAi, xoaNhoAi } from '../../../lib/kl/tro-ly-ai.js';
import { askLyDo } from './ly-do-modal.js';
import { NHA_CUNG_CAP_AI, timNhaCungCap, HANH_DONG_AI, KET_QUA_AI, doiCauHinhAi, kiemCauHinhAi, giay } from './muc-tieu-thuan.js';

const esc = escapeHtml;
let ch = null;   // cấu hình đang lưu
let tt = null;   // trangThaiAi
const moHinhTheoNcc = new Map();   // nhà cung cấp → mô hình người dùng đã gõ trong phiên (đổi qua lại không mất)

function veTrangThai() {
  const n = timNhaCungCap(ch?.nha_cung_cap); const loiFn = tt && !tt.ten && tt.loi;
  const khoa = ch?.nha_cung_cap === 'gia_lap' ? 'giả lập (chỉ kiểm thử cục bộ)' : tt?.co_khoa ? 'đã có' : loiFn ? 'chưa xác định' : 'chưa có';
  $('qtAiTrangThai').innerHTML = !ch ? '<p class="chu-phu">Chưa có cấu hình trợ lý AI trên project này (cần migration 0112).</p>'
    : `<dl class="qt-ai-dl"><div><dt>Trạng thái</dt><dd><span class="trang-thai ${ch.bat ? 'tt-xong' : 'tt-xam'}">${ch.bat ? 'Đang bật' : 'Đang tắt'}</span></dd></div>
      <div><dt>Nhà cung cấp</dt><dd>${esc(n?.ten || ch.nha_cung_cap)}</dd></div><div><dt>Mô hình</dt><dd><code class="text-xs">${esc(ch.mo_hinh)}</code></dd></div>
      <div><dt>Khoá API (${esc(n?.khoa || '—')})</dt><dd><span class="trang-thai ${tt?.co_khoa ? 'tt-xong' : 'tt-cho'}">${esc(khoa)}</span></dd></div>
      <div><dt>Gửi nội dung văn bản</dt><dd>${ch.gui_noi_dung ? 'Cho phép' : 'Không cho phép'}</dd></div>
      <div><dt>Cập nhật</dt><dd>${ch.cap_nhat_luc ? esc(`${formatDateTime(ch.cap_nhat_luc)} · ${findAccount(ch.cap_nhat_boi)?.full_name || ''}`) : 'mặc định khi cài'}</dd></div></dl>
      ${loiFn ? `<p class="luong-canh-bao" role="status">${esc(tt.ma === 'CHUA_CO' ? 'Edge Function tro-ly-ai chưa được triển khai trên project này — giao diện vẫn lưu được cấu hình.' : `Chưa đọc được trạng thái trợ lý AI: ${tt.loi}`)}</p>` : ''}`;
  const k = timNhaCungCap($('qtAiForm').querySelector('input[name="qtAiNcc"]:checked')?.value) || n;
  $('qtAiKhoa').innerHTML = `<h3>Khoá API của ${esc(k?.ten || 'nhà cung cấp')}</h3><ol class="qt-ai-buoc">
    <li>Lấy khoá API ở trang quản trị của nhà cung cấp (tài khoản của Văn phòng, có giới hạn chi tiêu).</li>
    <li>Supabase Dashboard › Edge Functions › Secrets › thêm secret tên <code>${esc(k?.khoa || 'AI_KEY_…')}</code>, giá trị là khoá vừa lấy (hoặc lệnh <code>supabase secrets set ${esc(k?.khoa || 'AI_KEY_…')}=…</code>).</li>
    <li>Quay lại đây bấm "Kiểm tra kết nối". Không nhập khoá vào hệ thống này, không gửi khoá qua tin nhắn.</li></ol>`;
}

function veNcc(chon) {
  $('qtAiNccDs').innerHTML = NHA_CUNG_CAP_AI.map((n) => `<label class="qt-ai-the${n.ma === chon ? ' chon' : ''}"><input type="radio" name="qtAiNcc" value="${n.ma}"${n.ma === chon ? ' checked' : ''}>
    <span><b>${esc(n.ten)}</b><small>${n.ma === ch?.nha_cung_cap ? '<em class="qt-ai-dang">Đang dùng</em> · ' : ''}${esc(n.moTa)} · secret ${esc(n.khoa)}</small></span></label>`).join('');
}
function datMoHinhDs(ma) {
  const n = timNhaCungCap(ma);
  $('qtAiMoHinhDs').innerHTML = (n?.moHinh || []).map((m) => `<option value="${esc(m)}"></option>`).join('');
  $('qtAiMoHinhChu').textContent = n?.moHinh?.length ? `gợi ý: ${n.moHinh.join(', ')} — gõ được tên khác theo công bố của nhà cung cấp` : 'tên mô hình đúng như dịch vụ công bố';
  show('qtAiDiaChiWrap', Boolean(n?.canDiaChi));
}
function doiNcc(e) {
  if (e.target.name !== 'qtAiNcc') return;
  const truoc = $('qtAiForm').dataset.ncc; if (truoc) moHinhTheoNcc.set(truoc, $('qtAiMoHinh').value.trim());
  const ma = e.target.value; const n = timNhaCungCap(ma); $('qtAiForm').dataset.ncc = ma;
  $('qtAiMoHinh').value = moHinhTheoNcc.get(ma) || (ma === ch?.nha_cung_cap ? ch.mo_hinh : n?.moHinh?.[0] || '');
  $('qtAiNccDs').querySelectorAll('.qt-ai-the').forEach((l) => l.classList.toggle('chon', l.querySelector('input').checked));
  datMoHinhDs(ma); veTrangThai();
  $('qtAiDoiChu').textContent = ma !== ch?.nha_cung_cap ? `Đang chọn ${n?.ten} — chưa lưu. Lưu (ghi lý do) rồi thêm secret ${n?.khoa} nếu chưa có, sau đó bấm "Kiểm tra kết nối".`
    : 'Lưu cần ghi lý do; thay đổi ghi vào Nhật ký hệ thống.';
}
function dienForm() {
  const ma = ch?.nha_cung_cap === 'gia_lap' ? '' : ch?.nha_cung_cap || 'anthropic';
  veNcc(ma); $('qtAiForm').dataset.ncc = ma;
  $('qtAiMoHinh').value = ch?.mo_hinh || ''; $('qtAiMuc').value = ch?.muc_suy_nghi || 'medium'; $('qtAiDiaChi').value = ch?.dia_chi || '';
  $('qtAiNgay').value = ch?.gioi_han_ngay ?? 300; $('qtAiNguoi').value = ch?.gioi_han_nguoi ?? 40;
  $('qtAiBat').checked = ch ? ch.bat : true; $('qtAiGui').checked = ch ? ch.gui_noi_dung : true;
  datMoHinhDs(ma); show('qtAiForm', Boolean(ch));
  $('qtAiDoiChu').textContent = 'Lưu cần ghi lý do; thay đổi ghi vào Nhật ký hệ thống.';
}

async function veNhatKy() {
  const [ds, dem] = await Promise.all([
    supabase.from('nhat_ky_ai').select('id, luc, nguoi, hanh_dong, nha_cung_cap, mo_hinh, token_vao, token_ra, thoi_gian_ms, so_trang, ket_qua, loi').order('id', { ascending: false }).limit(50),
    supabase.from('nhat_ky_ai').select('id', { count: 'exact', head: true }).gte('luc', `${homNayVN()}T00:00:00+07:00`).neq('ket_qua', 'TU_CHOI'),
  ]);
  if (ds.error) { $('qtAiNhatKyBody').innerHTML = `<tr><td colspan="7" class="trong">Không đọc được nhật ký: ${esc(loiDeHieu(ds.error))}</td></tr>`; return; }
  $('qtAiDem').textContent = `hôm nay ${dem.count ?? 0}${ch ? `/${ch.gioi_han_ngay}` : ''} lượt · 50 lượt gần nhất — không lưu nội dung văn bản hay kết quả`;
  const so = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('vi-VN'));
  $('qtAiNhatKyBody').innerHTML = (ds.data || []).map((r) => `<tr><td class="whitespace-nowrap">${esc(formatDateTime(r.luc))}</td>
    <td data-nhan="Người">${esc(r.nguoi ? findAccount(r.nguoi)?.full_name || 'Cán bộ' : 'Hệ thống (học đêm)')}</td>
    <td data-nhan="Việc">${esc(HANH_DONG_AI[r.hanh_dong] || r.hanh_dong)}${r.so_trang ? `<small class="chu-phu">${r.so_trang} trang</small>` : ''}</td>
    <td data-nhan="Nhà cung cấp">${esc(timNhaCungCap(r.nha_cung_cap)?.ten || r.nha_cung_cap || '')}<small class="chu-phu">${esc(r.mo_hinh || '')}</small></td>
    <td data-nhan="Token" class="so">${so(r.token_vao)} / ${so(r.token_ra)}</td><td data-nhan="Thời gian" class="so">${r.thoi_gian_ms ? giay(r.thoi_gian_ms) : '—'}</td>
    <td data-nhan="Kết quả"><span class="trang-thai ${r.ket_qua === 'OK' ? 'tt-xong' : ['TU_CHOI', 'DANG'].includes(r.ket_qua) ? 'tt-cho' : 'tt-qua'}">${esc(KET_QUA_AI[r.ket_qua] || r.ket_qua)}</span>${r.loi ? `<small class="chu-phu">${esc(r.loi)}</small>` : ''}</td></tr>`).join('')
    || '<tr><td colspan="7" class="trong">Chưa có lượt dùng nào.</td></tr>';
}

export async function renderCauHinhAi() {
  const [r, t] = await Promise.all([supabase.from('cau_hinh_ai').select('*').eq('id', 1).maybeSingle(), trangThaiAi(true)]);
  ch = r.error ? null : r.data; tt = t;
  if (r.error) notifyError(`Không đọc được cấu hình trợ lý AI: ${loiDeHieu(r.error)}`);
  moHinhTheoNcc.clear(); dienForm(); veTrangThai();
  await veNhatKy();
}

async function qtAiLuu() {
  if (!ch) return;
  const ma = $('qtAiForm').querySelector('input[name="qtAiNcc"]:checked')?.value;
  const p = { nha_cung_cap: ma, mo_hinh: $('qtAiMoHinh').value.trim(), muc_suy_nghi: $('qtAiMuc').value,
    dia_chi: ma === 'khac' ? $('qtAiDiaChi').value.trim() || null : ch.dia_chi, bat: $('qtAiBat').checked, gui_noi_dung: $('qtAiGui').checked,
    gioi_han_ngay: Number($('qtAiNgay').value), gioi_han_nguoi: Number($('qtAiNguoi').value) };
  const loi = kiemCauHinhAi(p); if (loi) { notifyError(loi); return; }
  const d = doiCauHinhAi(ch, p);
  if (!Object.keys(d).length) { notifyError('Không có gì thay đổi.'); return; }
  const n = timNhaCungCap(p.nha_cung_cap);
  const ld = await askLyDo({ title: 'Lưu cấu hình trợ lý AI', nhanXacNhan: 'Lưu',
    moTa: `${d.nha_cung_cap ? `Chuyển sang ${n.ten} (cần secret ${n.khoa}). ` : ''}${'bat' in d ? (d.bat ? 'Bật trợ lý AI. ' : 'Tắt trợ lý AI — mọi nút AI ẩn. ') : ''}Đổi ${Object.keys(d).length} thông tin; ghi Nhật ký hệ thống.` });
  if (!ld) return;
  const { error } = await supabase.rpc('qt_dat_cau_hinh_ai', { p: d, p_ly_do: ld.lyDo });
  if (error) { notifyError(`Không lưu được cấu hình: ${loiDeHieu(error)}`); return; }
  xoaNhoAi(); notifySuccess(d.nha_cung_cap ? `Đã chuyển trợ lý AI sang ${n.ten}. Bấm "Kiểm tra kết nối" để thử.` : 'Đã lưu cấu hình trợ lý AI.');
  await renderCauHinhAi();
}
async function qtAiKiemTra() {
  const nut = $('qtAiKiemTraNut'); nut.disabled = true; nut.textContent = 'Đang kiểm tra…';
  try {
    const r = await kiemTraAi();
    notifySuccess(`Kết nối được${r.nha_cung_cap ? ` ${r.nha_cung_cap}` : ''}${r.mo_hinh ? ` (${r.mo_hinh})` : ''}${r.thoi_gian_ms ? ` sau ${giay(r.thoi_gian_ms)}` : ''}: "${r.ket_qua?.tra_loi || 'đã trả lời'}".`);
  } catch (e) { notifyError(`Chưa kết nối được: ${e.message}`); }
  nut.disabled = false; nut.textContent = 'Kiểm tra kết nối';
  tt = await trangThaiAi(true); veTrangThai(); await veNhatKy();
}

export function mountCauHinhAi() {
  $('qtAiForm').addEventListener('change', doiNcc);
  registerActions({ qtAiLuu, qtAiKiemTra, qtAiTaiLai: () => veNhatKy() });
}
