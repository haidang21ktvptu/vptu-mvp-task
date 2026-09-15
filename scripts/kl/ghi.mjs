// Ghi dữ liệu KL BTVTU đã kiểm tra vào DB bằng service_role (RLS không áp; trigger 0015 vẫn chạy: hạn "Ký ban hành"
// tự tính, lịch sử INSERT tự ghi một dòng cot = '*' cho mỗi nhiệm vụ). Thứ tự: hội nghị → nhiệm vụ → nhật ký cũ →
// setval sequence mã. Lỗi giữa chừng → xoá những gì lần chạy này vừa tạo (theo id) rồi ném lỗi.

import { COT_NHAT_KY, GHI_CHU_VPTU, LY_DO_CHUA_CO_HAN, TEN_VPTU } from './kiem-tra.mjs';
import { serialSangNgay } from './doc-nguon.mjs';
import { dbQuery } from './ket-noi.mjs';

const LO = 50;
const COT_NGAY_NHAT_KY = new Set(['han_xu_ly', 'ngay_ban_hanh']);

export async function demDongExcel(db) {
  const { count, error } = await db.from('kl_nhiem_vu').select('id', { count: 'exact', head: true }).eq('nguon', 'excel');
  if (error) throw new Error(`Không đếm được kl_nhiem_vu: ${error.message}`);
  return count;
}

// --xoa-cu (chỉ local/staging): xoá nhiệm vụ nguon = 'excel' (lịch sử/chỉ đạo/đính chính xoá theo FK CASCADE)
// rồi hội nghị không còn nhiệm vụ nào.
export async function xoaDuLieuExcelCu(db) {
  const { data: nv, error } = await db.from('kl_nhiem_vu').delete().eq('nguon', 'excel').select('id');
  if (error) throw new Error(`Xoá nhiệm vụ excel cũ thất bại: ${error.message}`);
  const { data: hn, error: e2 } = await db.from('kl_hoi_nghi').select('id, kl_nhiem_vu(id)');
  if (e2) throw new Error(`Đọc hội nghị thất bại: ${e2.message}`);
  const trong = hn.filter((h) => h.kl_nhiem_vu.length === 0).map((h) => h.id);
  if (trong.length > 0) {
    const { error: e3 } = await db.from('kl_hoi_nghi').delete().in('id', trong);
    if (e3) throw new Error(`Xoá hội nghị trống thất bại: ${e3.message}`);
  }
  return { nhiem_vu: nv.length, hoi_nghi: trong.length };
}

// Dựng dòng DB từ dòng nguồn đã kiểm tra. Hạn "Ký ban hành" để NULL cho trigger tự tính (= ngày BH + 10).
export function dungDong(nguon, dm, anhXa, anhXaEmail) {
  const hoiNghi = new Map();
  for (const r of nguon.nhiem_vu) {
    const k = `${r.so_hoi_nghi}|${r.so_ket_luan}`;
    if (!hoiNghi.has(k)) hoiNghi.set(k, { so_hoi_nghi: r.so_hoi_nghi, so_ket_luan: r.so_ket_luan, ngay_ban_hanh: r.ngay_ban_hanh });
  }
  const nhiemVu = nguon.nhiem_vu.map((r) => {
    const loai = dm.loai.get(r.loai_thoi_han_ten); const td = dm.tien_do.get(r.tien_do_ten);
    const vptu = r.chu_tri_ten === TEN_VPTU;
    const han = loai === 'KY_BAN_HANH' ? null : r.han_xu_ly;
    const row = {
      ma: r.ma, khoa_hoi_nghi: `${r.so_hoi_nghi}|${r.so_ket_luan}`, chu_tri_id: anhXa.theoTen.get(r.chu_tri_ten).id,
      nganh_ma: dm.nganh.get(r.nganh_ten), co_quan_trinh_ma: dm.co_quan.get(r.co_quan_trinh_ten),
      linh_vuc_chi_tiet: r.linh_vuc_chi_tiet, noi_dung: r.noi_dung, loai_thoi_han_ma: loai, han_xu_ly: han,
      ly_do_chua_co_han: td !== 'HOAN_THANH' && loai === 'CO_HAN_CU_THE' && !han ? LY_DO_CHUA_CO_HAN : null,
      tien_do_ma: td, minh_chung: r.minh_chung, van_ban_trien_khai: r.van_ban_trien_khai, nguon: 'excel',
      ghi_chu: vptu ? GHI_CHU_VPTU : null,
    };
    if (r.cap_nhat_luc) row.cap_nhat_luc = r.cap_nhat_luc;   // thiếu → DEFAULT now() = lúc nhập (trigger giữ với nguon excel)
    return row;
  });
  const nhatKy = nguon.nhat_ky.map((n) => {
    const cot = COT_NHAT_KY[n.cot] || n.cot;
    const doi = (v) => doiGiaTriNhatKy(cot, v, dm, anhXa);
    const nguoi = n.email ? anhXaEmail.bang.get(n.email) : null;
    return { ma: n.ma, luc: n.luc, nguoi_sua: nguoi ? nguoi.id : null, nguoi_sua_ghi_chu: n.email, cot, gia_tri_cu: doi(n.cu), gia_tri_moi: doi(n.moi), nguon: 'excel' };
  });
  return { hoiNghi: [...hoiNghi.values()], nhiemVu, nhatKy };
}

