-- GĐ3 (3/3) — Hàm nghiệp vụ nhiều bước (SPEC RLS-8): SECURITY DEFINER, search_path
-- cố định, kiểm tra quyền bên trong bằng các helper của 0007, chỉ authenticated gọi.
-- Lỗi quyền dùng ERRCODE 42501 để frontend nhận "permission denied".

-- Giao việc (A1/A2). p: title, resolution_code, expected_product, deadline,
-- critical_overdue_days, competent_authority, assigned_to (null = chưa giao),
-- leader_in_charge, voffice_received_at (tuỳ chọn).
CREATE FUNCTION "public"."assign_task"("p" jsonb) RETURNS "uuid"
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_assigned uuid := nullif("p"->>'assigned_to', '')::uuid; v_id uuid;
BEGIN
  IF "public"."me_role"() NOT IN ('A1', 'A2') OR NOT "public"."can_assign_to"(v_assigned) THEN
    RAISE EXCEPTION 'Không có quyền giao việc cho người này.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO "public"."tasks" ("title", "resolution_code", "expected_product", "deadline",
    "critical_overdue_days", "competent_authority", "assigned_to", "leader_in_charge",
    "created_by", "voffice_received_at", "status", "warning_count")
  VALUES ("p"->>'title', "p"->>'resolution_code', "p"->>'expected_product',
    ("p"->>'deadline')::timestamptz, ("p"->>'critical_overdue_days')::integer,
    coalesce("p"->>'competent_authority', 'Lãnh đạo Văn phòng'), v_assigned,
    nullif("p"->>'leader_in_charge', '')::uuid, "auth"."uid"(),
    coalesce(("p"->>'voffice_received_at')::timestamptz, now()),
    CASE WHEN v_assigned IS NULL THEN 'CHUA_GIAO' ELSE 'CHO_TIEP_NHAN' END, 0)
  RETURNING "id" INTO v_id;
  RETURN v_id;
END;
$$;

-- Duyệt hoàn thành (A1/A2 trong phạm vi): task phải đang CHO_DUYET; đánh dấu
-- minh chứng đã duyệt trong cùng giao dịch.
CREATE FUNCTION "public"."approve_task"("p_task_id" "uuid") RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
BEGIN
  IF "public"."me_role"() NOT IN ('A1', 'A2') OR NOT "public"."can_see_task"("p_task_id") THEN
    RAISE EXCEPTION 'Không có quyền duyệt nhiệm vụ này.' USING ERRCODE = '42501';
  END IF;
  UPDATE "public"."tasks" SET "status" = 'HOAN_THANH', "completed_at" = now()
  WHERE "id" = "p_task_id" AND "status" = 'CHO_DUYET';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nhiệm vụ không ở trạng thái chờ duyệt.' USING ERRCODE = '22023';
  END IF;
  UPDATE "public"."task_evidences" SET "is_approved" = true, "reviewed_at" = now()
  WHERE "task_id" = "p_task_id" AND coalesce("is_approved", false) = false;
END;
$$;

-- Nộp minh chứng (A3, task của mình, đang DANG_THUC_HIEN): thêm evidence + CHO_DUYET.
CREATE FUNCTION "public"."submit_evidence"("p_task_id" "uuid", "p_title" "text", "p_url" "text")
RETURNS "uuid"
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_id uuid;
BEGIN
  IF "public"."me_role"() <> 'A3' OR NOT EXISTS (
    SELECT 1 FROM "public"."tasks" WHERE "id" = "p_task_id"
      AND "assigned_to" = "auth"."uid"() AND "status" = 'DANG_THUC_HIEN') THEN
    RAISE EXCEPTION 'Chỉ chuyên viên đang thực hiện nhiệm vụ mới được nộp minh chứng.' USING ERRCODE = '42501';
  END IF;
  IF "p_url" !~ '^https?://.+' THEN
    RAISE EXCEPTION 'Đường dẫn minh chứng phải bắt đầu bằng http:// hoặc https://.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO "public"."task_evidences" ("task_id", "uploaded_by", "document_title", "file_url")
  VALUES ("p_task_id", "auth"."uid"(), "p_title", "p_url") RETURNING "id" INTO v_id;
  UPDATE "public"."tasks" SET "status" = 'CHO_DUYET' WHERE "id" = "p_task_id";
  RETURN v_id;
END;
$$;

-- Đôn đốc (A1/A2 trong phạm vi): tăng warning_count nguyên tử.
CREATE FUNCTION "public"."warn_task"("p_task_id" "uuid") RETURNS integer
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_count integer;
BEGIN
  IF "public"."me_role"() NOT IN ('A1', 'A2') OR NOT "public"."can_see_task"("p_task_id") THEN
    RAISE EXCEPTION 'Không có quyền đôn đốc nhiệm vụ này.' USING ERRCODE = '42501';
  END IF;
  UPDATE "public"."tasks" SET "warning_count" = coalesce("warning_count", 0) + 1, "last_warned_at" = now()
  WHERE "id" = "p_task_id" RETURNING "warning_count" INTO v_count;
  RETURN v_count;
END;
$$;

-- Đánh dấu đã đọc ý kiến trong luồng (bên liên quan), trừ ý kiến do mình gửi.
CREATE FUNCTION "public"."mark_directives_read"("p_task_id" "uuid") RETURNS integer
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_n integer;
BEGIN
  IF NOT "public"."is_task_party"("p_task_id") THEN
    RAISE EXCEPTION 'Không có quyền với luồng ý kiến này.' USING ERRCODE = '42501';
  END IF;
  UPDATE "public"."task_directives" SET "is_read" = true, "read_at" = now()
  WHERE "task_id" = "p_task_id" AND "sender_id" <> "auth"."uid"() AND "is_read" = false;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- Đánh dấu đã đọc tin nhắn từ một người gửi tới mình.
CREATE FUNCTION "public"."mark_messages_read"("p_peer_id" "uuid") RETURNS integer
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_n integer;
BEGIN
  IF "auth"."uid"() IS NULL THEN
    RAISE EXCEPTION 'Chưa đăng nhập.' USING ERRCODE = '42501';
  END IF;
  UPDATE "public"."direct_messages" SET "is_read" = true, "read_at" = now()
  WHERE "sender_id" = "p_peer_id" AND "receiver_id" = "auth"."uid"() AND "is_read" = false;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['assign_task(jsonb)', 'approve_task(uuid)', 'submit_evidence(uuid,text,text)',
    'warn_task(uuid)', 'mark_directives_read(uuid)', 'mark_messages_read(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
