-- 0053: Danh mục ngày nghỉ (PR-2b, thiết kế A1–A2) — nghỉ lễ, nghỉ bù, ngày làm bù (T7/CN đi làm). Q10: migration để trống, quản trị nhập sau.
-- Hiệu năng (bổ sung A 30/9): ngày nghỉ đọc MỘT lần mỗi lời gọi/truy vấn thành hai mảng (kl_ngay_nghi, kl_ngay_lam_bu); phép tính ngày làm việc
-- là hàm THUẦN (IMMUTABLE) nhận mảng ⇒ hàm quét nhiều dòng (canh_bao_quet) đọc mảng một lần rồi gọi bản *_mang, không đọc bảng theo từng dòng.
-- Bản hai tham số cũ (ngay_lam_viec_sau, gio_lam_viec_sau) giữ chữ ký, đổi IMMUTABLE → STABLE (nay đọc danh mục). Rà 30/9: chỉ chi_dao_gui (hạn phản hồi)
-- và canh_bao_quet gọi hai hàm này; không index, cột sinh, DEFAULT, CHECK hay view nào dùng chúng.
-- Ghi danh mục chỉ qua qt_dat_ngay_nghi: allowlist quan_tri_he_thong ∨ Chánh VP (như qt_dat_cau_hinh), lý do bắt buộc, ghi nhat_ky_he_thong.

CREATE TABLE "public"."dm_ngay_nghi" (
  "ngay" date PRIMARY KEY,
  "loai" text NOT NULL CHECK ("loai" IN ('NGHI_LE', 'NGHI_BU', 'LAM_BU')),
  "ten" text NOT NULL CHECK (char_length(btrim("ten")) BETWEEN 1 AND 200),
  "tao_boi" uuid REFERENCES "public"."accounts"("id") ON DELETE SET NULL,
  "tao_luc" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "dm_ngay_nghi_lam_bu_cuoi_tuan" CHECK ("loai" <> 'LAM_BU' OR extract(isodow FROM "ngay") >= 6)
);
ALTER TABLE "public"."dm_ngay_nghi" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."dm_ngay_nghi" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."dm_ngay_nghi" TO "authenticated";
CREATE POLICY "dm_ngay_nghi_select" ON "public"."dm_ngay_nghi" FOR SELECT TO "authenticated" USING (true);

-- Hai mảng đọc một lần (SECURITY DEFINER: hàm quét chạy bằng service_role / chủ hàm đều đọc được; không lộ gì ngoài ngày và loại).
CREATE FUNCTION "public"."kl_ngay_nghi"() RETURNS date[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(n."ngay" ORDER BY n."ngay"), '{}'::date[]) FROM "public"."dm_ngay_nghi" n WHERE n."loai" IN ('NGHI_LE', 'NGHI_BU');
$$;
CREATE FUNCTION "public"."kl_ngay_lam_bu"() RETURNS date[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(n."ngay" ORDER BY n."ngay"), '{}'::date[]) FROM "public"."dm_ngay_nghi" n WHERE n."loai" = 'LAM_BU';
$$;

-- Hàm thuần: ngày làm việc = (T2–T6 và không nghỉ lễ/nghỉ bù) hoặc ngày làm bù.
CREATE FUNCTION "public"."kl_la_ngay_lam_viec_mang"("p_ngay" date, "p_nghi" date[], "p_lam_bu" date[]) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT "p_ngay" = ANY (coalesce("p_lam_bu", '{}'::date[]))
      OR (extract(isodow FROM "p_ngay") < 6 AND NOT ("p_ngay" = ANY (coalesce("p_nghi", '{}'::date[]))));
$$;

-- Ngày làm việc thứ p_so sau p_tu (p_so ≤ 0 → chính p_tu). Cửa sổ 3·p_so + 40 ngày đủ cho kỳ nghỉ dài nhất (Tết ≤ 9 ngày liên tiếp).
CREATE FUNCTION "public"."ngay_lam_viec_sau_mang"("p_tu" date, "p_so" integer, "p_nghi" date[], "p_lam_bu" date[]) RETURNS date
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE WHEN coalesce("p_so", 0) <= 0 THEN "p_tu" ELSE (
    SELECT x.d FROM (
      SELECT ("p_tu" + i) AS d, row_number() OVER (ORDER BY i) AS rn
      FROM generate_series(1, 3 * "p_so" + 40) i
      WHERE "public"."kl_la_ngay_lam_viec_mang"("p_tu" + i, "p_nghi", "p_lam_bu")) x
    WHERE x.rn = "p_so") END;
$$;

