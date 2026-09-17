-- 0034 — GĐ21: (1) từ chối nhận việc theo cấp, có duyệt, KÍN: bảng tu_choi (lý do chỉ người đề nghị, cấp duyệt và cấp cao hơn trong chuỗi đọc
-- được; A0 tất cả), hàm de_nghi_tu_choi (Owner tài khoản / người theo dõi, chưa xác nhận nhận việc; cấp duyệt = lãnh đạo trực tiếp của
-- người đề nghị: A3 → Trưởng phòng cùng phòng, A2 → PCVP phụ trách hoặc Chánh VP, A1 → Thường trực; người giao thay mặt chỉ nhận tin),
-- duyet_tu_choi (chỉ cấp duyệt; đồng ý → nhiem_vu.bi_tu_choi = true, chờ giao lại; cờ tự xoá khi đổi người theo dõi/Owner tài khoản —
-- GIAO_LAI hoặc giao lại cho người khác). lich_su chỉ ghi "đề nghị từ chối" / "đã duyệt", KHÔNG ghi lý do; tin hệ thống không có lý do.
-- (2) v_ngoai_le: khau BI_TU_CHOI ưu tiên đầu, cột bi_tu_choi, hiện cả việc bị từ chối chưa quá hạn (nhom = TU_CHOI, không cộng vào Đỏ).
-- (3) canh_bao_quet: nhắc cấp duyệt quá 2 ngày làm việc (ngày Việt Nam) chưa duyệt, mức TU_CHOI, chu kỳ nhắc lại như các mức khác.
-- (4) A0 nhắn tin 1-1: policy messages_insert (0030) bỏ chặn A0; tin he_thong vẫn chỉ hàm SECURITY DEFINER tạo.

-- 1. Cờ trên nhiệm vụ + bảng đề nghị (một đề nghị chờ duyệt mỗi việc).
ALTER TABLE "public"."nhiem_vu" ADD COLUMN "bi_tu_choi" boolean NOT NULL DEFAULT false;
CREATE TABLE "public"."tu_choi" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nhiem_vu_id" uuid NOT NULL REFERENCES "public"."nhiem_vu"("id") ON DELETE CASCADE,
  "nguoi_de_nghi" uuid NOT NULL REFERENCES "public"."accounts"("id"),
  "cap_duyet" uuid NOT NULL REFERENCES "public"."accounts"("id"),
  "ly_do" text NOT NULL CHECK (btrim("ly_do") <> ''),
  "trang_thai" text NOT NULL DEFAULT 'CHO_DUYET' CHECK ("trang_thai" IN ('CHO_DUYET', 'DONG_Y', 'KHONG_DONG_Y')),
  "y_kien_duyet" text,
  "tao_luc" timestamp with time zone NOT NULL DEFAULT now(),
  "duyet_luc" timestamp with time zone
);
CREATE INDEX "tu_choi_nhiem_vu_idx" ON "public"."tu_choi" ("nhiem_vu_id", "tao_luc" DESC);
CREATE UNIQUE INDEX "tu_choi_mot_cho_duyet_idx" ON "public"."tu_choi" ("nhiem_vu_id") WHERE "trang_thai" = 'CHO_DUYET';
ALTER TABLE "public"."tu_choi" ENABLE ROW LEVEL SECURITY;
INSERT INTO "public"."kl_cau_hinh" ("khoa", "gia_tri", "mo_ta") VALUES ('tu_choi_han_duyet_ngay', '2', 'Đề nghị từ chối: nhắc cấp duyệt sau N ngày làm việc chưa duyệt')
ON CONFLICT ("khoa") DO NOTHING;

