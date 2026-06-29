-- Repair Supabase Auth rows created by supabase/import_data.sql.
--
-- Why this is needed:
-- import_data.sql inserts auth.users manually. Supabase password login also
-- expects a matching auth.identities row with a complete email identity.
--
-- Run the diagnostic SELECTs first. If the target user still fails login,
-- run the repair block. Default imported password is: Simapros2026!

-- 0) Confirm the current hosted Auth schema.
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'auth'
  and table_name in ('users', 'identities')
order by table_name, ordinal_position;

-- 1) Inspect the target login user and its email identity.
select
  u.id,
  u.email,
  u.aud,
  u.role,
  u.email_confirmed_at,
  u.encrypted_password is not null as has_password,
  crypt('Simapros2026!', u.encrypted_password) = u.encrypted_password as imported_password_matches,
  u.raw_app_meta_data,
  i.id as identity_id,
  i.provider,
  i.provider_id,
  i.identity_data ->> 'sub' as identity_sub,
  i.identity_data ->> 'email' as identity_email,
  i.identity_data
from auth.users u
left join auth.identities i
  on i.user_id = u.id
 and i.provider = 'email'
where lower(u.email) = lower('super@gmail.com');

-- 2) Check common integrity problems for imported email users.
select lower(email) as email, count(*) as user_count
from auth.users
where email is not null
group by lower(email)
having count(*) > 1;

select
  u.id,
  u.email,
  count(i.id) filter (where i.provider = 'email') as email_identity_count
from auth.users u
left join auth.identities i on i.user_id = u.id
where u.email is not null
group by u.id, u.email
having count(i.id) filter (where i.provider = 'email') <> 1;

select
  u.id,
  u.email,
  i.id as identity_id,
  i.provider,
  i.provider_id,
  i.identity_data
from auth.users u
join auth.identities i on i.user_id = u.id
where i.provider = 'email'
  and (
    i.identity_data is null
    or i.identity_data ->> 'sub' is distinct from u.id::text
    or lower(i.identity_data ->> 'email') is distinct from lower(u.email)
  );

-- 3) Repair all imported email users.
-- This keeps the imported password as Simapros2026! and recreates one clean
-- email identity per auth.users row that has an email.
begin;

update auth.users
set
  aud = 'authenticated',
  role = 'authenticated',
  encrypted_password = crypt('Simapros2026!', gen_salt('bf')),
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change = coalesce(email_change, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  reauthentication_token = coalesce(reauthentication_token, ''),
  email_change_confirm_status = coalesce(email_change_confirm_status, 0),
  is_sso_user = coalesce(is_sso_user, false),
  is_anonymous = coalesce(is_anonymous, false),
  raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb),
  updated_at = now()
where email is not null
  and encrypted_password is not null;

delete from auth.identities i
using auth.users u
where i.user_id = u.id
  and i.provider = 'email'
  and u.email is not null;

insert into auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  u.id,
  u.id::text,
  'email',
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true,
    'phone_verified', false
  ),
  null,
  now(),
  now()
from auth.users u
where u.email is not null
  and u.encrypted_password is not null;

commit;

-- 4) Verify the target login user again.
select
  u.id,
  u.email,
  crypt('Simapros2026!', u.encrypted_password) = u.encrypted_password as imported_password_matches,
  i.provider,
  i.provider_id,
  u.confirmation_token is not null as confirmation_token_not_null,
  u.recovery_token is not null as recovery_token_not_null,
  u.email_change_token_new is not null as email_change_token_new_not_null,
  u.email_change is not null as email_change_not_null,
  i.identity_data ->> 'sub' as identity_sub,
  i.identity_data ->> 'email' as identity_email
from auth.users u
left join auth.identities i
  on i.user_id = u.id
 and i.provider = 'email'
where lower(u.email) = lower('super@gmail.com');
