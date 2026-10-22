// Mở một nhiệm vụ theo mã trên đường dẫn (v3.29 — chủ dự án 22/10/2026 17:02): "…/<chức năng>/NV-9601" khi tải lại, Quay lại / Tiến tới, mở đường
// dẫn được gửi (views/shell/duong-dan.js gọi hành động moViecTheoMa). Tìm trong dữ liệu màn đã nạp, không có thì đọc v_nhiem_vu theo mã — RLS quyết
// định thấy hay không. Không có hay ngoài phạm vi đều MỘT câu (không để lộ việc có tồn tại hay không); bỏ mã khỏi đường dẫn, giữ màn đang mở.
// KHÔNG vẽ lại màn: màn Nhiệm vụ đang có việc đó → mở ngăn ngay trong màn (giữ bộ lọc, trang, mục menu); còn lại → ngăn dùng chung trên màn đang xem.
// luot: lượt điều hướng lúc yêu cầu — người dùng đã chuyển đi (đổi màn, mở việc khác) trong lúc chờ đọc thì bỏ.
import { $ } from '../../../lib/dom.js';
import { supabase } from '../../../lib/supabase.js';
import { notify } from '../../../components/toast.js';
import { laMaViec } from '../../../lib/tuyen.js';
import { boMaTrenDuong, ghiViec, conLuot } from '../../shell/duong-dan.js';
import { sectionDangHien } from '../../shell/index.js';
import { getKlRows, timKlRow } from './danh-sach.js';
import { toggleKlChiTiet, idDangMo } from './chi-tiet.js';
import { moNganViec } from '../ngan-chi-tiet.js';
import { dh } from '../dieu-hanh/du-lieu.js';

export const cauKhongCoViec = (ma) => `Không có nhiệm vụ ${ma} trong phạm vi của đồng chí.`;

export async function moViecTheoMa({ ma, luot }) {
  const m = String(ma || '').toUpperCase();
  const l = Number(luot);
  if (!laMaViec(m)) { boMaTrenDuong(); return; }
  let r = getKlRows().find((x) => x.ma === m) || dh.rows.find((x) => x.ma === m);
  if (!r) {
    const { data, error } = await supabase.from('v_nhiem_vu').select('id, ma').eq('ma', m).maybeSingle();
    if (!conLuot(l)) return;
    if (error) { boMaTrenDuong(); notify(`Không mở được nhiệm vụ ${m} — đồng chí tải lại trang để thử lại.`, 'error'); return; }
    r = data;
  }
  if (!r?.id) { boMaTrenDuong(); notify(cauKhongCoViec(m), 'error'); return; }
  if (sectionDangHien('viewKl') && timKlRow(r.id) && !$('klChiTiet')?.closest('#nganCT')) await toggleKlChiTiet({ id: r.id });
  else await moNganViec(r.id);
  if (!conLuot(l)) return;
  if (idDangMo() === r.id) ghiViec(r.ma);   // việc đã mở sẵn (không qua toggleKlChiTiet): vẫn ghi đúng mã, xong lượt "thay bước"
  else boMaTrenDuong();   // không mở được (lỗi đọc, ngoài phạm vi khi đọc lại): bỏ mã khỏi đường dẫn
}
