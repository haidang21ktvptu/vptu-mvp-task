-- GĐ14 (PR 14C) — Giao việc thống nhất theo 1400 (docs/SPEC.md v3 GV-1…GV-6, LO-TRINH 14C). Mã thước đo trong ngoặc.
-- 1. Năm dòng phòng của Văn phòng vào danh mục đơn vị (NT-1, CH-1, CH-3: "Owner là phòng" cùng một cột). Tên theo DEPT_NAMES.
INSERT INTO "public"."dm_don_vi" ("ma", "ten", "thu_tu", "trong_van_phong", "phong") VALUES
  ('TONG_HOP', 'Phòng Tổng hợp', 14, true, 'TONG_HOP'), ('HC_LT', 'Phòng Hành chính - Lưu trữ', 15, true, 'HC_LT'),
  ('CDS_CY', 'Phòng Chuyển đổi số - Cơ yếu', 16, true, 'CDS_CY'), ('TAI_CHINH_DANG', 'Phòng Tài chính Đảng', 17, true, 'TAI_CHINH_DANG'),
  ('QUAN_TRI', 'Phòng Quản trị', 18, true, 'QUAN_TRI')
ON CONFLICT ("ma") DO NOTHING;

-- 2. Văn bản giao việc tổng quát (CH-14): số hội nghị chỉ bắt buộc với KL_BTV (khoá cũ (số hội nghị, số hiệu) giữ nguyên);
--    văn bản không có số hội nghị duy nhất theo (loại, số hiệu, ngày ban hành).
ALTER TABLE "public"."van_ban_giao_viec" ALTER COLUMN "so_hoi_nghi" DROP NOT NULL;
ALTER TABLE "public"."van_ban_giao_viec"
  ADD CONSTRAINT "van_ban_giao_viec_kl_btv_co_so_hoi_nghi" CHECK ("loai" <> 'KL_BTV' OR "so_hoi_nghi" IS NOT NULL);
CREATE UNIQUE INDEX "van_ban_giao_viec_loai_so_hieu_ngay_idx" ON "public"."van_ban_giao_viec" ("loai", "so_ket_luan", "ngay_ban_hanh")
  WHERE "so_hoi_nghi" IS NULL;

-- 3. Phạm vi đọc thêm nhánh Owner (NT-1; quy tắc 7 CLAUDE.md giữ nguyên): A3 thấy việc mình là Owner hoặc người theo dõi;
--    A2 thấy việc Owner (tài khoản thuộc phòng / dòng phòng) hoặc người theo dõi thuộc phòng mình; PCVP: phòng của Owner đi qua
--    cùng quy tắc phụ trách/kiêm nhiệm như phòng người theo dõi; Chánh VP và quan_tri_kl không đổi.
CREATE FUNCTION "public"."kl_phong_owner"("p_owner_tai_khoan" uuid, "p_owner_don_vi_ma" text) RETURNS text
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT coalesce((SELECT "department" FROM "public"."accounts" WHERE "id" = "p_owner_tai_khoan"),
                  (SELECT "phong" FROM "public"."dm_don_vi" WHERE "ma" = "p_owner_don_vi_ma"));
$$;
-- Nhánh PCVP cho một phòng (thân 0019): kiêm nhiệm (phòng, ngành, lĩnh vực) là tôi → thấy; người khác → không; không ai → phụ trách cả phòng.
CREATE FUNCTION "public"."kl_pham_vi_pcvp"("p_phong" text, "p_nganh_ma" text, "p_linh_vuc_ma" text) RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT "p_phong" IS NOT NULL AND coalesce((
    SELECT CASE WHEN kn."id" IS NOT NULL THEN kn."id" = "auth"."uid"()
                ELSE "public"."phu_trach"("auth"."uid"(), "p_phong", "public"."kl_hom_nay"()) END
    FROM (SELECT "public"."nguoi_kiem_nhiem"("p_phong", "p_nganh_ma", "p_linh_vuc_ma", "public"."kl_hom_nay"()) AS "id") kn), false);
$$;

