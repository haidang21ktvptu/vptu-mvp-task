-- GĐ9 (PR 9A, 1/2) — Phân công PCVP mở rộng theo lĩnh vực (docs/thiet-ke-theo-doi-kl-btvtu.md Phần 5.4,
-- quyết định 7 bổ sung 15/9/2026). File này: danh mục dm_linh_vuc, cột linh_vuc_ma trên kl_nhiem_vu và
-- phu_trach_phong, hai EXCLUDE chống chồng chéo ở tầng DB, hàm quản trị. Phạm vi đọc (kl_pham_vi) ở 0019.
-- Chỉ áp cho module KL: bảng tasks (giao việc nội bộ) không có ngành nên không liên quan.

-- 1. Danh mục lĩnh vực: thuộc đúng một ngành. UNIQUE (nganh_ma, ma) là đích của FK ghép ở mục 2 và 3 —
--    nhờ đó "lĩnh vực phải thuộc đúng ngành của dòng" do DB bảo đảm (CHECK không tra được bảng khác).
CREATE TABLE "public"."dm_linh_vuc" (
  "ma" text PRIMARY KEY,
  "nganh_ma" text NOT NULL REFERENCES "public"."dm_nganh"("ma"),
  "ten" text NOT NULL CHECK (btrim("ten") <> ''),
  "thu_tu" integer NOT NULL,
  UNIQUE ("nganh_ma", "ten"),
  UNIQUE ("nganh_ma", "ma")
);
-- Danh mục ban đầu: tách tên 12 ngành theo dấu " - " (bỏ tiền tố "N. "), 32 lĩnh vực. Người có quan_tri_kl thêm/sửa sau.
INSERT INTO "public"."dm_linh_vuc" ("ma", "nganh_ma", "ten", "thu_tu") VALUES
  ('LV01_THAM_MUU_TONG_HOP', 'THAM_MUU_TONG_HOP', 'Tham mưu tổng hợp (sự kiện/vấn đề lớn, quan trọng của tỉnh)', 1),
  ('LV02_CONG_TAC_TUYEN_GIAO', 'TUYEN_GIAO', 'Công tác tuyên giáo', 1),
  ('LV02_TRUONG_CHINH_TRI', 'TUYEN_GIAO', 'Trường Chính trị', 2),
  ('LV03_NOI_CHINH', 'NOI_CHINH', 'Nội chính', 1),
  ('LV03_ANQP', 'NOI_CHINH', 'ANQP', 2),
  ('LV03_TU_PHAP', 'NOI_CHINH', 'Tư pháp', 3),
  ('LV04_TO_CHUC_XAY_DUNG_DANG', 'TO_CHUC_XAY_DUNG_DANG', 'Tổ chức, xây dựng Đảng', 1),
  ('LV04_KIEM_TRA_DANG', 'TO_CHUC_XAY_DUNG_DANG', 'Kiểm tra Đảng', 2),
  ('LV04_XAY_DUNG_CHINH_QUYEN', 'TO_CHUC_XAY_DUNG_DANG', 'Xây dựng chính quyền', 3),
  ('LV05_CONG_NGHIEP', 'CONG_NGHIEP_NANG_LUONG', 'Công nghiệp', 1),
  ('LV05_NANG_LUONG', 'CONG_NGHIEP_NANG_LUONG', 'Năng lượng', 2),
  ('LV05_KHU_CUM_CN', 'CONG_NGHIEP_NANG_LUONG', 'Khu/cụm CN', 3),
  ('LV05_KHU_KINH_TE', 'CONG_NGHIEP_NANG_LUONG', 'Khu kinh tế', 4),
  ('LV05_DOI_NGOAI_DANG', 'CONG_NGHIEP_NANG_LUONG', 'Đối ngoại Đảng', 5),
  ('LV06_NONG_NGHIEP', 'NONG_NGHIEP_MOI_TRUONG', 'Nông nghiệp', 1),
  ('LV06_TAI_NGUYEN', 'NONG_NGHIEP_MOI_TRUONG', 'Tài nguyên', 2),
  ('LV06_MOI_TRUONG', 'NONG_NGHIEP_MOI_TRUONG', 'Môi trường', 3),
  ('LV06_PCTT', 'NONG_NGHIEP_MOI_TRUONG', 'PCTT', 4),
  ('LV07_MTTQ_DOAN_THE', 'MTTQ_DOAN_THE', 'MTTQ và các tổ chức chính trị xã hội', 1),
  ('LV08_KINH_TE_TONG_HOP', 'KINH_TE_TONG_HOP', 'Kinh tế tổng hợp', 1),
  ('LV08_TAI_CHINH', 'KINH_TE_TONG_HOP', 'Tài chính', 2),
  ('LV08_DAU_TU', 'KINH_TE_TONG_HOP', 'Đầu tư', 3),
  ('LV08_NGAN_SACH', 'KINH_TE_TONG_HOP', 'Ngân sách', 4),
  ('LV09_XAY_DUNG', 'XAY_DUNG_GIAO_THONG', 'Xây dựng', 1),
  ('LV09_GIAO_THONG', 'XAY_DUNG_GIAO_THONG', 'Giao thông', 2),
  ('LV09_DU_AN_GIAO_THONG_TRONG_DIEM', 'XAY_DUNG_GIAO_THONG', 'Dự án giao thông trọng điểm', 3),
  ('LV10_VAN_HOA', 'VAN_HOA_XA_HOI', 'Văn hóa', 1),
  ('LV10_XA_HOI', 'VAN_HOA_XA_HOI', 'Xã hội', 2),
  ('LV10_KHCN', 'VAN_HOA_XA_HOI', 'KHCN', 3),
  ('LV10_CHUYEN_DOI_SO', 'VAN_HOA_XA_HOI', 'Chuyển đổi số', 4),
  ('LV11_CONG_TAC_HOI_DONG_NHAN_DAN', 'HOI_DONG_NHAN_DAN', 'Công tác Hội đồng nhân dân', 1),
  ('LV12_VAN_PHONG_TINH_UY', 'VAN_PHONG_TINH_UY', 'Văn phòng Tỉnh ủy', 1);
