-- 0054: Hạn nộp minh chứng (PR-2b, thiết kế A1, A3, A4 phần dữ liệu; Q2, Q4; quyết định 30/9 cho việc giao khi hạn hoàn thành đã qua).
-- 1. Cột mới cuối bảng: nhiem_vu.han_nop_minh_chung, ly_do_han_nop_sat (≤ 500 ký tự); minh_chung.han_nop_lai (chỉ ở dòng bị trả lại).
--    KHÔNG đặt CHECK han_nop ≤ han_xu_ly: việc giao/trả lại khi hạn hoàn thành đã qua có hạn nộp trong [hôm nay, ngày làm việc thứ 2] (Q3, 30/9).
-- 2. kl_khung_han_nop(H[, ngày BH, loại hạn]) = MỘT nguồn khung ngày cho trigger và ô gợi ý ở biểu mẫu (không tính ở client):
--    H ≥ hôm nay: [hôm nay, H], không cần lý do tới ngày làm việc liền trước H (trước hôm nay ⇒ mọi ngày đều cần lý do "việc gấp");
--    H < hôm nay: [hôm nay, ngay_lam_viec_sau(hôm nay, 2)], không cần lý do (việc vẫn tính Quá hạn).
-- 3. Trigger bd_nhiem_vu_han_nop_mc (BEFORE, sau b_ tính hạn Ký ban hành, sau bb_ 1400; SECURITY INVOKER để thấy current_user như guard Q7):
--    (a) người dùng ghi thẳng qua API (current_user = authenticated) không đổi hạn nộp / lý do — chỉ qua dat_han_nop_minh_chung, giao_viec, GIA_HAN;
--    (b) Q2: việc có hạn nộp chỉ Hoàn thành khi có minh chứng hop_le = true (mọi đường: dong_nhiem_vu, Cập nhật nhanh, hàm khác);
--    (c) khi có phiên người dùng (auth.uid()): việc tạo mới nguon = app có H thì bắt buộc hạn nộp; kiểm khung + lý do; đổi H theo đường khác
--        (quan_tri_kl sửa, đổi ngày ban hành) mà làm hạn nộp vi phạm thì báo lỗi, không tự dời. service_role (seed, nhập, fixture) không bị ép.
-- 4. dat_han_nop_minh_chung: allowlist người giao (coalesce(giao_thay_mat_cho, tao_boi), vai A0/A1/A2); Q4: quan_tri_kl khi không có người giao
--    (NULL, hệ thống hoặc bi_khoa). Lý do bắt buộc mọi lần; lịch sử cot = han_nop_minh_chung_ly_do; tin tới chủ trì tài khoản + người theo dõi.
--    Hàm đặt cờ phiên kl.han_nop_qua_ham = 1 (cục bộ giao dịch) quanh UPDATE; guard a3 (0052) thêm cờ này vào điều kiện cho qua — hai cột hạn nộp
--    KHÔNG vào danh sách cột người theo dõi/chủ trì được sửa, nên Cập nhật nhanh / API vẫn bị chặn.

ALTER TABLE "public"."nhiem_vu"
  ADD COLUMN "han_nop_minh_chung" date,
  ADD COLUMN "ly_do_han_nop_sat" text,
  ADD CONSTRAINT "nhiem_vu_ly_do_han_nop_sat_do_dai" CHECK ("ly_do_han_nop_sat" IS NULL OR char_length("ly_do_han_nop_sat") <= 500);
ALTER TABLE "public"."minh_chung"
  ADD COLUMN "han_nop_lai" date,
  ADD CONSTRAINT "minh_chung_han_nop_lai_khi_tra_lai" CHECK ("han_nop_lai" IS NULL OR "hop_le" = false);

