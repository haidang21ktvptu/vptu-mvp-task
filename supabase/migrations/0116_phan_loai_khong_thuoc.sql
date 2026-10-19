-- 0116 (v3.26.0 — chủ dự án duyệt kế hoạch 19/10/2026): phân loại nhiệm vụ đúng cho Tổng quan khối 2 (mục tiêu then chốt) và khối 3 (lĩnh vực trọng tâm).
-- Trước 0116 không ghi được "không thuộc": ngành trống = chưa phân ngành, mục tiêu trống = tính theo văn bản; việc đã hoàn thành không ai sửa được ngành,
-- lĩnh vực (0096 thu quyền quản trị nhiệm vụ); nhập Excel chỉ cập nhật việc đang mở, cột mục tiêu chỉ áp khi tạo việc mới.
-- 1. "Không thuộc" là một dòng CỐ ĐỊNH của danh mục (không thêm cột): khối KHONG_THUOC, ngành KHONG_THUOC + lĩnh vực LV99_KHONG_THUOC, nhóm và mục tiêu
--    KHONG_THUOC — đi qua đúng các hàm đang có (giao_viec, giao_viec_nhieu, nhập Excel, sửa thông tin giao, gan_muc_tieu…); không viết lại hàm giao việc.
-- 2. Khoá (người dùng; migration / service không bị chặn): không sửa, không xoá các dòng này; không thêm lĩnh vực vào ngành "Không thuộc", không thêm mục
--    tiêu vào nhóm "Không thuộc", không gộp vào, không đưa ngành / lĩnh vực khác vào khối "Không thuộc" (trigger); không phân công kiêm nhiệm, không đặt
--    quy tắc nhận diện cho mục "Không thuộc" (CHECK).
-- 3. Việc của Kết luận BTV / Thông báo Thường trực không nhận ngành "Không thuộc" (quy tắc 1400: phải có ngành, lĩnh vực cụ thể) — trigger, mọi đường ghi.
-- 4. Mục tiêu "Không thuộc" không đi cùng mục tiêu khác ở cùng một việc / văn bản (trigger AFTER — gan_muc_tieu xoá mục cũ trước khi chèn tập mới).
-- 5. kl_tu_gan_muc_tieu_viec (nhập Excel, tự nhận diện; bản 0110 + 3 chỗ): văn bản "Không thuộc" mà quy tắc chắc tìm ra mục tiêu → việc nhận riêng mục đó.
--    kl_dong_nhap_gan_muc_tieu (nhập Excel có ghi mục tiêu; bản 0110 + 1 dòng): dòng ghi cả "Không thuộc" lẫn mục khác → giữ mục thật (trigger ở
--    ngoài khối bắt lỗi từng dòng của nhap_excel_dong — lỗi ở đây làm hỏng cả lượt ghi).
-- 6. ai_can_hoc (bản 0112 + 1 điều kiện): bộ tự học không học mục "Không thuộc".
-- 7. ra_soat_phan_loai(p, p_ly_do, p_ap): rà soát phân loại hàng loạt từ tệp (≤ 200 dòng một lượt) — p_ap = false: xem trước (không ghi); true: ghi.
--    Ghi được cả việc đã hoàn thành; chỉ ngành, lĩnh vực, mục tiêu; quyền từng dòng như gan_muc_tieu (người giao, người nhập việc, lãnh đạo phụ trách,
--    toàn quyền); kiểm như sửa thông tin giao (kl_thay_doi_giao); ghi qua kl_ap_thong_tin_giao + gan_muc_tieu (nguồn RA_SOAT); diễn biến có lý do;
--    KHÔNG gửi tin; cảnh báo khi đổi lãnh đạo kiêm nhiệm phụ trách; việc ngoài quyền chỉ trả mã + lỗi (không lộ nội dung).
-- Kiểm thử: tests/rls/kl-0116-phan-loai.test.mjs.

