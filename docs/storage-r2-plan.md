# 파일 스토리지 R2 이전 계획

## 배경

Supabase Storage 무료 한도가 **1GB**다. 말씀카드가 사용자마다 이미지를 만들어 쌓으므로 언젠가 닿는다.

다만 **당장 급하지는 않다.** 말씀카드는 `html2canvas` → **JPEG q0.95, scale 2 (760×1014)** 로 저장되고,
같은 조건으로 인코딩해 보면 **한 장 약 52KB** 다. 즉 **1GB ≈ 2만 장**.

그럼에도 지금 손대는 이유는 **나중에 옮길수록 비싸지기 때문**이다.
파일이 쌓인 뒤 옮기면 객체 복사 + DB에 박힌 URL 일괄 치환이 필요하다.
**신규 업로드만 R2로 돌리면** Supabase 쪽 데이터가 그 시점에 동결되고, 그 비용이 아예 발생하지 않는다.

## 결정 (2026-07-29)

| 항목 | 결정 | 이유 |
|---|---|---|
| 제공자 | **Cloudflare R2** | 무료 10GB + **이그레스 무료** |
| 공개 도메인 | **`r2.dev` 기본 도메인으로 시작** | 커스텀 도메인은 prayu.site 를 Cloudflare DNS 로 옮겨야 하는데, DNS 는 Vercel 에서 통합 관리하기로 한 결정이 있다 |
| 전환 범위 | **신규 업로드만.** 기존 파일·URL 은 그대로 둔다 | 이전 비용을 없앤다 |
| DB 저장 값 | **절대 URL 이 아니라 경로(key)** | 도메인 결정을 되돌릴 수 있게 만든다 — 아래 참조 |

### 검토했다가 접은 것

- **Vercel Blob** — DNS 작업이 없어 매끄럽지만 **Hobby 는 한도 초과 시 30일간 접근이 막힌다**
  (*"you will not be able to access Vercel Blob if limits are exceeded"*). 사용자 업로드가 멈춘다는 뜻이라
  무료 플랜으로는 위험하다. 커스텀 도메인도 지원하지 않는다. Pro 로 올린다면 다시 볼 만하다
- **R2 + `file.prayu.site`** — R2 커스텀 도메인은 **해당 도메인이 같은 Cloudflare 계정의 zone** 이어야 한다.
  서브도메인만 위임하는 partial(CNAME) setup 은 **Business/Enterprise 전용**이라 무료로는 불가능하다.
  prayu.site 를 통째로 옮기는 선택지는 DNS 통합 관리 방침과 어긋나 접었다

## 핵심 — 경로만 저장한다

`r2.dev` 는 Cloudflare 가 **개발용**이라고 명시한 도메인이다
(*"rate-limited and should only be used for development purposes"*).
지금 규모에서는 실제로 문제되지 않겠지만, **언젠가 도메인을 바꿀 가능성이 높다.**

그때 비싸지지 않으려면 DB 에 절대 URL 을 넣으면 안 된다.

```
지금:  image_url = "https://<ref>.supabase.co/storage/v1/object/public/prayu/BibleCard/a.jpeg"
앞으로: image_url = "BibleCard/a.jpeg"        + VITE_ASSET_BASE_URL (환경변수)
```

도메인이 바뀌면 **환경변수 한 줄**만 고치면 된다. 공지 이미지에서 겪은
"URL 에 프로젝트 ref 가 박혀 staging/prod 가 갈린다" 문제도 같은 뿌리다.

### 컬럼은 새로 만들지 않는다

`bible_card.image_url` · `pray_card.bible_card_url` · `thanks_card.image` · `profiles.avatar_url` 를
그대로 쓰고, **읽을 때 판별**한다.

```ts
// src/lib/assetUrl.ts
export const assetUrl = (value: string | null): string | null => {
  if (!value) return null;
  // 레거시: Supabase Storage 절대 URL · 카카오 프로필 사진 등 외부 URL
  if (value.startsWith("http")) return value;
  // 신규: R2 오브젝트 키
  return `${import.meta.env.VITE_ASSET_BASE_URL}/${value}`;
};
```

컬럼을 새로 만들면 4개 테이블 + 타입 + 모든 읽기 지점이 함께 바뀌고 마이그레이션도 는다.
값의 형태로 구분되고 레거시가 자동으로 처리되므로 **스키마 변경 없이** 간다.
대신 "한 컬럼에 두 의미"라는 점은 이 문서와 헬퍼 주석에 명시해 둔다.

## 업로드 경로 — 서명 URL 이 필요하다

지금은 브라우저가 **Supabase 세션으로 직접** 올린다. 권한 검사는 Storage RLS 가 한다.
R2 에는 RLS 가 없으므로 **서명 URL 을 내주는 엔드포인트**가 필요하다.

