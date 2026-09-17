-- 0035 — GĐ22 (1/3): độ khẩn 4 cấp trên nhiệm vụ và chỉ đạo (THUONG < KHAN < THUONG_KHAN < HOA_TOC), giao thay mặt (người quản trị KL giao
-- thay một lãnh đạo A1/A2 — lãnh đạo đó là cấp duyệt từ chối, nhận tin ngay), Thường trực (A0) giao việc (Owner = lãnh đạo Văn phòng hoặc
-- một phòng; người theo dõi tự suy; uu_tien = THUONG_TRUC chỉ nhánh A0 đặt được). Ngưỡng theo cấp đọc từ kl_cau_hinh (do_khan_<cấp>_*):
-- Thường = khoá cũ (Vàng 3, nhắc lại 3, hạn phản hồi 2 ngày làm việc); Khẩn 5/2/1; Thượng khẩn và Hỏa tốc 5/1/0 (nhắc hằng ngày, trả lời
-- trong ngày). Giờ làm việc 7h30–17h Việt Nam, bỏ Thứ Bảy/Chủ nhật (gio_lam_viec_sau) cho mốc "Đã nhận" 2 giờ của Hỏa tốc (0037).
-- Phần chỉ đạo/trạng thái ở 0036, cảnh báo/view/đếm ở 0037.

-- 1. Cột và cấu hình.
ALTER TABLE "public"."nhiem_vu"
  ADD COLUMN "do_khan" text NOT NULL DEFAULT 'THUONG' CHECK ("do_khan" IN ('THUONG', 'KHAN', 'THUONG_KHAN', 'HOA_TOC')),
  ADD COLUMN "giao_thay_mat_cho" uuid REFERENCES "public"."accounts"("id"),
  ADD COLUMN "uu_tien" text CHECK ("uu_tien" IS NULL OR "uu_tien" = 'THUONG_TRUC');
ALTER TABLE "public"."chi_dao"
  ADD COLUMN "do_khan" text NOT NULL DEFAULT 'THUONG' CHECK ("do_khan" IN ('THUONG', 'KHAN', 'THUONG_KHAN', 'HOA_TOC')),
  ADD COLUMN "da_nhan" uuid[] NOT NULL DEFAULT '{}';   -- người nhận đã bấm "Đã nhận" (bắt buộc với Hỏa tốc)
INSERT INTO "public"."kl_cau_hinh" ("khoa", "gia_tri", "mo_ta") VALUES
  ('do_khan_KHAN_vang', '5', 'Khẩn: mức VÀNG khi còn ≤ N ngày tới hạn, chưa có minh chứng'),
  ('do_khan_KHAN_nhac_lai', '2', 'Khẩn: cùng mức cảnh báo chỉ nhắc lại sau N ngày'),
  ('do_khan_KHAN_han_phan_hoi', '1', 'Khẩn: hạn phản hồi chỉ đạo N ngày làm việc'),
  ('do_khan_THUONG_KHAN_vang', '5', 'Thượng khẩn: mức VÀNG khi còn ≤ N ngày tới hạn'),
  ('do_khan_THUONG_KHAN_nhac_lai', '1', 'Thượng khẩn: nhắc lại hằng ngày'),
  ('do_khan_THUONG_KHAN_han_phan_hoi', '0', 'Thượng khẩn: phản hồi trong ngày (0 ngày làm việc)'),
  ('do_khan_HOA_TOC_vang', '5', 'Hỏa tốc: mức VÀNG khi còn ≤ N ngày tới hạn'),
  ('do_khan_HOA_TOC_nhac_lai', '1', 'Hỏa tốc: nhắc lại hằng ngày'),
  ('do_khan_HOA_TOC_han_phan_hoi', '0', 'Hỏa tốc: phản hồi trong ngày (0 ngày làm việc)'),
  ('hoa_toc_da_nhan_gio', '2', 'Hỏa tốc: người nhận phải bấm "Đã nhận" trong N giờ làm việc (7h30–17h, bỏ T7/CN)'),
  ('thuong_truc_han_nhan_ngay', '1', 'Việc Thường trực giao: người nhận phải xác nhận nhận việc trong N ngày làm việc')
