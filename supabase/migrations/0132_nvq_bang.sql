-- 0132 (v3.35, chủ dự án 13/11/2026 — CAU-HOI nhóm U): phân hệ "Nhiệm vụ quý của Ban Thường vụ" — TÁCH RIÊNG hoàn toàn với phân hệ theo dõi nhiệm
-- vụ theo thông báo kết luận / văn bản giao việc (nhiem_vu, van_ban_giao_viec…): bảng, quyền, số liệu riêng, tiền tố nvq_. Không bảng nào của phân hệ
-- cũ bị đổi; chỉ thêm cột nvq_nhiem_vu_id vào direct_messages (chuông thông báo dùng chung).
-- Căn cứ: Kế hoạch 193-KH/TU ngày 08/10/2026 của Ban Thường vụ Tỉnh ủy (tổ chức thực hiện chỉ tiêu, nhiệm vụ chính trị quý IV/2026 — 6 trục kết quả
-- trọng tâm, 91 nhiệm vụ: 53 theo chương trình, kế hoạch công tác, 38 ngoài chương trình; Văn phòng theo dõi, đôn đốc, báo cáo hằng tuần — đơn vị
-- báo cáo trước 11h00 thứ Năm; báo cáo kết quả trước 20/12) và Phụ lục 2 kèm Công văn 888-CV/TU ngày 30/10/2026 (danh mục cập nhật, chủ trì theo dõi).
-- Mô hình: kỳ (quý) → nhiệm vụ (trục, nhóm, Stt; lãnh đạo phụ trách; đơn vị tham mưu, chủ trì; chủ trì theo dõi — cán bộ Văn phòng) → kết quả / sản
-- phẩm (văn bản · chỉ tiêu · hoạt động · định kỳ · khác — mỗi cái một mốc) → số liệu chỉ tiêu; cập nhật tiến độ (gắn tuần báo cáo); ý kiến chỉ đạo;
-- tệp; lịch sử; chốt tuần (ảnh chụp từng nhiệm vụ), chốt quý (đánh giá), chuyển quý sau.
-- Quyền: mọi ghi qua hàm SECURITY DEFINER (0135–0137); bảng chỉ có policy SELECT — mọi cán bộ đang hoạt động xem toàn bộ (chủ dự án 13/11/2026:
-- "Mọi cán bộ xem toàn bộ", như quyết định 27/10 của phân hệ cũ); thao tác theo phân công (0134).

-- ---- 1. Danh mục ----
CREATE TABLE "public"."nvq_truc" (
  "so" smallint PRIMARY KEY CHECK ("so" BETWEEN 1 AND 20),
  "ten" text NOT NULL CHECK (char_length(btrim("ten")) BETWEEN 1 AND 300),
  "ten_ngan" text NOT NULL CHECK (char_length(btrim("ten_ngan")) BETWEEN 1 AND 60),
  "dang_dung" boolean NOT NULL DEFAULT true
);
INSERT INTO "public"."nvq_truc" ("so", "ten", "ten_ngan") VALUES
  (1, 'Thực hiện mục tiêu phát triển kinh tế - xã hội và nhiệm vụ chính trị được giao', 'Kinh tế - xã hội'),
  (2, 'Hoàn thiện thể chế, đẩy mạnh phân cấp, phân quyền gắn với kiểm tra, giám sát', 'Thể chế, kiểm tra, giám sát'),
  (3, 'Thúc đẩy phát triển khoa học, công nghệ, đổi mới sáng tạo và chuyển đổi số', 'KHCN, ĐMST, chuyển đổi số'),
  (4, 'Xây dựng Đảng và hệ thống chính trị trong sạch, vững mạnh; giữ gìn đoàn kết, thống nhất nội bộ; phòng, chống tham nhũng, lãng phí, tiêu cực',
      'Xây dựng Đảng, hệ thống chính trị'),
  (5, 'Phát triển văn hóa, con người, bảo đảm an sinh xã hội, nâng cao đời sống Nhân dân', 'Văn hóa, an sinh xã hội'),
  (6, 'Củng cố quốc phòng, an ninh, giữ vững ổn định chính trị - xã hội, nâng cao hiệu quả đối ngoại và hội nhập quốc tế', 'Quốc phòng, an ninh, đối ngoại');

