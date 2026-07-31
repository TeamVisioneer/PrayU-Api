-- 회원 탈퇴를 소프트 삭제로 전환한다 (docs/account-deletion-plan.md).
--
-- 하드 삭제는 profiles_id_fkey(NO ACTION) 때문에 **항상 실패**해 왔다.
-- 소프트 삭제는 auth.users 를 익명화만 하므로 profiles 행이 그대로 남는데,
-- 그러면 "탈퇴한 계정"을 구분할 표시가 없다. deleted_at 이 그 표시다.
--
-- 쓰이는 곳:
--   1. 나중에 돌릴 배치 하드 삭제의 대상 선별
--   2. 재가입 계정(새 행)과의 구분
--   3. 알림·집계에서 제외

alter table "public"."profiles"
    add column "deleted_at" timestamp with time zone;

comment on column "public"."profiles"."deleted_at" is
    '탈퇴 시각. 소프트 삭제 표시 — 개인 식별정보는 지워지고 행은 남는다. 상세: docs/account-deletion-plan.md';

-- 탈퇴 계정은 소수라 부분 인덱스로 둔다 (배치가 이 조건으로만 조회한다)
create index "profiles_deleted_at_idx"
    on "public"."profiles" ("deleted_at")
    where "deleted_at" is not null;
