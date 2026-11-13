-- 0133 (v3.35 — CAU-HOI nhóm U, tiếp 0132): bảng theo dõi của phân hệ Nhiệm vụ quý BTV — cập nhật tiến độ (gắn tuần báo cáo), ý kiến chỉ đạo /
-- trao đổi, tệp, lịch sử, ảnh chụp khi chốt tuần, đầu mối tổng hợp, khoá chống nhắc trùng; cột nvq_nhiem_vu_id của chuông dùng chung; RLS chỉ đọc cho
-- mọi bảng nvq_ (ghi qua hàm SECURITY DEFINER 0135–0137); kho tệp nvq-tep (policy ở 0134).

-- ---- 4. Cập nhật tiến độ, ý kiến, tệp, lịch sử, ảnh chụp tuần ----
CREATE TABLE "public"."nvq_cap_nhat" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nhiem_vu_id" uuid NOT NULL REFERENCES "public"."nvq_nhiem_vu"("id") ON DELETE CASCADE,
  "tuan_id" uuid REFERENCES "public"."nvq_tuan"("id") ON DELETE SET NULL,
  "ngay_bao_cao" date NOT NULL,
  "noi_dung" text CHECK (char_length("noi_dung") <= 6000),
  "vuong_mac" text CHECK (char_length("vuong_mac") <= 2000),
  "de_xuat" text CHECK (char_length("de_xuat") <= 2000),
  "nguon_thong_tin" text CHECK (char_length("nguon_thong_tin") <= 300),
  "khong_thay_doi" boolean NOT NULL DEFAULT false,
  "thay_doi" jsonb NOT NULL DEFAULT '[]',   -- tóm tắt thay đổi kết quả / số liệu trong lần cập nhật (Diễn biến)
  "tao_boi" uuid REFERENCES "public"."accounts"("id"),
  "tao_luc" timestamptz NOT NULL DEFAULT now(),
  "sua_luc" timestamptz
);
CREATE INDEX "nvq_cap_nhat_nv_idx" ON "public"."nvq_cap_nhat" ("nhiem_vu_id", "tao_luc");
CREATE INDEX "nvq_cap_nhat_tuan_idx" ON "public"."nvq_cap_nhat" ("tuan_id");
ALTER TABLE "public"."nvq_so_lieu" ADD COLUMN "cap_nhat_id" uuid REFERENCES "public"."nvq_cap_nhat"("id") ON DELETE SET NULL;

CREATE TABLE "public"."nvq_y_kien" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nhiem_vu_id" uuid NOT NULL REFERENCES "public"."nvq_nhiem_vu"("id") ON DELETE CASCADE,
  "loai" text NOT NULL CHECK ("loai" IN ('CHI_DAO', 'TRAO_DOI')),
  "noi_dung" text NOT NULL CHECK (char_length(btrim("noi_dung")) BETWEEN 1 AND 2000),
  "tra_loi_cho" uuid REFERENCES "public"."nvq_y_kien"("id") ON DELETE CASCADE,
  "han_tra_loi" date,
  "da_xong" boolean NOT NULL DEFAULT false,
  "xong_boi" uuid REFERENCES "public"."accounts"("id"),
  "xong_luc" timestamptz,
  "nguoi_gui" uuid NOT NULL REFERENCES "public"."accounts"("id"),
  "gui_luc" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "nvq_y_kien_nv_idx" ON "public"."nvq_y_kien" ("nhiem_vu_id");

CREATE TABLE "public"."nvq_tep" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nhiem_vu_id" uuid NOT NULL REFERENCES "public"."nvq_nhiem_vu"("id") ON DELETE CASCADE,
  "san_pham_id" uuid REFERENCES "public"."nvq_san_pham"("id") ON DELETE SET NULL,
  "duong_dan" text NOT NULL UNIQUE,
  "ten" text NOT NULL CHECK (char_length(btrim("ten")) BETWEEN 1 AND 255),
  "kich_thuoc" integer,
  "tai_boi" uuid REFERENCES "public"."accounts"("id"),
  "tai_luc" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "nvq_tep_nv_idx" ON "public"."nvq_tep" ("nhiem_vu_id");

