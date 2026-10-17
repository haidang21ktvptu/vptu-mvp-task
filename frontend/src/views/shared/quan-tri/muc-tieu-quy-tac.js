// Quản trị › Danh mục mục tiêu — phần "Quy tắc nhận diện" của một mục tiêu (v3.25, migration 0107 bảng quy_tac_muc_tieu, 0109 them_quy_tac /
// sua_quy_tac, 0111 kiem_thu_quy_tac + tự học, 0112 trợ lý AI soạn): bảng quy tắc (loại, giá trị — tên ngành / lĩnh vực, mức, trạng thái, nguồn, khoá,
// bộ đếm tự học), quản trị sửa mức / trạng thái / khoá / ghi chú (giá trị không sửa được — thêm quy tắc mới rồi tắt quy tắc cũ), thêm quy tắc, kiểm
// thử trên dữ liệu; quản trị "Soạn quy tắc bằng AI" (Edge Function tro-ly-ai — quy tắc AI vào Đề xuất, tự kiểm rồi bật mức gợi ý hoặc tắt). Mọi tài
// khoản đăng nhập đọc được quy tắc (giải thích vì sao có gợi ý); đọc theo trang (không bị giới hạn số dòng của máy chủ). Hàm DB / Edge Function là chốt quyền.
import { supabase } from '../../../lib/supabase.js';
import { escapeHtml, formatDateTime } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { danhMucKl, cauHinhKl } from '../../../lib/kl/du-lieu.js';
import { loiDeHieu } from '../../../lib/kl/loi.js';
import { taiTheoTrang } from '../../../lib/kl/cot.js';
import { trangThaiAi, soanQuyTacAi } from '../../../lib/kl/tro-ly-ai.js';
import { askLyDo } from './ly-do-modal.js';
import { laQuanTriMt, LOAI_QT, MUC_QT, TT_QT, NGUON_QT, demQuyTac, moTaKiemThu, moTaSoanAi } from './muc-tieu-thuan.js';

const esc = escapeHtml;
let ds = [];   // mọi quy tắc (đọc một lần mỗi lần vẽ khu)
let ai = null;   // trạng thái trợ lý AI (trangThaiAi) — ẩn nút "Soạn quy tắc bằng AI" khi tắt / chưa có khoá
const kiemThu = new Map();   // id quy tắc → câu kết quả kiểm thử gần nhất
const ketQuaAi = new Map();   // mã mục tiêu → câu kết quả lần soạn gần nhất
const dangSoan = new Set();
let veLai = () => {};

export async function napQuyTac() {
  const [r, t] = await Promise.all([
    taiTheoTrang(() => supabase.from('quy_tac_muc_tieu').select('id, muc_tieu_ma, loai, gia_tri, muc, trang_thai, khoa, nguon, so_lan_hien, so_lan_nhan, so_lan_bo, ghi_chu, tao_luc, cap_nhat_luc')
      .order('loai').order('gia_tri').order('id'), 'Đọc quy tắc nhận diện'),
    trangThaiAi().catch(() => null),
  ]);
  ds = r; ai = t;
}
const THU_TU_LOAI = ['SO_HIEU', 'TU_KHOA', 'LINH_VUC', 'NGANH', 'LOAI_TRU']; const THU_TU_TT = ['BAT', 'DE_XUAT', 'TAT'];
// Của một mục tiêu: số hiệu → từ khoá → lĩnh vực → ngành → loại trừ; trong loại: đang bật trước.
export const quyTacCua = (ma) => ds.filter((q) => q.muc_tieu_ma === ma)
  .sort((a, b) => THU_TU_LOAI.indexOf(a.loai) - THU_TU_LOAI.indexOf(b.loai) || THU_TU_TT.indexOf(a.trang_thai) - THU_TU_TT.indexOf(b.trang_thai) || a.gia_tri.localeCompare(b.gia_tri, 'vi'));
const aiDung = () => Boolean(ai?.bat && ai?.co_khoa);