-- Tự kiểm: ghép lại các lĩnh vực của mỗi ngành phải ra đúng nguyên văn tên ngành (không sót, không thừa, không sai chính tả).
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT n."ma", n."ten",
             n."thu_tu" || '. ' || (SELECT string_agg(l."ten", ' - ' ORDER BY l."thu_tu") FROM "public"."dm_linh_vuc" l WHERE l."nganh_ma" = n."ma") AS ghep
           FROM "public"."dm_nganh" n LOOP
    IF r.ghep IS DISTINCT FROM r."ten" THEN
      RAISE EXCEPTION 'Danh mục lĩnh vực của ngành % không khớp tên ngành: "%" ≠ "%"', r."ma", r.ghep, r."ten";
    END IF;
  END LOOP;
END $$;

ALTER TABLE "public"."dm_linh_vuc" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."dm_linh_vuc" FROM "anon", "authenticated";
GRANT SELECT, INSERT ON TABLE "public"."dm_linh_vuc" TO "authenticated";
GRANT UPDATE ("ten", "thu_tu") ON TABLE "public"."dm_linh_vuc" TO "authenticated";   -- không đổi ma/nganh_ma, không DELETE
CREATE POLICY "dm_linh_vuc_select" ON "public"."dm_linh_vuc" FOR SELECT TO "authenticated" USING ((SELECT "auth"."uid"()) IS NOT NULL);
CREATE POLICY "dm_linh_vuc_insert_qtkl" ON "public"."dm_linh_vuc" FOR INSERT TO "authenticated"
  WITH CHECK ((SELECT "public"."me_quan_tri_kl"()));
CREATE POLICY "dm_linh_vuc_update_qtkl" ON "public"."dm_linh_vuc" FOR UPDATE TO "authenticated"
  USING ((SELECT "public"."me_quan_tri_kl"())) WITH CHECK ((SELECT "public"."me_quan_tri_kl"()));

-- 2. Nhiệm vụ: lĩnh vực (nullable) thuộc đúng ngành của dòng. linh_vuc_chi_tiet giữ nguyên làm ghi chú, không dùng
--    để phân quyền. Trigger guard 0015 không đổi → chủ trì không có quan_tri_kl không tự đổi được linh_vuc_ma.
ALTER TABLE "public"."kl_nhiem_vu"
  ADD COLUMN "linh_vuc_ma" text REFERENCES "public"."dm_linh_vuc"("ma"),
  ADD CONSTRAINT "kl_nhiem_vu_linh_vuc_thuoc_nganh" FOREIGN KEY ("nganh_ma", "linh_vuc_ma")
    REFERENCES "public"."dm_linh_vuc"("nganh_ma", "ma"),
  ADD CONSTRAINT "kl_nhiem_vu_linh_vuc_can_nganh" CHECK ("linh_vuc_ma" IS NULL OR "nganh_ma" IS NOT NULL);
