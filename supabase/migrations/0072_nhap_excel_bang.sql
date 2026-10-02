-- 0072: Nhập Excel toàn trình (giao diện v9 đợt 2, phần B) — bảng lô / dòng / hồ sơ ghép cột / từ điển chuẩn hoá và các hàm nhỏ.
--   Người nhập (kl_nguoi_nhap): quản trị nhiệm vụ còn hạn (me_quan_tri_kl) hoặc quản trị hệ thống; không phải A0; tài khoản đang hoạt động.
--   lo_nhap: một lần nhập (mã LO-0001…, tệp, mẫu, chế độ cho việc đã hoàn thành); dong_nhap: từng dòng của tệp — kết quả, việc tạo / cập nhật,
--   dữ liệu đã chuẩn hoá, DỮ LIỆU GỐC (mọi cột của tệp, kể cả cột thừa), giá trị cũ (để hoàn tác); dòng thiếu thông tin nằm ở vùng đệm
--   "Chờ hoàn thiện" (CHO_HOAN_THIEN) cho tới khi hoàn thiện bằng biểu mẫu Giao việc (giao_viec + dong_nhap_id, 0073) hoặc bỏ.
--   ho_so_nhap: cách ghép cột đã lưu, dùng chung; tu_dien_nhap: giá trị trong tệp → mã danh mục / tài khoản, dùng chung.
--   Bảng chỉ ĐỌC qua RLS; mọi ghi qua hàm. dong_nhap còn cho người thấy việc đọc (khối "Dữ liệu gốc" trong ngăn chi tiết). Phạm vi đọc văn bản
--   giao việc không đổi (quản trị nhiệm vụ thấy hết; hoàn thiện dòng chờ bằng biểu mẫu Giao việc chỉ cho người dùng được biểu mẫu đó).

CREATE FUNCTION "public"."kl_nguoi_nhap"() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM "public"."accounts" a WHERE a."id" = "auth"."uid"() AND a."role_group" <> 'A0' AND NOT coalesce(a."bi_khoa", false)
    AND NOT a."is_system" AND ("public"."me_quan_tri_kl"() OR a."quan_tri_he_thong"));
$$;
REVOKE ALL ON FUNCTION "public"."kl_nguoi_nhap"() FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_nguoi_nhap"() TO "authenticated";

-- Mã trường chuẩn (khớp frontend/src/lib/kl/nhap/truong.js) — kiểm hồ sơ ghép cột.
CREATE FUNCTION "public"."kl_truong_nhap"() RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['ma', 'loai_van_ban', 'so_hoi_nghi', 'so_ket_luan', 'ngay_ban_hanh', 'noi_dung', 'don_vi', 'can_bo', 'theo_doi', 'lanh_dao_giao',
               'loai_thoi_han', 'han_xu_ly', 'san_pham', 'cap_nhan', 'do_khan', 'nguon', 'nganh', 'linh_vuc', 'tien_do', 'vuong_mac',
               'kq_so_hieu', 'kq_ngay', 'kq_trich_yeu', 'kq_mo_ta', 'chat_luong',
               'linh_vuc_chi_tiet', 'van_ban_trien_khai', 'han_nop', 'don_vi_phoi_hop', 'ghi_chu']::text[];
$$;