-- Lãnh đạo phụ trách: theo CHỨC DANH (không họ tên). thuong_truc: thuộc Thường trực Tỉnh ủy — mục "Thường trực Tỉnh ủy (tập thể)" tính cho từng đồng chí
-- có cờ này ở thống kê theo lãnh đạo. Đầu mối tổng hợp sửa được ở Quản lý danh mục (0135).
CREATE TABLE "public"."nvq_lanh_dao" (
  "ma" text PRIMARY KEY CHECK ("ma" ~ '^[A-Z0-9_]{2,30}$'),
  "ten" text NOT NULL CHECK (char_length(btrim("ten")) BETWEEN 1 AND 200),
  "thu_tu" smallint NOT NULL DEFAULT 0,
  "thuong_truc" boolean NOT NULL DEFAULT false,
  "tap_the" boolean NOT NULL DEFAULT false,
  "tu_khoa" text[] NOT NULL DEFAULT '{}',
  "dang_dung" boolean NOT NULL DEFAULT true
);
INSERT INTO "public"."nvq_lanh_dao" ("ma", "ten", "thu_tu", "thuong_truc", "tap_the", "tu_khoa") VALUES
  ('BI_THU', 'Bí thư Tỉnh ủy, Chủ tịch HĐND tỉnh', 1, true, false, ARRAY['bí thư tỉnh ủy', 'chủ tịch hđnd']),
  ('PBT_TT', 'Phó Bí thư Thường trực Tỉnh ủy', 2, true, false, ARRAY['phó bí thư thường trực']),
  ('PBT_UBND', 'Phó Bí thư Tỉnh ủy, Chủ tịch UBND tỉnh', 3, true, false, ARRAY['chủ tịch ubnd', 'chủ tịch uỷ ban nhân dân', 'chủ tịch ủy ban nhân dân']),
  ('PBT_MTTQ', 'Phó Bí thư Tỉnh ủy, Chủ tịch Ủy ban MTTQ Việt Nam tỉnh', 4, false, false, ARRAY['chủ tịch ủy ban mttq', 'chủ tịch ubmttq', 'chủ tịch ub mttq', 'chủ tịch mttq']),
  ('TT_TU', 'Các đồng chí Thường trực Tỉnh ủy', 5, false, true, ARRAY['thường trực tỉnh ủy']),
  ('UV_BTV', 'Ủy viên Ban Thường vụ Tỉnh ủy', 6, false, false, ARRAY['ủy viên ban thường vụ', 'ủy viên btv']);

-- Đơn vị tham mưu, chủ trì (cơ quan ngoài Văn phòng — Owner theo CV 1400, CĐ-3). tu_khoa: chữ thường đã chuẩn hoá "ủy" — dùng khi nhập danh mục.
CREATE TABLE "public"."nvq_don_vi" (
  "ma" text PRIMARY KEY CHECK ("ma" ~ '^[A-Z0-9_]{2,30}$'),
  "ten" text NOT NULL CHECK (char_length(btrim("ten")) BETWEEN 1 AND 200),
  "thu_tu" smallint NOT NULL DEFAULT 0,
  "tu_khoa" text[] NOT NULL DEFAULT '{}',
  "dang_dung" boolean NOT NULL DEFAULT true
);
INSERT INTO "public"."nvq_don_vi" ("ma", "ten", "thu_tu", "tu_khoa") VALUES
  ('DU_UBND', 'Đảng ủy UBND tỉnh', 1, ARRAY['đảng ủy ubnd', 'đảng ủy ủy ban nhân dân']),
  ('DU_HDND', 'Đảng ủy HĐND tỉnh', 2, ARRAY['đảng ủy hđnd', 'đảng ủy hội đồng nhân dân']),
  ('UBKT', 'Ủy ban Kiểm tra Tỉnh ủy', 3, ARRAY['ủy ban kiểm tra', 'ubkt']),
  ('BTC', 'Ban Tổ chức Tỉnh ủy', 4, ARRAY['ban tổ chức']),
  ('BTG', 'Ban Tuyên giáo Tỉnh ủy', 5, ARRAY['ban tuyên giáo']),
  ('BNC', 'Ban Nội chính Tỉnh ủy', 6, ARRAY['ban nội chính']),
  ('VPTU', 'Văn phòng Tỉnh ủy', 7, ARRAY['văn phòng tỉnh ủy']),
  ('DU_MTTQ', 'Đảng ủy MTTQ, các đoàn thể tỉnh', 8, ARRAY['đảng ủy mttq', 'đảng ủy mặt trận']),
  ('DU_CA', 'Đảng ủy Công an tỉnh', 9, ARRAY['đảng ủy công an']),
  ('DU_QS', 'Đảng ủy Quân sự tỉnh', 10, ARRAY['đảng ủy quân sự']),
  ('BAO_PTTH', 'Báo và Phát thanh, truyền hình Cao Bằng', 11, ARRAY['báo và ptth', 'báo và phát thanh']);

