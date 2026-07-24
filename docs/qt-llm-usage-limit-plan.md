# QT 엔드포인트 LLM 사용량 통제 계획

작성: 2026-07 / 상태: **초안 — 방향 확인 필요** / 우선순위: **1 (시급)**

## 리스크

`POST /functions/v1/openai/qt`는 현재 **공개 anon key만으로 무제한 호출 가능한 LLM 프록시**다.

- `openaiRouter.ts:8` — authMiddleware만 통과 (anon → `userId="anon"`으로 통과됨)
- `openaiController.getQTcontent` — 호출자 검사 없음
- anon key는 웹 번들에 공개된 값 → 외부 스크립트로 OpenAI 비용을 무제한 태울 수 있음
- bible(#33)에서 해결한 것과 동일 유형. **인프라(`llm_usage_log`, `LlmUsageRepository`)는 이미 있음**

## 계획

### 1. AI 클라이언트 통합 (부채 해소를 같은 PR에서)

- `openai/QuietTimeService.ts`가 쓰는 자체 `openai/openaiClient.ts`(`generateText`)를 제거하고 `_shared/ai/OpenaiClient`(`chat` + json schema + usage 반환)로 전환
- QT 프롬프트의 "JSON 형식 예시"를 `openai/qtSchema.ts`(신규)의 responseSchema로 구조화 — bible의 `bibleSchema.ts` 패턴 그대로
- 효과: 중복 클라이언트 제거 + 토큰 사용량 로깅이 공짜로 따라옴

### 2. 한도 적용 (bible과 동일 패턴)

- `QuietTimeService.getQTcontent(userId, content)`:
  - `llmUsageRepository.countToday(userId, "qt")` → 한도 초과 시 `DailyLimitExceededError`(bible 것을 `_shared`로 승격하지 않고 QT용을 자체 정의 — 정책은 피처별 원칙)
  - LLM 호출 전 insert(`feature: "qt"`, metadata `{}`) → 호출 후 토큰 update
- `openaiController.getQTcontent`: `userId === "anon"` → 401 `LOGIN_REQUIRED`, 한도 초과 → 429 `DAILY_LIMIT_EXCEEDED`
- 한도 env: `QT_DAILY_LIMIT` (기본값 10 — QT는 조회성이라 말씀카드보다 관대하게. **수치 확정 필요**)
- `llm_usage_log.metadata` 키 규율 문서에 `qt: {}` 추가 (PrayU-web/docs/bible-card-finishing-plan.md 1장)

### 3. PrayU-web 짝 PR

- `src/apis/openai.ts` `createQT`: anon key → 세션 토큰 전송, 401/429 errorCode 처리 (bible `searchBible`과 동일 패턴)
- 호출부(`baseStore.ts`)에서 한도 소진 시 안내 처리

## 미확정 (사람 결정 필요)

- [ ] **`/qt` 페이지가 비로그인 접근 가능한 공개 기능인지** — 로그인 필수로 바꾸면 UX 변화. 비로그인 유지가 필요하면 개인 쿼터 대신 다른 통제(IP 기반 등, 복잡도 상승)가 필요해 결정이 선행돼야 함. 기본안: 로그인 필수
- [ ] `QT_DAILY_LIMIT` 수치 (기본안 10회/일)

## 배포 순서·영향

1. Api PR merge → staging: **구버전 웹의 QT가 401로 막힘** (bible 때와 동일 — web 짝 PR 시점 인접 필수)
2. web 짝 PR (Api release 이후 merge)

## 검증

- 로컬: anon → 401 / 세션 토큰 → 200 + `llm_usage_log`에 `feature='qt'` + 토큰 기록 / 한도 소진 → 429 (LLM 미호출)
- QT 응답 스키마가 기존 웹 파싱(`QTData` 타입)과 호환되는지 회귀 확인