CREATE FUNCTION "public"."kl_khung_han_nop"("p_han_xu_ly" date, "p_ngay_ban_hanh" date DEFAULT NULL, "p_loai_thoi_han" text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_h date := "p_han_xu_ly"; v_t date := "public"."kl_hom_nay"(); v_nghi date[] := "public"."kl_ngay_nghi"(); v_bu date[] := "public"."kl_ngay_lam_bu"();
        v_muon date; v_den date;
BEGIN
  IF "p_loai_thoi_han" = 'KY_BAN_HANH' AND "p_ngay_ban_hanh" IS NOT NULL THEN   -- như trigger b_ (0028): H = ngày BH + ky_ban_hanh_ngay
    v_h := "p_ngay_ban_hanh" + coalesce((SELECT "gia_tri"::integer FROM "public"."kl_cau_hinh" WHERE "khoa" = 'ky_ban_hanh_ngay'), 10);
  END IF;
  IF v_h IS NULL THEN RETURN NULL; END IF;
  IF v_h >= v_t THEN
    v_den := v_h;
    v_muon := "public"."ngay_lam_viec_truoc_mang"(v_h, 1, v_nghi, v_bu);
    IF v_muon < v_t THEN v_muon := NULL; END IF;
  ELSE
    v_den := "public"."ngay_lam_viec_sau_mang"(v_t, 2, v_nghi, v_bu);
    v_muon := v_den;
  END IF;
  RETURN jsonb_build_object('han_xu_ly', v_h, 'tu', v_t, 'den', v_den, 'khong_ly_do_den', v_muon, 'goi_y', coalesce(v_muon, v_den), 'qua_han', v_h < v_t);
END;
$$;

CREATE FUNCTION "public"."kl_nhiem_vu_han_nop_mc"() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_k jsonb; v_doi_nop boolean; v_muon date; v_tu date; v_den date; v_truoc date;
BEGIN
  IF TG_OP = 'UPDATE' AND current_user = 'authenticated'
     AND (NEW."han_nop_minh_chung" IS DISTINCT FROM OLD."han_nop_minh_chung" OR NEW."ly_do_han_nop_sat" IS DISTINCT FROM OLD."ly_do_han_nop_sat") THEN
    RAISE EXCEPTION 'Hạn nộp minh chứng chỉ người giao việc sửa (nút "Sửa hạn nộp minh chứng").' USING ERRCODE = '42501';
  END IF;
  NEW."ly_do_han_nop_sat" := nullif(btrim(coalesce(NEW."ly_do_han_nop_sat", '')), '');
  IF NEW."tien_do_ma" = 'HOAN_THANH' AND (TG_OP = 'INSERT' OR OLD."tien_do_ma" <> 'HOAN_THANH') AND NEW."han_nop_minh_chung" IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM "public"."minh_chung" m WHERE m."nhiem_vu_id" = NEW."id" AND m."hop_le") THEN
    RAISE EXCEPTION 'Việc có hạn nộp minh chứng chỉ hoàn thành khi lãnh đạo nghiệm thu minh chứng (xác nhận hợp lệ).' USING ERRCODE = '22023';
  END IF;
  IF "auth"."uid"() IS NULL OR NEW."tien_do_ma" = 'HOAN_THANH' OR (TG_OP = 'INSERT' AND NEW."nguon" <> 'app') THEN RETURN NEW; END IF;
  v_doi_nop := TG_OP = 'INSERT' OR NEW."han_nop_minh_chung" IS DISTINCT FROM OLD."han_nop_minh_chung"
               OR NEW."ly_do_han_nop_sat" IS DISTINCT FROM OLD."ly_do_han_nop_sat";
  IF NOT v_doi_nop AND NEW."han_xu_ly" IS NOT DISTINCT FROM OLD."han_xu_ly" THEN RETURN NEW; END IF;
  IF NEW."han_nop_minh_chung" IS NULL THEN
    IF TG_OP = 'UPDATE' AND OLD."han_nop_minh_chung" IS NOT NULL THEN
      RAISE EXCEPTION 'Không bỏ hạn nộp minh chứng đã đặt.' USING ERRCODE = '22023';
    END IF;
    IF TG_OP = 'INSERT' AND NEW."han_xu_ly" IS NOT NULL THEN
      v_k := "public"."kl_khung_han_nop"(NEW."han_xu_ly");
      RAISE EXCEPTION 'Phải đặt hạn nộp minh chứng (gợi ý %).', to_char((v_k ->> 'goi_y')::date, 'DD/MM/YYYY') USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW."han_xu_ly" IS NULL THEN
    RAISE EXCEPTION 'Việc chưa có hạn hoàn thành thì chưa đặt hạn nộp minh chứng.' USING ERRCODE = '22023';
  END IF;
  v_k := "public"."kl_khung_han_nop"(NEW."han_xu_ly");
  v_tu := (v_k ->> 'tu')::date; v_den := (v_k ->> 'den')::date; v_muon := (v_k ->> 'khong_ly_do_den')::date;
  IF v_doi_nop THEN
    IF NEW."han_nop_minh_chung" < v_tu OR NEW."han_nop_minh_chung" > v_den THEN
      RAISE EXCEPTION 'Hạn nộp minh chứng phải từ % đến %.', to_char(v_tu, 'DD/MM/YYYY'), to_char(v_den, 'DD/MM/YYYY') USING ERRCODE = '22023';
    END IF;
    IF NEW."ngay_nhan_van_ban" IS NOT NULL AND NEW."han_nop_minh_chung" < NEW."ngay_nhan_van_ban" THEN
      RAISE EXCEPTION 'Hạn nộp minh chứng không được trước ngày nhận văn bản (%).', to_char(NEW."ngay_nhan_van_ban", 'DD/MM/YYYY') USING ERRCODE = '22023';
    END IF;
    IF (v_muon IS NULL OR NEW."han_nop_minh_chung" > v_muon) AND NEW."ly_do_han_nop_sat" IS NULL THEN
      RAISE EXCEPTION 'Hạn nộp minh chứng phải trước hạn hoàn thành ít nhất một ngày làm việc (muộn nhất %) — việc gấp thì ghi lý do.',
        coalesce(to_char(v_muon, 'DD/MM/YYYY'), 'không còn ngày nào') USING ERRCODE = '22023';
    END IF;
  ELSIF NEW."han_xu_ly" >= v_tu THEN   -- chỉ hạn hoàn thành đổi (GIA_HAN chỉ kéo dài; quan_tri_kl sửa; đổi ngày ban hành)
    v_truoc := "public"."ngay_lam_viec_truoc"(NEW."han_xu_ly", 1);
    IF NEW."han_nop_minh_chung" > NEW."han_xu_ly" OR (NEW."han_nop_minh_chung" > v_truoc AND NEW."ly_do_han_nop_sat" IS NULL) THEN
      RAISE EXCEPTION 'Hạn hoàn thành mới (%) làm hạn nộp minh chứng (%) không còn trước ít nhất một ngày làm việc — người giao sửa hạn nộp trước.',
        to_char(NEW."han_xu_ly", 'DD/MM/YYYY'), to_char(NEW."han_nop_minh_chung", 'DD/MM/YYYY') USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "bd_nhiem_vu_han_nop_mc" BEFORE INSERT OR UPDATE ON "public"."nhiem_vu"
  FOR EACH ROW EXECUTE FUNCTION "public"."kl_nhiem_vu_han_nop_mc"();

