// Mục tiêu then chốt (0105–0106, v3.24; v3.25 — 0107–0113: nhóm là danh mục, khối theo lĩnh vực, nguồn gắn): phần THUẦN (không DOM, không Supabase;
// unit test tong-quan-lanh-dao.test.mjs, goi-y-muc-tieu.test.mjs). Danh mục đi cùng kl_danh_muc (mucTieu, nhomMucTieu, khoi; nganh.khoi_ma,
// linhVuc.khoi_ma). Một việc có mục tiêu gắn riêng (nhiem_vu_muc_tieu) hoặc, khi chưa gắn riêng, mục tiêu mặc định của văn bản (van_ban_muc_tieu) —
// loadKlRows ghép vào mỗi dòng muc_tieu_rieng, muc_tieu_vb, muc_tieu (đếm, lọc) và muc_tieu_nguon (mã → { nguon, ly_do, theo: rieng | vb }).

// Nhóm mặc định khi danh mục chưa có nhomMucTieu (project chưa áp 0107) — nhãn như v3.24.
export const NHOM_MUC_TIEU = [
  { ma: 'DOT_PHA', tab: 'Nội dung đột phá', ten: 'Nội dung đột phá', thu_tu: 1 },
  { ma: 'CHUONG_TRINH', tab: 'Chương trình trọng tâm', ten: 'Chương trình trọng tâm', thu_tu: 2 },
  { ma: 'NQ_TW', tab: 'Nghị quyết Trung ương', ten: 'Nghị quyết Trung ương', thu_tu: 3, mau_so_hieu: '^[0-9]{1,5}-NQ/TW$' },
  { ma: 'CHI_TIEU', tab: 'Chỉ tiêu chủ yếu', ten: 'Chỉ tiêu chủ yếu', thu_tu: 5 },
];
export const CHUA_GAN = 'CHUA';
// v3.26 (0116): mục CỐ ĐỊNH "Không thuộc" của danh mục — khối, ngành, nhóm và mục tiêu cùng mã KHONG_THUOC; lĩnh vực LV99_KHONG_THUOC. Mục tiêu "Không
// thuộc" là một quyết định đã phân loại (khác "chưa gắn"), không chọn cùng mục khác, không là tab / nhóm của Tổng quan.
export const KHONG_THUOC = 'KHONG_THUOC';
export const LV_KHONG_THUOC = 'LV99_KHONG_THUOC';
const thuong = (s) => (s ? s.charAt(0).toLocaleLowerCase('vi') + s.slice(1) : s);
// Nhóm đang dùng (theo thứ tự danh mục) — nhóm ngừng dùng vẫn hiện nếu còn mục tiêu có trong dm (để bỏ gắn / xem số liệu cũ). Không gồm nhóm "Không thuộc".
export function dsNhom(dmNhom, dm = []) {
  const goc = (dmNhom && dmNhom.length ? dmNhom : NHOM_MUC_TIEU).filter((n) => n.ma !== KHONG_THUOC && (n.dang_dung !== false || (dm || []).some((m) => m.nhom === n.ma)));
  return [...goc].sort((a, b) => (a.thu_tu ?? 0) - (b.thu_tu ?? 0)).map((n) => ({ ...n, moi: `Mọi ${thuong(n.ten)}` }));
}
export const tenNhomMucTieu = (ma, dmNhom) => dsNhom(dmNhom).find((n) => n.ma === ma)?.ten || (dmNhom || []).find((n) => n.ma === ma)?.ten || ma || '';
export const mucTieuTheoNhom = (dm, nhom) => (dm || []).filter((m) => m.nhom === nhom);
export const timMucTieu = (dm, ma) => (dm || []).find((m) => m.ma === ma) || null;
export const tenMucTieu = (dm, ma) => timMucTieu(dm, ma)?.ten_ngan || ma || '';
// Sắp mã theo thứ tự nhóm rồi thứ tự trong nhóm (đột phá → chương trình → nghị quyết → … → chỉ tiêu); mã lạ cuối.
export function sapTheoDanhMuc(ds, dm, dmNhom) {
  const tt = new Map(dsNhom(dmNhom, dm).map((n, i) => [n.ma, i]));
  const khoa = (ma) => { const m = timMucTieu(dm, ma); return m ? [tt.get(m.nhom) ?? 99, m.thu_tu ?? 0] : [1e9, 0]; };
  return [...(ds || [])].sort((a, b) => { const [x, y] = [khoa(a), khoa(b)]; return x[0] - y[0] || x[1] - y[1]; });
}

// Mục tiêu của một dòng (đã ghép): gắn riêng nếu có, không thì mặc định của văn bản — kể cả mục "Không thuộc" (hiện, xuất, lọc theo mã).
export const mucTieuCua = (r) => r?.muc_tieu || [];
// v3.26: mục tiêu THẬT (bỏ mục "Không thuộc") — đếm "đã gắn mục tiêu then chốt"; không thuộc; chưa phân loại (chưa gắn gì, kể cả "Không thuộc").
export const mucTieuThat = (r) => mucTieuCua(r).filter((ma) => ma !== KHONG_THUOC);
export const khongThuocMucTieu = (r) => mucTieuCua(r).includes(KHONG_THUOC);
export const chuaGanMucTieu = (r) => mucTieuCua(r).length === 0;
export const laTheoVanBan = (r) => Boolean(r) && !(r.muc_tieu_rieng || []).length && (r.muc_tieu_vb || []).length > 0;

