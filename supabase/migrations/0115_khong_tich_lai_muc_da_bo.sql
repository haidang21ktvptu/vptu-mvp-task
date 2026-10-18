-- 0115 (v3.25, kiểm tay staging 18/10/2026 — NV-8865): mục tiêu người dùng đã BỎ ở một việc không được tự tích lại ở việc đó.
-- Lỗi của 0110: goi_y_muc_tieu_viec chỉ hạ mục tích sẵn thành gợi ý khi MỌI quy tắc căn cứ của mục đều có phản hồi BO ở việc; nhưng ghi_phan_hoi_goi_y
-- (0111) chỉ nhận BO cho quy tắc mức tích sẵn → mục có thêm quy tắc mức gợi ý cùng khớp ("kinh tế rừng" tích sẵn + "bảo vệ rừng" gợi ý) không bao giờ
-- được hạ: ngăn chi tiết, Rà soát tích lại; "Chấp nhận các mục đã tích sẵn" gắn lại mục người giao đã bỏ.
-- Sửa (chỉ thay goi_y_muc_tieu_viec — cùng chữ ký, quyền giữ như 0110; không đổi dữ liệu):
-- 1. Trí nhớ theo MỤC TIÊU ở từng việc: việc có phản hồi BO cho một quy tắc bất kỳ của mục M (tra quy_tac_muc_tieu — kể cả quy tắc đã tắt / đổi mức)
--    → ở việc đó M là gợi ý, kèm "da_bo": true (giao diện không gửi phản hồi "không bấm" cho mục này — không ghi đè BO; chọn lại thì vẫn ghi "bấm thêm").
--    Quy tắc khác của M được nâng lên tích sẵn sau này cũng không tích lại M ở việc đó. Việc khác, giao việc mới (goi_y_muc_tieu): như cũ.
-- 2. Việc đã gắn riêng (có dòng nhiem_vu_muc_tieu — đọc theo RLS như việc): mục tiêu của văn bản không làm mục thành tích sẵn — phần gắn riêng là quyết
--    định cho việc đó (mục của văn bản bị bỏ ở việc mà chỉ quy tắc mức gợi ý khớp thì không ghi được BO, trước đây vẫn được tích lại nhờ văn bản); mục
--    vẫn là gợi ý nếu có căn cứ khác. Việc chưa gắn riêng: như cũ (tính theo văn bản).
-- Kiểm thử: tests/rls/kl-0115-khong-tich-lai.test.mjs.

CREATE OR REPLACE FUNCTION "public"."goi_y_muc_tieu_viec"("p_ids" uuid[]) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE r record; v jsonb := '{}'; v_g jsonb; v_qt uuid[]; v_bo text[];
BEGIN
  IF cardinality(coalesce("p_ids", '{}')) > 200 THEN RAISE EXCEPTION 'Mỗi lượt tối đa 200 việc.' USING ERRCODE = '22023'; END IF;
  FOR r IN SELECT n."id", n."van_ban_id", n."noi_dung", n."san_pham_mo_ta", n."nganh_ma", n."linh_vuc_ma", vb."so_ket_luan", vb."trich_yeu",
                  EXISTS (SELECT 1 FROM "public"."nhiem_vu_muc_tieu" m WHERE m."nhiem_vu_id" = n."id") AS "co_rieng"
           FROM "public"."nhiem_vu" n LEFT JOIN "public"."van_ban_giao_viec" vb ON vb."id" = n."van_ban_id" WHERE n."id" = ANY ("p_ids") LOOP
    v_g := "public"."goi_y_muc_tieu"(jsonb_build_object('van_ban_id', CASE WHEN r.co_rieng THEN NULL ELSE r.van_ban_id END, 'so_hieu_van_ban', r.so_ket_luan,
      'trich_yeu', r.trich_yeu, 'noi_dung', r.noi_dung, 'san_pham_mo_ta', r.san_pham_mo_ta, 'nganh', r.nganh_ma, 'linh_vuc', r.linh_vuc_ma));
    v_qt := "public"."kl_quy_tac_da_bo"(r.id);
    IF cardinality(v_qt) > 0 THEN
      SELECT coalesce(array_agg(DISTINCT q."muc_tieu_ma"), '{}') INTO v_bo FROM "public"."quy_tac_muc_tieu" q WHERE q."id" = ANY (v_qt);
      SELECT jsonb_set(v_g, '{goi_y}', coalesce(jsonb_agg(CASE WHEN t.g ->> 'ma' = ANY (v_bo) THEN t.g || '{"muc": "GOI_Y", "da_bo": true}'::jsonb ELSE t.g END
          ORDER BY t.i), '[]'))
      INTO v_g FROM jsonb_array_elements(v_g -> 'goi_y') WITH ORDINALITY AS t(g, i);
    END IF;
    v := v || jsonb_build_object(r.id, v_g);
  END LOOP;
  RETURN v;
END;
$$;
