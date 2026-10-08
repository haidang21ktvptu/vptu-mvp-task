-- 0085 (Đợt E v3.18 — quyết định 8/10/2026: luồng "văn bản gốc X → chuyên viên chủ trì nhập từng nhiệm vụ, giao cho chuyên viên khác; lãnh đạo
-- nhìn dashboard"). Ba việc:
-- 1. giao_viec (thân 0084 nguyên văn + các dòng ghi 0085): MỌI chuyên viên (A3, không cần quan_tri_kl) giao thẳng — Owner là một chuyên viên
--    (phòng bất kỳ) hoặc chính mình; người theo dõi = người giao (ẩn trên biểu mẫu); không áp GV-3; tin giao tới Owner mọi độ khẩn; lich_su
--    'giao_viec'. Thay mặt (nhóm / một lãnh đạo) vẫn chỉ của người quản trị KL và nay là tuỳ chọn; lô nhập Excel giữ như cũ (A3 nhập phải ghi lãnh
--    đạo giao). Tầng giao (sửa thông tin giao, duyệt đề nghị sửa) và người nghiệm thu chính: chuyên viên tạo việc giao thẳng (kl_la_tang_giao,
--    kl_cap_duyet_sua, nguoi_nghiem_thu_chinh).
-- 2. kl_cau_hinh 'xac_nhan_nhan_viec': 1 = cán bộ tự xác nhận đã nhận (nhắc Thường trực giao sau 1 ngày — như cũ, mặc định); 2 = coi như đã nhận
--    ngay khi giao: trigger AFTER INSERT / UPDATE OF owner_tai_khoan, nguoi_theo_doi ghi lich_su 'xac_nhan_nhan_viec' cho Owner và người theo dõi
--    (giao_viec, giao lại, lô Excel). Mọi nơi đọc "đã nhận" (v_nhiem_vu da_xac_nhan_nhan / nguoi_da_nhan, kl_so_chua_xu_ly viec_moi, canh_bao_quet
--    TT_CHUA_NHAN / HOA_TOC_CHUA_NHAN, de_nghi_tu_choi) đều đọc lich_su nên không đổi. Đổi qua qt_dat_cau_hinh (Quản trị → Ngưỡng cảnh báo).
-- 3. Không xoá bảng / hàm xác nhận, từ chối: giữ cho cấu hình 1 và dữ liệu cũ.

-- ---- 2. Cấu hình nhận việc + trigger ----
INSERT INTO "public"."kl_cau_hinh" ("khoa", "gia_tri", "mo_ta") VALUES
  ('xac_nhan_nhan_viec', '1', 'Nhận việc: 1 = cán bộ tự bấm "Xác nhận đã nhận" (việc Thường trực giao nhắc sau 1 ngày làm việc); 2 = tự động coi như đã nhận ngay khi giao, không cần xác nhận (v3.18)')
ON CONFLICT ("khoa") DO NOTHING;

CREATE OR REPLACE FUNCTION "public"."kl_tu_nhan_viec"() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT "gia_tri" = '2' FROM "public"."kl_cau_hinh" WHERE "khoa" = 'xac_nhan_nhan_viec'), false);
$$;
REVOKE ALL ON FUNCTION "public"."kl_tu_nhan_viec"() FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_tu_nhan_viec"() TO "authenticated";

