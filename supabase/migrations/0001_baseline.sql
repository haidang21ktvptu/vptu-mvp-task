SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "public"."accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "username" "text" NOT NULL,
    "password" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "role_group" "text" NOT NULL,
    "position_title" "text" NOT NULL,
    "assigned_domain" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "manager_id" "uuid",
    "department" "text",
    CONSTRAINT "accounts_role_group_check" CHECK (("role_group" = ANY (ARRAY['A1'::"text", 'A2'::"text", 'A3'::"text"])))
);

ALTER TABLE "public"."accounts" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."direct_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid",
    "receiver_id" "uuid",
    "content" "text" NOT NULL,
    "is_read" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."direct_messages" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."task_directives" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "is_read" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "recipient_id" "uuid"
);

ALTER TABLE "public"."task_directives" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."task_evidences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "uploaded_by" "uuid" NOT NULL,
    "document_title" "text" NOT NULL,
    "file_url" "text",
    "note" "text",
    "is_approved" boolean DEFAULT false,
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."task_evidences" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "resolution_code" "text" NOT NULL,
    "owner_id" "uuid",
    "expected_product" "text" NOT NULL,
    "voffice_received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deadline" timestamp with time zone NOT NULL,
    "critical_overdue_days" integer NOT NULL,
    "competent_authority" "text" NOT NULL,
    "status" "text" DEFAULT 'IN_PROGRESS'::"text" NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "assigned_to" "uuid",
    "created_by" "uuid",
    "reject_reason" "text",
    "warning_count" integer DEFAULT 0,
    "last_warned_at" timestamp with time zone,
    "leader_in_charge" "uuid",
    CONSTRAINT "tasks_critical_overdue_days_check" CHECK (("critical_overdue_days" > 0)),
    CONSTRAINT "tasks_status_check" CHECK (("status" = ANY (ARRAY['CHO_TIEP_NHAN'::"text", 'DANG_THUC_HIEN'::"text", 'TU_CHOI_TIEP_NHAN'::"text", 'CHUA_GIAO'::"text", 'CHO_DUYET'::"text", 'HOAN_THANH'::"text"])))
);

ALTER TABLE "public"."tasks" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."view_exception_dashboard" AS
 SELECT "t"."id" AS "task_id",
    "t"."title" AS "task_title",
    "t"."resolution_code",
    COALESCE("acv"."full_name", 'Chưa giao cán bộ'::"text") AS "owner_name",
    COALESCE("acv"."position_title", 'Chưa phân công'::"text") AS "owner_org",
    "acv"."department" AS "owner_department",
    COALESCE("ald"."full_name", 'Chưa chỉ định LĐ phụ trách'::"text") AS "leader_name",
    "t"."expected_product",
    "t"."voffice_received_at",
    "t"."deadline",
    "t"."critical_overdue_days",
    "t"."competent_authority",
    "t"."status",
    "t"."warning_count",
    "t"."reject_reason",
        CASE
            WHEN ("t"."status" = 'HOAN_THANH'::"text") THEN 0
            WHEN ("now"() > "t"."deadline") THEN (EXTRACT(day FROM ("now"() - "t"."deadline")))::integer
            ELSE 0
        END AS "days_overdue",
        CASE
            WHEN ("t"."status" = 'HOAN_THANH'::"text") THEN 'HOAN_THANH'::"text"
            WHEN ("t"."status" = 'CHO_DUYET'::"text") THEN 'CHO_DUYET'::"text"
            WHEN ("t"."status" = 'TU_CHOI_TIEP_NHAN'::"text") THEN 'TU_CHOI'::"text"
            WHEN (("t"."status" = 'CHUA_GIAO'::"text") OR ("t"."assigned_to" IS NULL)) THEN 'CHUA_GIAO'::"text"
            WHEN (("now"() > "t"."deadline") AND (EXTRACT(day FROM ("now"() - "t"."deadline")) >= ("t"."critical_overdue_days")::numeric)) THEN 'DO_DAC_BIET'::"text"
            WHEN ("now"() > "t"."deadline") THEN 'DO'::"text"
            WHEN (("t"."deadline" - "now"()) <= '3 days'::interval) THEN 'VANG'::"text"
            ELSE 'XANH'::"text"
        END AS "alert_level"
   FROM (("public"."tasks" "t"
     LEFT JOIN "public"."accounts" "acv" ON (("t"."assigned_to" = "acv"."id")))
     LEFT JOIN "public"."accounts" "ald" ON (("t"."leader_in_charge" = "ald"."id")));

ALTER VIEW "public"."view_exception_dashboard" OWNER TO "postgres";

ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_username_key" UNIQUE ("username");

ALTER TABLE ONLY "public"."direct_messages"
    ADD CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."task_directives"
    ADD CONSTRAINT "task_directives_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."task_evidences"
    ADD CONSTRAINT "task_evidences_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."accounts"("id");

ALTER TABLE ONLY "public"."direct_messages"
    ADD CONSTRAINT "direct_messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "public"."accounts"("id");

ALTER TABLE ONLY "public"."direct_messages"
    ADD CONSTRAINT "direct_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."accounts"("id");

ALTER TABLE ONLY "public"."task_directives"
    ADD CONSTRAINT "task_directives_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."accounts"("id");

ALTER TABLE ONLY "public"."task_directives"
    ADD CONSTRAINT "task_directives_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."accounts"("id");

ALTER TABLE ONLY "public"."task_directives"
    ADD CONSTRAINT "task_directives_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."task_evidences"
    ADD CONSTRAINT "task_evidences_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."accounts"("id");

ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."accounts"("id");

ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_leader_in_charge_fkey" FOREIGN KEY ("leader_in_charge") REFERENCES "public"."accounts"("id");

ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."direct_messages";

ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."task_directives";

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON TABLE "public"."accounts" TO "anon";
GRANT ALL ON TABLE "public"."accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."accounts" TO "service_role";

GRANT ALL ON TABLE "public"."direct_messages" TO "anon";
GRANT ALL ON TABLE "public"."direct_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."direct_messages" TO "service_role";

GRANT ALL ON TABLE "public"."task_directives" TO "anon";
GRANT ALL ON TABLE "public"."task_directives" TO "authenticated";
GRANT ALL ON TABLE "public"."task_directives" TO "service_role";

GRANT ALL ON TABLE "public"."task_evidences" TO "anon";
GRANT ALL ON TABLE "public"."task_evidences" TO "authenticated";
GRANT ALL ON TABLE "public"."task_evidences" TO "service_role";

GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";

GRANT ALL ON TABLE "public"."view_exception_dashboard" TO "anon";
GRANT ALL ON TABLE "public"."view_exception_dashboard" TO "authenticated";
GRANT ALL ON TABLE "public"."view_exception_dashboard" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
