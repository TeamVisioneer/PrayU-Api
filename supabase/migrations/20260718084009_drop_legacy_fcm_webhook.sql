-- 레거시 FCM webhook 트리거 제거 (2026-07-18 확정)
-- OneSignal 도입 이후 사용하지 않는 트리거. prod 에서는 이미 DISABLE 상태였고
-- 정의에 환경별 URL·service_role 키가 하드코딩돼 있어 마이그레이션 관리 대상이 아니다.
-- 로컬/staging(리셋 후)에는 애초에 없으므로 if exists 로 안전하게 제거만 한다.
drop trigger if exists "fcm_notification_webhook" on "public"."notification";