-- Ngày làm việc thứ p_so trước p_den (lùi; p_so ≤ 0 → chính p_den).
CREATE FUNCTION "public"."ngay_lam_viec_truoc_mang"("p_den" date, "p_so" integer, "p_nghi" date[], "p_lam_bu" date[]) RETURNS date
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE WHEN coalesce("p_so", 0) <= 0 THEN "p_den" ELSE (
    SELECT x.d FROM (
      SELECT ("p_den" - i) AS d, row_number() OVER (ORDER BY i) AS rn
      FROM generate_series(1, 3 * "p_so" + 40) i
      WHERE "public"."kl_la_ngay_lam_viec_mang"("p_den" - i, "p_nghi", "p_lam_bu")) x
    WHERE x.rn = "p_so") END;
$$;

-- Số ngày làm việc trong (p_tu, p_den] — "còn n ngày làm việc" ở ngăn chi tiết (gọi một lần mỗi việc đang mở, không nằm trong view).
CREATE FUNCTION "public"."kl_so_ngay_lam_viec_mang"("p_tu" date, "p_den" date, "p_nghi" date[], "p_lam_bu" date[]) RETURNS integer
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE WHEN "p_den" <= "p_tu" THEN 0 ELSE (
    SELECT count(*)::integer FROM generate_series(1, "p_den" - "p_tu") i
    WHERE "public"."kl_la_ngay_lam_viec_mang"("p_tu" + i, "p_nghi", "p_lam_bu")) END;
$$;

-- Mốc sau p_gio giờ làm việc (7h30–17h giờ Việt Nam) kể từ p_tu; bỏ ngày không làm việc (bản 0035 chỉ bỏ T7/CN). Thuần, không đọc bảng.
CREATE FUNCTION "public"."gio_lam_viec_sau_mang"("p_tu" timestamptz, "p_gio" numeric, "p_nghi" date[], "p_lam_bu" date[]) RETURNS timestamptz
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v timestamp := "p_tu" AT TIME ZONE 'Asia/Ho_Chi_Minh'; v_con interval := make_interval(secs => greatest(coalesce("p_gio", 0), 0) * 3600); v_het timestamp; n integer := 0;
BEGIN
  LOOP
    n := n + 1; IF n > 60 THEN EXIT; END IF;
    IF NOT "public"."kl_la_ngay_lam_viec_mang"(v::date, "p_nghi", "p_lam_bu") OR v::time >= time '17:00' THEN
      v := (v::date + 1)::timestamp + interval '7 hours 30 minutes'; CONTINUE;
    END IF;
    IF v::time < time '07:30' THEN v := v::date + interval '7 hours 30 minutes'; END IF;
    v_het := v::date + interval '17 hours';
    IF v + v_con <= v_het THEN RETURN (v + v_con) AT TIME ZONE 'Asia/Ho_Chi_Minh'; END IF;
    v_con := v_con - (v_het - v); v := (v::date + 1)::timestamp + interval '7 hours 30 minutes';
  END LOOP;
  RETURN v AT TIME ZONE 'Asia/Ho_Chi_Minh';
END;
$$;

-- Bản tiện dụng (một lời gọi = đọc danh mục một lần). Giữ chữ ký cũ; IMMUTABLE → STABLE vì nay phụ thuộc bảng.
CREATE FUNCTION "public"."la_ngay_lam_viec"("p_ngay" date) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT "public"."kl_la_ngay_lam_viec_mang"("p_ngay", "public"."kl_ngay_nghi"(), "public"."kl_ngay_lam_bu"());
$$;
CREATE OR REPLACE FUNCTION "public"."ngay_lam_viec_sau"("p_tu" date, "p_so" integer) RETURNS date
LANGUAGE sql STABLE AS $$
  SELECT "public"."ngay_lam_viec_sau_mang"("p_tu", "p_so", "public"."kl_ngay_nghi"(), "public"."kl_ngay_lam_bu"());
$$;
CREATE FUNCTION "public"."ngay_lam_viec_truoc"("p_den" date, "p_so" integer) RETURNS date
LANGUAGE sql STABLE AS $$
  SELECT "public"."ngay_lam_viec_truoc_mang"("p_den", "p_so", "public"."kl_ngay_nghi"(), "public"."kl_ngay_lam_bu"());
$$;
CREATE FUNCTION "public"."kl_so_ngay_lam_viec"("p_tu" date, "p_den" date) RETURNS integer
LANGUAGE sql STABLE AS $$
  SELECT "public"."kl_so_ngay_lam_viec_mang"("p_tu", "p_den", "public"."kl_ngay_nghi"(), "public"."kl_ngay_lam_bu"());
