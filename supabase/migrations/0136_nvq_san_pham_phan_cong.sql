-- 0136 (v3.35 — CAU-HOI nhóm U, tiếp 0135): kết quả / sản phẩm của nhiệm vụ quý (định nghĩa: mô tả, loại, mốc, chỉ tiêu và mục tiêu), phân công chủ trì
-- theo dõi, điều chỉnh danh mục (rút / khôi phục theo văn bản), đầu mối tổng hợp, danh mục lãnh đạo phụ trách / đơn vị tham mưu.
-- Kết quả / sản phẩm: người được cập nhật (chủ trì theo dõi…) thêm, tách, sửa được — chủ trì theo dõi là người cập nhật chính (chủ dự án 13/11/2026);
-- sửa / xoá bắt buộc lý do, ghi lịch sử. Phân công, điều chỉnh: chỉ người quản lý danh mục.

-- ---- 1. Kết quả / sản phẩm ----
CREATE FUNCTION "public"."nvq_kiem_san_pham"("p" jsonb, "k" "public"."nvq_ky") RETURNS void
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF "p" ? 'mo_ta' AND char_length(btrim(coalesce("p" ->> 'mo_ta', ''))) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Ghi kết quả, sản phẩm cần đạt (tối đa 2.000 ký tự).' USING ERRCODE = '22023';
  END IF;
  IF "p" ? 'loai' AND "p" ->> 'loai' NOT IN ('VAN_BAN', 'CHI_TIEU', 'HOAT_DONG', 'DINH_KY', 'KHAC') THEN
    RAISE EXCEPTION 'Loại kết quả không hợp lệ.' USING ERRCODE = '22023';
  END IF;
  IF nullif("p" ->> 'han', '') IS NOT NULL AND (("p" ->> 'han')::date < "k"."tu_ngay" - 92 OR ("p" ->> 'han')::date > "k"."den_ngay" + 366) THEN
    RAISE EXCEPTION 'Mốc hoàn thành phải gần với quý đang theo dõi.' USING ERRCODE = '22023';
  END IF;
  IF coalesce("p" ->> 'chieu', 'CAO_HON_TOT') NOT IN ('CAO_HON_TOT', 'THAP_HON_TOT') THEN RAISE EXCEPTION 'Chiều đánh giá không hợp lệ.' USING ERRCODE = '22023'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION "public"."nvq_kiem_san_pham"(jsonb, "public"."nvq_ky") FROM public, "anon", "authenticated";

