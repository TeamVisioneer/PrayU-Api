-- premium_expired_at 자기부여 차단 (docs/plans/premium-guard.md · security-backlog 8번)
--
-- #39 에서 is_admin 을 컬럼 권한으로 막을 때 재부여 목록에 premium_expired_at 이 남아,
-- 로그인한 사용자가 자기 행에 임의 만료일을 넣어 프리미엄(그룹 무제한)을 공짜로 얻을 수
-- 있었다. 같은 패턴으로 목록에서 뺀다 — 어드민 쓰기는 서버 경로(POST /api/admin/premium)로
-- 옮겨졌으므로 이제 클라이언트가 이 컬럼을 쓸 정당한 경로는 없다.
--
-- 컬럼 추가 시 이 목록에도 넣어야 한다 — 누락되면 해당 컬럼 수정이 즉시 실패해 드러난다.
-- deleted_at(#56)은 의도적으로 없다: 탈퇴 표시는 서버(service role)만 쓴다.

revoke update on table "public"."profiles" from anon, authenticated;
grant update (
    updated_at, username, full_name, avatar_url, website,
    kakao_id, kakao_notification, terms_agreed_at, blocking_users,
    push_notification, fcm_token, created_at, app_settings
) on table "public"."profiles" to authenticated;
