# PrayU-Api 백로그

이 레포(스키마·Edge Functions·운영 설정)에서 해야 할 일의 **원본 목록**.
세션 기록은 휘발되므로 **여기에 없으면 없는 것**이다.

관련 백로그: [PrayU-web/docs/backlog.md](../../PrayU-web/docs/backlog.md) · `PrayU-App/docs/backlog.md`
보안 상세: [PrayU-web/docs/security-backlog.md](../../PrayU-web/docs/security-backlog.md) · 운영 설정 대장: [supabase-migration-plan.md](../../PrayU-web/docs/supabase-migration-plan.md)

> **기록 규칙**: 작업 중 후속 이슈를 발견하면 그 자리에서 여기에 추가한다(PR 코멘트로만 남기지 않는다).
> 상세 설계는 별도 `docs/*-plan.md`로 만들고 여기서는 한 줄 + 링크. 완료 시 삭제하지 말고 "완료"로 옮긴다.

---

## 진행 중 — 어드민 개편

계획: [PrayU-web/docs/admin-revamp-plan.md](../../PrayU-web/docs/admin-revamp-plan.md) (4개 PR, merge는 **Api 먼저 → web**)

**어드민 개편 Api 작업은 모두 merge 완료** (#39 · #40 · #41 — 아래 "완료" 절 참조).
- [x] ~~**PR C** `admin` edge function~~ — **폐기**. 대시보드가 읽을 테이블(`profiles`/`group`/`member`/`pray`/`pray_card`)이 이미 `select using(true)`라 함수를 세워도 실질 보호가 0이고 배포 대상만 늘어난다. 대신 사용 로그 읽기만 개방 → [#40](https://github.com/TeamVisioneer/PrayU-Api/pull/40)
- [ ] **RLS 전면 정비 시 재검토** — security-backlog 1번으로 `group`/`member`/`pray`/`pray_card`가 잠기면 web 대시보드의 클라이언트 조회가 깨진다. 그때 관리자 select 정책 추가 또는 서버 경유로 전환 판단

## 다음 작업

### 성경 본문 원본 동기화 — 배포 대기
마이그레이션·seed 준비 완료(불일치 0건 검증). 상세: [bible-sync-plan.md](bible-sync-plan.md)
- [ ] **web 짝 PR 선행/동시 필요** — 원본의 `○`(문단 표시)를 DB에 보존했으므로, 프론트가 표시할 때 걷어내지 않으면 사용자에게 `○`가 그대로 보인다. `../PrayU-web/docs/backlog.md` 참조
- [ ] `supabase/tests/*`(원본 대조·갱신 스크립트) 커밋 여부 결정 — 현재 로컬에만 있다. 이번 조사에 실제로 쓴 도구라 다음에도 필요할 가능성이 높다

### `premium_expired_at` 자기부여 차단 — 사용자 판단 대기
사용자가 자기 프로필의 `premium_expired_at`을 임의 설정해 **프리미엄(그룹 무제한)을 무료로 얻을 수 있다** (로컬 실증 완료).
`is_admin`과 같은 원인(컬럼을 제한하지 않는 UPDATE 정책)이며, 조치도 같다 — 컬럼 단위 UPDATE 권한 회수.
지금 못 막는 이유: 어드민 화면이 **클라이언트에서 직접** 이 컬럼에 쓴다 → 잠그면 어드민 기능이 먼저 깨진다.
→ PR C(admin edge function)를 폐기했으므로, 막기로 하면 **어드민 프리미엄 설정만을 위한 최소 서버 경로**를 따로 만들고 컬럼 권한을 회수한다. 상세: [security-backlog.md](../../PrayU-web/docs/security-backlog.md) 8번

### 기타
- [ ] QT 응답 토큰을 `llm_usage_log`에 기록 (현재 호출 수만 차감)
- [ ] `deno.lock` 커밋 여부 결정
- [ ] 어드민 통계가 느려지면: 인덱스 → 기간 축소 → **야간 롤업**(pg_cron이 `admin` 함수 호출 → `daily_stats` 적재, 로직은 앱에 유지)

## 운영 조작 대기 (사람이 직접)

- [ ] **카카오 콘솔 웹훅 등록(prod)** — Api release 후 `https://qggewtakkrwcclyxtxnz.supabase.co/functions/v1/kakao-webhook`, 메서드 **POST**. staging은 등록 완료
- [ ] **`KAKAO_ADMIN_KEY` 시크릿 확인** — 각 환경 시크릿이 해당 카카오 앱 어드민 키와 일치하는지
- [ ] **카카오 [플랫폼] > [Web] 사이트 도메인** — prod 앱에 서비스 도메인 등록 확인 (staging에서 4019 `domain mismatched`로 겪은 항목)
- [ ] **prod 대시보드에서 `push` 함수 수동 삭제** — 코드에서는 제거됨(web#37 짝 작업)
- [ ] 🔴 **운영 관리자 계정에 `is_admin = true` 설정** — **prod release 직후 반드시.** 안 하면 `/admin`이 아무도 못 들어간다(이메일 하드코딩을 걷어내고 이 값만 본다). staging은 2026-07-27 처리 완료
  ```sql
  update public.profiles p set is_admin = true
  from auth.users u where u.id = p.id and u.email = '<관리자 이메일>';
  ```
- [ ] **Supabase 커스텀 도메인 도입 여부 결정** (`staging-api.prayu.site` / `api.prayu.site`) — 유료 애드온 + CNAME/TXT + `supabase domains activate`. 도입 시 카카오 로그인 Redirect URI에 새 도메인 콜백 추가 필요

## 보안 (상세는 security-backlog.md)

- 🔴 8번 `premium_expired_at` 자기부여 (위 참조)
- 🔴 2번 Kakao client secret 프론트 노출 → 토큰 교환을 Edge Function으로
- 🔴 1번 RLS 전면 정비 (그룹 격리 부재 — 로그인만 하면 타 그룹 기도제목 조회 가능)
- ⚠️ 3번 service_role 키 로테이션 (prod `cron.job` 하드코딩과 동시 갱신 필요)
- 4번 어드민 권한 이메일 하드코딩 제거 (`profiles`의 `admin can update user profile` 정책)

## 완료

| 날짜 | 내용 | PR |
|---|---|---|
| 2026-07-27 | 공지 구조 정리 — `images`(URL 배열) + `body`(마크다운), `slides` 제거 및 데이터 이관 | #41 |
| 2026-07-27 | 사용 로그(`llm_usage_log`·`share_reward_log`) 읽기 개방 — 어드민 집계용 | #40 |
| 2026-07-27 | `is_admin` + `notice` 테이블, `is_admin` 자기부여 차단, 공지 노출 조건을 앱으로 이동 | #39 |
| 2026-07-27 | 카카오 공유 보상 — 웹훅 수신 + 말씀카드 동적 한도 | #38 |
| 2026-07-26 | QT LLM 일일 한도(10회) | #35 |
| 2026-07-26 | authMiddleware JWT 서명 검증 | #36 |
| 2026-07-26 | `POST /api/users`·`push` 함수 제거 | #37 |
| 2026-07-25 | `llm_usage_log` 테이블 + 말씀카드 일일 한도 | #33, #34 |
