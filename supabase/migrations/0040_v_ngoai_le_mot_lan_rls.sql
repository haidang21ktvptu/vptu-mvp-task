-- 0040 — GĐ22 (tối ưu sau khi đo trên staging): v_ngoai_le (0034/0037) JOIN lại bảng nhiem_vu để lấy bi_tu_choi/tien_do_ma → RLS kl_pham_vi
-- chạy hai lần mỗi dòng (PCVP: kl_pham_vi_pcvp → kiêm nhiệm + phụ trách) → dưới tải e2e chạm statement timeout. v_nhiem_vu đã có bi_tu_choi
-- (0037) và tien_do_ma nên bỏ JOIN; cột, thứ tự cột và ORDER BY giữ nguyên 0037.
CREATE OR REPLACE VIEW "public"."v_ngoai_le" WITH ("security_invoker" = true) AS
SELECT v."id", v."ma", v."noi_dung", v."theo_1400", v."so_hoi_nghi", v."so_ket_luan", v."van_ban_loai",
       v."owner_don_vi_ma", v."owner_don_vi_ten", v."owner_trong_van_phong", v."owner_tai_khoan", v."owner_tai_khoan_ten",
       coalesce(v."owner_tai_khoan_ten", v."owner_don_vi_ten") AS "owner_ten",
       v."so_ngay_qua", v."han_xu_ly", v."so_lan_gia_han", v."muc_canh_bao",
       v."san_pham_loai", v."san_pham_mo_ta",
       coalesce(v."san_pham_ten" || coalesce(': ' || v."san_pham_mo_ta", ''), 'chưa định nghĩa') AS "san_pham_ten",
       v."cap_quyet_dinh", coalesce(v."cap_quyet_dinh_ten", 'chưa xác định') AS "cap_quyet_dinh_ten",
       v."nguoi_theo_doi", v."nguoi_theo_doi_ten", v."nguoi_theo_doi_phong",
       v."dang_dinh_chinh", CASE WHEN v."dang_dinh_chinh" THEN 'DANG_TRA_SOAT' WHEN v."muc_canh_bao" IN ('DO', 'DO_DAC_BIET') THEN 'DO' ELSE 'TU_CHOI' END AS "nhom",
       v."so_chi_dao_cho_phan_hoi", v."cap_nhat_luc", v."cap_nhat_boi",
       CASE
         WHEN v."bi_tu_choi" THEN 'BI_TU_CHOI'
         WHEN v."cap_quyet_dinh" IS NOT NULL THEN 'CHO_QUYET'
         WHEN EXISTS (SELECT 1 FROM "public"."minh_chung" m WHERE m."nhiem_vu_id" = v."id" AND m."hop_le" IS NULL) THEN 'CHO_MINH_CHUNG'
         WHEN v."theo_1400" AND NOT EXISTS (SELECT 1 FROM "public"."lich_su" l WHERE l."nhiem_vu_id" = v."id" AND l."cot" = 'xac_nhan_nhan_viec') THEN 'CHUA_NHAN'
         ELSE 'CHUA_SAN_PHAM' END AS "khau",
       v."bi_tu_choi", v."do_khan", v."uu_tien", v."giao_thay_mat_cho", v."giao_thay_mat_cho_ten", v."thu_tu_do_khan"
FROM "public"."v_nhiem_vu" v
WHERE v."muc_canh_bao" IN ('DO', 'DO_DAC_BIET') OR (v."bi_tu_choi" AND v."tien_do_ma" <> 'HOAN_THANH')
ORDER BY v."thu_tu_do_khan", (v."uu_tien" IS NOT DISTINCT FROM 'THUONG_TRUC') DESC, v."bi_tu_choi" DESC, (v."muc_canh_bao" = 'DO_DAC_BIET') DESC, v."so_ngay_qua" DESC, v."ma";
