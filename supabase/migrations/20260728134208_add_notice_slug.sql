-- 공지 원고(web 레포 `docs/notices/<slug>.md`)와 등록된 공지를 잇는 열쇠.
--
-- 어드민이 레포 원고 목록을 보여주고 "이미 등록됨"을 판단하려면 안정적인 식별자가 필요하다.
-- 제목으로 맞추면 제목을 고치는 순간 같은 공지가 두 번 등록된다.
--
-- 널 허용: 어드민에서 즉석으로 만든 공지는 대응하는 원고가 없다.
-- (Postgres 의 unique 는 널을 서로 다른 값으로 보므로 즉석 공지끼리는 충돌하지 않는다)
alter table "public"."notice"
    add column "slug" text;

create unique index "notice_slug_key" on "public"."notice" ("slug");