-- 2. Lãnh đạo trực tiếp của một cán bộ (cấp duyệt): A3 → Trưởng phòng cùng phòng (phòng chưa có A2 → PCVP phụ trách → Chánh VP);
--    A2 → PCVP đang phụ trách phòng, không có thì Chánh VP; A1 → A0. Không bao giờ là người giao thay mặt (A3/quan_tri_kl).
CREATE FUNCTION "public"."lanh_dao_truc_tiep"("p_nguoi" uuid) RETURNS uuid
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  WITH a AS (SELECT "role_group", "department" FROM "public"."accounts" WHERE "id" = "p_nguoi"),
  a2 AS (SELECT x."id" FROM "public"."accounts" x, a WHERE x."role_group" = 'A2' AND x."department" = a."department" AND NOT x."is_system" ORDER BY x."username" LIMIT 1),
  pcvp AS (SELECT x."id" FROM "public"."accounts" x, a WHERE x."role_group" = 'A1' AND NOT x."is_chief" AND NOT x."is_system"
           AND "public"."phu_trach"(x."id", a."department", "public"."kl_hom_nay"()) ORDER BY x."username" LIMIT 1),
  cvp AS (SELECT x."id" FROM "public"."accounts" x WHERE x."role_group" = 'A1' AND x."is_chief" AND NOT x."is_system" ORDER BY x."username" LIMIT 1),
  a0 AS (SELECT x."id" FROM "public"."accounts" x WHERE x."role_group" = 'A0' AND NOT x."is_system" ORDER BY x."username" LIMIT 1)
  SELECT CASE a."role_group"
    WHEN 'A3' THEN coalesce((SELECT "id" FROM a2), (SELECT "id" FROM pcvp), (SELECT "id" FROM cvp))
    WHEN 'A2' THEN coalesce((SELECT "id" FROM pcvp), (SELECT "id" FROM cvp))
    WHEN 'A1' THEN (SELECT "id" FROM a0) END
  FROM a;
$$;

-- 3. Ai đọc được một đề nghị: người đề nghị, cấp duyệt, cấp cao hơn trong chuỗi (A2 của phòng người đề nghị, PCVP phụ trách phòng đó,
--    Chánh VP, A0). Chỉ SELECT; ghi chỉ qua hai hàm dưới.
CREATE FUNCTION "public"."tu_choi_thay"("p_nguoi_de_nghi" uuid, "p_cap_duyet" uuid) RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT "auth"."uid"() IS NOT NULL AND (
    "p_nguoi_de_nghi" = "auth"."uid"() OR "p_cap_duyet" = "auth"."uid"()
    OR CASE "public"."me_role"()
         WHEN 'A0' THEN true
         WHEN 'A1' THEN "public"."me_is_chief"()
                        OR "public"."phu_trach"("auth"."uid"(), (SELECT "department" FROM "public"."accounts" WHERE "id" = "p_nguoi_de_nghi"), "public"."kl_hom_nay"())
         WHEN 'A2' THEN "public"."in_my_dept"("p_nguoi_de_nghi")
         ELSE false END);
$$;
CREATE POLICY "tu_choi_select" ON "public"."tu_choi" FOR SELECT TO "authenticated" USING ("public"."tu_choi_thay"("nguoi_de_nghi", "cap_duyet"));

