-- 0134 (v3.35 — CAU-HOI nhóm U): quyền, trạng thái và các view của phân hệ Nhiệm vụ quý BTV (bảng ở 0132–0133). Quyền (chủ dự án 13/11/2026):
--   * Xem: mọi cán bộ đang hoạt động, toàn bộ (nvq_xem, 0133).
--   * Quản lý danh mục (tạo quý, văn bản căn cứ, nhập / sửa nhiệm vụ, phân công, điều chỉnh, chốt tuần, chốt quý): đầu mối tổng hợp (nvq_phan_quyen,
--     do Chánh Văn phòng / tài khoản toàn quyền / quản trị hệ thống chỉ định), Chánh Văn phòng, tài khoản toàn quyền — nvq_la_quan_ly.
--   * Cập nhật tiến độ (báo cáo tuần, kết quả / sản phẩm, số liệu, tệp, vướng mắc): chủ trì theo dõi (người cập nhật chính), phối hợp theo dõi, cán bộ của
--     phòng được giao theo dõi, Trưởng phòng của các đồng chí đó, lãnh đạo Văn phòng, người quản lý danh mục; kỳ chưa chốt, nhiệm vụ còn trong danh mục.
--   * Ý kiến chỉ đạo: Thường trực (A0), lãnh đạo Văn phòng, người quản lý danh mục; trao đổi / trả lời: thêm người được cập nhật.
-- Trạng thái nhiệm vụ do MỘT hàm tính (nvq_trang_thai) từ các kết quả / sản phẩm và hôm nay theo giờ Việt Nam; ngưỡng mức cảnh báo đọc kl_cau_hinh (cùng
-- nghĩa CV 1400: còn ≤ nguong_vang_ngay ngày — sắp đến hạn; quá hạn dưới / từ nguong_do_dac_biet_ngay ngày).

-- ---- 1. Hàm quyền ----
CREATE FUNCTION "public"."nvq_la_quan_ly"() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce("public"."me_is_chief"(), false) OR EXISTS (
    SELECT 1 FROM "public"."nvq_phan_quyen" p JOIN "public"."accounts" a ON a."id" = p."tai_khoan"
    WHERE p."tai_khoan" = "auth"."uid"() AND NOT coalesce(a."bi_khoa", false) AND a."role_group" <> 'A0' AND NOT a."is_system");
$$;
CREATE FUNCTION "public"."nvq_duoc_cap_nhat"("p" "public"."nvq_nhiem_vu") RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (SELECT * FROM "public"."accounts" WHERE "id" = "auth"."uid"() AND NOT coalesce("bi_khoa", false) AND "role_group" <> 'A0' AND NOT "is_system")
  SELECT coalesce((SELECT
      "p"."dieu_chinh" = 'TRONG_DANH_MUC'
      AND EXISTS (SELECT 1 FROM "public"."nvq_ky" k WHERE k."id" = "p"."ky_id" AND k."trang_thai" <> 'DA_CHOT')
      AND ("public"."nvq_la_quan_ly"() OR "public"."me_role"() = 'A1'
           OR "p"."chu_tri_theo_doi" = me."id" OR me."id" = ANY ("p"."phoi_hop_theo_doi")
           OR ("p"."phong_theo_doi" IS NOT NULL AND "p"."phong_theo_doi" = me."department")
           OR (me."role_group" = 'A2' AND EXISTS (SELECT 1 FROM "public"."accounts" x
                 WHERE (x."id" = "p"."chu_tri_theo_doi" OR x."id" = ANY ("p"."phoi_hop_theo_doi")) AND x."department" = me."department")))
    FROM me), false);
$$;
CREATE FUNCTION "public"."nvq_duoc_chi_dao"() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM "public"."accounts" a WHERE a."id" = "auth"."uid"() AND NOT coalesce(a."bi_khoa", false) AND NOT a."is_system"
                 AND a."role_group" IN ('A0', 'A1')) OR "public"."me_toan_quyen"() OR "public"."nvq_la_quan_ly"();