-- ---- 1. Danh mục giữ chỗ ----
INSERT INTO "public"."dm_khoi_linh_vuc" ("ma", "ten", "thu_tu") VALUES ('KHONG_THUOC', 'Không thuộc lĩnh vực trọng tâm', 99);
INSERT INTO "public"."dm_nganh" ("ma", "ten", "thu_tu", "khoi_ma") VALUES ('KHONG_THUOC', 'Không thuộc ngành, lĩnh vực nào', 99, 'KHONG_THUOC');
INSERT INTO "public"."dm_linh_vuc" ("ma", "nganh_ma", "ten", "thu_tu") VALUES ('LV99_KHONG_THUOC', 'KHONG_THUOC', 'Không thuộc lĩnh vực nào', 1);
INSERT INTO "public"."dm_nhom_muc_tieu" ("ma", "ten", "tab", "mau_so_hieu", "thu_tu") VALUES ('KHONG_THUOC', 'Không thuộc mục tiêu then chốt', 'Không thuộc', NULL, 99);
INSERT INTO "public"."dm_muc_tieu" ("ma", "nhom", "ten", "ten_ngan", "mo_ta", "thu_tu", "trang_thai", "nguon_them")
VALUES ('KHONG_THUOC', 'KHONG_THUOC', 'Không thuộc mục tiêu then chốt nào', 'Không thuộc mục tiêu then chốt',
        'Nhiệm vụ không phục vụ trực tiếp mục tiêu then chốt nào của danh mục', 1, 'DA_DOI_CHIEU', 'KHOI_TAO');

-- ---- 2. Khoá mục giữ chỗ ----
-- TG_ARGV[0] = mã dòng giữ chỗ của bảng; TG_ARGV[1..] = cột "cha" không được trỏ tới 'KHONG_THUOC' (ngành của lĩnh vực, khối, nhóm, gộp vào).
CREATE FUNCTION "public"."kl_giu_muc_khong_thuoc"() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_moi jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END; i integer;
BEGIN
  IF "auth"."uid"() IS NULL THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;   -- migration, service: cho qua
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD."ma" = TG_ARGV[0] THEN
    RAISE EXCEPTION 'Mục "Không thuộc" là mục cố định của hệ thống — không sửa, không xoá.' USING ERRCODE = '42501';
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    FOR i IN 1 .. TG_NARGS - 1 LOOP
      IF v_moi ->> TG_ARGV[i] = 'KHONG_THUOC' THEN
        RAISE EXCEPTION 'Không đưa mục khác vào nhóm "Không thuộc" của danh mục.' USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_giu_muc_khong_thuoc"() FROM public, "anon", "authenticated";
CREATE TRIGGER "bf_dm_khoi_khong_thuoc" BEFORE INSERT OR UPDATE OR DELETE ON "public"."dm_khoi_linh_vuc"
  FOR EACH ROW EXECUTE FUNCTION "public"."kl_giu_muc_khong_thuoc"('KHONG_THUOC');
CREATE TRIGGER "bf_dm_nganh_khong_thuoc" BEFORE INSERT OR UPDATE OR DELETE ON "public"."dm_nganh"
  FOR EACH ROW EXECUTE FUNCTION "public"."kl_giu_muc_khong_thuoc"('KHONG_THUOC', 'khoi_ma');
CREATE TRIGGER "bf_dm_linh_vuc_khong_thuoc" BEFORE INSERT OR UPDATE OR DELETE ON "public"."dm_linh_vuc"
  FOR EACH ROW EXECUTE FUNCTION "public"."kl_giu_muc_khong_thuoc"('LV99_KHONG_THUOC', 'nganh_ma', 'khoi_ma');
CREATE TRIGGER "bf_dm_nhom_muc_tieu_khong_thuoc" BEFORE INSERT OR UPDATE OR DELETE ON "public"."dm_nhom_muc_tieu"
  FOR EACH ROW EXECUTE FUNCTION "public"."kl_giu_muc_khong_thuoc"('KHONG_THUOC');
CREATE TRIGGER "bf_dm_muc_tieu_khong_thuoc" BEFORE INSERT OR UPDATE OR DELETE ON "public"."dm_muc_tieu"
  FOR EACH ROW EXECUTE FUNCTION "public"."kl_giu_muc_khong_thuoc"('KHONG_THUOC', 'nhom', 'gop_vao');
ALTER TABLE "public"."phu_trach_phong" ADD CONSTRAINT "phu_trach_phong_khong_thuoc_check" CHECK ("nganh_ma" IS DISTINCT FROM 'KHONG_THUOC');
ALTER TABLE "public"."quy_tac_muc_tieu" ADD CONSTRAINT "quy_tac_muc_tieu_khong_thuoc_check"
  CHECK ("muc_tieu_ma" <> 'KHONG_THUOC' AND NOT ("loai" IN ('NGANH', 'LINH_VUC') AND "gia_tri" IN ('KHONG_THUOC', 'LV99_KHONG_THUOC')));

