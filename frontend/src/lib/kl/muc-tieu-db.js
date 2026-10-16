// Mục tiêu then chốt (0105–0106): đọc / ghi DB. Đọc theo RLS (người thấy việc / văn bản thấy mục tiêu của nó), theo trang (max_rows của API).
// Ghi chỉ qua hàm: gan_muc_tieu (tầng giao hoặc lãnh đạo trong phạm vi), gan_muc_tieu_van_ban (người nhập văn bản, Chánh VP, lãnh đạo thấy mọi việc
// của văn bản) — DB là chốt quyền. Bộ nhớ đệm (gan) theo lần nạp cả danh sách gần nhất; ghi xong cập nhật ngay để màn hình vẽ đúng không chờ nạp lại.
import { supabase } from '../supabase.js';
import { taiTheoTrang } from './cot.js';
import { gomGan, ganMucTieuVaoDong } from './muc-tieu.js';

let gan = { rieng: new Map(), vanBan: new Map() };
let soLanGhi = 0;   // lượt ghi trong lúc đang đọc cả bảng → đọc lại (ảnh cũ không đè phần vừa ghi)

// Cả hai bảng; lỗi (project chưa áp 0105) → giữ bộ nhớ cũ, không chặn danh sách nhiệm vụ.
export async function loadGanMucTieu() {
  for (let lan = 0; lan < 2; lan++) {
    const truoc = soLanGhi;
    try {
      const [r, v] = await Promise.all([
        taiTheoTrang(() => supabase.from('nhiem_vu_muc_tieu').select('nhiem_vu_id, muc_tieu_ma').order('nhiem_vu_id').order('muc_tieu_ma'), 'đọc mục tiêu của nhiệm vụ'),
        taiTheoTrang(() => supabase.from('van_ban_muc_tieu').select('van_ban_id, muc_tieu_ma').order('van_ban_id').order('muc_tieu_ma'), 'đọc mục tiêu của văn bản'),
      ]);
      if (soLanGhi !== truoc && lan === 0) continue;
      gan = { rieng: gomGan(r, 'nhiem_vu_id'), vanBan: gomGan(v, 'van_ban_id') };
    } catch { /* giữ bộ nhớ cũ */ }
    break;
  }
  return gan;
}

// Một việc (nạp lại sau khi ghi / realtime): đọc lại phần gắn riêng; mặc định của văn bản theo bộ nhớ.
export async function docMucTieuViec(id) {
  const r = await supabase.from('nhiem_vu_muc_tieu').select('muc_tieu_ma').eq('nhiem_vu_id', id).order('muc_tieu_ma');
  if (!r.error) { const ds = (r.data || []).map((x) => x.muc_tieu_ma); if (ds.length) gan.rieng.set(id, ds); else gan.rieng.delete(id); }
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
export async function ganMucTieu(id, ma) {
  await goi('gan_muc_tieu', { p_id: id, p_ma: ma });
  soLanGhi++;
  if (ma.length) gan.rieng.set(id, sapXep(ma)); else gan.rieng.delete(id);
}
// → số việc của văn bản đổi mục tiêu theo (việc chưa gắn riêng).
export async function ganMucTieuVanBan(vbId, ma) {
  const n = await goi('gan_muc_tieu_van_ban', { p_van_ban: vbId, p_ma: ma });
  soLanGhi++;
  if (ma.length) gan.vanBan.set(vbId, sapXep(ma)); else gan.vanBan.delete(vbId);
  return n;
}

// Bước C (0106): kết quả chỉ tiêu chủ yếu theo kỳ — mới nhất trước; lỗi / chưa có bảng → rỗng (thẻ chỉ tiêu ẩn).
export async function loadKetQuaChiTieu() {
  const r = await supabase.from('chi_tieu_ket_qua').select('muc_tieu_ma, ky, gia_tri, danh_gia, nguon').order('ky', { ascending: false }).order('muc_tieu_ma').limit(1000);
  return r.error ? [] : r.data || [];
}