CREATE INDEX "kl_nhiem_vu_nganh_linh_vuc_idx" ON "public"."kl_nhiem_vu" ("nganh_ma", "linh_vuc_ma");

-- 3. Phân công: cả hai NULL = phụ trách cả phòng; kiêm nhiệm = cả ngành lẫn lĩnh vực, lĩnh vực thuộc đúng ngành.
ALTER TABLE "public"."phu_trach_phong"
  ADD COLUMN "nganh_ma" text REFERENCES "public"."dm_nganh"("ma"),
  ADD COLUMN "linh_vuc_ma" text REFERENCES "public"."dm_linh_vuc"("ma"),
  ADD CONSTRAINT "phu_trach_phong_linh_vuc_thuoc_nganh" FOREIGN KEY ("nganh_ma", "linh_vuc_ma")
    REFERENCES "public"."dm_linh_vuc"("nganh_ma", "ma"),
  ADD CONSTRAINT "phu_trach_phong_kiem_nhiem_du_cap" CHECK (("nganh_ma" IS NULL) = ("linh_vuc_ma" IS NULL)),
  ALTER COLUMN "tu_ngay" SET DEFAULT "public"."kl_hom_nay"();
-- EXCLUDE 1: cùng lãnh đạo không chồng kỳ trên cùng (phòng, ngành, lĩnh vực); coalesce vì NULL không so được trong gist.
ALTER TABLE "public"."phu_trach_phong" DROP CONSTRAINT "phu_trach_phong_khong_chong_ky";
ALTER TABLE "public"."phu_trach_phong" ADD CONSTRAINT "phu_trach_phong_khong_chong_ky" EXCLUDE USING gist (
  "lanh_dao_id" WITH =, "phong" WITH =, (coalesce("nganh_ma", '')) WITH =, (coalesce("linh_vuc_ma", '')) WITH =,
  daterange("tu_ngay", "den_ngay", '[]') WITH &&);
-- EXCLUDE 2: một (phòng, ngành, lĩnh vực) chỉ có MỘT người kiêm nhiệm trong một thời kỳ, dù là ai — không chồng chéo ở tầng DB.
ALTER TABLE "public"."phu_trach_phong" ADD CONSTRAINT "phu_trach_phong_kiem_nhiem_duy_nhat" EXCLUDE USING gist (
  "phong" WITH =, "nganh_ma" WITH =, "linh_vuc_ma" WITH =, daterange("tu_ngay", "den_ngay", '[]') WITH &&)
  WHERE ("linh_vuc_ma" IS NOT NULL);
CREATE INDEX "phu_trach_phong_kiem_nhiem_idx" ON "public"."phu_trach_phong" ("phong", "nganh_ma", "linh_vuc_ma", "tu_ngay");

-- 4. phu_trach() giữ nghĩa "phụ trách CẢ phòng": chỉ xét dòng không có ngành (dòng kiêm nhiệm không được mở cả phòng).
--    Mặc định ngày theo giờ Việt Nam (đóng việc còn lại số 6 của TRANG-THAI).
CREATE OR REPLACE FUNCTION "public"."phu_trach"("p_lanh_dao" uuid, "p_phong" text, "p_ngay" date DEFAULT "public"."kl_hom_nay"())
RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT "p_lanh_dao" IS NOT NULL AND "p_phong" IS NOT NULL AND (
    EXISTS (SELECT 1 FROM "public"."accounts" "a" WHERE "a"."id" = "p_lanh_dao"
              AND (("a"."is_chief" AND "a"."role_group" = 'A1')
                   OR ("a"."role_group" = 'A2' AND "a"."department" = "p_phong")))
    OR EXISTS (SELECT 1 FROM "public"."phu_trach_phong" "p"
               WHERE "p"."lanh_dao_id" = "p_lanh_dao" AND "p"."phong" = "p_phong" AND "p"."nganh_ma" IS NULL
                 AND "p"."tu_ngay" <= "p_ngay" AND ("p"."den_ngay" IS NULL OR "p"."den_ngay" >= "p_ngay"))
  );
$$;

