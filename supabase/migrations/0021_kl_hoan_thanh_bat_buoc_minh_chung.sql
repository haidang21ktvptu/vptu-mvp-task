-- GĐ10 (PR 10A) — Từ GĐ10, chuyển một nhiệm vụ KL sang "Hoàn thành" BẮT BUỘC có minh chứng và ngày hoàn thành thật
-- (thiết kế KL BTVTU quyết định 3 — điều chỉnh 15/9/2026 từ "chặn từ GĐ11" thành "chặn từ GĐ10"; Phần 6.2).
-- Quy tắc, áp trong trigger kl_nhiem_vu_truoc_ghi (thay thân hàm 0015, giữ nguyên mọi kiểm tra cũ):
--   Một dòng ở trạng thái Hoàn thành SAU KHI GHI phải có minh chứng và ngày hoàn thành, TRỪ hai trường hợp:
--   (a) dòng đã Hoàn thành và đã thiếu từ trước (146 việc nhập từ Excel, 78 không minh chứng) và lần ghi này
--       không đổi tiến độ — sửa ghi chú/văn bản triển khai/bổ sung minh chứng vẫn được, không chặn ngược;
--   (b) INSERT nguon = 'excel' (script nhập, bộ dữ liệu vàng trong CI) — nhập nguyên trạng, có cờ thieu_minh_chung.
-- Hệ quả: 39 việc Excel đang mở khi hoàn thành qua app cũng phải có ngày hoàn thành (CHECK 0014 miễn cho nguon =
-- 'excel' là quá rộng — đóng ở đây, CHECK cũ giữ nguyên vì không mâu thuẫn); xoá minh chứng của dòng đang Hoàn thành
-- bị chặn; đường đính chính (kl_duyet_dinh_chinh UPDATE tien_do_ma) đi qua cùng trigger nên không có lối vòng.
-- Không đổi bảng, không đổi dữ liệu, không đổi quyền. Quay lui = migration mới khôi phục thân hàm 0015.

CREATE OR REPLACE FUNCTION "public"."kl_nhiem_vu_truoc_ghi"() RETURNS trigger
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_ngay_bh date; v_ky integer;
        v_da_hoan_thanh boolean := TG_OP = 'UPDATE' AND OLD."tien_do_ma" = 'HOAN_THANH';   -- (a) dòng đã Hoàn thành từ trước
        v_nhap_excel boolean := TG_OP = 'INSERT' AND NEW."nguon" = 'excel';                -- (b) script nhập
BEGIN
  SELECT "ngay_ban_hanh" INTO v_ngay_bh FROM "public"."kl_hoi_nghi" WHERE "id" = NEW."hoi_nghi_id";
  IF NEW."loai_thoi_han_ma" = 'KY_BAN_HANH' THEN
    -- Hạn tự tính, không cho nhập tay (diệt lỗi 12 dòng công thức sheet không chạy).
    SELECT coalesce("gia_tri"::integer, 10) INTO v_ky FROM "public"."kl_cau_hinh" WHERE "khoa" = 'ky_ban_hanh_ngay';
    NEW."han_xu_ly" := v_ngay_bh + coalesce(v_ky, 10);
  END IF;
  IF NEW."han_xu_ly" IS NOT NULL AND NEW."han_xu_ly" < v_ngay_bh THEN
    RAISE EXCEPTION 'Hạn xử lý không được trước ngày ban hành (%).', to_char(v_ngay_bh, 'DD/MM/YYYY') USING ERRCODE = '22023';
  END IF;
  IF NEW."han_xu_ly" IS NOT NULL THEN NEW."ly_do_chua_co_han" := NULL; END IF;   -- có hạn thì lý do chưa có hạn hết ý nghĩa
  IF NEW."tien_do_ma" <> 'HOAN_THANH' THEN
    NEW."ngay_hoan_thanh" := NULL;
    NEW."ghi_hoan_thanh_luc" := NULL;
  ELSE
    -- GĐ10: Hoàn thành ⇒ minh chứng + ngày hoàn thành, trừ (a) đã thiếu từ trước mà không đổi tiến độ, (b) nhập Excel.
    IF nullif(btrim(coalesce(NEW."minh_chung", '')), '') IS NULL
       AND NOT (v_da_hoan_thanh AND nullif(btrim(coalesce(OLD."minh_chung", '')), '') IS NULL)
       AND NOT v_nhap_excel THEN
      RAISE EXCEPTION 'Chuyển sang Hoàn thành phải có minh chứng (số hiệu văn bản hoặc đường dẫn).' USING ERRCODE = '22023';
    END IF;
    IF NEW."ngay_hoan_thanh" IS NULL
       AND NOT (v_da_hoan_thanh AND OLD."ngay_hoan_thanh" IS NULL)
       AND NOT v_nhap_excel THEN
      RAISE EXCEPTION 'Chuyển sang Hoàn thành phải ghi ngày hoàn thành thật (theo văn bản minh chứng).' USING ERRCODE = '22023';
    END IF;
    IF NEW."ngay_hoan_thanh" IS NOT NULL AND (NEW."ngay_hoan_thanh" < v_ngay_bh OR NEW."ngay_hoan_thanh" > "public"."kl_hom_nay"()) THEN
      RAISE EXCEPTION 'Ngày hoàn thành phải từ ngày ban hành tới hôm nay.' USING ERRCODE = '22023';
    END IF;
    -- Lúc ghi nhận Hoàn thành (để tính độ trễ nhập liệu): app = now(); dòng Excel giữ giá trị script đưa vào (thường NULL).
    IF TG_OP = 'UPDATE' AND OLD."tien_do_ma" <> 'HOAN_THANH' THEN NEW."ghi_hoan_thanh_luc" := now();
    ELSIF TG_OP = 'INSERT' AND NEW."nguon" = 'app' THEN NEW."ghi_hoan_thanh_luc" := now();
    ELSIF TG_OP = 'UPDATE' THEN NEW."ghi_hoan_thanh_luc" := OLD."ghi_hoan_thanh_luc";
    END IF;
  END IF;
  -- Mốc hệ thống: dòng Excel lúc nhập giữ cap_nhat_luc script đưa vào (quyết định 9); còn lại = now().
  IF TG_OP = 'UPDATE' OR NEW."nguon" = 'app' THEN
    NEW."cap_nhat_luc" := now();
    NEW."cap_nhat_boi" := "auth"."uid"();
  END IF;
  IF TG_OP = 'INSERT' AND NEW."tao_boi" IS NULL THEN NEW."tao_boi" := "auth"."uid"(); END IF;
  RETURN NEW;
END;
$$;
-- Trigger b_kl_nhiem_vu_truoc_ghi (0015) giữ nguyên; quyền hàm trigger đã REVOKE ở 0015.
