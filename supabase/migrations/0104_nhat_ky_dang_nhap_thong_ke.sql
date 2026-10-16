-- 0104 (v3.24, chủ dự án duyệt 16/10/2026): nhật ký đăng nhập và thống kê sử dụng cho quản trị hệ thống.
-- 1. nhat_ky_dang_nhap: mỗi PHIÊN đăng nhập (session_id trong JWT của Supabase Auth) một dòng — thời điểm đăng nhập (amr của JWT, nên phiên
--    mở trước khi có bảng này vẫn ghi đúng giờ đăng nhập), trình duyệt (user-agent), địa chỉ IP (tiêu đề yêu cầu PostgREST chuyển vào; để
--    thống kê, không dùng làm chứng cứ kiểm toán),
--    hoạt động gần nhất. Chỉ quan_tri_he_thong đọc (RLS); không ai ghi / sửa / xoá trực tiếp (không cấp quyền). Tài khoản hệ thống (is_system,
--    smoke_test) không ghi. Xoá tài khoản (Dọn dữ liệu thử) kéo theo nhật ký của tài khoản đó.
-- 2. ghi_nhan_dang_nhap(): frontend gọi khi vào app (đăng nhập hoặc tải lại trang — cùng phiên chỉ cập nhật hoạt động gần nhất, không thêm
--    lượt) và tối đa 5 phút một lần khi có thao tác. Lỗi không chặn đăng nhập (frontend bỏ qua lỗi).
-- 3. qt_thong_ke_dang_nhap(từ, đến): theo cán bộ — số lần, lần đầu / gần nhất trong kỳ, hoạt động gần nhất, thiết bị và IP gần nhất; lần đăng
--    nhập và hoạt động gần nhất mọi thời gian; lần đăng nhập gần nhất theo hệ thống xác thực (auth.users — cho thời gian trước khi có nhật ký).
--    Chỉ quản trị hệ thống.
-- 4. qt_thong_ke_nhap_moi(đơn vị, từ, đến): số nhiệm vụ nhập lên hệ thống theo ngày / tuần (bắt đầu thứ Hai) / tháng / năm, giờ Việt Nam, theo
--    người nhập và cách nhập (GIAO_VIEC / TIEP_XUONG / EXCEL) — CHỈ số đếm; danh sách việc của một kỳ đọc qua v_nhiem_vu (RLS, không mở rộng
--    quyền xem). Chỉ quản trị hệ thống.
-- 5. Chỉ mục nhiem_vu(created_at): lọc theo thời gian nhập (thống kê, bộ lọc màn Nhiệm vụ).

-- ---- 1 ----
CREATE TABLE "public"."nhat_ky_dang_nhap" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "tai_khoan" uuid NOT NULL REFERENCES "public"."accounts"("id") ON DELETE CASCADE,
  "phien" uuid NOT NULL CONSTRAINT "nhat_ky_dang_nhap_phien_key" UNIQUE,
  "luc" timestamp with time zone NOT NULL DEFAULT now(),
  "hoat_dong_cuoi" timestamp with time zone NOT NULL DEFAULT now(),
  "trinh_duyet" text CONSTRAINT "nhat_ky_dang_nhap_trinh_duyet_check" CHECK (char_length("trinh_duyet") <= 300),
  "dia_chi_ip" text CONSTRAINT "nhat_ky_dang_nhap_dia_chi_ip_check" CHECK (char_length("dia_chi_ip") <= 64)
);
COMMENT ON TABLE "public"."nhat_ky_dang_nhap" IS
  '0104: mỗi phiên đăng nhập một dòng (session_id của JWT); chỉ quản trị hệ thống đọc; chỉ ghi qua ghi_nhan_dang_nhap().';
