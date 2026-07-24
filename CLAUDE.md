# PrayU-Api

PrayU 백엔드 — Supabase 마이그레이션·Edge Functions·seed의 주인. 워크스페이스 공통 규칙은 상위 `../CLAUDE.md` 참조.

## 작업 착수 규칙

- **docs 먼저, 코드는 그 다음.** 피처/개선 작업 시작 시 코드부터 수정하지 않는다. 설계·계획 문서를 먼저 작성(또는 기존 문서 갱신)하고 방향 확인 후 구현한다. (웹 관련 문서는 `../PrayU-web/docs/` 참조)

## 신규 엔드포인트 체크리스트

함수는 전부 service role 클라이언트(RLS 우회)를 쓰므로 **함수 코드가 권한 검사의 전부**다. 라우트 추가 시:

- [ ] anon 허용 여부를 라우트/컨트롤러에서 **명시적으로** 결정했는가 (기본: 거부 — `userId === "anon"` → 401)
- [ ] 자원 접근이 `c.get("userId")` 본인 것으로 제한되는가 (예: 유저 삭제는 self-only)
- [ ] 비용이 발생하는 호출(LLM 등)이면 `llm_usage_log` 기반 일일 한도를 걸었는가 (bible/openai 함수 참조)
- [ ] 인프라 호출자(pg_cron 등)가 필요하면 service_role 경로(`userId === "service_role"`)로 — 사용자 검증과 섞지 않는다
