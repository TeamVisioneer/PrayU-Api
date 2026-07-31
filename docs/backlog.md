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

### 성경 본문 원본 동기화 — staging 반영 완료, prod 대기
[#44](https://github.com/TeamVisioneer/PrayU-Api/pull/44) merged (2026-07-28) · 짝 PR [PrayU-Web#475](https://github.com/TeamVisioneer/PrayU-Web/pull/475) merged · 상세: [bible-sync-plan.md](bible-sync-plan.md)

**staging DB 반영 확인** (2026-07-28): 31,138 → **31,102행** · 신 15:5 등 누락 절 복구 · `paragraph=0` **0행**.
staging web 번들에 표시 정리(`/○/g`) 포함 확인.

- [x] ~~**staging UI 확인**~~ — 2026-07-31 완료. `○`·`<구역제목>` 없음, 누락 절 복구 확인
- [x] ~~⚠️ prod release 순서가 평소와 반대: web 먼저 → Api~~ → **철회. 평소 규칙대로 Api 먼저 → web** (2026-07-31 결정)
  - 당초 근거: Api 가 먼저 나가면 본문에 들어온 `○` 가 **구버전 web 에 그대로 노출**된다
  - 뒤집은 이유: R2 업로드가 **정반대 순서(Api 먼저)** 를 요구하고, 어기면 업로드가 500 이다.
    `○` 노출은 표시 문제이고 500 은 사용자가 카드를 못 만드는 고장이다 — **용인할 리스크의 급이 다르다**
  - 예외를 없애면 기억할 것도 없어진다. 일반적인 순서와 같다
- [ ] `supabase/tests/*`(원본 대조·갱신 스크립트) 커밋 여부 결정 — 현재 로컬에만 있다. 이번 조사에 실제로 쓴 도구라 다음에도 필요할 가능성이 높다
- [ ] **재발 방지**: seed 를 prod 덤프로 갱신할 때 원본 대조본을 덮지 않도록 주의. 다음 갱신 시 `bible` 테이블은 seed 쪽을 진실 원천으로 둔다

### 🔴 회원 탈퇴가 실제로 삭제되지 않는다 — 로컬 실증

개발 계정 실험 중 발견. `api/users` 의 `deleteUser()` 는 `supabase.auth.admin.deleteUser(userId)`(하드 삭제)만 호출하는데,
`profiles_id_fkey` 가 **NO ACTION** 이라 `profiles` 행이 있는 한 **항상 실패**한다. 모든 사용자에게 `profiles` 행이 있다.

```
23503: update or delete on table "users" violates foreign key constraint "profiles_id_fkey" on table "profiles"
```

- FK 는 [initial_baseline.sql:564](../supabase/migrations/20260718075321_initial_baseline.sql) 정의 그대로이므로 **prod 도 동일**하다
- 웹(`SettingDialog`)은 `await deleteUser(userId)` 의 **반환값을 확인하지 않고** 바로 로그아웃·홈 이동한다 → 사용자는 탈퇴됐다고 믿는다
- `profiles` 를 참조하는 FK 중 `bible_card`·`group_union`·`llm_usage_log`·`share_reward_log` 도 NO ACTION 이라, `profiles` 행부터 지우려 해도 같은 벽에 막힌다

**개인정보 삭제 요청 미이행**에 해당할 수 있어 우선순위가 높다. 조치 방향은 결정이 필요하다:
FK 를 CASCADE 로 바꿀지, 함수에서 순서대로 지울지, 소프트 삭제(`should_soft_delete`)로 갈지 —
그룹장이 탈퇴하면 그룹은 어떻게 되는지 같은 도메인 판단이 함께 필요하다.

**결정 (2026-07-31): 소프트 삭제.** 계정을 못 쓰게 만들고 개인 식별정보를 지우되 기도 기록은 남긴다 —
지우면 **함께 기도한 상대방 화면에서도 사라진다.** 그룹장은 **다른 멤버에게 이양**한다.
완전 삭제는 나중에 **배치 하드 삭제**로 대응한다. 상세: [account-deletion-plan.md](account-deletion-plan.md)

- [x] ~~Api — `profiles.deleted_at` 마이그레이션 + 소프트 삭제 절차~~ — [#56](https://github.com/TeamVisioneer/PrayU-Api/pull/56)
- [ ] web 짝: 탈퇴 실패를 사용자에게 알리고, `deleted_at` 인 프로필은 **"(탈퇴유저)"** 로 표시
- [ ] **배치 하드 삭제** — `deleted_at` 기준 선별. FK NO ACTION 을 어떻게 풀지(CASCADE 전환 vs 순차 삭제) 판단 필요.
      기도제목 본문이 남는 것은 소프트 삭제의 본질적 한계라 여기서 해소한다
- [ ] **이미 탈퇴를 시도했던 사용자 정리** — 하드 삭제 실패로 계정이 그대로 남은 사람들. prod 에 몇 명인지 확인 필요
- [ ] 이양 알림 — 새 그룹장에게 알리는 흐름 (알림 설계가 따로 필요해 이번 범위 밖)

### 파일 스토리지 R2 이전 — 완료 (prod 는 release 시 반영)
계획: [storage-r2-plan.md](storage-r2-plan.md) · 짝 작업: `../PrayU-web/docs/backlog.md`

Supabase Storage 무료 한도 1GB. **신규 업로드만 R2 로** 돌려 이전 비용을 없앤다.

- [x] ~~0단계 · 업로드 전 리사이즈~~ — [PrayU-Web#488](https://github.com/TeamVisioneer/PrayU-Web/pull/488). 폰 사진 6.75MB → 484KB
- [x] ~~**Api** — `image_key` 마이그레이션 + 서명 URL 엔드포인트~~ — [#50](https://github.com/TeamVisioneer/PrayU-Api/pull/50)
- [x] ~~**web** — 경로(key) 저장 + `assetUrl()`, 업로드 전환~~ — [PrayU-Web#489](https://github.com/TeamVisioneer/PrayU-Web/pull/489)
- [x] ~~R2 버킷 2개·API 토큰·`r2.dev` 공개 설정·CORS·시크릿 4개(staging·prod)~~ — 2026-07-31 완료.
      시크릿은 해시 대조로 값까지 검증했고, 로컬에서 staging 버킷에 실제 업로드·조회까지 확인
- [x] ~~web 환경변수 `VITE_STORAGE_BASE_URL`~~ — staging 등록·재배포·동작 확인 완료, prod 등록 완료(release 때 반영)

**이 작업은 끝났다.** 남은 것은 prod release 뿐이며, 그때 R2 가 prod 에서도 켜진다.
기존 Supabase 파일은 그대로 서빙되고, 옮길지 여부는 별도 판단 (계획서의 "기존 이미지는 이번에 건드리지 않는다" 절).

### `premium_expired_at` 자기부여 차단 — 사용자 판단 대기
사용자가 자기 프로필의 `premium_expired_at`을 임의 설정해 **프리미엄(그룹 무제한)을 무료로 얻을 수 있다** (로컬 실증 완료).
`is_admin`과 같은 원인(컬럼을 제한하지 않는 UPDATE 정책)이며, 조치도 같다 — 컬럼 단위 UPDATE 권한 회수.
지금 못 막는 이유: 어드민 화면이 **클라이언트에서 직접** 이 컬럼에 쓴다 → 잠그면 어드민 기능이 먼저 깨진다.
→ PR C(admin edge function)를 폐기했으므로, 막기로 하면 **어드민 프리미엄 설정만을 위한 최소 서버 경로**를 따로 만들고 컬럼 권한을 회수한다. 상세: [security-backlog.md](../../PrayU-web/docs/security-backlog.md) 8번

### 함수 시크릿을 CI 로 주입 — 검토
지금 Edge Function 시크릿(`OPENAI_SECRET_KEY`·`KAKAO_ADMIN_KEY`·`R2_*` 등)은 **대시보드에 사람이 손으로** 넣는다.
staging/prod 에 뭔가 반영되는 경로 중 **유일하게 CI 를 안 거치는 예외**이고, 그래서 두 문제가 있다 —
레포만 봐서는 어떤 시크릿이 필요한지 알 수 없고(코드의 `Deno.env.get` 을 다 찾아야 한다),
staging 에 넣고 prod 에 빠뜨리면 **release 후 500 이 날 때** 알게 된다.

배포 워크플로에 `supabase secrets set --project-ref $PROJECT_ID --env-file` 단계를 넣으면
**이름은 git(워크플로 파일)에, 값은 GitHub Secrets 에** 남고 두 환경이 같은 목록을 갖는다.

- [ ] **선행 확인**: `supabase secrets set` 이 지정한 것만 갱신하는지, 나머지를 지우는지 staging 에서 실증.
      지운다면 워크플로에 **모든** 시크릿을 나열해야 한다 (누락 시 기존 시크릿이 날아간다)
- [ ] 배포 워크플로 수정이라 **사람 확인 후 진행**. 시크릿 보관처가 하나 늘어나는 대가(로테이션 시 GitHub 도 갱신)를 감수할지 판단 필요
- 판단 보류 근거: 시크릿이 4~6개 수준이면 사람이 관리 가능한 규모다. 개수가 늘거나 환경이 추가되면 그때 한다

### 기타
- [ ] QT 응답 토큰을 `llm_usage_log`에 기록 (현재 호출 수만 차감)
- [ ] `deno.lock` 커밋 여부 결정
- [ ] 어드민 통계가 느려지면: 인덱스 → 기간 축소 → **야간 롤업**(pg_cron이 `admin` 함수 호출 → `daily_stats` 적재, 로직은 앱에 유지)

## 운영 조작 대기 (사람이 직접)

- [ ] **prod release 순서는 평소대로 Api 먼저 → web** (성경 동기화 예외는 철회 — 위 절 참조).
      Api release 후 web 태그를 발행하면 R2 도 함께 켜진다
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
| 2026-07-31 | 신규 이미지 업로드를 Cloudflare R2 로 — `image_key` 컬럼 + 서명 URL 엔드포인트, 경로만 저장 | #50, PrayU-Web#489 |
| 2026-07-31 | 원격 쓰기·merge·push 를 `.claude/settings.json` 권한 규칙으로 차단 | #53 |
| 2026-07-28 | 개발용 계정·더미 데이터 (`seed-dev.sh` + `dev/seed-dev.sql`) — 로컬 이메일 로그인으로 로그인 뒤 화면 확인 가능 | #46 |
| 2026-07-28 | 성경 본문을 원본(goodtv)과 동기화 — 5,538행 교정·누락 절 14행 추가·유령 행 50행 삭제, seed 재생성 | #44 |
| 2026-07-27 | 공지 구조 정리 — `images`(URL 배열) + `body`(마크다운), `slides` 제거 및 데이터 이관 | #41 |
| 2026-07-27 | 사용 로그(`llm_usage_log`·`share_reward_log`) 읽기 개방 — 어드민 집계용 | #40 |
| 2026-07-27 | `is_admin` + `notice` 테이블, `is_admin` 자기부여 차단, 공지 노출 조건을 앱으로 이동 | #39 |
| 2026-07-27 | 카카오 공유 보상 — 웹훅 수신 + 말씀카드 동적 한도 | #38 |
| 2026-07-26 | QT LLM 일일 한도(10회) | #35 |
| 2026-07-26 | authMiddleware JWT 서명 검증 | #36 |
| 2026-07-26 | `POST /api/users`·`push` 함수 제거 | #37 |
| 2026-07-25 | `llm_usage_log` 테이블 + 말씀카드 일일 한도 | #33, #34 |
