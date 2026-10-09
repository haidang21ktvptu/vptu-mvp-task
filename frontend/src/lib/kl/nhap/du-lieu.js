// Lời gọi DB của nhập Excel (0072–0075). Quyền thật ở hàm DB (kl_nguoi_nhap — 0096: mọi tài khoản trừ Thường trực); bảng chỉ đọc qua RLS.
// Nhập một lô: mở lô → gửi TUẦN TỰ từng phần ≤ 50 dòng (mỗi phần một giao dịch, tránh quá giờ chạy câu lệnh; gửi lại phần cũ an toàn) → chốt lô.
// Lỗi giữa chừng: lần bấm sau gửi tiếp vào cùng lô (không mở lô mới — tránh tạo việc trùng).
import { supabase } from '../../supabase.js';

// Người nhập liệu (cùng quy tắc kl_nguoi_nhap — chỉ để ẩn / hiện; Đợt F v3.21: quyền chung): mọi tài khoản trừ Thường trực, tài khoản hệ thống, đã khoá.
export const laNguoiNhap = (u) => Boolean(u) && u.role_group !== 'A0' && !u.bi_khoa && !u.is_system;

const goi = async (fn, args) => { const r = await supabase.rpc(fn, args); if (r.error) throw new Error(r.error.message); return r.data; };
const doc = async (q) => { const r = await q; if (r.error) throw new Error(r.error.message); return r.data || []; };
export const PHAN = 50;

export const maDaCo = async (ds) => new Set(ds.length ? (await goi('kl_nhap_ma_da_co', { p_ma: ds })) || [] : []);
export const luuTuDien = (muc) => (muc.length ? goi('tu_dien_nhap_luu', { p_muc: muc }) : 0);
export const luuHoSo = ({ ten, tenSheet, dongTieuDe, anhXa }) => goi('ho_so_nhap_luu', { p_ten: ten, p_ten_sheet: tenSheet || null, p_dong_tieu_de: dongTieuDe, p_anh_xa: anhXa });
export const xoaHoSo = (id) => goi('ho_so_nhap_xoa', { p_id: id });
export const boDongCho = (id) => goi('dong_nhap_bo', { p_id: id });
export const hoanTacLo = (id) => goi('hoan_tac_lo', { p_lo: id });

