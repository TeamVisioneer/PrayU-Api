#!/usr/bin/env bash
#
# 로컬 개발용 계정과 더미 데이터를 넣는다. 로컬 스택 전용이다.
#
# 여기 적힌 비밀번호는 로컬에만 존재하는 계정의 것이다 —
# seed 는 원격에 나가지 않고(배포는 db push + functions deploy 뿐), 이 스크립트도 127.0.0.1 만 본다.
#
# 사용법:  ./scripts/dev.sh 로 스택을 띄운 뒤  ./scripts/seed-dev.sh
# 초기화:  supabase db reset  (계정 삭제 경로는 만들지 않는다 — docs/dev-seed-plan.md 참조)

set -euo pipefail

API_URL="http://127.0.0.1:54321"
DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
PASSWORD="prayu-dev-1234"
SQL_FILE="$(cd "$(dirname "$0")/.." && pwd)/supabase/dev/seed-dev.sql"

# dev1|이름 형식 — 웹 목업(src/mock/mockData.ts)과 같은 인물로 맞춘다
ACCOUNTS=(
  "dev1|김기도"
  "dev2|이찬양"
  "dev3|박은혜"
)

if ! curl -sf "$API_URL/rest/v1/" -o /dev/null 2>&1; then
  echo "로컬 스택이 떠 있지 않다. 먼저 ./scripts/dev.sh 를 실행할 것" >&2
  exit 1
fi

SERVICE_ROLE_KEY="$(supabase status -o env 2>/dev/null | grep '^SERVICE_ROLE_KEY=' | cut -d= -f2- | tr -d '"')"
if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "service_role 키를 읽지 못했다. supabase status 가 동작하는지 확인할 것" >&2
  exit 1
fi

for entry in "${ACCOUNTS[@]}"; do
  handle="${entry%%|*}"
  name="${entry##*|}"
  email="${handle}@prayu.local"

  exists="$(psql "$DB_URL" -At -c "select 1 from auth.users where email = '${email}' limit 1")"
  if [ -n "$exists" ]; then
    echo "· ${email} — 이미 있음"
    continue
  fi

  status="$(curl -s -o /tmp/seed-dev-user.json -w '%{http_code}' \
    -X POST "$API_URL/auth/v1/admin/users" \
    -H "apikey: $SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${email}\",\"password\":\"${PASSWORD}\",\"email_confirm\":true,\"user_metadata\":{\"full_name\":\"${name}\"}}")"

  if [ "$status" != "200" ]; then
    echo "· ${email} — 생성 실패 (HTTP ${status})" >&2
    cat /tmp/seed-dev-user.json >&2
    exit 1
  fi
  echo "· ${email} — 생성"
done

echo
psql "$DB_URL" -f "$SQL_FILE"
echo
echo "완료. http://localhost:5173/dev/login 에서 아래 계정으로 로그인한다."
for entry in "${ACCOUNTS[@]}"; do
  handle="${entry%%|*}"
  echo "  ${handle}@prayu.local / ${PASSWORD}  (${entry##*|})"
done