$$;
CREATE OR REPLACE FUNCTION "public"."gio_lam_viec_sau"("p_tu" timestamptz, "p_gio" numeric) RETURNS timestamptz
LANGUAGE sql STABLE AS $$
  SELECT "public"."gio_lam_viec_sau_mang"("p_tu", "p_gio", "public"."kl_ngay_nghi"(), "public"."kl_ngay_lam_bu"());
$$;

-- Ghi danh mục: p_bat = true thêm/sửa, false bỏ. Lý do bắt buộc; nhật ký hệ thống có giá trị cũ/mới.
CREATE FUNCTION "public"."qt_dat_ngay_nghi"("p_ngay" date, "p_loai" text, "p_ten" text, "p_bat" boolean, "p_ly_do" text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cu "public"."dm_ngay_nghi"; v_ten text := nullif(btrim(coalesce("p_ten", '')), ''); v_ly_do text := nullif(btrim(coalesce("p_ly_do", '')), '');
BEGIN
  IF "auth"."uid"() IS NULL OR NOT ("public"."me_quan_tri_he_thong"() OR "public"."la_chanh_van_phong"()) THEN
    RAISE EXCEPTION 'Chỉ Chánh Văn phòng hoặc quản trị hệ thống mới sửa danh mục ngày nghỉ.' USING ERRCODE = '42501';
  END IF;
  IF "p_ngay" IS NULL OR "p_bat" IS NULL THEN RAISE EXCEPTION 'Thiếu ngày hoặc thao tác.' USING ERRCODE = '22023'; END IF;
  IF v_ly_do IS NULL THEN RAISE EXCEPTION 'Phải ghi lý do thay đổi.' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_cu FROM "public"."dm_ngay_nghi" WHERE "ngay" = "p_ngay";
  IF "p_bat" THEN
    IF "p_loai" IS NULL OR "p_loai" NOT IN ('NGHI_LE', 'NGHI_BU', 'LAM_BU') THEN RAISE EXCEPTION 'Loại ngày không hợp lệ.' USING ERRCODE = '22023'; END IF;
    IF v_ten IS NULL OR char_length(v_ten) > 200 THEN RAISE EXCEPTION 'Tên ngày nghỉ bắt buộc, tối đa 200 ký tự.' USING ERRCODE = '22023'; END IF;
    IF "p_loai" = 'LAM_BU' AND extract(isodow FROM "p_ngay") < 6 THEN RAISE EXCEPTION 'Ngày làm bù phải là Thứ Bảy hoặc Chủ nhật.' USING ERRCODE = '22023'; END IF;
    INSERT INTO "public"."dm_ngay_nghi" ("ngay", "loai", "ten", "tao_boi") VALUES ("p_ngay", "p_loai", v_ten, "auth"."uid"())
    ON CONFLICT ("ngay") DO UPDATE SET "loai" = excluded."loai", "ten" = excluded."ten", "tao_boi" = excluded."tao_boi", "tao_luc" = now();
  ELSE
    IF v_cu."ngay" IS NULL THEN RAISE EXCEPTION 'Ngày % không có trong danh mục.', to_char("p_ngay", 'DD/MM/YYYY') USING ERRCODE = '22023'; END IF;
    DELETE FROM "public"."dm_ngay_nghi" WHERE "ngay" = "p_ngay";
  END IF;
  PERFORM "public"."nhat_ky_ghi"('ngay_nghi', to_char("p_ngay", 'YYYY-MM-DD'), jsonb_build_object(
    'cu', CASE WHEN v_cu."ngay" IS NULL THEN NULL ELSE jsonb_build_object('loai', v_cu."loai", 'ten', v_cu."ten") END,
    'moi', CASE WHEN "p_bat" THEN jsonb_build_object('loai', "p_loai", 'ten', v_ten) END, 'ly_do', v_ly_do));
END;
$$;

REVOKE ALL ON FUNCTION "public"."kl_ngay_nghi"() FROM public, "anon";
REVOKE ALL ON FUNCTION "public"."kl_ngay_lam_bu"() FROM public, "anon";
REVOKE ALL ON FUNCTION "public"."la_ngay_lam_viec"(date) FROM public, "anon";
REVOKE ALL ON FUNCTION "public"."ngay_lam_viec_truoc"(date, integer) FROM public, "anon";
REVOKE ALL ON FUNCTION "public"."kl_so_ngay_lam_viec"(date, date) FROM public, "anon";
REVOKE ALL ON FUNCTION "public"."qt_dat_ngay_nghi"(date, text, text, boolean, text) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_ngay_nghi"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."kl_ngay_lam_bu"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."la_ngay_lam_viec"(date) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."ngay_lam_viec_truoc"(date, integer) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."kl_so_ngay_lam_viec"(date, date) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."qt_dat_ngay_nghi"(date, text, text, boolean, text) TO "authenticated";