-- ---- 3. Kết luận BTV / Thông báo Thường trực: không nhận ngành "Không thuộc" ----
CREATE FUNCTION "public"."kl_nhiem_vu_khong_thuoc_kl"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW."nganh_ma" = 'KHONG_THUOC'
     AND EXISTS (SELECT 1 FROM "public"."van_ban_giao_viec" b WHERE b."id" = NEW."van_ban_id" AND b."loai" IN ('KL_BTV', 'TB_THUONG_TRUC')) THEN
    RAISE EXCEPTION 'Việc từ Kết luận Ban Thường vụ / Thông báo Thường trực phải có ngành, lĩnh vực cụ thể (không chọn "Không thuộc").' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_nhiem_vu_khong_thuoc_kl"() FROM public, "anon", "authenticated";
CREATE TRIGGER "bf_nhiem_vu_khong_thuoc_kl" BEFORE INSERT OR UPDATE OF "nganh_ma", "van_ban_id" ON "public"."nhiem_vu"
  FOR EACH ROW EXECUTE FUNCTION "public"."kl_nhiem_vu_khong_thuoc_kl"();

-- ---- 4. Mục tiêu "Không thuộc" đứng riêng ----
CREATE FUNCTION "public"."kl_muc_tieu_khong_thuoc_rieng"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n integer; v_k integer;
BEGIN
  IF TG_TABLE_NAME = 'nhiem_vu_muc_tieu' THEN
    SELECT count(*), count(*) FILTER (WHERE m."muc_tieu_ma" = 'KHONG_THUOC') INTO v_n, v_k
    FROM "public"."nhiem_vu_muc_tieu" m WHERE m."nhiem_vu_id" = NEW."nhiem_vu_id";
  ELSE
    SELECT count(*), count(*) FILTER (WHERE m."muc_tieu_ma" = 'KHONG_THUOC') INTO v_n, v_k
    FROM "public"."van_ban_muc_tieu" m WHERE m."van_ban_id" = NEW."van_ban_id";
  END IF;
  IF v_k > 0 AND v_n > v_k THEN
    RAISE EXCEPTION '"Không thuộc mục tiêu then chốt" không chọn cùng mục tiêu khác.' USING ERRCODE = '22023';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_muc_tieu_khong_thuoc_rieng"() FROM public, "anon", "authenticated";
CREATE TRIGGER "af_nhiem_vu_muc_tieu_khong_thuoc" AFTER INSERT OR UPDATE OF "muc_tieu_ma" ON "public"."nhiem_vu_muc_tieu"
  FOR EACH ROW EXECUTE FUNCTION "public"."kl_muc_tieu_khong_thuoc_rieng"();
CREATE TRIGGER "af_van_ban_muc_tieu_khong_thuoc" AFTER INSERT OR UPDATE OF "muc_tieu_ma" ON "public"."van_ban_muc_tieu"
  FOR EACH ROW EXECUTE FUNCTION "public"."kl_muc_tieu_khong_thuoc_rieng"();