CREATE SEQUENCE "public"."lo_nhap_ma_seq";
CREATE TABLE "public"."lo_nhap" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ma" text NOT NULL UNIQUE DEFAULT ('LO-' || lpad(nextval('"public"."lo_nhap_ma_seq"')::text, 4, '0')),
  "ten_tep" text NOT NULL CHECK (btrim("ten_tep") <> '' AND char_length("ten_tep") <= 200),
  "mau" text NOT NULL CHECK ("mau" IN ('CHUAN', 'PHU_LUC_2', 'TU_GHEP')),
  "che_do_xong" text NOT NULL CHECK ("che_do_xong" IN ('DA_XONG_NGOAI', 'CHO_NGHIEM_THU')),
  "so_dong" integer NOT NULL CHECK ("so_dong" BETWEEN 1 AND 2000),
  "tao_boi" uuid NOT NULL REFERENCES "public"."accounts"("id"),
  "tao_luc" timestamp with time zone NOT NULL DEFAULT now(),
  "xong_luc" timestamp with time zone,
  "so_lieu" jsonb,                       -- số dòng theo kết quả (chốt lô / sau hoàn tác)
  "hoan_tac_luc" timestamp with time zone,
  "hoan_tac_boi" uuid REFERENCES "public"."accounts"("id")
);
CREATE INDEX "lo_nhap_tao_luc_idx" ON "public"."lo_nhap" ("tao_luc" DESC);

CREATE TABLE "public"."dong_nhap" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "lo_id" uuid NOT NULL REFERENCES "public"."lo_nhap"("id") ON DELETE CASCADE,
  "so_dong" integer NOT NULL CHECK ("so_dong" > 0),
  "ket_qua" text NOT NULL CHECK ("ket_qua" IN ('GIAO', 'DA_XONG', 'CHO_NGHIEM_THU', 'CAP_NHAT', 'CHO_HOAN_THIEN', 'BO_QUA', 'DA_HOAN_THIEN', 'DA_BO', 'DA_HOAN_TAC')),
  "nhiem_vu_id" uuid REFERENCES "public"."nhiem_vu"("id") ON DELETE SET NULL,
  "du_lieu" jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof("du_lieu") = 'object'),
  "du_lieu_goc" jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof("du_lieu_goc") = 'object'),
  "gia_tri_cu" jsonb CHECK ("gia_tri_cu" IS NULL OR jsonb_typeof("gia_tri_cu") = 'object'),
  "thieu" text[] NOT NULL DEFAULT '{}',
  "ghi_chu" text CHECK ("ghi_chu" IS NULL OR char_length("ghi_chu") <= 1000),
  "xu_ly_boi" uuid REFERENCES "public"."accounts"("id"),
  "xu_ly_luc" timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE ("lo_id", "so_dong")
);
CREATE INDEX "dong_nhap_nhiem_vu_idx" ON "public"."dong_nhap" ("nhiem_vu_id") WHERE "nhiem_vu_id" IS NOT NULL;
-- Hoàn tác lô xoá nhiều việc một lần → FK CASCADE dò tin nhắn theo nhiem_vu_id (trước đây không có chỉ mục: lô 1000 việc ~5 giây, có chỉ mục ~0,3).
CREATE INDEX IF NOT EXISTS "direct_messages_nhiem_vu_idx" ON "public"."direct_messages" ("nhiem_vu_id");
CREATE INDEX "dong_nhap_cho_idx" ON "public"."dong_nhap" ("lo_id") WHERE "ket_qua" = 'CHO_HOAN_THIEN';

CREATE TABLE "public"."ho_so_nhap" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ten" text NOT NULL UNIQUE CHECK (btrim("ten") <> '' AND char_length("ten") <= 100),
  "ten_sheet" text CHECK ("ten_sheet" IS NULL OR char_length("ten_sheet") <= 100),
  "dong_tieu_de" integer NOT NULL DEFAULT 1 CHECK ("dong_tieu_de" BETWEEN 1 AND 50),
  "anh_xa" jsonb NOT NULL CHECK (jsonb_typeof("anh_xa") = 'object'),   -- {tiêu đề cột đã chuẩn hoá: mã trường}
  "tao_boi" uuid NOT NULL REFERENCES "public"."accounts"("id"),
  "cap_nhat_luc" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE "public"."tu_dien_nhap" (
  "loai" text NOT NULL CHECK ("loai" IN ('loai_van_ban', 'don_vi', 'can_bo', 'loai_thoi_han', 'san_pham', 'cap', 'do_khan', 'nguon', 'nganh', 'linh_vuc',
                                         'tien_do', 'chat_luong')),
  "goc" text NOT NULL CHECK (btrim("goc") <> '' AND char_length("goc") <= 300),   -- giá trị trong tệp đã chuẩn hoá (chữ thường, bỏ dấu, gọn khoảng trắng)
  "ma" text NOT NULL CHECK (btrim("ma") <> '' AND char_length("ma") <= 100),     -- mã danh mục / id tài khoản
  "tao_boi" uuid NOT NULL REFERENCES "public"."accounts"("id"),
  "tao_luc" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("loai", "goc")
);