-- ---- 2. Kỳ (quý), văn bản căn cứ, tuần báo cáo ----
CREATE TABLE "public"."nvq_ky" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nam" smallint NOT NULL CHECK ("nam" BETWEEN 2025 AND 2100),
  "quy" smallint NOT NULL CHECK ("quy" BETWEEN 1 AND 4),
  "tu_ngay" date NOT NULL,
  "den_ngay" date NOT NULL,
  "trang_thai" text NOT NULL DEFAULT 'THUC_HIEN' CHECK ("trang_thai" IN ('THUC_HIEN', 'DA_CHOT')),
  "han_bao_cao_ket_qua" date,
  "ghi_chu" text CHECK (char_length("ghi_chu") <= 1000),
  "tao_boi" uuid REFERENCES "public"."accounts"("id"),
  "tao_luc" timestamptz NOT NULL DEFAULT now(),
  "chot_boi" uuid REFERENCES "public"."accounts"("id"),
  "chot_luc" timestamptz,
  "chot_nhan_xet" text CHECK (char_length("chot_nhan_xet") <= 4000),
  UNIQUE ("nam", "quy"),
  CHECK ("den_ngay" > "tu_ngay")
);
CREATE TABLE "public"."nvq_van_ban" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ky_id" uuid NOT NULL REFERENCES "public"."nvq_ky"("id") ON DELETE CASCADE,
  "loai" text NOT NULL DEFAULT 'KE_HOACH' CHECK ("loai" IN ('KE_HOACH', 'DIEU_CHINH', 'KHAC')),
  "so_ky_hieu" text NOT NULL CHECK (char_length(btrim("so_ky_hieu")) BETWEEN 1 AND 100),
  "ngay" date,
  "trich_yeu" text CHECK (char_length("trich_yeu") <= 1000),
  "tao_boi" uuid REFERENCES "public"."accounts"("id"),
  "tao_luc" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "nvq_van_ban_ky_idx" ON "public"."nvq_van_ban" ("ky_id");
-- Tuần báo cáo: kết thúc vào thứ Năm (hạn 11h00 — han_luc); tuần 1 từ ngày đầu quý tới thứ Năm đầu tiên cách ít nhất 6 ngày; tuần cuối có thể quá
-- ngày cuối quý (cập nhật bổ sung sau khi kết thúc quý). Tạo khi tạo kỳ (nvq_tao_tuan, 0134).
CREATE TABLE "public"."nvq_tuan" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ky_id" uuid NOT NULL REFERENCES "public"."nvq_ky"("id") ON DELETE CASCADE,
  "so" smallint NOT NULL CHECK ("so" BETWEEN 1 AND 30),
  "tu_ngay" date NOT NULL,
  "den_ngay" date NOT NULL,
  "han_luc" timestamptz NOT NULL,
  "trang_thai" text NOT NULL DEFAULT 'MO' CHECK ("trang_thai" IN ('MO', 'DA_CHOT')),
  "chot_boi" uuid REFERENCES "public"."accounts"("id"),
  "chot_luc" timestamptz,
  "so_lieu" jsonb,
  "nhan_xet" text CHECK (char_length("nhan_xet") <= 4000),
  UNIQUE ("ky_id", "so"),
  CHECK ("den_ngay" >= "tu_ngay")
);