CREATE INDEX "nhat_ky_dang_nhap_luc_idx" ON "public"."nhat_ky_dang_nhap" ("luc" DESC);
CREATE INDEX "nhat_ky_dang_nhap_tai_khoan_idx" ON "public"."nhat_ky_dang_nhap" ("tai_khoan", "luc" DESC);
ALTER TABLE "public"."nhat_ky_dang_nhap" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."nhat_ky_dang_nhap" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."nhat_ky_dang_nhap" TO "authenticated";
CREATE POLICY "nhat_ky_dang_nhap_select_qtht" ON "public"."nhat_ky_dang_nhap" FOR SELECT TO "authenticated"
  USING ((SELECT "public"."me_quan_tri_he_thong"()));

-- ---- 2 ----
CREATE FUNCTION "public"."ghi_nhan_dang_nhap"() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := "auth"."uid"();
  v_jwt jsonb := "auth"."jwt"();
  v_phien uuid;
  v_luc timestamptz;
  v_h jsonb;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM "public"."accounts" a WHERE a."id" = v_uid AND NOT a."is_system") THEN RETURN; END IF;
  BEGIN
    v_phien := nullif(v_jwt ->> 'session_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN v_phien := NULL;
  END;
  IF v_phien IS NULL THEN RETURN; END IF;   -- token không mang phiên: không ghi, để khỏi đếm trùng mỗi lần tải trang
  BEGIN
    v_luc := to_timestamp((v_jwt -> 'amr' -> 0 ->> 'timestamp')::double precision);   -- thời điểm xác thực của phiên
  EXCEPTION WHEN others THEN v_luc := NULL;
  END;
  v_luc := least(coalesce(v_luc, now()), now());
  BEGIN
    v_h := nullif(current_setting('request.headers', true), '')::jsonb;
  EXCEPTION WHEN others THEN v_h := NULL;
  END;
  -- IP: ưu tiên tiêu đề do lớp mạng của Supabase đặt (cf-connecting-ip, x-real-ip); x-forwarded-for (phần tử đầu) người gửi tự thêm được — số liệu
  -- để thống kê sử dụng, không phải dữ liệu kiểm toán.
  INSERT INTO "public"."nhat_ky_dang_nhap" ("tai_khoan", "phien", "luc", "trinh_duyet", "dia_chi_ip")
  VALUES (v_uid, v_phien, v_luc, left(nullif(btrim(v_h ->> 'user-agent'), ''), 300),
          left(nullif(btrim(split_part(coalesce(nullif(v_h ->> 'cf-connecting-ip', ''), nullif(v_h ->> 'x-real-ip', ''), v_h ->> 'x-forwarded-for', ''), ',', 1)), ''), 64))
  ON CONFLICT ("phien") DO UPDATE SET "hoat_dong_cuoi" = now()
    WHERE "nhat_ky_dang_nhap"."tai_khoan" = EXCLUDED."tai_khoan";
END;
$$;
REVOKE ALL ON FUNCTION "public"."ghi_nhan_dang_nhap"() FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."ghi_nhan_dang_nhap"() TO "authenticated";

-- ---- 3 ----
CREATE FUNCTION "public"."qt_thong_ke_dang_nhap"("p_tu" timestamptz, "p_den" timestamptz)
RETURNS TABLE ("tai_khoan" uuid, "so_lan" integer, "lan_dau" timestamptz, "lan_cuoi" timestamptz, "hoat_dong_cuoi" timestamptz,
  "trinh_duyet" text, "dia_chi_ip" text, "lan_cuoi_tong" timestamptz, "hoat_dong_cuoi_tong" timestamptz, "lan_cuoi_xac_thuc" timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  PERFORM "public"."admin_kiem_tra_nguoi_goi"();
  IF "p_tu" IS NULL OR "p_den" IS NULL OR "p_den" <= "p_tu" THEN
    RAISE EXCEPTION 'Khoảng thời gian thống kê không hợp lệ.' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  WITH "ky" AS (
    SELECT n."tai_khoan" AS "tk", count(*)::integer AS "so", min(n."luc") AS "dau", max(n."luc") AS "cuoi", max(n."hoat_dong_cuoi") AS "hd",
           (array_agg(n."trinh_duyet" ORDER BY n."luc" DESC))[1] AS "td", (array_agg(n."dia_chi_ip" ORDER BY n."luc" DESC))[1] AS "ip"
    FROM "public"."nhat_ky_dang_nhap" n
    WHERE n."luc" >= "p_tu" AND n."luc" < "p_den"
    GROUP BY n."tai_khoan"),
  "tong" AS (SELECT n."tai_khoan" AS "tk", max(n."luc") AS "cuoi", max(n."hoat_dong_cuoi") AS "hd" FROM "public"."nhat_ky_dang_nhap" n GROUP BY n."tai_khoan")
  SELECT a."id", coalesce(k."so", 0), k."dau", k."cuoi", k."hd", k."td", k."ip", t."cuoi", t."hd", u."last_sign_in_at"
  FROM "public"."accounts" a
  LEFT JOIN "ky" k ON k."tk" = a."id"
  LEFT JOIN "tong" t ON t."tk" = a."id"
  LEFT JOIN "auth"."users" u ON u."id" = a."id"
  WHERE NOT a."is_system"
  ORDER BY k."cuoi" DESC NULLS LAST, a."full_name";
END;
$$;
REVOKE ALL ON FUNCTION "public"."qt_thong_ke_dang_nhap"(timestamptz, timestamptz) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."qt_thong_ke_dang_nhap"(timestamptz, timestamptz) TO "authenticated";

-- ---- 4 ----
CREATE FUNCTION "public"."qt_thong_ke_nhap_moi"("p_don_vi" text, "p_tu" date, "p_den" date)
RETURNS TABLE ("ky" date, "nguoi_nhap" uuid, "cach" text, "so_viec" integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  PERFORM "public"."admin_kiem_tra_nguoi_goi"();
  IF "p_don_vi" IS NULL OR "p_don_vi" NOT IN ('day', 'week', 'month', 'year') THEN
    RAISE EXCEPTION 'Đơn vị thời gian phải là ngày, tuần, tháng hoặc năm.' USING ERRCODE = '22023';
  END IF;
  IF "p_tu" IS NULL OR "p_den" IS NULL OR "p_den" < "p_tu" OR "p_den" - "p_tu" > 3660 THEN
    RAISE EXCEPTION 'Khoảng ngày thống kê không hợp lệ.' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  WITH "v" AS (
    SELECT date_trunc("p_don_vi", n."created_at" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS "k", n."tao_boi" AS "ng",
           CASE WHEN n."nguon" = 'excel' OR d."nhiem_vu_id" IS NOT NULL THEN 'EXCEL'
                WHEN n."nhiem_vu_cha" IS NOT NULL THEN 'TIEP_XUONG'
                ELSE 'GIAO_VIEC' END AS "c"
    FROM "public"."nhiem_vu" n
    LEFT JOIN (SELECT DISTINCT dn."nhiem_vu_id" FROM "public"."dong_nhap" dn   -- việc do lô TẠO (CAP_NHAT = lô chỉ sửa việc có sẵn: không tính)
               WHERE dn."nhiem_vu_id" IS NOT NULL AND dn."ket_qua" IN ('GIAO', 'DA_XONG', 'CHO_NGHIEM_THU', 'DA_HOAN_THIEN')) d ON d."nhiem_vu_id" = n."id"
    WHERE n."created_at" >= ("p_tu"::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
      AND n."created_at" < (("p_den" + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
  SELECT v."k", v."ng", v."c", count(*)::integer
  FROM "v" v
  GROUP BY v."k", v."ng", v."c"
  ORDER BY v."k", v."ng", v."c";
END;
$$;
REVOKE ALL ON FUNCTION "public"."qt_thong_ke_nhap_moi"(text, date, date) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."qt_thong_ke_nhap_moi"(text, date, date) TO "authenticated";

-- ---- 5 ----
CREATE INDEX IF NOT EXISTS "nhiem_vu_created_at_idx" ON "public"."nhiem_vu" ("created_at" DESC);
