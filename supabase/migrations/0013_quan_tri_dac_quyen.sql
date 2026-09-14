-- GĐ8 (PR 8A-1) — Quản trị đặc quyền (docs/thiet-ke-theo-doi-kl-btvtu.md Phần 5):
-- hai cờ trên accounts, nhật ký cấp quyền, hàm admin_dat_co, bảng phụ trách phòng
-- có hiệu lực theo ngày + hàm admin_phan_cong_phong. Độc lập với module KL (0014+).
-- Nguyên tắc: cờ không kế thừa vai trò; mọi thay đổi cờ/phân công đi qua hàm và có vết.

-- 1. Hai cờ đặc quyền. Quyền cột tường minh (SPEC §5): chỉ SELECT; authenticated không
--    có UPDATE trên hai cột này (0008 chỉ cấp 4 cột) nên UPDATE trực tiếp bị chặn.
ALTER TABLE "public"."accounts"
  ADD COLUMN "quan_tri_kl" boolean NOT NULL DEFAULT false,
  ADD COLUMN "quan_tri_he_thong" boolean NOT NULL DEFAULT false;
GRANT SELECT ("quan_tri_kl", "quan_tri_he_thong") ON "public"."accounts" TO "authenticated";

-- Chủ dự án giữ quan_tri_he_thong (chỉ gán bằng migration). KHÔNG gán quan_tri_kl cho ai:
-- chủ dự án tự cấp qua màn hình Quản trị sau khi phát hành, để có vết trong quyen_lich_su.
UPDATE "public"."accounts" SET "quan_tri_he_thong" = true WHERE "username" = 'buibahaidang';
-- Production (≥ 40 cán bộ thật) bắt buộc phải có đúng chủ dự án giữ cờ; local/staging (seed) không có tài khoản này.
DO $$ BEGIN
  IF (SELECT count(*) FROM "public"."accounts") >= 40
     AND NOT EXISTS (SELECT 1 FROM "public"."accounts" WHERE "quan_tri_he_thong") THEN
    RAISE EXCEPTION 'Không tìm thấy tài khoản chủ dự án để gán quan_tri_he_thong — kiểm tra username trước khi áp migration.';
  END IF;
END $$;

CREATE OR REPLACE VIEW "public"."accounts_public"
WITH ("security_invoker" = true) AS
SELECT "id", "username", "full_name", "role_group", "position_title",
       "created_at", "manager_id", "department", "must_change_password", "is_chief", "is_system",
       "quan_tri_kl", "quan_tri_he_thong"
FROM "public"."accounts";

CREATE FUNCTION "public"."me_quan_tri_kl"() RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT coalesce((SELECT "quan_tri_kl" FROM "public"."accounts" WHERE "id" = "auth"."uid"()), false);
$$;

CREATE FUNCTION "public"."me_quan_tri_he_thong"() RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT coalesce((SELECT "quan_tri_he_thong" FROM "public"."accounts" WHERE "id" = "auth"."uid"()), false);
$$;

-- 2. Nhật ký cấp quyền: không xoá, không sửa được, kể cả chủ dự án (chỉ hàm ghi).
CREATE TABLE "public"."quyen_lich_su" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "luc" timestamp with time zone NOT NULL DEFAULT now(),
  "cap_boi" uuid REFERENCES "public"."accounts"("id"),
  "cap_boi_ghi_chu" text,
  "tai_khoan" uuid NOT NULL REFERENCES "public"."accounts"("id"),
  "co" text NOT NULL,
  "bat" boolean NOT NULL,
  "ly_do" text NOT NULL
);
CREATE INDEX "quyen_lich_su_tai_khoan_idx" ON "public"."quyen_lich_su" ("tai_khoan", "luc" DESC);
ALTER TABLE "public"."quyen_lich_su" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."quyen_lich_su" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."quyen_lich_su" TO "authenticated";
CREATE POLICY "quyen_lich_su_select_qtht" ON "public"."quyen_lich_su"
  FOR SELECT TO "authenticated" USING ((SELECT "public"."me_quan_tri_he_thong"()));

