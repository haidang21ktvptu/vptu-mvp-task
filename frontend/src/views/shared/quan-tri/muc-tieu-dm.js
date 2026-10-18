// Quản trị › Danh mục mục tiêu (v3.25 — "thêm nhanh, sửa có kiểm soát, không xoá", chủ dự án duyệt 17/10/2026): bảng mục tiêu then chốt theo nhóm
// (tìm không dấu, lọc nhóm, trạng thái), thêm / sửa (them_muc_tieu, sua_muc_tieu — 0108), khoá khi đã đối chiếu văn bản gốc / mở khoá / ngừng / dùng
// lại (dat_trang_thai_muc_tieu), gộp mục trùng (gop_muc_tieu — 0109), lịch sử + khôi phục một lần sửa (dm_lich_su, khoi_phuc_muc_tieu). Mỗi dòng mở
// phần chi tiết: quy tắc nhận diện (muc-tieu-quy-tac.js), lịch sử, gộp. Nút chỉ ẩn / hiện theo quyền (muc-tieu-thuan.js) — hàm DB là chốt, lỗi DB báo
// nguyên văn tiếng Việt. Ghi xong: bỏ bản danh mục nhớ trong phiên, đọc lại, vẽ lại (cả nhóm, khối).
import { supabase } from '../../../lib/supabase.js';
import { $, show, escapeHtml, formatDateTime } from '../../../lib/dom.js';
import { state, findAccount } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { loadDanhMucKl, danhMucKl, xoaDanhMucDaNho } from '../../../lib/kl/du-lieu.js';
import { dsNhom } from '../../../lib/kl/muc-tieu.js';
import { loiDeHieu } from '../../../lib/kl/loi.js';
import { askLyDo } from './ly-do-modal.js';
import { laQuanTriMt, laNhapMt, quyenSuaMt, locMucTieu, NGUON_THEM, TEN_HANH_DONG_DM, moTaThayDoiDm, hoaDau } from './muc-tieu-thuan.js';
import { napQuyTac, quyTacCua, quyTacHtml, mountQuyTac } from './muc-tieu-quy-tac.js';
import { veNhomKhoi, mountNhomKhoi } from './muc-tieu-nhom-khoi.js';

const esc = escapeHtml;
const mo = new Map();   // mã → Set('qt' | 'ql' | 'ls') — phần chi tiết đang mở (quy tắc, quản lý + gộp, lịch sử)
const lichSu = new Map();   // mã → dòng dm_lich_su (null = đang đọc)
let dangSua = null;   // mã đang sửa ở biểu mẫu (null = thêm mới)
const dm = () => danhMucKl().mucTieu || [];
const nhomDs = () => dsNhom(danhMucKl().nhomMucTieu, dm());
const tenNhom = (ma) => nhomDs().find((n) => n.ma === ma)?.ten || ma;
const tim = (ma) => dm().find((m) => m.ma === ma) || null;
const tenKhoi = (ma) => danhMucKl().khoi?.find((k) => k.ma === ma)?.ten;
const tenNganh = (ma) => danhMucKl().nganh?.find((n) => n.ma === ma)?.ten;

