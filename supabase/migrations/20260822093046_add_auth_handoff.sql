-- 카카오 원탭 로그인 — 세션 핸드오프 우체통
-- 설계: PrayU-web/docs/plans/kakao-login-handoff.md
--
-- 카카오톡 인앱브라우저에서 완결된 Supabase 세션을 "로그인을 시작한 원래 탭"으로
-- 옮기기 위한 1회용 예치 테이블. 행 수명은 초 단위(claim 즉시 삭제, TTL 3분 lazy 정리).
--
-- - nonce = SHA-256(secret) 커밋: URL 로 노출되는 nonce 로는 claim 불가 (secret 은 원래 탭 메모리에만)
-- - RLS 정책 0개 = service role(auth-handoff EF) 전용. rls_auto_enable 이 RLS 를 켜지만 명시도 해둔다
-- - 하드 삭제: 소프트 삭제 관례의 의도적 예외 — 토큰 잔존 방지가 목적이라 남기면 오히려 위험
-- - 유저 ID 미저장(최소 정보): 이 행은 사용자 데이터가 아니라 일회용 운반체다

create table "public"."auth_handoff" (
    "nonce" text primary key,
    "access_token" text not null,
    "refresh_token" text not null,
    "created_at" timestamp with time zone not null default now()
);

alter table "public"."auth_handoff" enable row level security;
