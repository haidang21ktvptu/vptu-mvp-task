// Quản trị › Danh mục mục tiêu — nhóm mục tiêu và khối lĩnh vực (v3.25, migration 0107 bảng dm_nhom_muc_tieu, dm_khoi_linh_vuc.dang_dung,
// dm_linh_vuc.khoi_ma; 0109 them_nhom_muc_tieu / sua_nhom_muc_tieu, them_khoi_linh_vuc / sua_khoi_linh_vuc, dat_khoi_linh_vuc). Quản trị hệ thống sửa
// (lý do bắt buộc, ghi nhật ký danh mục); người khác xem. Nhóm = một thẻ ở khối 2 Tổng quan (dạng số hiệu: nhận diện văn bản để tự thêm mục tiêu);
// khối = cách gom ngành ở khối 3 (một lĩnh vực có thể thuộc khối riêng; trống = theo khối của ngành). Dữ liệu từ kl_danh_muc (đọc lại sau khi ghi).
import { supabase } from '../../../lib/supabase.js';
import { $, escapeHtml } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { danhMucKl } from '../../../lib/kl/du-lieu.js';
import { loiDeHieu } from '../../../lib/kl/loi.js';
import { askLyDo } from './ly-do-modal.js';
import { laQuanTriMt } from './muc-tieu-thuan.js';

const esc = escapeHtml;
let sauGhi = async () => {};
const nhom = () => [...(danhMucKl().nhomMucTieu || [])].sort((a, b) => a.thu_tu - b.thu_tu);
const khoi = () => [...(danhMucKl().khoi || [])].sort((a, b) => a.thu_tu - b.thu_tu);
const tenKhoi = (ma) => khoi().find((k) => k.ma === ma)?.ten || ma || '';
const inp = (f, ma, v, them = '') => `<input class="o-nhap nho" data-f="${f}" data-ma="${esc(ma)}" value="${esc(v ?? '')}"${them}>`;
const coDung = (f, ma, v, nhan) => `<label class="nhan-checkbox qt-mt-co"><input type="checkbox" data-f="${f}" data-ma="${esc(ma)}"${v !== false ? ' checked' : ''}> ${esc(nhan)}</label>`;

function nhomHtml(qt) {
  $('qtMtNhomThem').innerHTML = qt ? `<form class="form-hang" data-submit="qtNhomThem" novalidate>
    <div><label class="nhan" for="qtNhomTen">Tên nhóm mới</label><input id="qtNhomTen" class="o-nhap nho" maxlength="120" placeholder="Ví dụ Chương trình hành động của Tỉnh ủy" autocomplete="off"></div>
    <div><label class="nhan" for="qtNhomTab">Nhãn thẻ</label><input id="qtNhomTab" class="o-nhap nho" maxlength="40" placeholder="Ngắn, hiện ở Tổng quan" autocomplete="off"></div>
    <div><label class="nhan" for="qtNhomMau">Dạng số hiệu (nếu có)</label><input id="qtNhomMau" class="o-nhap nho" maxlength="200" placeholder="^[0-9]{1,5}-CTr/TU$" autocomplete="off"></div>
    <button type="submit" class="nut nho chinh">Thêm nhóm</button></form>` : '';
  $('qtMtNhomBody').innerHTML = nhom().map((n) => (qt ? `<tr data-nhom="${esc(n.ma)}"><td data-nhan="Tên nhóm">${inp('ten', n.ma, n.ten, ' maxlength="120" aria-label="Tên nhóm"')}<small class="qt-mt-ma">${esc(n.ma)}</small></td>
      <td data-nhan="Nhãn thẻ">${inp('tab', n.ma, n.tab, ' maxlength="40" aria-label="Nhãn thẻ"')}</td><td data-nhan="Dạng số hiệu">${inp('mau_so_hieu', n.ma, n.mau_so_hieu, ' maxlength="200" aria-label="Dạng số hiệu"')}</td>
      <td data-nhan="Thứ tự" class="so">${inp('thu_tu', n.ma, n.thu_tu, ' type="number" min="1" step="1" style="width:80px" aria-label="Thứ tự"')}</td><td data-nhan="Đang dùng">${coDung('dang_dung', n.ma, n.dang_dung, 'Đang dùng')}</td>
      <td class="phai"><div class="thao-tac"><button type="button" class="nut nho" data-action="qtNhomLuu" data-ma="${esc(n.ma)}">Lưu</button></div></td></tr>`
    : `<tr><td data-nhan="Tên nhóm" class="tieude">${esc(n.ten)}</td><td data-nhan="Nhãn thẻ">${esc(n.tab)}</td><td data-nhan="Dạng số hiệu"><code class="text-xs">${esc(n.mau_so_hieu || '—')}</code></td>
      <td data-nhan="Thứ tự" class="so">${n.thu_tu}</td><td data-nhan="Đang dùng">${n.dang_dung === false ? 'Ngừng' : 'Đang dùng'}</td><td></td></tr>`)).join('')
    || '<tr><td colspan="6" class="trong">Chưa có nhóm (cần migration 0107).</td></tr>';
}

