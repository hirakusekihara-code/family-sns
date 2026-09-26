-- =====================================================================
-- Family SNS：データベースの準備（ログイン・プロフィール・家族グループ）
-- Supabase の「SQL Editor」にこのファイルの内容をすべて貼り付けて「Run」を押してください。
-- 何度実行しても大丈夫なように書いてあります。
-- =====================================================================

-- ---------- 家族グループ ----------
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 50),
  invite_code text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- プロフィール（ログインしている人 1人につき 1件） ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  family_id uuid references public.families (id) on delete set null,
  relation text not null check (relation in (
    'father', 'mother', 'son', 'daughter', 'grandfather', 'grandmother', 'cousin',
    'uncle', 'aunt', 'olderBrother', 'olderSister', 'youngerBrother', 'youngerSister', 'other'
  )),
  relation_note text not null default '' check (char_length(relation_note) <= 50),
  name text not null check (char_length(trim(name)) between 1 and 50),
  display_name text not null default '' check (char_length(display_name) <= 30),
  photo text check (photo is null or char_length(photo) <= 200000), -- 縮小した顔写真（data URL）
  phone text not null default '' check (char_length(phone) <= 30),
  birthday date,
  color text not null default 'bg-sky-500',
  share_location boolean not null default true,
  login_id text unique, -- 保護者が作った子どものアカウントのログインID
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_family_id_idx on public.profiles (family_id);

-- ---------- 自分の家族ID（安全設定の中で使う） ----------
create or replace function public.my_family_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select family_id from public.profiles where id = auth.uid()
$$;

-- ---------- 安全設定（Row Level Security） ----------
alter table public.families enable row level security;
alter table public.profiles enable row level security;

-- 家族グループ：自分の家族だけ見られる（作成・参加は下の関数で行う）
drop policy if exists "families: read own family" on public.families;
create policy "families: read own family" on public.families
  for select to authenticated
  using (id = public.my_family_id());

-- プロフィール：自分と、同じ家族の人だけ見られる
drop policy if exists "profiles: read self and family" on public.profiles;
create policy "profiles: read self and family" on public.profiles
  for select to authenticated
  using (id = auth.uid() or family_id = public.my_family_id());

-- プロフィール：自分のものだけ作成できる（家族への参加は関数経由）
drop policy if exists "profiles: create own" on public.profiles;
create policy "profiles: create own" on public.profiles
  for insert to authenticated
  with check (id = auth.uid() and family_id is null and login_id is null and created_by is null);

-- プロフィール：自分のものだけ更新できる
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- 更新できる項目を限定（家族ID・ログインID などは直接変えられない）
revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, relation, relation_note, name, display_name, photo, phone, birthday, color, share_location)
  on public.profiles to authenticated;
grant update (relation, relation_note, name, display_name, photo, phone, birthday, color, share_location, updated_at)
  on public.profiles to authenticated;
revoke insert, update, delete on public.families from anon, authenticated;

-- ---------- 招待コード（見間違えやすい 0/O・1/I を使わない 6文字） ----------
create or replace function public.new_invite_code()
returns text
language plpgsql volatile
set search_path = public, extensions
as $$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea;
  code text;
begin
  loop
    bytes := extensions.gen_random_bytes(6);
    code := '';
    for i in 0..5 loop
      code := code || substr(chars, 1 + (get_byte(bytes, i) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.families where invite_code = code);
  end loop;
  return code;
end
$$;

-- ---------- 家族グループを作る ----------
create or replace function public.create_family(family_name text)
returns public.families
language plpgsql security definer
set search_path = public
as $$
declare
  f public.families;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then raise exception 'profile_required'; end if;
  if (select family_id from public.profiles where id = auth.uid()) is not null then raise exception 'already_in_family'; end if;

  insert into public.families (name, invite_code, created_by)
  values (trim(family_name), public.new_invite_code(), auth.uid())
  returning * into f;

  update public.profiles set family_id = f.id, updated_at = now() where id = auth.uid();
  return f;
end
$$;

-- ---------- 招待コードで家族グループに参加 ----------
create or replace function public.join_family(code text)
returns public.families
language plpgsql security definer
set search_path = public
as $$
declare
  f public.families;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then raise exception 'profile_required'; end if;
  if (select family_id from public.profiles where id = auth.uid()) is not null then raise exception 'already_in_family'; end if;

  select * into f from public.families where invite_code = upper(trim(code));
  if not found then raise exception 'invite_not_found'; end if;

  update public.profiles set family_id = f.id, updated_at = now() where id = auth.uid();
  return f;
end
$$;

revoke execute on function public.create_family(text) from public, anon;
revoke execute on function public.join_family(text) from public, anon;
revoke execute on function public.new_invite_code() from public, anon, authenticated;
grant execute on function public.create_family(text) to authenticated;
grant execute on function public.join_family(text) to authenticated;
grant execute on function public.my_family_id() to authenticated;