const tenGiaTri = (q) => (q.loai === 'LINH_VUC' ? danhMucKl().linhVuc?.find((l) => l.ma === q.gia_tri)?.ten : q.loai === 'NGANH' ? danhMucKl().nganh?.find((n) => n.ma === q.gia_tri)?.ten : null) || q.gia_tri;
const sel = (f, id, ds2, chon, nhan) => `<select class="o-nhap nho" data-qt-f="${f}" data-id="${esc(id)}" aria-label="${esc(nhan)}">${ds2.map(([ma, ten, tat]) => `<option value="${ma}"${ma === chon ? ' selected' : ''}${tat ? ' disabled' : ''}>${esc(ten)}</option>`).join('')}</select>`;
const LOP_TT = { BAT: 'tt-xong', TAT: 'tt-xam', DE_XUAT: 'tt-cho' };

function dongHtml(q, qt) {
  const ten = tenGiaTri(q); const id = esc(q.id); const kt = kiemThu.get(q.id);
  const o = (nhan, noi, lop = '') => `<td data-nhan="${nhan}"${lop ? ` class="${lop}"` : ''}>${noi}</td>`;
  const muc = qt ? sel('muc', q.id, Object.entries(MUC_QT), q.muc, `Mức của quy tắc ${q.gia_tri}`) : esc(MUC_QT[q.muc] || q.muc);
  const tt = qt ? sel('trang_thai', q.id, [...(q.trang_thai === 'DE_XUAT' ? [['DE_XUAT', 'Đề xuất — chờ', true]] : []), ['BAT', 'Bật'], ['TAT', 'Tắt']], q.trang_thai, `Trạng thái của quy tắc ${q.gia_tri}`)
    : `<span class="trang-thai ${LOP_TT[q.trang_thai] || 'tt-xam'}">${esc(TT_QT[q.trang_thai] || q.trang_thai)}</span>`;
  const khoa = qt ? `<input type="checkbox" data-qt-f="khoa" data-id="${id}"${q.khoa ? ' checked' : ''} aria-label="Khoá cố định quy tắc ${esc(q.gia_tri)}" title="Khoá: giữ cố định, không tự nâng / hạ">` : q.khoa ? 'Có' : '—';
  const ghi = qt ? `<input type="text" class="o-nhap nho" data-qt-f="ghi_chu" data-id="${id}" value="${esc(q.ghi_chu || '')}" maxlength="300" aria-label="Ghi chú quy tắc ${esc(q.gia_tri)}">` : esc(q.ghi_chu || '');
  const nut = qt ? `<div class="thao-tac"><button type="button" class="nut nho" data-action="qtQtLuu" data-id="${id}">Lưu</button>
    <button type="button" class="nut nho" data-action="qtQtKiem" data-id="${id}" title="Chạy quy tắc trên mọi việc gốc (không đổi gì)">Kiểm thử</button></div>` : '';
  return `<tr>${o('Loại', esc(LOAI_QT[q.loai] || q.loai))}${o('Giá trị', `<b>${esc(ten)}</b>${ten !== q.gia_tri ? `<small class="chu-phu">${esc(q.gia_tri)}</small>` : ''}`)}${o('Mức', muc)}${o('Trạng thái', tt)}
    ${o('Nguồn', `${esc(NGUON_QT[q.nguon] || q.nguon)}<small class="chu-phu">${esc(formatDateTime(q.cap_nhat_luc || q.tao_luc))}</small>`)}${o('Tự học', esc(demQuyTac(q)), 'chu-phu')}
    ${o('Khoá', khoa, 'so')}${o('Ghi chú', ghi, qt ? '' : 'chu-phu')}<td class="phai">${nut}</td></tr>${kt ? `<tr class="qt-qt-kq"><td colspan="9">${esc(kt)}</td></tr>` : ''}`;
}

function themHtml(ma) {
  const loai = Object.entries(LOAI_QT).map(([m, t]) => `<option value="${m}"${m === 'TU_KHOA' ? ' selected' : ''}>${esc(t)}</option>`).join('');   // từ khoá: loại hay thêm nhất
  return `<div class="qt-qt-them" data-ma="${esc(ma)}"><select class="o-nhap nho" data-qt-them="loai" aria-label="Loại quy tắc mới">${loai}</select>
    <input type="text" class="o-nhap nho" data-qt-them="gia_tri" maxlength="120" placeholder="Cụm từ (so khớp không dấu, theo nguyên cụm)" aria-label="Giá trị quy tắc mới" autocomplete="off">
    <select class="o-nhap nho hidden" data-qt-them="chon" aria-label="Chọn ngành hoặc lĩnh vực"></select>
    <select class="o-nhap nho" data-qt-them="muc" aria-label="Mức của quy tắc mới"><option value="GOI_Y">Gợi ý</option><option value="TU_TICH">Tích sẵn</option></select>
    <button type="button" class="nut nho chinh" data-action="qtQtThem" data-ma="${esc(ma)}">Thêm quy tắc</button></div>`;
}

