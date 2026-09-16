-- GĐ14 (PR 14AB, 3/3) — Hàm trạng thái mở rộng trang_thai() (SPEC v3 mục 4.1: thêm muc_canh_bao 4 mức + lead_time_ngay,
-- NT-5/CN-4/CN-2.1), view v_nhiem_vu (SPEC 5.9) và BÍ DANH cho frontend hiện tại (không sửa frontend ở PR này): view
-- kl_nhiem_vu/kl_hoi_nghi/kl_lich_su/kl_chi_dao/kl_dinh_chinh/dm_co_quan_trinh với tên cột cũ (security_invoker → RLS
-- của bảng gốc áp cho người gọi; view một bảng nên INSERT/UPDATE đi thẳng xuống bảng, trigger vẫn chạy), wrapper
-- kl_trang_thai/kl_tinh_trang_thai giữ kiểu cũ. v_kl_dashboard giữ nguyên (theo OID). Bí danh bỏ khi frontend đã chuyển (14C/14D).

CREATE TYPE "public"."trang_thai_kq" AS (
  "trang_thai" text, "so_ngay_qua" integer, "ket_qua" text, "so_ngay_tre" integer, "do_tre_nhap_lieu" integer,
  "dang_dinh_chinh" boolean, "nhom_dem" text,
  "muc_canh_bao" text,      -- XANH | VANG | DO | DO_DAC_BIET | KHONG_AP_DUNG (CN-4; đã đóng/thường xuyên/chờ điều kiện/cần điền hạn = KHONG_AP_DUNG)
  "lead_time_ngay" integer  -- ngay_hoan_thanh − ngay_nhan_van_ban, chỉ khi cả hai là ngày thật (DL-4; ước tính → NULL)
);