// Giá trị nhật ký: danh mục khớp → mã, chủ trì khớp → username, serial Excel ở cột ngày → YYYY-MM-DD, còn lại nguyên văn.
function doiGiaTriNhatKy(cot, v, dm, anhXa) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') return COT_NGAY_NHAT_KY.has(cot) && v > 40000 ? serialSangNgay(v) : String(v);
  const s = String(v).trim();
  const bang = { tien_do_ma: dm.tien_do, nganh_ma: dm.nganh, co_quan_trinh_ma: dm.co_quan, loai_thoi_han_ma: dm.loai }[cot];
  if (bang && bang.has(s)) return bang.get(s);
  if (cot === 'chu_tri_id' && anhXa.theoTen.has(s)) return anhXa.theoTen.get(s).username;
  return s;
}

// Chèn theo lô; id của từng lô đã vào được ghi ngay vào daTao (để dọn đúng khi lô sau lỗi).
async function chenLo(db, bang, rows, chon, daTao) {
  const ra = [];
  for (let i = 0; i < rows.length; i += LO) {
    const { data, error } = await db.from(bang).insert(rows.slice(i, i + LO), { defaultToNull: false }).select(chon);
    if (error) throw new Error(`INSERT ${bang} (lô từ dòng ${i + 1}): ${error.message}`);
    ra.push(...data);
    if (daTao) daTao.push(...data.map((d) => d.id));
  }
  return ra;
}

// Trả về số dòng đã ghi theo bảng. target dùng cho setval qua CLI.
export async function ghiDuLieu(db, target, dong) {
  const daTao = { hoi_nghi: [], nhiem_vu: [], lich_su: 0 };
  try {
    const hn = await chenLo(db, 'kl_hoi_nghi', dong.hoiNghi, 'id, so_hoi_nghi, so_ket_luan', daTao.hoi_nghi);
    const idHN = new Map(hn.map((h) => [`${h.so_hoi_nghi}|${h.so_ket_luan}`, h.id]));
    const nv = await chenLo(db, 'kl_nhiem_vu', dong.nhiemVu.map(({ khoa_hoi_nghi, ...r }) => ({ ...r, hoi_nghi_id: idHN.get(khoa_hoi_nghi) })), 'id, ma', daTao.nhiem_vu);
    const idNV = new Map(nv.map((n) => [n.ma, n.id]));
    daTao.lich_su = (await chenLo(db, 'kl_lich_su', dong.nhatKy.map(({ ma, ...r }) => ({ ...r, nhiem_vu_id: idNV.get(ma) })), 'id')).length;
  } catch (err) {
    await donSauLoi(db, daTao);
    throw err;
  }
  // Dữ liệu đã vào đủ; sequence lỗi (CLI chưa login, token hết hạn) thì KHÔNG xoá lại — in SQL để chạy tay.
  const soMax = Math.max(...dong.nhiemVu.map((r) => Number(r.ma.slice(3))));
  const sql = `SELECT setval('public.kl_nhiem_vu_ma_seq', ${soMax}, true);`;
  try {
    dbQuery(target, sql);
  } catch (err) {
    console.error(`Dữ liệu đã ghi nhưng chưa đặt được sequence mã (${err.message}). Chạy tay: supabase db query ${target.cliArgs.join(' ')} "${sql}"`);
  }
  return { hoi_nghi: daTao.hoi_nghi.length, nhiem_vu: daTao.nhiem_vu.length, lich_su_excel: daTao.lich_su, ma_ke_tiep: `NV-${String(soMax + 1).padStart(3, '0')}` };
}

async function donSauLoi(db, daTao) {
  try {
    for (const [bang, ids] of [['kl_nhiem_vu', daTao.nhiem_vu], ['kl_hoi_nghi', daTao.hoi_nghi]]) {
      if (ids.length === 0) continue;
      const { error } = await db.from(bang).delete().in('id', ids);
      if (error) throw new Error(`xoá ${bang}: ${error.message}`);
    }
    console.error(`Đã xoá lại ${daTao.nhiem_vu.length} nhiệm vụ và ${daTao.hoi_nghi.length} hội nghị vừa tạo trong lần chạy này.`);
  } catch (e) {
    console.error(`KHÔNG dọn được dữ liệu vừa tạo (${e.message}) — kiểm tra tay kl_hoi_nghi/kl_nhiem_vu nguon = 'excel'.`);
  }
}

// Đếm lại sau khi ghi để đối chiếu với nguồn.
export async function kiemLaiSauGhi(db) {
  const dem = async (bang, loc) => {
    let q = db.from(bang).select('id', { count: 'exact', head: true });
    if (loc) q = loc(q);
    const { count, error } = await q;
    if (error) throw new Error(`Đếm ${bang}: ${error.message}`);
    return count;
  };
  return {
    nhiem_vu_excel: await dem('kl_nhiem_vu', (q) => q.eq('nguon', 'excel')),
    lich_su_excel_nhat_ky: await dem('kl_lich_su', (q) => q.eq('nguon', 'excel').neq('cot', '*')),
    lich_su_excel_tao: await dem('kl_lich_su', (q) => q.eq('nguon', 'excel').eq('cot', '*')),
    can_dien_han_ly_do: await dem('kl_nhiem_vu', (q) => q.eq('nguon', 'excel').eq('ly_do_chua_co_han', LY_DO_CHUA_CO_HAN)),
    chuyen_tu_vptu: await dem('kl_nhiem_vu', (q) => q.eq('nguon', 'excel').eq('ghi_chu', GHI_CHU_VPTU)),
  };
}
