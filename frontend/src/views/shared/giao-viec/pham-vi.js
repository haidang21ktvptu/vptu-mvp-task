// Phạm vi giao việc trên biểu mẫu (PR-2a C3): tập (phòng, ngành, lĩnh vực) người giao được giao lấy từ kl_pham_vi_giao() — hàm DB lọc
// bằng CHÍNH kl_duoc_giao_cho_phong mà giao_viec dùng để chặn (một nguồn, test kl-pq-pham-vi-giao). Biểu mẫu chỉ đưa ra Owner / ngành /
// lĩnh vực trong tập đó và nói rõ lý do ở dòng "Còn thiếu" + chú thích dưới ô lĩnh vực; DB vẫn là chốt.
// Không áp: A0 (quy tắc riêng — lãnh đạo Văn phòng hoặc phòng), người quản trị KL chưa chọn lãnh đạo được thay mặt. Owner không thuộc phòng
// nào (Văn phòng Tỉnh ủy, lãnh đạo Văn phòng, đơn vị ngoài) = dòng phòng NULL của hàm (một dòng, không theo ngành–lĩnh vực).
import { supabase } from '../../../lib/supabase.js';
import { state } from '../../../lib/state.js';
import { DEPT_NAMES } from '../../../lib/constants.js';

let tap = null;             // Set 'phong|nganh|lv' ('phong||' = việc không có ngành–lĩnh vực; '||' = Owner không thuộc phòng) hoặc null = không áp
let theoPhong = new Map();  // phòng ('' = không thuộc phòng) → [{ nganh_ma, linh_vuc_ma }]
let luot = 0;
const khoa = (phong, nganh, lv) => (phong ? `${phong}|${lv ? nganh || '' : ''}|${lv || ''}` : '||');
const tenPhong = (ma) => DEPT_NAMES[ma] || ma;

export async function napPhamVi(thayMat = null) {
  const me = state.user;
  const lan = ++luot;
  if (!me || me.role_group === 'A0' || (me.role_group === 'A3' && !thayMat)) { tap = null; theoPhong = new Map(); return; }
  const r = await supabase.rpc('kl_pham_vi_giao', thayMat ? { p_thay_mat: thayMat } : {});
  if (lan !== luot) return;   // lượt cũ về muộn (đổi người được thay mặt liên tiếp)
  if (r.error) throw new Error(`Không đọc được phạm vi giao việc: ${r.error.message}`);
  tap = new Set(r.data.map((x) => khoa(x.phong, x.nganh_ma, x.linh_vuc_ma)));
  theoPhong = new Map();
  r.data.forEach((x) => { const p = x.phong || ''; if (!theoPhong.has(p)) theoPhong.set(p, []); theoPhong.get(p).push(x); });
}

// Phòng của Owner như giao_viec tính: cán bộ → phòng của cán bộ; đơn vị → cột phong của đơn vị.
export function phongCuaOwner(value, dm, accounts) {
  if (!value) return null;
  const [kieu, ma] = value.split(':');
  if (kieu === 'tk') return accounts.find((a) => a.id === ma)?.department || null;
  return dm.donVi.find((d) => d.ma === ma)?.phong || null;
}
export const phongDuocGiao = (phong) => !tap || theoPhong.has(phong || '');
export const duocGiao = (phong, nganh, lv) => !tap || tap.has(khoa(phong, nganh, lv));

// Bỏ Owner có phòng ngoài phạm vi khỏi ô chọn (nhóm rỗng bỏ luôn).
export function locOwner(sel, dm, accounts) {
  if (!tap) return;
  [...sel.options].forEach((o) => { if (o.value && !phongDuocGiao(phongCuaOwner(o.value, dm, accounts))) o.remove(); });
  [...sel.querySelectorAll('optgroup')].forEach((g) => { if (!g.children.length) g.remove(); });
}
// Ngành / lĩnh vực chọn được ở phòng của Owner (null = không lọc).
export function nganhDuocChon(phong) {
  if (!tap || !phong) return null;
  return new Set((theoPhong.get(phong) || []).filter((x) => x.linh_vuc_ma).map((x) => x.nganh_ma));
}
export function linhVucDuocChon(phong) {
  if (!tap || !phong) return null;
  return new Set((theoPhong.get(phong) || []).filter((x) => x.linh_vuc_ma).map((x) => x.linh_vuc_ma));
}

// Chú thích dưới ô lĩnh vực + mục "Còn thiếu" khi tổ hợp đang chọn không được giao. dsLinhVuc: danh mục lĩnh vực (tên).
export function thongBaoPhamVi(phong, nganh, lv, dsLinhVuc) {
  if (!tap || !phong || !theoPhong.has(phong)) return { chuThich: '', thieu: null };
  const coLv = linhVucDuocChon(phong);
  const caPhong = tap.has(khoa(phong, null, null));
  const ten = (ma) => dsLinhVuc.find((l) => l.ma === ma)?.ten || ma;
  const khongCo = dsLinhVuc.filter((l) => !coLv.has(l.ma)).map((l) => ten(l.ma));
  const chuThich = !caPhong
    ? `Ở ${tenPhong(phong)}, đồng chí chỉ giao được lĩnh vực đang kiêm nhiệm: ${[...coLv].map(ten).join(', ')}.`
    : khongCo.length ? `Ở ${tenPhong(phong)}, ${khongCo.length} lĩnh vực do lãnh đạo khác kiêm nhiệm không có trong danh sách.` : '';
  if (duocGiao(phong, nganh, lv)) return { chuThich, thieu: null };
  return { chuThich, thieu: !lv ? `lĩnh vực đồng chí kiêm nhiệm ở ${tenPhong(phong)}` : `lĩnh vực trong phạm vi đồng chí phụ trách ở ${tenPhong(phong)}` };
}

// Người theo dõi (mục 3.4 + bổ sung F, 30/9): PCVP giao trực tiếp, hoặc người quản trị KL (A3) giao thay mặt một lãnh đạo không phải Chánh VP —
// chỉ chính lãnh đạo đó và người thuộc phòng trong phạm vi (duocGiao theo ngành, lĩnh vực đang chọn: cùng tập kl_pham_vi_giao, DB là chốt).
// Chánh VP, lãnh đạo giữ quan_tri_kl giao thẳng, A0: không lọc; Trưởng phòng: danh sách đã chỉ gồm phòng mình (them-owner.js).
export function lanhDaoLoc(thayMat) {
  const me = state.user;
  if (!me || me.role_group === 'A0') return null;
  if (me.role_group === 'A3') { const tm = state.accounts.find((a) => a.id === thayMat); return tm && !(tm.role_group === 'A1' && tm.is_chief) ? tm.id : null; }
  return me.role_group === 'A1' && !me.is_chief && !me.quan_tri_kl ? me.id : null;
}
export function theoDoiHopLe(id, thayMat, nganh, lv) {
  const ld = lanhDaoLoc(thayMat);
  return !ld || !id || id === ld || duocGiao(state.accounts.find((a) => a.id === id)?.department || null, nganh, lv);
}
export function locTheoDoi(sel, thayMat, nganh, lv) {
  [...sel.options].forEach((o) => { if (o.value && !theoDoiHopLe(o.value, thayMat, nganh, lv)) o.remove(); });
}