-- Thứ tự quy tắc 4.1, dừng ở quy tắc đầu tiên khớp; 7 trường đầu y hệt kl_trang_thai (0015) → bộ số 14/9 không đổi.
-- VÀNG (CN-4.1, CH-10): còn ≤ nguong_vang_ngay và chưa có minh chứng — tới 15A "minh chứng" là bảng minh_chung, ở đây là ô chữ.
-- ĐỎ ĐẶC BIỆT (CN-4.3, CH-10): quá hạn ≥ nguong_do_dac_biet_ngay. Ngưỡng "Sắp đến hạn" 7 ngày giữ riêng (CH-10b = i).
CREATE FUNCTION "public"."trang_thai"("nv" "public"."nhiem_vu", "ngay" date DEFAULT "public"."kl_hom_nay"())
RETURNS "public"."trang_thai_kq"
LANGUAGE "sql" STABLE SET "search_path" = "public" AS $$
  WITH ch AS (
    SELECT coalesce((SELECT "gia_tri"::integer FROM "public"."kl_cau_hinh" WHERE "khoa" = 'nguong_sap_den_han_ngay'), 7) AS nguong,
           coalesce((SELECT "gia_tri"::integer FROM "public"."kl_cau_hinh" WHERE "khoa" = 'nguong_vang_ngay'), 3) AS vang,
           coalesce((SELECT "gia_tri"::integer FROM "public"."kl_cau_hinh" WHERE "khoa" = 'nguong_do_dac_biet_ngay'), 3) AS ddb
  ), tt AS (
    SELECT CASE
      WHEN "nv"."tien_do_ma" = 'HOAN_THANH' THEN 'HOAN_THANH'
      WHEN "nv"."loai_thoi_han_ma" = 'THUONG_XUYEN' THEN 'THUONG_XUYEN'
      WHEN "nv"."han_xu_ly" IS NULL AND "nv"."loai_thoi_han_ma" = 'CHO_QUYET_DINH' THEN 'CHO_DIEU_KIEN'
      WHEN "nv"."han_xu_ly" IS NULL THEN 'CAN_DIEN_HAN'
      WHEN "nv"."han_xu_ly" < "ngay" THEN 'QUA_HAN'
      WHEN "nv"."han_xu_ly" <= "ngay" + (SELECT nguong FROM ch) THEN 'SAP_DEN_HAN'
      ELSE 'DANG_THUC_HIEN' END AS trang_thai,
      EXISTS (SELECT 1 FROM "public"."dinh_chinh" d WHERE d."nhiem_vu_id" = "nv"."id" AND d."trang_thai" = 'CHO_DUYET') AS dang_dinh_chinh
  ), kq AS (
    SELECT CASE
      WHEN "nv"."tien_do_ma" <> 'HOAN_THANH' THEN NULL
      WHEN "nv"."ngay_hoan_thanh" IS NULL OR "nv"."han_xu_ly" IS NULL THEN 'KHONG_DANH_GIA'
      WHEN "nv"."ngay_hoan_thanh" <= "nv"."han_xu_ly" THEN 'DUNG_HAN'
      ELSE 'TRE' END AS ket_qua
  )
  SELECT ROW(
    tt.trang_thai,
    CASE WHEN tt.trang_thai = 'QUA_HAN' THEN ("ngay" - "nv"."han_xu_ly")::integer END,
    kq.ket_qua,
    CASE WHEN kq.ket_qua = 'TRE' THEN ("nv"."ngay_hoan_thanh" - "nv"."han_xu_ly")::integer END,
    CASE WHEN "nv"."tien_do_ma" = 'HOAN_THANH' AND "nv"."ngay_hoan_thanh" IS NOT NULL AND "nv"."dong_luc" IS NOT NULL
         THEN (("nv"."dong_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - "nv"."ngay_hoan_thanh")::integer END,
    tt.dang_dinh_chinh,
    CASE WHEN tt.trang_thai = 'QUA_HAN' AND tt.dang_dinh_chinh THEN 'DANG_DINH_CHINH' ELSE tt.trang_thai END,
    CASE tt.trang_thai
      WHEN 'QUA_HAN' THEN CASE WHEN ("ngay" - "nv"."han_xu_ly") >= (SELECT ddb FROM ch) THEN 'DO_DAC_BIET' ELSE 'DO' END
      WHEN 'SAP_DEN_HAN' THEN CASE WHEN ("nv"."han_xu_ly" - "ngay") <= (SELECT vang FROM ch)
                                    AND nullif(btrim(coalesce("nv"."minh_chung", '')), '') IS NULL THEN 'VANG' ELSE 'XANH' END
      WHEN 'DANG_THUC_HIEN' THEN 'XANH'
      ELSE 'KHONG_AP_DUNG' END,
    CASE WHEN "nv"."tien_do_ma" = 'HOAN_THANH' AND "nv"."ngay_hoan_thanh" IS NOT NULL AND NOT "nv"."ngay_nhan_uoc_tinh"
         THEN ("nv"."ngay_hoan_thanh" - "nv"."ngay_nhan_van_ban")::integer END
  )::"public"."trang_thai_kq"
  FROM tt, kq;
$$;

CREATE FUNCTION "public"."tinh_trang_thai"("p_id" uuid, "p_ngay" date DEFAULT "public"."kl_hom_nay"())
RETURNS "public"."trang_thai_kq"
LANGUAGE "sql" STABLE SET "search_path" = "public" AS $$
  SELECT "public"."trang_thai"(nv, "p_ngay") FROM "public"."nhiem_vu" nv WHERE nv."id" = "p_id";
$$;

-- Wrapper giữ chữ ký/kiểu cũ (v_kl_dashboard và test hiện có gọi): 7 trường đầu của trang_thai().
CREATE OR REPLACE FUNCTION "public"."kl_trang_thai"("nv" "public"."nhiem_vu", "ngay" date DEFAULT "public"."kl_hom_nay"())
RETURNS "public"."kl_trang_thai_kq"
LANGUAGE "sql" STABLE SET "search_path" = "public" AS $$
  SELECT ROW((r).trang_thai, (r).so_ngay_qua, (r).ket_qua, (r).so_ngay_tre, (r).do_tre_nhap_lieu, (r).dang_dinh_chinh, (r).nhom_dem)::"public"."kl_trang_thai_kq"
  FROM (SELECT "public"."trang_thai"("nv", "ngay") AS r) s;
$$;
CREATE OR REPLACE FUNCTION "public"."kl_tinh_trang_thai"("p_id" uuid, "p_ngay" date DEFAULT "public"."kl_hom_nay"())
RETURNS "public"."kl_trang_thai_kq"
LANGUAGE "sql" STABLE SET "search_path" = "public" AS $$
  SELECT "public"."kl_trang_thai"(nv, "p_ngay") FROM "public"."nhiem_vu" nv WHERE nv."id" = "p_id";
$$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['trang_thai(nhiem_vu,date)', 'tinh_trang_thai(uuid,date)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

-- View chính v3 (security_invoker; RLS nhiem_vu lọc dòng). Mọi số trạng thái/màu từ trang_thai(nv, kl_hom_nay()).
CREATE VIEW "public"."v_nhiem_vu"
WITH ("security_invoker" = true) AS
SELECT nv."id", nv."ma", nv."van_ban_id", vb."loai" AS "van_ban_loai", vb."so_hoi_nghi", vb."so_ket_luan", vb."ngay_ban_hanh", vb."ngay_nhan" AS "van_ban_ngay_nhan",
       nv."nguoi_theo_doi", td."full_name" AS "nguoi_theo_doi_ten", td."department" AS "nguoi_theo_doi_phong",
       nv."owner_don_vi_ma", dv."ten" AS "owner_don_vi_ten", dv."trong_van_phong" AS "owner_trong_van_phong", dv."phong" AS "owner_phong",
       nv."owner_tai_khoan", ow."full_name" AS "owner_tai_khoan_ten",
       nv."san_pham_loai", sp."ten" AS "san_pham_ten", nv."san_pham_mo_ta",
       nv."cap_nhan_san_pham", cn."ten" AS "cap_nhan_san_pham_ten", nv."cap_quyet_dinh", cq."ten" AS "cap_quyet_dinh_ten",
       nv."ngay_nhan_van_ban", nv."ngay_nhan_uoc_tinh", nv."nhiem_vu_cha", nv."theo_1400",
       nv."nganh_ma", dn."ten" AS "nganh_ten", nv."linh_vuc_ma", lv."ten" AS "linh_vuc_ten", nv."linh_vuc_chi_tiet",
       nv."noi_dung", nv."loai_thoi_han_ma", dl."ten" AS "loai_thoi_han_ten",
       nv."han_xu_ly", nv."ly_do_chua_co_han", nv."tien_do_ma", nv."ngay_hoan_thanh", nv."minh_chung",
       nv."van_ban_trien_khai", nv."so_lan_gia_han", nv."nguon", nv."ghi_chu", nv."thieu_minh_chung",
       nv."dong_luc", nv."cap_nhat_luc", nv."cap_nhat_boi", nv."tao_boi", nv."created_at",
       (tt).trang_thai, (tt).so_ngay_qua, (tt).ket_qua, (tt).so_ngay_tre, (tt).do_tre_nhap_lieu,
       (tt).dang_dinh_chinh, (tt).nhom_dem, (tt).muc_canh_bao, (tt).lead_time_ngay,
       ("public"."kl_hom_nay"() - vb."ngay_ban_hanh")::integer AS "tuoi_ngay",
       (SELECT count(*) FROM "public"."chi_dao" c WHERE c."nhiem_vu_id" = nv."id" AND c."trang_thai" = 'CHO_PHAN_HOI')::integer AS "so_chi_dao_cho_phan_hoi"
FROM "public"."nhiem_vu" nv
CROSS JOIN LATERAL (SELECT "public"."trang_thai"(nv, "public"."kl_hom_nay"()) AS tt) t
JOIN "public"."van_ban_giao_viec" vb ON vb."id" = nv."van_ban_id"
LEFT JOIN "public"."accounts_public" td ON td."id" = nv."nguoi_theo_doi"
LEFT JOIN "public"."accounts_public" ow ON ow."id" = nv."owner_tai_khoan"
LEFT JOIN "public"."dm_don_vi" dv ON dv."ma" = nv."owner_don_vi_ma"
LEFT JOIN "public"."dm_san_pham" sp ON sp."ma" = nv."san_pham_loai"
LEFT JOIN "public"."dm_cap" cn ON cn."ma" = nv."cap_nhan_san_pham"
LEFT JOIN "public"."dm_cap" cq ON cq."ma" = nv."cap_quyet_dinh"
LEFT JOIN "public"."dm_nganh" dn ON dn."ma" = nv."nganh_ma"
LEFT JOIN "public"."dm_linh_vuc" lv ON lv."ma" = nv."linh_vuc_ma"
LEFT JOIN "public"."dm_loai_thoi_han" dl ON dl."ma" = nv."loai_thoi_han_ma";

-- Bí danh tên cũ cho frontend hiện tại (một phát hành). kl_nhiem_vu/kl_hoi_nghi là view một bảng → tự cập nhật được.
CREATE VIEW "public"."kl_nhiem_vu" WITH ("security_invoker" = true) AS
SELECT "id", "ma", "van_ban_id" AS "hoi_nghi_id", "nguoi_theo_doi" AS "chu_tri_id", "nganh_ma", "owner_don_vi_ma" AS "co_quan_trinh_ma",
       "linh_vuc_chi_tiet", "noi_dung", "loai_thoi_han_ma", "han_xu_ly", "ly_do_chua_co_han", "tien_do_ma", "ngay_hoan_thanh", "minh_chung",
       "van_ban_trien_khai", "so_lan_gia_han", "nguon", "ghi_chu", "thieu_minh_chung", "dong_luc" AS "ghi_hoan_thanh_luc",
       "cap_nhat_luc", "cap_nhat_boi", "tao_boi", "created_at", "linh_vuc_ma", "owner_tai_khoan", "san_pham_loai", "san_pham_mo_ta",
       "cap_nhan_san_pham", "cap_quyet_dinh", "nhiem_vu_cha", "theo_1400", "ngay_nhan_van_ban", "ngay_nhan_uoc_tinh"
FROM "public"."nhiem_vu";
CREATE VIEW "public"."kl_hoi_nghi" WITH ("security_invoker" = true) AS
SELECT "id", "so_hoi_nghi", "so_ket_luan", "ngay_ban_hanh", "ghi_chu", "tao_boi", "created_at", "loai", "ngay_nhan", "co_quan_ban_hanh"
FROM "public"."van_ban_giao_viec";
CREATE VIEW "public"."kl_lich_su" WITH ("security_invoker" = true) AS
SELECT "id", "nhiem_vu_id", "luc", "nguoi_sua", "nguoi_sua_ghi_chu",
       CASE "cot" WHEN 'nguoi_theo_doi' THEN 'chu_tri_id' WHEN 'owner_don_vi_ma' THEN 'co_quan_trinh_ma' WHEN 'van_ban_id' THEN 'hoi_nghi_id' ELSE "cot" END AS "cot",
       "gia_tri_cu", "gia_tri_moi", "nguon", "dinh_chinh_id"
FROM "public"."lich_su";
CREATE VIEW "public"."kl_chi_dao" WITH ("security_invoker" = true) AS SELECT * FROM "public"."chi_dao";
CREATE VIEW "public"."kl_dinh_chinh" WITH ("security_invoker" = true) AS
SELECT "id", "nhiem_vu_id", "de_nghi_boi", CASE "cot" WHEN 'owner_don_vi_ma' THEN 'co_quan_trinh_ma' ELSE "cot" END AS "cot",
       "gia_tri_cu", "gia_tri_moi", "ly_do", "can_cu", "trang_thai", "duyet_boi", "duyet_luc", "ly_do_bac_bo", "created_at"
FROM "public"."dinh_chinh";
CREATE VIEW "public"."dm_co_quan_trinh" WITH ("security_invoker" = true) AS SELECT "ma", "ten", "thu_tu" FROM "public"."dm_don_vi";

REVOKE ALL ON TABLE "public"."v_nhiem_vu", "public"."kl_nhiem_vu", "public"."kl_hoi_nghi", "public"."kl_lich_su",
  "public"."kl_chi_dao", "public"."kl_dinh_chinh", "public"."dm_co_quan_trinh" FROM "anon";
GRANT SELECT ON TABLE "public"."v_nhiem_vu", "public"."kl_nhiem_vu", "public"."kl_hoi_nghi", "public"."kl_lich_su",
  "public"."kl_chi_dao", "public"."kl_dinh_chinh", "public"."dm_co_quan_trinh" TO "authenticated";
GRANT INSERT, UPDATE ON TABLE "public"."kl_nhiem_vu", "public"."kl_hoi_nghi" TO "authenticated";   -- quyền thật = policy bảng gốc
GRANT INSERT ON TABLE "public"."kl_chi_dao" TO "authenticated";
