-- =====================================================================
-- Family SNS：カレンダー（予定・家計簿・添付ファイル）とマップ（現在地）
-- （schema.sql と 02_timeline_chat.sql を実行したあとに実行してください）
-- Supabase の「SQL Editor」にすべて貼り付けて「Run」を押します。何度実行しても大丈夫です。
-- =====================================================================

-- ---------- 自分が保護者（父・母）か ----------
create or replace function public.i_am_parent()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select relation in ('father', 'mother') from public.profiles where id = auth.uid()), false)
$$;
grant execute on function public.i_am_parent() to authenticated;

-- 同じ家族のメンバーか
create or replace function public.in_my_family(member uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = member and family_id = public.my_family_id())
$$;
grant execute on function public.in_my_family(uuid) to authenticated;

-- ---------- 予定 ----------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null default public.my_family_id() references public.families (id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  assignee_id uuid not null references public.profiles (id) on delete cascade, -- 担当（誰の予定か）
  title text not null check (char_length(trim(title)) between 1 and 100),
  date date not null,
  all_day boolean not null default false,
  start_time text not null default '09:00' check (start_time ~ '^\d{2}:\d{2}$'),
  end_time text not null default '10:00' check (end_time ~ '^\d{2}:\d{2}$'),
  spot_id text check (spot_id is null or char_length(spot_id) <= 50),
  place text not null default '' check (char_length(place) <= 100),
  memo text not null default '' check (char_length(memo) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists events_family_date_idx on public.events (family_id, date);

-- ---------- 予定のお金（家計簿）：保護者はすべて、子どもは自分のお小遣い帳だけ見られる ----------
create table if not exists public.event_money (
  event_id uuid primary key references public.events (id) on delete cascade,
  family_id uuid not null default public.my_family_id() references public.families (id) on delete cascade,
  type text not null check (type in ('expense', 'income')),
  amount integer not null check (amount > 0 and amount < 100000000),
  category text not null check (char_length(category) <= 30),
  ledger text not null check (ledger = 'household' or ledger like 'allowance-%') -- 家計 or お小遣い帳
);

-- ---------- 添付ファイル（領収書・請求書など。ファイル本体は Storage に保存） ----------
create table if not exists public.event_attachments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  family_id uuid not null default public.my_family_id() references public.families (id) on delete cascade,
  kind text not null default 'other' check (kind in ('receipt', 'invoice', 'other')),
  name text not null check (char_length(name) between 1 and 200),
  mime_type text not null default '',
  storage_path text not null unique,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists event_attachments_event_idx on public.event_attachments (event_id);

-- ---------- 家族の現在地（「現在地を取得」を押したときに保存） ----------
create table if not exists public.member_locations (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  family_id uuid not null default public.my_family_id() references public.families (id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy real not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------- 安全設定（Row Level Security） ----------
alter table public.events enable row level security;
alter table public.event_money enable row level security;
alter table public.event_attachments enable row level security;
alter table public.member_locations enable row level security;

-- 予定：家族なら誰でも見られる・登録できる・編集できる（ほかの家族の予定も）
drop policy if exists "events: read family" on public.events;
create policy "events: read family" on public.events for select to authenticated
  using (family_id = public.my_family_id());
drop policy if exists "events: create" on public.events;
create policy "events: create" on public.events for insert to authenticated
  with check (family_id = public.my_family_id() and created_by = auth.uid() and public.in_my_family(assignee_id));
drop policy if exists "events: update" on public.events;
create policy "events: update" on public.events for update to authenticated
  using (family_id = public.my_family_id())
  with check (family_id = public.my_family_id() and public.in_my_family(assignee_id));
drop policy if exists "events: delete" on public.events;
create policy "events: delete" on public.events for delete to authenticated
  using (family_id = public.my_family_id());

-- お金：保護者はすべて、子どもは自分のお小遣い帳（allowance-自分のID）だけ
drop policy if exists "money: read" on public.event_money;
create policy "money: read" on public.event_money for select to authenticated
  using (family_id = public.my_family_id() and (public.i_am_parent() or ledger = 'allowance-' || auth.uid()::text));
drop policy if exists "money: write" on public.event_money;
create policy "money: write" on public.event_money for all to authenticated
  using (family_id = public.my_family_id() and (public.i_am_parent() or ledger = 'allowance-' || auth.uid()::text))
  with check (
    family_id = public.my_family_id()
    and (public.i_am_parent() or ledger = 'allowance-' || auth.uid()::text)
    and exists (select 1 from public.events e where e.id = event_id and e.family_id = public.my_family_id())
  );

-- 添付ファイル：家族だけ
drop policy if exists "attachments: read family" on public.event_attachments;
create policy "attachments: read family" on public.event_attachments for select to authenticated
  using (family_id = public.my_family_id());
drop policy if exists "attachments: create" on public.event_attachments;
create policy "attachments: create" on public.event_attachments for insert to authenticated
  with check (
    family_id = public.my_family_id() and created_by = auth.uid()
    and exists (select 1 from public.events e where e.id = event_id and e.family_id = public.my_family_id())
    and storage_path like public.my_family_id()::text || '/%'
  );
drop policy if exists "attachments: update kind" on public.event_attachments;
create policy "attachments: update kind" on public.event_attachments for update to authenticated
  using (family_id = public.my_family_id())
  with check (family_id = public.my_family_id());
drop policy if exists "attachments: delete" on public.event_attachments;
create policy "attachments: delete" on public.event_attachments for delete to authenticated
  using (family_id = public.my_family_id());

-- 現在地：位置情報の共有がオンの家族の分だけ見られる／自分の分だけ保存できる
drop policy if exists "locations: read family" on public.member_locations;
create policy "locations: read family" on public.member_locations for select to authenticated
  using (
    family_id = public.my_family_id()
    and (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = user_id and p.share_location))
  );
drop policy if exists "locations: write own" on public.member_locations;
create policy "locations: write own" on public.member_locations for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and family_id = public.my_family_id());

-- 変更できる項目を限定
revoke all on public.events, public.event_money, public.event_attachments, public.member_locations from anon;
revoke update on public.events, public.event_attachments from authenticated;
grant update (assignee_id, title, date, all_day, start_time, end_time, spot_id, place, memo, updated_at)
  on public.events to authenticated;
grant update (kind) on public.event_attachments to authenticated;

-- ---------- 添付ファイルの保管場所（非公開。家族のフォルダーだけ読み書きできる） ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 10485760, array['image/*', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists "attachments files: read family" on storage.objects;
create policy "attachments files: read family" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = public.my_family_id()::text);
drop policy if exists "attachments files: upload family" on storage.objects;
create policy "attachments files: upload family" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = public.my_family_id()::text);
drop policy if exists "attachments files: delete family" on storage.objects;
create policy "attachments files: delete family" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = public.my_family_id()::text);

-- ---------- リアルタイム更新 ----------
do $$
declare
  t text;
begin
  foreach t in array array['events', 'event_money', 'event_attachments', 'member_locations'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;