DROP POLICY "kl_nhiem_vu_select" ON "public"."nhiem_vu";
DROP POLICY "kl_hoi_nghi_select" ON "public"."van_ban_giao_viec";
DROP FUNCTION "public"."kl_pham_vi"(uuid, text, text);
CREATE FUNCTION "public"."kl_pham_vi"("p_nguoi_theo_doi" uuid, "p_nganh_ma" text, "p_linh_vuc_ma" text,
                                       "p_owner_tai_khoan" uuid, "p_owner_don_vi_ma" text) RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT "auth"."uid"() IS NOT NULL AND (
    "public"."me_quan_tri_kl"()
    OR "p_nguoi_theo_doi" = "auth"."uid"() OR "p_owner_tai_khoan" = "auth"."uid"()
    OR CASE "public"."me_role"()
         WHEN 'A1' THEN "public"."me_is_chief"()
                        OR "public"."kl_pham_vi_pcvp"((SELECT "department" FROM "public"."accounts" WHERE "id" = "p_nguoi_theo_doi"), "p_nganh_ma", "p_linh_vuc_ma")
                        OR "public"."kl_pham_vi_pcvp"("public"."kl_phong_owner"("p_owner_tai_khoan", "p_owner_don_vi_ma"), "p_nganh_ma", "p_linh_vuc_ma")
         WHEN 'A2' THEN "public"."in_my_dept"("p_nguoi_theo_doi")
                        OR "public"."kl_phong_owner"("p_owner_tai_khoan", "p_owner_don_vi_ma") = "public"."me_dept"()
         ELSE false END
  );
$$;
CREATE OR REPLACE FUNCTION "public"."kl_thay_nhiem_vu"("p_id" uuid) RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT EXISTS (SELECT 1 FROM "public"."nhiem_vu" n WHERE n."id" = "p_id"
                 AND "public"."kl_pham_vi"(n."nguoi_theo_doi", n."nganh_ma", n."linh_vuc_ma", n."owner_tai_khoan", n."owner_don_vi_ma"));
$$;
CREATE POLICY "nhiem_vu_select" ON "public"."nhiem_vu" FOR SELECT TO "authenticated"
  USING ((SELECT "public"."kl_pham_vi"("nguoi_theo_doi", "nganh_ma", "linh_vuc_ma", "owner_tai_khoan", "owner_don_vi_ma")));
CREATE POLICY "van_ban_giao_viec_select" ON "public"."van_ban_giao_viec" FOR SELECT TO "authenticated"
  USING ((SELECT "public"."me_quan_tri_kl"())
         OR EXISTS (SELECT 1 FROM "public"."nhiem_vu" n WHERE n."van_ban_id" = "van_ban_giao_viec"."id"
                    AND "public"."kl_pham_vi"(n."nguoi_theo_doi", n."nganh_ma", n."linh_vuc_ma", n."owner_tai_khoan", n."owner_don_vi_ma")));
DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['kl_phong_owner(uuid,text)', 'kl_pham_vi_pcvp(text,text,text)', 'kl_pham_vi(uuid,text,text,uuid,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

-- 4. Người theo dõi HOẶC Owner tài khoản tự cập nhật (policy); cột cho phép thêm Product/cấp/ngày nhận (guard 0015/0023).
DROP POLICY "kl_nhiem_vu_update_chu_tri" ON "public"."nhiem_vu";
CREATE POLICY "nhiem_vu_update_owner_hoac_theo_doi" ON "public"."nhiem_vu" FOR UPDATE TO "authenticated"
  USING ("nguoi_theo_doi" = (SELECT "auth"."uid"()) OR "owner_tai_khoan" = (SELECT "auth"."uid"()))
  WITH CHECK ("nguoi_theo_doi" = (SELECT "auth"."uid"()) OR "owner_tai_khoan" = (SELECT "auth"."uid"()));
CREATE OR REPLACE FUNCTION "public"."kl_nhiem_vu_guard_a3"() RETURNS trigger
LANGUAGE "plpgsql" SET "search_path" = "public" AS $$
DECLARE loai text[] := ARRAY['tien_do_ma', 'han_xu_ly', 'ly_do_chua_co_han', 'ngay_hoan_thanh', 'minh_chung', 'van_ban_trien_khai', 'ghi_chu',
                              'san_pham_loai', 'san_pham_mo_ta', 'cap_nhan_san_pham', 'cap_quyet_dinh', 'ngay_nhan_van_ban', 'ngay_nhan_uoc_tinh',
                              'cap_nhat_luc', 'cap_nhat_boi', 'dong_luc', 'thieu_minh_chung'];
BEGIN
  IF "auth"."uid"() IS NULL OR "public"."me_quan_tri_kl"() THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW) - loai) IS DISTINCT FROM (to_jsonb(OLD) - loai) THEN
    RAISE EXCEPTION 'Người theo dõi/Owner chỉ được cập nhật tiến độ, hạn, ngày hoàn thành, minh chứng, sản phẩm, cấp, ngày nhận, văn bản triển khai, ghi chú.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- 5. giao_viec(p jsonb) → {id, ma}: một hàm, kiểm quyền GV-3 và 1-1-1 (CN-1.2) phía DB; thay assign_task (bỏ ở 18A).