CREATE FUNCTION "public"."nvq_san_pham_luu"("p" jsonb, "p_ly_do" text DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid := nullif("p" ->> 'id', '')::uuid; s "public"."nvq_san_pham"; n "public"."nvq_nhiem_vu"; k "public"."nvq_ky"; v_cu jsonb; v_moi jsonb; v_doi jsonb;
        v_truong text[] := ARRAY['thu_tu', 'mo_ta', 'loai', 'han', 'han_text', 'chi_tieu_co_ban', 'don_vi_tinh', 'muc_tieu', 'chieu'];
BEGIN
  IF v_id IS NOT NULL THEN SELECT * INTO s FROM "public"."nvq_san_pham" WHERE "id" = v_id FOR UPDATE; END IF;
  SELECT * INTO n FROM "public"."nvq_nhiem_vu" WHERE "id" = coalesce(s."nhiem_vu_id", nullif("p" ->> 'nhiem_vu_id', '')::uuid);
  IF n."id" IS NULL OR (v_id IS NOT NULL AND s."id" IS NULL) THEN RAISE EXCEPTION 'Không có nhiệm vụ / kết quả này.' USING ERRCODE = '22023'; END IF;
  IF NOT "public"."nvq_duoc_cap_nhat"(n) THEN
    RAISE EXCEPTION 'Chỉ chủ trì theo dõi, người được phân công hoặc đầu mối tổng hợp mới sửa kết quả, sản phẩm của nhiệm vụ này.' USING ERRCODE = '42501';
  END IF;
  k := "public"."nvq_ky_mo"(n."ky_id");
  PERFORM "public"."nvq_kiem_san_pham"("p", k);
  IF v_id IS NULL THEN
    INSERT INTO "public"."nvq_san_pham" ("nhiem_vu_id", "thu_tu", "mo_ta", "loai", "han", "han_text", "chi_tieu_co_ban", "don_vi_tinh", "muc_tieu", "chieu", "sua_boi")
    VALUES (n."id", coalesce(nullif("p" ->> 'thu_tu', '')::smallint, (SELECT coalesce(max("thu_tu"), 0) + 1 FROM "public"."nvq_san_pham" WHERE "nhiem_vu_id" = n."id")),
            btrim("p" ->> 'mo_ta'), coalesce(nullif("p" ->> 'loai', ''), 'VAN_BAN'), nullif("p" ->> 'han', '')::date, nullif(btrim(coalesce("p" ->> 'han_text', '')), ''),
            nullif("p" ->> 'chi_tieu_co_ban', ''), nullif(btrim(coalesce("p" ->> 'don_vi_tinh', '')), ''), nullif("p" ->> 'muc_tieu', '')::numeric,
            coalesce(nullif("p" ->> 'chieu', ''), 'CAO_HON_TOT'), "auth"."uid"())
    RETURNING * INTO s;
    PERFORM "public"."nvq_ghi_lich_su"(n."id", n."ky_id", 'them_san_pham', format('Thêm kết quả, sản phẩm: %s', left(s."mo_ta", 300)));
    RETURN s."id";
  END IF;
  v_cu := to_jsonb(s);
  UPDATE "public"."nvq_san_pham" SET
    "thu_tu" = CASE WHEN "p" ? 'thu_tu' THEN coalesce(nullif("p" ->> 'thu_tu', '')::smallint, "thu_tu") ELSE "thu_tu" END,
    "mo_ta" = CASE WHEN "p" ? 'mo_ta' THEN btrim("p" ->> 'mo_ta') ELSE "mo_ta" END,
    "loai" = CASE WHEN "p" ? 'loai' THEN coalesce(nullif("p" ->> 'loai', ''), "loai") ELSE "loai" END,
    "han" = CASE WHEN "p" ? 'han' THEN nullif("p" ->> 'han', '')::date ELSE "han" END,
    "han_text" = CASE WHEN "p" ? 'han_text' THEN nullif(btrim(coalesce("p" ->> 'han_text', '')), '') ELSE "han_text" END,
    "chi_tieu_co_ban" = CASE WHEN "p" ? 'chi_tieu_co_ban' THEN nullif("p" ->> 'chi_tieu_co_ban', '') ELSE "chi_tieu_co_ban" END,
    "don_vi_tinh" = CASE WHEN "p" ? 'don_vi_tinh' THEN nullif(btrim(coalesce("p" ->> 'don_vi_tinh', '')), '') ELSE "don_vi_tinh" END,
    "muc_tieu" = CASE WHEN "p" ? 'muc_tieu' THEN nullif("p" ->> 'muc_tieu', '')::numeric ELSE "muc_tieu" END,
    "chieu" = CASE WHEN "p" ? 'chieu' THEN coalesce(nullif("p" ->> 'chieu', ''), 'CAO_HON_TOT') ELSE "chieu" END,
    "sua_boi" = "auth"."uid"(), "sua_luc" = now()
  WHERE "id" = v_id RETURNING * INTO s;
  v_moi := to_jsonb(s);
  SELECT jsonb_object_agg(x, jsonb_build_object('cu', v_cu -> x, 'moi', v_moi -> x)) INTO v_doi FROM unnest(v_truong) x WHERE (v_cu -> x) IS DISTINCT FROM (v_moi -> x);
  IF v_doi IS NULL THEN RETURN v_id; END IF;
  PERFORM "public"."nvq_ghi_lich_su"(n."id", n."ky_id", 'sua_san_pham', format('Sửa kết quả "%s": %s — lý do: %s', left(s."mo_ta", 120),
    (SELECT string_agg("public"."nvq_ten_truong"(x), ', ') FROM jsonb_object_keys(v_doi) x), "public"."nvq_ly_do"("p_ly_do")), v_doi);
  RETURN v_id;
END;
$$;
CREATE FUNCTION "public"."nvq_san_pham_xoa"("p_id" uuid, "p_ly_do" text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s "public"."nvq_san_pham"; n "public"."nvq_nhiem_vu"; v_ly text := "public"."nvq_ly_do"("p_ly_do");
BEGIN
  SELECT * INTO s FROM "public"."nvq_san_pham" WHERE "id" = "p_id" FOR UPDATE;
  IF s."id" IS NULL THEN RETURN; END IF;
  SELECT * INTO n FROM "public"."nvq_nhiem_vu" WHERE "id" = s."nhiem_vu_id";
  IF NOT "public"."nvq_duoc_cap_nhat"(n) THEN RAISE EXCEPTION 'Đồng chí không được sửa kết quả, sản phẩm của nhiệm vụ này.' USING ERRCODE = '42501'; END IF;
  -- Kết quả đã quá mốc (chưa xong) hoặc đã xong: chỉ đầu mối xoá — xoá để "hết chậm" phải qua người quản lý danh mục (như "không thực hiện").
  IF NOT "public"."nvq_la_quan_ly"() AND (s."trang_thai" IN ('HOAN_THANH', 'KHONG_PHAT_SINH') OR s."han" < "public"."kl_hom_nay"()) THEN
    RAISE EXCEPTION 'Kết quả đã hoàn thành hoặc đã quá mốc: đề nghị đầu mối tổng hợp điều chỉnh.' USING ERRCODE = '42501';
  END IF;
  PERFORM "public"."nvq_ky_mo"(n."ky_id");
  IF (SELECT count(*) FROM "public"."nvq_san_pham" WHERE "nhiem_vu_id" = n."id") <= 1 THEN
    RAISE EXCEPTION 'Nhiệm vụ phải có ít nhất một kết quả, sản phẩm.' USING ERRCODE = '22023';
  END IF;
  DELETE FROM "public"."nvq_san_pham" WHERE "id" = s."id";
  PERFORM "public"."nvq_ghi_lich_su"(n."id", n."ky_id", 'xoa_san_pham', format('Xoá kết quả "%s" — lý do: %s', left(s."mo_ta", 200), v_ly));
END;
$$;

-- ---- 2. Phân công chủ trì theo dõi (nhiều nhiệm vụ một lần) ----
-- p: { chu_tri: uuid | null, phoi_hop: [uuid], phong: mã phòng | null }. Đổi người đang chủ trì → lý do bắt buộc. Báo người mới được phân công.
CREATE FUNCTION "public"."nvq_phan_cong"("p_ids" uuid[], "p" jsonb, "p_ly_do" text DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ct uuid := nullif("p" ->> 'chu_tri', '')::uuid; v_ph uuid[] := ARRAY(SELECT DISTINCT x::uuid FROM jsonb_array_elements_text(coalesce("p" -> 'phoi_hop', '[]')) x);
        v_phong text := nullif(btrim(coalesce("p" ->> 'phong', '')), ''); n "public"."nvq_nhiem_vu"; v_so integer := 0; v_ly text; v_doi_nguoi boolean;
BEGIN
  PERFORM "public"."nvq_can_quan_ly"();
  v_ph := array_remove(v_ph, v_ct);
  IF EXISTS (SELECT 1 FROM unnest(array_append(v_ph, v_ct)) x WHERE x IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public"."accounts" a
             WHERE a."id" = x AND NOT coalesce(a."bi_khoa", false) AND NOT a."is_system" AND a."role_group" <> 'A0')) THEN
    RAISE EXCEPTION 'Chỉ phân công cho cán bộ Văn phòng đang hoạt động.' USING ERRCODE = '22023';
  END IF;
  v_doi_nguoi := EXISTS (SELECT 1 FROM "public"."nvq_nhiem_vu" WHERE "id" = ANY ("p_ids") AND "chu_tri_theo_doi" IS NOT NULL AND "chu_tri_theo_doi" IS DISTINCT FROM v_ct);
  v_ly := "public"."nvq_ly_do"("p_ly_do", v_doi_nguoi);
  FOR n IN SELECT * FROM "public"."nvq_nhiem_vu" WHERE "id" = ANY ("p_ids") ORDER BY "truc_so", "nhom", "stt" FOR UPDATE LOOP
    PERFORM "public"."nvq_ky_mo"(n."ky_id");
    IF n."chu_tri_theo_doi" IS NOT DISTINCT FROM v_ct AND n."phoi_hop_theo_doi" = v_ph AND n."phong_theo_doi" IS NOT DISTINCT FROM v_phong THEN CONTINUE; END IF;
    UPDATE "public"."nvq_nhiem_vu" SET "chu_tri_theo_doi" = v_ct, "phoi_hop_theo_doi" = v_ph, "phong_theo_doi" = v_phong, "sua_luc" = now() WHERE "id" = n."id";
    PERFORM "public"."nvq_ghi_lich_su"(n."id", n."ky_id", 'phan_cong', concat_ws(' — lý do: ', format('Phân công chủ trì theo dõi: %s%s%s',
      coalesce((SELECT "full_name" FROM "public"."accounts" WHERE "id" = v_ct), 'chưa có'),
      CASE WHEN cardinality(v_ph) > 0 THEN '; phối hợp: ' || (SELECT string_agg("full_name", ', ') FROM "public"."accounts" WHERE "id" = ANY (v_ph)) ELSE '' END,
      CASE WHEN v_phong IS NOT NULL THEN '; phòng: ' || v_phong ELSE '' END), v_ly),
      jsonb_build_object('cu', jsonb_build_object('chu_tri', n."chu_tri_theo_doi", 'phoi_hop', n."phoi_hop_theo_doi", 'phong', n."phong_theo_doi"),
                         'moi', jsonb_build_object('chu_tri', v_ct, 'phoi_hop', v_ph, 'phong', v_phong)));
    PERFORM "public"."nvq_gui_tin"(n."id", ARRAY(SELECT x FROM unnest(array_append(v_ph, v_ct)) x WHERE x IS DISTINCT FROM n."chu_tri_theo_doi"
                                                 AND NOT (x = ANY (n."phoi_hop_theo_doi"))),
      format('Nhiệm vụ quý · %s%s.(%s): đồng chí được phân công theo dõi — %s', "public"."nvq_la_ma"(n."truc_so"),
             CASE n."nhom" WHEN 'TRONG_CT' THEN '.1' ELSE '.2' END, n."stt", left(n."noi_dung", 200)));
    v_so := v_so + 1;
  END LOOP;
  RETURN v_so;
END;
$$;

-- ---- 3. Điều chỉnh danh mục: rút khỏi danh mục / khôi phục (căn cứ văn bản, lý do bắt buộc) ----
CREATE FUNCTION "public"."nvq_dieu_chinh"("p_id" uuid, "p_loai" text, "p_van_ban" uuid, "p_ly_do" text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n "public"."nvq_nhiem_vu"; v_ly text := "public"."nvq_ly_do"("p_ly_do");
BEGIN
  PERFORM "public"."nvq_can_quan_ly"();
  SELECT * INTO n FROM "public"."nvq_nhiem_vu" WHERE "id" = "p_id" FOR UPDATE;
  IF n."id" IS NULL THEN RAISE EXCEPTION 'Không có nhiệm vụ này.' USING ERRCODE = '22023'; END IF;
  PERFORM "public"."nvq_ky_mo"(n."ky_id");
  IF "p_loai" NOT IN ('RUT', 'KHOI_PHUC') THEN RAISE EXCEPTION 'Chọn rút khỏi danh mục hoặc khôi phục.' USING ERRCODE = '22023'; END IF;
  IF "p_van_ban" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public"."nvq_van_ban" WHERE "id" = "p_van_ban" AND "ky_id" = n."ky_id") THEN
    RAISE EXCEPTION 'Văn bản căn cứ không thuộc quý này.' USING ERRCODE = '22023';
  END IF;
  UPDATE "public"."nvq_nhiem_vu" SET "dieu_chinh" = CASE WHEN "p_loai" = 'RUT' THEN 'RUT' ELSE 'TRONG_DANH_MUC' END,
    "dieu_chinh_van_ban" = "p_van_ban", "dieu_chinh_ly_do" = v_ly, "sua_luc" = now() WHERE "id" = n."id";
  PERFORM "public"."nvq_ghi_lich_su"(n."id", n."ky_id", 'dieu_chinh', format('%s%s — lý do: %s',
    CASE WHEN "p_loai" = 'RUT' THEN 'Rút khỏi danh mục' ELSE 'Khôi phục vào danh mục' END,
    coalesce(' theo ' || (SELECT "so_ky_hieu" FROM "public"."nvq_van_ban" WHERE "id" = "p_van_ban"), ''), v_ly));
END;
$$;

-- ---- 4. Đầu mối tổng hợp (Chánh Văn phòng, tài khoản toàn quyền, quản trị hệ thống chỉ định) ----
CREATE FUNCTION "public"."nvq_phan_quyen_dat"("p_tai_khoan" uuid, "p_bat" boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a "public"."accounts";
BEGIN
  IF NOT (coalesce("public"."me_is_chief"(), false) OR coalesce("public"."me_quan_tri_he_thong"(), false)) THEN
    RAISE EXCEPTION 'Chỉ Chánh Văn phòng hoặc quản trị hệ thống mới chỉ định đầu mối tổng hợp nhiệm vụ quý.' USING ERRCODE = '42501';
  END IF;
  IF NOT coalesce("public"."me_is_chief"(), false) AND "p_tai_khoan" = "auth"."uid"() THEN   -- quản trị hệ thống không tự chỉ định mình
    RAISE EXCEPTION 'Quản trị hệ thống không tự chỉ định mình làm đầu mối — đề nghị Chánh Văn phòng.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO a FROM "public"."accounts" WHERE "id" = "p_tai_khoan";
  IF a."id" IS NULL OR a."is_system" OR a."role_group" = 'A0' OR coalesce(a."bi_khoa", false) THEN
    RAISE EXCEPTION 'Chọn cán bộ Văn phòng đang hoạt động.' USING ERRCODE = '22023';
  END IF;
  IF "p_bat" THEN
    INSERT INTO "public"."nvq_phan_quyen" ("tai_khoan", "tao_boi") VALUES (a."id", "auth"."uid"()) ON CONFLICT ("tai_khoan") DO NOTHING;
  ELSE
    DELETE FROM "public"."nvq_phan_quyen" WHERE "tai_khoan" = a."id";
  END IF;
  PERFORM "public"."nvq_ghi_lich_su"(NULL, NULL, 'phan_quyen', format('%s đầu mối tổng hợp nhiệm vụ quý: %s', CASE WHEN "p_bat" THEN 'Chỉ định' ELSE 'Thôi chỉ định' END, a."full_name"));
END;
$$;

-- ---- 5. Danh mục lãnh đạo phụ trách / đơn vị tham mưu (thêm, sửa tên, thứ tự, từ nhận diện, ngừng dùng) ----
CREATE FUNCTION "public"."nvq_danh_muc_luu"("p_bang" text, "p" jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ma text := upper(btrim(coalesce("p" ->> 'ma', ''))); v_ten text := btrim(coalesce("p" ->> 'ten', ''));
        v_tk text[] := ARRAY(SELECT lower(btrim(x)) FROM jsonb_array_elements_text(coalesce("p" -> 'tu_khoa', '[]')) x WHERE btrim(x) <> '');
BEGIN
  PERFORM "public"."nvq_can_quan_ly"();
  IF v_ma !~ '^[A-Z0-9_]{2,30}$' OR char_length(v_ten) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Mã (chữ hoa, số, gạch dưới) và tên bắt buộc.' USING ERRCODE = '22023'; END IF;
  IF "p_bang" = 'lanh_dao' THEN
    INSERT INTO "public"."nvq_lanh_dao" ("ma", "ten", "thu_tu", "thuong_truc", "tap_the", "tu_khoa", "dang_dung")
    VALUES (v_ma, v_ten, coalesce(nullif("p" ->> 'thu_tu', '')::smallint, 50), coalesce(("p" ->> 'thuong_truc')::boolean, false),
            coalesce(("p" ->> 'tap_the')::boolean, false), v_tk, coalesce(("p" ->> 'dang_dung')::boolean, true))
    ON CONFLICT ("ma") DO UPDATE SET "ten" = EXCLUDED."ten", "thu_tu" = EXCLUDED."thu_tu", "thuong_truc" = EXCLUDED."thuong_truc",
      "tap_the" = EXCLUDED."tap_the", "tu_khoa" = EXCLUDED."tu_khoa", "dang_dung" = EXCLUDED."dang_dung";
  ELSIF "p_bang" = 'don_vi' THEN
    INSERT INTO "public"."nvq_don_vi" ("ma", "ten", "thu_tu", "tu_khoa", "dang_dung")
    VALUES (v_ma, v_ten, coalesce(nullif("p" ->> 'thu_tu', '')::smallint, 50), v_tk, coalesce(("p" ->> 'dang_dung')::boolean, true))
    ON CONFLICT ("ma") DO UPDATE SET "ten" = EXCLUDED."ten", "thu_tu" = EXCLUDED."thu_tu", "tu_khoa" = EXCLUDED."tu_khoa", "dang_dung" = EXCLUDED."dang_dung";
  ELSE
    RAISE EXCEPTION 'Danh mục không hợp lệ.' USING ERRCODE = '22023';
  END IF;
  PERFORM "public"."nvq_ghi_lich_su"(NULL, NULL, 'danh_muc', format('Danh mục %s: %s — %s', CASE WHEN "p_bang" = 'lanh_dao' THEN 'lãnh đạo phụ trách' ELSE 'đơn vị tham mưu' END, v_ma, v_ten));
END;
$$;
