-- 0128 (v3.31, chủ dự án quyết 23/10/2026 — CAU-HOI Q-1…Q-4, thay CH-2, N-2): bỏ vai "Người theo dõi", chỉ còn "Chủ trì theo dõi".
-- Cột nhiem_vu.nguoi_theo_doi (NOT NULL, mọi hàm quyền / thông báo / phạm vi đang đọc) giữ làm TRƯỜNG NỘI BỘ = người đại diện của chủ trì:
--   cán bộ chủ trì (owner_tai_khoan); chủ trì là phòng → Trưởng phòng; chủ trì là "Văn phòng Tỉnh ủy" → Chánh Văn phòng (như gợi ý goiYTheoDoi của
--   biểu mẫu giao việc và luồng Thường trực giao 0101); đơn vị ngoài Văn phòng (dữ liệu chuyển đổi cũ) hoặc phòng chưa có Trưởng phòng → giữ giá trị.
-- (1) kl_dai_dien_chu_tri; (2) trigger ab_nhiem_vu_theo_doi_chu_tri (BEFORE, sau hai trigger chặn a_/aa_, trước b_…): mọi đường ghi chủ trì / đơn vị /
-- người theo dõi tự đúng — giao_viec (một, nhiều thẻ), Thường trực giao, chuyên viên giao thẳng, chi_dao_gui GIAO_LAI, doi_chu_tri, nhập Excel, bổ sung,
-- sửa toàn quyền — không sửa từng hàm (tham số người theo dõi cũ vẫn nhận, bị ghi đè); (3) căn dữ liệu cũ một lần (production 23/10: 7 việc);
-- (4) kl_duoc_nghiem_thu bỏ nhánh "người theo dõi" — chủ trì không tự trả lại / đánh giá minh chứng việc mình (người giao — kl_la_tang_giao 0090,
-- lãnh đạo trong phạm vi gồm Trưởng phòng, quản trị nhiệm vụ giữ nguyên); (5) admin_chuyen_theo_doi chuyển CHỦ TRÌ THEO DÕI các việc đang mở.

-- ---- 1. Người đại diện của chủ trì ----
CREATE OR REPLACE FUNCTION "public"."kl_dai_dien_chu_tri"("p_owner_tai_khoan" uuid, "p_owner_don_vi_ma" text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN "p_owner_tai_khoan" IS NOT NULL THEN "p_owner_tai_khoan" ELSE (
    SELECT CASE WHEN dv."phong" IS NOT NULL THEN
             (SELECT a."id" FROM "public"."accounts" a WHERE a."role_group" = 'A2' AND a."department" = dv."phong"
                AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false) ORDER BY a."username" LIMIT 1)
           ELSE (SELECT a."id" FROM "public"."accounts" a WHERE a."role_group" = 'A1' AND a."is_chief"
                   AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false) ORDER BY a."username" LIMIT 1) END
    FROM "public"."dm_don_vi" dv WHERE dv."ma" = "p_owner_don_vi_ma" AND dv."trong_van_phong") END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_dai_dien_chu_tri"(uuid, text) FROM public, "anon", "authenticated";

-- ---- 2. Trigger: người theo dõi luôn = người đại diện của chủ trì ----
CREATE OR REPLACE FUNCTION "public"."kl_nhiem_vu_theo_doi_chu_tri"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v uuid := "public"."kl_dai_dien_chu_tri"(NEW."owner_tai_khoan", NEW."owner_don_vi_ma");
BEGIN
  IF v IS NOT NULL THEN NEW."nguoi_theo_doi" := v; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_nhiem_vu_theo_doi_chu_tri"() FROM public, "anon", "authenticated";
DROP TRIGGER IF EXISTS "ab_nhiem_vu_theo_doi_chu_tri" ON "public"."nhiem_vu";
CREATE TRIGGER "ab_nhiem_vu_theo_doi_chu_tri" BEFORE INSERT OR UPDATE OF "owner_tai_khoan", "owner_don_vi_ma", "nguoi_theo_doi" ON "public"."nhiem_vu"
  FOR EACH ROW EXECUTE FUNCTION "public"."kl_nhiem_vu_theo_doi_chu_tri"();