$$;
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['nvq_la_quan_ly()', 'nvq_duoc_cap_nhat(public.nvq_nhiem_vu)', 'nvq_duoc_chi_dao()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

-- Hồ sơ quyền của người đang đăng nhập (giao diện chỉ dùng để ẩn / hiện nút — quyền thật ở các hàm ghi).
CREATE FUNCTION "public"."nvq_quyen_cua_toi"() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('quan_ly', "public"."nvq_la_quan_ly"(), 'chi_dao', "public"."nvq_duoc_chi_dao"(),
    'dau_moi', EXISTS (SELECT 1 FROM "public"."nvq_phan_quyen" WHERE "tai_khoan" = "auth"."uid"()),
    'phan_quyen', coalesce("public"."me_is_chief"(), false) OR coalesce("public"."me_quan_tri_he_thong"(), false));
$$;
REVOKE ALL ON FUNCTION "public"."nvq_quyen_cua_toi"() FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."nvq_quyen_cua_toi"() TO "authenticated";

-- ---- 2. Tuần báo cáo của kỳ (kết thúc thứ Năm; tuần 1 tới thứ Năm đầu tiên ≥ ngày đầu quý + 6) ----
CREATE FUNCTION "public"."nvq_tao_tuan"("p_ky" uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k "public"."nvq_ky"; v_den date; v_tu date; v_so integer := 0;
BEGIN
  SELECT * INTO k FROM "public"."nvq_ky" WHERE "id" = "p_ky";
  IF k."id" IS NULL THEN RETURN 0; END IF;
  v_tu := k."tu_ngay";
  v_den := (k."tu_ngay" + 6) + ((4 - extract(isodow FROM k."tu_ngay" + 6)::integer + 7) % 7);
  LOOP
    v_so := v_so + 1;
    INSERT INTO "public"."nvq_tuan" ("ky_id", "so", "tu_ngay", "den_ngay", "han_luc")
    VALUES (k."id", v_so, v_tu, v_den, (v_den + time '11:00') AT TIME ZONE 'Asia/Ho_Chi_Minh')
    ON CONFLICT ("ky_id", "so") DO NOTHING;
    EXIT WHEN v_den >= k."den_ngay" OR v_so >= 30;
    v_tu := v_den + 1; v_den := v_den + 7;
  END LOOP;
  RETURN v_so;
END;
$$;
REVOKE ALL ON FUNCTION "public"."nvq_tao_tuan"(uuid) FROM public, "anon", "authenticated";
-- Tuần chứa một ngày (ngày trước tuần 1 → tuần 1; sau tuần cuối → tuần cuối).
CREATE FUNCTION "public"."nvq_tuan_cua"("p_ky" uuid, "p_ngay" date) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT "id" FROM "public"."nvq_tuan" WHERE "ky_id" = "p_ky" AND "p_ngay" BETWEEN "tu_ngay" AND "den_ngay"),
    (SELECT "id" FROM "public"."nvq_tuan" WHERE "ky_id" = "p_ky" AND "p_ngay" < "tu_ngay" ORDER BY "so" LIMIT 1),
    (SELECT "id" FROM "public"."nvq_tuan" WHERE "ky_id" = "p_ky" ORDER BY "so" DESC LIMIT 1));
$$;
REVOKE ALL ON FUNCTION "public"."nvq_tuan_cua"(uuid, date) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."nvq_tuan_cua"(uuid, date) TO "authenticated";

