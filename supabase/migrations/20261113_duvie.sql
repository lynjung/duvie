begin;

create schema duvie_private;
revoke all on schema duvie_private from public;
grant usage on schema duvie_private to authenticated;

create table public.duvie_spaces (
  id uuid primary key default gen_random_uuid()
);

create table public.duvie_members (
  user_id uuid primary key references auth.users(id),
  space_id uuid not null references public.duvie_spaces(id),
  name text not null check (name in ('Lyn', 'Edison')),
  unique (space_id, name),
  unique (space_id, user_id)
);

create table public.duvie_routines (
  space_id uuid not null,
  member_id uuid not null default auth.uid(),
  day date not null,
  habit smallint not null check (habit between 0 and 7),
  done boolean not null,
  primary key (space_id, member_id, day, habit),
  foreign key (space_id, member_id) references public.duvie_members (space_id, user_id)
);

create table public.duvie_events (
  id uuid primary key,
  space_id uuid not null references public.duvie_spaces(id),
  day date not null,
  title text not null check (char_length(btrim(title)) between 1 and 90),
  starts time not null,
  ends time check (ends > starts),
  owner text not null check (owner in ('Lyn', 'Edison', 'Together'))
);

create table public.duvie_milestones (
  id uuid primary key,
  space_id uuid not null references public.duvie_spaces(id),
  goal smallint not null check (goal in (0, 1)),
  title text not null check (char_length(btrim(title)) between 1 and 140),
  done date,
  created_at timestamptz not null default now()
);

create table public.duvie_answers (
  space_id uuid not null,
  author_id uuid not null default auth.uid(),
  week_start date not null,
  answer text not null check (char_length(btrim(answer)) between 1 and 1500),
  primary key (space_id, author_id, week_start),
  foreign key (space_id, author_id) references public.duvie_members (space_id, user_id)
);

-- These helpers are outside the exposed Data API schema. They only use the
-- authenticated caller's membership and their own check-in submissions.
create function duvie_private.my_space() returns uuid
language sql stable security definer set search_path = ''
as $$
  select space_id from public.duvie_members where user_id = (select auth.uid())
$$;

create function duvie_private.has_answered(target_week date) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.duvie_answers
    where author_id = (select auth.uid()) and week_start = target_week
  )
$$;

revoke all on function duvie_private.my_space() from public;
revoke all on function duvie_private.has_answered(date) from public;
grant execute on function duvie_private.my_space() to authenticated;
grant execute on function duvie_private.has_answered(date) to authenticated;

revoke all on public.duvie_spaces, public.duvie_members, public.duvie_routines,
  public.duvie_events, public.duvie_milestones, public.duvie_answers
  from public, anon, authenticated;
grant select on public.duvie_members to authenticated;
grant select, insert, update on public.duvie_routines, public.duvie_answers to authenticated;
grant select, insert, update, delete on public.duvie_events to authenticated;
grant select, insert, update on public.duvie_milestones to authenticated;

alter table public.duvie_spaces enable row level security;
alter table public.duvie_members enable row level security;
alter table public.duvie_routines enable row level security;
alter table public.duvie_events enable row level security;
alter table public.duvie_milestones enable row level security;
alter table public.duvie_answers enable row level security;

create policy read_couple_members on public.duvie_members for select to authenticated
using (space_id = (select duvie_private.my_space()));

create policy read_couple_routines on public.duvie_routines for select to authenticated
using (space_id = (select duvie_private.my_space()));
create policy log_own_routines on public.duvie_routines for all to authenticated
using (space_id = (select duvie_private.my_space()) and member_id = (select auth.uid()))
with check (space_id = (select duvie_private.my_space()) and member_id = (select auth.uid()));

create policy manage_couple_events on public.duvie_events for all to authenticated
using (space_id = (select duvie_private.my_space()))
with check (space_id = (select duvie_private.my_space()));

create policy manage_couple_milestones on public.duvie_milestones for all to authenticated
using (space_id = (select duvie_private.my_space()))
with check (space_id = (select duvie_private.my_space()));

create policy read_revealed_answers on public.duvie_answers for select to authenticated
using (
  space_id = (select duvie_private.my_space())
  and (author_id = (select auth.uid()) or duvie_private.has_answered(week_start))
);
create policy write_own_answers on public.duvie_answers for all to authenticated
using (space_id = (select duvie_private.my_space()) and author_id = (select auth.uid()))
with check (space_id = (select duvie_private.my_space()) and author_id = (select auth.uid()));

commit;
