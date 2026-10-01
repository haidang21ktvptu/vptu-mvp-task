-- 0062: PR-3 — tiếp thu tính năng của phần mềm điều hành (quyết định chủ dự án 1/10/2026, CAU-HOI-NGHIEP-VU nhóm I). Chỉ tính năng, không dữ liệu.
-- 1. dm_nguon_nhiem_vu: 6 dòng cố định (màn Danh mục chỉ quản ngành / lĩnh vực ⇒ đổi danh mục này bằng migration). Đọc: mọi người đã đăng nhập.
-- 2. nhiem_vu: chat_luong (4 mức, chỉ ghi khi nghiệm thu / đóng việc — hàm 0063), nguon_nhiem_vu_ma (FK; cột nguon = app/excel giữ nguyên nghĩa),
--    vuong_mac (≤ 500 ký tự, xoá trống = đã giải quyết), don_vi_phoi_hop (≤ 300, nhiều đơn vị cách nhau bằng dấu ;). Việc cũ để NULL.
-- 3. van_ban_giao_viec: so_nhiem_vu_du_kien (≥ 0, NULL = chưa khai), da_ra_soat_toan_van, ra_soat_boi, ra_soat_luc — sửa qua van_ban_dat_ra_soat (0065).
-- 4. Trigger be_nhiem_vu_pr3 (BEFORE, sau bd_ hạn nộp; SECURITY INVOKER): chuẩn hoá chuỗi trống ⇒ NULL; việc không ở HOAN_THANH (mở lại) thì
--    xoá chat_luong. Khi có phiên người dùng (auth.uid()): việc tạo mới nguon = app bắt buộc nguồn nhiệm vụ đang dùng; không bỏ nguồn đã có.
--    service_role (seed, script nhập, spec dựng dữ liệu) không bị ép — giống cách 0054 ép hạn nộp minh chứng.
-- 5. Guard a3 (bản 0054) + 'vuong_mac' vào danh sách cột Owner / người theo dõi được sửa qua API; cờ phiên kl.ghi_qua_ham (hàm 0063 / 0065 đặt
--    cục bộ giao dịch quanh ĐÚNG câu UPDATE rồi xoá, như kl.han_nop_qua_ham). chat_luong, nguon_nhiem_vu_ma, don_vi_phoi_hop KHÔNG vào danh sách.
-- 6. Trigger zc_nhiem_vu_tin_vuong_mac (AFTER UPDATE, vuong_mac NULL → có, việc đang mở): tin hệ thống tới người giao vai A1/A2 + PCVP phụ
--    trách phòng chủ trì (cùng cách tìm với nhánh 3 của nguoi_nghiem_thu_chinh); rỗng ⇒ nguoi_nghiem_thu_chinh (việc Thường trực giao Chánh VP
--    ⇒ thư ký Thường trực). Không gửi A0 kể cả khi A0 là người giao, không gửi chính người viết; không tạo cảnh báo.

CREATE TABLE "public"."dm_nguon_nhiem_vu" (
  "ma" text PRIMARY KEY,
  "ten" text NOT NULL UNIQUE,
  "thu_tu" integer NOT NULL,
  "dang_dung" boolean NOT NULL DEFAULT true
);
INSERT INTO "public"."dm_nguon_nhiem_vu" ("ma", "ten", "thu_tu") VALUES
  ('CHUONG_TRINH_CONG_TAC', 'Chương trình công tác năm', 1),
  ('NHIEM_VU_DINH_KY', 'Nhiệm vụ định kỳ', 2),
  ('LINH_VUC_TRONG_TAM', 'Lĩnh vực trọng tâm', 3),
  ('VAN_BAN_CAN_THEO_DOI', 'Văn bản cần theo dõi', 4),
  ('NHIEM_VU_DA_BIET_TRUOC', 'Nhiệm vụ đã biết trước', 5),
  ('NHIEM_VU_PHAT_SINH', 'Nhiệm vụ phát sinh', 6);
ALTER TABLE "public"."dm_nguon_nhiem_vu" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."dm_nguon_nhiem_vu" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."dm_nguon_nhiem_vu" TO "authenticated";
CREATE POLICY "dm_nguon_nhiem_vu_select" ON "public"."dm_nguon_nhiem_vu" FOR SELECT TO "authenticated" USING ((SELECT "auth"."uid"()) IS NOT NULL);