-- ---- 3. Trạng thái nhiệm vụ (nguồn duy nhất) ----
-- Đầu vào là số liệu tổng hợp các kết quả / sản phẩm của nhiệm vụ (sản phẩm "không thực hiện" không tính):
--   RUT (rút khỏi danh mục) → HOAN_THANH (mọi kết quả xong hoặc không phát sinh; ket_qua DUNG_TIEN_DO / CHAM_TIEN_DO theo kết quả xong sau mốc)
--   → CHAM_TIEN_DO (có kết quả chưa xong đã quá mốc) → THUONG_XUYEN (tính chất thường xuyên / khi phát sinh) → CHUA_TRIEN_KHAI (chưa kết quả nào
--   bắt đầu, chưa có cập nhật) → DANG_THUC_HIEN. Mức: DO_DAC_BIET / DO (quá mốc từ / dưới ngưỡng ngày), VANG (còn ≤ ngưỡng vàng), XANH, KHONG_AP_DUNG.
CREATE TYPE "public"."nvq_trang_thai_kq" AS ("trang_thai" text, "ket_qua" text, "muc" text, "so_ngay_qua" integer, "so_ngay_con" integer);
CREATE FUNCTION "public"."nvq_trang_thai"("p_dieu_chinh" text, "p_tinh_chat" text, "p_so_sp" integer, "p_so_xong" integer, "p_han_mo" date,
                                          "p_co_cham" boolean, "p_da_trien_khai" boolean, "p_co_cap_nhat" boolean, "p_hom_nay" date)
RETURNS "public"."nvq_trang_thai_kq" LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r "public"."nvq_trang_thai_kq"; v_vang integer; v_ddb integer;
BEGIN
  SELECT coalesce(max(CASE WHEN "khoa" = 'nguong_vang_ngay' THEN "gia_tri" END)::integer, 3),
         coalesce(max(CASE WHEN "khoa" = 'nguong_do_dac_biet_ngay' THEN "gia_tri" END)::integer, 3)
  INTO v_vang, v_ddb FROM "public"."kl_cau_hinh" WHERE "khoa" IN ('nguong_vang_ngay', 'nguong_do_dac_biet_ngay');
  IF "p_han_mo" IS NOT NULL THEN
    r."so_ngay_con" := "p_han_mo" - "p_hom_nay";
    IF "p_han_mo" < "p_hom_nay" THEN r."so_ngay_qua" := "p_hom_nay" - "p_han_mo"; END IF;
  END IF;
  IF "p_dieu_chinh" = 'RUT' THEN r."trang_thai" := 'RUT'; r."muc" := 'KHONG_AP_DUNG'; RETURN r; END IF;
  IF coalesce("p_so_sp", 0) > 0 AND "p_so_xong" >= "p_so_sp" THEN
    r."trang_thai" := 'HOAN_THANH'; r."muc" := 'KHONG_AP_DUNG';
    r."ket_qua" := CASE WHEN "p_co_cham" THEN 'CHAM_TIEN_DO' ELSE 'DUNG_TIEN_DO' END; r."so_ngay_qua" := NULL; r."so_ngay_con" := NULL;
    RETURN r;
  END IF;
  r."muc" := CASE WHEN r."so_ngay_qua" >= v_ddb THEN 'DO_DAC_BIET' WHEN r."so_ngay_qua" > 0 THEN 'DO'
                  WHEN r."so_ngay_con" BETWEEN 0 AND v_vang THEN 'VANG' ELSE 'XANH' END;
  r."trang_thai" := CASE WHEN r."so_ngay_qua" > 0 THEN 'CHAM_TIEN_DO'
                         WHEN "p_tinh_chat" IN ('THUONG_XUYEN', 'KHI_PHAT_SINH') THEN 'THUONG_XUYEN'
                         WHEN NOT coalesce("p_da_trien_khai", false) AND NOT coalesce("p_co_cap_nhat", false) THEN 'CHUA_TRIEN_KHAI'
                         ELSE 'DANG_THUC_HIEN' END;
  RETURN r;
END;
$$;
REVOKE ALL ON FUNCTION "public"."nvq_trang_thai"(text, text, integer, integer, date, boolean, boolean, boolean, date) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."nvq_trang_thai"(text, text, integer, integer, date, boolean, boolean, boolean, date) TO "authenticated";