-- Owner tài khoản và người theo dõi của việc đang mở theo quy tắc 1400 được ghi "đã nhận" khi chưa có dòng của chính họ (mỗi người một dòng, như
-- xac_nhan_nhan_viec). nguoi_sua = chính cán bộ (v_nhiem_vu nguoi_da_nhan, viec_moi đọc theo người); gia_tri_moi ghi rõ là tự động.
CREATE OR REPLACE FUNCTION "public"."nhiem_vu_tu_nhan_viec"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid;
BEGIN
  IF NOT coalesce(NEW."theo_1400", false) OR NEW."tien_do_ma" = 'HOAN_THANH' OR NEW."dong_luc" IS NOT NULL OR NOT "public"."kl_tu_nhan_viec"() THEN RETURN NULL; END IF;
  FOREACH u IN ARRAY ARRAY[NEW."owner_tai_khoan", NEW."nguoi_theo_doi"] LOOP
    IF u IS NULL OR EXISTS (SELECT 1 FROM "public"."lich_su" l WHERE l."nhiem_vu_id" = NEW."id" AND l."cot" = 'xac_nhan_nhan_viec' AND l."nguoi_sua" = u)
       OR EXISTS (SELECT 1 FROM "public"."accounts" a WHERE a."id" = u AND (a."is_system" OR a."role_group" = 'A0')) THEN CONTINUE; END IF;
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
    VALUES (NEW."id", u, 'xac_nhan_nhan_viec', 'tự động khi giao (cấu hình không yêu cầu xác nhận) ' || to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI'), 'app');
  END LOOP;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS "zd_nhiem_vu_tu_nhan_viec" ON "public"."nhiem_vu";
CREATE TRIGGER "zd_nhiem_vu_tu_nhan_viec" AFTER INSERT OR UPDATE OF "owner_tai_khoan", "nguoi_theo_doi" ON "public"."nhiem_vu"
  FOR EACH ROW EXECUTE FUNCTION "public"."nhiem_vu_tu_nhan_viec"();

-- ---- 3. Tầng giao: chuyên viên tạo việc giao thẳng (không thay mặt) ----
CREATE OR REPLACE FUNCTION "public"."kl_la_tang_giao"("p_nv" "public"."nhiem_vu") RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT "auth"."uid"() IS NOT NULL AND (
    ("public"."me_quan_tri_kl"() AND "public"."me_role"() IS DISTINCT FROM 'A0')
    OR EXISTS (SELECT 1 FROM "public"."accounts" a WHERE a."id" = "auth"."uid"() AND a."id" = coalesce("p_nv"."giao_thay_mat_cho", "p_nv"."tao_boi")
               AND (a."role_group" IN ('A0', 'A1', 'A2') OR (a."role_group" = 'A3' AND "p_nv"."giao_thay_mat_cho" IS NULL))   -- 0085: chuyên viên giao thẳng
               AND NOT coalesce(a."bi_khoa", false) AND NOT a."is_system")
    OR "public"."kl_trong_nhom_thay_mat"("auth"."uid"(), "p_nv"."giao_thay_mat_nhom", "p_nv"."id"));
$$;

-- Cấp duyệt đề nghị sửa (0071) — bước 1 thêm chuyên viên giao thẳng; bước 2, 3 nguyên văn.
CREATE OR REPLACE FUNCTION "public"."kl_cap_duyet_sua"("p_nv" "public"."nhiem_vu", "p_nguoi" uuid) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v uuid; i int := 0;
BEGIN
  -- 1. Người giao còn hoạt động, vai lãnh đạo (0085: hoặc chuyên viên giao thẳng), khác người đề nghị.
  SELECT a."id" INTO v FROM "public"."accounts" a WHERE a."id" = coalesce("p_nv"."giao_thay_mat_cho", "p_nv"."tao_boi") AND a."id" <> "p_nguoi"
    AND (a."role_group" IN ('A0', 'A1', 'A2') OR (a."role_group" = 'A3' AND "p_nv"."giao_thay_mat_cho" IS NULL)) AND NOT coalesce(a."bi_khoa", false) AND NOT a."is_system";
  IF v IS NOT NULL THEN RETURN v; END IF;
  -- 2. Lãnh đạo trực tiếp (0034); bị khoá thì lên một cấp (tối đa 3 cấp: Trưởng phòng → PCVP → Chánh VP → Thường trực).
  v := "public"."lanh_dao_truc_tiep"("p_nguoi");
  WHILE v IS NOT NULL AND i < 3 AND (v = "p_nguoi" OR EXISTS (SELECT 1 FROM "public"."accounts" a WHERE a."id" = v AND (coalesce(a."bi_khoa", false) OR a."is_system"))) LOOP
    v := "public"."lanh_dao_truc_tiep"(v); i := i + 1;
  END LOOP;
  IF v IS NOT NULL AND v <> "p_nguoi" AND EXISTS (SELECT 1 FROM "public"."accounts" a WHERE a."id" = v AND NOT coalesce(a."bi_khoa", false) AND NOT a."is_system") THEN RETURN v; END IF;
  -- 3. Một quản trị nhiệm vụ còn hạn (không A0).
  SELECT a."id" INTO v FROM "public"."accounts" a WHERE coalesce(a."quan_tri_kl", false) AND (a."quan_tri_kl_het_han" IS NULL OR a."quan_tri_kl_het_han" >= "public"."kl_hom_nay"())
    AND a."role_group" <> 'A0' AND a."id" <> "p_nguoi" AND NOT coalesce(a."bi_khoa", false) AND NOT a."is_system" ORDER BY a."username" LIMIT 1;
  RETURN v;
END;
$$;

-- Người nghiệm thu chính (0061): chuyên viên giao thẳng nghiệm thu việc mình giao (kl_duoc_nghiem_thu đã cho người theo dõi; đây là nhắc + số đếm "Của tôi").
CREATE OR REPLACE FUNCTION "public"."nguoi_nghiem_thu_chinh"("p_nv" "public"."nhiem_vu", "p_nguoi_nop" uuid DEFAULT NULL) RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER AS $$   -- mọi tên đã có schema ⇒ không SET search_path (bớt chi phí mỗi lời gọi)
  -- Bản 0061 nguyên văn; 0085: nhánh 1 thêm chuyên viên giao thẳng (người tạo, không thay mặt) — họ là người nghiệm thu chính (nhắc, số đếm) của việc
  -- mình giao; việc tự giao cho mình (người nộp = người giao) rơi xuống Trưởng phòng như trước.
  SELECT CASE WHEN "public"."kl_viec_a0_giao_cvp"("p_nv") THEN coalesce(
      (SELECT array_agg(a."id" ORDER BY a."username") FROM "public"."accounts" a WHERE coalesce(a."thu_ky_thuong_truc", false) AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false) AND a."role_group" <> 'A0' AND a."id" IS DISTINCT FROM "p_nguoi_nop" AND a."id" IS DISTINCT FROM ("p_nv")."owner_tai_khoan"),
      (SELECT array_agg(a."id" ORDER BY a."username") FROM "public"."accounts" a WHERE coalesce(a."quan_tri_kl" AND (a."quan_tri_kl_het_han" IS NULL OR a."quan_tri_kl_het_han" >= "public"."kl_hom_nay"()), false) AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false) AND a."role_group" <> 'A0' AND a."id" IS DISTINCT FROM "p_nguoi_nop" AND a."id" IS DISTINCT FROM ("p_nv")."owner_tai_khoan"), '{}'::uuid[])
    ELSE coalesce(
      (SELECT ARRAY[a."id"] FROM "public"."accounts" a
       WHERE a."id" = coalesce(("p_nv")."giao_thay_mat_cho", ("p_nv")."tao_boi") AND (a."role_group" IN ('A1', 'A2') OR (a."role_group" = 'A3' AND ("p_nv")."giao_thay_mat_cho" IS NULL))   -- 0085
         AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false) AND a."id" IS DISTINCT FROM "p_nguoi_nop"),
      (SELECT ARRAY[a."id"] FROM "public"."accounts" o JOIN "public"."accounts" a ON a."role_group" = 'A2' AND a."department" = o."department"
       WHERE o."id" = ("p_nv")."owner_tai_khoan" AND o."role_group" = 'A3' AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false) AND a."id" IS DISTINCT FROM "p_nguoi_nop" ORDER BY a."username" LIMIT 1),
      (SELECT ARRAY[a."id"] FROM "public"."pcvp_phu_trach"(
         coalesce((SELECT o."department" FROM "public"."accounts" o WHERE o."id" = ("p_nv")."owner_tai_khoan"),
                  (SELECT d."phong" FROM "public"."dm_don_vi" d WHERE d."ma" = ("p_nv")."owner_don_vi_ma" AND d."trong_van_phong")),
         ("p_nv")."nganh_ma", ("p_nv")."linh_vuc_ma") x(id) JOIN "public"."accounts" a ON a."id" = x.id
       WHERE NOT EXISTS (SELECT 1 FROM "public"."accounts" o WHERE o."id" = ("p_nv")."owner_tai_khoan" AND o."role_group" = 'A1') AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false) AND a."role_group" <> 'A0' AND a."id" IS DISTINCT FROM "p_nguoi_nop"
       ORDER BY a."username" LIMIT 1),
      (SELECT ARRAY[a."id"] FROM "public"."accounts" a
       WHERE ("p_nv")."owner_tai_khoan" IS NULL AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false) AND a."role_group" <> 'A0' AND a."id" IS DISTINCT FROM "p_nguoi_nop" AND a."id" = "public"."lanh_dao_truc_tiep"(("p_nv")."nguoi_theo_doi")
         AND EXISTS (SELECT 1 FROM "public"."dm_don_vi" d WHERE d."ma" = ("p_nv")."owner_don_vi_ma" AND NOT d."trong_van_phong")),
      (SELECT ARRAY[a."id"] FROM "public"."accounts" a WHERE a."role_group" = 'A1' AND a."is_chief" AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false) AND a."id" IS DISTINCT FROM "p_nguoi_nop" ORDER BY a."username" LIMIT 1),
      (SELECT array_agg(a."id" ORDER BY a."username") FROM "public"."accounts" a WHERE coalesce(a."quan_tri_kl" AND (a."quan_tri_kl_het_han" IS NULL OR a."quan_tri_kl_het_han" >= "public"."kl_hom_nay"()), false) AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false) AND a."role_group" <> 'A0' AND a."id" IS DISTINCT FROM "p_nguoi_nop"), '{}'::uuid[]) END;