-- 4. de_nghi_tu_choi(p_nhiem_vu, p_ly_do) → id: Owner tài khoản / người theo dõi, việc đang mở, chưa xác nhận nhận việc, chưa có đề nghị chờ.
CREATE FUNCTION "public"."de_nghi_tu_choi"("p_nhiem_vu" uuid, "p_ly_do" text) RETURNS uuid
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v "public"."nhiem_vu"; v_me "public"."accounts"; v_cap "public"."accounts"; v_id uuid; v_ly_do text := btrim(coalesce("p_ly_do", '')); v_tin text;
BEGIN
  SELECT * INTO v_me FROM "public"."accounts" WHERE "id" = "auth"."uid"();
  SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = "p_nhiem_vu";
  IF v_me."id" IS NULL OR v_me."role_group" = 'A0' OR v."id" IS NULL OR NOT (v."nguoi_theo_doi" = v_me."id" OR v."owner_tai_khoan" = v_me."id") THEN
    RAISE EXCEPTION 'Chỉ Owner hoặc người theo dõi vừa được giao việc mới đề nghị từ chối.' USING ERRCODE = '42501';
  END IF;
  IF v."tien_do_ma" = 'HOAN_THANH' THEN RAISE EXCEPTION 'Nhiệm vụ đã đóng, không còn từ chối được.' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM "public"."lich_su" WHERE "nhiem_vu_id" = v."id" AND "cot" = 'xac_nhan_nhan_viec' AND "nguoi_sua" = v_me."id") THEN
    RAISE EXCEPTION 'Đồng chí đã xác nhận nhận việc này, không còn từ chối được.' USING ERRCODE = '22023';
  END IF;
  IF v_ly_do = '' THEN RAISE EXCEPTION 'Đề nghị từ chối phải có lý do.' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM "public"."tu_choi" WHERE "nhiem_vu_id" = v."id" AND "trang_thai" = 'CHO_DUYET') THEN
    RAISE EXCEPTION 'Nhiệm vụ đã có đề nghị từ chối đang chờ duyệt.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_cap FROM "public"."accounts" WHERE "id" = "public"."lanh_dao_truc_tiep"(v_me."id");
  IF v_cap."id" IS NULL THEN RAISE EXCEPTION 'Chưa xác định được lãnh đạo trực tiếp để duyệt đề nghị.' USING ERRCODE = '22023'; END IF;
  INSERT INTO "public"."tu_choi" ("nhiem_vu_id", "nguoi_de_nghi", "cap_duyet", "ly_do") VALUES (v."id", v_me."id", v_cap."id", v_ly_do) RETURNING "id" INTO v_id;
  v_tin := format('Đề nghị từ chối · %s: %s đề nghị từ chối nhận việc, chờ %s duyệt', v."ma", v_me."full_name", v_cap."full_name");
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon") VALUES (v."id", v_me."id", 'tu_choi', format('đề nghị từ chối, chờ %s duyệt', v_cap."full_name"), 'app');
  -- Tin: cấp duyệt + người giao (tao_boi, kể cả người giao thay mặt), trừ chính người đề nghị; không kèm lý do.
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  SELECT v_me."id", u, v_tin, false, 'he_thong', v."id" FROM (SELECT v_cap."id" AS u UNION SELECT v."tao_boi" WHERE v."tao_boi" IS NOT NULL) t
  JOIN "public"."accounts" a ON a."id" = t.u WHERE t.u <> v_me."id" AND NOT a."is_system";
  RETURN v_id;
END;
$$;

-- 5. duyet_tu_choi(p_id, p_dong_y, p_y_kien): chỉ cấp duyệt; đồng ý → bi_tu_choi = true (guard 0026 bỏ qua nhờ kl.chi_dao); người đề nghị nhận tin.
CREATE FUNCTION "public"."duyet_tu_choi"("p_id" uuid, "p_dong_y" boolean, "p_y_kien" text DEFAULT NULL) RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE t "public"."tu_choi"; v_ma text; v_ket text; v_y_kien text := nullif(btrim(coalesce("p_y_kien", '')), '');
BEGIN
  SELECT * INTO t FROM "public"."tu_choi" WHERE "id" = "p_id";
  IF t."id" IS NULL OR "auth"."uid"() IS NULL OR t."cap_duyet" <> "auth"."uid"() THEN
    RAISE EXCEPTION 'Chỉ cấp duyệt ghi trên đề nghị mới được duyệt.' USING ERRCODE = '42501';
  END IF;
  IF t."trang_thai" <> 'CHO_DUYET' THEN RAISE EXCEPTION 'Đề nghị này đã được duyệt.' USING ERRCODE = '22023'; END IF;
  IF "p_dong_y" IS NULL THEN RAISE EXCEPTION 'Phải chọn đồng ý hoặc không đồng ý.' USING ERRCODE = '22023'; END IF;
  UPDATE "public"."tu_choi" SET "trang_thai" = CASE WHEN "p_dong_y" THEN 'DONG_Y' ELSE 'KHONG_DONG_Y' END, "y_kien_duyet" = v_y_kien, "duyet_luc" = now() WHERE "id" = "p_id";
  IF "p_dong_y" THEN
    PERFORM set_config('kl.chi_dao', '1', true);
    UPDATE "public"."nhiem_vu" SET "bi_tu_choi" = true WHERE "id" = t."nhiem_vu_id";
    PERFORM set_config('kl.chi_dao', '', true);
  END IF;
  SELECT "ma" INTO v_ma FROM "public"."nhiem_vu" WHERE "id" = t."nhiem_vu_id";
  v_ket := CASE WHEN "p_dong_y" THEN 'đồng ý từ chối, chờ giao lại' ELSE 'không đồng ý, tiếp tục thực hiện' END;
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon") VALUES (t."nhiem_vu_id", "auth"."uid"(), 'tu_choi', 'đã duyệt: ' || v_ket, 'app');
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  VALUES ("auth"."uid"(), t."nguoi_de_nghi", format('Duyệt đề nghị từ chối · %s: %s%s', v_ma, v_ket, coalesce(' — ' || v_y_kien, '')), false, 'he_thong', t."nhiem_vu_id");
END;
$$;

