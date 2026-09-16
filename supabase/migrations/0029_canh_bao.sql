-- GĐ17 (PR 17A) — cảnh báo tự động 3 cấp, leo thang (SPEC v3 mục 3.4 CB-2, CB-3, CB-6; NF-11, NF-13; KT-4 đổi 16/9):
-- workflow cron GitHub Actions gọi RPC canh_bao_quet() bằng service_role (không pg_cron). Mức lấy từ trang_thai(nv, ngay)
-- (0024) — một nguồn, không tính lại. Sổ gửi canh_bao chống trùng: mỗi (nhiệm vụ, mức) chỉ nhắc lại sau N ngày
-- (kl_cau_hinh.canh_bao_nhac_lai_ngay). Mỗi lần gửi: dòng canh_bao + lich_su (không người sửa, ghi chú "Hệ thống") + tin
-- he_thong cho từng người nhận (chuông GĐ15). Người nhận leo thang theo mức (CB-3, chốt 16/9):
--   VÀNG        Owner tài khoản + người theo dõi;
--   ĐỎ          + lãnh đạo phòng (A2) của phòng Owner và phòng người theo dõi; Owner đơn vị ngoài → + lãnh đạo VP phụ trách (CH-4b);
--   ĐỎ ĐẶC BIỆT + PCVP phụ trách cả hai phòng (pcvp_phu_trach, 0026) + Chánh VP (A1, is_chief).
-- Loại tài khoản is_system; không xử lý "hạ mức" (ngoài phạm vi 17A). Ngày tính theo giờ Việt Nam (kl_hom_nay).

-- 1. Sổ gửi cảnh báo — đọc theo phạm vi thấy nhiệm vụ (dashboard sau này), chỉ hàm ghi.
CREATE TABLE "public"."canh_bao" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "nhiem_vu_id" uuid NOT NULL REFERENCES "public"."nhiem_vu"("id") ON DELETE CASCADE,
  "muc" text NOT NULL CHECK ("muc" IN ('VANG', 'DO', 'DO_DAC_BIET')),
  "ngay" date NOT NULL,                                   -- ngày tính (giờ Việt Nam), mốc chống trùng
  "gui_luc" timestamp with time zone NOT NULL DEFAULT now(),
  "nguoi_nhan" uuid[] NOT NULL DEFAULT '{}'
);
CREATE INDEX "canh_bao_nhiem_vu_muc_idx" ON "public"."canh_bao" ("nhiem_vu_id", "muc", "ngay" DESC);
ALTER TABLE "public"."canh_bao" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "canh_bao_select" ON "public"."canh_bao" FOR SELECT TO "authenticated"
  USING ("public"."kl_thay_nhiem_vu"("nhiem_vu_id"));
REVOKE ALL ON TABLE "public"."canh_bao" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."canh_bao" TO "authenticated";

INSERT INTO "public"."kl_cau_hinh" ("khoa", "gia_tri", "mo_ta") VALUES
  ('canh_bao_nhac_lai_ngay', '3', 'Cùng nhiệm vụ, cùng mức cảnh báo: chỉ nhắc lại sau N ngày')
ON CONFLICT ("khoa") DO NOTHING;

-- 2. Tin hệ thống do job tạo không có người gửi (frontend thông báo đã hiện "Hệ thống" khi thiếu sender_id).
ALTER TABLE "public"."direct_messages" ALTER COLUMN "sender_id" DROP NOT NULL;
ALTER TABLE "public"."direct_messages"
  ADD CONSTRAINT "direct_messages_sender_he_thong" CHECK ("sender_id" IS NOT NULL OR "loai" = 'he_thong');

-- 3. Người nhận theo mức (nội bộ). Dedupe bằng DISTINCT; loại is_system.
CREATE FUNCTION "public"."canh_bao_nguoi_nhan"("p_nv" "public"."nhiem_vu", "p_muc" text) RETURNS SETOF uuid
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  WITH phong AS (
    SELECT "public"."kl_phong_owner"(("p_nv")."owner_tai_khoan", ("p_nv")."owner_don_vi_ma") AS p
    UNION SELECT "department" FROM "public"."accounts" WHERE "id" = ("p_nv")."nguoi_theo_doi"),
  ds AS (
    SELECT ("p_nv")."owner_tai_khoan" AS id
    UNION SELECT ("p_nv")."nguoi_theo_doi"
    UNION SELECT a."id" FROM "public"."accounts" a, phong
      WHERE "p_muc" IN ('DO', 'DO_DAC_BIET') AND a."role_group" = 'A2' AND a."department" = phong.p
    UNION SELECT dv."lanh_dao_phu_trach" FROM "public"."dm_don_vi" dv
      WHERE "p_muc" IN ('DO', 'DO_DAC_BIET') AND dv."ma" = ("p_nv")."owner_don_vi_ma" AND NOT dv."trong_van_phong"
    UNION SELECT "public"."pcvp_phu_trach"(phong.p, ("p_nv")."nganh_ma", ("p_nv")."linh_vuc_ma") FROM phong
      WHERE "p_muc" = 'DO_DAC_BIET'
    UNION SELECT a."id" FROM "public"."accounts" a WHERE "p_muc" = 'DO_DAC_BIET' AND a."is_chief" AND a."role_group" = 'A1')
  SELECT DISTINCT ds."id" FROM ds JOIN "public"."accounts" a ON a."id" = ds."id" WHERE NOT a."is_system";
$$;

CREATE FUNCTION "public"."canh_bao_ten_muc"("p_muc" text) RETURNS text
LANGUAGE "sql" IMMUTABLE AS $$
  SELECT CASE "p_muc" WHEN 'VANG' THEN 'Cảnh báo Vàng' WHEN 'DO' THEN 'Cảnh báo Đỏ' WHEN 'DO_DAC_BIET' THEN 'Cảnh báo Đỏ đặc biệt' ELSE "p_muc" END;
