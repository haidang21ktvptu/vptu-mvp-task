// Mục tiêu then chốt (0105–0106; v3.25 — 0107–0111): đọc / ghi DB. Đọc theo RLS (người thấy việc / văn bản thấy mục tiêu của nó), theo trang (max_rows
// của API). Ghi chỉ qua hàm: gan_muc_tieu (tầng giao hoặc lãnh đạo trong phạm vi), gan_muc_tieu_van_ban (người nhập văn bản, Chánh VP, lãnh đạo thấy
// mọi việc của văn bản), gan_muc_tieu_hang_loat (rà soát), them_muc_tieu / them_muc_tieu_tu_dong (bổ sung danh mục) — DB là chốt quyền. Bộ nhớ đệm
// (gan) theo lần nạp cả danh sách gần nhất; ghi xong cập nhật ngay để màn hình vẽ đúng không chờ nạp lại. v3.25: kèm nguồn gắn (nguon, ly_do) —
// project chưa áp 0107 thì đọc không có hai cột này (coi là người chọn). Bộ nhận diện: goi_y_muc_tieu (một việc đang nhập), goi_y_muc_tieu_viec
// (việc đã có), ghi_phan_hoi_goi_y (tự học — 0111).
import { supabase } from '../supabase.js';
import { taiTheoTrang } from './cot.js';
import { gomGan, gomNguon, ganMucTieuVaoDong } from './muc-tieu.js';

let gan = { rieng: new Map(), vanBan: new Map(), nguonRieng: new Map(), nguonVb: new Map() };
let soLanGhi = 0;   // lượt ghi trong lúc đang đọc cả bảng → đọc lại (ảnh cũ không đè phần vừa ghi)
let coNguon = true;   // cột nguon / ly_do (0107) — lỗi "cột không có" một lần thì thôi đọc

const thieuCot = (m) => /nguon|ly_do|42703|does not exist|column/i.test(String(m || ''));
async function docBang(bang, khoa, viec) {
  const cot = `${khoa}, muc_tieu_ma${coNguon ? ', nguon, ly_do' : ''}`;
  try { return await taiTheoTrang(() => supabase.from(bang).select(cot).order(khoa).order('muc_tieu_ma'), viec); } catch (e) {
    if (coNguon && thieuCot(e.message)) { coNguon = false; return docBang(bang, khoa, viec); }
    throw e;
  }
}

// Cả hai bảng; lỗi (project chưa áp 0105) → giữ bộ nhớ cũ, không chặn danh sách nhiệm vụ.
export async function loadGanMucTieu() {
  for (let lan = 0; lan < 2; lan++) {
    const truoc = soLanGhi;
    try {
      const [r, v] = await Promise.all([docBang('nhiem_vu_muc_tieu', 'nhiem_vu_id', 'đọc mục tiêu của nhiệm vụ'), docBang('van_ban_muc_tieu', 'van_ban_id', 'đọc mục tiêu của văn bản')]);
      if (soLanGhi !== truoc && lan === 0) continue;
      gan = { rieng: gomGan(r, 'nhiem_vu_id'), vanBan: gomGan(v, 'van_ban_id'), nguonRieng: gomNguon(r, 'nhiem_vu_id'), nguonVb: gomNguon(v, 'van_ban_id') };
    } catch { /* giữ bộ nhớ cũ */ }
    break;
  }
  return gan;
}