--    p: van_ban_id | van_ban{loai, so_hoi_nghi, so_ket_luan, ngay_ban_hanh, ngay_nhan, co_quan_ban_hanh}; owner_don_vi_ma, owner_tai_khoan,
--    san_pham_loai, san_pham_mo_ta, cap_nhan_san_pham, cap_quyet_dinh, ngay_nhan_van_ban, noi_dung, loai_thoi_han_ma, han_xu_ly,
--    ly_do_chua_co_han, nganh_ma, linh_vuc_ma, linh_vuc_chi_tiet, van_ban_trien_khai, ghi_chu, nguoi_theo_doi (mặc định = người gọi), nhiem_vu_cha, theo_1400 (mặc định true).
CREATE FUNCTION "public"."giao_viec"("p" jsonb) RETURNS jsonb
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_me "public"."accounts"; v_vb "public"."van_ban_giao_viec"; v_dv "public"."dm_don_vi"; v_owner "public"."accounts";
        v_theo_doi "public"."accounts"; v_1400 boolean := coalesce(("p" ->> 'theo_1400')::boolean, true);
        v_phong_owner text; v_loai_han text := coalesce("p" ->> 'loai_thoi_han_ma', 'CO_HAN_CU_THE'); v_cap text; v_id uuid; v_ma text;