ALTER TABLE "public"."nhiem_vu"
  ADD COLUMN "chat_luong" text CONSTRAINT "nhiem_vu_chat_luong_check" CHECK ("chat_luong" IN ('KHONG_DAT', 'DAT', 'DAT_TOT', 'DAT_XUAT_SAC')),
  ADD COLUMN "nguon_nhiem_vu_ma" text REFERENCES "public"."dm_nguon_nhiem_vu" ("ma"),
  ADD COLUMN "vuong_mac" text CONSTRAINT "nhiem_vu_vuong_mac_check" CHECK (char_length("vuong_mac") <= 500),
  ADD COLUMN "don_vi_phoi_hop" text CONSTRAINT "nhiem_vu_don_vi_phoi_hop_check" CHECK (char_length("don_vi_phoi_hop") <= 300);

ALTER TABLE "public"."van_ban_giao_viec"
  ADD COLUMN "so_nhiem_vu_du_kien" integer CONSTRAINT "van_ban_so_nhiem_vu_du_kien_check" CHECK ("so_nhiem_vu_du_kien" >= 0),
  ADD COLUMN "da_ra_soat_toan_van" boolean NOT NULL DEFAULT false,
  ADD COLUMN "ra_soat_boi" uuid REFERENCES "public"."accounts" ("id") ON DELETE SET NULL,
  ADD COLUMN "ra_soat_luc" timestamptz;

CREATE FUNCTION "public"."kl_nhiem_vu_pr3_truoc_ghi"() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW."vuong_mac" := nullif(btrim(coalesce(NEW."vuong_mac", '')), '');
  NEW."don_vi_phoi_hop" := nullif(btrim(coalesce(NEW."don_vi_phoi_hop", '')), '');
  IF NEW."tien_do_ma" IS DISTINCT FROM 'HOAN_THANH' THEN NEW."chat_luong" := NULL; END IF;   -- mở lại việc ⇒ bỏ đánh giá cũ
  IF "auth"."uid"() IS NULL THEN RETURN NEW; END IF;   -- service_role / seed / script nhập: không ép nguồn
  IF TG_OP = 'INSERT' AND NEW."nguon" = 'app' AND NEW."nguon_nhiem_vu_ma" IS NULL THEN
    RAISE EXCEPTION 'Phải chọn nguồn nhiệm vụ.' USING ERRCODE = '22023';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."nguon_nhiem_vu_ma" IS NOT NULL AND NEW."nguon_nhiem_vu_ma" IS NULL THEN
    RAISE EXCEPTION 'Không bỏ nguồn nhiệm vụ đã chọn.' USING ERRCODE = '22023';
  END IF;
  IF NEW."nguon_nhiem_vu_ma" IS NOT NULL AND (TG_OP = 'INSERT' OR NEW."nguon_nhiem_vu_ma" IS DISTINCT FROM OLD."nguon_nhiem_vu_ma")
     AND NOT EXISTS (SELECT 1 FROM "public"."dm_nguon_nhiem_vu" d WHERE d."ma" = NEW."nguon_nhiem_vu_ma" AND d."dang_dung") THEN
    RAISE EXCEPTION 'Nguồn nhiệm vụ không hợp lệ hoặc đã ngừng dùng.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "be_nhiem_vu_pr3" BEFORE INSERT OR UPDATE ON "public"."nhiem_vu"
  FOR EACH ROW EXECUTE FUNCTION "public"."kl_nhiem_vu_pr3_truoc_ghi"();

-- Guard a3 (bản 0054) + 'vuong_mac' trong danh sách được sửa + cờ kl.ghi_qua_ham.
CREATE OR REPLACE FUNCTION "public"."kl_nhiem_vu_guard_a3"() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE loai text[] := ARRAY['tien_do_ma', 'han_xu_ly', 'ly_do_chua_co_han', 'ngay_hoan_thanh', 'minh_chung', 'van_ban_trien_khai', 'ghi_chu',
                              'san_pham_loai', 'san_pham_mo_ta', 'cap_nhan_san_pham', 'cap_quyet_dinh', 'ngay_nhan_van_ban', 'ngay_nhan_uoc_tinh',
                              'cap_nhat_luc', 'cap_nhat_boi', 'dong_luc', 'thieu_minh_chung', 'vuong_mac'];