ALTER TABLE "public"."lo_nhap" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."dong_nhap" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ho_so_nhap" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tu_dien_nhap" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."lo_nhap", "public"."dong_nhap", "public"."ho_so_nhap", "public"."tu_dien_nhap" FROM "anon", "authenticated";
GRANT SELECT ON "public"."lo_nhap", "public"."dong_nhap", "public"."ho_so_nhap", "public"."tu_dien_nhap" TO "authenticated";
REVOKE ALL ON SEQUENCE "public"."lo_nhap_ma_seq" FROM "anon", "authenticated";
CREATE POLICY "lo_nhap_select" ON "public"."lo_nhap" FOR SELECT TO "authenticated"   -- người thấy việc của lô đọc được mã lô / tên tệp (khối Dữ liệu gốc)
  USING ((SELECT "public"."kl_nguoi_nhap"()) OR EXISTS (SELECT 1 FROM "public"."dong_nhap" d WHERE d."lo_id" = "lo_nhap"."id" AND d."nhiem_vu_id" IS NOT NULL));
CREATE POLICY "dong_nhap_select" ON "public"."dong_nhap" FOR SELECT TO "authenticated"
  USING ((SELECT "public"."kl_nguoi_nhap"()) OR "nhiem_vu_id" IN (SELECT "public"."kl_nhiem_vu_thay_duoc"(false)));
CREATE POLICY "ho_so_nhap_select" ON "public"."ho_so_nhap" FOR SELECT TO "authenticated" USING ((SELECT "public"."kl_nguoi_nhap"()));
CREATE POLICY "tu_dien_nhap_select" ON "public"."tu_dien_nhap" FOR SELECT TO "authenticated" USING ((SELECT "public"."kl_nguoi_nhap"()));

CREATE FUNCTION "public"."kl_nhap_kiem_quyen"() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT "public"."kl_nguoi_nhap"() THEN
    RAISE EXCEPTION 'Chỉ quản trị nhiệm vụ hoặc quản trị hệ thống mới nhập Excel.' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- Hồ sơ ghép cột: lưu theo tên (trùng tên = ghi đè, ai trong nhóm người nhập cũng sửa được — dùng chung). Giá trị ánh xạ phải là mã trường chuẩn.