-- ---- 3. Căn dữ liệu cũ một lần (như 0077, 0087: tắt trigger người dùng trong lúc ghi — không kiểm lại quy tắc cũ, không tin báo); lịch sử ghi
-- tay một dòng mỗi việc (nguoi_sua NULL, ghi chú "Hệ thống — v3.31"); Diễn biến không hiện cột người theo dõi.
DO $$
DECLARE v_so integer;
BEGIN
  CREATE TEMP TABLE "can_0128" ON COMMIT DROP AS
    SELECT n."id", n."nguoi_theo_doi" AS cu, "public"."kl_dai_dien_chu_tri"(n."owner_tai_khoan", n."owner_don_vi_ma") AS moi FROM "public"."nhiem_vu" n;
  DELETE FROM "can_0128" WHERE moi IS NULL OR moi IS NOT DISTINCT FROM cu;
  ALTER TABLE "public"."nhiem_vu" DISABLE TRIGGER USER;
  UPDATE "public"."nhiem_vu" n SET "nguoi_theo_doi" = c.moi FROM "can_0128" c WHERE c."id" = n."id";
  GET DIAGNOSTICS v_so = ROW_COUNT;
  ALTER TABLE "public"."nhiem_vu" ENABLE TRIGGER USER;
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "nguoi_sua_ghi_chu", "cot", "gia_tri_cu", "gia_tri_moi", "nguon")
  SELECT c."id", NULL, 'Hệ thống — v3.31: người theo dõi theo chủ trì theo dõi', 'nguoi_theo_doi', c.cu::text, c.moi::text, 'app' FROM "can_0128" c;
  RAISE NOTICE '0128: % việc đổi người theo dõi cho khớp chủ trì theo dõi', v_so;
END;
$$;