-- Ai đang kiêm nhiệm (phòng, ngành, lĩnh vực) tại một ngày; NULL = không ai (kể cả khi lĩnh vực NULL). Duy nhất nhờ EXCLUDE 2.
CREATE FUNCTION "public"."nguoi_kiem_nhiem"("p_phong" text, "p_nganh" text, "p_linh_vuc" text, "p_ngay" date DEFAULT "public"."kl_hom_nay"())
RETURNS uuid
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT "p"."lanh_dao_id" FROM "public"."phu_trach_phong" "p"
  WHERE "p"."phong" = "p_phong" AND "p"."nganh_ma" = "p_nganh" AND "p"."linh_vuc_ma" = "p_linh_vuc"
    AND "p"."tu_ngay" <= "p_ngay" AND ("p"."den_ngay" IS NULL OR "p"."den_ngay" >= "p_ngay")
  LIMIT 1;
$$;

-- 5. admin_phan_cong_phong: thêm ngành + lĩnh vực (kiêm nhiệm). Đổi chữ ký nên DROP bản 0013 (tránh PostgREST mơ hồ).
--    Giới hạn: mỗi PCVP tối đa 2 dòng phụ trách cả phòng đang/sẽ hiệu lực; kiêm nhiệm không tính.
--    Kiểm trùng trước để báo lỗi tiếng Việt; hai EXCLUDE vẫn là chốt cuối.
DROP FUNCTION "public"."admin_phan_cong_phong"(text, text, boolean, text, date);
CREATE FUNCTION "public"."admin_phan_cong_phong"(
  "p_username" text, "p_phong" text, "p_bat" boolean, "p_ly_do" text,
  "p_tu_ngay" date DEFAULT "public"."kl_hom_nay"(), "p_nganh_ma" text DEFAULT NULL, "p_linh_vuc_ma" text DEFAULT NULL)
RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_ghi_chu text; v_id uuid; v_n integer; v_ten text;
        v_phong text := nullif(btrim(coalesce("p_phong", '')), '');
        v_nganh text := nullif(btrim(coalesce("p_nganh_ma", '')), '');
        v_lv text := nullif(btrim(coalesce("p_linh_vuc_ma", '')), '');
        v_co text;