CREATE FUNCTION "public"."ho_so_nhap_luu"("p_ten" text, "p_ten_sheet" text, "p_dong_tieu_de" integer, "p_anh_xa" jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_ten text := btrim(coalesce("p_ten", ''));
BEGIN
  PERFORM "public"."kl_nhap_kiem_quyen"();
  IF v_ten = '' OR char_length(v_ten) > 100 THEN RAISE EXCEPTION 'Tên hồ sơ ghép cột từ 1 đến 100 ký tự.' USING ERRCODE = '22023'; END IF;
  IF "p_anh_xa" IS NULL OR jsonb_typeof("p_anh_xa") <> 'object' OR "p_anh_xa" = '{}'::jsonb THEN
    RAISE EXCEPTION 'Hồ sơ phải ghép ít nhất một cột.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each_text("p_anh_xa") e WHERE NOT (e.value = ANY ("public"."kl_truong_nhap"())) OR char_length(e.key) > 200) THEN
    RAISE EXCEPTION 'Hồ sơ có cột ghép vào trường không có trong chuẩn nhập.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO "public"."ho_so_nhap" ("ten", "ten_sheet", "dong_tieu_de", "anh_xa", "tao_boi")
  VALUES (v_ten, nullif(btrim(coalesce("p_ten_sheet", '')), ''), coalesce("p_dong_tieu_de", 1), "p_anh_xa", "auth"."uid"())
  ON CONFLICT ("ten") DO UPDATE SET "ten_sheet" = EXCLUDED."ten_sheet", "dong_tieu_de" = EXCLUDED."dong_tieu_de", "anh_xa" = EXCLUDED."anh_xa",
    "tao_boi" = EXCLUDED."tao_boi", "cap_nhat_luc" = now()
  RETURNING "id" INTO v_id;
  PERFORM "public"."nhat_ky_ghi"('ho_so_nhap_luu', v_ten, jsonb_build_object('so_cot', (SELECT count(*) FROM jsonb_object_keys("p_anh_xa"))));
  RETURN v_id;
END;
$$;

CREATE FUNCTION "public"."ho_so_nhap_xoa"("p_id" uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ten text;
BEGIN
  PERFORM "public"."kl_nhap_kiem_quyen"();
  DELETE FROM "public"."ho_so_nhap" WHERE "id" = "p_id" RETURNING "ten" INTO v_ten;
  IF v_ten IS NULL THEN RAISE EXCEPTION 'Không tìm thấy hồ sơ ghép cột.' USING ERRCODE = '22023'; END IF;
  PERFORM "public"."nhat_ky_ghi"('ho_so_nhap_xoa', v_ten, '{}'::jsonb);
END;
$$;

-- Mã đích của một mục từ điển có thật trong danh mục / tài khoản không.
CREATE FUNCTION "public"."kl_tu_dien_hop_le"("p_loai" text, "p_ma" text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE "p_loai"
    WHEN 'loai_van_ban' THEN "p_ma" IN ('KL_BTV', 'TB_THUONG_TRUC', 'NQ_TW', 'CONG_VAN', 'KHAC')
    WHEN 'don_vi' THEN EXISTS (SELECT 1 FROM "public"."dm_don_vi" WHERE "ma" = "p_ma")
    WHEN 'can_bo' THEN EXISTS (SELECT 1 FROM "public"."accounts" WHERE "id"::text = "p_ma" AND NOT "is_system")
    WHEN 'loai_thoi_han' THEN EXISTS (SELECT 1 FROM "public"."dm_loai_thoi_han" WHERE "ma" = "p_ma")
    WHEN 'san_pham' THEN EXISTS (SELECT 1 FROM "public"."dm_san_pham" WHERE "ma" = "p_ma")
    WHEN 'cap' THEN EXISTS (SELECT 1 FROM "public"."dm_cap" WHERE "ma" = "p_ma")
    WHEN 'do_khan' THEN "p_ma" IN ('THUONG', 'KHAN', 'THUONG_KHAN', 'HOA_TOC')
    WHEN 'nguon' THEN EXISTS (SELECT 1 FROM "public"."dm_nguon_nhiem_vu" WHERE "ma" = "p_ma")
    WHEN 'nganh' THEN EXISTS (SELECT 1 FROM "public"."dm_nganh" WHERE "ma" = "p_ma")
    WHEN 'linh_vuc' THEN EXISTS (SELECT 1 FROM "public"."dm_linh_vuc" WHERE "ma" = "p_ma")
    WHEN 'tien_do' THEN "p_ma" IN ('DANG_THUC_HIEN', 'HOAN_THANH')
    WHEN 'chat_luong' THEN "p_ma" IN ('KHONG_DAT', 'DAT', 'DAT_TOT', 'DAT_XUAT_SAC')
    ELSE false END;
$$;

-- Từ điển: [{loai, goc, ma}] — thêm hoặc ghi đè (giá trị trong tệp đã chuẩn hoá ở client). Trả số mục đã lưu.
CREATE FUNCTION "public"."tu_dien_nhap_luu"("p_muc" jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m jsonb; v_n integer := 0; v_goc text;
BEGIN
  PERFORM "public"."kl_nhap_kiem_quyen"();
  IF "p_muc" IS NULL OR jsonb_typeof("p_muc") <> 'array' OR jsonb_array_length("p_muc") > 500 THEN
    RAISE EXCEPTION 'Danh sách từ điển không hợp lệ (tối đa 500 mục mỗi lần).' USING ERRCODE = '22023';
  END IF;
  FOR m IN SELECT * FROM jsonb_array_elements("p_muc") LOOP
    v_goc := lower(btrim(regexp_replace(coalesce(m ->> 'goc', ''), '\s+', ' ', 'g')));
    IF v_goc = '' OR char_length(v_goc) > 300 OR NOT coalesce("public"."kl_tu_dien_hop_le"(m ->> 'loai', m ->> 'ma'), false) THEN
      RAISE EXCEPTION 'Mục từ điển không hợp lệ: % "%" → %.', m ->> 'loai', left(v_goc, 60), m ->> 'ma' USING ERRCODE = '22023';
    END IF;
    INSERT INTO "public"."tu_dien_nhap" ("loai", "goc", "ma", "tao_boi") VALUES (m ->> 'loai', v_goc, m ->> 'ma', "auth"."uid"())
    ON CONFLICT ("loai", "goc") DO UPDATE SET "ma" = EXCLUDED."ma", "tao_boi" = EXCLUDED."tao_boi", "tao_luc" = now();
    v_n := v_n + 1;
  END LOOP;
  IF v_n > 0 THEN PERFORM "public"."nhat_ky_ghi"('tu_dien_nhap_luu', NULL, jsonb_build_object('so_muc', v_n)); END IF;
  RETURN v_n;
END;
$$;

-- Mã việc trong tệp đã có trên hệ thống chưa (xem trước: dòng có mã → cập nhật). Người nhập thấy được mọi mã — như quản trị nhiệm vụ.
CREATE FUNCTION "public"."kl_nhap_ma_da_co"("p_ma" text[]) RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM "public"."kl_nhap_kiem_quyen"();
  IF cardinality("p_ma") > 2000 THEN RAISE EXCEPTION 'Tối đa 2000 mã mỗi lần.' USING ERRCODE = '22023'; END IF;
  RETURN ARRAY(SELECT upper("ma") FROM "public"."nhiem_vu" WHERE upper("ma") = ANY (SELECT upper(btrim(x)) FROM unnest("p_ma") x));
END;
$$;

-- Bỏ một dòng ở vùng đệm "Chờ hoàn thiện" (không tạo việc).
CREATE FUNCTION "public"."dong_nhap_bo"("p_id" uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM "public"."kl_nhap_kiem_quyen"();
  UPDATE "public"."dong_nhap" SET "ket_qua" = 'DA_BO', "xu_ly_boi" = "auth"."uid"(), "xu_ly_luc" = now()
  WHERE "id" = "p_id" AND "ket_qua" = 'CHO_HOAN_THIEN';
  IF NOT FOUND THEN RAISE EXCEPTION 'Dòng này không còn ở vùng chờ hoàn thiện.' USING ERRCODE = '22023'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION "public"."kl_truong_nhap"(), "public"."kl_nhap_kiem_quyen"(), "public"."kl_tu_dien_hop_le"(text, text) FROM public, "anon", "authenticated";
REVOKE ALL ON FUNCTION "public"."ho_so_nhap_luu"(text, text, integer, jsonb), "public"."ho_so_nhap_xoa"(uuid), "public"."tu_dien_nhap_luu"(jsonb),
  "public"."dong_nhap_bo"(uuid), "public"."kl_nhap_ma_da_co"(text[]) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."ho_so_nhap_luu"(text, text, integer, jsonb), "public"."ho_so_nhap_xoa"(uuid), "public"."tu_dien_nhap_luu"(jsonb),
  "public"."dong_nhap_bo"(uuid), "public"."kl_nhap_ma_da_co"(text[]) TO "authenticated";
