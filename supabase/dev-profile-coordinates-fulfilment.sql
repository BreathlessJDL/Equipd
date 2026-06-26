-- Dev-only profile coordinates for seller-delivery radius QA.
-- Safe to re-run. Only updates known dev-seed profile UUIDs.
--
-- Emma Walsh: near Leeds (inside typical seller delivery radius from Leeds listings)
-- Chris Morgan: London (outside Leeds seller radius)
-- James Porter (Leeds seller): Leeds city centre

update public.profiles
set
  latitude = 53.8008,
  longitude = -1.5491
where id = '11111111-1111-4111-8111-111111111101';

update public.profiles
set
  latitude = 53.7974,
  longitude = -1.5438
where id = '11111111-1111-4111-8111-111111111104';

update public.profiles
set
  latitude = 51.5074,
  longitude = -0.1278
where id = '11111111-1111-4111-8111-111111111105';