-- ---- 4. Views (security_invoker — RLS của người xem) ----
CREATE VIEW "public"."v_nvq_san_pham" WITH (security_invoker = true) AS
SELECT s.*,
  CASE WHEN s."trang_thai" IN ('HOAN_THANH', 'KHONG_PHAT_SINH', 'KHONG_THUC_HIEN') THEN NULL
       WHEN s."han" < "public"."kl_hom_nay"() THEN "public"."kl_hom_nay"() - s."han" END AS "so_ngay_qua",
  CASE WHEN s."loai" = 'CHI_TIEU' AND s."muc_tieu" IS NOT NULL AND s."thuc_hien" IS NOT NULL THEN
    (CASE WHEN s."chieu" = 'THAP_HON_TOT' THEN s."thuc_hien" <= s."muc_tieu" ELSE s."thuc_hien" >= s."muc_tieu" END) END AS "dat_muc_tieu",
  CASE WHEN s."loai" = 'CHI_TIEU' AND coalesce(s."muc_tieu", 0) <> 0 AND s."thuc_hien" IS NOT NULL AND s."chieu" = 'CAO_HON_TOT'
       THEN round(100 * s."thuc_hien" / s."muc_tieu", 1) END AS "ty_le_muc_tieu"
FROM "public"."nvq_san_pham" s;

CREATE VIEW "public"."v_nvq_nhiem_vu" WITH (security_invoker = true) AS
WITH sp AS (
  SELECT "nhiem_vu_id",
    count(*) FILTER (WHERE "trang_thai" <> 'KHONG_THUC_HIEN')::integer AS so_sp,
    count(*) FILTER (WHERE "trang_thai" IN ('HOAN_THANH', 'KHONG_PHAT_SINH'))::integer AS so_xong,
    min("han") FILTER (WHERE "trang_thai" NOT IN ('HOAN_THANH', 'KHONG_PHAT_SINH', 'KHONG_THUC_HIEN')) AS han_mo,
    max("han") FILTER (WHERE "trang_thai" <> 'KHONG_THUC_HIEN') AS han_cuoi,
    max("ngay_hoan_thanh") AS ngay_xong_cuoi,
    coalesce(bool_or("trang_thai" = 'HOAN_THANH' AND "han" IS NOT NULL AND "ngay_hoan_thanh" > "han"), false) AS co_cham,
    coalesce(bool_or("trang_thai" NOT IN ('CHUA', 'KHONG_THUC_HIEN')), false) AS da_trien_khai
  FROM "public"."nvq_san_pham" GROUP BY "nhiem_vu_id"),
cn AS (
  SELECT c."nhiem_vu_id", count(*)::integer AS so_cap_nhat, max(c."tao_luc") AS cap_nhat_luc, max(c."ngay_bao_cao") AS ngay_bao_cao_cuoi,
    -- tuần báo cáo hiện tại của quý (sau tuần cuối: tuần cuối — nơi nvq_cap_nhat_gui ghi cập nhật mới)
    coalesce(bool_or(w."id" = "public"."nvq_tuan_cua"(w."ky_id", "public"."kl_hom_nay"())), false) AS cap_nhat_tuan_nay
  FROM "public"."nvq_cap_nhat" c LEFT JOIN "public"."nvq_tuan" w ON w."id" = c."tuan_id" GROUP BY c."nhiem_vu_id"),
yk AS (
  SELECT "nhiem_vu_id", count(*) FILTER (WHERE "loai" = 'CHI_DAO' AND "tra_loi_cho" IS NULL AND NOT "da_xong")::integer AS so_chi_dao_mo,
    count(*)::integer AS so_y_kien
  FROM "public"."nvq_y_kien" GROUP BY "nhiem_vu_id")
