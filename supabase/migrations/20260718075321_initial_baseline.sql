-- =============================================================================
-- PrayU initial baseline (prod 스키마 스냅샷 기준: prayu_prod / 2026-07-18)
-- 생성: supabase db dump --linked (public + extensions + publication)
--       + auth.users 트리거 / storage 버킷·정책 / RLS event trigger 수동 캡처
--
-- 제외 항목 (의도적):
--  - fcm_notification_webhook 트리거: OneSignal 도입으로 불필요해진 레거시 확정(2026-07-18).
--    prod 에서 DISABLE 상태였고 정의에 환경별 URL·service_role 키가 하드코딩돼 있어 제외.
--    prod 의 잔재는 후속 마이그레이션(drop_legacy_fcm_webhook)이 제거한다.
--  - staging 에만 있던 vector extension·search_bible 함수: bible 검색 실험 잔재(레거시 확정).
--    baseline(prod 기준)에 없으며 staging 리셋 시 자연 제거된다.
-- =============================================================================

-- 로컬 스택에 supabase_realtime publication 이 없을 수 있으므로 선제 보장
do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;



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


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_avatar_url_to_https"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.avatar_url LIKE 'http://%' THEN
    NEW.avatar_url := REGEXP_REPLACE(NEW.avatar_url, '^http://', 'https://');
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_avatar_url_to_https"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."bible" (
    "id" bigint NOT NULL,
    "cate" bigint NOT NULL,
    "book" bigint NOT NULL,
    "chapter" bigint NOT NULL,
    "paragraph" bigint NOT NULL,
    "sentence" "text" NOT NULL,
    "testament" "text" NOT NULL,
    "long_label" "text" NOT NULL,
    "short_label" "text" NOT NULL
);


ALTER TABLE "public"."bible" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bible_card" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "image_url" "text",
    "name" "text" DEFAULT '""'::"text" NOT NULL,
    "keywords" character varying[] DEFAULT '{}'::character varying[] NOT NULL,
    "colors" character varying[] DEFAULT '{}'::character varying[] NOT NULL,
    "radius" character varying[] DEFAULT '{}'::character varying[] NOT NULL,
    "bible_reference" "text" DEFAULT '""'::"text" NOT NULL,
    "bible_sentence" "text" DEFAULT '""'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bible_card" OWNER TO "postgres";


ALTER TABLE "public"."bible" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."bible_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."group" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "name" character varying,
    "intro" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "group_union_id" "uuid",
    "pray_time" "text"
);


ALTER TABLE "public"."group" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_union" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "church" "text" DEFAULT ''::"text" NOT NULL,
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "intro" "text" DEFAULT ''::"text" NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."group_union" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."member" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "group_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "pray_summary" "text"
);


ALTER TABLE "public"."member" OWNER TO "postgres";


COMMENT ON TABLE "public"."member" IS '-- 유니크 키 설정 ALTER TABLE "public"."member" ADD CONSTRAINT unique_user_group UNIQUE (user_id, group_id);';



CREATE TABLE IF NOT EXISTS "public"."notification" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "sender_id" "uuid",
    "group_id" "uuid",
    "title" "text" DEFAULT ''''''::"text" NOT NULL,
    "body" "text" DEFAULT ''''''::"text" NOT NULL,
    "type" "text" DEFAULT ''''''::"text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "fcm_result" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "checked_at" timestamp with time zone,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."notification" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pray" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "pray_card_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "pray_type" character varying
);


ALTER TABLE "public"."pray" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pray_card" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "group_id" "uuid",
    "content" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "bible_card_url" "text",
    "life" "text" DEFAULT ''::"text" NOT NULL,
    "bible_card_id" "uuid"
);


ALTER TABLE "public"."pray_card" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "username" "text",
    "full_name" "text",
    "avatar_url" "text",
    "website" "text",
    "kakao_id" "text",
    "kakao_notification" boolean DEFAULT true NOT NULL,
    "terms_agreed_at" timestamp with time zone,
    "blocking_users" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "push_notification" boolean DEFAULT true NOT NULL,
    "fcm_token" "text" DEFAULT ''''''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "app_settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "premium_expired_at" timestamp with time zone,
    CONSTRAINT "username_length" CHECK (("char_length"("username") >= 3))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."qt_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "long_label" "text" NOT NULL,
    "chapter" bigint NOT NULL,
    "start_paragraph" bigint NOT NULL,
    "end_paragraph" bigint NOT NULL,
    "full_sentence" "text" NOT NULL,
    "result" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."qt_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."thanks_card" (
    "id" bigint NOT NULL,
    "user_name" "text" DEFAULT ''::"text" NOT NULL,
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "image" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."thanks_card" OWNER TO "postgres";


ALTER TABLE "public"."thanks_card" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."thanks_card_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."bible_card"
    ADD CONSTRAINT "bible_card_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bible"
    ADD CONSTRAINT "bible_id_key" UNIQUE ("id");



