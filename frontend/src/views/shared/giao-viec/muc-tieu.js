// Giao việc — mục tiêu then chốt (v3.24, 0105): ô chọn theo bốn nhóm trong "Thông tin thêm", dùng chung cho mọi nhiệm vụ của lượt; không bắt buộc.
// Văn bản có sẵn đã có mục tiêu mặc định → điền sẵn theo văn bản (khi người dùng chưa tự chọn). Sau khi giao: văn bản TẠO MỚI trong lượt này → gắn cho
// văn bản (mọi nhiệm vụ của văn bản theo); văn bản có sẵn (kể cả "Văn bản mới" trùng khoá văn bản đã có — giao_viec dùng lại, 0095) mà lựa chọn khác
// mặc định, Thường trực giao, hoặc hoàn thiện dòng nhập Excel → gắn riêng từng việc vừa giao. Lỗi khi gắn không làm mất việc đã giao (báo rõ số việc
// chưa gắn, gắn lại ở ngăn chi tiết). DB là chốt quyền (gan_muc_tieu, gan_muc_tieu_van_ban).
import { $, show, setText } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { notifyError } from '../../../components/toast.js';
import { danhMucKl } from '../../../lib/kl/du-lieu.js';
import { loiDeHieu } from '../../../lib/kl/loi.js';
import { docMucTieuVanBan, ganMucTieu, ganMucTieuVanBan, vanBanTaoCungViec } from '../../../lib/kl/muc-tieu-db.js';
import { oChonMucTieuHtml, docChonMucTieu, TOI_DA_MUC_TIEU } from '../kl/muc-tieu.js';
import { MOI } from './van-ban.js';

const gv = { macDinh: [], daChinh: false, luot: 0, vb: '', rieng: false };
const giong = (a = [], b = []) => [...a].sort().join('|') === [...b].sort().join('|');
const laA0 = () => state.user?.role_group === 'A0';   // Thường trực không gắn mục tiêu cho văn bản (gan_muc_tieu_van_ban) — luôn gắn từng việc
export const docMucTieuGv = () => docChonMucTieu($('gvMucTieu'));
function ghiChu() {
  const ma = docMucTieuGv(); const tungViec = 'mục tiêu chọn ở đây gắn cho các việc giao lượt này';
  setText('gvMucTieuGhiChu', gv.rieng ? 'mục tiêu ghi trong tệp Excel — gắn cho việc này'
    : gv.vb === MOI ? (laA0() ? `văn bản mới: ${tungViec}` : 'văn bản mới: mục tiêu chọn ở đây áp cho mọi nhiệm vụ của văn bản')
      : !gv.macDinh.length ? (gv.vb ? `văn bản chưa có mục tiêu then chốt — ${tungViec}` : tungViec)
        : giong(ma, gv.macDinh) || !ma.length ? 'đang theo mục tiêu then chốt của văn bản đã chọn' : 'khác mục tiêu của văn bản — gắn riêng cho các việc giao lượt này');
}
function khiChon(e) {
  if (e.target?.name !== 'muc_tieu') return;
  if (docMucTieuGv().length > TOI_DA_MUC_TIEU) { e.target.checked = false; notifyError(`Gắn tối đa ${TOI_DA_MUC_TIEU} mục tiêu then chốt.`); }
  gv.daChinh = true; ghiChu();
}

// Mở biểu mẫu: vẽ ô chọn, điền mặc định của văn bản đang chọn. Danh mục trống (chưa áp 0105) → ẩn cả khối.
export function dienMucTieuGv(vbId) {
  const o = $('gvMucTieu'); const co = (danhMucKl().mucTieu || []).length > 0;
  if (!o) return;
  if (!o.dataset.gan) { o.dataset.gan = '1'; o.addEventListener('change', khiChon); }
  show('gvMucTieuWrap', co);
  Object.assign(gv, { daChinh: false, macDinh: [], rieng: false });
  o.innerHTML = co ? oChonMucTieuHtml([]) : '';
  if (co) apMucTieuVanBan(vbId);
}
// Đổi văn bản: điền mục tiêu mặc định của văn bản (người dùng chưa tự chọn thì thay; đã chọn thì giữ). Lượt cũ về muộn → bỏ.
export async function apMucTieuVanBan(vbId) {
  const lan = ++gv.luot; gv.vb = vbId || '';
  let md = [];
  if (vbId && vbId !== MOI) { try { md = await docMucTieuVanBan(vbId); } catch { md = []; } }
  if (lan !== gv.luot || !$('gvMucTieu')) return;
  gv.macDinh = md;
  if (!gv.daChinh) $('gvMucTieu').innerHTML = oChonMucTieuHtml(md);
  ghiChu();
}
// Hoàn thiện dòng nhập Excel: mục tiêu ghi trong tệp (du_lieu.muc_tieu_ma) — coi như người dùng đã chọn, gắn cho chính việc đó.
export function datMucTieuGv(ma = []) {
  if (!$('gvMucTieu') || !ma.length) return;
  Object.assign(gv, { daChinh: true, rieng: true }); $('gvMucTieu').innerHTML = oChonMucTieuHtml(ma.slice(0, TOI_DA_MUC_TIEU)); ghiChu();
}

// Sau khi giao thành công. vbMoi: lượt này chọn "Văn bản mới"; rieng: luôn gắn từng việc (hoàn thiện dòng Excel); ids: các việc vừa giao.
export async function ganSauGiao({ vbId, vbMoi, rieng = false, ids = [] }) {
  const ma = docMucTieuGv();
  if (!ma.length || !ids.length) return;
  let loiVb = null;
  const taoMoi = vbMoi && !rieng && !laA0() && Boolean(vbId) && await vanBanTaoCungViec(vbId, ids[0]).catch(() => false);
  if (taoMoi) {
    try { await ganMucTieuVanBan(vbId, ma); Object.assign(gv, { macDinh: ma, vb: vbId }); ghiChu(); return; } catch (e) { loiVb = e; }   // → gắn từng việc
  } else if (vbId) {
    const md = !vbMoi && gv.vb === vbId ? gv.macDinh : await docMucTieuVanBan(vbId, { tuoi: true }).catch(() => []);
    if (giong(ma, md)) return;   // đúng mặc định của văn bản: việc tự theo văn bản
  }
  const loi = [];
  for (const id of ids) { try { await ganMucTieu(id, ma); } catch (e) { loi.push(e); } }   // tuần tự (tối đa 20 việc), việc lỗi không chặn việc sau
  if (loi.length) notifyError(`Đã giao việc nhưng chưa gắn được mục tiêu then chốt cho ${loi.length}/${ids.length} việc: ${loiDeHieu(loi[0])} Đồng chí gắn lại trong ngăn chi tiết của việc.`);
  else if (loiVb && loiVb.code !== '42501') notifyError(`Đã gắn mục tiêu cho ${ids.length} việc vừa giao, nhưng chưa gắn được cho cả văn bản: ${loiDeHieu(loiVb)}`);
}
