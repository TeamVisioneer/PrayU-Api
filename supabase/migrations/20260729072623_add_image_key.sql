-- 스토리지에 올린 파일을 **경로(key)** 로 가리킨다.
--
-- 기존 컬럼(`image_url`·`image`)에는 절대 URL 이 들어 있다. 그 값에 키를 섞어 넣고
-- 생김새로 구분하는 방법도 있으나, 한 컬럼에 두 의미가 섞이면 판별에 안 맞는 값이
-- 하나만 들어와도 조용히 깨진다. 컬럼을 나눈다 — 읽을 때는 키가 있으면 키를, 없으면 기존 URL 을 쓴다.
--
-- 공개 주소는 앱의 환경변수(VITE_ASSET_BASE_URL)와 조합해 만든다.
-- 스토리지 도메인이 바뀌어도 DB 를 건드리지 않기 위해서다. (docs/storage-r2-plan.md)
alter table "public"."bible_card"
    add column "image_key" text;

alter table "public"."thanks_card"
    add column "image_key" text;
