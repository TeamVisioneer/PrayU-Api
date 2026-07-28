-- 로컬 개발용 더미 데이터. scripts/seed-dev.sh 가 계정을 만든 뒤 실행한다.
--
-- 이 파일은 supabase/seed.sql 과 무관하다 — db reset 이 자동으로 읽지 않는다.
-- 원격에 나갈 일이 없다(배포는 db push + functions deploy 뿐).
--
-- 인물·문구는 웹의 기존 목업(/group/mock, src/mock/mockData.ts)과 맞췄다.
-- 고정 UUID + on conflict do nothing 이라 재실행해도 중복되지 않는다.

begin;

-- 계정 id 를 이메일로 해석한다 (계정이 없으면 아무것도 하지 않는다)
create temporary table dev_user on commit drop as
select
    u.id,
    split_part(u.email, '@', 1) as handle
from auth.users u
where u.email like '%@prayu.local';

do $$
begin
    if (select count(*) from dev_user) < 3 then
        raise exception '개발 계정이 부족하다 (%개). scripts/seed-dev.sh 로 먼저 계정을 만들 것',
            (select count(*) from dev_user);
    end if;
end $$;

-- 1) 프로필 — 약관 동의를 채워야 로그인 후 약관 페이지로 튕기지 않는다
update public.profiles p
set terms_agreed_at = coalesce(p.terms_agreed_at, now()),
    avatar_url = coalesce(p.avatar_url, '/images/avatar/avatar_' ||
        (case d.handle when 'dev1' then '1' when 'dev2' then '2' else '3' end) || '.png')
from dev_user d
where p.id = d.id;

-- 2) 그룹 — dev1 이 그룹장
insert into public."group" ("id", "user_id", "name", "intro", "pray_time")
select
    '0d000000-0000-4000-8000-000000000001'::uuid,
    d.id,
    '청년부 기도모임',
    '한 주간의 기도제목을 나누고 서로를 위해 기도해요',
    '22:00'
from dev_user d where d.handle = 'dev1'
on conflict ("id") do nothing;

-- 3) 멤버 — 3명 모두 참여
--    pray_summary 는 앱이 기도카드를 쓸 때 함께 채우는 비정규 값이다(그룹 목록에 이 값이 보인다).
--    비워두면 "아직 기도카드가 작성되지 않았어요"로 보이므로 아래 4)에서 카드 본문으로 채운다.
insert into public."member" ("id", "group_id", "user_id")
select
    ('0d000000-0000-4000-8000-00000000001' || substr(d.handle, 4, 1))::uuid,
    '0d000000-0000-4000-8000-000000000001'::uuid,
    d.id
from dev_user d
on conflict ("id") do nothing;

-- 4) 기도카드 — 이번 주 안에 들어야 그룹 화면에 보인다(주간 범위로 조회)
insert into public."pray_card" ("id", "group_id", "user_id", "content", "life")
select
    ('0d000000-0000-4000-8000-00000000002' || substr(d.handle, 4, 1))::uuid,
    '0d000000-0000-4000-8000-000000000001'::uuid,
    d.id,
    case d.handle
        when 'dev1' then '새로운 회사에 입사하게 되었어요! 적응할 수 있도록' || chr(10) || chr(10) ||
                          '동료들과 좋은 관계를 맺을 수 있도록' || chr(10) || chr(10) ||
                          '맡겨진 일을 잘 감당할 수 있는 지혜를 주시도록'
        when 'dev2' then '아버지의 수술이 잘 되도록 기도해 주세요' || chr(10) || chr(10) ||
                          '빠른 회복을 위해' || chr(10) || chr(10) ||
                          '가족들이 힘을 낼 수 있도록'
        else '대학원 진학을 할지 취업을 할지 고민이에요' || chr(10) || chr(10) ||
             '하나님의 뜻을 분별할 수 있는 지혜를' || chr(10) || chr(10) ||
             '어떤 길이든 하나님을 영화롭게 할 수 있도록'
    end,
    case d.handle
        when 'dev1' then '새로운 시작을 앞두고 기대와 걱정이 함께 있는 한 주였어요'
        when 'dev2' then '가족의 건강 문제로 많이 걱정되는 한 주였습니다'
        else '인생의 중요한 갈림길에서 기도하며 기다리는 중입니다'
    end
from dev_user d
on conflict ("id") do nothing;

-- 4-1) 그룹 목록에 보이는 요약 — 앱과 같은 값(카드 본문)으로 맞춘다
update public."member" m
set pray_summary = pc.content
from public."pray_card" pc
where pc.group_id = m.group_id
  and pc.user_id = m.user_id
  and m.group_id = '0d000000-0000-4000-8000-000000000001'::uuid
  and m.pray_summary is distinct from pc.content;

-- 5) 기도 반응 — 서로의 카드에 남긴다 (자기 카드에는 남기지 않는다)
insert into public."pray" ("id", "pray_card_id", "user_id", "pray_type")
select
    ('0d000000-0000-4000-8000-00000000003' || v.n)::uuid,
    v.pray_card_id,
    d.id,
    v.pray_type
from (
    values
        ('1', '0d000000-0000-4000-8000-000000000021'::uuid, 'dev2', 'pray'),
        ('2', '0d000000-0000-4000-8000-000000000021'::uuid, 'dev3', 'good'),
        ('3', '0d000000-0000-4000-8000-000000000022'::uuid, 'dev1', 'pray'),
        ('4', '0d000000-0000-4000-8000-000000000022'::uuid, 'dev3', 'like'),
        ('5', '0d000000-0000-4000-8000-000000000023'::uuid, 'dev1', 'good')
) as v(n, pray_card_id, handle, pray_type)
join dev_user d on d.handle = v.handle
on conflict ("id") do nothing;

-- 6) 말씀카드 — dev1 의 기도카드에 붙인다
insert into public."bible_card"
    ("id", "user_id", "name", "keywords", "colors", "radius", "bible_reference", "bible_sentence")
select
    '0d000000-0000-4000-8000-000000000041'::uuid,
    d.id,
    '김기도',
    array['새로운 시작', '지혜', '동행']::varchar[],
    array['#FDE68A', '#FCA5A5']::varchar[],
    array['80px', '120px', '80px', '120px']::varchar[],
    '잠언 16:3',
    '너의 행사를 여호와께 맡기라 그리하면 네가 경영하는 것이 이루어지리라'
from dev_user d where d.handle = 'dev1'
on conflict ("id") do nothing;

update public."pray_card"
set bible_card_id = '0d000000-0000-4000-8000-000000000041'::uuid
where id = '0d000000-0000-4000-8000-000000000021'::uuid
  and bible_card_id is null;

select
    (select count(*) from dev_user) as 계정,
    (select count(*) from public."group" where id = '0d000000-0000-4000-8000-000000000001') as 그룹,
    (select count(*) from public."member" where group_id = '0d000000-0000-4000-8000-000000000001') as 멤버,
    (select count(*) from public."pray_card" where group_id = '0d000000-0000-4000-8000-000000000001') as 기도카드,
    (select count(*) from public."pray") as 기도반응,
    (select count(*) from public."bible_card") as 말씀카드;

commit;
