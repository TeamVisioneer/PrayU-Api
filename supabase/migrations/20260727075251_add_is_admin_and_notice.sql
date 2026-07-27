-- 어드민 권한 플래그 + 공지(notice) 테이블 (docs: PrayU-web/docs/admin-revamp-plan.md)
--
-- is_admin: 지금까지 어드민 판별이 프론트 컴포넌트의 이메일 하드코딩뿐이라 화면만 가리는 수준이었다.
--           admin edge function의 requireAdmin과 공지 쓰기 정책이 이 한 값을 본다.
alter table "public"."profiles"
    add column "is_admin" boolean not null default false;

-- 공지: 그동안 코드에 하드코딩되어 문구 수정·중단에 배포가 필요했다(#403 "공지 모달 내리기" 핫픽스).
-- 슬라이드 이미지는 웹 레포의 /images/notice/*.png 경로 문자열로 둔다 — Storage 도입 시 절대 URL도 수용.
create table "public"."notice" (
    "id" uuid primary key default gen_random_uuid(),
    "title" text not null,
    -- [{ image_url, tip, description: text[] }]
    "slides" jsonb not null default '[]'::jsonb,
    "cta_label" text,
    "cta_url" text,
    "starts_at" timestamp with time zone not null default now(),
    "ends_at" timestamp with time zone,
    "is_active" boolean not null default true,
    -- 'all' | 'existing' (가입일이 starts_at 이전인 사용자에게만)
    "target" text not null default 'all',
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    constraint "notice_target_check" check ("target" in ('all', 'existing'))
);

-- 활성 공지 조회용 (앱 진입마다 1건 조회)
create index "idx_notice_active"
    on "public"."notice" ("is_active", "starts_at" desc);

alter table "public"."notice" enable row level security;

-- 읽기: 로그인 사용자에게 활성·기간 내 공지만 보인다 (작성 중인 공지 유출 방지).
-- 행 가시성만 DB에서 강제하고, 노출 규칙(1회 노출·target 필터)은 앱이 담당한다.
create policy "select active notice"
    on "public"."notice"
    for select
    to authenticated
    using (
        is_active
        and starts_at <= now()
        and (ends_at is null or ends_at > now())
    );

-- 어드민은 비활성·예약 공지까지 조회하고 관리할 수 있다
create policy "admin select all notice"
    on "public"."notice"
    for select
    to authenticated
    using (
        coalesce((select p.is_admin from "public"."profiles" p where p.id = auth.uid()), false)
    );

create policy "admin write notice"
    on "public"."notice"
    for all
    to authenticated
    using (
        coalesce((select p.is_admin from "public"."profiles" p where p.id = auth.uid()), false)
    )
    with check (
        coalesce((select p.is_admin from "public"."profiles" p where p.id = auth.uid()), false)
    );