-- 6. Cờ tự xoá khi việc được giao lại: đổi người theo dõi (GIAO_LAI 0026) hoặc Owner tài khoản (giao lại cho người khác). Chạy sau guard a_.
CREATE FUNCTION "public"."kl_nhiem_vu_xoa_co_tu_choi"() RETURNS trigger
LANGUAGE "plpgsql" SET "search_path" = "public" AS $$
BEGIN
  IF OLD."bi_tu_choi" AND NEW."bi_tu_choi" AND (NEW."nguoi_theo_doi" IS DISTINCT FROM OLD."nguoi_theo_doi" OR NEW."owner_tai_khoan" IS DISTINCT FROM OLD."owner_tai_khoan") THEN
    NEW."bi_tu_choi" := false;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ba_kl_nhiem_vu_xoa_co_tu_choi" BEFORE UPDATE ON "public"."nhiem_vu" FOR EACH ROW EXECUTE FUNCTION "public"."kl_nhiem_vu_xoa_co_tu_choi"();

-- 7. v_ngoai_le (0033): khau BI_TU_CHOI ưu tiên đầu; thêm hàng bị từ chối chưa Đỏ với nhom = TU_CHOI (client không cộng vào Đỏ); cột bi_tu_choi cuối.
CREATE OR REPLACE VIEW "public"."v_ngoai_le" WITH ("security_invoker" = true) AS
SELECT v."id", v."ma", v."noi_dung", v."theo_1400", v."so_hoi_nghi", v."so_ket_luan", v."van_ban_loai",
       v."owner_don_vi_ma", v."owner_don_vi_ten", v."owner_trong_van_phong", v."owner_tai_khoan", v."owner_tai_khoan_ten",
       coalesce(v."owner_tai_khoan_ten", v."owner_don_vi_ten") AS "owner_ten",
       v."so_ngay_qua", v."han_xu_ly", v."so_lan_gia_han", v."muc_canh_bao",
       v."san_pham_loai", v."san_pham_mo_ta",
       coalesce(v."san_pham_ten" || coalesce(': ' || v."san_pham_mo_ta", ''), 'chưa định nghĩa') AS "san_pham_ten",
       v."cap_quyet_dinh", coalesce(v."cap_quyet_dinh_ten", 'chưa xác định') AS "cap_quyet_dinh_ten",
       v."nguoi_theo_doi", v."nguoi_theo_doi_ten", v."nguoi_theo_doi_phong",
       v."dang_dinh_chinh", CASE WHEN v."dang_dinh_chinh" THEN 'DANG_TRA_SOAT' WHEN v."muc_canh_bao" IN ('DO', 'DO_DAC_BIET') THEN 'DO' ELSE 'TU_CHOI' END AS "nhom",
       v."so_chi_dao_cho_phan_hoi", v."cap_nhat_luc", v."cap_nhat_boi",
       CASE
         WHEN n."bi_tu_choi" THEN 'BI_TU_CHOI'
         WHEN v."cap_quyet_dinh" IS NOT NULL THEN 'CHO_QUYET'
         WHEN EXISTS (SELECT 1 FROM "public"."minh_chung" m WHERE m."nhiem_vu_id" = v."id" AND m."hop_le" IS NULL) THEN 'CHO_MINH_CHUNG'
         WHEN v."theo_1400" AND NOT EXISTS (SELECT 1 FROM "public"."lich_su" l WHERE l."nhiem_vu_id" = v."id" AND l."cot" = 'xac_nhan_nhan_viec') THEN 'CHUA_NHAN'
         ELSE 'CHUA_SAN_PHAM' END AS "khau",
       n."bi_tu_choi"
