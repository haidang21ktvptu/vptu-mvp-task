-- 0119 (v3.28, chủ dự án duyệt kế hoạch 21/10/2026): theo dõi giải ngân vốn đầu tư công — Tổng quan xem bức tranh toàn tỉnh trước, rồi từng nhiệm vụ.
-- 1. gn_ky: một "kỳ số liệu" = một báo cáo chính thức (UBND tỉnh / Sở Tài chính): năm kế hoạch vốn, số liệu đến ngày, văn bản căn cứ, ước tính hay
--    thực hiện, tổng kế hoạch vốn năm và lũy kế đã giải ngân (tỷ đồng). Mỗi năm, mỗi ngày số liệu một kỳ — ghi lại cùng ngày thì thay cả kỳ.
-- 2. gn_ky_dong: dòng chi tiết của kỳ theo nguồn vốn (NGUON) hoặc chủ đầu tư / đơn vị (CHU_DAU_TU); ten_chuan (frontend chuẩn hoá: NFC, chữ thường,
--    gộp khoảng trắng, bỏ số thứ tự) để khớp cùng đối tượng giữa các kỳ.
-- 3. gn_nhiem_vu: nhiệm vụ theo dõi giải ngân — TOAN_TINH (mỗi năm một việc; chủ trì / người theo dõi việc này nhập kỳ số liệu) hoặc gắn một nguồn vốn /
--    chủ đầu tư; mục tiêu riêng (muc_tieu_pt % kế hoạch vốn trước muc_tieu_ngay; mặc định 100% trước 31/12). Không cộng dồn số của các nhiệm vụ.
-- Quyền (chỉ qua hàm SECURITY DEFINER, không ghi trực tiếp; tài khoản khoá / hệ thống / Thường trực không ghi — kl_nguoi_nhap):
--   - chọn / đổi / bỏ việc TOAN_TINH: lãnh đạo Văn phòng (me_role A1, gồm tài khoản toàn quyền);
--   - nhập / xoá kỳ: lãnh đạo Văn phòng, hoặc chủ trì / người theo dõi việc TOAN_TINH năm đó (gn_duoc_nhap_ky);
--   - gắn việc với nguồn vốn / chủ đầu tư: như ghi vướng mắc (0103) — chủ trì, người theo dõi, lãnh đạo trong phạm vi (kl_duoc_chi_dao);
--   - mục tiêu khác mặc định: lãnh đạo trong phạm vi hoặc tầng giao (kl_la_tang_giao) — người thực hiện không tự hạ mục tiêu.
-- Xem: kỳ và dòng — mọi tài khoản đăng nhập (như chi_tieu_ket_qua 0106); gn_nhiem_vu — việc TOAN_TINH mọi người (mục tiêu chung như nhau), việc khác
-- theo phạm vi việc (như nhiem_vu_muc_tieu 0105). Diễn biến lich_su cot 'giai_ngan': nhập / xoá kỳ (ghi vào việc TOAN_TINH), gắn / đổi / bỏ theo dõi.