function chonKhoi(bang, ma, hien, { theoNganh = '' } = {}) {
  const ds = khoi().filter((k) => k.dang_dung !== false || k.ma === hien);
  return `<select class="o-nhap nho" data-khoi-bang="${bang}" data-ma="${esc(ma)}" data-cu="${esc(hien || '')}" aria-label="Khối">${bang === 'dm_linh_vuc' ? `<option value="">Theo ngành${theoNganh ? ` (${esc(theoNganh)})` : ''}</option>` : ''}
    ${ds.map((k) => `<option value="${esc(k.ma)}"${k.ma === hien ? ' selected' : ''}>${esc(k.ten)}</option>`).join('')}</select>`;
}
function khoiHtml(qt) {
  const nganh = danhMucKl().nganh || []; const lv = danhMucKl().linhVuc || [];
  $('qtMtKhoiThem').innerHTML = qt ? `<form class="form-hang" data-submit="qtKhoiThem" novalidate><div class="grow"><label class="nhan" for="qtKhoiTen">Tên khối mới</label>
    <input id="qtKhoiTen" class="o-nhap nho" maxlength="120" autocomplete="off"></div><button type="submit" class="nut nho chinh">Thêm khối</button></form>` : '';
  $('qtMtKhoiBody').innerHTML = khoi().map((k) => { const so = nganh.filter((n) => n.khoi_ma === k.ma).length;
    return qt ? `<tr><td data-nhan="Tên khối">${inp('ten', k.ma, k.ten, ' maxlength="120" aria-label="Tên khối"')}</td><td data-nhan="Thứ tự" class="so">${inp('thu_tu', k.ma, k.thu_tu, ' type="number" min="1" step="1" style="width:80px" aria-label="Thứ tự khối"')}</td>
      <td data-nhan="Đang dùng">${coDung('dang_dung', k.ma, k.dang_dung, 'Đang dùng')}</td><td data-nhan="Số ngành" class="so">${so}</td>
      <td class="phai"><div class="thao-tac"><button type="button" class="nut nho" data-action="qtKhoiLuu" data-ma="${esc(k.ma)}">Lưu</button></div></td></tr>`
      : `<tr><td data-nhan="Tên khối" class="tieude">${esc(k.ten)}</td><td data-nhan="Thứ tự" class="so">${k.thu_tu}</td><td data-nhan="Đang dùng">${k.dang_dung === false ? 'Ngừng' : 'Đang dùng'}</td><td data-nhan="Số ngành" class="so">${so}</td><td></td></tr>`;
  }).join('') || '<tr><td colspan="5" class="trong">Chưa có khối (cần migration 0105).</td></tr>';
  const dongNganh = nganh.map((n) => `<tr><td data-nhan="Ngành">${esc(n.ten)}</td><td data-nhan="Khối">${qt ? chonKhoi('dm_nganh', n.ma, n.khoi_ma) : esc(tenKhoi(n.khoi_ma) || '—')}</td></tr>`).join('');
  const theoNganh = nganh.map((n) => { const ds = lv.filter((l) => l.nganh_ma === n.ma); if (!ds.length) return ''; const rieng = ds.filter((l) => l.khoi_ma).length;
    return `<details class="qt-mt-lv"><summary>${esc(n.ten)} <span class="chu-phu">— ${ds.length} lĩnh vực${rieng ? `, ${rieng} có khối riêng` : ''}</span></summary><ul>
      ${ds.map((l) => `<li><span>${esc(l.ten)}</span>${qt ? chonKhoi('dm_linh_vuc', l.ma, l.khoi_ma || '', { theoNganh: tenKhoi(n.khoi_ma) }) : `<span class="chu-phu">${esc(l.khoi_ma ? tenKhoi(l.khoi_ma) : `theo ngành (${tenKhoi(n.khoi_ma)})`)}</span>`}</li>`).join('')}</ul></details>`; }).join('');
  $('qtMtGanKhoi').innerHTML = `<h3>Ngành thuộc khối</h3><div class="bang-cuon"><table><thead><tr><th>Ngành</th><th>Khối</th></tr></thead><tbody>${dongNganh}</tbody></table></div>
    <h3>Lĩnh vực có khối riêng <span class="chu-phu">để trống = theo khối của ngành</span></h3>${theoNganh}`;
}

export function veNhomKhoi() { const qt = laQuanTriMt(state.user); nhomHtml(qt); khoiHtml(qt); }

