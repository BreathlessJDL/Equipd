-- Manual trigger test for support email path
select public.notify_support_team_email(
  'support_request',
  jsonb_build_object(
    'listing_title', 'SQL manual test',
    'reason', 'debug',
    'message', 'ignore'
  )
);

select id, status_code, error_msg, created, left(coalesce(content, '')::text, 300) as content
from net._http_response
order by id desc
limit 5;
