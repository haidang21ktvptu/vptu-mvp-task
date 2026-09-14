-- GĐ8 (PR 8A-2, 1/3) — Bảng module Theo dõi Kết luận BTVTU (docs/thiet-ke-theo-doi-kl-btvtu.md
-- Phần 2.3 ràng buộc, Phần 6.2 ba mốc thời gian, Phần 6.4 đính chính). Hàm/trigger ở 0015, RLS ở 0016.
-- Không đụng bảng tasks. Tên bảng/cột theo tài liệu thiết kế (tiếng Việt không dấu).

-- 1. Danh mục. Cột ten giữ NGUYÊN VĂN chuỗi trong sheet DanhMuc (script nhập 8B đối chiếu từng ký tự);
--    ma do dự án đặt; thu_tu = số thứ tự đầu chuỗi.
CREATE TABLE "public"."dm_nganh" ("ma" text PRIMARY KEY, "ten" text NOT NULL UNIQUE, "thu_tu" integer NOT NULL);
INSERT INTO "public"."dm_nganh" ("ma", "ten", "thu_tu") VALUES
  ('THAM_MUU_TONG_HOP', '1. Tham mưu tổng hợp (sự kiện/vấn đề lớn, quan trọng của tỉnh)', 1),
  ('TUYEN_GIAO', '2. Công tác tuyên giáo - Trường Chính trị', 2),
  ('NOI_CHINH', '3. Nội chính - ANQP - Tư pháp', 3),
  ('TO_CHUC_XAY_DUNG_DANG', '4. Tổ chức, xây dựng Đảng - Kiểm tra Đảng - Xây dựng chính quyền', 4),
  ('CONG_NGHIEP_NANG_LUONG', '5. Công nghiệp - Năng lượng - Khu/cụm CN - Khu kinh tế - Đối ngoại Đảng', 5),
  ('NONG_NGHIEP_MOI_TRUONG', '6. Nông nghiệp - Tài nguyên - Môi trường - PCTT', 6),
  ('MTTQ_DOAN_THE', '7. MTTQ và các tổ chức chính trị xã hội', 7),
  ('KINH_TE_TONG_HOP', '8. Kinh tế tổng hợp - Tài chính - Đầu tư - Ngân sách', 8),
  ('XAY_DUNG_GIAO_THONG', '9. Xây dựng - Giao thông - Dự án giao thông trọng điểm', 9),
  ('VAN_HOA_XA_HOI', '10. Văn hóa - Xã hội - KHCN - Chuyển đổi số', 10),
  ('HOI_DONG_NHAN_DAN', '11. Công tác Hội đồng nhân dân', 11),
  ('VAN_PHONG_TINH_UY', '12. Văn phòng Tỉnh ủy', 12);

CREATE TABLE "public"."dm_co_quan_trinh" ("ma" text PRIMARY KEY, "ten" text NOT NULL UNIQUE, "thu_tu" integer NOT NULL);
INSERT INTO "public"."dm_co_quan_trinh" ("ma", "ten", "thu_tu") VALUES
  ('VAN_PHONG_TINH_UY', '1. Văn phòng Tỉnh ủy', 1),
  ('BAN_TO_CHUC', '2. Ban Tổ chức Tỉnh ủy', 2),
  ('UY_BAN_KIEM_TRA', '3. Ủy ban Kiểm tra Tỉnh ủy', 3),
  ('BAN_NOI_CHINH', '4. Ban Nội chính Tỉnh ủy', 4),
  ('BAN_TUYEN_GIAO', '5. Ban Tuyên giáo Tỉnh ủy', 5),
  ('DANG_UY_UBND', '6. Đảng ủy Ủy ban nhân dân tỉnh', 6),
  ('DANG_UY_HDND', '7. Đảng ủy Hội đồng nhân dân tỉnh', 7),
  ('DANG_UY_MTTQ', '8. Đảng ủy Mặt trận Tổ quốc Việt Nam tỉnh', 8),
  ('DANG_UY_CONG_AN', '9. Đảng ủy Công an tỉnh', 9),
  ('DANG_UY_QUAN_SU', '10. Đảng ủy Quân sự tỉnh', 10),
  ('TO_CONG_TAC_BCD', '11. Các tổ công tác/Ban chỉ đạo', 11),
  ('BAN_THUONG_VU', '12. Ban Thường vụ Tỉnh ủy', 12),
  ('CO_QUAN_KHAC', '13. Các cơ quan, đơn vị khác', 13);

