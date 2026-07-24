supabase start

# DB 접속 정보(SUPABASE_URL 등)는 런타임이 자동 주입 (로컬 serve → 로컬 스택)
# .env는 OpenAI 등 서드파티 시크릿 전달용
supabase functions serve --env-file ./.env --no-verify-jwt