export function quyTacHtml(m) {
  const u = state.user; const qt = laQuanTriMt(u); const ds2 = quyTacCua(m.ma);
  const n = cauHinhKl('goi_y_so_lan_xet', 20);
  const giai = `Tích sẵn: hệ thống tự tích khi giao việc (người giao bỏ được). Gợi ý: hiện để bấm thêm. Quy tắc không khoá tự điều chỉnh sau ${n} lần hiện: gợi ý được chọn từ ${cauHinhKl('goi_y_nang_phan_tram', 90)}% → tích sẵn; tích sẵn được giữ dưới ${cauHinhKl('goi_y_ha_phan_tram', 80)}% → gợi ý; gợi ý được chọn dưới ${cauHinhKl('goi_y_tat_phan_tram', 5)}% (sau 30 lần) → tự tắt. Số hiệu và từ loại trừ không tự đổi.${qt ? ' Muốn đổi giá trị: thêm quy tắc mới rồi tắt quy tắc cũ (bộ đếm tự học không lẫn).' : ''}`;
  const soan = qt && aiDung() && m.dang_dung !== false && !m.gop_vao
    ? `<button type="button" class="nut nho" data-action="qtQtSoanAi" data-ma="${esc(m.ma)}"${dangSoan.has(m.ma) ? ' disabled' : ''}>${dangSoan.has(m.ma) ? 'Đang soạn…' : 'Soạn quy tắc bằng AI'}</button>` : '';
  const kq = ketQuaAi.get(m.ma);
  return `<section class="qt-mt-phan" aria-label="Quy tắc nhận diện của ${esc(m.ten_ngan)}"><h4>Quy tắc nhận diện</h4><p class="chu-phu">${esc(giai)}</p>
    ${ds2.length ? `<div class="bang-cuon"><table class="qt-qt-bang"><thead><tr><th>Loại</th><th>Giá trị</th><th>Mức</th><th>Trạng thái</th><th>Nguồn</th><th>Tự học</th><th class="so">Khoá</th><th>Ghi chú</th><th class="phai"><span class="sr">Thao tác</span></th></tr></thead>
      <tbody>${ds2.map((q) => dongHtml(q, qt)).join('')}</tbody></table></div>` : '<p class="chu-phu">Chưa có quy tắc — mục tiêu chỉ được gắn khi cán bộ chọn hoặc khi văn bản đã gắn.</p>'}
    ${qt ? themHtml(m.ma) : ''}${soan || kq ? `<div class="qt-qt-ai">${soan}${kq ? `<small class="chu-phu" aria-live="polite">${esc(kq)}</small>` : ''}</div>` : ''}</section>`;
}