FROM "public"."v_nhiem_vu" v JOIN "public"."nhiem_vu" n ON n."id" = v."id"
WHERE v."muc_canh_bao" IN ('DO', 'DO_DAC_BIET') OR (n."bi_tu_choi" AND n."tien_do_ma" <> 'HOAN_THANH')
ORDER BY n."bi_tu_choi" DESC, v."so_ngay_qua" DESC, v."ma";

-- 8. canh_bao_quet (0032): thêm vòng 3 — đề nghị từ chối quá N ngày làm việc chưa duyệt → tin cho cấp duyệt (mức TU_CHOI, chống trùng theo nhiệm vụ).
ALTER TABLE "public"."canh_bao" DROP CONSTRAINT "canh_bao_muc_check",
  ADD CONSTRAINT "canh_bao_muc_check" CHECK ("muc" IN ('VANG', 'DO', 'DO_DAC_BIET', 'CHI_DAO_TT', 'TU_CHOI'));
CREATE OR REPLACE FUNCTION "public"."canh_bao_quet"("p_ngay" date DEFAULT "public"."kl_hom_nay"()) RETURNS jsonb
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE
  v_n integer := greatest(coalesce((SELECT "gia_tri"::integer FROM "public"."kl_cau_hinh" WHERE "khoa" = 'canh_bao_nhac_lai_ngay'), 3), 1);
  v_han_duyet integer := greatest(coalesce((SELECT "gia_tri"::integer FROM "public"."kl_cau_hinh" WHERE "khoa" = 'tu_choi_han_duyet_ngay'), 2), 0);
  r record; v_nguoi uuid[]; v_tin text; v_id bigint; v_ids bigint[] := ARRAY[]::bigint[];
  v_quet integer := 0; v_bo_qua integer := 0; v_so_tin integer := 0;
  v_gui jsonb := jsonb_build_object('VANG', 0, 'DO', 0, 'DO_DAC_BIET', 0, 'CHI_DAO_TT', 0, 'TU_CHOI', 0);