-- ---- 3. Nhiệm vụ, kết quả / sản phẩm, số liệu ----
CREATE TABLE "public"."nvq_lo_nhap" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ky_id" uuid NOT NULL REFERENCES "public"."nvq_ky"("id") ON DELETE CASCADE,
  "ten_tep" text CHECK (char_length("ten_tep") <= 300),
  "so_moi" integer NOT NULL DEFAULT 0,
  "so_sua" integer NOT NULL DEFAULT 0,
  "nhap_boi" uuid REFERENCES "public"."accounts"("id"),
  "nhap_luc" timestamptz NOT NULL DEFAULT now(),
  "hoan_tac_luc" timestamptz
);
CREATE SEQUENCE "public"."nvq_nhiem_vu_ma_seq" START 1001;
CREATE TABLE "public"."nvq_nhiem_vu" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ma" text NOT NULL UNIQUE DEFAULT ('NQ-' || nextval('public.nvq_nhiem_vu_ma_seq')),
  "ky_id" uuid NOT NULL REFERENCES "public"."nvq_ky"("id") ON DELETE CASCADE,
  "truc_so" smallint NOT NULL REFERENCES "public"."nvq_truc"("so"),
  "nhom" text NOT NULL CHECK ("nhom" IN ('TRONG_CT', 'NGOAI_CT')),   -- theo / ngoài chương trình, kế hoạch công tác
  "stt" smallint NOT NULL CHECK ("stt" BETWEEN 1 AND 999),
  "noi_dung" text NOT NULL CHECK (char_length(btrim("noi_dung")) BETWEEN 1 AND 4000),
  "lanh_dao_text" text CHECK (char_length("lanh_dao_text") <= 1000),
  "lanh_dao_ma" text[] NOT NULL DEFAULT '{}',
  "don_vi_text" text CHECK (char_length("don_vi_text") <= 1000),
  "don_vi" jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof("don_vi") = 'array'),   -- [{ma, vai_tro: CHU_TRI|PHOI_HOP|THAM_DINH|THAM_TRA, cu_the}]
  "ket_qua_can_dat" text CHECK (char_length("ket_qua_can_dat") <= 4000),
  "tien_do_text" text CHECK (char_length("tien_do_text") <= 300),
  "tinh_chat" text NOT NULL DEFAULT 'CO_MOC' CHECK ("tinh_chat" IN ('CO_MOC', 'DINH_KY', 'THUONG_XUYEN', 'KHI_PHAT_SINH', 'CHO_DIEU_KIEN')),
  "chu_tri_theo_doi" uuid REFERENCES "public"."accounts"("id"),
  "phong_theo_doi" text CHECK (char_length("phong_theo_doi") <= 40),   -- giao cho phòng (ví dụ Phòng CĐS-CY): cán bộ của phòng cùng cập nhật
  "phoi_hop_theo_doi" uuid[] NOT NULL DEFAULT '{}',
  "ket_qua_thuc_hien" text CHECK (char_length("ket_qua_thuc_hien") <= 6000),   -- kết quả lũy kế mới nhất (cột "Kết quả thực hiện" của báo cáo)
  "ket_qua_luc" timestamptz,
  "ket_qua_boi" uuid REFERENCES "public"."accounts"("id"),
  "vuong_mac" text CHECK (char_length("vuong_mac") <= 2000),
  "de_xuat" text CHECK (char_length("de_xuat") <= 2000),
  "dieu_chinh" text NOT NULL DEFAULT 'TRONG_DANH_MUC' CHECK ("dieu_chinh" IN ('TRONG_DANH_MUC', 'RUT')),
  "dieu_chinh_van_ban" uuid REFERENCES "public"."nvq_van_ban"("id") ON DELETE SET NULL,
  "dieu_chinh_ly_do" text CHECK (char_length("dieu_chinh_ly_do") <= 1000),
  "danh_gia_de_xuat" text CHECK ("danh_gia_de_xuat" IN ('HOAN_THANH', 'HOAN_THANH_CHAM', 'CHUA_HOAN_THANH', 'KHONG_DANH_GIA')),
  "danh_gia" text CHECK ("danh_gia" IN ('HOAN_THANH', 'HOAN_THANH_CHAM', 'CHUA_HOAN_THANH', 'KHONG_DANH_GIA')),
  "danh_gia_ly_do" text CHECK (char_length("danh_gia_ly_do") <= 2000),
  "danh_gia_boi" uuid REFERENCES "public"."accounts"("id"),
  "danh_gia_luc" timestamptz,
  "danh_gia_tu_dong" boolean NOT NULL DEFAULT false,   -- mức do chốt quý tự điền (chưa ai chốt) — mở lại quý thì bỏ để đánh giá lại
  "chuyen_ky_sau" boolean NOT NULL DEFAULT false,
  "tu_nhiem_vu_id" uuid REFERENCES "public"."nvq_nhiem_vu"("id") ON DELETE SET NULL,
  "nguon" text NOT NULL DEFAULT 'THEM' CHECK ("nguon" IN ('THEM', 'NHAP', 'CHUYEN_KY')),
  "lo_nhap_id" uuid REFERENCES "public"."nvq_lo_nhap"("id") ON DELETE SET NULL,
  "du_lieu_goc" jsonb,
  "tao_boi" uuid REFERENCES "public"."accounts"("id"),
  "tao_luc" timestamptz NOT NULL DEFAULT now(),
  "sua_luc" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "nvq_nhiem_vu_vi_tri_key" UNIQUE ("ky_id", "truc_so", "nhom", "stt") DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX "nvq_nhiem_vu_chu_tri_idx" ON "public"."nvq_nhiem_vu" ("chu_tri_theo_doi");