BEGIN
  v_ghi_chu := "public"."admin_kiem_tra_nguoi_goi"();
  IF v_phong IS NULL OR "p_tu_ngay" IS NULL THEN
    RAISE EXCEPTION 'Thiếu phòng hoặc ngày hiệu lực.' USING ERRCODE = '22023';
  END IF;
  IF (v_nganh IS NULL) <> (v_lv IS NULL) THEN
    RAISE EXCEPTION 'Kiêm nhiệm phải có đủ cả ngành và lĩnh vực.' USING ERRCODE = '22023';
  END IF;
  IF v_lv IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public"."dm_linh_vuc" WHERE "ma" = v_lv AND "nganh_ma" = v_nganh) THEN
    RAISE EXCEPTION 'Lĩnh vực "%" không thuộc ngành "%".', v_lv, v_nganh USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce("p_ly_do", '')), '') IS NULL THEN
    RAISE EXCEPTION 'Phải ghi lý do phân công.' USING ERRCODE = '22023';
  END IF;
  SELECT "id" INTO v_id FROM "public"."accounts"
  WHERE "username" = "p_username" AND "role_group" = 'A1' AND NOT "is_chief";
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Chỉ phân công cho Phó Chánh Văn phòng ("%" không phải).', "p_username" USING ERRCODE = '22023';
  END IF;
  v_co := CASE WHEN v_lv IS NULL THEN 'phu_trach:' || v_phong ELSE 'kiem_nhiem:' || v_phong || ':' || v_nganh || ':' || v_lv END;
  IF "p_bat" THEN
    IF v_lv IS NULL THEN
      SELECT count(*) INTO v_n FROM "public"."phu_trach_phong"
      WHERE "lanh_dao_id" = v_id AND "nganh_ma" IS NULL AND ("den_ngay" IS NULL OR "den_ngay" >= "p_tu_ngay");
      IF v_n >= 2 THEN
        RAISE EXCEPTION 'Mỗi Phó Chánh Văn phòng phụ trách tối đa 2 phòng (đã có %). Kết thúc một phân công trước.', v_n USING ERRCODE = '22023';
      END IF;
    ELSE
      SELECT "a"."full_name" INTO v_ten FROM "public"."phu_trach_phong" "p" JOIN "public"."accounts" "a" ON "a"."id" = "p"."lanh_dao_id"
      WHERE "p"."phong" = v_phong AND "p"."nganh_ma" = v_nganh AND "p"."linh_vuc_ma" = v_lv AND "p"."lanh_dao_id" <> v_id
        AND daterange("p"."tu_ngay", "p"."den_ngay", '[]') && daterange("p_tu_ngay", NULL, '[]') LIMIT 1;
      IF v_ten IS NOT NULL THEN
        RAISE EXCEPTION 'Lĩnh vực này đang do % kiêm nhiệm trong cùng thời kỳ.', v_ten USING ERRCODE = '22023';
      END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM "public"."phu_trach_phong" "p" WHERE "p"."lanh_dao_id" = v_id AND "p"."phong" = v_phong
                 AND "p"."nganh_ma" IS NOT DISTINCT FROM v_nganh AND "p"."linh_vuc_ma" IS NOT DISTINCT FROM v_lv
                 AND daterange("p"."tu_ngay", "p"."den_ngay", '[]') && daterange("p_tu_ngay", NULL, '[]')) THEN
      RAISE EXCEPTION 'Đã có phân công trùng kỳ cho lãnh đạo này.' USING ERRCODE = '22023';
    END IF;
    INSERT INTO "public"."phu_trach_phong" ("lanh_dao_id", "phong", "nganh_ma", "linh_vuc_ma", "tu_ngay", "ly_do", "phan_cong_boi")
    VALUES (v_id, v_phong, v_nganh, v_lv, "p_tu_ngay", btrim("p_ly_do"), "auth"."uid"());
  ELSE
    UPDATE "public"."phu_trach_phong" SET "den_ngay" = "p_tu_ngay" - 1
    WHERE "lanh_dao_id" = v_id AND "phong" = v_phong AND "nganh_ma" IS NOT DISTINCT FROM v_nganh
      AND "linh_vuc_ma" IS NOT DISTINCT FROM v_lv AND "den_ngay" IS NULL AND "tu_ngay" < "p_tu_ngay";
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n = 0 THEN
      -- Bật và tắt cùng ngày, hoặc kết thúc một phân công ghi trước cho tương lai: chưa từng có hiệu lực nên xoá.
      DELETE FROM "public"."phu_trach_phong"
      WHERE "lanh_dao_id" = v_id AND "phong" = v_phong AND "nganh_ma" IS NOT DISTINCT FROM v_nganh
        AND "linh_vuc_ma" IS NOT DISTINCT FROM v_lv AND "den_ngay" IS NULL AND "tu_ngay" >= "p_tu_ngay";
      GET DIAGNOSTICS v_n = ROW_COUNT;
    END IF;
    IF v_n = 0 THEN
      RAISE EXCEPTION 'Không có phân công đang hiệu lực để kết thúc.' USING ERRCODE = '22023';
    END IF;
  END IF;
  INSERT INTO "public"."quyen_lich_su" ("cap_boi", "cap_boi_ghi_chu", "tai_khoan", "co", "bat", "ly_do")
  VALUES ("auth"."uid"(), v_ghi_chu, v_id, v_co, "p_bat",
          btrim("p_ly_do") || ' (hiệu lực ' || to_char("p_tu_ngay", 'DD/MM/YYYY') || ')');
END;
$$;

-- Kiêm nhiệm nhiều lĩnh vực một lần (màn hình Quản trị chọn nhiều): một transaction, lỗi ở lĩnh vực nào thì huỷ cả.
CREATE FUNCTION "public"."admin_kiem_nhiem_linh_vuc"(
  "p_username" text, "p_phong" text, "p_nganh_ma" text, "p_linh_vuc_ma" text[], "p_bat" boolean, "p_ly_do" text,
  "p_tu_ngay" date DEFAULT "public"."kl_hom_nay"())
RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_lv text;
BEGIN
  IF "p_linh_vuc_ma" IS NULL OR cardinality("p_linh_vuc_ma") = 0 THEN
    RAISE EXCEPTION 'Chọn ít nhất một lĩnh vực.' USING ERRCODE = '22023';
  END IF;
  FOREACH v_lv IN ARRAY "p_linh_vuc_ma" LOOP
    PERFORM "public"."admin_phan_cong_phong"("p_username", "p_phong", "p_bat", "p_ly_do", "p_tu_ngay", "p_nganh_ma", v_lv);
  END LOOP;
END;
$$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['phu_trach(uuid,text,date)', 'nguoi_kiem_nhiem(text,text,text,date)',
    'admin_phan_cong_phong(text,text,boolean,text,date,text,text)',
    'admin_kiem_nhiem_linh_vuc(text,text,text,text[],boolean,text,date)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
