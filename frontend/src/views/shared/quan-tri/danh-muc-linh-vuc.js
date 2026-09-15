// Phần "Danh mục lĩnh vực theo ngành" (GĐ9 PR 9A): người có quan_tri_kl thêm lĩnh vực và sửa tên/thứ tự
// (ghi thẳng dm_linh_vuc, RLS 0018 chặn người khác; không xoá, không chuyển ngành). Khi chọn ngành để thêm,
// cảnh báo nếu ngành đang có PCVP kiêm nhiệm: lĩnh vực mới sẽ thuộc PCVP phụ trách phòng cho tới khi được
// phân công thêm (bổ sung của chủ dự án 15/9/2026).
import { supabase } from '../../../lib/supabase.js';
import { $, show, escapeHtml } from '../../../lib/dom.js';
import { registerActions } from '../../../lib/actions.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { danhSachNganh, linhVucCuaNganh, sinhMaLinhVuc, tenNganhNgan } from './danh-muc.js';
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
}

async function themLinhVuc() {
  const nganhMa = $('qtLvNganh').value;
  const ten = $('qtLvTen').value.trim();
  if (!ten) { notifyError('Nhập tên lĩnh vực.'); $('qtLvTen').focus(); return; }
  const ma = sinhMaLinhVuc(nganhMa, ten);
  const thuTu = Math.max(0, ...linhVucCuaNganh(nganhMa).map((l) => l.thu_tu)) + 1;
  const { error } = await supabase.from('dm_linh_vuc').insert({ ma, nganh_ma: nganhMa, ten, thu_tu: thuTu });
  if (error) {
    notifyError(error.code === '23505' ? 'Lĩnh vực này (hoặc mã trùng) đã có trong ngành.' : 'Không thêm được: ' + error.message);
    return;
  }
  $('qtLvTen').value = '';
  notifySuccess(`Đã thêm lĩnh vực "${ten}" vào ${tenNganhNgan(nganhMa)}.`);
  await onDone(); // loadQuanTri: nạp lại danh mục + vẽ lại mọi phần
}

async function luuLinhVuc({ ma }) {
  const ten = $(`lvTen-${ma}`).value.trim();
  const thuTu = Number($(`lvThuTu-${ma}`).value);
  if (!ten || !Number.isInteger(thuTu) || thuTu < 1) { notifyError('Tên không được trống, thứ tự là số nguyên dương.'); return; }
  const { data, error } = await supabase.from('dm_linh_vuc').update({ ten, thu_tu: thuTu }).eq('ma', ma).select('ma');
  if (error || data.length === 0) {
    notifyError(error ? 'Không sửa được: ' + error.message : 'Không có quyền sửa danh mục.');
    return;
  }
  notifySuccess(`Đã lưu lĩnh vực ${ma}.`);
  await onDone(); // loadQuanTri: nạp lại danh mục + vẽ lại mọi phần
}

export function mountDanhMucLinhVuc(reload) {
  onDone = reload;
  $('qtLvNganh').addEventListener('change', renderCanhBaoNganh);
  registerActions({ themLinhVuc, luuLinhVuc });
}