ON CONFLICT ("khoa") DO NOTHING;

-- 2. Tên cấp; ngưỡng theo cấp {vang, nhac_lai, han_phan_hoi} (Thường = khoá cũ để quản trị chỉnh một chỗ); giờ làm việc.
CREATE FUNCTION "public"."ten_do_khan"("p" text) RETURNS text LANGUAGE "sql" IMMUTABLE AS $$
  SELECT CASE "p" WHEN 'KHAN' THEN 'Khẩn' WHEN 'THUONG_KHAN' THEN 'Thượng khẩn' WHEN 'HOA_TOC' THEN 'Hỏa tốc' ELSE 'Thường' END;
$$;
CREATE FUNCTION "public"."kl_nguong_do_khan"("p_do_khan" text) RETURNS jsonb
LANGUAGE "sql" STABLE SET "search_path" = "public" AS $$
  WITH ch AS (SELECT "khoa", "gia_tri"::integer AS v FROM "public"."kl_cau_hinh")
  SELECT jsonb_build_object(
    'vang', coalesce((SELECT v FROM ch WHERE "khoa" = CASE WHEN "p_do_khan" = 'THUONG' THEN 'nguong_vang_ngay' ELSE 'do_khan_' || "p_do_khan" || '_vang' END), CASE WHEN "p_do_khan" = 'THUONG' THEN 3 ELSE 5 END),
    'nhac_lai', greatest(coalesce((SELECT v FROM ch WHERE "khoa" = CASE WHEN "p_do_khan" = 'THUONG' THEN 'canh_bao_nhac_lai_ngay' ELSE 'do_khan_' || "p_do_khan" || '_nhac_lai' END),
                CASE "p_do_khan" WHEN 'THUONG' THEN 3 WHEN 'KHAN' THEN 2 ELSE 1 END), 1),
    'han_phan_hoi', greatest(coalesce((SELECT v FROM ch WHERE "khoa" = CASE WHEN "p_do_khan" = 'THUONG' THEN 'chi_dao_tt_han_phan_hoi_ngay' ELSE 'do_khan_' || "p_do_khan" || '_han_phan_hoi' END),
                    CASE "p_do_khan" WHEN 'THUONG' THEN 2 WHEN 'KHAN' THEN 1 ELSE 0 END), 0));
$$;
-- Mốc sau p_gio giờ làm việc kể từ p_tu (giờ Việt Nam 7h30–17h, bỏ Thứ Bảy/Chủ nhật; ngoài giờ dồn sang khung làm việc kế tiếp).
CREATE FUNCTION "public"."gio_lam_viec_sau"("p_tu" timestamp with time zone, "p_gio" numeric) RETURNS timestamp with time zone
LANGUAGE "plpgsql" IMMUTABLE AS $$
DECLARE v timestamp := "p_tu" AT TIME ZONE 'Asia/Ho_Chi_Minh'; v_con interval := make_interval(secs => greatest(coalesce("p_gio", 0), 0) * 3600); v_het timestamp; n integer := 0;
BEGIN
  LOOP
    n := n + 1; IF n > 60 THEN EXIT; END IF;
    IF extract(isodow FROM v) >= 6 OR v::time >= time '17:00' THEN v := (v::date + 1)::timestamp + interval '7 hours 30 minutes'; CONTINUE; END IF;
    IF v::time < time '07:30' THEN v := v::date + interval '7 hours 30 minutes'; END IF;
    v_het := v::date + interval '17 hours';
    IF v + v_con <= v_het THEN RETURN (v + v_con) AT TIME ZONE 'Asia/Ho_Chi_Minh'; END IF;
    v_con := v_con - (v_het - v); v := (v::date + 1)::timestamp + interval '7 hours 30 minutes';
  END LOOP;
  RETURN v AT TIME ZONE 'Asia/Ho_Chi_Minh';
END;
$$;