-- ---- 5. Tự gắn khi nhập Excel (bản 0110; 0116: mục "Không thuộc" của văn bản không chép sang việc khi quy tắc chắc tìm ra mục tiêu) ----
CREATE OR REPLACE FUNCTION "public"."kl_tu_gan_muc_tieu_viec"("p_id" uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n "public"."nhiem_vu"; v "public"."van_ban_giao_viec"; kq jsonb; g jsonb; v_vb text[]; v_them text[] := '{}'; v_ly jsonb := '{}'; r jsonb; v_n integer;
BEGIN
  SELECT * INTO n FROM "public"."nhiem_vu" WHERE "id" = "p_id";
  IF n."id" IS NULL OR EXISTS (SELECT 1 FROM "public"."nhiem_vu_muc_tieu" WHERE "nhiem_vu_id" = n."id") THEN RETURN 0; END IF;
  SELECT * INTO v FROM "public"."van_ban_giao_viec" WHERE "id" = n."van_ban_id";
  kq := "public"."goi_y_muc_tieu"(jsonb_build_object('van_ban_id', n."van_ban_id", 'so_hieu_van_ban', v."so_ket_luan", 'trich_yeu', v."trich_yeu",
          'noi_dung', n."noi_dung", 'san_pham_mo_ta', n."san_pham_mo_ta", 'nganh', n."nganh_ma", 'linh_vuc', n."linh_vuc_ma"));
  -- Mọi mục của văn bản (kể cả mục đã ngừng dùng — việc đang tính theo các mục đó); 0116: trừ mục "Không thuộc"
  SELECT coalesce(array_agg(m."muc_tieu_ma" ORDER BY m."muc_tieu_ma"), '{}') INTO v_vb FROM "public"."van_ban_muc_tieu" m
  WHERE m."van_ban_id" = n."van_ban_id" AND m."muc_tieu_ma" <> 'KHONG_THUOC';
  FOR g IN SELECT x FROM jsonb_array_elements(coalesce(kq -> 'goi_y', '[]')) x
           WHERE x ->> 'muc' = 'TU_TICH' AND x ->> 'ma' <> 'KHONG_THUOC' AND NOT (x ->> 'ma' = ANY (v_vb)) LOOP
    v_them := v_them || (g ->> 'ma'); v_ly := v_ly || jsonb_build_object(g ->> 'ma', "public"."kl_mo_ta_ly_do"(g -> 'ly_do' -> 0));
  END LOOP;
  FOR g IN SELECT x FROM jsonb_array_elements(CASE WHEN jsonb_typeof(kq -> 'so_hieu_moi') = 'array' THEN kq -> 'so_hieu_moi' ELSE '[]' END) x LOOP
    BEGIN
      r := "public"."them_muc_tieu_tu_dong"(g ->> 'so_hieu', g ->> 've');
      IF r ->> 'ma' IS NOT NULL AND NOT (r ->> 'ma' = ANY (v_them || v_vb)) THEN
        v_them := v_them || (r ->> 'ma');
        v_ly := v_ly || jsonb_build_object(r ->> 'ma', left('số hiệu ' || (g ->> 'so_hieu') || ' trong nội dung' || coalesce(' — ' || (g ->> 've'), ''), 300));
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;   -- số hiệu không thêm được (sai dạng, ngừng dùng, quá hạn mức…): bỏ qua, không làm hỏng lô nhập
    END;
  END LOOP;
  v_them := v_them[1:greatest(0, 10 - cardinality(v_vb))];
  IF cardinality(v_them) = 0 THEN RETURN 0; END IF;   -- không có gì ngoài mục tiêu của văn bản: việc tính theo văn bản
  INSERT INTO "public"."nhiem_vu_muc_tieu" ("nhiem_vu_id", "muc_tieu_ma", "gan_boi", "nguon", "ly_do")
  SELECT n."id", m."muc_tieu_ma", "auth"."uid"(), m."nguon", coalesce(m."ly_do", 'theo mục tiêu của văn bản') FROM "public"."van_ban_muc_tieu" m
  WHERE m."van_ban_id" = n."van_ban_id" AND m."muc_tieu_ma" <> 'KHONG_THUOC'
  UNION ALL
  SELECT n."id", x, "auth"."uid"(), 'QUY_TAC', v_ly ->> x FROM unnest(v_them) x WHERE EXISTS (SELECT 1 FROM "public"."dm_muc_tieu" d WHERE d."ma" = x AND d."dang_dung")
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n > 0 THEN
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon")
    VALUES (n."id", "auth"."uid"(), 'gan_muc_tieu', NULL, 'Gắn mục tiêu then chốt (nhập Excel, tự nhận diện): ' || "public"."kl_ten_muc_tieu"(v_vb || v_them), 'excel');
  END IF;
  RETURN v_n;
END;
$$;

-- Nhập Excel có ghi mục tiêu (bản 0110; 0116: "Không thuộc" đi cùng mục khác thì bỏ "Không thuộc")
CREATE OR REPLACE FUNCTION "public"."kl_dong_nhap_gan_muc_tieu"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ma text[]; v_ng jsonb;
BEGIN
  IF NEW."nhiem_vu_id" IS NULL OR NEW."ket_qua" NOT IN ('GIAO', 'DA_XONG', 'CHO_NGHIEM_THU') THEN RETURN NULL; END IF;
  IF jsonb_typeof(NEW."du_lieu" -> 'muc_tieu_ma') IS DISTINCT FROM 'array' THEN
    IF NEW."du_lieu" ->> 'tu_gan_muc_tieu' = 'true' THEN PERFORM "public"."kl_tu_gan_muc_tieu_viec"(NEW."nhiem_vu_id"); END IF;
    RETURN NULL;
  END IF;
  SELECT (array_agg(DISTINCT d."ma" ORDER BY d."ma"))[1:10] INTO v_ma
  FROM jsonb_array_elements_text(NEW."du_lieu" -> 'muc_tieu_ma') x(ma) JOIN "public"."dm_muc_tieu" d ON d."ma" = btrim(x.ma) AND d."dang_dung";
  IF cardinality(v_ma) > 1 THEN v_ma := array_remove(v_ma, 'KHONG_THUOC'); END IF;   -- 0116
  IF v_ma IS NULL OR cardinality(v_ma) = 0 THEN RETURN NULL; END IF;
  v_ng := CASE WHEN jsonb_typeof(NEW."du_lieu" -> 'muc_tieu_nguon') = 'object' THEN NEW."du_lieu" -> 'muc_tieu_nguon' ELSE '{}' END;
  INSERT INTO "public"."nhiem_vu_muc_tieu" ("nhiem_vu_id", "muc_tieu_ma", "gan_boi", "nguon")
  SELECT NEW."nhiem_vu_id", u, "auth"."uid"(), CASE WHEN v_ng ->> u IN ('QUY_TAC', 'GOI_Y', 'AI') THEN v_ng ->> u ELSE 'EXCEL' END FROM unnest(v_ma) u ON CONFLICT DO NOTHING;
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon")
  VALUES (NEW."nhiem_vu_id", "auth"."uid"(), 'gan_muc_tieu', NULL, 'Gắn mục tiêu then chốt (nhập Excel): ' || "public"."kl_ten_muc_tieu"(v_ma), 'excel');
  RETURN NULL;
END;
$$;

-- ---- 6. Bộ tự học (bản 0112 + bỏ nhóm "Không thuộc") ----
CREATE OR REPLACE FUNCTION "public"."ai_can_hoc"("p_gioi_han" integer DEFAULT 10) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(x."ma"), '[]') FROM (
    SELECT d."ma" FROM "public"."dm_muc_tieu" d
    WHERE d."dang_dung" AND d."nhom" <> 'KHONG_THUOC' AND (d."hoc_ai_luc" IS NULL
      OR EXISTS (SELECT 1 FROM "public"."phan_hoi_goi_y" p JOIN "public"."quy_tac_muc_tieu" q ON q."id" = p."quy_tac_id" WHERE q."muc_tieu_ma" = d."ma" AND p."luc" > d."hoc_ai_luc")
      OR EXISTS (SELECT 1 FROM "public"."nhiem_vu_muc_tieu" m WHERE m."muc_tieu_ma" = d."ma" AND m."gan_luc" > d."hoc_ai_luc" AND m."nguon" IN ('CHON', 'RA_SOAT')))
    ORDER BY d."hoc_ai_luc" NULLS FIRST, d."thu_tu" LIMIT least(greatest(coalesce("p_gioi_han", 10), 1), 50)) x;