CREATE TABLE "public"."gn_ky" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nam" integer NOT NULL CONSTRAINT "gn_ky_nam_check" CHECK ("nam" BETWEEN 1990 AND 2100),
  "ngay_so_lieu" date NOT NULL,
  "can_cu" text NOT NULL CONSTRAINT "gn_ky_can_cu_check" CHECK (btrim("can_cu") <> '' AND char_length("can_cu") <= 300),
  "uoc_tinh" boolean NOT NULL DEFAULT false,
  "ke_hoach" numeric(16, 3) NOT NULL CONSTRAINT "gn_ky_ke_hoach_check" CHECK ("ke_hoach" > 0),
  "da_giai_ngan" numeric(16, 3) NOT NULL CONSTRAINT "gn_ky_da_giai_ngan_check" CHECK ("da_giai_ngan" >= 0),
  "ghi_chu" text CONSTRAINT "gn_ky_ghi_chu_check" CHECK (char_length("ghi_chu") <= 500),
  "nhap_boi" uuid REFERENCES "public"."accounts"("id") ON DELETE SET NULL,
  "nhap_luc" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "gn_ky_ngay_check" CHECK ("ngay_so_lieu" BETWEEN make_date("nam", 1, 1) AND make_date("nam" + 1, 1, 31)),
  CONSTRAINT "gn_ky_nam_ngay_key" UNIQUE ("nam", "ngay_so_lieu")
);
CREATE TABLE "public"."gn_ky_dong" (
  "ky_id" uuid NOT NULL REFERENCES "public"."gn_ky"("id") ON DELETE CASCADE,
  "loai" text NOT NULL CONSTRAINT "gn_ky_dong_loai_check" CHECK ("loai" IN ('NGUON', 'CHU_DAU_TU')),
  "ten" text NOT NULL CONSTRAINT "gn_ky_dong_ten_check" CHECK (btrim("ten") <> '' AND char_length("ten") <= 300),
  "ten_chuan" text NOT NULL CONSTRAINT "gn_ky_dong_ten_chuan_check" CHECK ("ten_chuan" <> '' AND char_length("ten_chuan") <= 300),
  "thu_tu" integer NOT NULL DEFAULT 0,
  "ke_hoach" numeric(16, 3) CONSTRAINT "gn_ky_dong_ke_hoach_check" CHECK ("ke_hoach" >= 0),
  "da_giai_ngan" numeric(16, 3) CONSTRAINT "gn_ky_dong_da_giai_ngan_check" CHECK ("da_giai_ngan" >= 0),
  PRIMARY KEY ("ky_id", "loai", "ten_chuan")
);
CREATE INDEX "gn_ky_dong_doi_tuong_idx" ON "public"."gn_ky_dong" ("loai", "ten_chuan");
CREATE TABLE "public"."gn_nhiem_vu" (
  "nhiem_vu_id" uuid PRIMARY KEY REFERENCES "public"."nhiem_vu"("id") ON DELETE CASCADE,
  "nam" integer NOT NULL CONSTRAINT "gn_nhiem_vu_nam_check" CHECK ("nam" BETWEEN 1990 AND 2100),
  "loai" text NOT NULL CONSTRAINT "gn_nhiem_vu_loai_check" CHECK ("loai" IN ('TOAN_TINH', 'NGUON', 'CHU_DAU_TU')),
  "ten" text CONSTRAINT "gn_nhiem_vu_ten_check" CHECK (char_length("ten") <= 300),
  "ten_chuan" text CONSTRAINT "gn_nhiem_vu_ten_chuan_check" CHECK (char_length("ten_chuan") <= 300),
  "muc_tieu_pt" numeric(5, 2) NOT NULL DEFAULT 100 CONSTRAINT "gn_nhiem_vu_muc_tieu_pt_check" CHECK ("muc_tieu_pt" > 0 AND "muc_tieu_pt" <= 100),
  "muc_tieu_ngay" date NOT NULL,
  "gan_boi" uuid REFERENCES "public"."accounts"("id") ON DELETE SET NULL,
  "gan_luc" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "gn_nhiem_vu_doi_tuong_check" CHECK (("loai" = 'TOAN_TINH') = ("ten_chuan" IS NULL)),
  CONSTRAINT "gn_nhiem_vu_moc_check" CHECK ("muc_tieu_ngay" BETWEEN make_date("nam", 1, 1) AND make_date("nam" + 1, 1, 31))
);
CREATE UNIQUE INDEX "gn_nhiem_vu_toan_tinh_key" ON "public"."gn_nhiem_vu" ("nam") WHERE "loai" = 'TOAN_TINH';
CREATE INDEX "gn_nhiem_vu_nam_idx" ON "public"."gn_nhiem_vu" ("nam", "loai", "ten_chuan");
COMMENT ON TABLE "public"."gn_ky" IS '0119: kỳ số liệu giải ngân vốn đầu tư công (một báo cáo chính thức); ghi qua gn_ghi_ky / gn_xoa_ky.';
COMMENT ON TABLE "public"."gn_ky_dong" IS '0119: dòng của kỳ theo nguồn vốn / chủ đầu tư; ghi cùng gn_ghi_ky.';
COMMENT ON TABLE "public"."gn_nhiem_vu" IS '0119: nhiệm vụ theo dõi giải ngân (toàn tỉnh / nguồn vốn / chủ đầu tư) và mục tiêu riêng; ghi qua gn_gan_nhiem_vu.';