ALTER TABLE ONLY "public"."bible"
    ADD CONSTRAINT "bible_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group"
    ADD CONSTRAINT "group_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_union"
    ADD CONSTRAINT "group_union_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."member"
    ADD CONSTRAINT "member_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification"
    ADD CONSTRAINT "notification_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pray"
    ADD CONSTRAINT "pray_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pray_card"
    ADD CONSTRAINT "pray_sheet_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."qt_data"
    ADD CONSTRAINT "qt_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."thanks_card"
    ADD CONSTRAINT "thanks_card_id_key" UNIQUE ("id");



ALTER TABLE ONLY "public"."thanks_card"
    ADD CONSTRAINT "thanks_card_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."member"
    ADD CONSTRAINT "unique_user_group" UNIQUE ("user_id", "group_id");



CREATE INDEX "idx_notification_user_created_active" ON "public"."notification" USING "btree" ("user_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_notification_user_unread_created" ON "public"."notification" USING "btree" ("user_id", "created_at" DESC) WHERE (("deleted_at" IS NULL) AND ("checked_at" IS NULL));



CREATE INDEX "idx_pray_card_group_created_active" ON "public"."pray_card" USING "btree" ("group_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_pray_card_user_group_created_active" ON "public"."pray_card" USING "btree" ("user_id", "group_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_pray_card_user_id_group_id" ON "public"."pray_card" USING "btree" ("user_id", "group_id");



CREATE INDEX "idx_pray_pray_card_user_created_active" ON "public"."pray" USING "btree" ("pray_card_id", "user_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_pray_user_created_active" ON "public"."pray" USING "btree" ("user_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_pray_user_id" ON "public"."pray" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "avatar_url_https_trigger" BEFORE INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_avatar_url_to_https"();







ALTER TABLE ONLY "public"."bible_card"
    ADD CONSTRAINT "bible_card_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."group"
    ADD CONSTRAINT "group_group_union_id_fkey" FOREIGN KEY ("group_union_id") REFERENCES "public"."group_union"("id");



ALTER TABLE ONLY "public"."group_union"
    ADD CONSTRAINT "group_union_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."group"
    ADD CONSTRAINT "group_user_id_fkey1" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."member"
    ADD CONSTRAINT "member_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."member"
    ADD CONSTRAINT "member_user_id_fkey1" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notification"
    ADD CONSTRAINT "notification_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notification"
    ADD CONSTRAINT "notification_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notification"
    ADD CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pray_card"
    ADD CONSTRAINT "pray_card_bible_card_id_fkey" FOREIGN KEY ("bible_card_id") REFERENCES "public"."bible_card"("id");



ALTER TABLE ONLY "public"."pray_card"
    ADD CONSTRAINT "pray_card_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pray_card"
    ADD CONSTRAINT "pray_card_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pray_card"
    ADD CONSTRAINT "pray_card_user_id_fkey1" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pray"
    ADD CONSTRAINT "pray_pray_card_id_fkey" FOREIGN KEY ("pray_card_id") REFERENCES "public"."pray_card"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pray"
    ADD CONSTRAINT "pray_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pray"
    ADD CONSTRAINT "pray_user_id_fkey1" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."qt_data"
    ADD CONSTRAINT "qt_data_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



CREATE POLICY "Enable Notification Insert" ON "public"."notification" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert access for all users" ON "public"."thanks_card" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."bible_card" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."group" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."group_union" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."member" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."pray" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable read access for all users" ON "public"."bible_card" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."group" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."group_union" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."member" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."pray" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."pray_card" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."thanks_card" FOR SELECT USING (true);



CREATE POLICY "Enable update" ON "public"."notification" FOR UPDATE USING (true);



CREATE POLICY "Enable update access for all users" ON "public"."thanks_card" FOR UPDATE USING (true);



CREATE POLICY "Enable update for authenticated users" ON "public"."bible_card" FOR UPDATE USING (true);



CREATE POLICY "Enable update for users" ON "public"."group_union" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Enable users to view their own data only" ON "public"."notification" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Public profiles are viewable by everyone." ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Update Group" ON "public"."group" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Update Pray" ON "public"."pray" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own profile." ON "public"."profiles" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can update own profile." ON "public"."profiles" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "admin can update user profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."email"() AS "email") = ANY (ARRAY['team.visioneer15@gmail.com'::"text", 's2615s@naver.com'::"text"])));



ALTER TABLE "public"."bible" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bible_card" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_union" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert praycard" ON "public"."pray_card" FOR INSERT WITH CHECK (true);



CREATE POLICY "insert qt data" ON "public"."qt_data" FOR INSERT WITH CHECK (true);



CREATE POLICY "insert rls" ON "public"."bible" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."member" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "membet_update_policy" ON "public"."member" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."group" "g"
  WHERE (("g"."id" = "member"."group_id") AND ("g"."user_id" = "auth"."uid"())))))) WITH CHECK ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."group" "g"
  WHERE (("g"."id" = "member"."group_id") AND ("g"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."notification" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pray" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pray_card" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."qt_data" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "select qt data" ON "public"."qt_data" FOR SELECT USING (true);



CREATE POLICY "select rls" ON "public"."bible" FOR SELECT USING (true);



ALTER TABLE "public"."thanks_card" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "update praycard" ON "public"."pray_card" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "update qt data" ON "public"."qt_data" FOR UPDATE USING (true);



CREATE POLICY "update rls" ON "public"."bible" FOR UPDATE USING (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."member";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notification";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."thanks_card";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "authenticator";












































































































































































































GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_avatar_url_to_https"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_avatar_url_to_https"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_avatar_url_to_https"() TO "service_role";
























GRANT ALL ON TABLE "public"."bible" TO "anon";
GRANT ALL ON TABLE "public"."bible" TO "authenticated";
GRANT ALL ON TABLE "public"."bible" TO "service_role";



GRANT ALL ON TABLE "public"."bible_card" TO "anon";
GRANT ALL ON TABLE "public"."bible_card" TO "authenticated";
GRANT ALL ON TABLE "public"."bible_card" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bible_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bible_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bible_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."group" TO "anon";
GRANT ALL ON TABLE "public"."group" TO "authenticated";
GRANT ALL ON TABLE "public"."group" TO "service_role";



GRANT ALL ON TABLE "public"."group_union" TO "anon";
GRANT ALL ON TABLE "public"."group_union" TO "authenticated";
GRANT ALL ON TABLE "public"."group_union" TO "service_role";



GRANT ALL ON TABLE "public"."member" TO "anon";
GRANT ALL ON TABLE "public"."member" TO "authenticated";
GRANT ALL ON TABLE "public"."member" TO "service_role";



GRANT ALL ON TABLE "public"."notification" TO "anon";
GRANT ALL ON TABLE "public"."notification" TO "authenticated";
GRANT ALL ON TABLE "public"."notification" TO "service_role";



GRANT ALL ON TABLE "public"."pray" TO "anon";
GRANT ALL ON TABLE "public"."pray" TO "authenticated";
GRANT ALL ON TABLE "public"."pray" TO "service_role";



GRANT ALL ON TABLE "public"."pray_card" TO "anon";
GRANT ALL ON TABLE "public"."pray_card" TO "authenticated";
GRANT ALL ON TABLE "public"."pray_card" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."qt_data" TO "anon";
GRANT ALL ON TABLE "public"."qt_data" TO "authenticated";
GRANT ALL ON TABLE "public"."qt_data" TO "service_role";



GRANT ALL ON TABLE "public"."thanks_card" TO "anon";
GRANT ALL ON TABLE "public"."thanks_card" TO "authenticated";
GRANT ALL ON TABLE "public"."thanks_card" TO "service_role";



GRANT ALL ON SEQUENCE "public"."thanks_card_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."thanks_card_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."thanks_card_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";



































-- =============================================================================
-- Appendix: pg_dump(-s public) 범위 밖 객체 수동 재현
-- =============================================================================

-- auth.users 신규 가입 시 public.profiles 자동 생성
create or replace trigger "on_auth_user_created"
  after insert on "auth"."users"
  for each row execute function "public"."handle_new_user"();

-- Storage 버킷 (prayu: 공개 / avatars: 비공개). 이미 있으면 건너뜀
insert into storage.buckets (id, name, public)
values ('prayu', 'prayu', true), ('avatars', 'avatars', false)
on conflict (id) do nothing;

-- Storage 정책 (staging 은 public 스키마만 리셋되므로 기존 정책과 충돌하지 않게 재생성)
drop policy if exists "Anyone can upload an avatar." on "storage"."objects";
create policy "Anyone can upload an avatar." on "storage"."objects"
  for insert with check (("bucket_id" = 'avatars'::"text"));

drop policy if exists "Avatar images are publicly accessible." on "storage"."objects";
create policy "Avatar images are publicly accessible." on "storage"."objects"
  for select using (("bucket_id" = 'avatars'::"text"));

drop policy if exists "select rls" on "storage"."objects";
create policy "select rls" on "storage"."objects"
  for select using (("bucket_id" = 'prayu'::"text"));

drop policy if exists "upload rls" on "storage"."objects";
create policy "upload rls" on "storage"."objects"
  for insert with check (("bucket_id" = 'prayu'::"text"));

-- 새 테이블 생성 시 RLS 자동 활성화 가드레일 (함수 본문은 본문 덤프에 포함됨).
-- event trigger 생성은 superuser 권한이 필요해 환경에 따라 거부될 수 있다(로컬 CLI 스택 등).
-- 가드레일은 nice-to-have 이므로 권한이 없으면 경고만 남기고 건너뛴다. prod 에는 이미 존재.
do $$
begin
  execute 'drop event trigger if exists rls_auto_enable';
  execute $ddl$
    create event trigger rls_auto_enable on ddl_command_end
      when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      execute function public.rls_auto_enable()
  $ddl$;
exception
  when insufficient_privilege then
    raise notice 'rls_auto_enable event trigger skipped: insufficient privilege (non-superuser environment)';
end $$;
