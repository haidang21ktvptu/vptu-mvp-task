// Giải ngân vốn (v3.28, migration 0119): đọc / ghi DB. Đọc theo năm: mọi kỳ số liệu (gn_ky), mọi dòng của các kỳ đó (gn_ky_dong), nhiệm vụ theo dõi
// (gn_nhiem_vu — RLS: việc "Số liệu toàn tỉnh" mọi người thấy, việc khác theo phạm vi việc). Bộ nhớ đệm 60 giây theo năm (ngăn chi tiết vẽ lại nhiều
// lần khi có realtime); Tổng quan đọc mới (moi). Project chưa áp 0119 (bảng chưa có) → null (không vẽ khối, không hướng dẫn), không làm vỡ trang. Ghi chỉ qua
// hàm gn_ghi_ky / gn_xoa_ky / gn_gan_nhiem_vu — DB là chốt quyền; ghi xong xoá bộ nhớ đệm.
import { supabase } from '../supabase.js';
import { taiTheoTrang } from './cot.js';

const COT_KY = 'id, nam, ngay_so_lieu, can_cu, uoc_tinh, ke_hoach, da_giai_ngan, ghi_chu, nhap_boi, nhap_luc';
const COT_DONG = 'ky_id, loai, ten, ten_chuan, thu_tu, ke_hoach, da_giai_ngan';
const COT_GAN = 'nhiem_vu_id, nam, loai, ten, ten_chuan, muc_tieu_pt, muc_tieu_ngay, gan_boi, gan_luc';
const THIEU = /42P01|PGRST205|PGRST202|42883|does not exist|schema cache|could not find/i;
export const laThieuBang = (e) => THIEU.test(`${e?.code || ''} ${e?.message || ''}`);
let coBang = true;   // một lần lỗi "không có bảng" → thôi đọc (Tổng quan không gọi lại mỗi lần vẽ)
export const coGiaiNgan = () => coBang;
const HAN_DEM = 60_000;
const dem = new Map();   // năm → { luc, d }

const so = (x) => (x === null || x === undefined || x === '' ? null : Number(x));
const chuanKy = (k) => ({ ...k, ke_hoach: so(k.ke_hoach), da_giai_ngan: so(k.da_giai_ngan), uoc_tinh: Boolean(k.uoc_tinh) });
const chuanDong = (d) => ({ ...d, ke_hoach: so(d.ke_hoach), da_giai_ngan: so(d.da_giai_ngan), thu_tu: Number(d.thu_tu) || 0 });
const chuanGan = (g) => ({ ...g, nam: Number(g.nam), muc_tieu_pt: so(g.muc_tieu_pt) ?? 100 });

async function docMoi(nam) {
  const [ky, gan] = await Promise.all([
    taiTheoTrang(() => supabase.from('gn_ky').select(COT_KY).eq('nam', nam).order('ngay_so_lieu').order('id'), 'Đọc kỳ số liệu giải ngân'),
    taiTheoTrang(() => supabase.from('gn_nhiem_vu').select(COT_GAN).eq('nam', nam).order('nhiem_vu_id'), 'Đọc nhiệm vụ theo dõi giải ngân')]);
  const ids = ky.map((k) => k.id);
  const dong = ids.length ? await taiTheoTrang(() => supabase.from('gn_ky_dong').select(COT_DONG).in('ky_id', ids).order('ky_id').order('loai').order('ten_chuan'),
    'Đọc dòng chi tiết giải ngân') : [];
  return { nam, ky: ky.map(chuanKy), dong: dong.map(chuanDong), gan: gan.map(chuanGan) };
}

// Một năm → { nam, ky (cũ trước), dong, gan }; chưa có bảng (project chưa áp 0119) → null. Lỗi khác → ném (người gọi giữ số cũ / báo lỗi).
export async function docNam(nam, { moi = false } = {}) {
  if (!coBang) return null;
  const c = dem.get(nam);
  if (!moi && c && Date.now() - c.luc < HAN_DEM) return c.d;
  try {
    const d = await docMoi(nam);
    dem.set(nam, { luc: Date.now(), d });
    return d;
  } catch (e) {
    if (laThieuBang(e)) { coBang = false; return null; }
    throw e;
  }
}

// Việc theo dõi của một nhiệm vụ (ngăn chi tiết) — mọi năm; không có / chưa có bảng → null.
export async function docGanViec(id) {
  if (!coBang || !id) return null;
  const r = await supabase.from('gn_nhiem_vu').select(COT_GAN).eq('nhiem_vu_id', id).maybeSingle();
  if (r.error) { if (laThieuBang(r.error)) { coBang = false; return null; } throw new Error(r.error.message); }
  return r.data ? chuanGan(r.data) : null;
}

const goi = async (fn, args) => {
  const r = await supabase.rpc(fn, args);
  dem.clear();
  if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.code });
  return r.data;
};
// p = { nam, ngay_so_lieu, can_cu, uoc_tinh, ke_hoach, da_giai_ngan, ghi_chu, dong: [{ loai, ten, ten_chuan, thu_tu, ke_hoach, da_giai_ngan }] }
// → { id, thay (đã thay kỳ cùng ngày), so_dong }.
export const ghiKy = (p) => goi('gn_ghi_ky', { p });
export const xoaKy = (id) => goi('gn_xoa_ky', { p_id: id });
// p = { loai: TOAN_TINH | NGUON | CHU_DAU_TU | null (bỏ theo dõi), nam, ten, ten_chuan, muc_tieu_pt, muc_tieu_ngay } → { doi }.
export const ganNhiemVu = (id, p) => goi('gn_gan_nhiem_vu', { p_nv: id, p });