$$;

-- ---- 1. giao_viec ----
CREATE OR REPLACE FUNCTION "public"."giao_viec"("p" jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_me "public"."accounts"; v_vb "public"."van_ban_giao_viec"; v_dv "public"."dm_don_vi"; v_owner "public"."accounts"; v_tm "public"."accounts";
        v_theo_doi "public"."accounts"; v_1400 boolean := coalesce(("p" ->> 'theo_1400')::boolean, true); v_a0 boolean; v_do_khan text;
        v_phong_owner text; v_loai_han text := coalesce("p" ->> 'loai_thoi_han_ma', 'CO_HAN_CU_THE'); v_cap text; v_id uuid; v_ma text;
        v_nhan uuid; v_nguoi uuid[] := ARRAY[]::uuid[]; v_tin text; v_han date := nullif("p" ->> 'han_xu_ly', '')::date; v_han_nop date;
        v_qtkl boolean := "public"."me_quan_tri_kl"();   -- quyền quan_tri_kl CÓ xét hạn ủy quyền (0041), không đọc cờ thô
        v_lo_nhap boolean := coalesce(current_setting('kl.nhap_excel', true), '') = '1';   -- 0073: gọi từ nhap_excel_dong (0074)
        v_nhap boolean; v_dong "public"."dong_nhap"; v_lo "public"."lo_nhap";
        v_nhom text := nullif("p" ->> 'thay_mat_nhom', ''); v_nhu_a0 boolean;   -- 0079: thay mặt nhóm; Thường trực (A0 hoặc thay mặt Thường trực)
        v_a3_thang boolean := false; v_tu_nhan boolean := "public"."kl_tu_nhan_viec"();   -- 0085: chuyên viên giao thẳng; cấu hình "coi như đã nhận khi giao"
BEGIN
  SELECT * INTO v_me FROM "public"."accounts" WHERE "id" = "auth"."uid"();
  IF nullif("p" ->> 'dong_nhap_id', '') IS NOT NULL THEN   -- 0073: hoàn thiện một dòng ở vùng chờ của lô nhập Excel (biểu mẫu Giao việc điền sẵn)
    SELECT * INTO v_dong FROM "public"."dong_nhap" WHERE "id" = ("p" ->> 'dong_nhap_id')::uuid FOR UPDATE;
    IF v_dong."id" IS NULL OR v_dong."ket_qua" <> 'CHO_HOAN_THIEN' THEN
      RAISE EXCEPTION 'Dòng chờ hoàn thiện không còn (đã hoàn thiện, đã bỏ hoặc lô đã hoàn tác).' USING ERRCODE = '22023';
    END IF;
  END IF;
  v_nhap := v_lo_nhap OR v_dong."id" IS NOT NULL;
  IF v_nhap THEN PERFORM "public"."kl_nhap_kiem_quyen"(); v_qtkl := true; END IF;   -- người nhập (quản trị nhiệm vụ / hệ thống) giao như quản trị nhiệm vụ
  v_a0 := v_me."role_group" = 'A0';
  IF v_nhom IS NOT NULL AND v_nhom NOT IN ('LANH_DAO_VP', 'THUONG_TRUC') THEN RAISE EXCEPTION 'Nhóm thay mặt không hợp lệ.' USING ERRCODE = '22023'; END IF;
  IF v_nhom IS NOT NULL AND v_me."role_group" <> 'A3' THEN RAISE EXCEPTION 'Lãnh đạo giao việc trực tiếp, không ghi thay mặt.' USING ERRCODE = '22023'; END IF;
  v_nhu_a0 := v_a0 OR v_nhom = 'THUONG_TRUC';   -- quy tắc người nhận / ưu tiên / tin như Thường trực giao
  IF v_me."id" IS NULL OR v_me."is_system" OR coalesce(v_me."bi_khoa", false) THEN   -- 0085: mọi vai (kể cả chuyên viên) giao được; thay mặt vẫn của quản trị KL
    RAISE EXCEPTION 'Tài khoản không được giao việc.' USING ERRCODE = '42501';
  END IF;
  IF (v_nhom IS NOT NULL OR nullif("p" ->> 'thay_mat_cho', '') IS NOT NULL) AND NOT v_qtkl THEN
    RAISE EXCEPTION 'Chỉ người quản trị KL mới giao việc thay mặt lãnh đạo.' USING ERRCODE = '42501';
  END IF;
  v_do_khan := coalesce(nullif("p" ->> 'do_khan', ''), CASE WHEN v_nhu_a0 THEN 'KHAN' ELSE 'THUONG' END);
  IF v_do_khan NOT IN ('THUONG', 'KHAN', 'THUONG_KHAN', 'HOA_TOC') THEN RAISE EXCEPTION 'Độ khẩn không hợp lệ.' USING ERRCODE = '22023'; END IF;
  IF ("p" ? 'uu_tien') AND NOT v_a0 THEN RAISE EXCEPTION 'Chỉ Thường trực Tỉnh ủy mới đặt ưu tiên Thường trực.' USING ERRCODE = '42501'; END IF;
  IF nullif("p" ->> 'van_ban_id', '') IS NOT NULL THEN
    SELECT * INTO v_vb FROM "public"."van_ban_giao_viec" WHERE "id" = ("p" ->> 'van_ban_id')::uuid;
    IF v_vb."id" IS NULL THEN RAISE EXCEPTION 'Không tìm thấy văn bản giao việc.' USING ERRCODE = '22023'; END IF;
  ELSIF "p" ? 'van_ban' THEN
    INSERT INTO "public"."van_ban_giao_viec" ("loai", "so_hoi_nghi", "so_ket_luan", "ngay_ban_hanh", "ngay_nhan", "co_quan_ban_hanh", "tao_boi",
                                              "so_nhiem_vu_du_kien", "da_ra_soat_toan_van", "ra_soat_boi", "ra_soat_luc")
    VALUES (coalesce("p" #>> '{van_ban,loai}', 'KHAC'), ("p" #>> '{van_ban,so_hoi_nghi}')::integer, btrim("p" #>> '{van_ban,so_ket_luan}'),
            ("p" #>> '{van_ban,ngay_ban_hanh}')::date, ("p" #>> '{van_ban,ngay_nhan}')::date, nullif(btrim("p" #>> '{van_ban,co_quan_ban_hanh}'), ''), v_me."id",
            nullif("p" #>> '{van_ban,so_nhiem_vu_du_kien}', '')::integer, coalesce(("p" #>> '{van_ban,da_ra_soat_toan_van}')::boolean, false),
            CASE WHEN ("p" #>> '{van_ban,da_ra_soat_toan_van}')::boolean THEN v_me."id" END, CASE WHEN ("p" #>> '{van_ban,da_ra_soat_toan_van}')::boolean THEN now() END)
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
  IF v_nhu_a0 THEN   -- Người nhận việc Thường trực giao (A0 hoặc thay mặt Thường trực): lãnh đạo Văn phòng (theo dõi = chính họ) hoặc Trưởng phòng của phòng được giao.
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
  IF v_me."role_group" = 'A3' AND v_nhom IS NOT NULL THEN   -- 0079: thay mặt cả nhóm — người đại diện ghi vào giao_thay_mat_cho; phạm vi: Lãnh đạo VP = Chánh VP (mọi phòng), Thường trực = nhánh v_nhu_a0 ở trên
    SELECT * INTO v_tm FROM "public"."accounts" WHERE "id" = "public"."kl_dai_dien_nhom_thay_mat"(v_nhom);
    IF v_tm."id" IS NULL THEN RAISE EXCEPTION 'Chưa có tài khoản lãnh đạo để đại diện nhóm %.', "public"."kl_ten_nhom_thay_mat"(v_nhom) USING ERRCODE = '22023'; END IF;
  ELSIF v_me."role_group" = 'A3' AND (v_nhap OR nullif("p" ->> 'thay_mat_cho', '') IS NOT NULL) THEN   -- quản trị KL thay mặt một lãnh đạo; lô nhập Excel như cũ
    SELECT * INTO v_tm FROM "public"."accounts" WHERE "id" = nullif("p" ->> 'thay_mat_cho', '')::uuid;
    IF v_tm."id" IS NULL OR v_tm."is_system" OR v_tm."role_group" NOT IN ('A1', 'A2') THEN
      RAISE EXCEPTION 'Người quản trị KL giao việc phải thay mặt một lãnh đạo Văn phòng hoặc Trưởng phòng.' USING ERRCODE = '22023';
    ELSIF v_tm."role_group" = 'A2' AND NOT (CASE WHEN v_nhap THEN v_tm."department" IS NOT DISTINCT FROM v_phong_owner AND v_phong_owner IS NOT NULL
        ELSE "public"."kl_duoc_giao_cho_phong"(v_me."id", v_phong_owner, nullif("p" ->> 'nganh_ma', ''), nullif("p" ->> 'linh_vuc_ma', ''), v_tm."id") END) THEN
      RAISE EXCEPTION 'Trưởng phòng được thay mặt chỉ giao cho Owner thuộc phòng mình.' USING ERRCODE = '22023';
    ELSIF v_tm."role_group" = 'A1' AND NOT (CASE WHEN v_nhap THEN v_tm."is_chief" OR v_phong_owner IS NULL
          OR "public"."kl_pham_vi_pcvp_cua"(v_tm."id", v_phong_owner, nullif("p" ->> 'nganh_ma', ''), nullif("p" ->> 'linh_vuc_ma', ''))
        ELSE "public"."kl_duoc_giao_cho_phong"(v_me."id", v_phong_owner, nullif("p" ->> 'nganh_ma', ''), nullif("p" ->> 'linh_vuc_ma', ''), v_tm."id") END) THEN
      RAISE EXCEPTION 'Phó Chánh Văn phòng được thay mặt phải phụ trách phòng của Owner.' USING ERRCODE = '22023';
    END IF;
  ELSIF v_me."role_group" = 'A3' THEN   -- 0085 (Đợt E): chuyên viên chủ trì văn bản giao thẳng cho chuyên viên (phòng bất kỳ) hoặc chính mình; theo dõi = người giao
    IF v_owner."id" IS NULL OR v_owner."role_group" <> 'A3' THEN
      RAISE EXCEPTION 'Chuyên viên giao việc cho một chuyên viên (phòng bất kỳ) hoặc cho chính mình; việc giao cho phòng hoặc lãnh đạo do lãnh đạo giao.' USING ERRCODE = '42501';
    END IF;
    v_a3_thang := true; v_theo_doi := v_me;
  ELSIF nullif("p" ->> 'thay_mat_cho', '') IS NOT NULL THEN
    RAISE EXCEPTION 'Lãnh đạo giao việc trực tiếp, không ghi thay mặt.' USING ERRCODE = '22023';
  END IF;
  IF v_dv."ma" IS NOT NULL AND NOT v_dv."trong_van_phong" THEN   -- 0079 (v3.18): mọi vai, kể cả quản trị KL và lô nhập Excel
    RAISE EXCEPTION 'Người chịu trách nhiệm phải là phòng hoặc cán bộ Văn phòng; việc giao cho đơn vị ngoài (sở, ban, ngành, huyện) thì ghi tên đơn vị thực hiện trong nội dung.' USING ERRCODE = '42501';
  END IF;
  IF NOT v_qtkl AND NOT v_a0 AND NOT v_a3_thang THEN   -- GV-3 (0025); 0085: chuyên viên giao thẳng đã kiểm ở trên
    IF v_me."role_group" = 'A2' THEN
      -- 0078: Trưởng phòng giao được cho chính mình (Owner = tài khoản của mình, cấp nhận = cấp trên); còn lại chuyên viên phòng mình như cũ.
      IF v_owner."id" IS DISTINCT FROM v_me."id" AND (v_owner."id" IS NULL OR v_owner."role_group" <> 'A3' OR NOT "public"."kl_duoc_giao_cho_phong"(v_me."id", v_owner."department", nullif("p" ->> 'nganh_ma', ''), nullif("p" ->> 'linh_vuc_ma', ''))) THEN
        RAISE EXCEPTION 'Trưởng phòng chỉ giao việc cho chuyên viên phòng mình hoặc cho chính mình.' USING ERRCODE = '42501';
      END IF;
      IF v_theo_doi."id" <> v_me."id" AND NOT "public"."kl_duoc_giao_cho_phong"(v_me."id", v_theo_doi."department", nullif("p" ->> 'nganh_ma', ''), nullif("p" ->> 'linh_vuc_ma', '')) THEN
        RAISE EXCEPTION 'Người theo dõi phải thuộc phòng của đồng chí.' USING ERRCODE = '42501';
      END IF;
    ELSIF NOT v_me."is_chief" THEN
      -- 0078: Phó Chánh Văn phòng giao được cho chính mình; còn lại theo phạm vi phụ trách như cũ.
      IF v_owner."id" IS DISTINCT FROM v_me."id" AND NOT "public"."kl_duoc_giao_cho_phong"(v_me."id", v_phong_owner, nullif("p" ->> 'nganh_ma', ''), nullif("p" ->> 'linh_vuc_ma', '')) THEN
        RAISE EXCEPTION 'Phó Chánh Văn phòng chỉ giao việc cho phòng, cán bộ được phân công phụ trách, hoặc cho chính mình.' USING ERRCODE = '42501';
      END IF;
      IF v_theo_doi."id" <> v_me."id" AND NOT "public"."kl_duoc_giao_cho_phong"(v_me."id", v_theo_doi."department", nullif("p" ->> 'nganh_ma', ''), nullif("p" ->> 'linh_vuc_ma', '')) THEN
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
    v_cap := coalesce(nullif("p" ->> 'cap_nhan_san_pham', ''), "public"."kl_cap_nhan_mac_dinh"(v_owner, v_dv)); -- 0045: một quy tắc dùng chung với giao lại
  END IF;
  IF v_nhu_a0 THEN PERFORM set_config('kl.thuong_truc', '1', true); END IF;
  INSERT INTO "public"."nhiem_vu" ("van_ban_id", "nguoi_theo_doi", "owner_don_vi_ma", "owner_tai_khoan", "san_pham_loai", "san_pham_mo_ta",
    "cap_nhan_san_pham", "cap_quyet_dinh", "ngay_nhan_van_ban", "ngay_nhan_uoc_tinh", "noi_dung", "loai_thoi_han_ma", "han_xu_ly",
    "ly_do_chua_co_han", "nganh_ma", "linh_vuc_ma", "linh_vuc_chi_tiet", "van_ban_trien_khai", "ghi_chu", "nhiem_vu_cha", "theo_1400", "tao_boi",
    "do_khan", "giao_thay_mat_cho", "uu_tien", "han_nop_minh_chung", "ly_do_han_nop_sat", "nguon_nhiem_vu_ma", "don_vi_phoi_hop", "vuong_mac", "giao_thay_mat_nhom")
  VALUES (v_vb."id", v_theo_doi."id", v_dv."ma", v_owner."id", nullif("p" ->> 'san_pham_loai', ''), nullif(btrim("p" ->> 'san_pham_mo_ta'), ''),
    v_cap, nullif("p" ->> 'cap_quyet_dinh', ''),
    CASE WHEN v_1400 THEN coalesce(nullif("p" ->> 'ngay_nhan_van_ban', '')::date, v_vb."ngay_nhan", "public"."kl_hom_nay"()) ELSE nullif("p" ->> 'ngay_nhan_van_ban', '')::date END,
    false, btrim("p" ->> 'noi_dung'), v_loai_han, v_han, nullif(btrim("p" ->> 'ly_do_chua_co_han'), ''),
    nullif("p" ->> 'nganh_ma', ''), nullif("p" ->> 'linh_vuc_ma', ''), nullif(btrim("p" ->> 'linh_vuc_chi_tiet'), ''), nullif(btrim("p" ->> 'van_ban_trien_khai'), ''),
    nullif(btrim("p" ->> 'ghi_chu'), ''), nullif("p" ->> 'nhiem_vu_cha', '')::uuid, v_1400, v_me."id", v_do_khan, v_tm."id", CASE WHEN v_nhu_a0 THEN 'THUONG_TRUC' END,
    nullif("p" ->> 'han_nop_minh_chung', '')::date, nullif(btrim("p" ->> 'ly_do_han_nop_sat'), ''),
    nullif("p" ->> 'nguon_nhiem_vu_ma', ''), nullif(btrim("p" ->> 'don_vi_phoi_hop'), ''),
    CASE WHEN v_nhap THEN left(nullif(btrim("p" ->> 'vuong_mac'), ''), 500) END, v_nhom)   -- 0073: vướng mắc ghi cùng lúc tạo (không phát tin zc_ từng dòng); 0079: nhóm thay mặt
  RETURNING "id", "ma", "han_xu_ly", "han_nop_minh_chung" INTO v_id, v_ma, v_han, v_han_nop;
  PERFORM set_config('kl.thuong_truc', '', true);
  IF v_dong."id" IS NOT NULL THEN   -- 0073: dòng chờ → đã hoàn thiện, gắn việc vừa tạo (giữ dữ liệu gốc của tệp cho ngăn chi tiết)
    UPDATE "public"."dong_nhap" SET "ket_qua" = 'DA_HOAN_THIEN', "nhiem_vu_id" = v_id, "xu_ly_boi" = v_me."id", "xu_ly_luc" = now() WHERE "id" = v_dong."id";
    SELECT * INTO v_lo FROM "public"."lo_nhap" WHERE "id" = v_dong."lo_id";
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
    VALUES (v_id, v_me."id", 'nhap_excel', format('Hoàn thiện dòng %s của lô nhập Excel %s (tệp %s)', v_dong."so_dong", v_lo."ma", v_lo."ten_tep"), 'app');
  END IF;
  -- Vết và tin hệ thống (lô nhập Excel: không gửi tin từng việc — nhap_excel_lo_xong gửi MỘT tin tổng hợp cho mỗi người, 0074).
  IF v_a3_thang THEN
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon") VALUES (v_id, v_me."id", 'giao_viec', format('Chuyên viên %s giao, người theo dõi là người giao', v_me."full_name"), 'app');
  END IF;
  v_nhan := coalesce(v_owner."id", v_theo_doi."id");
  IF v_tm."id" IS NOT NULL THEN
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon") VALUES (v_id, v_me."id", 'giao_thay_mat', format('%s giao thay mặt %s', v_me."full_name", coalesce("public"."kl_ten_nhom_thay_mat"(v_nhom), v_tm."full_name")), 'app');
    v_nguoi := v_nguoi || CASE WHEN v_nhom IS NOT NULL THEN "public"."kl_nhom_thay_mat_thanh_vien"(v_nhom, v_id) ELSE ARRAY[v_tm."id"] END;   -- 0083: nhóm trong phạm vi việc được báo
  END IF;
  IF v_a0 THEN
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon") VALUES (v_id, v_me."id", 'giao_viec', format('Thường trực Tỉnh ủy giao, độ khẩn %s, người nhận %s', "public"."ten_do_khan"(v_do_khan), v_theo_doi."full_name"), 'app');
  END IF;
  -- 0085: chuyên viên giao thẳng, hoặc cấu hình coi như đã nhận (không còn mục "việc mới chờ nhận"): Owner và người theo dõi luôn có tin giao.
  IF v_a0 OR v_tm."id" IS NOT NULL OR v_do_khan <> 'THUONG' OR v_a3_thang OR v_tu_nhan THEN v_nguoi := v_nguoi || v_nhan || v_theo_doi."id"; END IF;
  IF v_do_khan IN ('THUONG_KHAN', 'HOA_TOC') THEN v_nguoi := v_nguoi || "public"."lanh_dao_truc_tiep"(v_nhan); END IF;
  IF v_nhu_a0 OR v_do_khan = 'HOA_TOC' THEN v_nguoi := v_nguoi || (SELECT "id" FROM "public"."accounts" WHERE "is_chief" AND "role_group" = 'A1' AND NOT "is_system" ORDER BY "username" LIMIT 1); END IF;
  v_tin := format('%s · %s: %s (hạn %s%s)', CASE WHEN v_a0 THEN 'Thường trực giao việc' WHEN v_tm."id" IS NOT NULL THEN 'Giao việc thay mặt ' || coalesce("public"."kl_ten_nhom_thay_mat"(v_nhom), v_tm."full_name") ELSE 'Giao việc' END
    || CASE WHEN v_do_khan <> 'THUONG' THEN ' · ' || "public"."ten_do_khan"(v_do_khan) ELSE '' END, v_ma, left(btrim("p" ->> 'noi_dung'), 120), coalesce(to_char(v_han, 'DD/MM/YYYY'), 'ký ban hành'),
    coalesce(', hạn nộp minh chứng ' || to_char(v_han_nop, 'DD/MM/YYYY'), ''));
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  SELECT DISTINCT v_me."id", u, v_tin, false, 'he_thong', v_id FROM unnest(v_nguoi) u JOIN "public"."accounts" a ON a."id" = u
  WHERE u <> v_me."id" AND NOT a."is_system" AND a."role_group" <> 'A0' AND NOT v_lo_nhap;
  RETURN jsonb_build_object('id', v_id, 'ma', v_ma, 'van_ban_id', v_vb."id");
END;
$function$;
