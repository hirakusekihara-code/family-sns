-- =====================================================================
-- Family SNS：よく行く場所（自宅・会社・学校など）を家族で登録する
-- （03_calendar_map.sql のあとに実行してください）
-- Supabase の「SQL Editor」にすべて貼り付けて「Run」を押します。何度実行しても大丈夫です。
-- =====================================================================

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null default public.my_family_id() references public.families (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  emoji text not null default '📍' check (char_length(emoji) <= 8),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists places_family_idx on public.places (family_id);

alter table public.places enable row level security;

-- 家族なら誰でも見る・登録する・直す・削除できる
drop policy if exists "places: read family" on public.places;
create policy "places: read family" on public.places for select to authenticated
  using (family_id = public.my_family_id());
drop policy if exists "places: create" on public.places;
create policy "places: create" on public.places for insert to authenticated
  with check (family_id = public.my_family_id() and created_by = auth.uid());
drop policy if exists "places: update" on public.places;
create policy "places: update" on public.places for update to authenticated
  using (family_id = public.my_family_id())
  with check (family_id = public.my_family_id());
drop policy if exists "places: delete" on public.places;
create policy "places: delete" on public.places for delete to authenticated
  using (family_id = public.my_family_id());

revoke all on public.places from anon;
revoke update on public.places from authenticated;
grant update (name, emoji, lat, lng) on public.places to authenticated;

-- リアルタイム更新
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'places'
  ) then
    alter publication supabase_realtime add table public.places;
  end if;
end
$$;
