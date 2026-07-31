# PrayU-Api

PrayU 백엔드 — Supabase 마이그레이션·Edge Functions·seed의 주인. 워크스페이스 공통 규칙은 상위 `../CLAUDE.md` 참조.

## 작업 착수 규칙

- 🔴 **merge·main push 는 사용자가 그 메시지에서 시킬 때만.** 기본 범위는 브랜치 push + PR 생성까지다. 이전 메시지의 "머지해줘"는 그 PR 한정이며, 문서 전용 변경도 main 에 직접 커밋하지 않는다 (상세: `../CLAUDE.md`)
- **docs 먼저, 코드는 그 다음.** 피처/개선 작업 시작 시 코드부터 수정하지 않는다. 설계·계획 문서를 먼저 작성(또는 기존 문서 갱신)하고 방향 확인 후 구현한다. (웹 관련 문서는 `../PrayU-web/docs/` 참조)
- **[docs/backlog.md](docs/backlog.md)가 이 레포 작업 목록의 원본이다.** 세션 시작 시 먼저 읽고, 작업 중 발견한 후속 이슈는 그 자리에서 여기에 추가한다 (대화·PR 코멘트로만 남기지 않는다). 프론트 항목은 `../PrayU-web/docs/backlog.md`.

## 스키마 설계 원칙 — 로직은 앱에, DB에는 권한과 데이터만

- 집계·계산·노출 규칙 같은 **비즈니스 로직은 edge function(TS)** 에 둔다. RPC/트리거로 DB에 내려보내지 않는다 (디버깅·테스트·버전 관리가 앱과 분리되는 비용이 크다)
- **RLS는 "누가 어떤 행을 볼/쓸 수 있나"까지만** 표현한다. 조건에 상태·기간 같은 규칙이 들어가려 하면 앱 쿼리로 옮긴다
- 방어 대상은 **계정 탈취·권한 상승·시크릿 노출**. 초안 노출 수준의 정보는 감수한다 (`../PrayU-web/docs/security-backlog.md` 참조)

### DB에 로직이 있는 지점 — 전수 대장

원칙의 예외는 **여기에 적힌 것이 전부**다. 앱 코드만 읽어서는 보이지 않는 동작이므로,
디버깅 시 "앱에 없는데 값이 바뀐다" 싶으면 먼저 이 표를 본다.
**새로 추가할 때는 반드시 이 표에 등록하고, 왜 앱에서 할 수 없는지를 함께 적는다.**

| 지점 | 하는 일 | DB에 둔 이유 |
|---|---|---|
| `handle_new_user()` + `auth.users`의 `on_auth_user_created` 트리거 | 가입 시 `profiles` 행 생성 (`full_name`/`avatar_url`을 `raw_user_meta_data`에서 복사) | `auth.users` INSERT는 GoTrue 내부에서 일어나 앱이 개입할 지점이 없다 |
| `update_avatar_url_to_https()` + `profiles`의 `avatar_url_https_trigger` | `avatar_url`이 `http://`면 `https://`로 치환 | 데이터 정규화. 카카오가 http URL을 주던 시절의 방어이며, 앱 여러 경로(가입·프로필 수정)에 흩어 넣는 것보다 한 곳이 안전 |
| `rls_auto_enable` 이벤트 트리거 | 새 테이블 생성 시 RLS 자동 활성화 | 실수 방지 가드. 마이그레이션 작성자가 RLS를 잊어도 기본이 잠긴 상태가 된다 |
| `profiles`의 컬럼 단위 UPDATE 권한 (`is_admin` 제외) | 사용자가 자기 `is_admin`을 켜는 **권한 상승** 차단 | RLS 정책은 "행"만 가리고 컬럼을 못 가린다. 앱에서 막으면 클라이언트가 직접 PostgREST를 호출해 우회 가능 — **앱에서는 구조적으로 불가능한 방어** |
| RLS 정책 전반 | 행 가시성·쓰기 권한 | 권한이지 비즈니스 로직이 아니다. 단, 조건에 상태·기간 같은 규칙이 섞이면 앱으로 옮긴다 |
| prod `cron.job` (오늘의 기도 리마인더) | 스케줄에 맞춰 edge function 호출 | 스케줄러. 로직은 호출되는 함수(TS)에 있다 |

**예정**: `premium_expired_at`도 같은 이유(권한 상승·매출 직결)로 컬럼 권한 회수 예정 —
어드민 쓰기를 `admin` edge function으로 옮긴 뒤. 상세: `docs/backlog.md`

## 로컬 개발 데이터

```bash
./scripts/dev.sh        # 로컬 스택 (마이그레이션 + bible 시드)
./scripts/seed-dev.sh   # 개발용 계정 3개 + 그룹·기도카드 더미 데이터
```

- 로그인은 카카오·애플 전용이라 로컬에서는 web 의 `/dev/login`(개발 빌드 전용)으로 시드 계정에 들어간다
- `supabase/dev/seed-dev.sql` 은 `db reset` 이 읽지 않는다 — 초기화 후에는 `seed-dev.sh` 를 다시 돌린다
- 계정 삭제 경로는 만들지 않았다. **회원 탈퇴 자체가 FK 때문에 실패하는 문제**가 있다 → [docs/backlog.md](docs/backlog.md)
- 상세: [docs/dev-seed-plan.md](docs/dev-seed-plan.md)

## 시크릿

각 환경(staging·prod)에 등록한다. 로컬은 `./.env`.

| 이름 | 쓰는 곳 |
|---|---|
| `OPENAI_SECRET_KEY` | bible·openai 함수 |
| `KAKAO_ADMIN_KEY` | kakao-webhook |
| `R2_ENDPOINT` · `R2_BUCKET` · `R2_ACCESS_KEY_ID` · `R2_SECRET_ACCESS_KEY` | 업로드 서명 (`POST /api/upload-url`) |

R2 값이 없으면 업로드 엔드포인트가 500 을 돌려준다 — 설정 누락을 조용히 넘기지 않는다.

## 신규 엔드포인트 체크리스트

함수는 전부 service role 클라이언트(RLS 우회)를 쓰므로 **함수 코드가 권한 검사의 전부**다. 라우트 추가 시:

- [ ] anon 허용 여부를 라우트/컨트롤러에서 **명시적으로** 결정했는가 (기본: 거부 — `userId === "anon"` → 401)
- [ ] 자원 접근이 `c.get("userId")` 본인 것으로 제한되는가 (예: 유저 삭제는 self-only)
- [ ] 비용이 발생하는 호출(LLM 등)이면 `llm_usage_log` 기반 일일 한도를 걸었는가 (bible/openai 함수 참조)
- [ ] 인프라 호출자(pg_cron 등)가 필요하면 service_role 경로(`userId === "service_role"`)로 — 사용자 검증과 섞지 않는다
