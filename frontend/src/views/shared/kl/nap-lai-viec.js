// Nạp lại đúng MỘT việc ngay sau hành động ghi thành công (GĐ23) hoặc sự kiện realtime của việc đang có trên màn hình (PR-2a B6): đọc dòng
// v_nhiem_vu (cột tường minh; dòng ngoại lệ dựng từ nhom_ngoai_le/khau — 0051) + tu_choi của id đó = 2 truy vấn (RLS tính cho một dòng — rẻ, không
// chạm statement timeout như nạp cả danh sách), thay vào bộ nhớ của màn hình Nhiệm vụ (kl.rows) và Điều hành (dh.rows, dh.ngoaiLe, dh.tuChoiCho),
// vẽ lại màn hình đang hiện. Nạp lại toàn danh sách phía sau vẫn chạy; realtime chỉ là bổ sung — không phụ thuộc vào nó.
import { supabase } from '../../../lib/supabase.js';
import { COT_VIEC, COT_TU_CHOI } from '../../../lib/kl/cot.js';
import { ganCo } from '../../../lib/kl/du-lieu.js';
import { getKlRows, render, dangNapKl } from './danh-sach.js';
import { dh, dongNgoaiLe, soSanhNgoaiLe, dangNapDh } from '../dieu-hanh/du-lieu.js';
import { veDieuHanh } from '../dieu-hanh/man-hinh.js';
import { sectionDangHien } from '../../shell/index.js';

// Một dòng v_nhiem_vu kèm cờ đã xác nhận nhận và đề nghị từ chối (cùng cách ghép như loadKlRows); null nếu ngoài phạm vi / đã xoá.
export async function docMotViec(id) {
  const [r, tc] = await Promise.all([
    supabase.from('v_nhiem_vu').select(COT_VIEC).eq('id', id).maybeSingle(),
    supabase.from('tu_choi').select(COT_TU_CHOI).eq('nhiem_vu_id', id).order('tao_luc', { ascending: false }).order('id'),
  ]);
  if (r.error) throw new Error(r.error.message);
  const row = r.data;
  const tcAll = tc.data || [];
  if (row) ganCo(row, tcAll.find((t) => t.trang_thai === 'CHO_DUYET'), tcAll[0]);
  return { row, ngoaiLe: dongNgoaiLe(row), tuChoi: tcAll };
}

// Thay (hoặc thêm / bỏ) một dòng trong mảng theo id.
function thay(rows, id, moi) {
  if (!Array.isArray(rows)) return;
  const i = rows.findIndex((x) => x.id === id);
  if (moi) { if (i >= 0) rows[i] = moi; else rows.push(moi); } else if (i >= 0) rows.splice(i, 1);
}

// Cập nhật bộ nhớ hai màn hình và vẽ lại màn hình đang hiện. Lỗi đọc (mạng, staging bận) không chặn luồng: lần nạp cả danh sách phía sau xử lý.
// Realtime (su-kien.js, kl/index.js) gọi { nemLoi: true, veLai: false }: lỗi ném ra để nạp cả màn thay thế; tự vẽ một lần sau cả lượt.
export async function napLaiViec(id, { nemLoi = false, veLai = true } = {}) {
  if (!id) return;
  try {
    // Lượt nạp cả màn đang chạy đọc dữ liệu TRƯỚC thay đổi này: chờ nó xong rồi mới đọc/thay dòng, để nó không ghi đè dòng mới hơn.
    await Promise.all([dangNapKl(), dangNapDh()].map((p) => p?.catch(() => {})));
    const { row, ngoaiLe, tuChoi } = await docMotViec(id);
    thay(getKlRows(), id, row);
    thay(dh.rows, id, row);
    thay(dh.ngoaiLe, id, ngoaiLe);
    dh.ngoaiLe.sort(soSanhNgoaiLe);
    dh.tuChoiCho = [...(dh.tuChoiCho || []).filter((t) => t.nhiem_vu_id !== id), ...tuChoi.filter((t) => t.trang_thai === 'CHO_DUYET')];
    if (!veLai) return;
    if (sectionDangHien('viewKl')) render(true);
    if (sectionDangHien('viewDieuHanh')) veDieuHanh();
  } catch (e) { if (nemLoi) throw e; /* nạp lại toàn danh sách phía sau vẫn chạy */ }
}
