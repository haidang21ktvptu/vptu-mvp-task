-- 0050: trang_thai_dong — cùng quy tắc trang_thai bản 0036, KHÔNG đổi logic; chỉ đổi hình thức để planner INLINE được (PR-2a, B3).
-- Đo ở Lượt 1: v_nhiem_vu gọi trang_thai 9 lần/dòng (LATERAL (SELECT trang_thai(..) AS tt) bị làm phẳng, mỗi (t.tt).x một lời gọi) ≈ 75 %
-- thời gian của view; kl_so_lieu_tai 3 lần/dòng. trang_thai_dong đứng ở FROM … CROSS JOIN LATERAL ⇒ mỗi dòng tính một lần.
-- Điều kiện inline (hàm SQL trả tập): STABLE, không SECURITY DEFINER, không SET, không STRICT, một câu SELECT, không CTE ⇒ mọi tên có schema.
-- Hai tầng "OFFSET 0" chặn làm phẳng bên trong: trạng thái / đính chính / ngưỡng mỗi dòng chỉ tính một lần dù được đọc nhiều chỗ.
-- Ngưỡng kl_cau_hinh không phụ thuộc dòng ⇒ initplan (một lần mỗi truy vấn); ngưỡng theo độ khẩn = tra PK (như kl_nguong_do_khan 'vang').
-- dang_dinh_chinh đọc dinh_chinh dưới RLS của người gọi (SECURITY INVOKER) như bản 0036.
-- trang_thai(nv, ngay) giữ chữ ký, thân gọi trang_thai_dong ⇒ canh_bao_quet, kl_tinh_trang_thai, test cũ không đổi. "Một hàm, một nguồn" (NF-9).

CREATE OR REPLACE FUNCTION "public"."trang_thai_dong"("nv" "public"."nhiem_vu", "ngay" date DEFAULT "public"."kl_hom_nay"())
RETURNS SETOF "public"."trang_thai_kq" LANGUAGE sql STABLE ROWS 1 AS $$
  SELECT
    b.trang_thai,
    CASE WHEN b.trang_thai = 'QUA_HAN' THEN ("trang_thai_dong"."ngay" - "nv"."han_xu_ly")::integer END,
    b.ket_qua,
    CASE WHEN b.ket_qua = 'TRE' THEN ("nv"."ngay_hoan_thanh" - "nv"."han_xu_ly")::integer END,
    CASE WHEN "nv"."tien_do_ma" = 'HOAN_THANH' AND "nv"."ngay_hoan_thanh" IS NOT NULL AND "nv"."dong_luc" IS NOT NULL
         THEN (("nv"."dong_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - "nv"."ngay_hoan_thanh")::integer END,
    b.dang_dinh_chinh,
    CASE WHEN b.trang_thai = 'QUA_HAN' AND b.dang_dinh_chinh THEN 'DANG_DINH_CHINH' ELSE b.trang_thai END,
    CASE b.trang_thai
      WHEN 'QUA_HAN' THEN CASE WHEN ("trang_thai_dong"."ngay" - "nv"."han_xu_ly") >= b.ddb THEN 'DO_DAC_BIET' ELSE 'DO' END
      WHEN 'SAP_DEN_HAN' THEN CASE WHEN ("nv"."han_xu_ly" - "trang_thai_dong"."ngay") <= b.vang
                                    AND nullif(btrim(coalesce("nv"."minh_chung", '')), '') IS NULL THEN 'VANG' ELSE 'XANH' END
      WHEN 'DANG_THUC_HIEN' THEN 'XANH'
      ELSE 'KHONG_AP_DUNG' END,
    CASE WHEN "nv"."tien_do_ma" = 'HOAN_THANH' AND "nv"."ngay_hoan_thanh" IS NOT NULL AND NOT "nv"."ngay_nhan_uoc_tinh"
         THEN ("nv"."ngay_hoan_thanh" - "nv"."ngay_nhan_van_ban")::integer END
  FROM (
    SELECT
      CASE
        WHEN "nv"."tien_do_ma" = 'HOAN_THANH' THEN 'HOAN_THANH'
        WHEN "nv"."loai_thoi_han_ma" = 'THUONG_XUYEN' THEN 'THUONG_XUYEN'
        WHEN "nv"."han_xu_ly" IS NULL AND "nv"."loai_thoi_han_ma" = 'CHO_QUYET_DINH' THEN 'CHO_DIEU_KIEN'
        WHEN "nv"."han_xu_ly" IS NULL THEN 'CAN_DIEN_HAN'
        WHEN "nv"."han_xu_ly" < "trang_thai_dong"."ngay" THEN 'QUA_HAN'
        WHEN "nv"."han_xu_ly" <= "trang_thai_dong"."ngay" + greatest(c.nguong, c.vang) THEN 'SAP_DEN_HAN'
        ELSE 'DANG_THUC_HIEN' END AS trang_thai,
      EXISTS (SELECT 1 FROM "public"."dinh_chinh" d WHERE d."nhiem_vu_id" = "nv"."id" AND d."trang_thai" = 'CHO_DUYET') AS dang_dinh_chinh,
      CASE
        WHEN "nv"."tien_do_ma" <> 'HOAN_THANH' THEN NULL
        WHEN "nv"."ngay_hoan_thanh" IS NULL OR "nv"."han_xu_ly" IS NULL THEN 'KHONG_DANH_GIA'
        WHEN "nv"."ngay_hoan_thanh" <= "nv"."han_xu_ly" THEN 'DUNG_HAN'
        ELSE 'TRE' END AS ket_qua,
      c.vang, c.ddb
    FROM (
      SELECT
        coalesce((SELECT k."gia_tri"::integer FROM "public"."kl_cau_hinh" k WHERE k."khoa" = 'nguong_sap_den_han_ngay'), 7) AS nguong,
        coalesce((SELECT k."gia_tri"::integer FROM "public"."kl_cau_hinh" k
                  WHERE k."khoa" = CASE WHEN "nv"."do_khan" = 'THUONG' THEN 'nguong_vang_ngay' ELSE 'do_khan_' || "nv"."do_khan" || '_vang' END),
                 CASE WHEN "nv"."do_khan" = 'THUONG' THEN 3 ELSE 5 END) AS vang,
        coalesce((SELECT k."gia_tri"::integer FROM "public"."kl_cau_hinh" k WHERE k."khoa" = 'nguong_do_dac_biet_ngay'), 3) AS ddb
      OFFSET 0
    ) c
    OFFSET 0
  ) b;
$$;
REVOKE ALL ON FUNCTION "public"."trang_thai_dong"("public"."nhiem_vu", date) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."trang_thai_dong"("public"."nhiem_vu", date) TO "authenticated";

CREATE OR REPLACE FUNCTION "public"."trang_thai"("nv" "public"."nhiem_vu", "ngay" date DEFAULT "public"."kl_hom_nay"())
RETURNS "public"."trang_thai_kq" LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT * FROM "public"."trang_thai_dong"("nv", "ngay");
$$;

-- Tên trong thân đã có schema ⇒ bỏ SET search_path (không còn chặn inline khi hàm khác gọi).
ALTER FUNCTION "public"."kl_nguong_do_khan"(text) RESET search_path;