```
브라우저                     Api (edge function)              R2
   │  POST /api/upload-url          │                          │
   │  { kind, contentType }         │                          │
   │ ─────────────────────────────► │                          │
   │                                │ 로그인·용도 검사 후       │
   │                                │ 서명 URL 발급             │
   │  { url, key }                  │                          │
   │ ◄───────────────────────────── │                          │
   │  PUT (파일 본문)  ─────────────────────────────────────►  │
   │                                                           │
   │  DB 에는 key 만 저장                                       │
```

- `kind` 는 `bible_card` | `thanks_card` | `notice` 중 하나. **경로를 클라이언트가 정하지 못하게 한다**
  (임의 경로 쓰기 차단). 키는 서버가 `<kind>/<uuid>.<ext>` 로 만든다
- `userId === "anon"` 이면 401. 신규 엔드포인트 체크리스트(../CLAUDE.md)를 따른다
- `contentType` 은 이미지 계열만 허용, 크기 상한을 둔다

## 파일 매니페스트

### PrayU-Api

| 파일 | 내용 |
|---|---|
| `supabase/functions/api/upload/uploadRouter.ts` (신규) | `POST /` → 서명 URL 발급 |
| `supabase/functions/api/upload/uploadController.ts` (신규) | 로그인·`kind`·`contentType` 검사, 키 생성 |
| `supabase/functions/api/upload/uploadService.ts` (신규) | S3 호환 서명(AWS SigV4). R2 는 S3 API 를 그대로 받는다 |
| `supabase/functions/api/index.ts` (수정) | 라우터 등록 |
| `CLAUDE.md` (수정) | 시크릿 목록에 R2 항목 추가 |

시크릿(각 환경): `R2_ACCOUNT_ID` · `R2_ACCESS_KEY_ID` · `R2_SECRET_ACCESS_KEY` · `R2_BUCKET`

### PrayU-web

| 파일 | 내용 |
|---|---|
| `src/lib/assetUrl.ts` (신규) | 위 리졸버. 레거시 절대 URL 과 신규 키를 함께 다룬다 |
| `src/apis/file.ts` (수정) | `uploadImage` 를 **서명 URL 방식**으로 교체. 반환값을 `{ key }` 로 바꾸고 `getPublicUrl` 은 제거(리졸버로 대체) |
| `src/hooks/useSaveImage.ts` (수정) | 업로드 후 `key` 를 돌려주도록 |
| `src/pages/NewThanksCardPage.tsx` · `BibleCardPage/BibleCardNewPage.tsx` · `BibleCardGeneratorPage.tsx` (수정) | 저장 시 key 를 넣는다 |
| `src/pages/AdminPage/NoticeManager.tsx` (수정) | 즉석 공지 이미지 업로드도 같은 경로로 |
| 읽는 곳 (수정) | `PrayCardHistoryDrawer` · `PrayCardHistoryList` · `ThanksCardItem` · `UserProfile` · `PrayListDrawer` · `PrayCard` — `assetUrl()` 로 감싼다 |
| `.env` (각 환경) | `VITE_ASSET_BASE_URL` |

**프로필 사진 주의**: `avatar_url` 은 대부분 **카카오가 준 외부 URL** 이다. 리졸버가 `http` 로 시작하는 값을
그대로 통과시키므로 문제없지만, 이 컬럼은 R2 로 쓰지 않는다.

## 단계

1. **사람이 준비** — R2 버킷 2개(staging/prod), API 토큰, `r2.dev` 공개 설정, **CORS 허용**(브라우저 PUT 이므로 필수), 각 환경 시크릿 등록
2. **Api PR** — 서명 엔드포인트
3. **web PR** — 리졸버 + 업로드 전환 + 읽는 곳 정리
4. **검증** — 아래
5. (나중에) 도메인을 옮기게 되면 `VITE_ASSET_BASE_URL` 만 바꾼다

## 검증

- 말씀카드·감사카드·즉석 공지 이미지 업로드 → R2 에 객체 생성 확인, DB 에 **키만** 저장됐는지 확인
- **기존 카드가 그대로 보이는지** — 레거시 절대 URL 경로가 깨지지 않아야 한다
- 카카오 공유 썸네일이 새 URL 로 뜨는지
- 비로그인 상태에서 서명 엔드포인트가 401 인지
- 허용하지 않는 `contentType`·과대 파일이 거부되는지

## 한계와 남는 것

- **`r2.dev` 는 CF 가 개발용이라 명시한 도메인이다.** 지금 규모에서는 문제없다고 보지만,
  트래픽이 늘거나 공유 썸네일이 눈에 띄게 느려지면 커스텀 도메인을 다시 검토한다.
  그때 드는 비용은 환경변수 한 줄이다(그러라고 경로만 저장한다)
- **기존 Supabase 파일은 계속 Supabase 가 서빙한다.** 지우지 않는다. 1GB 안에서 동결된 채 남는다
- 파일 삭제 정책은 이번 범위 밖이다 — 지금도 삭제하지 않고 있다(카드 삭제 시 이미지가 남는다)
- 이미지 화질/용량 조정(q0.95 → q0.85 면 52KB → 27KB)은 별개 작업이다. 스토리지 수명을 두 배로 늘리는
  가장 싼 수단이라 함께 검토할 만하다
