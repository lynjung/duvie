begin;

alter table public.duvie_spaces add column plan_start date not null default date '2026-11-08';
alter table public.duvie_spaces alter column plan_start set default current_date;

alter table public.duvie_members drop constraint duvie_members_name_check;
alter table public.duvie_members add constraint duvie_members_name_check
  check (name = btrim(name) and char_length(name) between 1 and 30 and lower(name) <> 'together');

alter table public.duvie_events drop constraint duvie_events_owner_check;
alter table public.duvie_events add constraint duvie_events_owner_check
  check (owner = btrim(owner) and char_length(owner) between 1 and 30);

grant select on public.duvie_spaces to authenticated;
create policy read_own_duvie_space on public.duvie_spaces for select to authenticated
using (id = (select duvie_private.my_space()));

create table duvie_private.couple_codes (
  space_id uuid primary key references public.duvie_spaces(id) on delete cascade,
  code_hash bytea not null unique,
  expires_at timestamptz not null
);
alter table duvie_private.couple_codes enable row level security;

create function duvie_private.onboard_duvie_space(display_name text, partner_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  clean_name text := btrim(display_name);
  target_space uuid;
  supplied_hash bytea;
begin
  if caller is null or not exists (
    select 1 from auth.users where id = caller and email_confirmed_at is not null
  ) then
    raise exception 'Confirm your email before setting up Duvie.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('duvie:' || caller::text, 0));
  select space_id into target_space from public.duvie_members where user_id = caller;
  if found then
    return target_space;
  end if;

  if clean_name is null or char_length(clean_name) not between 1 and 30 or lower(clean_name) = 'together' then
    raise exception 'Choose a name between 1 and 30 characters.';
  end if;

  if partner_code is null then
    insert into public.duvie_spaces default values returning id into target_space;
  else
    if partner_code !~ '^[0-9a-f]{32}$' then
      raise exception 'That couple code is invalid or has expired.';
    end if;
    supplied_hash := pg_catalog.sha256(pg_catalog.convert_to(partner_code, 'UTF8'));
    select space_id into target_space from duvie_private.couple_codes where code_hash = supplied_hash;
    if not found then
      raise exception 'That couple code is invalid or has expired.';
    end if;

    perform 1 from public.duvie_spaces where id = target_space for update;
    if not exists (
      select 1 from duvie_private.couple_codes
      where space_id = target_space and code_hash = supplied_hash and expires_at > pg_catalog.now()
    ) or (select count(*) from public.duvie_members where space_id = target_space) <> 1 then
      raise exception 'That couple code is invalid or has expired.';
    end if;
    if exists (
      select 1 from public.duvie_members where space_id = target_space and lower(name) = lower(clean_name)
    ) then
      raise exception 'Choose a name different from your partner’s.';
    end if;
    delete from duvie_private.couple_codes where space_id = target_space;
  end if;

  insert into public.duvie_members (user_id, space_id, name) values (caller, target_space, clean_name);
  return target_space;
end;
$$;

create function duvie_private.create_duvie_couple_code()
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  target_space uuid := duvie_private.my_space();
  code text := replace(pg_catalog.gen_random_uuid()::text, '-', '');
begin
  if target_space is null then
    raise exception 'Create a space before sharing a couple code.';
  end if;
  perform 1 from public.duvie_spaces where id = target_space for update;
  if (select count(*) from public.duvie_members where space_id = target_space) <> 1 then
    raise exception 'This space already has two members.';
  end if;
  insert into duvie_private.couple_codes (space_id, code_hash, expires_at)
  values (target_space, pg_catalog.sha256(pg_catalog.convert_to(code, 'UTF8')), pg_catalog.now() + interval '1 day')
  on conflict (space_id) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at;
  return code;
end;
$$;

create function public.onboard_duvie_space(display_name text, partner_code text default null)
returns uuid language sql security invoker set search_path = ''
as $$ select duvie_private.onboard_duvie_space(display_name, partner_code) $$;

create function public.create_duvie_couple_code()
returns text language sql security invoker set search_path = ''
as $$ select duvie_private.create_duvie_couple_code() $$;

revoke all on function duvie_private.onboard_duvie_space(text, text), duvie_private.create_duvie_couple_code(),
  public.onboard_duvie_space(text, text), public.create_duvie_couple_code() from public, anon, authenticated;
grant execute on function duvie_private.onboard_duvie_space(text, text), duvie_private.create_duvie_couple_code(),
  public.onboard_duvie_space(text, text), public.create_duvie_couple_code() to authenticated;

commit;