const lay = (id, f) => document.querySelector(`[data-qt-f="${f}"][data-id="${CSS.escape(id)}"]`);
async function qtQtLuu({ id }) {
  const q = ds.find((x) => x.id === id); if (!q) return;
  const moi = { muc: lay(id, 'muc').value, trang_thai: lay(id, 'trang_thai').value, khoa: lay(id, 'khoa').checked, ghi_chu: lay(id, 'ghi_chu').value.trim() || null };
  if (moi.trang_thai === 'DE_XUAT') { notifyError('Quy tắc đang chờ tự kiểm — chọn Bật hoặc Tắt.'); return; }
  const p = Object.fromEntries(Object.entries(moi).filter(([k, v]) => (q[k] ?? null) !== v));
  if (!Object.keys(p).length) { notifyError('Không có gì thay đổi.'); return; }
  const ld = await askLyDo({ title: 'Sửa quy tắc nhận diện', moTa: `${LOAI_QT[q.loai]} "${tenGiaTri(q)}": ${Object.keys(p).map((k) => ({ muc: `mức → ${MUC_QT[p.muc]}`, trang_thai: `trạng thái → ${TT_QT[p.trang_thai]}`, khoa: p.khoa ? 'khoá cố định' : 'bỏ khoá (tự học được đổi mức)', ghi_chu: 'ghi chú' }[k])).join(', ')}.`, nhanXacNhan: 'Lưu' });
  if (!ld) return;
  const { error } = await supabase.rpc('sua_quy_tac', { p_id: id, p, p_ly_do: ld.lyDo });
  if (error) { notifyError(`Không lưu được quy tắc: ${loiDeHieu(error)}`); return; }
  notifySuccess('Đã lưu quy tắc.');
  await napQuyTac(); veLai();
}
async function qtQtKiem({ id }) {
  const { data, error } = await supabase.rpc('kiem_thu_quy_tac', { p_id: id });
  if (error) { notifyError(`Không kiểm thử được: ${loiDeHieu(error)}`); return; }
  kiemThu.set(id, `Kiểm thử: ${moTaKiemThu(data)}`); veLai();
}
async function qtQtThem({ ma }, nut) {
  const vung = nut.closest('.qt-qt-them'); const v = (f) => vung.querySelector(`[data-qt-them="${f}"]`);
  const loai = v('loai').value; const giaTri = ['LINH_VUC', 'NGANH'].includes(loai) ? v('chon').value : v('gia_tri').value.trim();
  if (!giaTri) { notifyError('Nhập giá trị của quy tắc.'); return; }
  const ld = await askLyDo({ title: 'Thêm quy tắc nhận diện', moTa: `${LOAI_QT[loai]} "${giaTri}" — mức ${MUC_QT[v('muc').value]}. Quy tắc quản trị thêm được khoá cố định (không tự nâng / hạ).`, nhanXacNhan: 'Thêm' });
  if (!ld) return;
  const { error } = await supabase.rpc('them_quy_tac', { p_ma: ma, p_loai: loai, p_gia_tri: giaTri, p_muc: v('muc').value, p_ly_do: ld.lyDo });
  if (error) { notifyError(`Không thêm được quy tắc: ${loiDeHieu(error)}`); return; }
  notifySuccess('Đã thêm quy tắc.');
  await napQuyTac(); veLai();
}
async function qtQtSoanAi({ ma }) {
  if (dangSoan.has(ma)) return;
  dangSoan.add(ma); veLai();
  try {
    const r = await soanQuyTacAi(ma);
    const chu = moTaSoanAi(r.ket_qua); ketQuaAi.set(ma, chu); notifySuccess(chu);
    await napQuyTac();
  } catch (e) { ketQuaAi.set(ma, `Chưa soạn được: ${e.message}`); notifyError(`Trợ lý AI chưa soạn được quy tắc: ${e.message}`); }
  dangSoan.delete(ma); veLai();
}
// Đổi loại ở ô thêm quy tắc: ngành / lĩnh vực → ô chọn theo danh mục; còn lại → ô chữ.
function doiLoai(e) {
  const s = e.target.closest?.('[data-qt-them="loai"]'); if (!s) return;
  const vung = s.closest('.qt-qt-them'); const chon = vung.querySelector('[data-qt-them="chon"]'); const chu = vung.querySelector('[data-qt-them="gia_tri"]');
  const ds2 = s.value === 'LINH_VUC' ? danhMucKl().linhVuc || [] : s.value === 'NGANH' ? danhMucKl().nganh || [] : null;
  chon.classList.toggle('hidden', !ds2); chu.classList.toggle('hidden', Boolean(ds2));
  if (ds2) chon.innerHTML = ds2.map((x) => `<option value="${esc(x.ma)}">${esc(x.ten)}</option>`).join('');
  chu.placeholder = s.value === 'SO_HIEU' ? 'Ví dụ 57-NQ/TW' : 'Cụm từ (so khớp không dấu, theo nguyên cụm)';
}

export function mountQuyTac(goc, ve) {
  veLai = ve;
  goc.addEventListener('change', doiLoai);
  registerActions({ qtQtLuu, qtQtKiem, qtQtThem, qtQtSoanAi });
}
