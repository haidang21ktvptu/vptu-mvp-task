-- 0076: Mỗi phòng một Trưởng phòng (A2) đang hoạt động — chốt ở tầng bảng (trigger), không chỉ trong admin_sua_tai_khoan (0068/0069):
--   đường "Tạo tài khoản" (Edge Function quan-tri-tai-khoan, ghi bằng service_role) và mọi UPDATE khác đều đi qua. Cùng câu báo lỗi với 0069.
--   Trigger chỉ chặn thay đổi MỚI (không kiểm dữ liệu đang có), nên áp lên production an toàn kể cả khi còn dòng cũ.
--   "Đang hoạt động" = không bị khoá, không phải tài khoản hệ thống (như 0045/0052 lấy "A2 của phòng").

CREATE FUNCTION "public"."accounts_mot_truong_phong"() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_ten text; v_ten_phong text;
BEGIN
  IF NEW."role_group" = 'A2' AND NEW."department" IS NOT NULL AND NOT coalesce(NEW."bi_khoa", false) AND NOT coalesce(NEW."is_system", false) THEN
    SELECT "full_name" INTO v_ten FROM "public"."accounts"
    WHERE "role_group" = 'A2' AND "department" = NEW."department" AND "id" <> NEW."id" AND NOT "is_system" AND NOT coalesce("bi_khoa", false)
    ORDER BY "username" LIMIT 1;
    IF v_ten IS NOT NULL THEN
      SELECT "ten" INTO v_ten_phong FROM "public"."dm_don_vi" WHERE "trong_van_phong" AND "phong" = NEW."department" ORDER BY "thu_tu" LIMIT 1;
      RAISE EXCEPTION '% đã có Trưởng phòng (A2) đang hoạt động: %. Mỗi phòng một Trưởng phòng — đổi vai hoặc khoá tài khoản đó trước.',
        coalesce(v_ten_phong, NEW."department"), v_ten USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ba_accounts_mot_truong_phong" BEFORE INSERT OR UPDATE OF "role_group", "department", "bi_khoa", "is_system" ON "public"."accounts"
  FOR EACH ROW EXECUTE FUNCTION "public"."accounts_mot_truong_phong"();