// Gom dòng { [khoa], muc_tieu_ma } → Map khoá → [mã] (giữ thứ tự đọc).
export function gomGan(ds, khoa) {
  const m = new Map();
  (ds || []).forEach((x) => { const k = x[khoa]; if (!m.has(k)) m.set(k, []); m.get(k).push(x.muc_tieu_ma); });
  return m;
}
// Nguồn gắn: Map khoá → Map mã → { nguon, ly_do } (dòng không có cột nguon — project chưa áp 0107 — coi là người chọn).
export function gomNguon(ds, khoa) {
  const m = new Map();
  (ds || []).forEach((x) => { const k = x[khoa]; if (!m.has(k)) m.set(k, new Map()); m.get(k).set(x.muc_tieu_ma, { nguon: x.nguon || 'CHON', ly_do: x.ly_do || null }); });
  return m;
}
// Ghép vào một dòng v_nhiem_vu. g = { rieng: Map id → [mã], vanBan: Map van_ban_id → [mã], nguonRieng?, nguonVb? (gomNguon) }.
export function ganMucTieuVaoDong(r, g) {
  if (!r) return r;
  r.muc_tieu_rieng = g?.rieng?.get(r.id) || [];
  r.muc_tieu_vb = g?.vanBan?.get(r.van_ban_id) || [];
  r.muc_tieu = r.muc_tieu_rieng.length ? r.muc_tieu_rieng : r.muc_tieu_vb;
  const theo = r.muc_tieu_rieng.length ? 'rieng' : 'vb'; const ng = (theo === 'rieng' ? g?.nguonRieng?.get(r.id) : g?.nguonVb?.get(r.van_ban_id)) || new Map();
  r.muc_tieu_nguon = Object.fromEntries(r.muc_tieu.map((ma) => [ma, { ...(ng.get(ma) || { nguon: 'CHON', ly_do: null }), theo }]));
  return r;
}

// Cách gắn của một dòng (lọc "Cách gắn" ở Tổng quan): VAN_BAN (theo văn bản) | nguồn của việc (CHON, QUY_TAC, GOI_Y, AI, EXCEL, RA_SOAT, GOP) | CHUA.
export const CACH_GAN = [['CHON', 'Người giao chọn'], ['VAN_BAN', 'Theo văn bản'], ['QUY_TAC', 'Tích sẵn theo quy tắc'], ['GOI_Y', 'Gợi ý được chọn'],
  ['AI', 'Trợ lý AI gợi ý được chọn'], ['RA_SOAT', 'Chấp nhận ở màn rà soát'], ['EXCEL', 'Nhập Excel'], ['GOP', 'Gộp mục trùng']];
export function cachGanCua(r) {
  if (!mucTieuCua(r).length) return [CHUA_GAN];
  if (laTheoVanBan(r)) return ['VAN_BAN'];
  return [...new Set(Object.values(r.muc_tieu_nguon || {}).map((x) => x.nguon || 'CHON'))];
}
export const laTuDong = (r) => mucTieuThat(r).length > 0 && cachGanCua(r).some((c) => ['QUY_TAC', 'AI', 'RA_SOAT'].includes(c))
  || (laTheoVanBan(r) && Object.values(r.muc_tieu_nguon || {}).some((x) => ['QUY_TAC', 'AI', 'RA_SOAT'].includes(x.nguon)));

// Điều kiện lọc: '' | mã mục tiêu | 'NHOM:<nhóm>' | CHUA_GAN (chưa có mục tiêu nào). dm: danh mục (để biết nhóm của mã).
export function khopMucTieu(r, gt, dm = []) {
  if (!gt) return true;
  const ds = mucTieuCua(r);
  if (gt === CHUA_GAN) return ds.length === 0;
  if (gt.startsWith('NHOM:')) { const nhom = gt.slice(5); return ds.some((ma) => timMucTieu(dm, ma)?.nhom === nhom); }
  return ds.includes(gt);
}
// Nhãn của một giá trị lọc (chip "Đang áp dụng", tiêu đề danh sách).
export function nhanLocMucTieu(gt, dm = [], dmNhom) {
  if (!gt) return '';
  if (gt === CHUA_GAN) return 'Chưa phân loại mục tiêu then chốt';
  if (gt === KHONG_THUOC) return 'Không thuộc mục tiêu then chốt';
  if (gt.startsWith('NHOM:')) return dsNhom(dmNhom, dm).find((n) => n.ma === gt.slice(5))?.moi || gt;
  return tenMucTieu(dm, gt);
}

// Ngành / lĩnh vực "Không thuộc" (0116): không thuộc lĩnh vực trọng tâm — đã phân loại, khác "chưa phân loại" (không có ngành).
export const laKhongThuocNganh = (r) => r?.nganh_ma === KHONG_THUOC;
// Khối lĩnh vực theo ngành (dm.nganh[].khoi_ma); không có ngành → null.
export const khoiCuaNganh = (nganh, ma) => (ma ? (nganh || []).find((n) => n.ma === ma)?.khoi_ma || null : null);
// 0107: lĩnh vực có khối riêng thì theo lĩnh vực, không thì theo ngành.
export const khoiCuaDong = (r, nganh, linhVuc) => (r?.linh_vuc_ma && (linhVuc || []).find((l) => l.ma === r.linh_vuc_ma)?.khoi_ma) || khoiCuaNganh(nganh, r?.nganh_ma);