function datRieng(id, ds) {
  if (!ds.length) { gan.rieng.delete(id); gan.nguonRieng.delete(id); return; }
  gan.rieng.set(id, ds.map((x) => x.muc_tieu_ma));
  gan.nguonRieng.set(id, new Map(ds.map((x) => [x.muc_tieu_ma, { nguon: x.nguon || 'CHON', ly_do: x.ly_do || null }])));
}
// Một việc (nạp lại sau khi ghi / realtime): đọc lại phần gắn riêng; mặc định của văn bản theo bộ nhớ.
export async function docMucTieuViec(id) {
  const q = (cot) => supabase.from('nhiem_vu_muc_tieu').select(cot).eq('nhiem_vu_id', id).order('muc_tieu_ma');
  let r = await q(coNguon ? 'muc_tieu_ma, nguon, ly_do' : 'muc_tieu_ma');
  if (r.error && coNguon && thieuCot(r.error.message)) { coNguon = false; r = await q('muc_tieu_ma'); }
  if (!r.error) datRieng(id, r.data || []);
  return gan;
}
export const ganVaoDong = (r) => ganMucTieuVaoDong(r, gan);
// Mặc định của một văn bản: bộ nhớ của lần nạp gần nhất (tuoi = đọc DB), không có thì đọc DB; lỗi → rỗng.
export async function docMucTieuVanBan(vbId, { tuoi = false } = {}) {
  if (!tuoi && gan.vanBan.has(vbId)) return gan.vanBan.get(vbId);
  const r = await supabase.from('van_ban_muc_tieu').select('muc_tieu_ma').eq('van_ban_id', vbId).order('muc_tieu_ma');
  const ds = r.error ? [] : (r.data || []).map((x) => x.muc_tieu_ma);
  if (!r.error) { if (ds.length) gan.vanBan.set(vbId, ds); else gan.vanBan.delete(vbId); }
  return ds;
}
// Văn bản được TẠO trong cùng giao dịch với việc vừa giao (giao_viec dùng lại văn bản trùng khoá đã có — 0095): created_at bằng nhau (now() của
// giao dịch). Đọc lỗi → coi như văn bản có sẵn (không thay mặc định của văn bản người khác).
export async function vanBanTaoCungViec(vbId, viecId) {
  const [v, n] = await Promise.all([supabase.from('van_ban_giao_viec').select('created_at').eq('id', vbId).maybeSingle(),
    supabase.from('v_nhiem_vu').select('created_at').eq('id', viecId).maybeSingle()]);
  return !v.error && !n.error && Boolean(v.data?.created_at) && v.data.created_at === n.data?.created_at;
}
// Ngăn chi tiết: người tạo văn bản (người nhập văn bản được gắn mục tiêu cho văn bản — gan_muc_tieu_van_ban) và có việc nào của văn bản ngoài phạm vi
// xử lý của người xem không (số việc gốc thật — kl_van_ban_so_viec — so với số việc gốc trong phạm vi đọc được). Chỉ để ẩn / hiện nút.
export async function quyenVanBan(vbId) {
  const [v, tong, ds] = await Promise.all([supabase.from('van_ban_giao_viec').select('tao_boi').eq('id', vbId).maybeSingle(), supabase.rpc('kl_van_ban_so_viec'),
    supabase.from('v_nhiem_vu').select('id, trong_pham_vi').eq('van_ban_id', vbId).is('nhiem_vu_cha', null)]);
  const soTong = (tong.data || []).find((x) => x.van_ban_id === vbId)?.so_viec;
  const trong = (ds.data || []).filter((x) => x.trong_pham_vi !== false).length;
  return { taoBoi: v.data?.tao_boi || null, moiViecTrongPhamVi: !tong.error && !ds.error && soTong !== undefined && trong >= soTong };
}

const goi = async (fn, args) => {
  const r = await supabase.rpc(fn, args);
  if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.code });
  return r.data;
};
const sapXep = (ma) => [...new Set(ma)].sort();
const nguonMap = (ma, nguon) => new Map(ma.map((m) => [m, { nguon: nguon?.[m]?.nguon || 'CHON', ly_do: nguon?.[m]?.ly_do || null }]));
// nguon: { "<mã>": { nguon, ly_do } } (0110) — chỉ gửi khi có (lời gọi hai tham số vẫn chạy trên project chưa áp 0110).
export async function ganMucTieu(id, ma, nguon = null) {
  await goi('gan_muc_tieu', nguon ? { p_id: id, p_ma: ma, p_nguon: nguon } : { p_id: id, p_ma: ma });
  soLanGhi++;
  if (ma.length) { gan.rieng.set(id, sapXep(ma)); gan.nguonRieng.set(id, nguonMap(ma, nguon)); } else { gan.rieng.delete(id); gan.nguonRieng.delete(id); }
}
// → số việc của văn bản đổi mục tiêu theo (việc chưa gắn riêng).
export async function ganMucTieuVanBan(vbId, ma, nguon = null) {
  const n = await goi('gan_muc_tieu_van_ban', nguon ? { p_van_ban: vbId, p_ma: ma, p_nguon: nguon } : { p_van_ban: vbId, p_ma: ma });
  soLanGhi++;
  if (ma.length) { gan.vanBan.set(vbId, sapXep(ma)); gan.nguonVb.set(vbId, nguonMap(ma, nguon)); } else { gan.vanBan.delete(vbId); gan.nguonVb.delete(vbId); }
  return n;
}
// Rà soát (0111): ds = [{ id, ma: [mã], nguon?: { "<mã>": { nguon, ly_do } } }] (≤ 200) → { ok, loi: [{ id, loi }] }; việc lỗi không chặn việc khác.
export async function ganMucTieuHangLoat(ds) {
  const kq = await goi('gan_muc_tieu_hang_loat', { p: ds });
  soLanGhi++;
  const loi = new Set((kq?.loi || []).map((x) => x.id));
  ds.filter((x) => !loi.has(x.id)).forEach((x) => { if (x.ma.length) { gan.rieng.set(x.id, sapXep(x.ma)); gan.nguonRieng.set(x.id, nguonMap(x.ma, x.nguon || Object.fromEntries(x.ma.map((m) => [m, { nguon: 'RA_SOAT' }])))); } });
  return kq || { ok: 0, loi: [] };
}