BEGIN
  IF "auth"."uid"() IS NULL OR "public"."me_quan_tri_kl"() OR current_setting('kl.chi_dao', true) = '1'
     OR coalesce(current_setting('kl.han_nop_qua_ham', true), '') = '1' OR coalesce(current_setting('kl.ghi_qua_ham', true), '') = '1' THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW) - loai) IS DISTINCT FROM (to_jsonb(OLD) - loai) THEN
    RAISE EXCEPTION 'Người theo dõi/Owner chỉ được cập nhật tiến độ, hạn, ngày hoàn thành, minh chứng, sản phẩm, cấp, ngày nhận, văn bản triển khai, ghi chú, vướng mắc.'
      USING ERRCODE = '42501';
  END IF;
  -- Q7: UPDATE trực tiếp qua API (vai authenticated) không đổi hạn đã có; điền khi đang NULL được. Đổi hạn đi qua đề nghị gia hạn.
  IF current_user = 'authenticated' AND OLD."han_xu_ly" IS NOT NULL AND NEW."han_xu_ly" IS DISTINCT FROM OLD."han_xu_ly" THEN
    RAISE EXCEPTION 'Việc đã có hạn xử lý: muốn đổi hạn phải đề nghị gia hạn.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- 6. Tin vướng mắc lần đầu (NULL → có). Phòng chủ trì: phòng của Owner tài khoản, không có thì phòng của đơn vị Owner trong Văn phòng.
CREATE FUNCTION "public"."kl_nhiem_vu_tin_vuong_mac"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nhan uuid[]; v_phong text; v_me uuid := "auth"."uid"();
BEGIN
  IF NEW."tien_do_ma" = 'HOAN_THANH' OR NEW."dong_luc" IS NOT NULL THEN RETURN NULL; END IF;
  v_phong := coalesce((SELECT o."department" FROM "public"."accounts" o WHERE o."id" = NEW."owner_tai_khoan"),
                      (SELECT d."phong" FROM "public"."dm_don_vi" d WHERE d."ma" = NEW."owner_don_vi_ma" AND d."trong_van_phong"));
  SELECT array_agg(DISTINCT x."id") INTO v_nhan FROM (
    SELECT a."id" FROM "public"."accounts" a
    WHERE a."id" = coalesce(NEW."giao_thay_mat_cho", NEW."tao_boi") AND a."role_group" IN ('A1', 'A2') AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false)
    UNION ALL
    (SELECT a."id" FROM "public"."pcvp_phu_trach"(v_phong, NEW."nganh_ma", NEW."linh_vuc_ma") p(id) JOIN "public"."accounts" a ON a."id" = p.id
     WHERE a."role_group" = 'A1' AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false) ORDER BY a."username" LIMIT 1)) x
  WHERE x."id" IS DISTINCT FROM v_me;
  IF v_nhan IS NULL THEN v_nhan := "public"."nguoi_nghiem_thu_chinh"(NEW, v_me); END IF;   -- hàm này đã loại A0
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  SELECT v_me, u, format('Vướng mắc cần lãnh đạo quyết định · %s: %s', NEW."ma", left(NEW."vuong_mac", 200)), false, 'he_thong', NEW."id"
  FROM unnest(coalesce(v_nhan, '{}'::uuid[])) u WHERE u IS DISTINCT FROM v_me;
  RETURN NULL;
END;
$$;
CREATE TRIGGER "zc_nhiem_vu_tin_vuong_mac" AFTER UPDATE ON "public"."nhiem_vu"
  FOR EACH ROW WHEN (OLD."vuong_mac" IS NULL AND NEW."vuong_mac" IS NOT NULL)
  EXECUTE FUNCTION "public"."kl_nhiem_vu_tin_vuong_mac"();

REVOKE ALL ON FUNCTION "public"."kl_nhiem_vu_pr3_truoc_ghi"() FROM public, "anon";
REVOKE ALL ON FUNCTION "public"."kl_nhiem_vu_tin_vuong_mac"() FROM public, "anon", "authenticated";
