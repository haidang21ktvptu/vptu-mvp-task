// Mở một nhiệm vụ theo mã trên đường dẫn (v3.29 — chủ dự án 22/10/2026 17:02): "…/<chức năng>/NV-9601" khi tải lại, Quay lại / Tiến tới, mở đường
// dẫn được gửi (views/shell/duong-dan.js gọi hành động moViecTheoMa). Tìm trong dữ liệu màn đã nạp, không có thì đọc v_nhiem_vu theo mã — RLS quyết
// định thấy hay không. Không có hay ngoài phạm vi đều MỘT câu (không để lộ việc có tồn tại hay không); bỏ mã khỏi đường dẫn, giữ màn đang mở.
import { supabase } from '../../../lib/supabase.js';
import { notify } from '../../../components/toast.js';
import { laMaViec } from '../../../lib/tuyen.js';
import { boMaTrenDuong, ghiViec } from '../../shell/duong-dan.js';
import { getKlRows } from './danh-sach.js';
import { idDangMo } from './chi-tiet.js';
import { dh } from '../dieu-hanh/du-lieu.js';

export const cauKhongCoViec = (ma) => `Không có nhiệm vụ ${ma} trong phạm vi của đồng chí.`;

// moNhiemVu(id, ma): mở trong ngăn chi tiết (hoặc ngay trên màn Nhiệm vụ) — truyền vào để không import vòng với kl/index.js.
export async function moViecTheoMa({ ma }, moNhiemVu) {
  const m = String(ma || '').toUpperCase();
  if (!laMaViec(m)) { boMaTrenDuong(); return; }
  let r = getKlRows().find((x) => x.ma === m) || dh.rows.find((x) => x.ma === m);
  if (!r) {
    const { data, error } = await supabase.from('v_nhiem_vu').select('id, ma').eq('ma', m).maybeSingle();
    if (error) { boMaTrenDuong(); notify(`Không mở được nhiệm vụ ${m} — đồng chí tải lại trang để thử lại.`, 'error'); return; }
    r = data;
  }
  if (!r?.id) { boMaTrenDuong(); notify(cauKhongCoViec(m), 'error'); return; }
  await moNhiemVu(r.id, r.ma);
  if (idDangMo() === r.id) ghiViec(r.ma);   // việc đã mở sẵn (không qua toggleKlChiTiet): vẫn ghi đúng mã, xong lượt "thay bước"
  else boMaTrenDuong();   // không mở được (lỗi đọc, ngoài phạm vi khi đọc lại): bỏ mã khỏi đường dẫn
}
