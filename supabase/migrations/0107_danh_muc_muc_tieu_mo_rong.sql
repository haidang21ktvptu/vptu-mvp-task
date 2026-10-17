-- 0107 (v3.25, chủ dự án duyệt 17/10/2026 — tự điền mục tiêu then chốt, danh mục mở rộng, trợ lý AI): cấu trúc dữ liệu.
-- 1. dm_nhom_muc_tieu: nhóm mục tiêu thành danh mục (0105 là CHECK cố định 4 nhóm) — thêm nhóm "Nghị quyết, chương trình của Tỉnh ủy" (NQ_TU).
--    mau_so_hieu: dạng số hiệu của nhóm (biểu thức chính quy trên số hiệu dạng chuẩn) — nhận diện số hiệu chưa có trong danh mục để tự thêm (0108).
-- 2. dm_muc_tieu: so_hieu (dạng chuẩn '57-NQ/TW'; duy nhất theo khoá so khớp — 0108), trang_thai MOI | DA_DOI_CHIEU (đã đối chiếu văn bản gốc =
--    khoá nội dung), nguon_them KHOI_TAO | NGUOI_DUNG | TU_DONG, người / lúc thêm, lúc sửa, gop_vao (mục trùng đã gộp vào mục khác), hoc_ai_luc.
-- 3. Khối lĩnh vực: dm_khoi_linh_vuc.dang_dung; dm_linh_vuc.khoi_ma — khối riêng của lĩnh vực (NULL = theo khối của ngành, như 0105).
-- 4. Nguồn gắn: nhiem_vu_muc_tieu / van_ban_muc_tieu thêm nguon (CHON người chọn | QUY_TAC tích sẵn theo quy tắc, người giao giữ | GOI_Y gợi ý được bấm
--    thêm | AI gợi ý của trợ lý AI được bấm thêm | EXCEL | RA_SOAT chấp nhận ở màn rà soát | GOP gộp mục trùng) và ly_do (căn cứ ngắn hiển thị).
-- 5. quy_tac_muc_tieu: quy tắc nhận diện — SO_HIEU (số hiệu văn bản), TU_KHOA (cụm từ, so khớp không dấu theo kl_chuan_chu), LINH_VUC, NGANH (mã),
--    LOAI_TRU (cụm từ có mặt thì bỏ khớp từ khoá của mục tiêu đó); mức TU_TICH (tích sẵn) | GOI_Y (bấm để thêm); trạng thái DE_XUAT (chờ tự kiểm) | BAT |
--    TAT; khoa = quản trị giữ cố định (không tự nâng / hạ); nguồn KHOI_TAO | QUAN_TRI | AI | TU_DONG; bộ đếm hiện / nhận / bỏ (tự học — 0111).
--    phan_hoi_goi_y: kết quả của từng lần hiện (một việc × một quy tắc một dòng, ghi lại thì thay). Đọc quy tắc: mọi tài khoản đăng nhập (là danh mục,
--    giải thích được vì sao có gợi ý); phản hồi không ai đọc thẳng; ghi chỉ qua hàm.
-- 6. dm_lich_su: thêm hành động khoa, mo_khoa, ngung, dung_lai, gop, khoi_phuc, tu_dong, doi_muc, bat, tat.
-- 7. kl_chuan_chu: chữ thường, bỏ dấu tiếng Việt bằng bảng chuyển đổi (không cần extension, đúng cả khi CSDL dùng locale C), chỉ giữ chữ, số và một
--    khoảng trắng giữa các từ — so khớp từ khoá không phân biệt dấu, hoa thường, dấu câu, xuống dòng. IMMUTABLE (dùng cho cột sinh).

