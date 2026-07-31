# `premium_expired_at` 자기부여 차단 계획

security-backlog **8번**. v1.0.0 포함분.

## 구멍

`profiles` 의 컬럼 단위 UPDATE 권한 목록(#39 마이그레이션)에 `premium_expired_at` 이 **들어 있다**.

```sql
grant update ( ..., app_settings, premium_expired_at ) on profiles to authenticated;
```

로그인한 사용자가 PostgREST 로 자기 행의 `premium_expired_at` 을 임의 설정하면
**프리미엄(그룹 무제한)을 무료로 얻는다** (로컬 실증 완료 — security-backlog 8번).

`is_admin` 과 같은 원인이고 처방도 같다. 지금까지 못 막은 이유는 어드민 화면(`OperationsTab`)이
**클라이언트에서 직접** 이 컬럼에 쓰기 때문 — 잠그면 어드민 기능이 먼저 깨진다.
그래서 **최소 서버 경로를 먼저 만들고 → 컬럼 권한을 회수**한다 (backlog 의 기존 결정).

## 설계

### 1) 서버 경로 — `POST /api/admin/premium`

- 호출자 검사: `anon`·`service_role` → 401. **호출자의 `profiles.is_admin` 을 DB 에서 읽어** false 면 403
  (함수는 service role 클라이언트라 **함수 코드가 권한 검사의 전부** — CLAUDE.md 체크리스트 준수)
- body: `{ userId, premiumExpiredAt }` — 대상 uuid + ISO 일시 **또는 null(해제)**. 그 외 400
- service role 로 대상 행의 `premium_expired_at` 만 갱신

어드민 전용 라우터를 새로 만든다. 폐기했던 PR C(어드민 대시보드 백엔드 전체)와 달리
**이 한 가지 쓰기만** 담는다 — 대시보드 읽기는 지금대로 클라이언트 조회를 유지한다.

### 2) 컬럼 권한 회수 — 마이그레이션

#39 와 같은 패턴: `revoke update` 후 `premium_expired_at` 만 뺀 목록으로 재부여.

- `deleted_at`(soft delete, #56 추가)은 원래 목록에 없었고 클라이언트가 쓸 일이 없다 — **이번에도 넣지 않는다**
- 컬럼 추가 시 목록 갱신 필요하다는 기존 주석 유지

### 3) web 전환 — `OperationsTab`

- `updateProfile(id, { premium_expired_at })` → `apis/admin.ts` 의 새 함수 `setPremiumExpiry()` (엔드포인트 호출)
- **결과 확인 추가** — 지금은 실패해도 "설정했어요" toast 가 뜬다
- `updateProfilesParams` 타입에서 `premium_expired_at` 제거 — 재사용을 타입으로 차단.
  다른 `updateProfile` 호출자 전수 확인 결과 premium 을 넘기는 곳은 OperationsTab 뿐이다

읽기 경로(`AuthProvider` 의 플랜 판정)는 그대로 — 권한 회수는 쓰기만 막는다.

## 파일 매니페스트

### PrayU-Api (선행 PR)

| 파일 | 내용 |
|---|---|
| `supabase/migrations/<ts>_revoke_premium_update.sql` (신규) | revoke + `premium_expired_at` 제외 재부여 |
| `supabase/functions/api/admin/adminRouter.ts` (신규) | `use(authMiddleware)` + `post("/premium")` |
| `supabase/functions/api/admin/adminController.ts` (신규) | 401/403/400 검사, 입력 검증 |
| `supabase/functions/api/admin/adminRepository.ts` (신규) | `isAdmin(userId)` · `setPremiumExpiry(userId, at)` |
| `supabase/functions/api/index.ts` (수정) | `/admin` 라우트 등록 |
| `CLAUDE.md` (수정) | 전수 대장의 컬럼 권한 행에 premium 반영, "예정" 문단 제거 |

### PrayU-web (짝 PR)

| 파일 | 내용 |
|---|---|
| `src/apis/admin.ts` (수정) | `setPremiumExpiry(userId, premiumExpiredAt)` — 세션 토큰으로 엔드포인트 호출 |
| `src/apis/profiles.ts` (수정) | `updateProfilesParams` 에서 `premium_expired_at` 제거 |
| `src/pages/AdminPage/tabs/OperationsTab.tsx` (수정) | 새 함수 호출 + 실패 toast |

타입 재생성 불필요 — 권한 변경은 스키마 모양을 바꾸지 않는다.

**merge 순서: Api 먼저 → web.** 그 사이 staging 어드민의 프리미엄 설정 버튼만 잠깐 막힌다
(관리자 전용 화면이라 영향 범위가 사람 한 명이다).

## 검증 (로컬)

- `db reset` 재생 무오류
- **비어드민이 PostgREST 로 자기 premium 직접 UPDATE → 거부** (핵심 — 구멍이 실제로 닫혔는가)
- 비어드민의 기존 프로필 수정(이름 등) → 정상 (재부여 목록 누락 확인)
- 엔드포인트: 비어드민 403 · anon 401 · 어드민 설정 200 · null 해제 200 · 잘못된 날짜 400
- 어드민 UI 에서 설정/해제 → 목록 갱신 + 대상 계정 플랜 판정 반영

## 한계

- **그룹 수 한도 강제 자체가 클라이언트에 있다** (`GroupMenuBtn` 의 `VITE_MAX_GROUP_COUNT` 비교).
  이번 작업은 "프리미엄 위조"를 막을 뿐, 한도 검사를 우회한 직접 INSERT 는 **RLS 전면 정비(1번)** 사안이다
- `VITE_PREMIUM_PLAN_USERLIST` Vercel 환경변수는 코드에서 더 이상 안 읽는다 — 정리 후보 (사람 조작, backlog)
