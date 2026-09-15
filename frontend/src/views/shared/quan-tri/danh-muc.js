// Bộ nhớ đệm danh mục ngành / lĩnh vực (dm_nganh, dm_linh_vuc — 0014, 0018) cho màn hình Quản trị:
// tên hiển thị, lọc lĩnh vực theo ngành, sinh mã lĩnh vực mới. Nạp một lần mỗi lần mở màn hình.
import { supabase } from '../../../lib/supabase.js';

let nganh = [];   // { ma, ten, thu_tu }
let linhVuc = []; // { ma, nganh_ma, ten, thu_tu }

export async function loadDanhMuc() {
  const [n, l] = await Promise.all([
    supabase.from('dm_nganh').select('ma, ten, thu_tu').order('thu_tu'),
    supabase.from('dm_linh_vuc').select('ma, nganh_ma, ten, thu_tu').order('thu_tu'),
  ]);
  if (n.error || l.error) throw new Error((n.error || l.error).message);
  nganh = n.data;
  linhVuc = l.data;
}

export const danhSachNganh = () => nganh;
export const linhVucCuaNganh = (nganhMa) => linhVuc.filter((l) => l.nganh_ma === nganhMa);
export const timNganh = (ma) => nganh.find((n) => n.ma === ma);
export const timLinhVuc = (ma) => linhVuc.find((l) => l.ma === ma);

// "8. Kinh tế tổng hợp - Tài chính - ..." → "ngành 8" (tên đầy đủ quá dài cho ô bảng/nhật ký).
export function tenNganhNgan(ma) {
  const n = timNganh(ma);
  return n ? `ngành ${n.thu_tu}` : ma;
}
export const tenLinhVuc = (ma) => timLinhVuc(ma)?.ten || ma;

// Nhãn một cặp (ngành, lĩnh vực): "Tài chính (ngành 8)".
export const nhanNganhLinhVuc = (nganhMa, linhVucMa) => `${tenLinhVuc(linhVucMa)} (${tenNganhNgan(nganhMa)})`;

// Mã lĩnh vực mới do server sinh (admin_them_linh_vuc, 0020): LV<số ngành>_<tên không dấu>; frontend không tự đặt mã.
