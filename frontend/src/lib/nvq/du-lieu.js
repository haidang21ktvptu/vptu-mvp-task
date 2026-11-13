// Phân hệ Nhiệm vụ quý BTV: đọc dữ liệu (RLS: mọi cán bộ xem toàn bộ — 0133) và gọi hàm ghi (0135–0139; quyền thật kiểm trong hàm, giao diện chỉ ẩn /
// hiện nút theo nvq_quyen_cua_toi). Kho dữ liệu dùng chung của các màn trong phân hệ: nq (quý đang xem, dòng nhiệm vụ, kết quả / sản phẩm, tuần, văn bản,
// danh mục, quyền). Không lưu gì vào sessionStorage (dữ liệu nhỏ, đọc lại khi mở màn).
import { supabase } from '../supabase.js';
import { tenAnToan, kieuTep } from '../kl/tep-ten.js';
import { homNayVN } from '../kl/ngay.js';

export const KHO_TEP = 'nvq-tep';
export const nq = { kys: [], ky: null, rows: [], sp: [], tuans: [], vanBan: [], truc: [], lanhDao: [], donVi: [], quyen: {}, daNap: false, kyChon: '' };

const loi = (r) => { if (r.error) throw new Error(r.error.message || 'Không thực hiện được.'); return r.data; };
export const rpc = async (ham, thamSo = {}) => loi(await supabase.rpc(ham, thamSo));

export async function napDanhMuc() {
  const [truc, lanhDao, donVi, quyen] = await Promise.all([
    supabase.from('nvq_truc').select('*').order('so'),
    supabase.from('nvq_lanh_dao').select('*').order('thu_tu'),
    supabase.from('nvq_don_vi').select('*').order('thu_tu'),
    supabase.rpc('nvq_quyen_cua_toi'),
  ]);
  Object.assign(nq, { truc: loi(truc) || [], lanhDao: loi(lanhDao) || [], donVi: loi(donVi) || [], quyen: loi(quyen) || {} });
}
export async function napKy() {
  nq.kys = loi(await supabase.from('nvq_ky').select('*').order('nam', { ascending: false }).order('quy', { ascending: false })) || [];
  const hom = homNayVN();
  nq.ky = nq.kys.find((k) => k.id === nq.kyChon) || nq.kys.find((k) => k.tu_ngay <= hom && hom <= k.den_ngay) || nq.kys[0] || null;
  return nq.ky;
}
// Mọi dữ liệu của một quý cho các màn danh sách / tổng quan / báo cáo (≈ 100 nhiệm vụ, vài trăm kết quả).
export async function napQuy(kyId = nq.ky?.id) {
  if (!kyId) { Object.assign(nq, { rows: [], sp: [], tuans: [], vanBan: [] }); return; }
  const [rows, tuans, vanBan] = await Promise.all([
    supabase.from('v_nvq_nhiem_vu').select('*').eq('ky_id', kyId),
    supabase.from('nvq_tuan').select('*').eq('ky_id', kyId).order('so'),
    supabase.from('nvq_van_ban').select('*').eq('ky_id', kyId).order('ngay', { ascending: true, nullsFirst: true }),
  ]);
  nq.rows = loi(rows) || [];
  nq.tuans = loi(tuans) || [];
  nq.vanBan = loi(vanBan) || [];
  nq.sp = await napSanPham(nq.rows.map((r) => r.id));
}
export async function napSanPham(ids) {
  const ra = [];
  for (let i = 0; i < ids.length; i += 80) {   // .in() theo lô để đường dẫn yêu cầu không quá dài
    ra.push(...(loi(await supabase.from('v_nvq_san_pham').select('*').in('nhiem_vu_id', ids.slice(i, i + 80))) || []));
  }
  return ra;
}
export async function napTatCa({ lamMoiDanhMuc = false } = {}) {
  if (lamMoiDanhMuc || !nq.daNap) await napDanhMuc();
  await napKy();
  await napQuy();
  nq.daNap = true;
}
export const dongTheoId = () => new Map(nq.rows.map((r) => [r.id, r]));

