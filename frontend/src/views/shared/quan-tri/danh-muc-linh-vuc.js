// Phần "Danh mục lĩnh vực theo ngành" (GĐ9 PR 9A/9B): người có quan_tri_kl thêm lĩnh vực và sửa tên/thứ tự — mọi
// thao tác qua hàm SQL admin_them_linh_vuc / admin_sua_linh_vuc (0020) với lý do bắt buộc, ghi dm_lich_su cùng
// transaction; không ghi thẳng bảng, không xoá, không chuyển ngành. Khi chọn ngành để thêm, cảnh báo nếu ngành đang có
// PCVP kiêm nhiệm: lĩnh vực mới sẽ thuộc PCVP phụ trách phòng cho tới khi được phân công thêm (chủ dự án 15/9/2026).
import { supabase } from '../../../lib/supabase.js';
import { $, show, escapeHtml, formatDateTime } from '../../../lib/dom.js';
import { registerActions } from '../../../lib/actions.js';
import { findAccount } from '../../../lib/state.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { askLyDo } from './ly-do-modal.js';
import { danhSachNganh, linhVucCuaNganh, timLinhVuc, tenNganhNgan } from './danh-muc.js';
import { loadActive, getActive, tenNguoi } from './phu-trach-o.js';

let onDone = null;

function rowHtml(lv) {
  return `
    <tr>
      <td data-nhan="Ngành">${escapeHtml(tenNganhNgan(lv.nganh_ma))}</td>
      <td data-nhan="Mã"><code class="text-xs">${escapeHtml(lv.ma)}</code></td>
      <td data-nhan="Tên lĩnh vực"><input type="text" class="input input-nho" id="lvTen-${escapeHtml(lv.ma)}" value="${escapeHtml(lv.ten)}" aria-label="Tên lĩnh vực ${escapeHtml(lv.ma)}"></td>
      <td data-nhan="Thứ tự" class="so"><input type="number" min="1" class="input input-nho w-20" id="lvThuTu-${escapeHtml(lv.ma)}" value="${lv.thu_tu}" aria-label="Thứ tự ${escapeHtml(lv.ma)}"></td>
      <td><div class="thao-tac"><button type="button" class="btn btn-nho btn-phu" data-action="luuLinhVuc" data-ma="${escapeHtml(lv.ma)}">Lưu</button></div></td>
    </tr>`;
}

// Dòng vàng theo yêu cầu 15/9: "Ngành này đang có [tên PCVP] kiêm nhiệm N/M lĩnh vực. Lĩnh vực mới sẽ thuộc
// PCVP phụ trách phòng cho tới khi được phân công thêm." N = số lĩnh vực của ngành người đó đang kiêm nhiệm.
function renderCanhBaoNganh() {
  const nganh = $('qtLvNganh').value;
  const tong = linhVucCuaNganh(nganh).length;
  const theoNguoi = new Map();
  getActive().filter((r) => r.nganh_ma === nganh).forEach((r) => {
    if (!theoNguoi.has(r.lanh_dao_id)) theoNguoi.set(r.lanh_dao_id, new Set());
    theoNguoi.get(r.lanh_dao_id).add(r.linh_vuc_ma);
  });
  const msgs = [...theoNguoi].map(([id, set]) =>
    `Ngành này đang có ${tenNguoi(id)} kiêm nhiệm ${set.size}/${tong} lĩnh vực. Lĩnh vực mới sẽ thuộc PCVP phụ trách phòng cho tới khi được phân công thêm.`);
  const box = $('qtLvCanhBao');
  box.innerText = msgs.join(' ');
  show(box, msgs.length > 0);
}

// "Thay đổi": thêm → tên; sửa → từng cột cũ → mới.
function moTaThayDoi(r) {
  if (r.hanh_dong === 'them') return `Thêm "${r.gia_tri_moi?.ten ?? ''}" vào ${tenNganhNgan(r.gia_tri_moi?.nganh_ma)}`;
  return Object.keys(r.gia_tri_moi || {}).map((k) => `${k === 'ten' ? 'tên' : 'thứ tự'}: "${r.gia_tri_cu?.[k] ?? ''}" → "${r.gia_tri_moi[k]}"`).join('; ');
}