function trangThaiHtml(m) {
  const dc = m.trang_thai === 'DA_DOI_CHIEU' ? '<span class="trang-thai tt-xong" title="Đã đối chiếu văn bản gốc — nội dung khoá">Đã đối chiếu</span>'
    : '<span class="trang-thai tt-cho" title="Dùng được ngay; chờ quản trị hệ thống đối chiếu văn bản gốc">Mới</span>';
  const ngung = m.gop_vao ? `<span class="trang-thai tt-xam">Đã gộp vào ${esc(tim(m.gop_vao)?.ten_ngan || m.gop_vao)}</span>` : m.dang_dung === false ? '<span class="trang-thai tt-xam">Ngừng dùng</span>' : '';
  return `<div class="qt-mt-tt">${dc}${ngung}</div>`;
}
// Thao tác trên dòng: Sửa (khi được), Quản lý (quản trị: khoá / mở khoá, ngừng / dùng lại, gộp — mở phần chi tiết), Lịch sử.
function nutHtml(m, u) {
  const d = `data-ma="${esc(m.ma)}"`; const n = [];
  const nut = (act, chu, them = '') => n.push(`<button type="button" class="nut nho" data-action="${act}" ${d}${them}>${chu}</button>`);
  const moCon = (phan) => ` data-phan="${phan}" aria-expanded="${String(Boolean(mo.get(m.ma)?.has(phan)))}"`;
  const q = quyenSuaMt(u, m);
  if (q === 'sua') nut('qtMtSua', 'Sửa');
  if (laQuanTriMt(u) && !m.gop_vao) nut('qtMtMoCon', 'Quản lý', `${moCon('ql')}${q === 'mo_khoa_truoc' ? ' title="Đã đối chiếu — mở khoá ở đây trước khi sửa"' : ''}`);
  nut('qtMtMoCon', 'Lịch sử', moCon('ls'));
  return `<div class="thao-tac">${n.join('')}</div>`;
}
function quanLyHtml(m) {
  const d = `data-ma="${esc(m.ma)}"`;
  const nut = (hd, chu, giai) => `<div class="qt-mt-ql-hang"><button type="button" class="nut nho" data-action="qtMtTrangThai" data-hd="${hd}" ${d}>${chu}</button><small class="chu-phu">${giai}</small></div>`;
  const khoa = m.trang_thai === 'DA_DOI_CHIEU' ? nut('mo_khoa', 'Mở khoá', 'trở lại trạng thái Mới để sửa nội dung; đối chiếu xong thì khoá lại')
    : nut('khoa', 'Khoá — đã đối chiếu', 'đã đối chiếu văn bản gốc: khoá nội dung với mọi người');
  const dung = m.dang_dung === false ? nut('dung_lai', 'Dùng lại', 'trở lại ô chọn, gợi ý, quy tắc nhận diện')
    : nut('ngung', 'Ngừng dùng', 'không còn trong ô chọn và gợi ý; việc, văn bản đã gắn giữ nguyên');
  return `<section class="qt-mt-phan" aria-label="Quản lý ${esc(m.ten_ngan)}"><h4>Quản lý</h4>${khoa}${dung}</section>${m.dang_dung === false ? '' : gopHtml(m)}`;
}
function lichSuHtml(m) {
  const ds = lichSu.get(m.ma); const qt = laQuanTriMt(state.user);
  if (!ds) return '<section class="qt-mt-phan"><h4>Lịch sử</h4><p class="chu-phu">Đang tải…</p></section>';
  return `<section class="qt-mt-phan" aria-label="Lịch sử của ${esc(m.ten_ngan)}"><h4>Lịch sử</h4>${ds.length ? `<ul class="qt-mt-ls">${ds.map((r) => `<li>
    <span class="chu-phu">${esc(formatDateTime(r.luc))} · ${esc(r.nguoi ? findAccount(r.nguoi)?.full_name || 'Cán bộ' : hoaDau(r.nguoi_ghi_chu) || 'Hệ thống')}</span>
    <b>${esc(TEN_HANH_DONG_DM[r.hanh_dong] || r.hanh_dong)}</b> ${esc(moTaThayDoiDm({ ...r, bang: 'dm_muc_tieu' }, { khoi: tenKhoi, nganh: tenNganh }))}${r.ly_do ? ` <span class="chu-phu">— ${esc(r.ly_do)}</span>` : ''}
    ${qt && ['sua', 'khoi_phuc'].includes(r.hanh_dong) && r.gia_tri_cu && Object.keys(r.gia_tri_cu).length ? `<button type="button" class="nut nho" data-action="qtMtKhoiPhuc" data-id="${r.id}" data-ma="${esc(m.ma)}">Khôi phục giá trị cũ</button>` : ''}</li>`).join('')}</ul>`
    : '<p class="chu-phu">Chưa có thay đổi nào.</p>'}</section>`;
}
function gopHtml(m) {
  const ds = dm().filter((x) => x.ma !== m.ma && x.dang_dung !== false && !x.gop_vao).sort((a, b) => (a.nhom === m.nhom ? 0 : 1) - (b.nhom === m.nhom ? 0 : 1) || a.thu_tu - b.thu_tu);
  return `<section class="qt-mt-phan" aria-label="Gộp ${esc(m.ten_ngan)}"><h4>Gộp vào mục khác (mục trùng)</h4><p class="chu-phu">Mọi việc, văn bản đang gắn "${esc(m.ten_ngan)}" chuyển sang mục giữ lại; quy tắc chuyển theo; mục này ngừng dùng. Không tự hoàn tác.</p>
    <div class="form-hang"><div class="grow"><label class="nhan" for="qtMtGopVao-${esc(m.ma)}">Giữ lại mục</label><select id="qtMtGopVao-${esc(m.ma)}" class="o-nhap nho">
      ${ds.map((x) => `<option value="${esc(x.ma)}">${esc(`${x.ten_ngan} — ${tenNhom(x.nhom)}`)}</option>`).join('')}</select></div>
      <button type="button" class="nut nho chinh" data-action="qtMtGop" data-ma="${esc(m.ma)}">Gộp vào mục đã chọn</button></div></section>`;
}
function dongHtml(m, u) {
  const nguoi = m.tao_boi ? findAccount(m.tao_boi)?.full_name : ''; const qt = quyTacCua(m.ma); const dang = mo.get(m.ma);
  const con = dang?.size ? `<tr class="qt-mt-con"><td colspan="7">${dang.has('qt') ? quyTacHtml(m) : ''}${dang.has('ql') && laQuanTriMt(u) && !m.gop_vao ? quanLyHtml(m) : ''}${dang.has('ls') ? lichSuHtml(m) : ''}</td></tr>` : '';
  const ten = m.ten !== m.ten_ngan ? m.ten : '';   // mục hệ thống tự thêm: tên đã gồm phần "về…" của nội dung → không lặp (kiểm tay 18/10)
  const phu = [ten, m.mo_ta && !ten.toLowerCase().includes(m.mo_ta.trim().toLowerCase()) ? m.mo_ta : ''].filter(Boolean).join(' — ');
  const canCu = [m.can_cu, m.chi_tieu ? `chỉ tiêu: ${m.chi_tieu}` : ''].filter(Boolean).join(' · ');
  return `<tr class="${m.dang_dung === false || m.gop_vao ? 'qt-mt-ngung' : ''}"><td data-nhan="Mục tiêu" class="tieude"><span class="qt-mt-ten">${esc(m.ten_ngan)}</span>${phu ? `<small>${esc(phu)}</small>` : ''}
      ${canCu ? `<small>${esc(canCu)}</small>` : ''}<small class="qt-mt-ma">${esc(m.ma)}</small></td>
    <td data-nhan="Số hiệu" class="qt-mt-sh">${m.so_hieu ? esc(m.so_hieu) : '<span class="chu-phu">—</span>'}</td><td data-nhan="Nhóm">${esc(tenNhom(m.nhom))}</td><td data-nhan="Trạng thái">${trangThaiHtml(m)}</td>
    <td data-nhan="Nguồn">${esc(NGUON_THEM[m.nguon_them] || m.nguon_them || '')}${nguoi ? `<small class="chu-phu qt-mt-nguoi">${esc(nguoi)}</small>` : ''}</td>
    <td data-nhan="Quy tắc" class="so"><button type="button" class="nut nho" data-action="qtMtMoCon" data-phan="qt" data-ma="${esc(m.ma)}" aria-expanded="${String(Boolean(dang?.has('qt')))}"
      aria-label="Quy tắc nhận diện của ${esc(m.ten_ngan)}: ${qt.filter((x) => x.trang_thai === 'BAT').length} đang bật / ${qt.length}">${qt.filter((x) => x.trang_thai === 'BAT').length} / ${qt.length}</button></td>
    <td class="phai">${nutHtml(m, u)}</td></tr>${con}`;
}

