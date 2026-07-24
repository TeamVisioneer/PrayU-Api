-- LLM 호출 사용량 로그 (공용 인프라)
-- 쿼터 판정·비용 관측을 위해 피처 공통으로 사용한다. 한도 정책 자체는 각 edge function의 service에 둔다.
-- metadata 키 규율: 피처별 키는 docs(PrayU-web/docs/bible-card-finishing-plan.md)에 명시된 것만 사용
--   - feature = 'bible_card': {"pray_card_id": uuid | null}
create table "public"."llm_usage_log" (
    "id" uuid primary key default gen_random_uuid(),
    "user_id" uuid not null references "public"."profiles"(id),
    "feature" text not null,
    "model" text,
    "prompt_tokens" integer,
    "completion_tokens" integer,
    "metadata" jsonb,
    "created_at" timestamp with time zone not null default now()
);

create index "idx_llm_usage_user_feature"
    on "public"."llm_usage_log" ("user_id", "feature", "created_at" desc);

alter table "public"."llm_usage_log" enable row level security;

-- 클라이언트는 자기 로그 조회만 가능 (남은 횟수 표시용).
-- 쓰기 정책은 의도적으로 없음: insert/update는 edge function(service role, RLS 우회) 전용
create policy "select own llm usage"
    on "public"."llm_usage_log"
    for select
    to authenticated
    using (auth.uid() = user_id);