CREATE TABLE "public"."nvq_lich_su" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "ky_id" uuid REFERENCES "public"."nvq_ky"("id") ON DELETE CASCADE,
  "nhiem_vu_id" uuid REFERENCES "public"."nvq_nhiem_vu"("id") ON DELETE CASCADE,
  "luc" timestamptz NOT NULL DEFAULT now(),
  "nguoi" uuid REFERENCES "public"."accounts"("id"),
  "hanh_dong" text NOT NULL,
  "noi_dung" text NOT NULL,
  "chi_tiet" jsonb
);
CREATE INDEX "nvq_lich_su_nv_idx" ON "public"."nvq_lich_su" ("nhiem_vu_id", "luc");
CREATE INDEX "nvq_lich_su_ky_idx" ON "public"."nvq_lich_su" ("ky_id", "luc");

CREATE TABLE "public"."nvq_tuan_anh" (
  "tuan_id" uuid NOT NULL REFERENCES "public"."nvq_tuan"("id") ON DELETE CASCADE,
  "nhiem_vu_id" uuid NOT NULL REFERENCES "public"."nvq_nhiem_vu"("id") ON DELETE CASCADE,
  "trang_thai" text NOT NULL,
  "muc" text,
  "so_san_pham" integer NOT NULL DEFAULT 0,
  "so_xong" integer NOT NULL DEFAULT 0,
  "co_cap_nhat" boolean NOT NULL DEFAULT false,
  "ket_qua" text,
  PRIMARY KEY ("tuan_id", "nhiem_vu_id")
);

-- ---- 5. Phân quyền đầu mối, nhắc (khoá chống gửi trùng), chuông dùng chung ----
CREATE TABLE "public"."nvq_phan_quyen" (
  "tai_khoan" uuid PRIMARY KEY REFERENCES "public"."accounts"("id") ON DELETE CASCADE,
  "vai_tro" text NOT NULL DEFAULT 'DAU_MOI' CHECK ("vai_tro" IN ('DAU_MOI')),
  "tao_boi" uuid REFERENCES "public"."accounts"("id"),
  "tao_luc" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "public"."nvq_nhac" ("khoa" text PRIMARY KEY, "luc" timestamptz NOT NULL DEFAULT now());
ALTER TABLE "public"."direct_messages" ADD COLUMN "nvq_nhiem_vu_id" uuid REFERENCES "public"."nvq_nhiem_vu"("id") ON DELETE CASCADE;
CREATE INDEX "direct_messages_nvq_idx" ON "public"."direct_messages" ("nvq_nhiem_vu_id") WHERE "nvq_nhiem_vu_id" IS NOT NULL;

-- ---- 6. RLS: chỉ đọc cho mọi cán bộ đang hoạt động; không policy ghi (ghi qua hàm) ----
CREATE FUNCTION "public"."nvq_xem"() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM "public"."accounts" a WHERE a."id" = "auth"."uid"() AND NOT coalesce(a."bi_khoa", false));
$$;
REVOKE ALL ON FUNCTION "public"."nvq_xem"() FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."nvq_xem"() TO "authenticated";

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['nvq_truc', 'nvq_lanh_dao', 'nvq_don_vi', 'nvq_ky', 'nvq_van_ban', 'nvq_tuan', 'nvq_lo_nhap', 'nvq_nhiem_vu', 'nvq_san_pham',
                           'nvq_so_lieu', 'nvq_cap_nhat', 'nvq_y_kien', 'nvq_tep', 'nvq_lich_su', 'nvq_tuan_anh', 'nvq_phan_quyen'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT public.nvq_xem()))', t || '_select', t);
  END LOOP;
END $$;
ALTER TABLE "public"."nvq_nhac" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."nvq_nhac" FROM "anon", "authenticated";
REVOKE ALL ON SEQUENCE "public"."nvq_nhiem_vu_ma_seq" FROM "anon", "authenticated";

-- ---- 7. Kho tệp riêng của phân hệ (policy ở 0134 — cần hàm quyền) ----
INSERT INTO "storage"."buckets" ("id", "name", "public", "file_size_limit", "allowed_mime_types")
VALUES ('nvq-tep', 'nvq-tep', false, 10485760, ARRAY['application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/jpeg', 'image/png'])
ON CONFLICT ("id") DO UPDATE SET "public" = false, "file_size_limit" = EXCLUDED."file_size_limit", "allowed_mime_types" = EXCLUDED."allowed_mime_types";