SELECT n.*,
  (CASE n."truc_so" WHEN 1 THEN 'I' WHEN 2 THEN 'II' WHEN 3 THEN 'III' WHEN 4 THEN 'IV' WHEN 5 THEN 'V' WHEN 6 THEN 'VI' WHEN 7 THEN 'VII'
     WHEN 8 THEN 'VIII' WHEN 9 THEN 'IX' ELSE n."truc_so"::text END) || '.' || CASE n."nhom" WHEN 'TRONG_CT' THEN '1' ELSE '2' END
    || '.(' || n."stt" || ')' AS "so_hieu",
  k."nam", k."quy", k."trang_thai" AS "ky_trang_thai", t."ten_ngan" AS "truc_ten_ngan",
  coalesce(sp.so_sp, 0) AS "so_san_pham", coalesce(sp.so_xong, 0) AS "so_xong",
  CASE WHEN coalesce(sp.so_sp, 0) > 0 THEN round(100.0 * sp.so_xong / sp.so_sp)::integer END AS "ty_le",
  sp.han_mo AS "han_gan_nhat", sp.han_cuoi AS "han_cuoi", sp.ngay_xong_cuoi AS "ngay_hoan_thanh",
  (x.tt)."trang_thai", (x.tt)."ket_qua", (x.tt)."muc", (x.tt)."so_ngay_qua", (x.tt)."so_ngay_con",
  coalesce(cn.so_cap_nhat, 0) AS "so_cap_nhat", cn.cap_nhat_luc AS "cap_nhat_cuoi_luc", cn.ngay_bao_cao_cuoi,
  coalesce(cn.cap_nhat_tuan_nay, false) AS "cap_nhat_tuan_nay",
  coalesce(yk.so_chi_dao_mo, 0) AS "so_chi_dao_mo", coalesce(yk.so_y_kien, 0) AS "so_y_kien",
  ct."full_name" AS "chu_tri_ten", ct."department" AS "chu_tri_phong"
FROM "public"."nvq_nhiem_vu" n
JOIN "public"."nvq_ky" k ON k."id" = n."ky_id"
JOIN "public"."nvq_truc" t ON t."so" = n."truc_so"
LEFT JOIN sp ON sp."nhiem_vu_id" = n."id"
LEFT JOIN cn ON cn."nhiem_vu_id" = n."id"
LEFT JOIN yk ON yk."nhiem_vu_id" = n."id"
LEFT JOIN "public"."accounts_public" ct ON ct."id" = n."chu_tri_theo_doi"
CROSS JOIN LATERAL (SELECT "public"."nvq_trang_thai"(n."dieu_chinh", n."tinh_chat", sp.so_sp, sp.so_xong, sp.han_mo, sp.co_cham, sp.da_trien_khai,
                                                    coalesce(cn.so_cap_nhat, 0) > 0, "public"."kl_hom_nay"()) AS tt) x;
GRANT SELECT ON "public"."v_nvq_nhiem_vu", "public"."v_nvq_san_pham" TO "authenticated";
REVOKE ALL ON "public"."v_nvq_nhiem_vu", "public"."v_nvq_san_pham" FROM "anon";

-- ---- 5. Hàm phụ cho các hàm ghi: lịch sử, tin báo ----
CREATE FUNCTION "public"."nvq_ghi_lich_su"("p_nv" uuid, "p_ky" uuid, "p_hanh_dong" text, "p_noi_dung" text, "p_chi_tiet" jsonb DEFAULT NULL) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO "public"."nvq_lich_su" ("nhiem_vu_id", "ky_id", "nguoi", "hanh_dong", "noi_dung", "chi_tiet")
  VALUES ("p_nv", coalesce("p_ky", (SELECT "ky_id" FROM "public"."nvq_nhiem_vu" WHERE "id" = "p_nv")), "auth"."uid"(), "p_hanh_dong", left("p_noi_dung", 2000), "p_chi_tiet");