$$;

-- ---- 7. Rà soát phân loại từ tệp ----
CREATE FUNCTION "public"."kl_ten_phan_loai"("p_nganh" text, "p_linh_vuc" text) RETURNS text
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT format('Ngành: %s; lĩnh vực: %s', coalesce((SELECT n."ten" FROM "public"."dm_nganh" n WHERE n."ma" = "p_nganh"), '(chưa phân loại)'),
                coalesce((SELECT l."ten" FROM "public"."dm_linh_vuc" l WHERE l."ma" = "p_linh_vuc"), '(chưa có)'));
$$;
REVOKE ALL ON FUNCTION "public"."kl_ten_phan_loai"(text, text) FROM public, "anon", "authenticated";

-- p: [{ "ma": "NV-…", "nganh": mã | trống (giữ), "linh_vuc": mã | trống (giữ; đổi sang ngành chỉ có một lĩnh vực thì lấy lĩnh vực đó),
--       "muc_tieu": [mã…] | ["KHONG_THUOC"] | trống (giữ), "ly_do": lý do của dòng }]. Trả mảng theo thứ tự dòng: { ma, id, ket_qua DOI | GIU | LOI, loi,
--      canh_bao, doi: [cột đổi], noi_dung, da_xong, cu, moi } — việc không có / ngoài quyền: chỉ ma + LOI.
CREATE FUNCTION "public"."ra_soat_phan_loai"("p" jsonb, "p_ly_do" text, "p_ap" boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  x jsonb; v "public"."nhiem_vu"; v_me uuid := "auth"."uid"(); v_ly text := btrim(coalesce("p_ly_do", '')); v_kq jsonb := '[]'::jsonb;
  v_ma text; v_loi text; v_canh text; v_doi text[]; v_thay jsonb; v_moi jsonb; v_ng text; v_lv text; v_lv1 text; v_loai_vb text;
  v_rieng text[]; v_vb text[]; v_cu text[]; v_mt text[]; v_sai text; v_ly_dong text; v_ph text; v_ld_cu uuid; v_ld_moi uuid;
BEGIN
  IF v_me IS NULL OR "public"."kl_quyen_muc_tieu"() IS NULL OR "public"."me_role"() IS NOT DISTINCT FROM 'A0' THEN
    RAISE EXCEPTION 'Tài khoản này không rà soát phân loại được (Thường trực, tài khoản hệ thống hoặc đã khoá).' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof("p") IS DISTINCT FROM 'array' OR jsonb_array_length("p") = 0 THEN RAISE EXCEPTION 'Chưa có dòng nào để rà soát.' USING ERRCODE = '22023'; END IF;
  IF jsonb_array_length("p") > 200 THEN RAISE EXCEPTION 'Mỗi lượt rà soát tối đa 200 dòng.' USING ERRCODE = '22023'; END IF;
  IF "p_ap" AND (v_ly = '' OR char_length(v_ly) > 500) THEN RAISE EXCEPTION 'Lý do rà soát bắt buộc, tối đa 500 ký tự.' USING ERRCODE = '22023'; END IF;
  FOR x IN SELECT e FROM jsonb_array_elements("p") e LOOP
    v := NULL; v_loi := NULL; v_canh := NULL; v_doi := '{}'; v_thay := '{}'; v_moi := '{}'; v_ng := NULL; v_lv := NULL; v_lv1 := NULL;
    v_rieng := '{}'; v_vb := '{}'; v_cu := '{}'; v_mt := NULL; v_sai := NULL; v_loai_vb := NULL;
    v_ma := upper(btrim(coalesce(CASE WHEN jsonb_typeof(x) = 'object' THEN x ->> 'ma' END, '')));
    BEGIN
      IF v_ma = '' THEN RAISE EXCEPTION 'Dòng không có mã nhiệm vụ.' USING ERRCODE = '22023'; END IF;
      IF "p_ap" THEN SELECT * INTO v FROM "public"."nhiem_vu" WHERE "ma" = v_ma FOR UPDATE;
      ELSE SELECT * INTO v FROM "public"."nhiem_vu" WHERE "ma" = v_ma; END IF;
      IF v."id" IS NULL OR NOT (coalesce("public"."kl_la_tang_giao"(v), false)
           OR (coalesce("public"."me_role"() IN ('A1', 'A2'), false) AND coalesce("public"."kl_lanh_dao_pham_vi"(v."id"), false))) THEN
        v := NULL;   -- cùng một câu cho "không có" và "ngoài quyền": không lộ việc người gọi không phân loại được
        RAISE EXCEPTION 'Không có nhiệm vụ % trong phạm vi đồng chí phân loại được (người giao, người nhập việc, lãnh đạo phụ trách).', v_ma USING ERRCODE = '42501';
      END IF;
      SELECT b."loai" INTO v_loai_vb FROM "public"."van_ban_giao_viec" b WHERE b."id" = v."van_ban_id";
      -- Ngành, lĩnh vực: ô trống = giữ nguyên
      v_ng := coalesce(nullif(btrim(coalesce(x ->> 'nganh', '')), ''), v."nganh_ma");
      v_lv := nullif(btrim(coalesce(x ->> 'linh_vuc', '')), '');
      IF v_lv IS NULL THEN
        v_lv := v."linh_vuc_ma";
        IF v_ng IS DISTINCT FROM v."nganh_ma" THEN
          SELECT min(l."ma") INTO v_lv1 FROM "public"."dm_linh_vuc" l WHERE l."nganh_ma" = v_ng HAVING count(*) = 1;
          v_lv := coalesce(v_lv1, v_lv);
        END IF;
      END IF;
      IF v_ng = 'KHONG_THUOC' AND v_loai_vb IN ('KL_BTV', 'TB_THUONG_TRUC') THEN
        RAISE EXCEPTION 'Việc từ Kết luận Ban Thường vụ / Thông báo Thường trực phải có ngành, lĩnh vực cụ thể (không chọn "Không thuộc").' USING ERRCODE = '22023';
      END IF;
      IF v_ng IS DISTINCT FROM v."nganh_ma" THEN v_thay := v_thay || jsonb_build_object('nganh_ma', v_ng); END IF;
      IF v_lv IS DISTINCT FROM v."linh_vuc_ma" THEN v_thay := v_thay || jsonb_build_object('linh_vuc_ma', v_lv); END IF;
      IF v_thay <> '{}'::jsonb THEN
        v_moi := "public"."kl_thay_doi_giao"(v, v_thay);   -- danh mục, lĩnh vực thuộc ngành, quy tắc 1400 — như Sửa thông tin giao
        v_doi := v_doi || ARRAY(SELECT k FROM jsonb_object_keys(v_moi) k ORDER BY k);
      END IF;
      -- Mục tiêu: gắn riêng nếu có, không thì theo văn bản; ô trống = giữ nguyên
      SELECT coalesce(array_agg(m."muc_tieu_ma" ORDER BY m."muc_tieu_ma"), '{}') INTO v_rieng FROM "public"."nhiem_vu_muc_tieu" m WHERE m."nhiem_vu_id" = v."id";
      SELECT coalesce(array_agg(m."muc_tieu_ma" ORDER BY m."muc_tieu_ma"), '{}') INTO v_vb FROM "public"."van_ban_muc_tieu" m WHERE m."van_ban_id" = v."van_ban_id";
      v_cu := CASE WHEN cardinality(v_rieng) > 0 THEN v_rieng ELSE v_vb END;
      IF jsonb_typeof(x -> 'muc_tieu') = 'array' AND jsonb_array_length(x -> 'muc_tieu') > 0 THEN
        SELECT coalesce(array_agg(DISTINCT btrim(e) ORDER BY btrim(e)), '{}') INTO v_mt FROM jsonb_array_elements_text(x -> 'muc_tieu') e WHERE btrim(e) <> '';
        IF cardinality(v_mt) > 10 THEN RAISE EXCEPTION 'Mỗi việc gắn tối đa 10 mục tiêu then chốt.' USING ERRCODE = '22023'; END IF;
        IF 'KHONG_THUOC' = ANY (v_mt) AND cardinality(v_mt) > 1 THEN
          RAISE EXCEPTION '"Không thuộc mục tiêu then chốt" không chọn cùng mục tiêu khác.' USING ERRCODE = '22023';
        END IF;
        SELECT string_agg(m, ', ') INTO v_sai FROM unnest(v_mt) m
        WHERE NOT EXISTS (SELECT 1 FROM "public"."dm_muc_tieu" d WHERE d."ma" = m AND (d."dang_dung" OR m = ANY (v_rieng || v_vb)));
        IF v_sai IS NOT NULL THEN RAISE EXCEPTION 'Mục tiêu không có trong danh mục hoặc đã ngừng dùng: %.', v_sai USING ERRCODE = '22023'; END IF;
        IF cardinality(v_mt) > 0 AND v_mt IS DISTINCT FROM v_cu THEN v_doi := v_doi || 'muc_tieu'::text; END IF;
      END IF;
      -- Cảnh báo: phạm vi xem của Phó Chánh VP đi theo kiêm nhiệm (phòng, ngành, lĩnh vực) — đổi ngành / lĩnh vực có thể đổi lãnh đạo phụ trách
      IF v_thay <> '{}'::jsonb THEN
        FOR v_ph IN SELECT DISTINCT y FROM unnest(ARRAY["public"."kl_phong_owner"(v."owner_tai_khoan", v."owner_don_vi_ma"),
                      (SELECT a."department" FROM "public"."accounts" a WHERE a."id" = v."nguoi_theo_doi")]) y WHERE y IS NOT NULL LOOP
          v_ld_cu := "public"."nguoi_kiem_nhiem"(v_ph, v."nganh_ma", v."linh_vuc_ma");
          v_ld_moi := "public"."nguoi_kiem_nhiem"(v_ph, v_ng, v_lv);
          IF v_ld_cu IS DISTINCT FROM v_ld_moi THEN
            v_canh := concat_ws('; ', v_canh, format('Đổi lãnh đạo phụ trách theo kiêm nhiệm: %s → %s',
              coalesce('Đ/c ' || (SELECT a."full_name" FROM "public"."accounts" a WHERE a."id" = v_ld_cu), 'lãnh đạo phụ trách cả phòng'),
              coalesce('Đ/c ' || (SELECT a."full_name" FROM "public"."accounts" a WHERE a."id" = v_ld_moi), 'lãnh đạo phụ trách cả phòng')));
          END IF;
        END LOOP;
      END IF;
      IF "p_ap" AND cardinality(v_doi) > 0 THEN
        v_ly_dong := left(nullif(btrim(coalesce(x ->> 'ly_do', '')), ''), 300);
        IF v_moi <> '{}'::jsonb THEN PERFORM "public"."kl_ap_thong_tin_giao"(v."id", v_moi); END IF;   -- không gửi tin (khác sua_thong_tin_giao)
        IF 'muc_tieu' = ANY (v_doi) THEN
          PERFORM "public"."gan_muc_tieu"(v."id", v_mt,
            (SELECT jsonb_object_agg(m, jsonb_build_object('nguon', 'RA_SOAT', 'ly_do', left(coalesce(v_ly_dong, v_ly), 300))) FROM unnest(v_mt) m));
        END IF;
        -- Một dòng diễn biến cho mỗi việc đổi (ngành – lĩnh vực và / hoặc mục tiêu), kèm lý do chung + lý do của dòng
        INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon")
        VALUES (v."id", v_me, 'ra_soat_phan_loai',
          concat_ws(' · ', CASE WHEN v_moi <> '{}'::jsonb THEN "public"."kl_ten_phan_loai"(v."nganh_ma", v."linh_vuc_ma") END,
                    CASE WHEN 'muc_tieu' = ANY (v_doi) THEN 'Mục tiêu: ' || coalesce("public"."kl_ten_muc_tieu"(v_cu), '(chưa phân loại)') END),
          format('%s — lý do: %s', concat_ws(' · ', CASE WHEN v_moi <> '{}'::jsonb THEN "public"."kl_ten_phan_loai"(v_ng, v_lv) END,
                    CASE WHEN 'muc_tieu' = ANY (v_doi) THEN 'Mục tiêu: ' || coalesce("public"."kl_ten_muc_tieu"(v_mt), '') END), concat_ws(' · ', v_ly, v_ly_dong)), 'app');
      END IF;
    EXCEPTION WHEN OTHERS THEN v_loi := SQLERRM;
    END;
    v_kq := v_kq || jsonb_build_array(jsonb_build_object(
      'ma', coalesce(v."ma", nullif(v_ma, '')), 'id', v."id",
      'ket_qua', CASE WHEN v_loi IS NOT NULL THEN 'LOI' WHEN cardinality(v_doi) > 0 THEN 'DOI' ELSE 'GIU' END,
      'loi', v_loi, 'canh_bao', CASE WHEN v_loi IS NULL THEN v_canh END, 'doi', CASE WHEN v_loi IS NULL THEN to_jsonb(v_doi) ELSE '[]'::jsonb END,
      'noi_dung', left(v."noi_dung", 200), 'da_xong', CASE WHEN v."id" IS NOT NULL THEN v."tien_do_ma" = 'HOAN_THANH' END,
      'cu', CASE WHEN v."id" IS NOT NULL THEN jsonb_build_object('nganh', v."nganh_ma", 'linh_vuc', v."linh_vuc_ma", 'muc_tieu', to_jsonb(v_cu),
              'theo_vb', cardinality(v_rieng) = 0 AND cardinality(v_vb) > 0) END,
      'moi', CASE WHEN v."id" IS NOT NULL AND v_loi IS NULL THEN jsonb_build_object('nganh', v_ng, 'linh_vuc', v_lv,
              'muc_tieu', to_jsonb(CASE WHEN cardinality(coalesce(v_mt, '{}')) > 0 THEN v_mt ELSE v_cu END)) END));
  END LOOP;
  RETURN v_kq;
END;
$$;
REVOKE ALL ON FUNCTION "public"."ra_soat_phan_loai"(jsonb, text, boolean) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."ra_soat_phan_loai"(jsonb, text, boolean) TO "authenticated";
