// Lĩnh vực (danh mục) khi sửa thông tin giao (v3.29, rà soát PR 1): không còn ô Lĩnh vực — lĩnh vực tự xác định TRONG PHẠM VI GIAO của người sửa
// (kl_pham_vi_giao — cùng tập với biểu mẫu Giao việc, SPEC GV-27; chuyên viên sửa việc mình nhập thay mặt lãnh đạo → phạm vi của lãnh đạo đó) để
// việc không rời phạm vi xử lý chỉ vì một từ khoá; ngành không còn lĩnh vực nào trong phạm vi → xác định như không lọc (dữ liệu đủ; DB không chặn).
// - Đổi ngành: giữ lĩnh vực đang có nếu thuộc ngành mới (và trong phạm vi), không thì theo lĩnh vực chi tiết, nội dung (lib/kl/nhap/mac-dinh.js).
// - Sửa "Lĩnh vực chi tiết": lĩnh vực theo chữ mới khi nhận ra (đúng tên / từ khoá), không thì giữ — đường sửa lĩnh vực trong cùng ngành.
// Dòng ghi chú trong hộp nói rõ lĩnh vực sau khi sửa và lãnh đạo Văn phòng phụ trách (phân công, kiêm nhiệm đang hiệu lực).
import { supabase } from '../../../lib/supabase.js';
import { state, findAccount } from '../../../lib/state.js';
import { danhMucKl, loadPhanCongHieuLuc, tenTrongDanhMuc } from '../../../lib/kl/du-lieu.js';
import { linhVucMacDinh } from '../../../lib/kl/nhap/mac-dinh.js';
import { lanhDaoPhuTrach } from '../../../lib/kl/tong-quan-them.js';
import { laToanQuyen } from '../../../lib/toan-quyen.js';

let phamVi = null;   // Map phòng ('' = không thuộc phòng) → Set mã lĩnh vực; null = không lọc
let phanCong = [];
let luot = 0;

function thamSo(r, me) {
  if (!me || me.role_group === 'A0' || laToanQuyen(me) || (me.role_group === 'A1' && me.is_chief)) return null;   // phạm vi toàn Văn phòng
  if (me.role_group !== 'A3') return {};
  if (r.giao_thay_mat_nhom) return { p_thay_mat_nhom: r.giao_thay_mat_nhom };
  return r.giao_thay_mat_cho ? { p_thay_mat: r.giao_thay_mat_cho } : null;   // chuyên viên giao thẳng: như biểu mẫu Giao việc — không lọc
}
// Đọc phạm vi + phân công khi mở hộp sửa (lỗi đọc: không lọc — DB vẫn kiểm danh mục, ngành – lĩnh vực).
export async function napPhamViSua(r) {
  const lan = ++luot; phamVi = null;
  const ts = thamSo(r, state.user);
  const [pv, pc] = await Promise.all([ts ? supabase.rpc('kl_pham_vi_giao', ts) : null, loadPhanCongHieuLuc().catch(() => [])]);
  if (lan !== luot) return;
  phanCong = pc;
  if (!pv || pv.error) return;
  phamVi = new Map();
  pv.data.filter((x) => x.linh_vuc_ma).forEach((x) => { const p = x.phong || ''; if (!phamVi.has(p)) phamVi.set(p, new Set()); phamVi.get(p).add(x.linh_vuc_ma); });
}

const choCua = (r) => (phamVi && r.owner_trong_van_phong !== false ? phamVi.get(r.owner_phong || '') || null : null);
const xacDinh = (x, r) => { const dm = danhMucKl(); return linhVucMacDinh({ ...x, cho: choCua(r) }, dm) || linhVucMacDinh(x, dm); };
// Lĩnh vực sau khi sửa ô cot thành moi → { ma, doi } (doi: khác lĩnh vực đang có) | null (ô này không đụng lĩnh vực).
export function lvSauSua(cot, moi, r) {
  if (cot === 'nganh_ma') {
    const ma = moi ? xacDinh({ nganh: moi, chiTiet: r.linh_vuc_chi_tiet, noiDung: r.noi_dung, goiY: r.linh_vuc_ma }, r)?.ma || null : null;
    return { ma, doi: ma !== (r.linh_vuc_ma || null) };
  }
  if (cot !== 'linh_vuc_chi_tiet' || !r.nganh_ma || !moi) return null;
  const cho = choCua(r);
  if ((danhMucKl().linhVuc || []).filter((l) => l.nganh_ma === r.nganh_ma && (!cho || cho.has(l.ma))).length < 2) return null;   // một lĩnh vực: không đổi
  const x = linhVucMacDinh({ nganh: r.nganh_ma, chiTiet: moi, cho }, danhMucKl());
  return x?.chac && x.ma !== r.linh_vuc_ma ? { ma: x.ma, doi: true } : null;
}
// Câu ghi chú dưới ô giá trị mới ('' = không nói gì).
export function ghiChuLv(cot, moi, r) {
  const lv = lvSauSua(cot, moi, r);
  if (!lv || (cot === 'nganh_ma' && !moi)) return '';
  const ten = (ma) => (ma ? tenTrongDanhMuc('linhVuc', ma) : 'chưa xác định');
  const ld = lanhDaoPhuTrach({ ...r, nganh_ma: cot === 'nganh_ma' ? moi : r.nganh_ma, linh_vuc_ma: lv.ma }, phanCong).map((id) => findAccount(id)?.full_name).filter(Boolean);
  const phuTrach = ld.length ? ` — lãnh đạo Văn phòng phụ trách: ${ld.join(', ')}` : '';
  return lv.doi ? `Lĩnh vực (tự xác định) đổi: ${ten(r.linh_vuc_ma)} → ${ten(lv.ma)}${phuTrach}.` : `Lĩnh vực (tự xác định) giữ: ${ten(lv.ma)}${phuTrach}.`;
}