$$;
REVOKE ALL ON FUNCTION "public"."nvq_ghi_lich_su"(uuid, uuid, text, text, jsonb) FROM public, "anon", "authenticated";
-- Tin hệ thống (chuông dùng chung) tới danh sách người nhận — bỏ người gửi, tài khoản khoá / hệ thống.
CREATE FUNCTION "public"."nvq_gui_tin"("p_nv" uuid, "p_nhan" uuid[], "p_noi_dung" text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_so integer;
BEGIN
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nvq_nhiem_vu_id")
  SELECT coalesce("auth"."uid"(), (SELECT c."id" FROM "public"."accounts" c WHERE c."is_chief" AND c."role_group" = 'A1' AND NOT c."is_system"
                                   ORDER BY c."username" LIMIT 1), a."id"), a."id", left("p_noi_dung", 1000), false, 'he_thong', "p_nv"
  FROM (SELECT DISTINCT x AS id FROM unnest("p_nhan") x WHERE x IS NOT NULL) u
  JOIN "public"."accounts" a ON a."id" = u.id
  WHERE (u.id IS DISTINCT FROM "auth"."uid"()) AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false);
  GET DIAGNOSTICS v_so = ROW_COUNT;
  RETURN v_so;
END;
$$;
REVOKE ALL ON FUNCTION "public"."nvq_gui_tin"(uuid, uuid[], text) FROM public, "anon", "authenticated";
-- Người theo dõi một nhiệm vụ (chủ trì + phối hợp + cán bộ phòng được giao) — người nhận tin khi có chỉ đạo, thay đổi do người khác làm.
CREATE FUNCTION "public"."nvq_nguoi_theo_doi"("p_nv" uuid) RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(DISTINCT x), '{}') FROM (
    SELECT n."chu_tri_theo_doi" AS x FROM "public"."nvq_nhiem_vu" n WHERE n."id" = "p_nv"
    UNION SELECT unnest(n."phoi_hop_theo_doi") FROM "public"."nvq_nhiem_vu" n WHERE n."id" = "p_nv"
    UNION SELECT a."id" FROM "public"."nvq_nhiem_vu" n JOIN "public"."accounts" a ON a."department" = n."phong_theo_doi"
          WHERE n."id" = "p_nv" AND n."phong_theo_doi" IS NOT NULL AND n."chu_tri_theo_doi" IS NULL AND a."role_group" IN ('A2', 'A3')) t WHERE x IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION "public"."nvq_nguoi_theo_doi"(uuid) FROM public, "anon", "authenticated";

-- ---- 6. Kho tệp nvq-tep: đường dẫn "<nhiệm vụ>/<tên>" ----
CREATE FUNCTION "public"."nvq_tep_nhiem_vu"("p_ten" text) RETURNS uuid
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN split_part("p_ten", '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              AND split_part("p_ten", '/', 2) <> '' AND split_part("p_ten", '/', 3) = '' THEN split_part("p_ten", '/', 1)::uuid END;
$$;
CREATE FUNCTION "public"."nvq_tep_duoc_tai"("p_ten" text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT "public"."nvq_duoc_cap_nhat"(n) FROM "public"."nvq_nhiem_vu" n WHERE n."id" = "public"."nvq_tep_nhiem_vu"("p_ten")), false);
$$;
CREATE FUNCTION "public"."nvq_tep_da_gan"("p_ten" text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM "public"."nvq_tep" WHERE "duong_dan" = "p_ten");
$$;
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['nvq_tep_nhiem_vu(text)', 'nvq_tep_duoc_tai(text)', 'nvq_tep_da_gan(text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
CREATE POLICY "nvq_tep_doc" ON "storage"."objects" FOR SELECT TO "authenticated"
  USING ("bucket_id" = 'nvq-tep' AND (SELECT "public"."nvq_xem"()));
CREATE POLICY "nvq_tep_tai_len" ON "storage"."objects" FOR INSERT TO "authenticated"
  WITH CHECK ("bucket_id" = 'nvq-tep' AND "public"."nvq_tep_duoc_tai"("name"));
CREATE POLICY "nvq_tep_xoa" ON "storage"."objects" FOR DELETE TO "authenticated"
  USING ("bucket_id" = 'nvq-tep' AND "owner_id" = (SELECT "auth"."uid"())::text AND NOT "public"."nvq_tep_da_gan"("objects"."name"));