BEGIN
  SELECT * INTO v_me FROM "public"."accounts" WHERE "id" = "auth"."uid"();
  IF v_me."id" IS NULL OR (v_me."role_group" NOT IN ('A1', 'A2') AND NOT v_me."quan_tri_kl") THEN
    RAISE EXCEPTION 'Chỉ lãnh đạo Văn phòng, trưởng phòng hoặc người quản trị KL mới được giao việc.' USING ERRCODE = '42501';
  END IF;
  -- Văn bản giao việc (GV-1, QT-1): có sẵn hoặc tạo mới trong hàm (A1/A2 không có policy INSERT văn bản).
  IF nullif("p" ->> 'van_ban_id', '') IS NOT NULL THEN
    SELECT * INTO v_vb FROM "public"."van_ban_giao_viec" WHERE "id" = ("p" ->> 'van_ban_id')::uuid;
    IF v_vb."id" IS NULL THEN RAISE EXCEPTION 'Không tìm thấy văn bản giao việc.' USING ERRCODE = '22023'; END IF;
  ELSIF "p" ? 'van_ban' THEN
    INSERT INTO "public"."van_ban_giao_viec" ("loai", "so_hoi_nghi", "so_ket_luan", "ngay_ban_hanh", "ngay_nhan", "co_quan_ban_hanh", "tao_boi")
    VALUES (coalesce("p" #>> '{van_ban,loai}', 'KHAC'), ("p" #>> '{van_ban,so_hoi_nghi}')::integer, btrim("p" #>> '{van_ban,so_ket_luan}'),
            ("p" #>> '{van_ban,ngay_ban_hanh}')::date, ("p" #>> '{van_ban,ngay_nhan}')::date, nullif(btrim("p" #>> '{van_ban,co_quan_ban_hanh}'), ''), v_me."id")
    RETURNING * INTO v_vb;
  ELSE
    RAISE EXCEPTION 'Nhiệm vụ phải gắn với một văn bản giao việc.' USING ERRCODE = '22023';
  END IF;
  -- Owner (NT-1): đơn vị bắt buộc với việc theo 1400; tài khoản khớp đơn vị do trigger bb_ kiểm.
  SELECT * INTO v_dv FROM "public"."dm_don_vi" WHERE "ma" = "p" ->> 'owner_don_vi_ma';
  IF v_1400 AND v_dv."ma" IS NULL THEN
    RAISE EXCEPTION 'Nhiệm vụ phải có một Owner chịu trách nhiệm (đơn vị, phòng hoặc cán bộ) — nguyên tắc 1 Owner.' USING ERRCODE = '22023';
  END IF;
  IF nullif("p" ->> 'owner_tai_khoan', '') IS NOT NULL THEN
    SELECT * INTO v_owner FROM "public"."accounts" WHERE "id" = ("p" ->> 'owner_tai_khoan')::uuid;
    IF v_owner."id" IS NULL OR v_owner."is_system" THEN RAISE EXCEPTION 'Tài khoản Owner không hợp lệ.' USING ERRCODE = '22023'; END IF;
  END IF;
  v_phong_owner := coalesce(v_owner."department", v_dv."phong");
  -- Người theo dõi (CH-2): mặc định người giao; phải là cán bộ Văn phòng trong phạm vi người giao (bổ sung 3 của chủ dự án).
  SELECT * INTO v_theo_doi FROM "public"."accounts" WHERE "id" = coalesce(nullif("p" ->> 'nguoi_theo_doi', '')::uuid, v_me."id");
  IF v_theo_doi."id" IS NULL OR v_theo_doi."is_system" THEN RAISE EXCEPTION 'Người theo dõi phải là một cán bộ Văn phòng.' USING ERRCODE = '22023'; END IF;
  -- Quyền theo Owner (GV-3): quan_tri_kl mọi Owner; Chánh VP mọi Owner trong Văn phòng; PCVP phòng/cán bộ được phân công;
  -- A2 chỉ chuyên viên phòng mình; Owner đơn vị ngoài chỉ quan_tri_kl nhập.
  IF NOT v_me."quan_tri_kl" THEN
    IF v_dv."ma" IS NOT NULL AND NOT v_dv."trong_van_phong" THEN
      RAISE EXCEPTION 'Việc có Owner là đơn vị ngoài Văn phòng chỉ người quản trị KL nhập theo kết luận.' USING ERRCODE = '42501';
    ELSIF v_me."role_group" = 'A2' THEN
      IF v_owner."id" IS NULL OR v_owner."role_group" <> 'A3' OR v_owner."department" IS DISTINCT FROM v_me."department" THEN
        RAISE EXCEPTION 'Trưởng phòng chỉ giao việc cho chuyên viên phòng mình.' USING ERRCODE = '42501';
      END IF;
      IF v_theo_doi."id" <> v_me."id" AND v_theo_doi."department" IS DISTINCT FROM v_me."department" THEN
        RAISE EXCEPTION 'Người theo dõi phải thuộc phòng của đồng chí.' USING ERRCODE = '42501';
      END IF;
    ELSIF NOT v_me."is_chief" THEN
      IF v_phong_owner IS NULL OR NOT "public"."phu_trach"(v_me."id", v_phong_owner, "public"."kl_hom_nay"()) THEN
        RAISE EXCEPTION 'Phó Chánh Văn phòng chỉ giao việc cho phòng, cán bộ được phân công phụ trách.' USING ERRCODE = '42501';
      END IF;
      IF v_theo_doi."id" <> v_me."id" AND NOT "public"."phu_trach"(v_me."id", v_theo_doi."department", "public"."kl_hom_nay"()) THEN
        RAISE EXCEPTION 'Người theo dõi phải thuộc phòng đồng chí phụ trách.' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  -- 1-1-1 với việc theo 1400 (CN-1.2, NT-2, NT-3, CN-3.2, CH-5, CH-7, CH-8, CH-9).
  IF v_1400 THEN
    IF nullif("p" ->> 'san_pham_loai', '') IS NULL THEN
      RAISE EXCEPTION 'Nhiệm vụ phải định nghĩa sản phẩm đầu ra (tờ trình, báo cáo, dự thảo…) — nguyên tắc 1 Product.' USING ERRCODE = '22023';
    END IF;
    IF NOT coalesce((SELECT "cho_phep_tao_moi" FROM "public"."dm_loai_thoi_han" WHERE "ma" = v_loai_han), false) THEN
      RAISE EXCEPTION 'Việc mới phải có thời hạn: chọn "Có hạn cụ thể" hoặc "Ký ban hành".' USING ERRCODE = '22023';
    END IF;
    IF v_loai_han = 'CO_HAN_CU_THE' AND nullif("p" ->> 'han_xu_ly', '') IS NULL THEN
      RAISE EXCEPTION 'Nhiệm vụ phải có hạn hoàn thành cụ thể — nguyên tắc 1 Deadline.' USING ERRCODE = '22023';
    END IF;
    IF v_vb."loai" IN ('KL_BTV', 'TB_THUONG_TRUC') AND (nullif("p" ->> 'nganh_ma', '') IS NULL OR nullif("p" ->> 'linh_vuc_ma', '') IS NULL) THEN
      RAISE EXCEPTION 'Việc từ kết luận/thông báo phải chọn ngành và lĩnh vực (để phân công lãnh đạo phụ trách).' USING ERRCODE = '22023';
    END IF;
    -- Cấp nhận sản phẩm mặc định = cấp ngay trên Owner (CH-7).
    v_cap := coalesce(nullif("p" ->> 'cap_nhan_san_pham', ''), CASE
      WHEN v_owner."role_group" = 'A3' THEN 'TRUONG_PHONG'
      WHEN v_owner."role_group" = 'A2' OR (v_owner."id" IS NULL AND v_dv."phong" IS NOT NULL) THEN 'PHO_CHANH_VAN_PHONG'
      ELSE 'THUONG_TRUC' END);
  END IF;
  INSERT INTO "public"."nhiem_vu" ("van_ban_id", "nguoi_theo_doi", "owner_don_vi_ma", "owner_tai_khoan", "san_pham_loai", "san_pham_mo_ta",
    "cap_nhan_san_pham", "cap_quyet_dinh", "ngay_nhan_van_ban", "ngay_nhan_uoc_tinh", "noi_dung", "loai_thoi_han_ma", "han_xu_ly",
    "ly_do_chua_co_han", "nganh_ma", "linh_vuc_ma", "linh_vuc_chi_tiet", "van_ban_trien_khai", "ghi_chu", "nhiem_vu_cha", "theo_1400", "tao_boi")
  VALUES (v_vb."id", v_theo_doi."id", v_dv."ma", v_owner."id", nullif("p" ->> 'san_pham_loai', ''), nullif(btrim("p" ->> 'san_pham_mo_ta'), ''),
    v_cap, nullif("p" ->> 'cap_quyet_dinh', ''),
    -- GV-2/GV-6: việc theo 1400 lấy ngày nhận nhập vào, không có thì ngày nhận của văn bản, không có nữa thì hôm nay (không ước tính).
    CASE WHEN v_1400 THEN coalesce(nullif("p" ->> 'ngay_nhan_van_ban', '')::date, v_vb."ngay_nhan", "public"."kl_hom_nay"()) ELSE nullif("p" ->> 'ngay_nhan_van_ban', '')::date END,
    false, btrim("p" ->> 'noi_dung'), v_loai_han, nullif("p" ->> 'han_xu_ly', '')::date, nullif(btrim("p" ->> 'ly_do_chua_co_han'), ''),
    nullif("p" ->> 'nganh_ma', ''), nullif("p" ->> 'linh_vuc_ma', ''), nullif(btrim("p" ->> 'linh_vuc_chi_tiet'), ''), nullif(btrim("p" ->> 'van_ban_trien_khai'), ''),
    nullif(btrim("p" ->> 'ghi_chu'), ''), nullif("p" ->> 'nhiem_vu_cha', '')::uuid, v_1400, v_me."id")
  RETURNING "id", "ma" INTO v_id, v_ma;
  RETURN jsonb_build_object('id', v_id, 'ma', v_ma, 'van_ban_id', v_vb."id");
END;
$$;

-- 6. xac_nhan_nhan_viec(p_id): Owner tài khoản hoặc người theo dõi xác nhận đã nhận việc đang mở — CHỈ ghi lịch sử, không đổi
--    trạng thái/hạn/cap_nhat_luc (CN-2.2 luân chuyển không dừng đồng hồ). Gọi lại không ghi thêm (trả false).
CREATE FUNCTION "public"."xac_nhan_nhan_viec"("p_id" uuid) RETURNS boolean
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v "public"."nhiem_vu";
BEGIN
  SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = "p_id";
  IF v."id" IS NULL OR "auth"."uid"() IS NULL OR NOT (v."nguoi_theo_doi" = "auth"."uid"() OR v."owner_tai_khoan" = "auth"."uid"()) THEN
    RAISE EXCEPTION 'Chỉ Owner hoặc người theo dõi của nhiệm vụ mới xác nhận đã nhận việc.' USING ERRCODE = '42501';
  END IF;
  IF v."tien_do_ma" = 'HOAN_THANH' THEN
    RAISE EXCEPTION 'Nhiệm vụ đã đóng, không còn xác nhận nhận việc.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM "public"."lich_su" WHERE "nhiem_vu_id" = "p_id" AND "cot" = 'xac_nhan_nhan_viec' AND "nguoi_sua" = "auth"."uid"()) THEN
    RETURN false;
  END IF;
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
  VALUES ("p_id", "auth"."uid"(), 'xac_nhan_nhan_viec', to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI'), 'app');
  RETURN true;
END;
$$;
DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['giao_viec(jsonb)', 'xac_nhan_nhan_viec(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
-- Trạng thái "đã xác nhận nhận việc" frontend đọc từ lich_su (cot = 'xac_nhan_nhan_viec', RLS theo phạm vi) — không thêm cột view.
