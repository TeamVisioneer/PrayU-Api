-- 카카오톡 공유 보상 로그 (docs: PrayU-web/docs/share-reward-plan.md)
-- 공유 성공 웹훅(kakao-webhook 함수)이 기록하고, bible 함수가 당일 보상 수를 읽어
-- 말씀카드 생성 한도를 동적으로 올린다 (limit = 기본 3 + 오늘 보상 수)
create table "public"."share_reward_log" (
    "id" uuid primary key default gen_random_uuid(),
    "user_id" uuid not null references "public"."profiles"(id),
    "feature" text not null,
    "chat_type" text,
    "hash_chat_id" text,
    "created_at" timestamp with time zone not null default now()
);

-- 한도 계산용 (user_id + feature + 당일)
create index "idx_share_reward_user_feature"
    on "public"."share_reward_log" ("user_id", "feature", "created_at" desc);
-- 동일 채팅방 당일 중복 검사용
create index "idx_share_reward_user_room"
    on "public"."share_reward_log" ("user_id", "hash_chat_id", "created_at" desc);

alter table "public"."share_reward_log" enable row level security;

-- 클라이언트는 자기 보상 조회만 가능 (남은 횟수 표시용).
-- 쓰기 정책은 의도적으로 없음: insert는 kakao-webhook 함수(service role, RLS 우회) 전용
create policy "select own share reward"
    on "public"."share_reward_log"
    for select
    to authenticated
    using (auth.uid() = user_id);