CREATE INDEX "nvq_nhiem_vu_tu_idx" ON "public"."nvq_nhiem_vu" ("tu_nhiem_vu_id");

CREATE TABLE "public"."nvq_san_pham" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nhiem_vu_id" uuid NOT NULL REFERENCES "public"."nvq_nhiem_vu"("id") ON DELETE CASCADE,
  "thu_tu" smallint NOT NULL DEFAULT 1,
  "mo_ta" text NOT NULL CHECK (char_length(btrim("mo_ta")) BETWEEN 1 AND 2000),
  "loai" text NOT NULL DEFAULT 'VAN_BAN' CHECK ("loai" IN ('VAN_BAN', 'CHI_TIEU', 'HOAT_DONG', 'DINH_KY', 'KHAC')),
  "han" date,
  "han_text" text CHECK (char_length("han_text") <= 100),
  "chi_tieu_co_ban" text CHECK ("chi_tieu_co_ban" IN ('GRDP', 'THU_NSNN', 'GIAI_NGAN', 'THU_NHAP', 'GIAM_NGHEO')),
  "don_vi_tinh" text CHECK (char_length("don_vi_tinh") <= 40),
  "muc_tieu" numeric,
  "chieu" text NOT NULL DEFAULT 'CAO_HON_TOT' CHECK ("chieu" IN ('CAO_HON_TOT', 'THAP_HON_TOT')),
  "thuc_hien" numeric,
  "thuc_hien_ngay" date,
  "thuc_hien_nguon" text CHECK (char_length("thuc_hien_nguon") <= 300),
  "trang_thai" text NOT NULL DEFAULT 'CHUA' CHECK ("trang_thai" IN ('CHUA', 'DANG', 'DA_TRINH', 'HOAN_THANH', 'KHONG_PHAT_SINH', 'KHONG_THUC_HIEN')),
  "ngay_hoan_thanh" date,
  "kq_so_ky_hieu" text CHECK (char_length("kq_so_ky_hieu") <= 100),   -- văn bản kết quả: số, ngày, cơ quan ban hành, trích yếu
  "kq_ngay" date,
  "kq_co_quan" text CHECK (char_length("kq_co_quan") <= 200),
  "kq_trich_yeu" text CHECK (char_length("kq_trich_yeu") <= 1000),
  "kq_mo_ta" text CHECK (char_length("kq_mo_ta") <= 2000),
  "sua_boi" uuid REFERENCES "public"."accounts"("id"),
  "sua_luc" timestamptz NOT NULL DEFAULT now(),
  CHECK ("trang_thai" <> 'HOAN_THANH' OR "ngay_hoan_thanh" IS NOT NULL),
  CHECK ("loai" <> 'CHI_TIEU' OR "chi_tieu_co_ban" IS NULL OR "muc_tieu" IS NOT NULL)
);
CREATE INDEX "nvq_san_pham_nv_idx" ON "public"."nvq_san_pham" ("nhiem_vu_id");
CREATE TABLE "public"."nvq_so_lieu" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "san_pham_id" uuid NOT NULL REFERENCES "public"."nvq_san_pham"("id") ON DELETE CASCADE,
  "gia_tri" numeric NOT NULL,
  "ngay_so_lieu" date NOT NULL,
  "uoc_tinh" boolean NOT NULL DEFAULT false,
  "nguon" text CHECK (char_length("nguon") <= 300),
  "nhap_boi" uuid REFERENCES "public"."accounts"("id"),
  "nhap_luc" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "nvq_so_lieu_sp_idx" ON "public"."nvq_so_lieu" ("san_pham_id", "ngay_so_lieu");