// Rà soát phân loại từ tệp (0116): ds = [{ ma, nganh, linh_vuc, muc_tieu, ly_do }] (≤ 200); ap = false: xem trước (không ghi). → mảng kết quả từng dòng.
// Ghi xong: bộ nhớ gắn mục tiêu cũ không còn đúng — lần đọc sau (loadGanMucTieu) lấy lại.
export async function raSoatPhanLoai(ds, lyDo, ap = false) {
  const kq = await goi('ra_soat_phan_loai', { p: ds, p_ly_do: lyDo || '', p_ap: Boolean(ap) });
  if (ap) soLanGhi++;
  return Array.isArray(kq) ? kq : [];
}
// Bộ nhận diện (0110). p = { van_ban_id, so_hieu_van_ban, trich_yeu, noi_dung, san_pham_mo_ta, nganh, linh_vuc } → { goi_y, so_hieu_moi }.
// Project chưa áp 0110 → kết quả rỗng (không chặn giao việc).
export async function goiYMucTieu(p) {
  try { return (await goi('goi_y_muc_tieu', { p })) || { goi_y: [], so_hieu_moi: [] }; } catch (e) { if (e.code === 'PGRST202' || e.code === '42883') return { goi_y: [], so_hieu_moi: [] }; throw e; }
}
// Việc đã có (≤ 200): { "<id>": { goi_y, so_hieu_moi } }.
export const goiYMucTieuViec = async (ids) => (await goi('goi_y_muc_tieu_viec', { p_ids: ids })) || {};
// Nhiều dòng một lượt (nhập Excel, ≤ 500): mảng đầu vào như goiYMucTieu → mảng kết quả cùng thứ tự.
export const goiYMucTieuDs = async (ds) => (await goi('goi_y_muc_tieu_ds', { p: ds })) || [];
// Phản hồi gợi ý của một việc (tự học): ds = [{ quy_tac: [uuid], ket_qua: GIU | BO | THEM | BO_QUA }]; lỗi không làm hỏng việc đã lưu.
export async function ghiPhanHoiGoiY(viec, ds) {
  if (!viec || !ds?.length) return 0;
  try { return await goi('ghi_phan_hoi_goi_y', { p_viec: viec, p_ds: ds.slice(0, 60) }); } catch { return 0; }   // hàm nhận ≤ 60 mục
}
// Bổ sung danh mục: người nhập liệu thêm vào nhóm (→ mã mới); hệ thống tự thêm khi số hiệu đúng dạng một nhóm được nhắc (→ { ma, moi }).
export const themMucTieu = ({ nhom, ten, tenNgan = null, soHieu = null, moTa = null, canCu = null, chiTieu = null, lyDo = null }) =>
  goi('them_muc_tieu', { p_nhom: nhom, p_ten: ten, p_ten_ngan: tenNgan, p_so_hieu: soHieu, p_mo_ta: moTa, p_can_cu: canCu, p_chi_tieu: chiTieu, p_ly_do: lyDo });
export const themMucTieuTuDong = (soHieu, ve = null) => goi('them_muc_tieu_tu_dong', { p_so_hieu: soHieu, p_ve: ve });

// Bước C (0106): kết quả chỉ tiêu chủ yếu theo kỳ — mới nhất trước; lỗi / chưa có bảng → rỗng (thẻ chỉ tiêu ẩn).
export async function loadKetQuaChiTieu() {
  const r = await supabase.from('chi_tieu_ket_qua').select('muc_tieu_ma, ky, gia_tri, danh_gia, nguon').order('ky', { ascending: false }).order('muc_tieu_ma').limit(1000);
  return r.error ? [] : r.data || [];
}
