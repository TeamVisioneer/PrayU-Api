# 개발용 계정·더미 데이터 계획

## 문제

서비스 로그인이 **카카오 OAuth 전용**이라(+애플), 로그인 뒤 화면을 사람이 아닌 도구가 열 수 없다.
그 결과:

- AI가 로그인 필요한 화면을 **확인·캡처하지 못한다** — 공지 스크린샷, UI 회귀 확인이 전부 사람 몫이 된다
- 로컬에 데이터가 없어 그룹·기도카드 화면을 빈 상태로만 보게 된다

앞으로도 반복될 상황이라 **로컬 전용 계정과 더미 데이터**를 갖춘다.

## 검증 완료 (2026-07-28)

가능성 확인을 먼저 했다. 아래는 실제로 로컬에서 성공한 결과다.

| 확인 | 결과 |
|---|---|
| 로컬 이메일 가입 | `config.toml` 에 `[auth.email] enable_signup = true`, `enable_confirmations = false` — **인증 메일 없이 즉시 사용 가능** |
| 계정 생성 | GoTrue admin API(`POST /auth/v1/admin/users`, service_role 키)로 생성 성공 |
| `profiles` 자동 생성 | `handle_new_user()` 트리거가 `user_metadata`의 `full_name`·`avatar_url`을 그대로 복사 — **추가 작업 불필요** |
| 웹 로그인 | 개발 서버에서 `signInWithPassword` 로 세션 획득 → **QT 페이지가 로그인 벽 없이 열림** |
| 원격 유출 위험 | **없음.** 배포 워크플로우는 `db push`(마이그레이션) + `functions deploy` 뿐이고 **seed 는 원격에 나가지 않는다** |

## 설계

### 왜 `seed.sql`이 아니라 별도 스크립트인가

1. `seed.sql`은 CI(`supabase-migration-check`)의 `db reset`에서도 재생된다. 검증 대상은 **스키마와 성경 데이터**이지 더미 계정이 아니다
2. `auth.users`에 SQL로 직접 INSERT 하는 방식은 GoTrue 스키마·해시 방식이 바뀌면 조용히 깨진다. **admin API를 쓰는 편이 정공법**이다
3. 더미 데이터는 **원할 때만** 넣는 게 맞다 — 빈 상태 UI도 확인 대상이다

### 파일 매니페스트

#### PrayU-Api (신규)

| 파일 | 내용 |
|---|---|
| `scripts/seed-dev.sh` | 로컬 스택 전용. ① `supabase status`에서 service_role 키를 읽고 ② admin API로 계정 3개 생성(이미 있으면 건너뛴다) ③ `supabase/dev/seed-dev.sql`을 psql로 실행. **스택이 떠 있지 않으면 안내하고 종료** |
| `supabase/dev/seed-dev.sql` | 그룹 1개 + 멤버 3명 + 기도카드 3장 + 기도 반응 + 말씀카드 1장. 계정은 이메일(`%@prayu.local`)로 조회해 참조하고, **재실행해도 중복 생성되지 않게** 한다(`on conflict do nothing` 또는 존재 확인) |

계정은 `dev1@prayu.local` ~ `dev3@prayu.local`, 공통 비밀번호. **로컬 전용**이고 seed가 원격에 나가지 않으므로
비밀번호가 레포에 있어도 무방하다 — 다만 스크립트 첫 줄에 그 사실을 명시한다.

#### PrayU-web (신규/수정)

| 파일 | 내용 |
|---|---|
| `src/pages/DevLoginPage.tsx` (신규) | 이메일·비밀번호 입력 + "시드 계정으로 로그인" 버튼. `signInWithPassword` 후 홈으로 이동 |
| `src/App.tsx` (수정) | `import.meta.env.DEV`일 때만 `/dev/login` 라우트를 등록한다. Vite가 상수를 정적 치환하므로 **prod·staging 번들에서 통째로 빠진다** |

**인증 흐름은 건드리지 않는다** — 카카오·애플 경로와 `PrivateRoute`는 그대로다. 추가되는 것은 개발 빌드에만 존재하는 진입점 하나다.

### 검증 기준

1. `npm run build` 후 산출 번들에 `dev/login` 문자열이 **없을 것** (prod 번들 제외 확인)
2. `./scripts/seed-dev.sh` 두 번 연속 실행해도 데이터가 중복되지 않을 것
3. `supabase db reset` 후 스크립트를 다시 돌리면 같은 상태가 될 것
4. 시드 계정으로 로그인해 그룹·기도카드 화면이 **빈 상태가 아닌 채로** 보일 것

## 한계 — 더미 데이터는 실제 데이터가 아니다

공지 스크린샷을 로컬에서 찍을 수 있게 되지만, **화면의 설득력은 더미 데이터의 질에 달린다**.
이름·기도제목이 어색하면 스크린샷도 어색하다. 실제 서비스 느낌이 중요한 컷은 여전히 사람이 실기기에서 찍는 편이 낫다.

또한 이 계정은 **로컬에만** 존재한다. staging·prod 화면 확인은 여전히 사람이 카카오로 로그인해야 한다.
(원격에 개발 계정을 두는 것은 로그인 우회 경로를 만드는 일이라 하지 않는다.)

## 정리는 `db reset` 으로 한다 — 계정 삭제는 지금 동작하지 않는다

시드 계정을 지우려다 발견한 것: `auth.users` 하드 삭제는 `profiles_id_fkey`(NO ACTION)에 막혀 실패한다.
따라서 **seed 스크립트에 계정 삭제 경로를 만들지 않는다** — 초기화는 `supabase db reset` 이 담당한다.

이건 시드만의 문제가 아니라 **회원 탈퇴 기능 자체가 같은 벽에 막혀 있다**는 뜻이다. 별도 항목으로 [backlog.md](../backlog.md) 에 올렸다.

## 후속

- 시드 데이터의 폭을 어디까지 넓힐지는 필요할 때 늘린다(감사카드·알림·프리미엄 상태 등). 처음부터 다 만들지 않는다
- 이 계획은 [PrayU-web/docs/notice-authoring-plan.md](../../../PrayU-web/docs/guides/notice-authoring-plan.md)의 "캡처" 단계를 실행 가능하게 만드는 전제다