-- Bốn loại thời hạn và hai tiến độ dùng thật (bỏ "Chưa hoàn thành (quá hạn)" vì là số dẫn xuất — Phần 1.2).
CREATE TABLE "public"."dm_loai_thoi_han" ("ma" text PRIMARY KEY, "ten" text NOT NULL UNIQUE, "thu_tu" integer NOT NULL);
INSERT INTO "public"."dm_loai_thoi_han" ("ma", "ten", "thu_tu") VALUES
  ('CO_HAN_CU_THE', 'Có hạn cụ thể', 1),
  ('KY_BAN_HANH', 'Ký ban hành (10 ngày)', 2),
  ('THUONG_XUYEN', 'Nhiệm vụ thường xuyên', 3),
  ('CHO_QUYET_DINH', 'Chờ quyết định/điều kiện khác', 4);

CREATE TABLE "public"."dm_tien_do" ("ma" text PRIMARY KEY, "ten" text NOT NULL UNIQUE, "thu_tu" integer NOT NULL);
INSERT INTO "public"."dm_tien_do" ("ma", "ten", "thu_tu") VALUES
  ('DANG_THUC_HIEN', 'Đang thực hiện', 1),
  ('HOAN_THANH', 'Hoàn thành', 2);

-- 2. Tham số (quyết định 2: ngưỡng sắp đến hạn 7 ngày; hạn phản hồi chỉ đạo 2 ngày). Không hard-code.
CREATE TABLE "public"."kl_cau_hinh" ("khoa" text PRIMARY KEY, "gia_tri" text NOT NULL, "mo_ta" text);
INSERT INTO "public"."kl_cau_hinh" ("khoa", "gia_tri", "mo_ta") VALUES
  ('nguong_sap_den_han_ngay', '7', 'Còn ≤ N ngày tới hạn thì xếp "Sắp đến hạn"'),
  ('han_phan_hoi_mac_dinh_ngay', '2', 'Hạn phản hồi mặc định của một chỉ đạo (ngày)'),
  ('ky_ban_hanh_ngay', '10', 'Loại "Ký ban hành": hạn = ngày ban hành + N ngày (tự tính)'),
  ('nguong_khong_cap_nhat_ngay', '30', 'Việc đang mở quá N ngày không ai cập nhật → chỉ số chất lượng dữ liệu');

-- 3. Hội nghị / văn bản kết luận: một hội nghị có thể nhiều số KL (HN 33 có 3). Ngày ban hành ≤ hôm nay: trigger 0015.
CREATE TABLE "public"."kl_hoi_nghi" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "so_hoi_nghi" integer NOT NULL CHECK ("so_hoi_nghi" > 0),
  "so_ket_luan" text NOT NULL,
  "ngay_ban_hanh" date NOT NULL,
  "ghi_chu" text,
  "tao_boi" uuid REFERENCES "public"."accounts"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE ("so_hoi_nghi", "so_ket_luan")
);

