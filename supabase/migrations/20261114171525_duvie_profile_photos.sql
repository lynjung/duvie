begin;

create table public.duvie_profile_photos (
  space_id uuid not null,
  member_id uuid not null,
  photo text check (
    photo is null or (
      octet_length(photo) <= 131072 and
      photo ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$'
    )
  ),
  primary key (space_id, member_id),
  foreign key (space_id, member_id) references public.duvie_members (space_id, user_id)
    on delete cascade
);

revoke all on public.duvie_profile_photos from public, anon, authenticated;
grant select, insert, update on public.duvie_profile_photos to authenticated;
alter table public.duvie_profile_photos enable row level security;

create policy read_couple_photos on public.duvie_profile_photos for select to authenticated
using (space_id = (select duvie_private.my_space()));

create policy insert_own_photo on public.duvie_profile_photos for insert to authenticated
with check (space_id = (select duvie_private.my_space()) and member_id = (select auth.uid()));

create policy update_own_photo on public.duvie_profile_photos for update to authenticated
using (space_id = (select duvie_private.my_space()) and member_id = (select auth.uid()))
with check (space_id = (select duvie_private.my_space()) and member_id = (select auth.uid()));

commit;