-- ---- 4. Trả lại / đánh giá minh chứng: bản 0061 bỏ nhánh "người theo dõi" (người theo dõi nay là chính chủ trì) ----
CREATE OR REPLACE FUNCTION "public"."kl_duoc_nghiem_thu"("p_nhiem_vu" uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((
    SELECT "auth"."uid"() IS NOT NULL AND NOT "public"."me_la_a0"() AND CASE
      WHEN "public"."kl_viec_a0_giao_cvp"(n) THEN   -- Q8 (0061): đúng người nhận nhắc chính — thư ký, không có thì quan_tri_kl; không bao giờ là Chánh VP chủ trì
        "auth"."uid"() = ANY ("public"."nguoi_nghiem_thu_chinh"(n,
          (SELECT m."nop_boi" FROM "public"."minh_chung" m WHERE m."nhiem_vu_id" = n."id" ORDER BY m."nop_luc" DESC LIMIT 1)))
      ELSE "public"."kl_duoc_chi_dao"(n."id") OR "public"."me_quan_tri_kl"() END   -- 0128: bỏ n.nguoi_theo_doi = tôi
    FROM "public"."nhiem_vu" n WHERE n."id" = "p_nhiem_vu"), false);
$$;

-- ---- 5. Quản trị › "Chuyển việc đang chủ trì theo dõi" (bản 0092, J-6): khi đổi người, chuyển một lượt mọi việc ĐANG MỞ do người cũ chủ trì
-- theo dõi sang người mới — việc người cũ là cán bộ chủ trì: đổi chủ trì, đơn vị, cấp nhận như doi_chu_tri (0124); việc giao cho phòng / Văn phòng
-- mà người cũ là người đại diện (Trưởng phòng, Chánh Văn phòng cũ): ghi lại để trigger tính theo người đang giữ chức (đổi chức danh ở Quản trị ›
-- Tài khoản trước) — chỉ nhận khi kết quả đúng là người mới, không thì giữ nguyên việc đó và báo "bỏ qua" kèm lý do. Lý do bắt buộc, xem trước số
-- việc; lịch sử từng việc, một tin cho người mới, nhật ký.
CREATE OR REPLACE FUNCTION "public"."admin_chuyen_theo_doi"("p_tu" uuid, "p_den" uuid, "p_ly_do" text, "p_thuc_hien" boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tu "public"."accounts"; v_den "public"."accounts"; v_dv "public"."dm_don_vi"; v_ly_do text := btrim(coalesce("p_ly_do", ''));
        v_ids uuid[]; v_ma text[]; v_ct boolean[]; v_xong text[] := '{}'; v_bo jsonb := '[]'::jsonb; v_sau uuid;
BEGIN
  IF NOT ("public"."me_quan_tri_he_thong"() OR "public"."la_chanh_van_phong"()) THEN
    RAISE EXCEPTION 'Chỉ quản trị hệ thống hoặc Chánh Văn phòng mới chuyển việc chủ trì theo dõi.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_tu FROM "public"."accounts" WHERE "id" = "p_tu";
  SELECT * INTO v_den FROM "public"."accounts" WHERE "id" = "p_den";
  IF v_tu."id" IS NULL OR v_den."id" IS NULL OR v_tu."id" = v_den."id" THEN RAISE EXCEPTION 'Chọn người cũ và người nhận khác nhau.' USING ERRCODE = '22023'; END IF;
  IF v_den."is_system" OR coalesce(v_den."bi_khoa", false) OR v_den."role_group" = 'A0' THEN
    RAISE EXCEPTION 'Người nhận phải là cán bộ Văn phòng đang hoạt động.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_dv FROM "public"."dm_don_vi" WHERE "trong_van_phong" AND "phong" IS NOT DISTINCT FROM v_den."department" LIMIT 1;
  IF v_dv."ma" IS NULL AND v_den."role_group" = 'A1' THEN SELECT * INTO v_dv FROM "public"."dm_don_vi" WHERE "ma" = 'VAN_PHONG_TINH_UY'; END IF;
  IF v_dv."ma" IS NULL THEN RAISE EXCEPTION 'Không xác định được đơn vị (phòng) của người nhận.' USING ERRCODE = '22023'; END IF;
  SELECT coalesce(array_agg("id" ORDER BY "ma"), '{}'), coalesce(array_agg("ma" ORDER BY "ma"), '{}'), coalesce(array_agg("owner_tai_khoan" IS NOT NULL ORDER BY "ma"), '{}')
    INTO v_ids, v_ma, v_ct
  FROM "public"."nhiem_vu" WHERE "tien_do_ma" <> 'HOAN_THANH' AND "dong_luc" IS NULL
    AND ("owner_tai_khoan" = v_tu."id" OR ("owner_tai_khoan" IS NULL AND "nguoi_theo_doi" = v_tu."id"));
  IF NOT coalesce("p_thuc_hien", false) THEN RETURN jsonb_build_object('so_viec', cardinality(v_ids), 'ma', to_jsonb(v_ma[1:20])); END IF;
  IF v_ly_do = '' OR char_length(v_ly_do) > 500 THEN RAISE EXCEPTION 'Lý do bắt buộc, tối đa 500 ký tự.' USING ERRCODE = '22023'; END IF;
  IF cardinality(v_ids) = 0 THEN RETURN jsonb_build_object('so_viec', 0, 'ma', '[]'::jsonb, 'bo_qua', '[]'::jsonb); END IF;
  -- Từng việc một khối con: việc lệch ràng buộc nghiệp vụ giữ nguyên, trả mã + lý do.
  FOR i IN 1 .. cardinality(v_ids) LOOP
    BEGIN
      PERFORM set_config('kl.ghi_qua_ham', '1', true);
      IF v_ct[i] THEN
        UPDATE "public"."nhiem_vu" SET "owner_tai_khoan" = v_den."id", "owner_don_vi_ma" = v_dv."ma",
          "cap_nhan_san_pham" = "public"."kl_cap_nhan_mac_dinh"(v_den, v_dv) WHERE "id" = v_ids[i];
      ELSE
        UPDATE "public"."nhiem_vu" SET "nguoi_theo_doi" = v_den."id" WHERE "id" = v_ids[i] RETURNING "nguoi_theo_doi" INTO v_sau;   -- trigger 0128 tính lại
      END IF;
      PERFORM set_config('kl.ghi_qua_ham', '', true);
      IF NOT v_ct[i] AND v_sau IS DISTINCT FROM v_den."id" THEN   -- lỗi trong khối con: thay đổi của việc này được hoàn lại
        RAISE EXCEPTION 'Việc giao cho phòng / Văn phòng: người nhận thay là người đang giữ chức Trưởng phòng / Chánh Văn phòng%s — đổi chức danh ở Quản trị › Tài khoản trước.',
          CASE WHEN v_sau IS DISTINCT FROM v_tu."id" THEN coalesce(' (' || (SELECT a."full_name" FROM "public"."accounts" a WHERE a."id" = v_sau) || ')', '') ELSE '' END;
      END IF;
      INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon")
      VALUES (v_ids[i], "auth"."uid"(), 'chuyen_theo_doi', v_tu."full_name", format('Chuyển chủ trì theo dõi từ %s sang %s — lý do: %s', v_tu."full_name", v_den."full_name", v_ly_do), 'app');
      v_xong := v_xong || v_ma[i];
    EXCEPTION WHEN OTHERS THEN
      v_bo := v_bo || jsonb_build_object('ma', v_ma[i], 'loi', SQLERRM);
    END;
  END LOOP;
  PERFORM set_config('kl.ghi_qua_ham', '', true);
  v_ma := v_xong;
  IF cardinality(v_ma) = 0 THEN RETURN jsonb_build_object('so_viec', 0, 'ma', '[]'::jsonb, 'bo_qua', v_bo); END IF;
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  VALUES ("auth"."uid"(), v_den."id", format('Đồng chí được giao chủ trì theo dõi %s nhiệm vụ đang mở (trước do %s chủ trì theo dõi): %s%s — lý do: %s', cardinality(v_ma), v_tu."full_name",
          array_to_string(v_ma[1:10], ', '), CASE WHEN cardinality(v_ma) > 10 THEN ', …' ELSE '' END, v_ly_do), false, 'he_thong', NULL);
  PERFORM "public"."nhat_ky_ghi"('chuyen_theo_doi', v_den."username",
    jsonb_build_object('tu', v_tu."username", 'den', v_den."username", 'so_viec', cardinality(v_ma), 'bo_qua', jsonb_array_length(v_bo), 'ly_do', v_ly_do));
  RETURN jsonb_build_object('so_viec', cardinality(v_ma), 'ma', to_jsonb(v_ma[1:20]), 'bo_qua', v_bo);
END;
$$;
REVOKE ALL ON FUNCTION "public"."admin_chuyen_theo_doi"(uuid, uuid, text, boolean) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."admin_chuyen_theo_doi"(uuid, uuid, text, boolean) TO "authenticated";
