// Danh sách cột tường minh theo nguồn (PR-2a B6: bỏ select('*')). Mỗi hằng = đúng các cột frontend đọc (rà bằng grep 29/9/2026);
// thêm cột mới vào view thì chỉ lấy khi thêm vào đây. v_nhiem_vu: ngăn chi tiết và Cập nhật nhanh mở từ chính dòng danh sách
// (không đọc lại), nên danh sách lấy đủ cột mà mọi màn hình Nhiệm vụ dùng — bỏ 3 cột không nơi nào đọc (van_ban_ngay_nhan,
// cap_nhat_boi, minh_chung_moi_nhat) và thêm các cột 0051 thay cho truy vấn lich_su / v_ngoai_le (thu_tu_do_khan: thứ tự ngoại lệ).

const cot = (...ds) => ds.join(', ');

export const COT_VIEC = cot('id, ma, van_ban_id, van_ban_loai, so_hoi_nghi, so_ket_luan, ngay_ban_hanh',
  'nguoi_theo_doi, nguoi_theo_doi_ten, nguoi_theo_doi_phong, owner_don_vi_ma, owner_don_vi_ten, owner_trong_van_phong, owner_phong, owner_tai_khoan, owner_tai_khoan_ten',
  'san_pham_loai, san_pham_ten, san_pham_mo_ta, cap_nhan_san_pham, cap_nhan_san_pham_ten, cap_quyet_dinh, cap_quyet_dinh_ten',
  'ngay_nhan_van_ban, ngay_nhan_uoc_tinh, nhiem_vu_cha, theo_1400, nganh_ma, nganh_ten, linh_vuc_ma, linh_vuc_ten, linh_vuc_chi_tiet, noi_dung',
  'loai_thoi_han_ma, loai_thoi_han_ten, han_xu_ly, ly_do_chua_co_han, tien_do_ma, ngay_hoan_thanh, minh_chung, van_ban_trien_khai, so_lan_gia_han, nguon, ghi_chu',
  'thieu_minh_chung, dong_luc, cap_nhat_luc, tao_boi, created_at, trang_thai, so_ngay_qua, ket_qua, so_ngay_tre, do_tre_nhap_lieu, dang_dinh_chinh, nhom_dem',
  'muc_canh_bao, lead_time_ngay, tuoi_ngay, so_chi_dao_cho_phan_hoi, so_minh_chung_hop_le, do_khan, uu_tien, giao_thay_mat_cho, giao_thay_mat_cho_ten, giao_thay_mat_nhom',
  'thu_tu_do_khan, bi_tu_choi, da_xac_nhan_nhan, nguoi_da_nhan, nhom_ngoai_le, khau',
  // PR-2b (0059): bước nghiệm thu, người chịu chậm (KPI tính ở DB; 0077: ba cột hạn nộp còn trong view nhưng không đọc nữa)
  'minh_chung_buoc, nop_dung_han, nghiem_thu_dung_han, so_lan_tra_lai',
  'nguoi_nop_cho, nguoi_chiu_cham, nguoi_chiu_cham_ten, phong_chiu_cham',
  // PR-3 (0067): chất lượng, nguồn nhiệm vụ, vướng mắc, đơn vị phối hợp, tiến độ hoàn thành (Trước hạn / Đúng hạn / Trễ)
  'chat_luong, nguon_nhiem_vu_ma, nguon_nhiem_vu_ten, vuong_mac, don_vi_phoi_hop, tien_do_hoan_thanh');
export const COT_TU_CHOI = 'id, nhiem_vu_id, nguoi_de_nghi, cap_duyet, ly_do, tao_luc, trang_thai, y_kien_duyet, duyet_luc';
export const COT_CHI_DAO = cot('id, nhiem_vu_id, nguoi_gui, loai, noi_dung, han_phan_hoi, han_moi, chu_tri_moi, trang_thai, phan_hoi, phan_hoi_boi, phan_hoi_luc',
  'created_at, tra_loi_cho, nguoi_nhan, do_khan, da_nhan, dong_boi, dong_luc');
export const COT_CHI_DAO_TT = cot('id, nhiem_vu_id, ma, nhiem_vu_noi_dung, han_xu_ly, nguoi_gui, noi_dung, han_phan_hoi, trang_thai, nguoi_nhan',
  'phan_hoi, phan_hoi_boi, phan_hoi_luc, created_at, qua_han_phan_hoi, nguoi_nhan_ten, dong_boi, dong_boi_ten, do_khan');
export const COT_MINH_CHUNG = cot('id, nhiem_vu_id, loai, so_hieu, ngay_van_ban, cap_nhan, noi_dung_chu, nop_boi, nop_luc, hop_le, xac_nhan_boi, xac_nhan_luc',
  'ly_do_khong_hop_le, trich_yeu, mo_ta_ket_qua');
export const COT_DIEN_BIEN = 'id, nhiem_vu_id, luc, nguon, loai, nguoi, nguoi_ten, noi_dung, gia_tri_cu, trang_thai, chi_dao_id';
export const COT_TAI_KHOAN = cot('id, username, full_name, role_group, position_title, manager_id, department, must_change_password, is_chief, is_system',
  'quan_tri_kl, quan_tri_he_thong, dien_thoai, anh_url, tuy_chon, quan_tri_kl_het_han, bi_khoa, thu_ky_thuong_truc');
export const COT_TIN_NHAN = 'id, sender_id, receiver_id, content, is_read, created_at, loai, nhiem_vu_id';

// Đọc đủ mọi dòng theo trang (.range) cho danh sách cần đếm đủ ở client (v_nhiem_vu, tu_choi, v_minh_chung) — không phụ thuộc
// max_rows của PostgREST. taoTruyVan() trả truy vấn MỚI mỗi lần gọi, đã có thứ tự ỔN ĐỊNH (khoá duy nhất cuối cùng) để trang không trùng/sót.
export const CO_TRANG = 500;
export async function taiTheoTrang(taoTruyVan, viec, co = CO_TRANG) {
  const ket = [];
  for (let tu = 0; ; tu += co) {
    const r = await taoTruyVan().range(tu, tu + co - 1);
    if (r.error) throw new Error(`${viec}: ${r.error.message}`);
    ket.push(...(r.data || []));
    if (!r.data || r.data.length < co) return ket;
  }
}