export const docHoSo = () => doc(supabase.from('ho_so_nhap').select('id, ten, ten_sheet, dong_tieu_de, anh_xa, cap_nhat_luc').order('ten'));
// Từ điển dùng chung → Map<loai, Map<goc, ma>>.
export async function docTuDien() {
  const ds = await doc(supabase.from('tu_dien_nhap').select('loai, goc, ma'));
  const m = new Map(); ds.forEach((x) => { if (!m.has(x.loai)) m.set(x.loai, new Map()); m.get(x.loai).set(x.goc, x.ma); });
  return m;
}
// Thẻ "Chờ hoàn thiện": MỌI dòng đang chờ (đọc theo trang 1000 — giới hạn max_rows của API), lô của chúng và các lô còn trong 24 giờ hoàn tác.
const COT_LO = 'id, ma, ten_tep, mau, che_do_xong, so_dong, so_lieu, tao_boi, tao_luc, xong_luc, hoan_tac_luc';
export async function docLoVaCho() {
  const cho = [];
  for (let tu = 0; tu < 10000; tu += 1000) {
    const p = await doc(supabase.from('dong_nhap').select('id, lo_id, so_dong, du_lieu, du_lieu_goc, thieu, ghi_chu').eq('ket_qua', 'CHO_HOAN_THIEN')
      .order('lo_id').order('so_dong').range(tu, tu + 999));
    cho.push(...p); if (p.length < 1000) break;
  }
  const idLo = [...new Set(cho.map((d) => d.lo_id))];
  const [moi, coCho] = await Promise.all([doc(supabase.from('lo_nhap').select(COT_LO).gte('tao_luc', new Date(Date.now() - 24 * 3600e3).toISOString())),
    idLo.length ? doc(supabase.from('lo_nhap').select(COT_LO).in('id', idLo)) : []]);
  const lo = [...new Map([...moi, ...coCho].map((x) => [x.id, x])).values()].sort((a, b) => String(b.tao_luc).localeCompare(String(a.tao_luc)));
  return { lo, cho };
}
// Lô "nhập dở" (chưa chốt, chưa hoàn tác, trong 24 giờ) của chính người dùng cho cùng tên tệp → nhập tiếp vào lô đó (không tạo việc trùng).
export async function loDoCuaTep(tenTep, toi) {
  const ds = await doc(supabase.from('lo_nhap').select('id, ma, che_do_xong').eq('tao_boi', toi).eq('ten_tep', tenTep).is('xong_luc', null).is('hoan_tac_luc', null)
    .gte('tao_luc', new Date(Date.now() - 24 * 3600e3).toISOString()).order('tao_luc', { ascending: false }).limit(1));
  return ds[0] || null;
}
// Dữ liệu gốc của một việc (ngăn chi tiết): dòng tệp đã tạo / cập nhật việc này — RLS cho người thấy việc đọc.
export const docDuLieuGoc = (nhiemVuId) => doc(supabase.from('dong_nhap').select('so_dong, ket_qua, du_lieu_goc, xu_ly_luc, lo_nhap(ma, ten_tep)')
  .eq('nhiem_vu_id', nhiemVuId).order('xu_ly_luc', { ascending: false }).limit(3)).catch(() => []);

// Nhập cả lô: dong = du_lieu đã đánh giá (danh-gia.js). loCu = lô mở ở lần bấm trước bị lỗi giữa chừng → gửi tiếp vào CHÍNH lô đó (DB trả kết quả
// đã lưu cho dòng gửi lại, không tạo việc trùng); lô đã chốt ở lần trước → đọc lại kết quả. Lỗi ném kèm err.lo để lần sau nhập tiếp.
// tienDo(soDaGui) báo tiến độ. → { lo: {id, ma}, ketQua: [...], soLieu }
const cho = (ms) => new Promise((ok) => { setTimeout(ok, ms); });
async function guiPhan(loId, phan) {
  try { return await goi('nhap_excel_dong', { p_lo: loId, p_dong: phan }); } catch (e) {
    if (/đã chốt/.test(e.message)) throw e;
    await cho(1500); return goi('nhap_excel_dong', { p_lo: loId, p_dong: phan });   // mạng chập chờn: thử lại một lần sau 1,5 giây
  }
}
const docKetQua = async (loId) => (await doc(supabase.from('dong_nhap').select('so_dong, ket_qua, nhiem_vu_id, ghi_chu').eq('lo_id', loId).order('so_dong')));
export async function nhapLo({ tenTep, mau, cheDoXong, dong, loCu = null }, tienDo = () => {}) {
  const lo = loCu || await goi('nhap_excel_lo_tao', { p: { ten_tep: tenTep, mau, che_do_xong: cheDoXong, so_dong: dong.length } });
  try {
    const ketQua = [];
    for (let i = 0; i < dong.length; i += PHAN) { ketQua.push(...await guiPhan(lo.id, dong.slice(i, i + PHAN))); tienDo(Math.min(i + PHAN, dong.length)); }
    return { lo, ketQua, soLieu: await goi('nhap_excel_lo_xong', { p_lo: lo.id }) };
  } catch (e) {
    if (loCu && /đã chốt/.test(e.message)) return { lo, ketQua: await docKetQua(lo.id), soLieu: await goi('nhap_excel_lo_xong', { p_lo: lo.id }) };
    const loi = new Error(`Nhập dở ở lô ${lo.ma}: ${e.message}`); loi.lo = lo; throw loi;
  }
}