-- Người gọi hàm quản trị: người có quan_tri_he_thong đã đăng nhập, hoặc đường dự phòng
-- qua CLI (Phần 5.3: `supabase db query` chạy với vai postgres, không có auth.uid()).
CREATE FUNCTION "public"."admin_kiem_tra_nguoi_goi"() RETURNS text
LANGUAGE "plpgsql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
BEGIN
  -- session_user (không phải current_user: trong hàm SECURITY DEFINER current_user luôn là postgres).
  IF "auth"."uid"() IS NULL AND session_user = 'postgres' THEN RETURN 'qua CLI'; END IF;
  IF "public"."me_quan_tri_he_thong"() THEN RETURN NULL; END IF;
  RAISE EXCEPTION 'Chỉ người có quyền quản trị hệ thống mới được thực hiện.' USING ERRCODE = '42501';
END;
$$;

-- 3. Bật/tắt cờ cho một tài khoản, có lý do, ghi nhật ký trong cùng transaction.
--    Chỉ quan_tri_kl; quan_tri_he_thong chỉ đổi bằng migration (không ai tự cấp cho mình).
CREATE FUNCTION "public"."admin_dat_co"("p_username" text, "p_co" text, "p_bat" boolean, "p_ly_do" text)
RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_ghi_chu text; v_id uuid;
BEGIN
  v_ghi_chu := "public"."admin_kiem_tra_nguoi_goi"();
  IF "p_co" IS DISTINCT FROM 'quan_tri_kl' THEN
    RAISE EXCEPTION 'Cờ "%" không được cấp qua hàm này.', "p_co" USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce("p_ly_do", '')), '') IS NULL THEN
    RAISE EXCEPTION 'Phải ghi lý do cấp/thu quyền.' USING ERRCODE = '22023';
  END IF;
  SELECT "id" INTO v_id FROM "public"."accounts" WHERE "username" = "p_username";
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Không có tài khoản "%".', "p_username" USING ERRCODE = '22023';
  END IF;
  INSERT INTO "public"."quyen_lich_su" ("cap_boi", "cap_boi_ghi_chu", "tai_khoan", "co", "bat", "ly_do")
  VALUES ("auth"."uid"(), v_ghi_chu, v_id, "p_co", "p_bat", btrim("p_ly_do"));
  UPDATE "public"."accounts" SET "quan_tri_kl" = "p_bat" WHERE "id" = v_id;
END;
$$;

-- 4. Phân công lãnh đạo phụ trách phòng, hiệu lực theo ngày (Phần 5.4). Bảng tạo RỖNG:
--    phân công thật do chủ dự án nhập trên màn hình Quản trị (không suy từ manager_id).
--    Không chồng kỳ cho cùng (lãnh đạo, phòng): EXCLUDE bằng btree_gist.
CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA "extensions";

CREATE TABLE "public"."phu_trach_phong" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "lanh_dao_id" uuid NOT NULL REFERENCES "public"."accounts"("id"),
  "phong" text NOT NULL,
  "tu_ngay" date NOT NULL DEFAULT current_date,
  "den_ngay" date,
  "ly_do" text NOT NULL,
  "phan_cong_boi" uuid REFERENCES "public"."accounts"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "phu_trach_phong_ky_check" CHECK ("den_ngay" IS NULL OR "den_ngay" >= "tu_ngay"),
  CONSTRAINT "phu_trach_phong_khong_chong_ky" EXCLUDE USING gist (
    "lanh_dao_id" WITH =, "phong" WITH =,
    daterange("tu_ngay", "den_ngay", '[]') WITH &&
  )
);
CREATE INDEX "phu_trach_phong_phong_idx" ON "public"."phu_trach_phong" ("phong", "tu_ngay");
ALTER TABLE "public"."phu_trach_phong" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."phu_trach_phong" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."phu_trach_phong" TO "authenticated";
-- Bảng phân công không nhạy cảm; ai đã đăng nhập cũng đọc được (màn hình Quản trị, RLS KL).
CREATE POLICY "phu_trach_phong_select" ON "public"."phu_trach_phong"
  FOR SELECT TO "authenticated" USING ((SELECT "auth"."uid"()) IS NOT NULL);

-- Lãnh đạo có phụ trách phòng tại một ngày không: Chánh VP luôn có; trưởng phòng (A2)
-- phụ trách phòng mình theo accounts.department; còn lại tra bảng phân công.
CREATE FUNCTION "public"."phu_trach"("p_lanh_dao" uuid, "p_phong" text, "p_ngay" date DEFAULT current_date)
RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT "p_lanh_dao" IS NOT NULL AND "p_phong" IS NOT NULL AND (
    EXISTS (SELECT 1 FROM "public"."accounts" "a" WHERE "a"."id" = "p_lanh_dao"
              AND (("a"."is_chief" AND "a"."role_group" = 'A1')
                   OR ("a"."role_group" = 'A2' AND "a"."department" = "p_phong")))
    OR EXISTS (SELECT 1 FROM "public"."phu_trach_phong" "p"
               WHERE "p"."lanh_dao_id" = "p_lanh_dao" AND "p"."phong" = "p_phong"
                 AND "p"."tu_ngay" <= "p_ngay" AND ("p"."den_ngay" IS NULL OR "p"."den_ngay" >= "p_ngay"))
  );
