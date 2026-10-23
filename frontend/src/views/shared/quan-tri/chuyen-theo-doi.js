// Hộp "Chuyển việc đang chủ trì theo dõi" (CAU-HOI J-6, Đợt D v3.20 — hàm admin_chuyen_theo_doi 0092; v3.31 — 0128: chỉ còn chủ trì theo dõi): khi
// đổi người (chuyển công tác, đổi Trưởng phòng), chuyển một lượt mọi việc ĐANG MỞ người cũ chủ trì theo dõi — việc người cũ là cán bộ chủ trì, và việc
// giao cho phòng / Văn phòng mà người cũ là Trưởng phòng / Chánh VP (người nhận phải đang giữ chức đó — đổi chức danh ở Tài khoản trước; việc không
// khớp giữ nguyên, báo mã). Bước 1: chọn người nhận → xem trước số việc (một số mã); bước 2: lý do bắt buộc → Thực hiện. Quản trị hệ thống hoặc
// Chánh Văn phòng (hàm DB là chốt); lịch sử từng việc, một tin cho người nhận, nhật ký hệ thống.
import { supabase } from '../../../lib/supabase.js';
import { $, show, showInlineError, escapeHtml, setText } from '../../../lib/dom.js';
import { DEPT_NAMES } from '../../../lib/constants.js';
import { state, isChief } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { notifySuccess } from '../../../components/toast.js';

let onDone = async () => {};
let tu = null;

export const duocChuyenTheoDoi = () => Boolean(state.user?.quan_tri_he_thong) || (state.user?.role_group === 'A1' && isChief());

const template = `
<div id="qtCtdModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="qtCtdTitle">
  <form class="modal" data-submit="luuChuyenTheoDoi" novalidate>
    <h2 id="qtCtdTitle" class="modal-tieu-de">Chuyển việc đang chủ trì theo dõi</h2>
    <p id="qtCtdMoTa" class="chu-phu mt-1"></p>
    <label class="nhan" for="qtCtdDen">Người nhận chủ trì theo dõi</label>
    <select id="qtCtdDen" class="o-nhap"></select>
    <p id="qtCtdXem" class="chu-phu mt-2" aria-live="polite"></p>
    <label class="nhan" for="qtCtdLyDo">Lý do (bắt buộc, ghi vào lịch sử từng việc)</label>
    <input type="text" id="qtCtdLyDo" class="o-nhap" placeholder="Ví dụ: Quyết định số .../QĐ-VPTU ngày ... về điều động cán bộ">
    <div id="qtCtdError" class="loi-inline hidden" role="alert"></div>
    <div class="modal-chan"><button type="button" class="nut" data-action="dongChuyenTheoDoi">Huỷ</button><button type="submit" id="qtCtdLuu" class="nut chinh" disabled>Chuyển</button></div>
  </form>
</div>`;

const goi = async (den, lyDo, thucHien) => {
  const { data, error } = await supabase.rpc('admin_chuyen_theo_doi', { p_tu: tu.id, p_den: den, p_ly_do: lyDo || null, p_thuc_hien: thucHien });
  if (error) throw new Error(error.message);
  return data;
};

async function xemTruoc() {
  const den = $('qtCtdDen').value;
  $('qtCtdLuu').disabled = true; showInlineError('qtCtdError', '');
  if (!den) { setText('qtCtdXem', ''); return; }
  try {
    const kq = await goi(den, null, false);
    setText('qtCtdXem', kq.so_viec ? `${kq.so_viec} việc đang mở sẽ chuyển: ${kq.ma.join(', ')}${kq.so_viec > kq.ma.length ? ', …' : ''}.` : 'Người này không chủ trì theo dõi việc nào đang mở.');
    $('qtCtdLuu').disabled = !kq.so_viec;
  } catch (e) { showInlineError('qtCtdError', e.message); }
}

function moChuyenTheoDoi({ username }) {
  tu = state.accounts.find((a) => a.username === username);
  if (!tu) return;
  setText('qtCtdMoTa', `Chuyển mọi việc đang mở do ${tu.full_name} chủ trì theo dõi sang người nhận — gồm việc giao cho phòng / Văn phòng mà đồng chí này là `
    + 'Trưởng phòng / Chánh Văn phòng (người nhận phải đang giữ chức đó; đổi chức danh ở Tài khoản trước). Việc đã hoàn thành giữ nguyên.');
  $('qtCtdDen').innerHTML = '<option value="">— Chọn người nhận —</option>' + state.accounts
    .filter((a) => !a.is_system && !a.bi_khoa && a.role_group !== 'A0' && a.id !== tu.id)
    .sort((a, b) => (a.role_group || '').localeCompare(b.role_group || '') || a.full_name.localeCompare(b.full_name, 'vi'))
    .map((a) => `<option value="${a.id}">${escapeHtml(a.full_name)} · ${escapeHtml(DEPT_NAMES[a.department] || a.department || '')}</option>`).join('');
  $('qtCtdLyDo').value = ''; setText('qtCtdXem', ''); showInlineError('qtCtdError', ''); $('qtCtdLuu').disabled = true;
  show('qtCtdModal', true);
  $('qtCtdDen').focus();
}

async function luuChuyenTheoDoi() {
  const den = $('qtCtdDen').value; const lyDo = $('qtCtdLyDo').value.trim();
  if (!tu || !den) return;
  if (!lyDo) { showInlineError('qtCtdError', 'Phải ghi lý do.'); $('qtCtdLyDo').focus(); return; }
  $('qtCtdLuu').disabled = true;
  try {
    const kq = await goi(den, lyDo, true);
    show('qtCtdModal', false);
    const boQua = kq.bo_qua || [];   // việc lệch ràng buộc (vd. việc của phòng mà người nhận chưa giữ chức Trưởng phòng) giữ nguyên — báo mã
    notifySuccess(`Đã chuyển ${kq.so_viec} việc đang chủ trì theo dõi của ${tu.full_name} sang ${state.accounts.find((a) => a.id === den)?.full_name || 'người nhận'}.`
      + (boQua.length ? ` Giữ nguyên ${boQua.length} việc (${boQua.slice(0, 5).map((x) => x.ma).join(', ')}${boQua.length > 5 ? ', …' : ''}) — ${boQua[0].loi || 'dùng Giao lại cho từng việc'}` : ''));
    tu = null;
    await onDone();
  } catch (e) { showInlineError('qtCtdError', e.message); $('qtCtdLuu').disabled = false; }
}

export function mountChuyenTheoDoi(reload) {
  onDone = reload;
  $('modalRoot').insertAdjacentHTML('beforeend', template);
  $('qtCtdDen').addEventListener('change', xemTruoc);
  registerActions({ moChuyenTheoDoi, luuChuyenTheoDoi, dongChuyenTheoDoi: () => { show('qtCtdModal', false); tu = null; } });
}
