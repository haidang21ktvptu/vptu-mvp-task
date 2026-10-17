// Mục tiêu then chốt (0105–0106, v3.24 — đề xuất Tổng quan lãnh đạo được duyệt 16/10/2026): phần THUẦN (không DOM, không Supabase; unit test
// tong-quan-lanh-dao.test.mjs). Danh mục đi cùng kl_danh_muc (mucTieu, khoi; nganh.khoi_ma). Một việc có mục tiêu gắn riêng (nhiem_vu_muc_tieu) hoặc, khi chưa
// gắn riêng, mục tiêu mặc định của văn bản (van_ban_muc_tieu) — loadKlRows ghép vào mỗi dòng muc_tieu_rieng, muc_tieu_vb, muc_tieu (dùng để đếm,
// lọc). Đọc / ghi DB: muc-tieu-db.js.

export const NHOM_MUC_TIEU = [
  { ma: 'DOT_PHA', tab: '3 nội dung đột phá', ten: 'Nội dung đột phá', moi: 'Mọi nội dung đột phá' },
  { ma: 'CHUONG_TRINH', tab: '3 chương trình trọng tâm', ten: 'Chương trình trọng tâm', moi: 'Mọi chương trình trọng tâm' },
  { ma: 'NQ_TW', tab: 'Nghị quyết Trung ương', ten: 'Nghị quyết Trung ương', moi: 'Mọi nghị quyết Trung ương' },
  { ma: 'CHI_TIEU', tab: 'Chỉ tiêu chủ yếu', ten: 'Chỉ tiêu chủ yếu', moi: 'Mọi chỉ tiêu chủ yếu' },
];
export const CHUA_GAN = 'CHUA';
export const tenNhomMucTieu = (ma) => NHOM_MUC_TIEU.find((n) => n.ma === ma)?.ten || ma || '';
export const mucTieuTheoNhom = (dm, nhom) => (dm || []).filter((m) => m.nhom === nhom);
export const timMucTieu = (dm, ma) => (dm || []).find((m) => m.ma === ma) || null;
export const tenMucTieu = (dm, ma) => timMucTieu(dm, ma)?.ten_ngan || ma || '';
// Sắp mã theo thứ tự danh mục (đột phá → chương trình → nghị quyết → chỉ tiêu); mã lạ cuối.
export const sapTheoDanhMuc = (ds, dm) => [...(ds || [])].sort((a, b) => (timMucTieu(dm, a)?.thu_tu ?? 1e9) - (timMucTieu(dm, b)?.thu_tu ?? 1e9));

// Mục tiêu của một dòng (đã ghép): gắn riêng nếu có, không thì mặc định của văn bản.
export const mucTieuCua = (r) => r?.muc_tieu || [];
export const laTheoVanBan = (r) => Boolean(r) && !(r.muc_tieu_rieng || []).length && (r.muc_tieu_vb || []).length > 0;

// Gom dòng { [khoa], muc_tieu_ma } → Map khoá → [mã] (giữ thứ tự đọc).
export function gomGan(ds, khoa) {
  const m = new Map();
  (ds || []).forEach((x) => { const k = x[khoa]; if (!m.has(k)) m.set(k, []); m.get(k).push(x.muc_tieu_ma); });
  return m;
}
// Ghép vào một dòng v_nhiem_vu. g = { rieng: Map nhiem_vu_id → [mã], vanBan: Map van_ban_id → [mã] }.
export function ganMucTieuVaoDong(r, g) {
  if (!r) return r;
  r.muc_tieu_rieng = g?.rieng?.get(r.id) || [];
  r.muc_tieu_vb = g?.vanBan?.get(r.van_ban_id) || [];
  r.muc_tieu = r.muc_tieu_rieng.length ? r.muc_tieu_rieng : r.muc_tieu_vb;
  return r;
}

// Điều kiện lọc: '' | mã mục tiêu | 'NHOM:<nhóm>' | CHUA_GAN (chưa có mục tiêu nào). dm: danh mục (để biết nhóm của mã).
export function khopMucTieu(r, gt, dm = []) {
  if (!gt) return true;
  const ds = mucTieuCua(r);
  if (gt === CHUA_GAN) return ds.length === 0;
  if (gt.startsWith('NHOM:')) { const nhom = gt.slice(5); return ds.some((ma) => timMucTieu(dm, ma)?.nhom === nhom); }
  return ds.includes(gt);
}
// Nhãn của một giá trị lọc (chip "Đang áp dụng", tiêu đề danh sách).
export function nhanLocMucTieu(gt, dm = []) {
  if (!gt) return '';
  if (gt === CHUA_GAN) return 'Chưa gắn mục tiêu then chốt';
  if (gt.startsWith('NHOM:')) return NHOM_MUC_TIEU.find((n) => n.ma === gt.slice(5))?.moi || gt;
  return tenMucTieu(dm, gt);
}

// Khối lĩnh vực của một dòng theo ngành (dm.nganh[].khoi_ma); không có ngành → null.
export const khoiCuaNganh = (nganh, ma) => (ma ? (nganh || []).find((n) => n.ma === ma)?.khoi_ma || null : null);
