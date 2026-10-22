-- 0127 (v3.29, chủ dự án quyết 22/10/2026 — CAU-HOI O-2, "ghi đúng quy tắc" ở mọi màn hình): tiêu đề tin cảnh báo tự động (chuông thông báo, Diễn
-- biến) ghi bằng nghĩa như giao diện (DESIGN mục 13) thay cho "Cảnh báo Vàng / Đỏ / Đỏ đặc biệt":
--   VANG → "Sắp đến hạn" (số ngày còn lại và hạn đã ghi trong câu — ngưỡng Vàng khác nhau theo độ khẩn);
--   DO → "Quá hạn dưới N ngày"; DO_DAC_BIET → "Quá hạn từ N ngày trở lên" (N = nguong_do_dac_biet_ngay, mặc định 3 — như trang_thai_dong).
-- Các mức nhắc khác giữ nguyên. Hàm đọc cấu hình nên thành STABLE (chỉ canh_bao_quet gọi). Tin đã gửi trước giữ chữ cũ.
CREATE OR REPLACE FUNCTION "public"."canh_bao_ten_muc"("p_muc" text) RETURNS text
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE "p_muc" WHEN 'VANG' THEN 'Sắp đến hạn'
    WHEN 'DO' THEN format('Quá hạn dưới %s ngày', c.n) WHEN 'DO_DAC_BIET' THEN format('Quá hạn từ %s ngày trở lên', c.n)
    WHEN 'CHAM_NOP_MC' THEN 'Chậm nộp minh chứng' WHEN 'NGHIEM_THU' THEN 'Cần nghiệm thu minh chứng'
    WHEN 'NGHIEM_THU_QUA_HAN' THEN 'Quá hạn ở bước nghiệm thu' ELSE "p_muc" END
  FROM (SELECT coalesce((SELECT CASE WHEN k."gia_tri" ~ '^[0-9]{1,4}$' THEN k."gia_tri"::integer END FROM "public"."kl_cau_hinh" k
                         WHERE k."khoa" = 'nguong_do_dac_biet_ngay'), 3) AS n) c;
$$;
