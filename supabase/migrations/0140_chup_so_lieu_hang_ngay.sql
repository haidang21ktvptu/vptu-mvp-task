-- 0140 (v3.36 — Đợt 1 sau rà soát toàn diện 25/11/2026, CAU-HOI V-1): bảng chụp số liệu hằng ngày cho Tổng quan ba tầng. Mỗi ngày một bản chụp
-- trạng thái của MỌI nhiệm vụ chưa hoàn thành (nhóm đếm, mức cảnh báo, có vướng mắc, cấp cần quyết định — đúng các cột Tổng quan dùng để đếm thẻ
-- Quá hạn chưa hoàn thành, Cần lãnh đạo cho ý kiến, Đang thực hiện trong hạn). Tổng quan đọc bản chụp của 7 ngày trước để ghi "tăng / giảm so với
-- tuần trước" và bản chụp các Chủ nhật để vẽ số quá hạn 12 tuần; lọc theo đúng tập việc đang xem ở trình duyệt (bộ lọc, phạm vi). Trước đây chỉ
-- tính lại trạng thái tại ngày cũ từ dữ liệu hiện tại (kl_so_lieu_cac_moc 0051) nên việc đã gia hạn hoặc đã hoàn thành trong tuần làm sai số cũ.
-- Ghi: chỉ kl_chup_so_lieu (service_role), workflow canh-bao.yml gọi lúc 07:30 giờ Việt Nam cùng lượt cảnh báo tự động; chạy lại trong ngày thì
-- thay bản chụp của ngày đó. Đọc: như nhiệm vụ (policy nhiem_vu_select 0049 — xem tất cả hoặc việc trong tập thấy được). Giữ 1100 ngày (~3 năm):
-- khoảng 300 việc chưa hoàn thành mỗi ngày ⇒ ~110 nghìn dòng / năm, ~12 MB / năm kể cả chỉ mục.

CREATE TABLE "public"."kl_chup_viec" (
  "ngay" date NOT NULL,
  "nhiem_vu_id" uuid NOT NULL REFERENCES "public"."nhiem_vu"("id") ON DELETE CASCADE,
  "nhom_dem" text NOT NULL,
  "muc_canh_bao" text NOT NULL,
  "co_vuong_mac" boolean NOT NULL DEFAULT false,
  "cap_quyet_dinh" text,
  "chup_luc" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("ngay", "nhiem_vu_id")
);
COMMENT ON TABLE "public"."kl_chup_viec" IS '0140: bản chụp hằng ngày trạng thái các nhiệm vụ chưa hoàn thành (Tổng quan: so với tuần trước, xu hướng 12 tuần); chỉ ghi qua kl_chup_so_lieu';
CREATE INDEX "kl_chup_viec_nhiem_vu_idx" ON "public"."kl_chup_viec" ("nhiem_vu_id");   -- xoá nhiệm vụ (CASCADE) không quét cả bảng
ALTER TABLE "public"."kl_chup_viec" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."kl_chup_viec" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."kl_chup_viec" TO "authenticated";
CREATE POLICY "kl_chup_viec_select" ON "public"."kl_chup_viec" FOR SELECT TO "authenticated"
  USING ((SELECT "public"."kl_xem_tat_ca"()) OR "nhiem_vu_id" IN (SELECT "public"."kl_nhiem_vu_thay_duoc"(true)));   -- như nhiem_vu_select (0049)

-- Chụp số liệu của một ngày (mặc định hôm nay, giờ Việt Nam): trạng thái tính bằng trang_thai_dong (một nguồn với v_nhiem_vu). Không nhận ngày sau
-- hôm nay. Trả { ngay, so_viec, xoa_cu }.
CREATE FUNCTION "public"."kl_chup_so_lieu"("p_ngay" date DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ngay date := coalesce("p_ngay", "public"."kl_hom_nay"()); v_n integer; v_xoa integer;
BEGIN
  IF v_ngay > "public"."kl_hom_nay"() THEN
    RAISE EXCEPTION 'Không chụp số liệu cho ngày sau hôm nay.' USING ERRCODE = '22023';
  END IF;
  DELETE FROM "public"."kl_chup_viec" WHERE "ngay" = v_ngay;   -- chạy lại trong ngày: việc vừa hoàn thành không còn trong bản chụp
  INSERT INTO "public"."kl_chup_viec" ("ngay", "nhiem_vu_id", "nhom_dem", "muc_canh_bao", "co_vuong_mac", "cap_quyet_dinh")
  SELECT v_ngay, nv."id", t."nhom_dem", t."muc_canh_bao", nullif(btrim(coalesce(nv."vuong_mac", '')), '') IS NOT NULL, nv."cap_quyet_dinh"
  FROM "public"."nhiem_vu" nv CROSS JOIN LATERAL "public"."trang_thai_dong"(nv.*, v_ngay) t
  WHERE nv."tien_do_ma" <> 'HOAN_THANH';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  DELETE FROM "public"."kl_chup_viec" WHERE "ngay" < v_ngay - 1100;
  GET DIAGNOSTICS v_xoa = ROW_COUNT;
  RETURN jsonb_build_object('ngay', v_ngay, 'so_viec', v_n, 'xoa_cu', v_xoa);
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_chup_so_lieu"(date) FROM public, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."kl_chup_so_lieu"(date) TO "service_role";

-- Bản chụp đầu tiên ngay khi áp migration (so sánh tuần trước có từ ngày thứ 7 sau khi phát hành).
SELECT "public"."kl_chup_so_lieu"();