CREATE FUNCTION "public"."dat_han_nop_minh_chung"("p_id" uuid, "p_han" date, "p_ly_do" text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nv "public"."nhiem_vu"; v_me "public"."accounts"; v_giao "public"."accounts"; v_q4 boolean := false; v_k jsonb; v_sat boolean; v_tin text;
        v_ly_do text := nullif(btrim(coalesce("p_ly_do", '')), '');
BEGIN
  SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = "p_id";
  SELECT * INTO v_me FROM "public"."accounts" WHERE "id" = "auth"."uid"();
  IF v_nv."id" IS NULL OR v_me."id" IS NULL THEN RAISE EXCEPTION 'Không tìm thấy nhiệm vụ.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_giao FROM "public"."accounts" WHERE "id" = coalesce(v_nv."giao_thay_mat_cho", v_nv."tao_boi");
  IF v_giao."id" IS NOT NULL AND NOT v_giao."is_system" AND NOT coalesce(v_giao."bi_khoa", false) THEN
    IF v_me."id" <> v_giao."id" OR v_me."role_group" NOT IN ('A0', 'A1', 'A2') THEN
      RAISE EXCEPTION 'Chỉ người giao việc mới sửa hạn nộp minh chứng.' USING ERRCODE = '42501';
    END IF;
  ELSIF "public"."me_quan_tri_kl"() THEN v_q4 := true;
  ELSE RAISE EXCEPTION 'Việc không còn người giao — chỉ quản trị nhiệm vụ sửa hạn nộp minh chứng.' USING ERRCODE = '42501';
  END IF;
  IF v_nv."tien_do_ma" = 'HOAN_THANH' OR v_nv."dong_luc" IS NOT NULL THEN RAISE EXCEPTION 'Nhiệm vụ đã đóng.' USING ERRCODE = '22023'; END IF;
  IF "p_han" IS NULL THEN RAISE EXCEPTION 'Thiếu hạn nộp minh chứng mới.' USING ERRCODE = '22023'; END IF;
  IF v_ly_do IS NULL OR char_length(v_ly_do) > 500 THEN RAISE EXCEPTION 'Sửa hạn nộp minh chứng phải ghi lý do (tối đa 500 ký tự).' USING ERRCODE = '22023'; END IF;
  IF "p_han" IS NOT DISTINCT FROM v_nv."han_nop_minh_chung" THEN RAISE EXCEPTION 'Hạn nộp mới trùng hạn hiện tại.' USING ERRCODE = '22023'; END IF;
  v_k := "public"."kl_khung_han_nop"(v_nv."han_xu_ly");
  v_sat := v_k ->> 'khong_ly_do_den' IS NULL OR "p_han" > (v_k ->> 'khong_ly_do_den')::date;
  PERFORM set_config('kl.han_nop_qua_ham', '1', true);   -- guard a3 (người không phải quan_tri_kl) cho qua đúng một UPDATE này
  UPDATE "public"."nhiem_vu" SET "han_nop_minh_chung" = "p_han", "ly_do_han_nop_sat" = CASE WHEN v_sat THEN v_ly_do END WHERE "id" = "p_id";
  PERFORM set_config('kl.han_nop_qua_ham', '', true);
  v_tin := format('Đổi hạn nộp minh chứng · %s: %s → %s — %s%s', v_nv."ma", coalesce(to_char(v_nv."han_nop_minh_chung", 'DD/MM/YYYY'), '(chưa có)'),
                  to_char("p_han", 'DD/MM/YYYY'), v_ly_do, CASE WHEN v_q4 THEN ' (quản trị sửa thay — không có người giao)' ELSE '' END);
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon")
  VALUES ("p_id", v_me."id", 'han_nop_minh_chung_ly_do', to_char(v_nv."han_nop_minh_chung", 'YYYY-MM-DD'), v_tin, 'app');
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  SELECT v_me."id", u, v_tin, false, 'he_thong', "p_id" FROM (SELECT DISTINCT unnest(ARRAY[v_nv."owner_tai_khoan", v_nv."nguoi_theo_doi"]) AS u) x
  WHERE u IS NOT NULL AND u <> v_me."id";
END;
$$;

-- Guard a3 (bản 0052) + cờ kl.han_nop_qua_ham. Danh sách cột giữ nguyên (không thêm han_nop_minh_chung / ly_do_han_nop_sat).
CREATE OR REPLACE FUNCTION "public"."kl_nhiem_vu_guard_a3"() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE loai text[] := ARRAY['tien_do_ma', 'han_xu_ly', 'ly_do_chua_co_han', 'ngay_hoan_thanh', 'minh_chung', 'van_ban_trien_khai', 'ghi_chu',
                              'san_pham_loai', 'san_pham_mo_ta', 'cap_nhan_san_pham', 'cap_quyet_dinh', 'ngay_nhan_van_ban', 'ngay_nhan_uoc_tinh',
                              'cap_nhat_luc', 'cap_nhat_boi', 'dong_luc', 'thieu_minh_chung'];
BEGIN
  IF "auth"."uid"() IS NULL OR "public"."me_quan_tri_kl"() OR current_setting('kl.chi_dao', true) = '1'
     OR coalesce(current_setting('kl.han_nop_qua_ham', true), '') = '1' THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW) - loai) IS DISTINCT FROM (to_jsonb(OLD) - loai) THEN
    RAISE EXCEPTION 'Người theo dõi/Owner chỉ được cập nhật tiến độ, hạn, ngày hoàn thành, minh chứng, sản phẩm, cấp, ngày nhận, văn bản triển khai, ghi chú.'
      USING ERRCODE = '42501';
  END IF;
  -- Q7: UPDATE trực tiếp qua API (vai authenticated) không đổi hạn đã có; điền khi đang NULL được. Đổi hạn đi qua đề nghị gia hạn.
  IF current_user = 'authenticated' AND OLD."han_xu_ly" IS NOT NULL AND NEW."han_xu_ly" IS DISTINCT FROM OLD."han_xu_ly" THEN
    RAISE EXCEPTION 'Việc đã có hạn xử lý: muốn đổi hạn phải đề nghị gia hạn.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION "public"."kl_khung_han_nop"(date, date, text) FROM public, "anon";
REVOKE ALL ON FUNCTION "public"."kl_nhiem_vu_han_nop_mc"() FROM public, "anon";
REVOKE ALL ON FUNCTION "public"."dat_han_nop_minh_chung"(uuid, date, text) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_khung_han_nop"(date, date, text) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."dat_han_nop_minh_chung"(uuid, date, text) TO "authenticated";
