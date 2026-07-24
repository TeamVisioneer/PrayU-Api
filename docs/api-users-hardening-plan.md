# /api/users 생성 엔드포인트 · push 함수 정리 계획

작성: 2026-07 / 상태: **초안 — 방향 확인 필요** / 우선순위: **3**
(같은 "미사용·무보호 엔드포인트 정리" 관심사인 `push` 함수 제거를 함께 다룬다)

## 리스크

`POST /functions/v1/api/users`(createUserV1)는 **anon 토큰으로 임의 이메일의 auth 계정을 생성**할 수 있다.

- `userController.createUserV1` — 호출자 검사 없음 (authMiddleware의 anon 통과)
- `userRepository.createUser` — `supabase.auth.admin.createUser({ email, user_metadata })` 즉 **admin API 직결**
- 악용: 공개 anon key로 스팸 계정 대량 생성, 타인 이메일 선점 등

## 조사 결과 (2026-07 확인)

- **웹 사용처 0건**: PrayU-web은 `/functions/v1/api/users`를 **DELETE(본인 삭제, 세션 토큰)만** 호출 (`src/apis/user.ts:89` 부근). POST 호출 코드 없음
- Flutter 앱은 WebView 셸이라 직접 호출 없음
- 카카오 OAuth 가입은 Supabase Auth가 처리하므로 서버 생성 API가 필요 없음
- → **미사용 레거시일 가능성 높음** (과거 운영 스크립트용으로 추정)

## 계획 (기본안: 제거)

1. **확인 단계** (사람): 운영 스크립트·외부 도구에서 이 POST를 쓰는 곳이 정말 없는지 확인 — staging/prod 함수 로그에서 최근 POST /api/users 호출 이력 조회
2. 없다면: `userRouter`에서 POST 라우트 제거 + `createUserV1`/`createUser` 삭제 (DELETE는 유지 — self-only라 안전)
3. 만약 운영용으로 필요하다면(대안): 라우트를 `userId === "service_role"` 전용으로 제한 — anon·일반 사용자 차단

## 추가: `push` 함수 제거 (2026-07 호출자 조사에서 확정)

- `push`는 **미들웨어 없이 인증 전무**로 배포되어 있고, 유일한 호출자였던 `fcm_notification_webhook`은 레거시 확정·제거됨(`drop_legacy_fcm_webhook`)
- 현재 상태: anon key만 있으면 게이트웨이를 넘어 임의 payload로 FCM 발송 시도·`notification.fcm_result` 조작 가능한 죽은 함수
- 계획: `supabase/functions/push/` 디렉터리 삭제 + 배포 목록에서 제외. `profiles.fcm_token` 레거시 컬럼 정리는 별도(운영 대장 문서에 후보로 기록됨)
- 확인 단계 (사람): prod 함수 로그에서 push 호출 이력이 정말 없는지 확인 후 진행

## 영향·배포

- 웹/앱 무영향 (사용처 없음 전제). 단독 Api PR, 마이그레이션 없음
- staging 반영 후 웹 회원 플로우(가입·삭제)·알림 발송 회귀 확인

## 검증

- 로컬: POST /api/users anon 호출 → 404(제거안) 또는 403(제한안) / DELETE 본인 토큰 → 정상
- 웹 카카오 가입 → 정상 (Auth 직접 처리 경로 무영향 확인)