ALTER TABLE "public"."gn_ky" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."gn_ky_dong" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."gn_nhiem_vu" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."gn_ky", "public"."gn_ky_dong", "public"."gn_nhiem_vu" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."gn_ky", "public"."gn_ky_dong", "public"."gn_nhiem_vu" TO "authenticated";
CREATE POLICY "gn_ky_select" ON "public"."gn_ky" FOR SELECT TO "authenticated" USING ((SELECT "auth"."uid"()) IS NOT NULL);
CREATE POLICY "gn_ky_dong_select" ON "public"."gn_ky_dong" FOR SELECT TO "authenticated" USING ((SELECT "auth"."uid"()) IS NOT NULL);
CREATE POLICY "gn_nhiem_vu_select" ON "public"."gn_nhiem_vu" FOR SELECT TO "authenticated"
  USING ("loai" = 'TOAN_TINH' OR (SELECT "public"."kl_xem_tat_ca"()) OR "nhiem_vu_id" IN (SELECT "public"."kl_nhiem_vu_thay_duoc"(true)));

-- Chữ cho diễn biến: số kiểu Việt Nam (2.054,516), tỷ lệ (24,2%), mô tả việc theo dõi.
CREATE FUNCTION "public"."gn_so"("x" numeric) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN "x" IS NULL THEN '—' ELSE regexp_replace(translate(to_char("x", 'FM999,999,999,990.000'), ',.', '.,'), ',?0+$', '') END;
$$;
CREATE FUNCTION "public"."gn_pt"("p_da" numeric, "p_kh" numeric) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN "p_kh" > 0 THEN replace(to_char(round("p_da" / "p_kh" * 100, 1), 'FM9990.0'), '.', ',') || '%' ELSE '—' END;
$$;
CREATE FUNCTION "public"."gn_mo_ta"("p" "public"."gn_nhiem_vu") RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN ("p")."nhiem_vu_id" IS NULL THEN NULL ELSE format('Theo dõi giải ngân năm %s — %s; mục tiêu %s%% kế hoạch vốn trước %s', ("p")."nam",
    CASE ("p")."loai" WHEN 'TOAN_TINH' THEN 'số liệu toàn tỉnh' WHEN 'NGUON' THEN 'nguồn vốn: ' || ("p")."ten" ELSE 'chủ đầu tư: ' || ("p")."ten" END,
    replace(trim_scale(("p")."muc_tieu_pt")::text, '.', ','), to_char(("p")."muc_tieu_ngay", 'DD/MM/YYYY')) END;
$$;

-- Người được nhập / xoá kỳ số liệu của năm p_nam.
CREATE FUNCTION "public"."gn_duoc_nhap_ky"("p_nam" integer) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce("public"."kl_nguoi_nhap"() AND (coalesce("public"."me_role"() = 'A1', false) OR EXISTS (
    SELECT 1 FROM "public"."gn_nhiem_vu" g JOIN "public"."nhiem_vu" n ON n."id" = g."nhiem_vu_id"
    WHERE g."nam" = "p_nam" AND g."loai" = 'TOAN_TINH' AND "auth"."uid"() IN (n."owner_tai_khoan", n."nguoi_theo_doi"))), false);
$$;

