// Nạp lại đúng MỘT việc ngay sau hành động ghi thành công (GĐ23): đọc dòng v_nhiem_vu / v_ngoai_le của id đó (RLS tính cho một dòng — rẻ, không
// chạm statement timeout như nạp cả danh sách), thay vào bộ nhớ của màn hình Nhiệm vụ (kl.rows) và Điều hành (dh.rows, dh.ngoaiLe, dh.tuChoiCho),
// vẽ lại màn hình đang hiện. Nạp lại toàn danh sách phía sau vẫn chạy; realtime chỉ là bổ sung — không phụ thuộc vào nó.
import { supabase } from '../../../lib/supabase.js';
import { getKlRows, render } from './danh-sach.js';
import { dh } from '../dieu-hanh/du-lieu.js';
import { veDieuHanh } from '../dieu-hanh/man-hinh.js';
import { sectionDangHien } from '../../shell/index.js';

const COT_TU_CHOI = 'id, nhiem_vu_id, nguoi_de_nghi, cap_duyet, ly_do, tao_luc, trang_thai, y_kien_duyet, duyet_luc';

// Một dòng v_nhiem_vu kèm cờ đã xác nhận nhận và đề nghị từ chối (cùng cách ghép như loadKlRows); null nếu ngoài phạm vi / đã xoá.
export async function docMotViec(id) {
  const [r, xn, tc, nl] = await Promise.all([
    supabase.from('v_nhiem_vu').select('*').eq('id', id).maybeSingle(),
    supabase.from('lich_su').select('id').eq('nhiem_vu_id', id).eq('cot', 'xac_nhan_nhan_viec').limit(1),
    supabase.from('tu_choi').select(COT_TU_CHOI).eq('nhiem_vu_id', id).order('tao_luc', { ascending: false }),
    supabase.from('v_ngoai_le').select('*').eq('id', id).maybeSingle(),
  ]);
  if (r.error) throw new Error(r.error.message);
  const row = r.data;
  const tcAll = tc.data || [];
  if (row) {
    row.da_xac_nhan_nhan = (xn.data || []).length > 0;
    row.tu_choi_cho = tcAll.find((t) => t.trang_thai === 'CHO_DUYET') || null;
    row.tu_choi_moi_nhat = tcAll[0] || null;
  }
  return { row, ngoaiLe: nl.error ? undefined : nl.data, tuChoi: tcAll };
}

// Thay (hoặc thêm / bỏ) một dòng trong mảng theo id.
function thay(rows, id, moi) {
  if (!Array.isArray(rows)) return;
  const i = rows.findIndex((x) => x.id === id);
  if (moi) { if (i >= 0) rows[i] = moi; else rows.push(moi); } else if (i >= 0) rows.splice(i, 1);
}

// Cập nhật bộ nhớ hai màn hình và vẽ lại màn hình đang hiện. Lỗi đọc (mạng, staging bận) không chặn luồng: lần nạp cả danh sách phía sau xử lý.
export async function napLaiViec(id) {
  if (!id) return;
  try {
    const { row, ngoaiLe, tuChoi } = await docMotViec(id);
    thay(getKlRows(), id, row);
    thay(dh.rows, id, row);
    if (ngoaiLe !== undefined) thay(dh.ngoaiLe, id, ngoaiLe);
    dh.tuChoiCho = [...(dh.tuChoiCho || []).filter((t) => t.nhiem_vu_id !== id), ...tuChoi.filter((t) => t.trang_thai === 'CHO_DUYET')];
    if (sectionDangHien('viewKl')) render(true);
    if (sectionDangHien('viewDieuHanh')) veDieuHanh();
  } catch { /* nạp lại toàn danh sách phía sau vẫn chạy */ }
}