-- 4. Nhiệm vụ. Ba mốc thời gian tách bạch (Phần 6.2): han_xu_ly (hạn đơn vị), ngay_hoan_thanh (ngày thật
--    theo văn bản minh chứng), cap_nhat_luc (hệ thống). ghi_hoan_thanh_luc = lúc chuyển sang Hoàn thành,
--    để tính độ trễ nhập liệu. Mã NV-xxx sinh tự động; script nhập 8B ghi mã Excel rồi setval.
CREATE SEQUENCE "public"."kl_nhiem_vu_ma_seq";
CREATE TABLE "public"."kl_nhiem_vu" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ma" text NOT NULL UNIQUE DEFAULT ('NV-' || lpad(nextval('public.kl_nhiem_vu_ma_seq')::text, 3, '0')),
  "hoi_nghi_id" uuid NOT NULL REFERENCES "public"."kl_hoi_nghi"("id"),
  "chu_tri_id" uuid NOT NULL REFERENCES "public"."accounts"("id"),
  "nganh_ma" text REFERENCES "public"."dm_nganh"("ma"),
  "co_quan_trinh_ma" text REFERENCES "public"."dm_co_quan_trinh"("ma"),
  "linh_vuc_chi_tiet" text,
  "noi_dung" text NOT NULL CHECK (btrim("noi_dung") <> ''),
  "loai_thoi_han_ma" text NOT NULL REFERENCES "public"."dm_loai_thoi_han"("ma"),
  "han_xu_ly" date,
  "ly_do_chua_co_han" text,
  "tien_do_ma" text NOT NULL DEFAULT 'DANG_THUC_HIEN' REFERENCES "public"."dm_tien_do"("ma"),
  "ngay_hoan_thanh" date,
  "minh_chung" text,
  "van_ban_trien_khai" text,
  "so_lan_gia_han" integer NOT NULL DEFAULT 0 CHECK ("so_lan_gia_han" >= 0),
  "nguon" text NOT NULL DEFAULT 'app' CHECK ("nguon" IN ('excel', 'app')),
  "ghi_chu" text,
  -- Quyết định 3: minh chứng bắt buộc khi Hoàn thành — GĐ8 chỉ gắn cờ cảnh báo, GĐ10 mới chặn.
  "thieu_minh_chung" boolean GENERATED ALWAYS AS ("tien_do_ma" = 'HOAN_THANH' AND nullif(btrim(coalesce("minh_chung", '')), '') IS NULL) STORED,
  "ghi_hoan_thanh_luc" timestamp with time zone,
  "cap_nhat_luc" timestamp with time zone NOT NULL DEFAULT now(),
  "cap_nhat_boi" uuid REFERENCES "public"."accounts"("id"),
  "tao_boi" uuid REFERENCES "public"."accounts"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  -- Phần 2.3: "Có hạn cụ thể" ⇒ có hạn HOẶC có lý do chưa có hạn; dòng Excel đã Hoàn thành nhập nguyên trạng.
  CONSTRAINT "kl_nhiem_vu_han_co_han_cu_the" CHECK (
    "loai_thoi_han_ma" <> 'CO_HAN_CU_THE' OR "han_xu_ly" IS NOT NULL
    OR nullif(btrim(coalesce("ly_do_chua_co_han", '')), '') IS NOT NULL
    OR ("tien_do_ma" = 'HOAN_THANH' AND "nguon" = 'excel')),
  -- Phần 6.2: Hoàn thành ⇒ bắt buộc ngày hoàn thành (trừ dữ liệu Excel không có ngày gốc); chưa xong thì không có ngày.
  CONSTRAINT "kl_nhiem_vu_ngay_hoan_thanh_bat_buoc" CHECK (
    "tien_do_ma" <> 'HOAN_THANH' OR "ngay_hoan_thanh" IS NOT NULL OR "nguon" = 'excel'),
  CONSTRAINT "kl_nhiem_vu_ngay_hoan_thanh_chi_khi_xong" CHECK (
    "ngay_hoan_thanh" IS NULL OR "tien_do_ma" = 'HOAN_THANH')
);
CREATE INDEX "kl_nhiem_vu_chu_tri_idx" ON "public"."kl_nhiem_vu" ("chu_tri_id");
CREATE INDEX "kl_nhiem_vu_hoi_nghi_idx" ON "public"."kl_nhiem_vu" ("hoi_nghi_id");
CREATE INDEX "kl_nhiem_vu_tien_do_han_idx" ON "public"."kl_nhiem_vu" ("tien_do_ma", "han_xu_ly");

