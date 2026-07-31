# authMiddleware JWT 서명 검증 도입 계획

작성: 2026-07 / 상태: **초안 — 방향 확인 필요** / 우선순위: **2**

## 리스크

`_shared/authMiddleware.ts`는 JWT를 **서명 검증 없이 decode만** 한다 (`djwt decode`, L34 부근).

- 안전한 유일한 이유: Supabase 게이트웨이의 `verify_jwt`(배포 기본값 true)가 서명을 검증해줌
- 이 전제가 **어디에도 명시돼 있지 않음** — config.toml에 함수별 설정 부재. 누군가 함수 하나를 `verify_jwt=false`로 배포하거나 기본값이 바뀌면, **위조 JWT(임의 sub 클레임)로 모든 인증이 뚫림** (쿼터 우회, 타인 계정 삭제 등)
- 로컬 dev는 `--no-verify-jwt`라 이 위험이 평소 눈에 안 보임

## 계획

### 1. 미들웨어에서 서명 검증 직접 수행

`authMiddleware`의 decode를 auth 서버 위임 검증으로 교체:

```ts
// service_role 문자열 비교는 유지 (기존 웹훅/CI 호출자 호환)
if (jwt === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) { ... }

// anon key 문자열 비교로 anon 판별 유지 (역할별 허용은 각 라우트가 결정)
if (jwt === Deno.env.get("SUPABASE_ANON_KEY")) { c.set("userId", "anon"); ... }

// 사용자 토큰: 서명·만료를 auth 서버가 검증
const { data: { user }, error } = await supabase.auth.getUser(jwt);
if (error || !user) return 401;
c.set("userId", user.id);
```

- `auth.getUser(jwt)` 선택 이유: 프로젝트의 JWT 서명 방식(HS256/ES256)과 무관하게 안전하고, 시크릿을 함수에 둘 필요 없음
- 비용: 요청당 auth 서버 호출 1회 추가 — 함수 호출은 LLM·푸시 등 저빈도 작업이라 수용 (고빈도化 시 JWKS 로컬 검증으로 전환 여지, 이번 범위 아님)

### 2. config.toml에 전제 명시 (이중 안전망)

- 함수별 `[functions.<name>] verify_jwt = true`를 **명시적으로** 기록 — "게이트웨이 검증이 켜져 있어야 한다"는 전제를 코드베이스에 남김
- 단, 1번이 들어가면 게이트웨이가 꺼져도 미들웨어가 막으므로 진짜 안전망은 1번

### 3. 신규 엔드포인트 체크리스트 (CLAUDE.md에 추가)

함수는 전부 service role 클라이언트(RLS 우회)를 쓰므로 "함수 코드 = 권한 검사의 전부"다. 엔드포인트 추가 시:

- [ ] anon 허용 여부를 라우트에서 **명시적으로** 결정했는가 (기본: 거부)
- [ ] 자원 접근이 `c.get("userId")` 본인 것으로 제한되는가 (예: deleteUser는 self-only)
- [ ] 비용이 발생하는 호출(LLM 등)이면 `llm_usage_log` 한도를 걸었는가

## 호출자 인벤토리 & 영향 분석 (2026-07 전수 조사)

서명 검증은 **사용자 토큰 경로에만** 적용된다. 인프라 호출자(pg_cron 등)는 "사용자"가 아니므로 `auth.getUser` 대상이 아니라 **service_role 키 문자열 비교라는 별도 경로**로 인증하며, 이 경로는 그대로 유지된다 — 즉 인증 방식이 이원화된 구조: 사용자 = auth 서버 검증 / 인프라 = 공유 시크릿(현재는 service_role 키가 그 역할).

| 라우트 | 호출자 | 보내는 인증 | 검증 도입 후 | 영향 |
|---|---|---|---|---|
| `bible /bible` | 웹 | 세션 토큰 (#33부터) | getUser 검증 | 없음 |
| `openai /qt` | 웹 | anon key | anon 문자열 비교 통과 | 없음 (별도로 QT plan이 차단 예정) |
| `api /users` POST·DELETE | 웹 (DELETE만, 세션 토큰) | 세션 토큰 | getUser 검증 | 없음 |
| `api /churches` | 웹 | — (미들웨어 자체 없음) | 미들웨어 밖 | 없음 (공개 프록시 — 저위험 메모) |
| `onesignal /notifications`, `/users` | 웹 | **세션 토큰 (이미 사용 중)** | getUser 검증 | 없음 |
| `onesignal /notifications/reminder` | **prod pg_cron** (`net.http_post`) | **service_role JWT 하드코딩** | **문자열 비교 경로 유지 → 통과** | **없음** |
| `push` | 호출자 소멸 (fcm webhook 제거됨) | 인증 전무 (미들웨어 없음) | 무관 | 죽은 함수 — 제거 대상 (api-users-hardening-plan에 병합) |

### 인프라 호출자 관련 주의 (기존 백로그 3번과 결합)

- pg_cron에 하드코딩된 service_role JWT와 함수에 주입되는 `SUPABASE_SERVICE_ROLE_KEY`가 **같은 값이라는 전제** 위에서 동작한다. 이번 작업이 새로 만드는 리스크는 아니지만, **키 로테이션 시 cron.job 명령 동시 갱신** 없이는 리마인더가 죽는다 (security-backlog 3번에 기록됨)
- Supabase 신형 API 키(`sb_secret_…`)로 전환하는 날에는 키가 JWT가 아니게 되어 게이트웨이·문자열 비교 모두 재검토 필요 — 로테이션 작업 때 함께
- 장기 개선안: 인프라 호출자는 service_role 키 대신 **전용 시크릿 헤더**(예: `X-Cron-Secret`, Vault 보관)로 분리하면 cron에 DB 전권 키를 하드코딩할 필요 자체가 사라진다 — 백로그 3번의 Vault 방향과 결합해 진행. **이번 범위에서는 문자열 비교 유지(무변경)로 최소화**

### 부수 발견 (이번 범위 밖, 각 계획에 반영)

- `onesignal /notifications`(임의 userIds에 푸시 발송)가 anon 호출을 컨트롤러에서 차단하는지 확인 필요 — 웹은 이미 세션 토큰을 쓰므로 anon 거부로 강화해도 무영향일 가능성 큼
- `push` 함수: 인증이 전무하고 호출자(fcm webhook)가 제거된 죽은 함수인데 배포는 유지됨 — anon key만 있으면 게이트웨이를 넘어 FCM 발송 시도·notification 레코드 조작이 가능한 상태. 제거 대상

## 영향·배포

- 웹/앱 변경 없음 (정상 토큰은 그대로 통과). 단독 Api PR
- 기존 service_role 호출자(DB 웹훅, 리마인더 cron 등) — 문자열 비교 유지로 무영향
- 성능: onesignal/push 같은 트리거 함수도 미들웨어를 타는지 확인 후, service_role 경로는 getUser 호출 없이 조기 반환 유지

## 검증

- 로컬: 잘못된 시크릿으로 서명한 위조 JWT(sub=타인 id) → 401 확인 (현재 구조에서는 --no-verify-jwt 환경에서 통과되는 것을 먼저 시연 → 수정 후 차단 확인)
- 정상 세션 토큰 → 200 / 만료 토큰 → 401 / service_role → 통과
- staging 배포 후 웹 로그인 플로우 회귀 (bible·QT·유저 삭제)