-- p = { nam, ngay_so_lieu, can_cu, uoc_tinh, ke_hoach, da_giai_ngan, ghi_chu, dong: [{ loai, ten, ten_chuan, thu_tu, ke_hoach, da_giai_ngan }] }.
CREATE FUNCTION "public"."gn_ghi_ky"("p" jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_nam integer; v_ngay date; v_kh numeric; v_da numeric; v_uoc boolean; v_id uuid; v_trung text;
  v_can_cu text := btrim(coalesce("p" ->> 'can_cu', '')); v_ghi_chu text := left(nullif(btrim(coalesce("p" ->> 'ghi_chu', '')), ''), 500);
  v_dong jsonb := coalesce("p" -> 'dong', '[]'::jsonb); v_tt "public"."gn_nhiem_vu"; v_cu "public"."gn_ky";
BEGIN
  BEGIN
    v_nam := ("p" ->> 'nam')::integer; v_ngay := ("p" ->> 'ngay_so_lieu')::date; v_kh := ("p" ->> 'ke_hoach')::numeric;
    v_da := ("p" ->> 'da_giai_ngan')::numeric; v_uoc := coalesce(("p" ->> 'uoc_tinh')::boolean, false);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Năm, ngày số liệu, kế hoạch vốn hoặc số đã giải ngân không đúng dạng.' USING ERRCODE = '22023';
  END;
  IF v_nam IS NULL OR v_ngay IS NULL OR v_kh IS NULL OR v_da IS NULL THEN
    RAISE EXCEPTION 'Ghi đủ năm, ngày số liệu, kế hoạch vốn năm và số đã giải ngân lũy kế.' USING ERRCODE = '22023';
  END IF;
  IF NOT "public"."gn_duoc_nhap_ky"(v_nam) THEN
    RAISE EXCEPTION 'Chỉ lãnh đạo Văn phòng hoặc chủ trì, người theo dõi nhiệm vụ "Số liệu toàn tỉnh" năm % mới nhập kỳ số liệu giải ngân.', v_nam
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_tt FROM "public"."gn_nhiem_vu" WHERE "nam" = v_nam AND "loai" = 'TOAN_TINH';
  IF v_tt."nhiem_vu_id" IS NULL THEN
    RAISE EXCEPTION 'Năm % chưa có nhiệm vụ "Số liệu toàn tỉnh" — lãnh đạo Văn phòng chọn nhiệm vụ đó trước khi nhập kỳ số liệu.', v_nam USING ERRCODE = '22023';
  END IF;
  IF v_ngay > "public"."kl_hom_nay"() THEN RAISE EXCEPTION 'Ngày số liệu không được sau hôm nay.' USING ERRCODE = '22023'; END IF;
  IF v_ngay NOT BETWEEN make_date(v_nam, 1, 1) AND make_date(v_nam + 1, 1, 31) THEN
    RAISE EXCEPTION 'Số liệu kế hoạch vốn năm % phải tính đến ngày từ 1/1/% đến 31/1/%.', v_nam, v_nam, v_nam + 1 USING ERRCODE = '22023';
  END IF;
  IF v_can_cu = '' OR char_length(v_can_cu) > 300 THEN
    RAISE EXCEPTION 'Ghi văn bản căn cứ (số hiệu, ngày, cơ quan báo cáo), tối đa 300 ký tự.' USING ERRCODE = '22023';
  END IF;
  IF v_kh <= 0 OR v_da < 0 THEN RAISE EXCEPTION 'Kế hoạch vốn phải lớn hơn 0, số đã giải ngân không âm.' USING ERRCODE = '22023'; END IF;
  IF jsonb_typeof(v_dong) <> 'array' OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_dong) x
       WHERE coalesce(x ->> 'loai', '') NOT IN ('NGUON', 'CHU_DAU_TU') OR btrim(coalesce(x ->> 'ten', '')) = '' OR btrim(coalesce(x ->> 'ten_chuan', '')) = '') THEN
    RAISE EXCEPTION 'Mỗi dòng chi tiết phải có loại (nguồn vốn / chủ đầu tư) và tên.' USING ERRCODE = '22023';
  END IF;
  SELECT min(x ->> 'ten') INTO v_trung FROM jsonb_array_elements(v_dong) x GROUP BY x ->> 'loai', x ->> 'ten_chuan' HAVING count(*) > 1 LIMIT 1;
  IF v_trung IS NOT NULL THEN RAISE EXCEPTION 'Bảng có hai dòng cùng tên "%" — gộp hoặc bỏ một dòng.', v_trung USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_cu FROM "public"."gn_ky" WHERE "nam" = v_nam AND "ngay_so_lieu" = v_ngay;
  IF v_cu."id" IS NOT NULL THEN
    UPDATE "public"."gn_ky" SET "can_cu" = v_can_cu, "uoc_tinh" = v_uoc, "ke_hoach" = v_kh, "da_giai_ngan" = v_da, "ghi_chu" = v_ghi_chu,
      "nhap_boi" = "auth"."uid"(), "nhap_luc" = now() WHERE "id" = v_cu."id" RETURNING "id" INTO v_id;
    DELETE FROM "public"."gn_ky_dong" WHERE "ky_id" = v_id;
  ELSE
    INSERT INTO "public"."gn_ky" ("nam", "ngay_so_lieu", "can_cu", "uoc_tinh", "ke_hoach", "da_giai_ngan", "ghi_chu", "nhap_boi")
    VALUES (v_nam, v_ngay, v_can_cu, v_uoc, v_kh, v_da, v_ghi_chu, "auth"."uid"()) RETURNING "id" INTO v_id;
  END IF;
  BEGIN
    INSERT INTO "public"."gn_ky_dong" ("ky_id", "loai", "ten", "ten_chuan", "thu_tu", "ke_hoach", "da_giai_ngan")
    SELECT v_id, x ->> 'loai', left(btrim(x ->> 'ten'), 300), left(btrim(x ->> 'ten_chuan'), 300), coalesce(nullif(x ->> 'thu_tu', '')::integer, t.o::integer),
           nullif(x ->> 'ke_hoach', '')::numeric, nullif(x ->> 'da_giai_ngan', '')::numeric
    FROM jsonb_array_elements(v_dong) WITH ORDINALITY t(x, o);
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range OR check_violation THEN
    RAISE EXCEPTION 'Dòng chi tiết có số không hợp lệ (kế hoạch, đã giải ngân phải là số không âm, tính bằng tỷ đồng).' USING ERRCODE = '22023';
  END;
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon")
  VALUES (v_tt."nhiem_vu_id", "auth"."uid"(), 'giai_ngan',
    CASE WHEN v_cu."id" IS NOT NULL THEN format('Kỳ đến %s: %s/%s tỷ đồng', to_char(v_ngay, 'DD/MM/YYYY'), "public"."gn_so"(v_cu."da_giai_ngan"),
      "public"."gn_so"(v_cu."ke_hoach")) END,
    format('Kỳ số liệu đến %s%s: đã giải ngân %s/%s tỷ đồng (%s) — căn cứ: %s', to_char(v_ngay, 'DD/MM/YYYY'), CASE WHEN v_uoc THEN ' (ước tính)' ELSE '' END,
      "public"."gn_so"(v_da), "public"."gn_so"(v_kh), "public"."gn_pt"(v_da, v_kh), v_can_cu), 'app');
  RETURN jsonb_build_object('id', v_id, 'thay', v_cu."id" IS NOT NULL, 'so_dong', jsonb_array_length(v_dong));