// Chi tiết một nhiệm vụ: các lần cập nhật (kèm tuần), số liệu chỉ tiêu, ý kiến, tệp, lịch sử.
export async function napChiTiet(nvId) {
  const [nv, sp, cn, yk, tep, ls] = await Promise.all([
    supabase.from('v_nvq_nhiem_vu').select('*').eq('id', nvId).maybeSingle(),
    supabase.from('v_nvq_san_pham').select('*').eq('nhiem_vu_id', nvId).order('thu_tu'),
    supabase.from('nvq_cap_nhat').select('*, nvq_tuan(so, tu_ngay, den_ngay)').eq('nhiem_vu_id', nvId).order('ngay_bao_cao', { ascending: false }).order('tao_luc', { ascending: false }),
    supabase.from('nvq_y_kien').select('*').eq('nhiem_vu_id', nvId).order('gui_luc'),
    supabase.from('nvq_tep').select('*').eq('nhiem_vu_id', nvId).order('tai_luc', { ascending: false }),
    supabase.from('nvq_lich_su').select('*').eq('nhiem_vu_id', nvId).order('luc', { ascending: false }).limit(200),
  ]);
  const dsSp = loi(sp) || [];
  const ct = dsSp.filter((s) => s.loai === 'CHI_TIEU').map((s) => s.id);
  const soLieu = ct.length ? loi(await supabase.from('nvq_so_lieu').select('*').in('san_pham_id', ct).order('ngay_so_lieu')) || [] : [];
  return { r: loi(nv), sp: dsSp, capNhat: loi(cn) || [], yKien: loi(yk) || [], tep: loi(tep) || [], lichSu: loi(ls) || [], soLieu };
}
export async function timTheoMa(ma) {
  return loi(await supabase.from('v_nvq_nhiem_vu').select('id, ky_id, ma').eq('ma', String(ma).toUpperCase()).maybeSingle());
}
// Cập nhật của một tuần (báo cáo tuần: cột "Kết quả trong tuần").
export async function napCapNhatTuan(tuanId) {
  if (!tuanId) return [];
  return loi(await supabase.from('nvq_cap_nhat').select('id, nhiem_vu_id, ngay_bao_cao, noi_dung, vuong_mac, de_xuat, nguon_thong_tin, khong_thay_doi, thay_doi, tao_boi, tao_luc')
    .eq('tuan_id', tuanId).order('tao_luc')) || [];
}
export async function napAnhTuan(tuanId) {
  return loi(await supabase.from('nvq_tuan_anh').select('*').eq('tuan_id', tuanId)) || [];
}
export async function napLichSuKy(kyId, gioiHan = 300) {
  return loi(await supabase.from('nvq_lich_su').select('*').eq('ky_id', kyId).is('nhiem_vu_id', null).order('luc', { ascending: false }).limit(gioiHan)) || [];
}
export async function napLoNhap(kyId) {
  return loi(await supabase.from('nvq_lo_nhap').select('*').eq('ky_id', kyId).order('nhap_luc', { ascending: false }).limit(20)) || [];
}
export async function napDauMoi() {
  return loi(await supabase.from('nvq_phan_quyen').select('*')) || [];
}