BEGIN
  IF "p_ngay" IS NULL THEN RAISE EXCEPTION 'Thiếu ngày tính' USING ERRCODE = '22023'; END IF;
  FOR r IN
    SELECT nv AS nv, nv."id", nv."ma", nv."han_xu_ly", (t.tt)."muc_canh_bao" AS muc, (t.tt)."so_ngay_qua" AS so_ngay_qua
    FROM "public"."nhiem_vu" nv CROSS JOIN LATERAL (SELECT "public"."trang_thai"(nv, "p_ngay") AS tt) t
    WHERE nv."dong_luc" IS NULL AND nv."tien_do_ma" <> 'HOAN_THANH' AND (t.tt)."muc_canh_bao" IN ('VANG', 'DO', 'DO_DAC_BIET') ORDER BY nv."ma"
  LOOP
    v_quet := v_quet + 1;
    IF EXISTS (SELECT 1 FROM "public"."canh_bao" c WHERE c."nhiem_vu_id" = r."id" AND c."muc" = r.muc AND c."ngay" > "p_ngay" - v_n) THEN v_bo_qua := v_bo_qua + 1; CONTINUE; END IF;
    SELECT coalesce(array_agg(u), '{}') INTO v_nguoi FROM "public"."canh_bao_nguoi_nhan"(r.nv, r.muc) u;
    v_tin := format('%s · %s: %s', "public"."canh_bao_ten_muc"(r.muc), r."ma",
      CASE r.muc WHEN 'VANG' THEN format('còn %s ngày tới hạn %s, chưa có minh chứng', r."han_xu_ly" - "p_ngay", to_char(r."han_xu_ly", 'DD/MM/YYYY'))
        WHEN 'DO' THEN format('quá hạn %s ngày (hạn %s)', r.so_ngay_qua, to_char(r."han_xu_ly", 'DD/MM/YYYY'))
        ELSE format('quá hạn %s ngày (hạn %s), đã báo lãnh đạo Văn phòng', r.so_ngay_qua, to_char(r."han_xu_ly", 'DD/MM/YYYY')) END);
    INSERT INTO "public"."canh_bao" ("nhiem_vu_id", "muc", "ngay", "nguoi_nhan") VALUES (r."id", r.muc, "p_ngay", v_nguoi) RETURNING "id" INTO v_id;
    v_ids := v_ids || v_id;
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "nguoi_sua_ghi_chu", "cot", "gia_tri_moi", "nguon") VALUES (r."id", NULL, 'Hệ thống — cảnh báo tự động', 'canh_bao', v_tin, 'app');
    INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id") SELECT NULL, u, v_tin, false, 'he_thong', r."id" FROM unnest(v_nguoi) u;
    v_so_tin := v_so_tin + coalesce(array_length(v_nguoi, 1), 0);
    v_gui := jsonb_set(v_gui, ARRAY[r.muc], to_jsonb((v_gui ->> r.muc)::integer + 1));
  END LOOP;
  -- Chỉ đạo Thường trực quá hạn phản hồi (CH-16, 0032): nhắc người nhận chưa phản hồi theo cùng chu kỳ.
  FOR r IN
    SELECT c."id", c."nhiem_vu_id", c."han_phan_hoi", c."noi_dung", c."nguoi_nhan", nv."ma" FROM "public"."chi_dao" c JOIN "public"."nhiem_vu" nv ON nv."id" = c."nhiem_vu_id"
    WHERE c."loai" = 'CHI_DAO_TT' AND c."trang_thai" = 'CHO_PHAN_HOI' AND c."han_phan_hoi" < "p_ngay" ORDER BY nv."ma", c."created_at"
  LOOP
    v_quet := v_quet + 1;
    IF EXISTS (SELECT 1 FROM "public"."canh_bao" c WHERE c."chi_dao_id" = r."id" AND c."muc" = 'CHI_DAO_TT' AND c."ngay" > "p_ngay" - v_n) THEN v_bo_qua := v_bo_qua + 1; CONTINUE; END IF;
    SELECT coalesce(array_agg(u), '{}') INTO v_nguoi FROM unnest(r."nguoi_nhan") u WHERE NOT EXISTS (SELECT 1 FROM "public"."chi_dao" p WHERE p."tra_loi_cho" = r."id" AND p."nguoi_gui" = u);
    IF cardinality(v_nguoi) = 0 THEN v_bo_qua := v_bo_qua + 1; CONTINUE; END IF;
    v_tin := format('Chỉ đạo Thường trực quá hạn phản hồi · %s: quá %s ngày (hạn %s) — %s', r."ma", "p_ngay" - r."han_phan_hoi", to_char(r."han_phan_hoi", 'DD/MM/YYYY'), left(btrim(r."noi_dung"), 80));
    INSERT INTO "public"."canh_bao" ("nhiem_vu_id", "chi_dao_id", "muc", "ngay", "nguoi_nhan") VALUES (r."nhiem_vu_id", r."id", 'CHI_DAO_TT', "p_ngay", v_nguoi) RETURNING "id" INTO v_id;
    v_ids := v_ids || v_id;
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "nguoi_sua_ghi_chu", "cot", "gia_tri_moi", "nguon") VALUES (r."nhiem_vu_id", NULL, 'Hệ thống — cảnh báo tự động', 'canh_bao', v_tin, 'app');
    INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id") SELECT NULL, u, v_tin, false, 'he_thong', r."nhiem_vu_id" FROM unnest(v_nguoi) u;
    v_so_tin := v_so_tin + cardinality(v_nguoi);
    v_gui := jsonb_set(v_gui, ARRAY['CHI_DAO_TT'], to_jsonb((v_gui ->> 'CHI_DAO_TT')::integer + 1));
  END LOOP;
  -- Đề nghị từ chối chờ duyệt quá N ngày làm việc kể từ ngày đề nghị (giờ Việt Nam): nhắc cấp duyệt; không kèm lý do.
  FOR r IN
    SELECT t."id", t."nhiem_vu_id", t."cap_duyet", nv."ma", a."full_name", (t."tao_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS ngay_dn
    FROM "public"."tu_choi" t JOIN "public"."nhiem_vu" nv ON nv."id" = t."nhiem_vu_id" JOIN "public"."accounts" a ON a."id" = t."nguoi_de_nghi"
    WHERE t."trang_thai" = 'CHO_DUYET' AND "public"."ngay_lam_viec_sau"((t."tao_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, v_han_duyet) < "p_ngay" ORDER BY nv."ma"
  LOOP
    v_quet := v_quet + 1;
    IF EXISTS (SELECT 1 FROM "public"."canh_bao" c WHERE c."nhiem_vu_id" = r."nhiem_vu_id" AND c."muc" = 'TU_CHOI' AND c."ngay" > "p_ngay" - v_n) THEN v_bo_qua := v_bo_qua + 1; CONTINUE; END IF;
    v_nguoi := ARRAY[r."cap_duyet"];
    v_tin := format('Đề nghị từ chối chờ duyệt · %s: %s đề nghị từ %s, quá %s ngày làm việc chưa duyệt', r."ma", r."full_name", to_char(r.ngay_dn, 'DD/MM/YYYY'), v_han_duyet);
    INSERT INTO "public"."canh_bao" ("nhiem_vu_id", "muc", "ngay", "nguoi_nhan") VALUES (r."nhiem_vu_id", 'TU_CHOI', "p_ngay", v_nguoi) RETURNING "id" INTO v_id;
    v_ids := v_ids || v_id;
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "nguoi_sua_ghi_chu", "cot", "gia_tri_moi", "nguon") VALUES (r."nhiem_vu_id", NULL, 'Hệ thống — cảnh báo tự động', 'canh_bao', v_tin, 'app');
    INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id") VALUES (NULL, r."cap_duyet", v_tin, false, 'he_thong', r."nhiem_vu_id");
    v_so_tin := v_so_tin + 1;
    v_gui := jsonb_set(v_gui, ARRAY['TU_CHOI'], to_jsonb((v_gui ->> 'TU_CHOI')::integer + 1));
  END LOOP;
  RETURN jsonb_build_object('ngay', "p_ngay", 'quet', v_quet, 'gui', v_gui, 'bo_qua', v_bo_qua, 'tin', v_so_tin,
    'theo_nguoi_nhan', coalesce((SELECT jsonb_agg(jsonb_build_object('tai_khoan', s.username, 'so_tin', s.n) ORDER BY s.n DESC, s.username)
      FROM (SELECT a."username", count(*) AS n FROM "public"."canh_bao" c CROSS JOIN LATERAL unnest(c."nguoi_nhan") u JOIN "public"."accounts" a ON a."id" = u
            WHERE c."id" = ANY (v_ids) GROUP BY a."username") s), '[]'::jsonb));
END;
$$;

-- 9. A0 nhắn tin 1-1 (0030 chặn A0): bỏ điều kiện A0; tin he_thong vẫn chỉ hàm SECURITY DEFINER tạo (nguoi_lien_quan vẫn loại A0).
DROP POLICY "messages_insert" ON "public"."direct_messages";
CREATE POLICY "messages_insert" ON "public"."direct_messages" FOR INSERT TO "authenticated"
  WITH CHECK ("sender_id" = (SELECT "auth"."uid"()) AND "loai" = 'nguoi');

-- 10. Quyền: bảng chỉ đọc qua policy; hai hàm nghiệp vụ cho authenticated; hàm nội bộ không cấp.
REVOKE ALL ON TABLE "public"."tu_choi" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."tu_choi" TO "authenticated";
REVOKE ALL ON FUNCTION "public"."lanh_dao_truc_tiep"(uuid) FROM public, "anon", "authenticated";
REVOKE ALL ON FUNCTION "public"."tu_choi_thay"(uuid, uuid) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."tu_choi_thay"(uuid, uuid) TO "authenticated"; -- policy SELECT gọi dưới vai người đọc
REVOKE ALL ON FUNCTION "public"."de_nghi_tu_choi"(uuid, text) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."de_nghi_tu_choi"(uuid, text) TO "authenticated";
REVOKE ALL ON FUNCTION "public"."duyet_tu_choi"(uuid, boolean, text) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."duyet_tu_choi"(uuid, boolean, text) TO "authenticated";