function dienLoc() {
  const s = $('qtMtLocNhom'); const cu = s.value;
  s.innerHTML = `<option value="">Mọi nhóm</option>${nhomDs().map((n) => `<option value="${esc(n.ma)}">${esc(n.ten)}</option>`).join('')}`;
  if ([...s.options].some((o) => o.value === cu)) s.value = cu;
}
export function veBang() {
  const u = state.user;
  const ds = locMucTieu(dm(), { tim: $('qtMtTim').value, nhom: $('qtMtLocNhom').value, trangThai: $('qtMtLocTT').value });
  const tt = { nhom: nhomDs().map((n) => n.ma) };
  ds.sort((a, b) => tt.nhom.indexOf(a.nhom) - tt.nhom.indexOf(b.nhom) || a.thu_tu - b.thu_tu);
  $('qtMtBody').innerHTML = !dm().length ? '<tr><td colspan="7" class="trong">Chưa có danh mục mục tiêu trên project này (cần migration 0105–0113).</td></tr>'
    : ds.map((m) => dongHtml(m, u)).join('') || '<tr><td colspan="7" class="trong">Không có mục tiêu khớp bộ lọc.</td></tr>';
  const moi = dm().filter((m) => m.trang_thai === 'MOI' && m.dang_dung !== false && !m.gop_vao).length;
  $('qtMtDem').textContent = `Đang hiện ${ds.length}/${dm().length} mục tiêu${moi ? ` · ${moi} mục mới chờ đối chiếu văn bản gốc` : ''}.`;
  show('qtMtNutThem', laNhapMt(u) || laQuanTriMt(u));
  $('qtMtGiai').textContent = laQuanTriMt(u) ? 'Quản trị hệ thống: sửa, khoá khi đã đối chiếu văn bản gốc, ngừng dùng, gộp mục trùng, khôi phục lần sửa; quy tắc nhận diện sửa ở nút "Quy tắc" của từng dòng.'
    : 'Cán bộ thêm được mục tiêu mới (dùng ngay) và sửa mục mình vừa thêm khi chưa được đối chiếu; mục khác chỉ xem — quản trị hệ thống đối chiếu, khoá, gộp.';
}
export async function renderMucTieu() {
  try { await loadDanhMucKl(true); } catch (e) { notifyError(`Không đọc được danh mục: ${loiDeHieu(e)}`); }
  try { await napQuyTac(); } catch (e) { notifyError(`Không đọc được quy tắc nhận diện: ${loiDeHieu(e)}`); }
  dienLoc(); veBang(); veNhomKhoi();
}
async function sauGhi() { xoaDanhMucDaNho(); lichSu.clear(); await renderMucTieu(); }

