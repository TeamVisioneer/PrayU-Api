-- 사용 로그 읽기 개방 (docs: PrayU-web/docs/admin-revamp-plan.md)
--
-- 어드민 대시보드가 LLM 비용·공유 보상을 집계하려면 전체 로그를 읽어야 한다.
-- 관리자 전용 select 정책을 따로 두는 대신 읽기를 열었다:
--   - 저장되는 값은 사용 메타데이터뿐이다 (user_id, feature, model, 토큰 수, 시각,
--     metadata는 {pray_card_id} 또는 {}). 기도 내용은 들어가지 않는다
--   - 정작 기도 내용을 담은 pray_card가 이미 select using(true)라, 이 두 테이블만
--     가려서 얻는 실익이 없다
-- 접근 모델 전반은 security-backlog 1번(RLS 전면 정비)에서 일괄 재설계한다.
--
-- ⚠️ 이 변경으로 "RLS가 본인 것만 준다"는 전제가 사라진다.
--    사용량을 세는 쪽은 user_id 필터를 명시해야 한다 (web 짝 PR에서 반영).
drop policy if exists "select own llm usage" on "public"."llm_usage_log";
drop policy if exists "select own share reward" on "public"."share_reward_log";

create policy "select llm usage"
    on "public"."llm_usage_log"
    for select
    to authenticated
    using (true);

create policy "select share reward"
    on "public"."share_reward_log"
    for select
    to authenticated
    using (true);