-- 3. uu_tien = THUONG_TRUC chỉ hàm giao_viec nhánh A0 đặt (biến phiên kl.thuong_truc); người khác kể cả quan_tri_kl chèn/sửa thẳng bị chặn.
CREATE FUNCTION "public"."kl_nhiem_vu_guard_uu_tien"() RETURNS trigger LANGUAGE "plpgsql" SET "search_path" = "public" AS $$
BEGIN
  IF NEW."uu_tien" IS NOT NULL AND (TG_OP = 'INSERT' OR NEW."uu_tien" IS DISTINCT FROM OLD."uu_tien")
     AND "auth"."uid"() IS NOT NULL AND current_setting('kl.thuong_truc', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'Chỉ Thường trực Tỉnh ủy mới đặt được ưu tiên Thường trực cho nhiệm vụ.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "aa_kl_nhiem_vu_guard_uu_tien" BEFORE INSERT OR UPDATE ON "public"."nhiem_vu" FOR EACH ROW EXECUTE FUNCTION "public"."kl_nhiem_vu_guard_uu_tien"();

-- 4. giao_viec (0025) + p.do_khan (A0 mặc định KHAN), p.thay_mat_cho (bắt buộc với người giao là A3 quan_tri_kl; phải là A1/A2 trong phạm vi
--    Owner), nhánh A0 (Owner = lãnh đạo VP → theo dõi = chính họ; phòng → theo dõi = Trưởng phòng; văn bản thiếu thì tự tạo loại KHAC;
--    uu_tien THUONG_TRUC). Vết: "X giao thay mặt Y", "Thường trực giao". Tin: người nhận (A0 giao / thay mặt / độ khẩn ≥ Khẩn), lãnh đạo
--    được thay mặt, cấp trên trực tiếp của người nhận (Thượng khẩn, Hỏa tốc), Chánh VP (Hỏa tốc, Thường trực giao). Phần còn lại giữ 0025.
CREATE OR REPLACE FUNCTION "public"."giao_viec"("p" jsonb) RETURNS jsonb
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_me "public"."accounts"; v_vb "public"."van_ban_giao_viec"; v_dv "public"."dm_don_vi"; v_owner "public"."accounts"; v_tm "public"."accounts";
        v_theo_doi "public"."accounts"; v_1400 boolean := coalesce(("p" ->> 'theo_1400')::boolean, true); v_a0 boolean; v_do_khan text;
        v_phong_owner text; v_loai_han text := coalesce("p" ->> 'loai_thoi_han_ma', 'CO_HAN_CU_THE'); v_cap text; v_id uuid; v_ma text;
        v_nhan uuid; v_nguoi uuid[] := ARRAY[]::uuid[]; v_tin text; v_han date := nullif("p" ->> 'han_xu_ly', '')::date;
BEGIN
  SELECT * INTO v_me FROM "public"."accounts" WHERE "id" = "auth"."uid"();
  v_a0 := v_me."role_group" = 'A0';
  IF v_me."id" IS NULL OR (v_me."role_group" NOT IN ('A0', 'A1', 'A2') AND NOT v_me."quan_tri_kl") THEN
    RAISE EXCEPTION 'Chỉ Thường trực, lãnh đạo Văn phòng, trưởng phòng hoặc người quản trị KL mới được giao việc.' USING ERRCODE = '42501';
  END IF;
  v_do_khan := coalesce(nullif("p" ->> 'do_khan', ''), CASE WHEN v_a0 THEN 'KHAN' ELSE 'THUONG' END);
  IF v_do_khan NOT IN ('THUONG', 'KHAN', 'THUONG_KHAN', 'HOA_TOC') THEN RAISE EXCEPTION 'Độ khẩn không hợp lệ.' USING ERRCODE = '22023'; END IF;
  IF ("p" ? 'uu_tien') AND NOT v_a0 THEN RAISE EXCEPTION 'Chỉ Thường trực Tỉnh ủy mới đặt ưu tiên Thường trực.' USING ERRCODE = '42501'; END IF;
  IF nullif("p" ->> 'van_ban_id', '') IS NOT NULL THEN
    SELECT * INTO v_vb FROM "public"."van_ban_giao_viec" WHERE "id" = ("p" ->> 'van_ban_id')::uuid;
    IF v_vb."id" IS NULL THEN RAISE EXCEPTION 'Không tìm thấy văn bản giao việc.' USING ERRCODE = '22023'; END IF;
  ELSIF "p" ? 'van_ban' THEN
    INSERT INTO "public"."van_ban_giao_viec" ("loai", "so_hoi_nghi", "so_ket_luan", "ngay_ban_hanh", "ngay_nhan", "co_quan_ban_hanh", "tao_boi")
    VALUES (coalesce("p" #>> '{van_ban,loai}', 'KHAC'), ("p" #>> '{van_ban,so_hoi_nghi}')::integer, btrim("p" #>> '{van_ban,so_ket_luan}'),
            ("p" #>> '{van_ban,ngay_ban_hanh}')::date, ("p" #>> '{van_ban,ngay_nhan}')::date, nullif(btrim("p" #>> '{van_ban,co_quan_ban_hanh}'), ''), v_me."id")
    RETURNING * INTO v_vb;
  ELSIF v_a0 THEN   -- Thường trực giao trực tiếp, không kèm văn bản: một văn bản loại KHAC ghi mốc giao.
    INSERT INTO "public"."van_ban_giao_viec" ("loai", "so_ket_luan", "ngay_ban_hanh", "ngay_nhan", "co_quan_ban_hanh", "tao_boi")
    VALUES ('KHAC', 'Thường trực giao ' || to_char(clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS.MS'), "public"."kl_hom_nay"(), "public"."kl_hom_nay"(), 'Thường trực Tỉnh ủy', v_me."id")
    RETURNING * INTO v_vb;
  ELSE
    RAISE EXCEPTION 'Nhiệm vụ phải gắn với một văn bản giao việc.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_dv FROM "public"."dm_don_vi" WHERE "ma" = "p" ->> 'owner_don_vi_ma';
  IF v_1400 AND v_dv."ma" IS NULL THEN
    RAISE EXCEPTION 'Nhiệm vụ phải có một Owner chịu trách nhiệm (đơn vị, phòng hoặc cán bộ) — nguyên tắc 1 Owner.' USING ERRCODE = '22023';
  END IF;
  IF nullif("p" ->> 'owner_tai_khoan', '') IS NOT NULL THEN
    SELECT * INTO v_owner FROM "public"."accounts" WHERE "id" = ("p" ->> 'owner_tai_khoan')::uuid;
    IF v_owner."id" IS NULL OR v_owner."is_system" THEN RAISE EXCEPTION 'Tài khoản Owner không hợp lệ.' USING ERRCODE = '22023'; END IF;
  END IF;
  v_phong_owner := coalesce(v_owner."department", v_dv."phong");
  IF v_a0 THEN   -- Người nhận việc Thường trực giao: lãnh đạo Văn phòng (theo dõi = chính họ) hoặc Trưởng phòng của phòng được giao.
    IF v_owner."id" IS NOT NULL AND v_owner."role_group" = 'A1' THEN v_theo_doi := v_owner;
    ELSIF v_owner."id" IS NULL AND v_dv."trong_van_phong" AND v_dv."phong" IS NOT NULL THEN
      SELECT * INTO v_theo_doi FROM "public"."accounts" WHERE "role_group" = 'A2' AND "department" = v_dv."phong" AND NOT "is_system" ORDER BY "username" LIMIT 1;
      IF v_theo_doi."id" IS NULL THEN RAISE EXCEPTION 'Phòng % chưa có Trưởng phòng để nhận việc Thường trực giao.', v_dv."ten" USING ERRCODE = '22023'; END IF;
    ELSE RAISE EXCEPTION 'Thường trực Tỉnh ủy giao việc cho lãnh đạo Văn phòng hoặc một phòng của Văn phòng.' USING ERRCODE = '42501'; END IF;
  ELSE
    SELECT * INTO v_theo_doi FROM "public"."accounts" WHERE "id" = coalesce(nullif("p" ->> 'nguoi_theo_doi', '')::uuid, v_me."id");
    IF v_theo_doi."id" IS NULL OR v_theo_doi."is_system" THEN RAISE EXCEPTION 'Người theo dõi phải là một cán bộ Văn phòng.' USING ERRCODE = '22023'; END IF;
  END IF;
  -- Giao thay mặt: người giao không phải lãnh đạo (A3 giữ quan_tri_kl) phải ghi lãnh đạo A1/A2 được thay mặt, trong phạm vi Owner.
  IF v_me."role_group" = 'A3' THEN
    SELECT * INTO v_tm FROM "public"."accounts" WHERE "id" = nullif("p" ->> 'thay_mat_cho', '')::uuid;
    IF v_tm."id" IS NULL OR v_tm."is_system" OR v_tm."role_group" NOT IN ('A1', 'A2') THEN
      RAISE EXCEPTION 'Người quản trị KL giao việc phải thay mặt một lãnh đạo Văn phòng hoặc Trưởng phòng.' USING ERRCODE = '22023';
    ELSIF v_tm."role_group" = 'A2' AND v_phong_owner IS DISTINCT FROM v_tm."department" THEN
      RAISE EXCEPTION 'Trưởng phòng được thay mặt chỉ giao cho Owner thuộc phòng mình.' USING ERRCODE = '22023';
    ELSIF v_tm."role_group" = 'A1' AND NOT v_tm."is_chief" AND v_phong_owner IS NOT NULL AND NOT "public"."phu_trach"(v_tm."id", v_phong_owner, "public"."kl_hom_nay"()) THEN
      RAISE EXCEPTION 'Phó Chánh Văn phòng được thay mặt phải phụ trách phòng của Owner.' USING ERRCODE = '22023';
    END IF;
  ELSIF nullif("p" ->> 'thay_mat_cho', '') IS NOT NULL THEN
    RAISE EXCEPTION 'Lãnh đạo giao việc trực tiếp, không ghi thay mặt.' USING ERRCODE = '22023';
  END IF;
  IF NOT v_me."quan_tri_kl" AND NOT v_a0 THEN   -- GV-3 (0025)
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
  IF v_1400 THEN   -- 1-1-1 (0025)
    IF nullif("p" ->> 'san_pham_loai', '') IS NULL THEN
      RAISE EXCEPTION 'Nhiệm vụ phải định nghĩa sản phẩm đầu ra (tờ trình, báo cáo, dự thảo…) — nguyên tắc 1 Product.' USING ERRCODE = '22023';
    END IF;
    IF NOT coalesce((SELECT "cho_phep_tao_moi" FROM "public"."dm_loai_thoi_han" WHERE "ma" = v_loai_han), false) THEN
      RAISE EXCEPTION 'Việc mới phải có thời hạn: chọn "Có hạn cụ thể" hoặc "Ký ban hành".' USING ERRCODE = '22023';
    END IF;
    IF v_loai_han = 'CO_HAN_CU_THE' AND v_han IS NULL THEN
      RAISE EXCEPTION 'Nhiệm vụ phải có hạn hoàn thành cụ thể — nguyên tắc 1 Deadline.' USING ERRCODE = '22023';
    END IF;
    IF v_vb."loai" IN ('KL_BTV', 'TB_THUONG_TRUC') AND (nullif("p" ->> 'nganh_ma', '') IS NULL OR nullif("p" ->> 'linh_vuc_ma', '') IS NULL) THEN
      RAISE EXCEPTION 'Việc từ kết luận/thông báo phải chọn ngành và lĩnh vực (để phân công lãnh đạo phụ trách).' USING ERRCODE = '22023';
    END IF;
    v_cap := coalesce(nullif("p" ->> 'cap_nhan_san_pham', ''), CASE
      WHEN v_owner."role_group" = 'A3' THEN 'TRUONG_PHONG'
      WHEN v_owner."role_group" = 'A2' OR (v_owner."id" IS NULL AND v_dv."phong" IS NOT NULL) THEN 'PHO_CHANH_VAN_PHONG'
      ELSE 'THUONG_TRUC' END);
  END IF;
  IF v_a0 THEN PERFORM set_config('kl.thuong_truc', '1', true); END IF;
  INSERT INTO "public"."nhiem_vu" ("van_ban_id", "nguoi_theo_doi", "owner_don_vi_ma", "owner_tai_khoan", "san_pham_loai", "san_pham_mo_ta",
    "cap_nhan_san_pham", "cap_quyet_dinh", "ngay_nhan_van_ban", "ngay_nhan_uoc_tinh", "noi_dung", "loai_thoi_han_ma", "han_xu_ly",
    "ly_do_chua_co_han", "nganh_ma", "linh_vuc_ma", "linh_vuc_chi_tiet", "van_ban_trien_khai", "ghi_chu", "nhiem_vu_cha", "theo_1400", "tao_boi",
    "do_khan", "giao_thay_mat_cho", "uu_tien")
  VALUES (v_vb."id", v_theo_doi."id", v_dv."ma", v_owner."id", nullif("p" ->> 'san_pham_loai', ''), nullif(btrim("p" ->> 'san_pham_mo_ta'), ''),
    v_cap, nullif("p" ->> 'cap_quyet_dinh', ''),
    CASE WHEN v_1400 THEN coalesce(nullif("p" ->> 'ngay_nhan_van_ban', '')::date, v_vb."ngay_nhan", "public"."kl_hom_nay"()) ELSE nullif("p" ->> 'ngay_nhan_van_ban', '')::date END,
    false, btrim("p" ->> 'noi_dung'), v_loai_han, v_han, nullif(btrim("p" ->> 'ly_do_chua_co_han'), ''),
    nullif("p" ->> 'nganh_ma', ''), nullif("p" ->> 'linh_vuc_ma', ''), nullif(btrim("p" ->> 'linh_vuc_chi_tiet'), ''), nullif(btrim("p" ->> 'van_ban_trien_khai'), ''),
    nullif(btrim("p" ->> 'ghi_chu'), ''), nullif("p" ->> 'nhiem_vu_cha', '')::uuid, v_1400, v_me."id", v_do_khan, v_tm."id", CASE WHEN v_a0 THEN 'THUONG_TRUC' END)
  RETURNING "id", "ma", "han_xu_ly" INTO v_id, v_ma, v_han;
  PERFORM set_config('kl.thuong_truc', '', true);
  -- Vết và tin hệ thống.
  v_nhan := coalesce(v_owner."id", v_theo_doi."id");
  IF v_tm."id" IS NOT NULL THEN
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon") VALUES (v_id, v_me."id", 'giao_thay_mat', format('%s giao thay mặt %s', v_me."full_name", v_tm."full_name"), 'app');
    v_nguoi := v_nguoi || v_tm."id";
  END IF;
  IF v_a0 THEN
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon") VALUES (v_id, v_me."id", 'giao_viec', format('Thường trực Tỉnh ủy giao, độ khẩn %s, người nhận %s', "public"."ten_do_khan"(v_do_khan), v_theo_doi."full_name"), 'app');
  END IF;
  IF v_a0 OR v_tm."id" IS NOT NULL OR v_do_khan <> 'THUONG' THEN v_nguoi := v_nguoi || v_nhan || v_theo_doi."id"; END IF;
  IF v_do_khan IN ('THUONG_KHAN', 'HOA_TOC') THEN v_nguoi := v_nguoi || "public"."lanh_dao_truc_tiep"(v_nhan); END IF;
  IF v_a0 OR v_do_khan = 'HOA_TOC' THEN v_nguoi := v_nguoi || (SELECT "id" FROM "public"."accounts" WHERE "is_chief" AND "role_group" = 'A1' AND NOT "is_system" ORDER BY "username" LIMIT 1); END IF;
  v_tin := format('%s · %s: %s (hạn %s)', CASE WHEN v_a0 THEN 'Thường trực giao việc' WHEN v_tm."id" IS NOT NULL THEN 'Giao việc thay mặt ' || v_tm."full_name" ELSE 'Giao việc' END
    || CASE WHEN v_do_khan <> 'THUONG' THEN ' · ' || "public"."ten_do_khan"(v_do_khan) ELSE '' END, v_ma, left(btrim("p" ->> 'noi_dung'), 120), coalesce(to_char(v_han, 'DD/MM/YYYY'), 'ký ban hành'));
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  SELECT DISTINCT v_me."id", u, v_tin, false, 'he_thong', v_id FROM unnest(v_nguoi) u JOIN "public"."accounts" a ON a."id" = u
  WHERE u <> v_me."id" AND NOT a."is_system" AND a."role_group" <> 'A0';
  RETURN jsonb_build_object('id', v_id, 'ma', v_ma, 'van_ban_id', v_vb."id");
END;
$$;

-- 5. de_nghi_tu_choi (0034): cấp duyệt = lãnh đạo được giao thay mặt (nếu có, khác người đề nghị), không thì lãnh đạo trực tiếp.
CREATE OR REPLACE FUNCTION "public"."de_nghi_tu_choi"("p_nhiem_vu" uuid, "p_ly_do" text) RETURNS uuid
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v "public"."nhiem_vu"; v_me "public"."accounts"; v_cap "public"."accounts"; v_id uuid; v_ly_do text := btrim(coalesce("p_ly_do", '')); v_tin text;
BEGIN
  SELECT * INTO v_me FROM "public"."accounts" WHERE "id" = "auth"."uid"();
  SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = "p_nhiem_vu";
  IF v_me."id" IS NULL OR v_me."role_group" = 'A0' OR v."id" IS NULL OR NOT (v."nguoi_theo_doi" = v_me."id" OR v."owner_tai_khoan" = v_me."id") THEN
    RAISE EXCEPTION 'Chỉ Owner hoặc người theo dõi vừa được giao việc mới đề nghị từ chối.' USING ERRCODE = '42501';
  END IF;
  IF v."tien_do_ma" = 'HOAN_THANH' THEN RAISE EXCEPTION 'Nhiệm vụ đã đóng, không còn từ chối được.' USING ERRCODE = '22023'; END IF;
  IF v."bi_tu_choi" THEN RAISE EXCEPTION 'Việc đã được đồng ý từ chối, đang chờ giao lại.' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM "public"."lich_su" WHERE "nhiem_vu_id" = v."id" AND "cot" = 'xac_nhan_nhan_viec' AND "nguoi_sua" = v_me."id") THEN
    RAISE EXCEPTION 'Đồng chí đã xác nhận nhận việc này, không còn từ chối được.' USING ERRCODE = '22023';
  END IF;
  IF v_ly_do = '' THEN RAISE EXCEPTION 'Đề nghị từ chối phải có lý do.' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM "public"."tu_choi" WHERE "nhiem_vu_id" = v."id" AND "trang_thai" = 'CHO_DUYET') THEN
    RAISE EXCEPTION 'Nhiệm vụ đã có đề nghị từ chối đang chờ duyệt.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_cap FROM "public"."accounts" WHERE "id" = coalesce(CASE WHEN v."giao_thay_mat_cho" IS DISTINCT FROM v_me."id" THEN v."giao_thay_mat_cho" END, "public"."lanh_dao_truc_tiep"(v_me."id"));
  IF v_cap."id" IS NULL THEN RAISE EXCEPTION 'Chưa xác định được lãnh đạo trực tiếp để duyệt đề nghị.' USING ERRCODE = '22023'; END IF;
  INSERT INTO "public"."tu_choi" ("nhiem_vu_id", "nguoi_de_nghi", "cap_duyet", "ly_do") VALUES (v."id", v_me."id", v_cap."id", v_ly_do) RETURNING "id" INTO v_id;
  v_tin := format('Đề nghị từ chối · %s: %s đề nghị từ chối nhận việc, chờ %s duyệt', v."ma", v_me."full_name", v_cap."full_name");
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon") VALUES (v."id", v_me."id", 'tu_choi', format('đề nghị từ chối, chờ %s duyệt', v_cap."full_name"), 'app');
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  SELECT v_me."id", u, v_tin, false, 'he_thong', v."id" FROM (SELECT v_cap."id" AS u UNION SELECT v."tao_boi" WHERE v."tao_boi" IS NOT NULL) t
  JOIN "public"."accounts" a ON a."id" = t.u WHERE t.u <> v_me."id" AND NOT a."is_system";
  RETURN v_id;
END;
$$;

-- 6. Quyền: hàm nội bộ không cấp cho client; ten_do_khan / kl_nguong_do_khan / gio_lam_viec_sau đọc được (frontend hiện ngưỡng, mốc Đã nhận).
DO $$ DECLARE f text; BEGIN
  REVOKE ALL ON FUNCTION "public"."kl_nhiem_vu_guard_uu_tien"() FROM public, anon, authenticated;
  FOREACH f IN ARRAY ARRAY['ten_do_khan(text)', 'kl_nguong_do_khan(text)', 'gio_lam_viec_sau(timestamptz,numeric)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