// ---- Biểu mẫu thêm / sửa ----
const F = { nhom: 'qtMtNhom', so_hieu: 'qtMtSoHieu', ten_ngan: 'qtMtTenNgan', thu_tu: 'qtMtThuTu', ten: 'qtMtTen', mo_ta: 'qtMtMoTa', can_cu: 'qtMtCanCu', chi_tieu: 'qtMtChiTieu' };
function goiYSoHieu() {
  const n = nhomDs().find((x) => x.ma === $('qtMtNhom').value);
  $('qtMtSoHieuChu').textContent = n?.mau_so_hieu ? 'đúng dạng của nhóm — trùng số hiệu sẽ bị chặn; có số hiệu thì hệ thống tự nhận diện văn bản nhắc tới' : 'nhóm này thường không có số hiệu — có thể để trống';
  show('qtMtChiTieuWrap', $('qtMtNhom').value === 'CHI_TIEU' || Boolean($('qtMtChiTieu').value));
}
function moForm(m = null) {
  dangSua = m?.ma || null;
  const ds = nhomDs().filter((n) => n.dang_dung !== false || n.ma === m?.nhom);
  $('qtMtNhom').innerHTML = ds.map((n) => `<option value="${esc(n.ma)}">${esc(n.ten)}</option>`).join('');
  Object.entries(F).forEach(([k, id]) => { if (k !== 'nhom') $(id).value = m ? m[k] ?? '' : ''; });
  const nhomChon = m?.nhom || $('qtMtLocNhom').value;   // ô chọn: gán giá trị không có trong danh sách sẽ bỏ chọn hết → chỉ gán khi có
  if (nhomChon && ds.some((n) => n.ma === nhomChon)) $('qtMtNhom').value = nhomChon; else $('qtMtNhom').selectedIndex = 0;
  $('qtMtLyDoThem').value = '';
  $('qtMtFormTieuDe').textContent = m ? `Sửa mục tiêu ${m.ten_ngan}` : 'Thêm mục tiêu vào danh mục';
  $('qtMtLuuNut').textContent = m ? 'Lưu thay đổi' : 'Thêm vào danh mục';
  ['qtMtThuTuWrap'].forEach((id) => show(id, Boolean(m))); show('qtMtLyDoThemWrap', !m);
  $('qtMtFormChu').textContent = m ? 'Lưu cần ghi lý do; nhật ký giữ giá trị cũ để khôi phục.' : 'Mục mới dùng được ngay cho mọi cán bộ; quản trị hệ thống đối chiếu văn bản gốc rồi khoá nội dung.';
  goiYSoHieu(); show('qtMtForm', true); $('qtMtTen').focus();
}
async function qtMtLuu() {
  const v = Object.fromEntries(Object.entries(F).map(([k, id]) => [k, k === 'thu_tu' ? Number($(id).value) : $(id).value.trim()]));
  if (!v.ten) { notifyError('Nhập tên mục tiêu.'); $('qtMtTen').focus(); return; }
  if (!dangSua) {
    const { data, error } = await supabase.rpc('them_muc_tieu', { p_nhom: v.nhom, p_ten: v.ten, p_ten_ngan: v.ten_ngan || null, p_so_hieu: v.so_hieu || null, p_mo_ta: v.mo_ta || null,
      p_can_cu: v.can_cu || null, p_chi_tieu: v.chi_tieu || null, p_ly_do: $('qtMtLyDoThem').value.trim() || null });
    if (error) { notifyError(`Không thêm được mục tiêu: ${loiDeHieu(error)}`); return; }
    show('qtMtForm', false); notifySuccess(`Đã thêm "${v.ten_ngan || v.ten}" (${data}) vào danh mục.`); await sauGhi(); return;
  }
  const m = tim(dangSua); if (!m) return;
  if (!Number.isInteger(v.thu_tu) || v.thu_tu < 1) { notifyError('Thứ tự là số nguyên dương.'); return; }
  const p = Object.fromEntries(Object.entries(v).filter(([k, x]) => (m[k] ?? '') !== (x ?? '') && !(k === 'ten_ngan' && !x)));
  if (!Object.keys(p).length) { notifyError('Không có gì thay đổi.'); return; }
  const ld = await askLyDo({ title: 'Sửa mục tiêu', moTa: `${m.ten_ngan}: đổi ${Object.keys(p).map((k) => ({ ten: 'tên', ten_ngan: 'tên ngắn', so_hieu: 'số hiệu', nhom: 'nhóm', thu_tu: 'thứ tự', mo_ta: 'nội dung', can_cu: 'căn cứ', chi_tieu: 'chỉ tiêu' }[k])).join(', ')}. Việc đã gắn giữ nguyên.`, nhanXacNhan: 'Lưu' });
  if (!ld) return;
  const { error } = await supabase.rpc('sua_muc_tieu', { p_ma: m.ma, p, p_ly_do: ld.lyDo });
  if (error) { notifyError(`Không sửa được: ${loiDeHieu(error)}`); return; }
  show('qtMtForm', false); notifySuccess(`Đã lưu ${m.ten_ngan}.`); await sauGhi();
}

