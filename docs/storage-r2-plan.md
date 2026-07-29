# 파일 스토리지 R2 이전 계획

## 배경

Supabase Storage 무료 한도가 **1GB**이고, **2026-07-29 기준 이미 0.26GB(26%)를 썼다.**

증가원은 둘인데 크기가 자릿수로 다르다.

다만 **당장 급하지는 않다.** 말씀카드는 `html2canvas` → **JPEG q0.95, scale 2 (760×1014)** 로 저장된다.
앱과 같은 경로(`canvas.toBlob("image/jpeg", 0.95)`)로 실측하면 **한 장 약 82KB**, 즉 **1GB ≈ 1만 2천 장**이다.

> 처음에 ffmpeg 로 어림한 52KB 는 틀린 값이었다. ffmpeg 의 `-q:v` 눈금은 캔버스의 `quality` 와 달라
> 앱 용량을 대변하지 못한다. **인코더가 다르면 같은 "품질"이 같은 용량이 아니다.**

### 품질을 낮추면 얼마나 버나 (실측)

| quality | 용량 | q0.95 대비 | q1.00 기준 PSNR |
|---|---|---|---|
| 1.00 | 257KB | 314% | — |
| **0.95** (현재) | **82KB** | 100% | 52.2dB |
| 0.90 | 56KB | 68% | 48.7dB |
| **0.85** | **46KB** | **56%** | 46.7dB |
| 0.80 | 40KB | 49% | 45.4dB |

**q0.85 로 낮추면 수용량이 1만 2천 → 2만 2천 장**이 된다. 손글씨체 구절을 확대해 나란히 놓고 비교했을 때
차이를 알아보기 어려웠다 — 카드는 평면 배경 + 그라디언트 + 굵은 글자라 JPEG 이 다루기 쉬운 그림이다.
사진(감사카드)은 성격이 다르므로 같이 낮추기 전에 따로 확인한다.

### 진짜 증가원은 말씀카드가 아니라 **감사카드 사진**이다

`NewThanksCardPage` 는 사용자가 고른 파일(`formData.photo`)을 **리사이즈·압축 없이 그대로** 올린다.
요즘 폰 사진은 장당 3~5MB 다.

| | 한 장 | 1GB 소진까지 |
|---|---|---|
| 말씀카드 (생성 이미지) | 82KB | 12,000장 |
| **감사카드 사진 (원본 업로드)** | **3~5MB** | **약 200장** |

**사진 200장이면 한도가 찬다.** 남은 0.74GB 는 사진 기준 150장 남짓이다.
말씀카드로 계산한 "1만 2천 장"은 사진 앞에서 의미가 없다.

프로필 사진까지 직접 업로드하게 되면 더 빨라진다.

### 그래서 순서가 있다

1. **업로드 전 리사이즈** — R2 와 무관하게 **먼저** 한다. 3MB 사진을 1600px·q0.85 로 줄이면 200~400KB,
   **10배** 차이다. 이걸 안 하면 R2 의 10GB 도 사진 2~3천 장이면 찬다.
   **스토리지를 어디로 옮기든 원본 업로드는 그 자체로 문제다**
2. **R2 전환** — 신규 업로드만. 기존 0.26GB 는 Supabase 에 동결한다

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
기존:  image_url = "https://<ref>.supabase.co/storage/v1/object/public/prayu/BibleCard/a.jpeg"
신규:  image_key = "bible_card/9f2c….jpeg"    + VITE_STORAGE_BASE_URL (환경변수)
```

도메인이 바뀌면 **환경변수 한 줄**만 고치면 된다. 공지 이미지에서 겪은
"URL 에 프로젝트 ref 가 박혀 staging/prod 가 갈린다" 문제도 같은 뿌리다.

### 컬럼을 따로 만든다

기존 컬럼에 키를 넣고 값의 생김새(`http` 로 시작하는가)로 구분하는 방법도 있으나 **쓰지 않는다.**
한 컬럼에 두 의미가 섞이면, 나중에 그 판별에 들어맞지 않는 값이 하나만 들어와도 조용히 깨진다.
스키마가 늘더라도 **컬럼 하나에 의미 하나**가 맞다.

| 테이블 | 기존 (그대로 둔다) | 신규 |
|---|---|---|
| `bible_card` | `image_url` (절대 URL) | **`image_key`** |
| `thanks_card` | `image` (절대 URL) | **`image_key`** |

읽을 때는 **키가 있으면 키를, 없으면 기존 URL 을** 쓴다. 판별이 아니라 존재 여부다.

```ts
// src/lib/assetUrl.ts — 키만 받는다. URL 을 넘기는 경우는 없다.
export const assetUrl = (key: string | null): string | null =>
  key ? `${import.meta.env.VITE_STORAGE_BASE_URL}/${key}` : null;