$$;

-- Bật = thêm dòng hiệu lực từ p_tu_ngay; tắt = đóng dòng đang hiệu lực (den_ngay = p_tu_ngay - 1),
-- không xoá để giữ lịch sử "ai phụ trách phòng nào tháng nào". Ghi quyen_lich_su với co = 'phu_trach:<phòng>'.
CREATE FUNCTION "public"."admin_phan_cong_phong"(
  "p_username" text, "p_phong" text, "p_bat" boolean, "p_ly_do" text, "p_tu_ngay" date DEFAULT current_date)
RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_ghi_chu text; v_id uuid; v_phong text := nullif(btrim(coalesce("p_phong", '')), ''); v_n integer;
BEGIN
  v_ghi_chu := "public"."admin_kiem_tra_nguoi_goi"();
  IF v_phong IS NULL OR "p_tu_ngay" IS NULL THEN
    RAISE EXCEPTION 'Thiếu phòng hoặc ngày hiệu lực.' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce("p_ly_do", '')), '') IS NULL THEN
    RAISE EXCEPTION 'Phải ghi lý do phân công.' USING ERRCODE = '22023';
  END IF;
  SELECT "id" INTO v_id FROM "public"."accounts"
  WHERE "username" = "p_username" AND "role_group" = 'A1' AND NOT "is_chief";
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Chỉ phân công cho Phó Chánh Văn phòng ("%" không phải).', "p_username" USING ERRCODE = '22023';
  END IF;
  IF "p_bat" THEN
    INSERT INTO "public"."phu_trach_phong" ("lanh_dao_id", "phong", "tu_ngay", "ly_do", "phan_cong_boi")
    VALUES (v_id, v_phong, "p_tu_ngay", btrim("p_ly_do"), "auth"."uid"());
  ELSE
    UPDATE "public"."phu_trach_phong" SET "den_ngay" = "p_tu_ngay" - 1
    WHERE "lanh_dao_id" = v_id AND "phong" = v_phong AND "den_ngay" IS NULL AND "tu_ngay" < "p_tu_ngay";
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n = 0 THEN
      -- Bật và tắt cùng ngày, hoặc kết thúc một phân công ghi trước cho tương lai: dòng đó chưa từng có
      -- hiệu lực tại p_tu_ngay nên xoá (màn hình Quản trị hiện dòng den_ngay NULL là "đang phụ trách").
      DELETE FROM "public"."phu_trach_phong"
      WHERE "lanh_dao_id" = v_id AND "phong" = v_phong AND "den_ngay" IS NULL AND "tu_ngay" >= "p_tu_ngay";
      GET DIAGNOSTICS v_n = ROW_COUNT;
    END IF;
    IF v_n = 0 THEN
      RAISE EXCEPTION 'Không có phân công đang hiệu lực để kết thúc.' USING ERRCODE = '22023';
    END IF;
  END IF;
  INSERT INTO "public"."quyen_lich_su" ("cap_boi", "cap_boi_ghi_chu", "tai_khoan", "co", "bat", "ly_do")
  VALUES ("auth"."uid"(), v_ghi_chu, v_id, 'phu_trach:' || v_phong, "p_bat",
          btrim("p_ly_do") || ' (hiệu lực ' || to_char("p_tu_ngay", 'DD/MM/YYYY') || ')');
END;
$$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['me_quan_tri_kl()', 'me_quan_tri_he_thong()',
    'admin_dat_co(text,text,boolean,text)', 'phu_trach(uuid,text,date)',
    'admin_phan_cong_phong(text,text,boolean,text,date)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
-- Hàm kiểm tra người gọi chỉ dùng nội bộ trong hai hàm admin_* (chạy với quyền chủ sở hữu).
REVOKE ALL ON FUNCTION "public"."admin_kiem_tra_nguoi_goi"() FROM "public", "anon", "authenticated";
