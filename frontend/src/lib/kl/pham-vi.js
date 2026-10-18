// v3.23 (0103, chủ dự án duyệt 13/10/2026): cấu hình xem_toan_bo = 2 → mọi cán bộ ĐỌC được mọi nhiệm vụ; v_nhiem_vu.trong_pham_vi = false đánh
// dấu việc ngoài phạm vi xử lý của người xem (chỉ xem — mọi nút ghi ẩn; hàm DB / policy vẫn là chốt). Bộ lọc theo cán bộ dùng chung cho
// "Việc của tôi" và danh sách Nhiệm vụ: cán bộ chủ trì (owner_tai_khoan), người theo dõi (nguoi_theo_doi), lãnh đạo Văn phòng phụ trách
// (phân công phu_trach_phong đang hiệu lực — cùng quy tắc khối "Theo lãnh đạo VP phụ trách" của Tổng quan). Thuần: không DOM, không Supabase.
import { lanhDaoPhuTrach, CHUA_LDVP } from './tong-quan-them.js';

export const chiXem = (r) => r?.trong_pham_vi === false;
export const trongPhamVi = (rows = []) => rows.filter((r) => !chiXem(r));
// Việc đã biết là ngoài phạm vi (lần đọc gần nhất): realtime bỏ qua tín hiệu chỉ đạo / minh chứng của các việc này, việc đổi (nhiem_vu) thì
// màn điều hành chỉ nạp lại đúng việc đó — không nạp cả màn mỗi khi bất kỳ việc nào trong Văn phòng đổi.
const ngoai = new Set();
export const ghiNgoaiPhamVi = (rows = []) => { ngoai.clear(); rows.forEach((r) => { if (chiXem(r)) ngoai.add(r.id); }); };
export const datNgoaiPhamVi = (id, la) => { if (la) ngoai.add(id); else ngoai.delete(id); };
export const laNgoaiPhamVi = (id) => ngoai.has(id);
// Tập id trong phạm vi (lọc danh sách phụ đọc theo RLS — chỉ đạo chờ, kết quả vừa nộp, chỉ đạo của Tổng quan — về đúng phạm vi xử lý).
export const locTheoViec = (ds = [], rows = []) => { const ids = new Set(rows.map((r) => r.id)); return ds.filter((x) => ids.has(x.nhiem_vu_id)); };

export const LOC_CAN_BO = { chuTri: '', theoDoi: '', ldvp: '' };
export const coLocCanBo = (loc = {}) => Boolean(loc.chuTri || loc.theoDoi || loc.ldvp);

export function locCanBo(rows, loc = {}, phanCong = []) {
  if (!coLocCanBo(loc)) return rows;
  const khopLd = (r) => { const ids = lanhDaoPhuTrach(r, phanCong); return loc.ldvp === CHUA_LDVP ? ids.length === 0 : ids.includes(loc.ldvp); };
  return rows.filter((r) => (!loc.chuTri || r.owner_tai_khoan === loc.chuTri) && (!loc.theoDoi || r.nguoi_theo_doi === loc.theoDoi) && (!loc.ldvp || khopLd(r)));
}

// Lựa chọn của ba ô, đếm trên toàn bộ dòng truyền vào (không theo bộ lọc đang chọn). ten(id) = họ tên theo danh bạ; lanhDaoVP = [{ id, full_name }].
export function tuyChonCanBo(rows, { ten = () => '', lanhDaoVP = [], phanCong = [] } = {}) {
  const dem = (cot, cotTen) => {
    const m = new Map();
    rows.forEach((r) => { const k = r[cot]; if (!k) return; const c = m.get(k) || { ma: k, ten: ten(k) || r[cotTen] || 'Cán bộ', n: 0 }; c.n++; m.set(k, c); });
    return [...m.values()].sort((a, b) => a.ten.localeCompare(b.ten, 'vi'));
  };
  const ldvp = lanhDaoVP.map((a) => ({ ma: a.id, ten: a.full_name, n: rows.filter((r) => lanhDaoPhuTrach(r, phanCong).includes(a.id)).length }))
    .filter((o) => o.n > 0);
  const chua = rows.filter((r) => lanhDaoPhuTrach(r, phanCong).length === 0).length;
  if (chua && ldvp.length) ldvp.push({ ma: CHUA_LDVP, ten: 'Chưa có lãnh đạo phụ trách', n: chua });
  return { chuTri: dem('owner_tai_khoan', 'owner_tai_khoan_ten'), theoDoi: dem('nguoi_theo_doi', 'nguoi_theo_doi_ten'), ldvp };
}

// v3.23.1 (chủ dự án 13/10/2026): "Người giao" của một văn bản gốc = tài khoản đã thực hiện giao việc (tao_boi) của các việc giao thẳng từ văn
// bản đó (không tính việc giao tiếp xuống — có nhiem_vu_cha); nhiều việc trước. ten(id) = họ tên theo danh bạ. Trả [{ id, ten, n }].
export function nguoiGiaoVanBan(rows = [], ten = () => '') {
  const m = new Map();
  rows.filter((r) => !r.nhiem_vu_cha && r.tao_boi).forEach((r) => m.set(r.tao_boi, (m.get(r.tao_boi) || 0) + 1));
  return [...m].map(([id, n]) => ({ id, ten: ten(id) || 'Tài khoản không còn trong danh bạ', n }))
    .sort((a, b) => b.n - a.n || a.ten.localeCompare(b.ten, 'vi'));
}
export const nguoiGiaoText = (ds) => ds.map((x) => `${x.ten} (${x.n} việc)`).join(', ');