// 읽는 곳
const src = assetUrl(card.image_key) ?? card.image_url;
```

### 이번 범위 — 앞으로 만드는 이미지만

**서비스가 새로 만드는 이미지**만 R2 로 보낸다.

| 대상 | 이번에 | 이유 |
|---|---|---|
| 말씀카드 이미지 | **R2** | 가장 많이 쌓인다 |
| 감사카드 사진 | **R2** | 사용자 업로드 |
| 즉석 공지 이미지 | **R2** | 어드민 업로드 (릴리스 공지는 레포 경로라 무관) |
| `profiles.avatar_url` | 그대로 | 대부분 **카카오가 준 외부 URL** 이다. 우리가 만드는 이미지가 아니다 |
| `pray_card.bible_card_url` | 그대로 | 레거시 컬럼. 새 말씀카드는 `bible_card` 를 통해 참조된다 |
| 이미 올라간 파일 전부 | 그대로 | 아래 참조 |

### 기존 이미지는 이번에 건드리지 않는다

Supabase 에 이미 있는 파일과 그 URL 은 **그대로 두고 계속 서빙한다.** 1GB 안에서 동결된다.

옮길지 말지는 나중에 별도로 정한다. 그때 필요한 것은 대략 이렇다 —
**지금 설계하지 않는다. 여기 적는 이유는 나중에 다시 처음부터 고민하지 않기 위해서다.**

- 객체 복사 (Supabase → R2), 키 규칙을 신규분과 맞출지 결정
- `image_key` 백필, 검증 후 레거시 컬럼 정리
- 카카오 공유 썸네일 캐시가 옛 URL 을 들고 있는 기간 고려
- 복사 실패·중복에 대한 재실행 안전성

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
| `supabase/migrations/<ts>_add_image_key.sql` (신규) | `bible_card.image_key` · `thanks_card.image_key` 추가 (둘 다 널 허용) |
| `supabase/functions/api/upload/uploadRouter.ts` (신규) | `POST /` → 서명 URL 발급 |
| `supabase/functions/api/upload/uploadController.ts` (신규) | 로그인·`kind`·`contentType` 검사, 키 생성 |
| `supabase/functions/api/upload/uploadService.ts` (신규) | S3 호환 서명(AWS SigV4). R2 는 S3 API 를 그대로 받는다 |
| `supabase/functions/api/index.ts` (수정) | 라우터 등록 |
| `CLAUDE.md` (수정) | 시크릿 목록에 R2 항목 추가 |

시크릿(각 환경): `R2_ACCOUNT_ID` · `R2_ACCESS_KEY_ID` · `R2_SECRET_ACCESS_KEY` · `R2_BUCKET`

### PrayU-web

| 파일 | 내용 |
|---|---|
| `src/lib/resizeImage.ts` (신규) | **업로드 전 리사이즈·재인코딩.** R2 전환과 무관하게 먼저 넣는다 |
| `src/lib/assetUrl.ts` (신규) | 키 → URL. **키만 받는다** — 절대 URL 을 넘기는 경로는 만들지 않는다 |
| `src/apis/file.ts` (수정) | `uploadImage` 를 **서명 URL 방식**으로 교체. 반환값을 `{ key }` 로 바꾸고 `getPublicUrl` 은 제거(리졸버로 대체) |
| `src/hooks/useSaveImage.ts` (수정) | 업로드 후 `key` 를 돌려주도록 |
| `src/pages/NewThanksCardPage.tsx` · `BibleCardPage/BibleCardNewPage.tsx` · `BibleCardGeneratorPage.tsx` (수정) | 저장 시 key 를 넣는다 |
| `src/pages/AdminPage/NoticeManager.tsx` (수정) | 즉석 공지 이미지 업로드도 같은 경로로. **단 저장은 URL** — 아래 참조 |
| 읽는 곳 (수정) | `PrayCardHistoryDrawer` · `PrayCardHistoryList` · `ThanksCardItem` — `assetUrl(image_key) ?? image_url` 로. **`UserProfile`·`PrayListDrawer`·`PrayCard` 는 손대지 않는다**(`avatar_url` 만 쓴다) |
| `.env` (각 환경) | `VITE_STORAGE_BASE_URL` |

**프로필 사진**: `avatar_url` 은 대부분 카카오가 준 외부 URL 이라 이번 범위 밖이다. 관련 컴포넌트는 건드리지 않는다.

**공지 이미지는 예외로 URL 을 저장한다.** `notice.images` 는 설계상 URL 목록이고, 레포 원고가 넣는
`/images/notice/...`(웹 오리진)과 즉석 업로드가 섞인다. 여기에 키를 넣으면 **값의 생김새로 분기**해야 하는데
그건 이 계획이 피하려던 것이다. 공지는 행이 몇 개뿐이라 도메인이 바뀌어도 UPDATE 몇 줄이면 된다 —
수만 행이 쌓이는 카드와 성격이 다르다.

## 단계

0. [x] **web PR — 업로드 전 리사이즈** — [PrayU-Web#488](https://github.com/TeamVisioneer/PrayU-Web/pull/488)
2. [x] **Api PR** — `image_key` 마이그레이션 + 서명 엔드포인트 — [#50](https://github.com/TeamVisioneer/PrayU-Api/pull/50)
3. [x] **web PR** — `assetUrl()` + 업로드 전환 + 읽는 곳 정리 — [PrayU-Web#489](https://github.com/TeamVisioneer/PrayU-Web/pull/489)
1. [ ] 🔴 **사람이 준비** — R2 버킷 2개(staging/prod), API 토큰, `r2.dev` 공개 설정, **CORS 허용**(브라우저 PUT 이므로 필수),
   Api 시크릿 4개 + web `VITE_STORAGE_BASE_URL`
4. [ ] **검증** — 아래
5. (나중에) 도메인을 옮기게 되면 `VITE_STORAGE_BASE_URL` 만 바꾼다

**순서가 뒤집혔다.** 1단계(사람이 준비)를 기다리지 않고 코드를 먼저 넣었으므로,
**설정이 없는 동안에는 기존 Supabase Storage 로 계속 업로드된다** (아래 "스위치" 절).
설정을 넣는 순간 새 업로드부터 R2 로 간다 — 배포를 다시 하지 않아도 된다.

### 스위치 — 설정이 없으면 옛 경로로 간다

`VITE_STORAGE_BASE_URL` **하나로** 판단한다.

| 상태 | 업로드 | DB 에 들어가는 값 |
|---|---|---|
| 값 없음 (지금) | Supabase Storage (기존 경로 그대로) | `image_url` / `image` (절대 URL) |
| 값 있음 | R2 (서명 URL) | `image_key` (경로) |

읽는 쪽은 늘 `assetUrl(image_key) ?? image_url` 이라 두 상태가 섞여도 된다.
전환을 되돌려야 하면 환경변수를 지우면 되고, 그동안 R2 에 올라간 파일은 계속 읽힌다.

**한쪽만 넣으면 업로드가 실패한다** — web 에 base URL 만 있고 Api 에 R2 시크릿이 없으면
서명 엔드포인트가 500 을 준다. 두 설정은 같이 넣는다.

## 검증

### 로컬에서 이미 확인한 것 (2026-07-29)

로컬 Supabase 에 **S3 호환 엔드포인트**가 있어 R2 자격증명 없이 전 구간을 돌려볼 수 있었다.
`R2_ENDPOINT` 만 그쪽으로 돌리면 서명 규격이 같아 코드가 그대로 동작한다.

| 확인 | 결과 |
|---|---|
| 브라우저에서 업로드 (서명 발급 → PUT → 공개 조회) | 200, 바이트·content-type 원본과 동일 |
| 반환값 | `{ key: "thanks_card/<uuid>.jpeg", url: null }` — **키만** 돌아온다 |
| `image_key` 만 있는 행 | 감사카드 목록·프로필 히스토리에서 정상 표시 |
| `image_url` 만 있는 행(기존 데이터) | 그대로 표시 — 폴백 동작 |
| 환경변수 없는 상태 | Supabase 로 업로드, `{ key: null, url: <절대 URL> }` — **기존 동작 유지** |
| 엔드포인트 | 비로그인 401 · 잘못된 `kind` 400 · 허용 외 `contentType` 400 · 타입 변조 PUT 403 |

### R2 연결 후 확인할 것

- 말씀카드·감사카드·즉석 공지 이미지 업로드 → R2 에 객체 생성 확인, DB 에 **키만** 저장됐는지 확인
- **CORS** — 브라우저 PUT 이라 버킷에 허용 오리진이 없으면 여기서 막힌다 (로컬 검증으로는 드러나지 않는 항목)
- **기존 카드가 그대로 보이는지** — `image_key` 가 없는 행은 `image_url` 로 떨어져야 한다
- 카카오 공유 썸네일이 새 URL 로 뜨는지
- 비로그인 상태에서 서명 엔드포인트가 401 인지
- 허용하지 않는 `contentType`·과대 파일이 거부되는지

## 한계와 남는 것

- **`r2.dev` 는 CF 가 개발용이라 명시한 도메인이다.** 지금 규모에서는 문제없다고 보지만,
  트래픽이 늘거나 공유 썸네일이 눈에 띄게 느려지면 커스텀 도메인을 다시 검토한다.
  그때 드는 비용은 환경변수 한 줄이다(그러라고 경로만 저장한다)
- **기존 Supabase 파일은 계속 Supabase 가 서빙한다.** 지우지 않는다. 1GB 안에서 동결된 채 남는다.
  옮길지 여부와 방법은 **별도 작업**으로 남긴다 ("기존 이미지는 이번에 건드리지 않는다" 절)
- 한동안 **두 스토리지를 동시에 읽는 상태**가 된다. `image_key`/`image_url` 두 컬럼이 공존하므로
  읽는 쪽이 늘 폴백을 거쳐야 한다 — 기존 이미지를 다 옮기고 백필한 뒤에야 정리할 수 있다
- 파일 삭제 정책은 이번 범위 밖이다 — 지금도 삭제하지 않고 있다(카드 삭제 시 이미지가 남는다)
- **스토리지 파일은 사용자와 FK 로 묶여 있지 않다.** `storage.objects` 의 외래키는 `storage.buckets` 하나뿐이고
  `owner`(uuid)·`owner_id`(text) 컬럼은 참조 없이 값만 들고 있다 — 즉 **회원 탈퇴를 막는 원인은 아니다**
  (탈퇴를 막는 것은 `profiles_id_fkey`. backlog 참조). 로컬 스택 기준으로 확인했고,
  Supabase 관리형 prod 는 같은 버전이거나 더 최신이라 같은 상태로 본다.
  다만 **탈퇴해도 그 사용자의 파일은 남는다** — 개인정보 삭제 요청을 이행하려면 감사카드 사진처럼
  사용자가 올린 파일을 지우는 절차가 따로 필요하다. R2 로 가도 이 성질은 같다
- 이미지 화질 조정(q0.95 → q0.85 면 **82KB → 46KB**)은 별개 작업이다. 코드 한 줄로 수용량이 거의 두 배가 되므로
  **이전보다 먼저 해볼 값어치가 있다**