-- ---- 7 (trước 5: cột sinh dùng hàm) ----
CREATE FUNCTION "public"."kl_chuan_chu"("p" text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT btrim(regexp_replace(lower(translate(normalize(coalesce("p", ''), NFC),
    'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ',
    'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyydAAAAAAAAAAAAAAAAAEEEEEEEEEEEIIIIIOOOOOOOOOOOOOOOOOUUUUUUUUUUUYYYYYD')),
    '[^a-z0-9]+', ' ', 'g'));
$$;
GRANT EXECUTE ON FUNCTION "public"."kl_chuan_chu"(text) TO "authenticated";

-- ---- 1 ----
CREATE TABLE "public"."dm_nhom_muc_tieu" (
  "ma" text PRIMARY KEY CONSTRAINT "dm_nhom_muc_tieu_ma_check" CHECK ("ma" ~ '^[A-Z0-9_]{2,30}$'),
  "ten" text NOT NULL CONSTRAINT "dm_nhom_muc_tieu_ten_check" CHECK (btrim("ten") <> '' AND char_length("ten") <= 120),
  "tab" text NOT NULL CONSTRAINT "dm_nhom_muc_tieu_tab_check" CHECK (btrim("tab") <> '' AND char_length("tab") <= 40),
  "mau_so_hieu" text CONSTRAINT "dm_nhom_muc_tieu_mau_check" CHECK (char_length("mau_so_hieu") <= 200),
  "thu_tu" integer NOT NULL,
  "dang_dung" boolean NOT NULL DEFAULT true
);
COMMENT ON TABLE "public"."dm_nhom_muc_tieu" IS '0107: nhóm mục tiêu then chốt (danh mục); mau_so_hieu = dạng số hiệu dùng để nhận diện, tự thêm mục tiêu.';
INSERT INTO "public"."dm_nhom_muc_tieu" ("ma", "ten", "tab", "mau_so_hieu", "thu_tu") VALUES
  ('DOT_PHA', 'Nội dung đột phá', 'Nội dung đột phá', NULL, 1),
  ('CHUONG_TRINH', 'Chương trình trọng tâm', 'Chương trình trọng tâm', NULL, 2),
  ('NQ_TW', 'Nghị quyết của Trung ương', 'Nghị quyết Trung ương', '^[0-9]{1,5}-NQ/TW$', 3),
  ('NQ_TU', 'Nghị quyết, chương trình của Tỉnh ủy', 'Nghị quyết Tỉnh ủy', '^[0-9]{1,5}-(NQ|CTr)/TU$', 4),
  ('CHI_TIEU', 'Chỉ tiêu chủ yếu', 'Chỉ tiêu chủ yếu', NULL, 5);
ALTER TABLE "public"."dm_nhom_muc_tieu" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."dm_nhom_muc_tieu" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."dm_nhom_muc_tieu" TO "authenticated";
CREATE POLICY "dm_nhom_muc_tieu_select" ON "public"."dm_nhom_muc_tieu" FOR SELECT TO "authenticated" USING ((SELECT "auth"."uid"()) IS NOT NULL);

-- ---- 2 ----
ALTER TABLE "public"."dm_muc_tieu" DROP CONSTRAINT "dm_muc_tieu_nhom_check";
ALTER TABLE "public"."dm_muc_tieu" ADD CONSTRAINT "dm_muc_tieu_nhom_fkey" FOREIGN KEY ("nhom") REFERENCES "public"."dm_nhom_muc_tieu"("ma") ON UPDATE CASCADE;
ALTER TABLE "public"."dm_muc_tieu"
  ADD COLUMN "so_hieu" text CONSTRAINT "dm_muc_tieu_so_hieu_check" CHECK ("so_hieu" ~ '^[0-9]{1,5}-[A-Za-zĐđ]{1,5}/[A-Z]{1,8}$'),
  ADD COLUMN "trang_thai" text NOT NULL DEFAULT 'MOI' CONSTRAINT "dm_muc_tieu_trang_thai_check" CHECK ("trang_thai" IN ('MOI', 'DA_DOI_CHIEU')),
  ADD COLUMN "nguon_them" text NOT NULL DEFAULT 'KHOI_TAO' CONSTRAINT "dm_muc_tieu_nguon_them_check" CHECK ("nguon_them" IN ('KHOI_TAO', 'NGUOI_DUNG', 'TU_DONG')),
  ADD COLUMN "tao_boi" uuid REFERENCES "public"."accounts"("id") ON DELETE SET NULL,
  ADD COLUMN "tao_luc" timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN "cap_nhat_luc" timestamp with time zone,
  ADD COLUMN "gop_vao" text REFERENCES "public"."dm_muc_tieu"("ma"),
  ADD COLUMN "hoc_ai_luc" timestamp with time zone;
UPDATE "public"."dm_muc_tieu" SET "so_hieu" = substr("ma", 4) || '-NQ/TW' WHERE "nhom" = 'NQ_TW' AND "ma" ~ '^NQ_[0-9]+$';
COMMENT ON COLUMN "public"."dm_muc_tieu"."trang_thai" IS '0107: DA_DOI_CHIEU = đã đối chiếu văn bản gốc — khoá nội dung, quản trị hệ thống mở khoá mới sửa được.';

-- ---- 3 ----
ALTER TABLE "public"."dm_khoi_linh_vuc" ADD COLUMN "dang_dung" boolean NOT NULL DEFAULT true,
  ADD CONSTRAINT "dm_khoi_linh_vuc_ma_check" CHECK ("ma" ~ '^[A-Z0-9_]{2,40}$');
ALTER TABLE "public"."dm_linh_vuc" ADD COLUMN "khoi_ma" text REFERENCES "public"."dm_khoi_linh_vuc"("ma");
COMMENT ON COLUMN "public"."dm_linh_vuc"."khoi_ma" IS '0107: khối riêng của lĩnh vực trên Tổng quan; NULL = theo khối của ngành.';

-- ---- 4 ----
ALTER TABLE "public"."nhiem_vu_muc_tieu"
  ADD COLUMN "nguon" text NOT NULL DEFAULT 'CHON' CONSTRAINT "nhiem_vu_muc_tieu_nguon_check" CHECK ("nguon" IN ('CHON', 'QUY_TAC', 'GOI_Y', 'AI', 'EXCEL', 'RA_SOAT', 'GOP')),
  ADD COLUMN "ly_do" text CONSTRAINT "nhiem_vu_muc_tieu_ly_do_check" CHECK (char_length("ly_do") <= 300);
ALTER TABLE "public"."van_ban_muc_tieu"
  ADD COLUMN "nguon" text NOT NULL DEFAULT 'CHON' CONSTRAINT "van_ban_muc_tieu_nguon_check" CHECK ("nguon" IN ('CHON', 'QUY_TAC', 'GOI_Y', 'AI', 'EXCEL', 'RA_SOAT', 'GOP')),
  ADD COLUMN "ly_do" text CONSTRAINT "van_ban_muc_tieu_ly_do_check" CHECK (char_length("ly_do") <= 300);
UPDATE "public"."nhiem_vu_muc_tieu" m SET "nguon" = 'EXCEL'
WHERE EXISTS (SELECT 1 FROM "public"."lich_su" l WHERE l."nhiem_vu_id" = m."nhiem_vu_id" AND l."cot" = 'gan_muc_tieu' AND l."nguon" = 'excel');

-- ---- 5 ----
CREATE TABLE "public"."quy_tac_muc_tieu" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "muc_tieu_ma" text NOT NULL REFERENCES "public"."dm_muc_tieu"("ma") ON DELETE CASCADE,
  "loai" text NOT NULL CONSTRAINT "quy_tac_muc_tieu_loai_check" CHECK ("loai" IN ('SO_HIEU', 'TU_KHOA', 'LINH_VUC', 'NGANH', 'LOAI_TRU')),
  "gia_tri" text NOT NULL CONSTRAINT "quy_tac_muc_tieu_gia_tri_check" CHECK (btrim("gia_tri") <> '' AND char_length("gia_tri") <= 120),
  "gia_tri_chuan" text GENERATED ALWAYS AS (CASE WHEN "loai" IN ('TU_KHOA', 'LOAI_TRU') THEN "public"."kl_chuan_chu"("gia_tri") ELSE "gia_tri" END) STORED,
  "muc" text NOT NULL DEFAULT 'GOI_Y' CONSTRAINT "quy_tac_muc_tieu_muc_check" CHECK ("muc" IN ('TU_TICH', 'GOI_Y')),
  "trang_thai" text NOT NULL DEFAULT 'BAT' CONSTRAINT "quy_tac_muc_tieu_trang_thai_check" CHECK ("trang_thai" IN ('DE_XUAT', 'BAT', 'TAT')),
  "khoa" boolean NOT NULL DEFAULT false,
  "nguon" text NOT NULL DEFAULT 'KHOI_TAO' CONSTRAINT "quy_tac_muc_tieu_nguon_check" CHECK ("nguon" IN ('KHOI_TAO', 'QUAN_TRI', 'AI', 'TU_DONG')),
  "so_lan_hien" integer NOT NULL DEFAULT 0,
  "so_lan_nhan" integer NOT NULL DEFAULT 0,
  "so_lan_bo" integer NOT NULL DEFAULT 0,
  "dem_tu" timestamp with time zone NOT NULL DEFAULT now(),   -- mốc bắt đầu bộ đếm (đặt lại khi đổi mức / trạng thái — phản hồi cũ hơn không tính lại)
  "ghi_chu" text CONSTRAINT "quy_tac_muc_tieu_ghi_chu_check" CHECK (char_length("ghi_chu") <= 300),
  "tao_luc" timestamp with time zone NOT NULL DEFAULT now(),
  "cap_nhat_luc" timestamp with time zone,
  CONSTRAINT "quy_tac_muc_tieu_gia_tri_chuan_check" CHECK (btrim("gia_tri_chuan") <> ''),
  CONSTRAINT "quy_tac_muc_tieu_key" UNIQUE ("muc_tieu_ma", "loai", "gia_tri_chuan")
);
CREATE INDEX "quy_tac_muc_tieu_loai_idx" ON "public"."quy_tac_muc_tieu" ("loai", "trang_thai");
COMMENT ON TABLE "public"."quy_tac_muc_tieu" IS '0107: quy tắc nhận diện mục tiêu then chốt (gợi ý khi giao việc, nhập Excel, rà soát); ghi qua hàm.';
CREATE TABLE "public"."phan_hoi_goi_y" (
  "nhiem_vu_id" uuid NOT NULL REFERENCES "public"."nhiem_vu"("id") ON DELETE CASCADE,
  "quy_tac_id" uuid NOT NULL REFERENCES "public"."quy_tac_muc_tieu"("id") ON DELETE CASCADE,
  "ket_qua" text NOT NULL CONSTRAINT "phan_hoi_goi_y_ket_qua_check" CHECK ("ket_qua" IN ('GIU', 'BO', 'THEM', 'BO_QUA')),
  "nguoi" uuid REFERENCES "public"."accounts"("id") ON DELETE SET NULL,
  "luc" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("nhiem_vu_id", "quy_tac_id")
);
CREATE INDEX "phan_hoi_goi_y_quy_tac_idx" ON "public"."phan_hoi_goi_y" ("quy_tac_id");
ALTER TABLE "public"."quy_tac_muc_tieu" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."phan_hoi_goi_y" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."quy_tac_muc_tieu", "public"."phan_hoi_goi_y" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."quy_tac_muc_tieu" TO "authenticated";
CREATE POLICY "quy_tac_muc_tieu_select" ON "public"."quy_tac_muc_tieu" FOR SELECT TO "authenticated" USING ((SELECT "auth"."uid"()) IS NOT NULL);

-- ---- 6 ----
ALTER TABLE "public"."dm_lich_su" DROP CONSTRAINT "dm_lich_su_hanh_dong_check";
ALTER TABLE "public"."dm_lich_su" ADD CONSTRAINT "dm_lich_su_hanh_dong_check"
  CHECK ("hanh_dong" IN ('them', 'sua', 'khoa', 'mo_khoa', 'ngung', 'dung_lai', 'gop', 'khoi_phuc', 'tu_dong', 'doi_muc', 'bat', 'tat'));
