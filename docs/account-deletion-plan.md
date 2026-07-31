# 회원 탈퇴 — 소프트 삭제 전환 계획

## 문제

`api/users` 의 `deleteUser()` 는 `supabase.auth.admin.deleteUser(userId)`(하드 삭제)만 호출한다.
`profiles_id_fkey` 가 **NO ACTION** 이라 `profiles` 행이 있는 한 **항상 실패**하고, 모든 사용자에게 `profiles` 행이 있다.

```
23503: update or delete on table "users" violates foreign key constraint "profiles_id_fkey"
```

그런데 web(`SettingDialog`)은 **반환값을 확인하지 않고** 바로 로그아웃·홈 이동한다.

```ts
await deleteUser(userId);   // 실패해도 그냥 진행
signOut();
```

→ **사용자는 탈퇴됐다고 믿지만 계정과 데이터가 그대로 남아 있다.** 다시 로그인하면 복구된다.
안내 문구는 "PrayU 의 모든 데이터가 삭제됩니다" 라고 약속하고 있다.

## 결정 (2026-07-31)

| 항목 | 결정 |
|---|---|
| 방식 | **소프트 삭제** — 계정을 못 쓰게 만들고 **탈퇴로 표시**한다. 데이터는 지우지 않는다 |
| 그룹장 | **다른 멤버에게 이양** |
| 완전 삭제 | 이번 범위 밖. 나중에 **배치로 하드 삭제**를 돌린다 |

기도 기록을 지우면 **함께 기도한 사람들의 화면에서도 사라진다.** 남을 위해 기도한 흔적이
상대 쪽에서 통째로 없어지는 것은 서비스 성격상 손실이 크다고 봤다.
프로필도 지우지 않는다 — 문의 대응·이상 행위 추적 같은 운영이 남아 있고, 지우면 되돌릴 수 없다.
**노출을 막는 것과 파기하는 것은 다른 문제**이며, 파기는 배치 하드 삭제가 맡는다.

## GoTrue 소프트 삭제가 실제로 하는 일 — 로컬 실측

`DELETE /auth/v1/admin/users/{id}` + `{"should_soft_delete": true}` 를 로컬 계정에 실행한 결과다.
추측이 아니라 **실행 후 DB 를 직접 대조**했다.

| 대상 | 결과 |
|---|---|
| 호출 자체 | **200** — `profiles` FK 가 있어도 실패하지 않는다 (하드 삭제와 결정적 차이) |
| `auth.users.email` | **익명화** (임의 해시 문자열로 치환) |
| `auth.users.deleted_at` | 설정됨 |
| `encrypted_password` | **NULL** |
| `raw_user_meta_data` | 비워짐 (`full_name` 사라짐) |
| `auth.identities` | 행은 남지만 **`provider_id` 익명화 · `identity_data` 를 `{}` 로** |
| `auth.sessions` | **0건** (전부 정리) |
| 재로그인 | **실패** (`invalid_credentials`) |
| `public.profiles` | **그대로.** `full_name`·`avatar_url` 남아 있다 |
| `pray_card` 등 콘텐츠 | 그대로 |

두 가지가 중요하다.

1. **identity 가 익명화되므로 카카오로 다시 로그인해도 같은 계정으로 못 돌아온다** — 새 계정이 생긴다.
   소프트 삭제가 "계정을 못 쓰게 만든다"는 요건을 실제로 충족한다.
2. **GoTrue 는 `public.profiles` 를 건드리지 않는다.** 그래서 탈퇴 여부를 나타낼 표시(`deleted_at`)를 우리가 남겨야 하고,
   화면에서 가리는 일도 우리 몫이다.

## 설계

### 순서 — 앱 데이터 먼저, auth 는 마지막

```
1. 그룹장인 그룹 → 이양
2. 모든 그룹에서 나가기 (member.deleted_at)
3. profiles 탈퇴 표시 (deleted_at)
4. auth 소프트 삭제  ← 마지막
```

**auth 를 마지막에 두는 이유**: 여기서 세션이 끊긴다. 먼저 하면 이후 단계가 실패했을 때
사용자는 로그인도 못 하는데 그룹장은 그대로인 어중간한 상태가 되고, 스스로 재시도할 방법이 없다.
반대 순서면 실패해도 사용자가 다시 시도할 수 있다.

**각 단계는 재실행 안전해야 한다** — 중간 실패 후 다시 눌렀을 때 정상 완료되도록.

### 그룹장 이양 규칙

`group.user_id` 가 그룹장이다.

- 탈퇴자가 그룹장인 그룹마다, 남은 멤버(`deleted_at is null`) 중 **가장 먼저 들어온 사람**(`member.created_at` 최소)에게 이양
- 남은 멤버가 없으면 **그룹을 소프트 삭제**(`group.deleted_at`)
- 이양 사실을 새 그룹장에게 알릴지는 이번 범위 밖 (알림 설계가 별도로 필요)

### `profiles` 는 `deleted_at` 만 세팅한다 (2026-07-31 재결정)

처음에는 이름·아바타·kakao_id 등을 전부 비우려 했다. **철회했다.**