const giaTri = (root, f, ma) => { const el = root.querySelector(`[data-f="${f}"][data-ma="${CSS.escape(ma)}"]`); return el?.type === 'checkbox' ? el.checked : el?.type === 'number' ? Number(el.value) : el?.value.trim(); };
function khacNhau(cu, moi) { return Object.fromEntries(Object.entries(moi).filter(([k, v]) => (cu[k] ?? (k === 'dang_dung' ? true : null)) !== (v === '' ? null : v)).map(([k, v]) => [k, v === '' ? null : v])); }
async function ghi(fn, args, ok) {
  const { error } = await supabase.rpc(fn, args);
  if (error) { notifyError(`Không lưu được: ${loiDeHieu(error)}`); return false; }
  notifySuccess(ok); await sauGhi(); return true;
}
async function qtNhomLuu({ ma }) {
  const n = nhom().find((x) => x.ma === ma); if (!n) return;
  const root = $('qtMtNhomBody');
  const p = khacNhau(n, { ten: giaTri(root, 'ten', ma), tab: giaTri(root, 'tab', ma), mau_so_hieu: giaTri(root, 'mau_so_hieu', ma), thu_tu: giaTri(root, 'thu_tu', ma), dang_dung: giaTri(root, 'dang_dung', ma) });
  if (!Object.keys(p).length) { notifyError('Không có gì thay đổi.'); return; }
  if (!Number.isInteger(p.thu_tu ?? 1) || (p.thu_tu ?? 1) < 1) { notifyError('Thứ tự là số nguyên dương.'); return; }
  const ld = await askLyDo({ title: 'Sửa nhóm mục tiêu', moTa: `${n.ten}: ${p.dang_dung === false ? 'ngừng dùng (thẻ ẩn khỏi Tổng quan khi không còn mục tiêu); ' : ''}đổi ${Object.keys(p).length} thông tin.`, nhanXacNhan: 'Lưu' });
  if (ld) await ghi('sua_nhom_muc_tieu', { p_ma: ma, p, p_ly_do: ld.lyDo }, `Đã lưu nhóm ${n.ten}.`);
}
async function qtNhomThem() {
  const ten = $('qtNhomTen').value.trim(); const tab = $('qtNhomTab').value.trim();
  if (!ten || !tab) { notifyError('Nhập tên nhóm và nhãn thẻ.'); return; }
  const ld = await askLyDo({ title: 'Thêm nhóm mục tiêu', moTa: `Thêm nhóm "${ten}" (thẻ "${tab}" ở Tổng quan). Không xoá được, chỉ ngừng dùng.`, nhanXacNhan: 'Thêm' });
  if (ld) await ghi('them_nhom_muc_tieu', { p_ten: ten, p_tab: tab, p_mau_so_hieu: $('qtNhomMau').value.trim() || null, p_ly_do: ld.lyDo }, `Đã thêm nhóm ${ten}.`);
}
async function qtKhoiLuu({ ma }) {
  const k = khoi().find((x) => x.ma === ma); if (!k) return;
  const root = $('qtMtKhoiBody');
  const p = khacNhau(k, { ten: giaTri(root, 'ten', ma), thu_tu: giaTri(root, 'thu_tu', ma), dang_dung: giaTri(root, 'dang_dung', ma) });
  if (!Object.keys(p).length) { notifyError('Không có gì thay đổi.'); return; }
  const ld = await askLyDo({ title: 'Sửa khối lĩnh vực', moTa: `${k.ten}: đổi ${Object.keys(p).length} thông tin.`, nhanXacNhan: 'Lưu' });
  if (ld) await ghi('sua_khoi_linh_vuc', { p_ma: ma, p, p_ly_do: ld.lyDo }, `Đã lưu khối ${k.ten}.`);
}
async function qtKhoiThem() {
  const ten = $('qtKhoiTen').value.trim(); if (!ten) { notifyError('Nhập tên khối.'); return; }
  const ld = await askLyDo({ title: 'Thêm khối lĩnh vực', moTa: `Thêm khối "${ten}" ở khối 3 Tổng quan; sau đó chọn ngành / lĩnh vực thuộc khối.`, nhanXacNhan: 'Thêm' });
  if (ld) await ghi('them_khoi_linh_vuc', { p_ten: ten, p_ly_do: ld.lyDo }, `Đã thêm khối ${ten}.`);
}
async function doiKhoi(e) {
  const s = e.target.closest?.('[data-khoi-bang]'); if (!s) return;
  const ten = s.closest('tr, li')?.querySelector('td, span')?.textContent?.trim() || s.dataset.ma;
  const ld = await askLyDo({ title: s.dataset.khoiBang === 'dm_nganh' ? 'Chuyển ngành sang khối khác' : 'Đặt khối cho lĩnh vực',
    moTa: `${ten} → ${s.value ? tenKhoi(s.value) : 'theo khối của ngành'}. Tổng quan tính lại theo khối mới.`, nhanXacNhan: 'Lưu' });
  if (!ld || !(await ghi('dat_khoi_linh_vuc', { p_bang: s.dataset.khoiBang, p_ma: s.dataset.ma, p_khoi: s.value || null, p_ly_do: ld.lyDo }, 'Đã đổi khối.'))) s.value = s.dataset.cu;
}

export function mountNhomKhoi(goc, reload) {
  sauGhi = reload;
  goc.addEventListener('change', doiKhoi);
  registerActions({ qtNhomLuu, qtNhomThem, qtKhoiLuu, qtKhoiThem });
}