async function renderNhatKyDanhMuc() {
  const { data, error } = await supabase.from('dm_lich_su')
    .select('luc, nguoi, nguoi_ghi_chu, ma, hanh_dong, gia_tri_cu, gia_tri_moi, ly_do').order('id', { ascending: false }).limit(20);
  if (error) { notifyError('Không đọc được nhật ký danh mục: ' + error.message); return; }
  $('qtLvNhatKyBody').innerHTML = data.length === 0
    ? '<tr><td colspan="6" class="trong">Chưa có thay đổi danh mục nào.</td></tr>'
    : data.map((r) => `
      <tr>
        <td class="whitespace-nowrap">${formatDateTime(r.luc)}</td>
        <td data-nhan="Người thực hiện">${escapeHtml(r.nguoi ? findAccount(r.nguoi)?.full_name || r.nguoi : (r.nguoi_ghi_chu || 'Hệ thống'))}</td>
        <td data-nhan="Hành động"><span class="muc ${r.hanh_dong === 'them' ? 'muc-xanh' : 'muc-vang'}">${r.hanh_dong === 'them' ? 'Thêm' : 'Sửa'}</span></td>
        <td data-nhan="Mã"><code class="text-xs">${escapeHtml(r.ma)}</code></td>
        <td data-nhan="Thay đổi">${escapeHtml(moTaThayDoi(r))}</td>
        <td data-nhan="Lý do">${escapeHtml(r.ly_do)}</td>
      </tr>`).join('');
}

export async function renderDanhMucLinhVuc() {
  try {
    await loadActive();
  } catch (e) {
    notifyError('Không đọc được bảng phân công: ' + e.message);
  }
  const sel = $('qtLvNganh');
  const truoc = sel.value;
  sel.innerHTML = danhSachNganh().map((n) => `<option value="${escapeHtml(n.ma)}">${escapeHtml(n.ten)}</option>`).join('');
  if (truoc) sel.value = truoc;
  const rows = danhSachNganh().flatMap((n) => linhVucCuaNganh(n.ma));
  $('qtLvBody').innerHTML = rows.length === 0
    ? '<tr><td colspan="5" class="trong">Chưa có lĩnh vực nào.</td></tr>'
    : rows.map(rowHtml).join('');
  renderCanhBaoNganh();
  await renderNhatKyDanhMuc();
}

async function themLinhVuc() {
  const nganhMa = $('qtLvNganh').value;
  const ten = $('qtLvTen').value.trim();
  if (!ten) { notifyError('Nhập tên lĩnh vực.'); $('qtLvTen').focus(); return; }
  const answer = await askLyDo({
    title: 'Thêm lĩnh vực',
    moTa: `Thêm "${ten}" vào ${tenNganhNgan(nganhMa)}. Mã do hệ thống đặt; không xoá được sau khi thêm, chỉ sửa tên/thứ tự.`,
    nhanXacNhan: 'Thêm',
  });
  if (!answer) return;
  const { data, error } = await supabase.rpc('admin_them_linh_vuc', { p_nganh_ma: nganhMa, p_ten: ten, p_ly_do: answer.lyDo });
  if (error) { notifyError('Không thêm được: ' + error.message); return; }
  $('qtLvTen').value = '';
  notifySuccess(`Đã thêm lĩnh vực "${ten}" (${data}) vào ${tenNganhNgan(nganhMa)}.`);
  await onDone(); // loadQuanTri: nạp lại danh mục + vẽ lại mọi phần
}

async function luuLinhVuc({ ma }) {
  const ten = $(`lvTen-${ma}`).value.trim();
  const thuTu = Number($(`lvThuTu-${ma}`).value);
  const cu = timLinhVuc(ma);
  if (!ten || !Number.isInteger(thuTu) || thuTu < 1) { notifyError('Tên không được trống, thứ tự là số nguyên dương.'); return; }
  if (cu && cu.ten === ten && cu.thu_tu === thuTu) { notifyError('Không có gì thay đổi.'); return; }
  const answer = await askLyDo({
    title: 'Sửa lĩnh vực',
    moTa: `${ma}: "${cu?.ten ?? ''}" (thứ tự ${cu?.thu_tu ?? ''}) → "${ten}" (thứ tự ${thuTu}).`,
    nhanXacNhan: 'Lưu',
  });
  if (!answer) return;
  const { error } = await supabase.rpc('admin_sua_linh_vuc', { p_ma: ma, p_ten: ten, p_thu_tu: thuTu, p_ly_do: answer.lyDo });
  if (error) { notifyError('Không sửa được: ' + error.message); return; }
  notifySuccess(`Đã lưu lĩnh vực ${ma}.`);
  await onDone();
}

export function mountDanhMucLinhVuc(reload) {
  onDone = reload;
  $('qtLvNganh').addEventListener('change', renderCanhBaoNganh);
  registerActions({ themLinhVuc, luuLinhVuc });
}