// ---- Hàm ghi ----
export const luuKy = (p) => rpc('nvq_ky_luu', { p });
export const luuVanBan = (p) => rpc('nvq_van_ban_luu', { p });
export const xoaVanBan = (id) => rpc('nvq_van_ban_xoa', { p_id: id });
export const luuNhiemVu = (p, lyDo) => rpc('nvq_nhiem_vu_luu', { p, p_ly_do: lyDo || null });
export const xoaNhiemVu = (id, lyDo) => rpc('nvq_nhiem_vu_xoa', { p_id: id, p_ly_do: lyDo });
export const luuSanPham = (p, lyDo) => rpc('nvq_san_pham_luu', { p, p_ly_do: lyDo || null });
export const xoaSanPham = (id, lyDo) => rpc('nvq_san_pham_xoa', { p_id: id, p_ly_do: lyDo });
export const phanCong = (ids, p, lyDo) => rpc('nvq_phan_cong', { p_ids: ids, p, p_ly_do: lyDo || null });
export const dieuChinh = (id, loai, vanBan, lyDo) => rpc('nvq_dieu_chinh', { p_id: id, p_loai: loai, p_van_ban: vanBan || null, p_ly_do: lyDo });
export const datDauMoi = (id, bat) => rpc('nvq_phan_quyen_dat', { p_tai_khoan: id, p_bat: bat });
export const luuDanhMuc = (bang, p) => rpc('nvq_danh_muc_luu', { p_bang: bang, p });
export const guiCapNhat = (p) => rpc('nvq_cap_nhat_gui', { p });
export const suaCapNhat = (id, p, lyDo) => rpc('nvq_cap_nhat_sua', { p_id: id, p, p_ly_do: lyDo || null });
export const xoaSoLieu = (id, lyDo) => rpc('nvq_so_lieu_xoa', { p_id: id, p_ly_do: lyDo });
export const guiYKien = (p) => rpc('nvq_y_kien_gui', { p });
export const xongYKien = (id) => rpc('nvq_y_kien_xong', { p_id: id });
export const nhapDanhMuc = (kyId, dong, tenTep) => rpc('nvq_nhap_danh_muc', { p_ky: kyId, p_dong: dong, p_ten_tep: tenTep || null });
export const hoanTacLo = (id) => rpc('nvq_hoan_tac_lo', { p_lo: id });
export const chotTuan = (id, nhanXet) => rpc('nvq_tuan_chot', { p_tuan: id, p_nhan_xet: nhanXet || null });
export const moLaiTuan = (id, lyDo) => rpc('nvq_tuan_mo_lai', { p_tuan: id, p_ly_do: lyDo });
export const danhGia = (id, muc, lyDo, chot, chuyen) => rpc('nvq_danh_gia', { p_id: id, p_muc: muc, p_ly_do: lyDo || null, p_chot: Boolean(chot), p_chuyen: chuyen ?? null });
export const chotKy = (id, nhanXet) => rpc('nvq_ky_chot', { p_ky: id, p_nhan_xet: nhanXet || null });
export const moLaiKy = (id, lyDo) => rpc('nvq_ky_mo_lai', { p_ky: id, p_ly_do: lyDo });
export const chuyenKy = (ids, kyMoi) => rpc('nvq_chuyen_ky', { p_ids: ids, p_ky_moi: kyMoi });
export const tinDaDoc = (nvId) => rpc('nvq_tin_da_doc', { p_nv: nvId });

// ---- Tệp: tải lên kho nvq-tep rồi gắn (CSDL kiểm tệp có thật, đúng việc); gắn lỗi → xoá tệp vừa tải ----
export async function taiVaGanTep(nvId, file, sanPhamId = null) {
  const ngauNhien = (globalThis.crypto?.randomUUID?.() || `${Date.now()}${Math.random()}`).replace(/[^a-z0-9]/gi, '').slice(0, 8);
  const path = `${nvId}/${ngauNhien}-${tenAnToan(file.name)}`;
  const { error } = await supabase.storage.from(KHO_TEP).upload(path, file, { contentType: kieuTep(file), upsert: false });
  if (error) throw new Error(`Không tải được tệp lên: ${error.message}`);
  try {
    return await rpc('nvq_tep_gan', { p: { duong_dan: path, ten: file.name, kich_thuoc: file.size, san_pham_id: sanPhamId } });
  } catch (e) {
    try { await supabase.storage.from(KHO_TEP).remove([path]); } catch { /* tệp mồ côi vô hại */ }
    throw e;
  }
}
export async function goTep(id) {
  const path = await rpc('nvq_tep_xoa', { p_id: id });
  try { await supabase.storage.from(KHO_TEP).remove([path]); } catch { /* tệp của người khác: còn trong kho, không còn gắn */ }
}
export async function moTep(path) {
  const { data, error } = await supabase.storage.from(KHO_TEP).createSignedUrl(path, 120);
  if (error) throw new Error(`Không mở được tệp: ${error.message}`);
  return data.signedUrl;
}