- 탈퇴 뒤에도 문의 대응·이상 행위 추적 같은 운영이 필요한데, 지워버리면 되돌릴 방법이 없다
- 노출을 막는 것과 데이터를 파기하는 것은 **다른 문제**다. 노출은 표시 계층이 `deleted_at` 을 보고 막으면 된다
- `fcm_token`·`push_notification` 을 비울 실질적 이유도 없었다 — **함수 어디서도 읽지 않는다**
  (푸시는 OneSignal 경로). 비워도 동작이 달라지지 않는다

따라서 이 단계가 하는 일은 `deleted_at` 을 세우는 것 하나다.

`deleted_at` 이 쓰이는 곳:

| 쓰임 | 내용 |
|---|---|
| **표시** | web 이 이 값을 보고 이름을 "(탈퇴유저)", 아바타를 기본 이미지로 바꾼다 |
| **배치** | 나중에 돌릴 하드 삭제의 대상 선별 |
| **구분** | 재가입한 새 계정(별도 행)과 구분 |

**개인정보 파기는 이 단계의 책임이 아니다** — 배치 하드 삭제가 진다. 아래 "한계" 참조.

## 파일 매니페스트

### PrayU-Api

| 파일 | 내용 |
|---|---|
| `supabase/migrations/<ts>_add_profiles_deleted_at.sql` (신규) | `profiles.deleted_at timestamptz` (널 허용). 배치 조회용 부분 인덱스 |
| `supabase/functions/api/users/userService.ts` (신규) | 탈퇴 절차 오케스트레이션. `softDeleteUser(userId)` — 위 4단계를 순서대로 수행하고 단계별 실패를 구분해 돌려준다 |
| `supabase/functions/api/users/userRepository.ts` (수정) | 데이터 조작만 담당: `transferGroupLeadership` · `leaveAllGroups` · `markProfileDeleted` · `softDeleteAuthUser`. 기존 `deleteUser`(하드) 제거 |
| `supabase/functions/api/users/userController.ts` (수정) | 서비스 호출로 교체, 실패 시 상태코드 구분 |

**새 파일을 만드는 이유**: 탈퇴는 순서가 있는 다단계 절차이고 중간 실패 처리가 필요하다.
리포지토리(데이터 조작)에 두면 도메인 순서 규칙이 데이터 계층에 섞이고,
컨트롤러에 두면 권한 검사와 도메인 로직이 한 함수에 뭉친다. `bible` 함수가 이미 같은 구조다.

### PrayU-web

| 파일 | 내용 |
|---|---|
| `src/components/profile/SettingDialog.tsx` (수정) | `deleteUser` **반환값 확인** — 실패하면 로그아웃하지 않고 안내한다. 지금은 실패해도 성공처럼 보인다 |
| `src/lib/profileName.ts` (신규) | `deleted_at` 을 보고 이름을 "(탈퇴유저)", 아바타를 기본 이미지로. **가리는 일은 표시 계층의 몫이다** |
| `src/apis/{group,prayCard,member}.ts` (수정) | 중첩 `profiles` select 에 `deleted_at` 추가 |
| `src/apis/user.ts` (수정) | 클라이언트가 하던 삭제 절차 제거 — 서버가 절차를 소유한다 |
| 안내 문구 | "모든 데이터가 삭제됩니다" 는 소프트 삭제 후 **사실이 아니다** |

## 검증

- 로컬 시드 계정으로 탈퇴 → `profiles.deleted_at` 설정, `auth.users` 익명화, 재로그인 실패
- 그룹장 계정으로 탈퇴 → 남은 멤버 중 가장 오래된 사람이 새 그룹장, 멤버가 없으면 그룹 소프트 삭제
- **다른 사람 화면 회귀** — 탈퇴자가 쓴 기도카드·기도 기록이 그대로 보이고, 이름이 `(탈퇴유저)`·아바타가 기본 이미지로 바뀌는지
- 중간 실패 재시도 — 두 번 눌러도 정상 완료되는지

## 한계 — 이번에 하지 않는 것

- 🔴 **개인정보가 실제로 파기되지 않는다.** 이름·프로필 사진·`kakao_id`·기도제목 본문이 모두 남는다.
  이 단계는 **계정을 못 쓰게 만들고 화면에서 가리는 것**까지다. 파기는 **배치 하드 삭제**의 몫이며,
  그때까지는 개인정보 삭제 요청에 대한 완전한 답이 아니다 — 의도적으로 미뤄 둔 상태다
- **RLS 가 `select using(true)`** 라, 가리는 것은 화면뿐이고 PostgREST 를 직접 부르면 탈퇴자 정보도 읽힌다.
  탈퇴 건에 국한된 문제가 아니라 전체 RLS 정비(security-backlog 1번)에 걸린 사안이다
- 배치 하드 삭제 자체 — FK NO ACTION 을 어떻게 풀지(CASCADE 전환 vs 순차 삭제) 별도 판단
- 이양 알림 — 새 그룹장에게 알리는 흐름
- 이미 탈퇴를 시도했던 사용자(하드 삭제 실패로 계정이 남은 사람) 정리