$$;

-- 4. Quét một ngày tính (mặc định hôm nay giờ Việt Nam; test truyền ngày cố định). Idempotent theo (nhiệm vụ, mức, N ngày).
-- Trả jsonb: {ngay, quet, gui: {VANG, DO, DO_DAC_BIET}, bo_qua, tin, theo_nguoi_nhan: [{tai_khoan, so_tin}] giảm dần}.
CREATE FUNCTION "public"."canh_bao_quet"("p_ngay" date DEFAULT "public"."kl_hom_nay"()) RETURNS jsonb
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE
  -- greatest(…, 1): N ≤ 0 do quản trị nhập vẫn không được gửi lặp trong ngày (NF-11).
  v_n integer := greatest(coalesce((SELECT "gia_tri"::integer FROM "public"."kl_cau_hinh" WHERE "khoa" = 'canh_bao_nhac_lai_ngay'), 3), 1);
  r record; v_nguoi uuid[]; v_tin text; v_id bigint; v_ids bigint[] := ARRAY[]::bigint[];
  v_quet integer := 0; v_bo_qua integer := 0; v_so_tin integer := 0;
  v_gui jsonb := jsonb_build_object('VANG', 0, 'DO', 0, 'DO_DAC_BIET', 0);
BEGIN
  IF "p_ngay" IS NULL THEN RAISE EXCEPTION 'Thiếu ngày tính' USING ERRCODE = '22023'; END IF;
  FOR r IN
    SELECT nv AS nv, nv."id", nv."ma", nv."han_xu_ly", (t.tt)."muc_canh_bao" AS muc, (t.tt)."so_ngay_qua" AS so_ngay_qua
    FROM "public"."nhiem_vu" nv
    CROSS JOIN LATERAL (SELECT "public"."trang_thai"(nv, "p_ngay") AS tt) t
    WHERE nv."dong_luc" IS NULL AND (t.tt)."muc_canh_bao" IN ('VANG', 'DO', 'DO_DAC_BIET')
    ORDER BY nv."ma"
  LOOP
    v_quet := v_quet + 1;
    -- Đã gửi cùng mức trong N ngày gần đây (kể cả ngày tính về sau) → bỏ qua.
    IF EXISTS (SELECT 1 FROM "public"."canh_bao" c WHERE c."nhiem_vu_id" = r."id" AND c."muc" = r.muc AND c."ngay" > "p_ngay" - v_n) THEN
      v_bo_qua := v_bo_qua + 1; CONTINUE;
    END IF;
    SELECT coalesce(array_agg(u), '{}') INTO v_nguoi FROM "public"."canh_bao_nguoi_nhan"(r.nv, r.muc) u;
    v_tin := format('%s · %s: %s', "public"."canh_bao_ten_muc"(r.muc), r."ma",
      CASE r.muc
        WHEN 'VANG' THEN format('còn %s ngày tới hạn %s, chưa có minh chứng', r."han_xu_ly" - "p_ngay", to_char(r."han_xu_ly", 'DD/MM/YYYY'))
        WHEN 'DO' THEN format('quá hạn %s ngày (hạn %s)', r.so_ngay_qua, to_char(r."han_xu_ly", 'DD/MM/YYYY'))
        ELSE format('quá hạn %s ngày (hạn %s), đã báo lãnh đạo Văn phòng', r.so_ngay_qua, to_char(r."han_xu_ly", 'DD/MM/YYYY')) END);
    INSERT INTO "public"."canh_bao" ("nhiem_vu_id", "muc", "ngay", "nguoi_nhan") VALUES (r."id", r.muc, "p_ngay", v_nguoi)
    RETURNING "id" INTO v_id;
    v_ids := v_ids || v_id;
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "nguoi_sua_ghi_chu", "cot", "gia_tri_moi", "nguon")
    VALUES (r."id", NULL, 'Hệ thống — cảnh báo tự động', 'canh_bao', v_tin, 'app');
    INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
    SELECT NULL, u, v_tin, false, 'he_thong', r."id" FROM unnest(v_nguoi) u;
    v_so_tin := v_so_tin + coalesce(array_length(v_nguoi, 1), 0);
    v_gui := jsonb_set(v_gui, ARRAY[r.muc], to_jsonb((v_gui ->> r.muc)::integer + 1));
  END LOOP;
  RETURN jsonb_build_object(
    'ngay', "p_ngay", 'quet', v_quet, 'gui', v_gui, 'bo_qua', v_bo_qua, 'tin', v_so_tin,
    'theo_nguoi_nhan', coalesce((
      SELECT jsonb_agg(jsonb_build_object('tai_khoan', s.username, 'so_tin', s.n) ORDER BY s.n DESC, s.username)
      FROM (SELECT a."username", count(*) AS n
            FROM "public"."canh_bao" c CROSS JOIN LATERAL unnest(c."nguoi_nhan") u JOIN "public"."accounts" a ON a."id" = u
            WHERE c."id" = ANY (v_ids) GROUP BY a."username") s), '[]'::jsonb));
END;
$$;

-- 5. Quyền: chỉ service_role gọi được canh_bao_quet (NF-13); hàm phụ không cấp cho client.
REVOKE ALL ON FUNCTION "public"."canh_bao_quet"(date) FROM public, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."canh_bao_quet"(date) TO "service_role";
REVOKE ALL ON FUNCTION "public"."canh_bao_nguoi_nhan"("public"."nhiem_vu", text) FROM public, "anon", "authenticated";
REVOKE ALL ON FUNCTION "public"."canh_bao_ten_muc"(text) FROM public, "anon", "authenticated";
