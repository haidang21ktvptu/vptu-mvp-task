-- 0033 — GĐ20 (giao diện v7, không đổi nghiệp vụ): (1) v_ngoai_le thêm cột "khau" (khâu đang tắc của việc Đỏ) tính từ dữ liệu sẵn có,
-- thứ tự ưu tiên: CHO_QUYET khi đã đặt cap_quyet_dinh → CHO_MINH_CHUNG khi có minh chứng chưa thẩm định (hop_le IS NULL) → CHUA_NHAN khi
-- chưa ai xác nhận nhận việc (lich_su cot = 'xac_nhan_nhan_viec', 0025) → còn lại CHUA_SAN_PHAM. Cột thêm vào cuối (CREATE OR REPLACE),
-- các cột cũ giữ nguyên thứ tự/kiểu; đếm theo khâu/đơn vị làm ở client trên dòng RLS trả về (DB-5).
-- (2) kl_so_lieu_tai(p_ngay): đếm nhiệm vụ trong phạm vi (SECURITY INVOKER → RLS nhiem_vu lọc) theo nhom_dem / muc_canh_bao / ket_qua
-- tại ngày p_ngay bằng trang_thai(nv, p_ngay) (0024). Client gọi hai lần (hôm nay, hôm nay − 7) để hiện "tăng/giảm N so với tuần trước";
-- cùng ngày, cùng phạm vi phải bằng số đếm trên v_nhiem_vu; p_ngay = 14/9/2026 khớp mốc kl-moc-2026-09-14 (test RLS kl-0033).
-- 1. v_ngoai_le + khau (security_invoker giữ; ORDER BY giữ: số ngày trễ giảm dần).
CREATE OR REPLACE VIEW "public"."v_ngoai_le" WITH ("security_invoker" = true) AS
SELECT v."id", v."ma", v."noi_dung", v."theo_1400", v."so_hoi_nghi", v."so_ket_luan", v."van_ban_loai",
       v."owner_don_vi_ma", v."owner_don_vi_ten", v."owner_trong_van_phong", v."owner_tai_khoan", v."owner_tai_khoan_ten",
       coalesce(v."owner_tai_khoan_ten", v."owner_don_vi_ten") AS "owner_ten",
       v."so_ngay_qua", v."han_xu_ly", v."so_lan_gia_han", v."muc_canh_bao",
       v."san_pham_loai", v."san_pham_mo_ta",
       coalesce(v."san_pham_ten" || coalesce(': ' || v."san_pham_mo_ta", ''), 'chưa định nghĩa') AS "san_pham_ten",
       v."cap_quyet_dinh", coalesce(v."cap_quyet_dinh_ten", 'chưa xác định') AS "cap_quyet_dinh_ten",
       v."nguoi_theo_doi", v."nguoi_theo_doi_ten", v."nguoi_theo_doi_phong",
       v."dang_dinh_chinh", CASE WHEN v."dang_dinh_chinh" THEN 'DANG_TRA_SOAT' ELSE 'DO' END AS "nhom",
       v."so_chi_dao_cho_phan_hoi", v."cap_nhat_luc", v."cap_nhat_boi",
       CASE
         WHEN v."cap_quyet_dinh" IS NOT NULL THEN 'CHO_QUYET'
         WHEN EXISTS (SELECT 1 FROM "public"."minh_chung" m WHERE m."nhiem_vu_id" = v."id" AND m."hop_le" IS NULL) THEN 'CHO_MINH_CHUNG'
         WHEN NOT EXISTS (SELECT 1 FROM "public"."lich_su" l WHERE l."nhiem_vu_id" = v."id" AND l."cot" = 'xac_nhan_nhan_viec') THEN 'CHUA_NHAN'
         ELSE 'CHUA_SAN_PHAM' END AS "khau"
FROM "public"."v_nhiem_vu" v
WHERE v."muc_canh_bao" IN ('DO', 'DO_DAC_BIET')
ORDER BY v."so_ngay_qua" DESC, v."ma";

-- 2. kl_so_lieu_tai(p_ngay) → jsonb {ngay, tong, nhom_dem: {…}, muc_canh_bao: {…}, ket_qua: {…}}. Không SECURITY DEFINER: đọc nhiem_vu
--    qua RLS của người gọi (kl_pham_vi). Gọi trang_thai một lần mỗi dòng (LATERAL) rồi đếm; khóa thiếu = 0 do client tự coalesce.
CREATE FUNCTION "public"."kl_so_lieu_tai"("p_ngay" date DEFAULT "public"."kl_hom_nay"()) RETURNS jsonb
LANGUAGE "sql" STABLE SECURITY INVOKER SET "search_path" = "public" AS $$
  WITH t AS (
    SELECT (x.tt)."nhom_dem" AS nhom_dem, (x.tt)."muc_canh_bao" AS muc_canh_bao, (x.tt)."ket_qua" AS ket_qua
    FROM "public"."nhiem_vu" nv
    CROSS JOIN LATERAL (SELECT "public"."trang_thai"(nv, "p_ngay") AS tt) x
  )
  SELECT jsonb_build_object(
    'ngay', "p_ngay",
    'tong', (SELECT count(*) FROM t),
    'nhom_dem', (SELECT coalesce(jsonb_object_agg(k, n), '{}'::jsonb) FROM (SELECT nhom_dem AS k, count(*) AS n FROM t GROUP BY 1) a),
    'muc_canh_bao', (SELECT coalesce(jsonb_object_agg(k, n), '{}'::jsonb) FROM (SELECT muc_canh_bao AS k, count(*) AS n FROM t GROUP BY 1) b),
    'ket_qua', (SELECT coalesce(jsonb_object_agg(k, n), '{}'::jsonb) FROM (SELECT ket_qua AS k, count(*) AS n FROM t WHERE ket_qua IS NOT NULL GROUP BY 1) c)
  );
$$;
REVOKE ALL ON FUNCTION "public"."kl_so_lieu_tai"(date) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_so_lieu_tai"(date) TO "authenticated";