// ---- Trạng thái, gộp, lịch sử ----
const HD = { khoa: ['Khoá mục tiêu (đã đối chiếu văn bản gốc)', 'Nội dung khoá với mọi người; muốn sửa phải mở khoá. Việc đã gắn không đổi.', 'Khoá'],
  mo_khoa: ['Mở khoá mục tiêu', 'Mục trở lại trạng thái Mới để sửa; sau khi sửa và đối chiếu lại thì khoá.', 'Mở khoá'],
  ngung: ['Ngừng dùng mục tiêu', 'Không còn trong ô chọn và gợi ý; việc, văn bản đã gắn giữ nguyên, Tổng quan vẫn tính; dùng lại được.', 'Ngừng dùng'],
  dung_lai: ['Dùng lại mục tiêu', 'Mục trở lại ô chọn, gợi ý và quy tắc nhận diện.', 'Dùng lại'] };
async function qtMtTrangThai({ ma, hd }) {
  const m = tim(ma); const h = HD[hd]; if (!m || !h) return;
  const ld = await askLyDo({ title: h[0], moTa: `${m.ten_ngan}: ${h[1]}`, nhanXacNhan: h[2] });
  if (!ld) return;
  const { error } = await supabase.rpc('dat_trang_thai_muc_tieu', { p_ma: ma, p_hanh_dong: hd, p_ly_do: ld.lyDo });
  if (error) { notifyError(`Không thực hiện được: ${loiDeHieu(error)}`); return; }
  notifySuccess(`${h[2]}: ${m.ten_ngan}.`); await sauGhi();
}
async function qtMtGop({ ma }) {
  const a = tim(ma); const b = tim($(`qtMtGopVao-${ma}`)?.value); if (!a || !b) { notifyError('Chọn mục giữ lại.'); return; }
  const ld = await askLyDo({ title: 'Gộp mục tiêu trùng', moTa: `"${a.ten_ngan}" → "${b.ten_ngan}": mọi việc, văn bản đang gắn chuyển sang mục giữ lại; "${a.ten_ngan}" ngừng dùng. Không tự hoàn tác.`, nhanXacNhan: 'Gộp' });
  if (!ld) return;
  const { data, error } = await supabase.rpc('gop_muc_tieu', { p_tu: a.ma, p_vao: b.ma, p_ly_do: ld.lyDo });
  if (error) { notifyError(`Không gộp được: ${loiDeHieu(error)}`); return; }
  mo.delete(ma); notifySuccess(`Đã gộp vào ${b.ten_ngan}: chuyển ${data?.so_viec ?? 0} việc, ${data?.so_van_ban ?? 0} văn bản.`); await sauGhi();
}
async function docLichSu(ma) {
  const { data, error } = await supabase.from('dm_lich_su').select('id, luc, nguoi, nguoi_ghi_chu, hanh_dong, gia_tri_cu, gia_tri_moi, ly_do')
    .eq('bang', 'dm_muc_tieu').eq('ma', ma).order('id', { ascending: false }).limit(30);
  if (error) { notifyError(`Không đọc được lịch sử: ${loiDeHieu(error)}`); lichSu.set(ma, []); } else lichSu.set(ma, data || []);
  veBang();
}
function qtMtMoCon({ ma, phan }) {
  const s = mo.get(ma) || new Set();
  if (s.has(phan)) s.delete(phan); else s.add(phan);
  mo.set(ma, s); veBang();
  if (phan === 'ls' && s.has('ls') && !lichSu.has(ma)) docLichSu(ma);
}
async function qtMtKhoiPhuc({ id, ma }) {
  const m = tim(ma);
  const ld = await askLyDo({ title: 'Khôi phục lần sửa', moTa: `${m?.ten_ngan || ma}: trả các thông tin của lần sửa này về giá trị cũ (ghi nhật ký "Khôi phục").`, nhanXacNhan: 'Khôi phục' });
  if (!ld) return;
  const { error } = await supabase.rpc('khoi_phuc_muc_tieu', { p_lich_su: Number(id), p_ly_do: ld.lyDo });
  if (error) { notifyError(`Không khôi phục được: ${loiDeHieu(error)}`); return; }
  notifySuccess('Đã khôi phục giá trị cũ.'); await sauGhi();
}

export function mountMucTieu() {
  const goc = $('qtKhuMucTieu');
  ['qtMtTim', 'qtMtLocNhom', 'qtMtLocTT'].forEach((id) => $(id).addEventListener(id === 'qtMtTim' ? 'input' : 'change', veBang));
  $('qtMtNhom').addEventListener('change', goiYSoHieu);
  mountQuyTac(goc, veBang); mountNhomKhoi(goc, sauGhi);
  registerActions({ qtMtMoThem: () => moForm(), qtMtSua: ({ ma }) => moForm(tim(ma)), qtMtHuyForm: () => show('qtMtForm', false), qtMtLuu, qtMtTrangThai, qtMtGop, qtMtMoCon, qtMtKhoiPhuc });
}