-- 5. Lịch sử mọi thay đổi (thay Apps Script NhatKyChinhSua). nguon = 'excel' cho 194 dòng nhật ký cũ
--    (quyết định 9), 'app' do trigger ghi, 'dinh_chinh' khi duyệt đề nghị đính chính.
CREATE TABLE "public"."kl_lich_su" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "nhiem_vu_id" uuid NOT NULL REFERENCES "public"."kl_nhiem_vu"("id") ON DELETE CASCADE,
  "luc" timestamp with time zone NOT NULL DEFAULT now(),
  "nguoi_sua" uuid REFERENCES "public"."accounts"("id"),
  "nguoi_sua_ghi_chu" text,
  "cot" text NOT NULL,
  "gia_tri_cu" text,
  "gia_tri_moi" text,
  "nguon" text NOT NULL DEFAULT 'app' CHECK ("nguon" IN ('excel', 'app', 'dinh_chinh')),
  "dinh_chinh_id" uuid
);
CREATE INDEX "kl_lich_su_nhiem_vu_idx" ON "public"."kl_lich_su" ("nhiem_vu_id", "luc" DESC);

-- 6. Chỉ đạo của lãnh đạo (Phần 3.3 + 6.5). GĐ8 chỉ có bảng và RLS; hàm 4 hành động + phản hồi = PR 10A.
CREATE TABLE "public"."kl_chi_dao" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nhiem_vu_id" uuid NOT NULL REFERENCES "public"."kl_nhiem_vu"("id") ON DELETE CASCADE,
  "nguoi_gui" uuid NOT NULL REFERENCES "public"."accounts"("id"),
  "loai" text NOT NULL CHECK ("loai" IN ('DON_DOC', 'GIA_HAN', 'GIAO_LAI', 'YEU_CAU_MINH_CHUNG', 'KIEM_TRA_SO_LIEU')),
  "noi_dung" text NOT NULL CHECK (btrim("noi_dung") <> ''),
  "han_phan_hoi" date,
  "han_moi" date,
  "chu_tri_moi" uuid REFERENCES "public"."accounts"("id"),
  "trang_thai" text NOT NULL DEFAULT 'CHO_PHAN_HOI' CHECK ("trang_thai" IN ('CHO_PHAN_HOI', 'DA_PHAN_HOI', 'DA_DONG')),
  "phan_hoi" text,
  "phan_hoi_boi" uuid REFERENCES "public"."accounts"("id"),
  "phan_hoi_luc" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX "kl_chi_dao_nhiem_vu_idx" ON "public"."kl_chi_dao" ("nhiem_vu_id", "trang_thai");

-- 7. Đề nghị đính chính (Phần 6.4): không sửa thẳng dòng sai; người có quan_tri_kl (không phải người đề nghị) duyệt.
CREATE TABLE "public"."kl_dinh_chinh" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nhiem_vu_id" uuid NOT NULL REFERENCES "public"."kl_nhiem_vu"("id") ON DELETE CASCADE,
  "de_nghi_boi" uuid NOT NULL REFERENCES "public"."accounts"("id"),
  "cot" text NOT NULL CHECK ("cot" IN ('han_xu_ly', 'loai_thoi_han_ma', 'tien_do_ma', 'ngay_hoan_thanh',
                                       'minh_chung', 'nganh_ma', 'co_quan_trinh_ma', 'ly_do_chua_co_han')),
  "gia_tri_cu" text,
  "gia_tri_moi" text,
  "ly_do" text NOT NULL CHECK (btrim("ly_do") <> ''),
  "can_cu" text,
  "trang_thai" text NOT NULL DEFAULT 'CHO_DUYET' CHECK ("trang_thai" IN ('CHO_DUYET', 'DA_DUYET', 'BAC_BO')),
  "duyet_boi" uuid REFERENCES "public"."accounts"("id"),
  "duyet_luc" timestamp with time zone,
  "ly_do_bac_bo" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX "kl_dinh_chinh_cho_duyet_idx" ON "public"."kl_dinh_chinh" ("nhiem_vu_id") WHERE "trang_thai" = 'CHO_DUYET';
ALTER TABLE "public"."kl_lich_su"
  ADD CONSTRAINT "kl_lich_su_dinh_chinh_fkey" FOREIGN KEY ("dinh_chinh_id") REFERENCES "public"."kl_dinh_chinh"("id");