END;
$$;

CREATE FUNCTION "public"."gn_xoa_ky"("p_id" uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v "public"."gn_ky"; v_tt "public"."gn_nhiem_vu";
BEGIN
  SELECT * INTO v FROM "public"."gn_ky" WHERE "id" = "p_id";
  IF v."id" IS NULL THEN RAISE EXCEPTION 'Không có kỳ số liệu này.' USING ERRCODE = '22023'; END IF;
  IF NOT "public"."gn_duoc_nhap_ky"(v."nam") THEN
    RAISE EXCEPTION 'Chỉ lãnh đạo Văn phòng hoặc chủ trì, người theo dõi nhiệm vụ "Số liệu toàn tỉnh" năm % mới xoá kỳ số liệu.', v."nam" USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_tt FROM "public"."gn_nhiem_vu" WHERE "nam" = v."nam" AND "loai" = 'TOAN_TINH';
  DELETE FROM "public"."gn_ky" WHERE "id" = "p_id";
  IF v_tt."nhiem_vu_id" IS NOT NULL THEN
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon")
    VALUES (v_tt."nhiem_vu_id", "auth"."uid"(), 'giai_ngan', format('Kỳ đến %s: %s/%s tỷ đồng — căn cứ: %s', to_char(v."ngay_so_lieu", 'DD/MM/YYYY'),
      "public"."gn_so"(v."da_giai_ngan"), "public"."gn_so"(v."ke_hoach"), v."can_cu"), 'Xoá kỳ số liệu', 'app');
  END IF;
END;
$$;

-- p = { loai: TOAN_TINH | NGUON | CHU_DAU_TU | null (bỏ theo dõi), nam, ten, ten_chuan, muc_tieu_pt, muc_tieu_ngay }.
CREATE FUNCTION "public"."gn_gan_nhiem_vu"("p_nv" uuid, "p" jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v "public"."nhiem_vu"; c "public"."gn_nhiem_vu"; m "public"."gn_nhiem_vu"; v_loai text := nullif(btrim(coalesce("p" ->> 'loai', '')), '');
  v_mac_pt numeric; v_mac_ngay date; v_khac text;
BEGIN
  SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = "p_nv";
  IF v."id" IS NULL OR NOT "public"."kl_nguoi_nhap"() THEN
    RAISE EXCEPTION 'Không có nhiệm vụ này hoặc tài khoản không được ghi.' USING ERRCODE = '42501';
  END IF;
  IF v_loai IS NOT NULL AND v_loai NOT IN ('TOAN_TINH', 'NGUON', 'CHU_DAU_TU') THEN
    RAISE EXCEPTION 'Loại theo dõi giải ngân không hợp lệ.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO c FROM "public"."gn_nhiem_vu" WHERE "nhiem_vu_id" = "p_nv";
  IF v_loai = 'TOAN_TINH' OR c."loai" = 'TOAN_TINH' THEN
    IF coalesce("public"."me_role"() = 'A1', false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Chỉ lãnh đạo Văn phòng chọn, đổi hoặc bỏ nhiệm vụ "Số liệu toàn tỉnh".' USING ERRCODE = '42501';
    END IF;
  ELSIF (v."owner_tai_khoan" = "auth"."uid"() OR v."nguoi_theo_doi" = "auth"."uid"() OR "public"."kl_duoc_chi_dao"(v."id")) IS NOT TRUE THEN
    RAISE EXCEPTION 'Chỉ chủ trì, người theo dõi hoặc lãnh đạo trong phạm vi gắn nhiệm vụ với theo dõi giải ngân.' USING ERRCODE = '42501';
  END IF;
  IF v_loai IS NULL THEN   -- bỏ theo dõi
    IF c."nhiem_vu_id" IS NULL THEN RETURN jsonb_build_object('doi', false); END IF;
    DELETE FROM "public"."gn_nhiem_vu" WHERE "nhiem_vu_id" = "p_nv";
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon")
    VALUES ("p_nv", "auth"."uid"(), 'giai_ngan', "public"."gn_mo_ta"(c), 'Bỏ theo dõi giải ngân', 'app');
    RETURN jsonb_build_object('doi', true);
  END IF;
  m."nhiem_vu_id" := "p_nv"; m."loai" := v_loai;
  BEGIN
    m."nam" := coalesce(nullif("p" ->> 'nam', '')::integer, c."nam", extract(year FROM "public"."kl_hom_nay"())::integer);
    m."muc_tieu_pt" := coalesce(nullif("p" ->> 'muc_tieu_pt', '')::numeric, c."muc_tieu_pt", 100);
    m."muc_tieu_ngay" := coalesce(nullif("p" ->> 'muc_tieu_ngay', '')::date, CASE WHEN c."nam" = m."nam" THEN c."muc_tieu_ngay" END, make_date(m."nam", 12, 31));
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Năm, mục tiêu hoặc mốc mục tiêu không đúng dạng.' USING ERRCODE = '22023';
  END;
  IF m."nam" NOT BETWEEN 1990 AND 2100 OR m."muc_tieu_pt" <= 0 OR m."muc_tieu_pt" > 100 THEN
    RAISE EXCEPTION 'Năm hoặc mục tiêu (phần trăm kế hoạch vốn, lớn hơn 0 và không quá 100) không hợp lệ.' USING ERRCODE = '22023';
  END IF;
  IF m."muc_tieu_ngay" NOT BETWEEN make_date(m."nam", 1, 1) AND make_date(m."nam" + 1, 1, 31) THEN
    RAISE EXCEPTION 'Mốc mục tiêu phải trong năm % hoặc đến 31/1/%.', m."nam", m."nam" + 1 USING ERRCODE = '22023';
  END IF;
  IF v_loai <> 'TOAN_TINH' THEN
    m."ten" := left(nullif(btrim(coalesce("p" ->> 'ten', '')), ''), 300); m."ten_chuan" := left(nullif(btrim(coalesce("p" ->> 'ten_chuan', '')), ''), 300);
    IF m."ten" IS NULL OR m."ten_chuan" IS NULL THEN RAISE EXCEPTION 'Ghi tên nguồn vốn hoặc chủ đầu tư.' USING ERRCODE = '22023'; END IF;
  END IF;
  v_mac_pt := CASE WHEN c."nam" = m."nam" THEN c."muc_tieu_pt" ELSE 100 END;
  v_mac_ngay := CASE WHEN c."nam" = m."nam" THEN c."muc_tieu_ngay" ELSE make_date(m."nam", 12, 31) END;
  IF (m."muc_tieu_pt" <> v_mac_pt OR m."muc_tieu_ngay" <> v_mac_ngay) AND v_loai <> 'TOAN_TINH'
     AND ("public"."kl_duoc_chi_dao"(v."id") OR "public"."kl_la_tang_giao"(v)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Chỉ lãnh đạo trong phạm vi hoặc người giao việc đổi mục tiêu giải ngân của nhiệm vụ.' USING ERRCODE = '42501';
  END IF;
  IF v_loai = 'TOAN_TINH' THEN
    SELECT n."ma" INTO v_khac FROM "public"."gn_nhiem_vu" g JOIN "public"."nhiem_vu" n ON n."id" = g."nhiem_vu_id"
    WHERE g."nam" = m."nam" AND g."loai" = 'TOAN_TINH' AND g."nhiem_vu_id" <> "p_nv";
    IF v_khac IS NOT NULL THEN
      RAISE EXCEPTION 'Năm % đã có nhiệm vụ "Số liệu toàn tỉnh" (%) — bỏ theo dõi ở việc đó trước.', m."nam", v_khac USING ERRCODE = '22023';
    END IF;
  END IF;
  IF c."nhiem_vu_id" IS NOT NULL AND "public"."gn_mo_ta"(c) = "public"."gn_mo_ta"(m) AND c."ten_chuan" IS NOT DISTINCT FROM m."ten_chuan" THEN
    RETURN jsonb_build_object('doi', false);
  END IF;
  INSERT INTO "public"."gn_nhiem_vu" ("nhiem_vu_id", "nam", "loai", "ten", "ten_chuan", "muc_tieu_pt", "muc_tieu_ngay", "gan_boi")
  VALUES ("p_nv", m."nam", m."loai", m."ten", m."ten_chuan", m."muc_tieu_pt", m."muc_tieu_ngay", "auth"."uid"())
  ON CONFLICT ("nhiem_vu_id") DO UPDATE SET "nam" = EXCLUDED."nam", "loai" = EXCLUDED."loai", "ten" = EXCLUDED."ten", "ten_chuan" = EXCLUDED."ten_chuan",
    "muc_tieu_pt" = EXCLUDED."muc_tieu_pt", "muc_tieu_ngay" = EXCLUDED."muc_tieu_ngay", "gan_boi" = EXCLUDED."gan_boi", "gan_luc" = now();
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon")
  VALUES ("p_nv", "auth"."uid"(), 'giai_ngan', "public"."gn_mo_ta"(c), "public"."gn_mo_ta"(m), 'app');
  RETURN jsonb_build_object('doi', true);
END;
$$;

REVOKE ALL ON FUNCTION "public"."gn_so"(numeric), "public"."gn_pt"(numeric, numeric), "public"."gn_mo_ta"("public"."gn_nhiem_vu"),
  "public"."gn_duoc_nhap_ky"(integer) FROM public, "anon", "authenticated";
REVOKE ALL ON FUNCTION "public"."gn_ghi_ky"(jsonb), "public"."gn_xoa_ky"(uuid), "public"."gn_gan_nhiem_vu"(uuid, jsonb) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."gn_ghi_ky"(jsonb), "public"."gn_xoa_ky"(uuid), "public"."gn_gan_nhiem_vu"(uuid, jsonb) TO "authenticated";
