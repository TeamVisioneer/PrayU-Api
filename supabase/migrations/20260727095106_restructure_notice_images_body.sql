-- 공지 구조 정리 (docs: PrayU-web/docs/admin-revamp-plan.md)
--
-- 슬라이드마다 본문을 따로 두던 구조(slides: [{image_url, tip, body}])는 과했다.
-- 실제 공지는 **이미지 여러 장 + 본문 하나**다 — 이미지는 넘겨 보고 설명은 그 아래 한 덩어리.
alter table "public"."notice"
    add column "images" jsonb not null default '[]'::jsonb,
    add column "body" text;

-- 기존 slides 데이터 이관: 이미지는 순서대로 모으고, 본문은 슬라이드별 텍스트를 이어 붙인다
update "public"."notice" n
set images = coalesce(sub.images, '[]'::jsonb)
from (
    select n2.id,
           jsonb_agg(s->'image_url' order by ord) filter (
               where coalesce(s->>'image_url', '') <> ''
           ) as images
    from "public"."notice" n2,
         jsonb_array_elements(n2.slides) with ordinality as t(s, ord)
    group by n2.id
) sub
where n.id = sub.id;

update "public"."notice" n
set body = sub.body
from (
    select n2.id,
           string_agg(
               nullif(
                   concat_ws(
                       E'\n\n',
                       nullif(s->>'tip', ''),
                       coalesce(
                           nullif(s->>'body', ''),
                           (
                               select string_agg(d.value #>> '{}', E'\n')
                               from jsonb_array_elements(
                                   coalesce(s->'description', '[]'::jsonb)
                               ) d
                           )
                       )
                   ),
                   ''
               ),
               E'\n\n' order by ord
           ) as body
    from "public"."notice" n2,
         jsonb_array_elements(n2.slides) with ordinality as t(s, ord)
    group by n2.id
) sub
where n.id = sub.id;

alter table "public"."notice" drop column "slides";
