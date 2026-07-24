-- bible 은 불변 참조 데이터(성경 본문) — 클라이언트 쓰기 정책이 존재할 이유가 없다.
-- prod 유래의 무제한 쓰기 정책 2건 제거:
--   "update rls" FOR UPDATE USING (true)      → 역할 미지정이라 anon 포함 누구나 수정 가능했음
--   "insert rls" FOR INSERT WITH CHECK (true) → 동일하게 누구나 행 추가 가능했음
-- 읽기("select rls")는 유지. 관리자 데이터 적재는 RLS 를 우회하는 postgres/service_role 로 수행.
drop policy if exists "update rls" on "public"."bible";
drop policy if exists "insert rls" on "public"."bible";
