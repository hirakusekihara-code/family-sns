-- =====================================================================
-- Family SNS：タイムラインとチャット
-- （先に schema.sql を実行してから、このファイルを実行してください）
-- Supabase の「SQL Editor」にすべて貼り付けて「Run」を押します。何度実行しても大丈夫です。
-- =====================================================================

-- ---------- タイムライン：投稿 ----------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null default public.my_family_id() references public.families (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  text text not null default '' check (char_length(text) <= 2000),
  photo text check (photo is null or char_length(photo) <= 1500000), -- 縮小した写真（data URL）
  created_at timestamptz not null default now(),
  check (char_length(trim(text)) > 0 or photo is not null)
);
create index if not exists posts_family_created_idx on public.posts (family_id, created_at desc);

-- ---------- タイムライン：コメント ----------
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  family_id uuid not null default public.my_family_id() references public.families (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  text text not null check (char_length(trim(text)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);

-- ---------- タイムライン：リアクション（いいね・嬉しい・悲しい） ----------
create table if not exists public.post_reactions (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  family_id uuid not null default public.my_family_id() references public.families (id) on delete cascade,
  type text not null check (type in ('like', 'happy', 'sad')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, type)
);

-- ---------- チャット：メッセージ（recipient_id が空なら家族グループ、あればDM） ----------
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null default public.my_family_id() references public.families (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  recipient_id uuid references public.profiles (id) on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'photo')),
  text text not null default '' check (char_length(text) <= 2000),
  photo text check (photo is null or char_length(photo) <= 1500000),
  created_at timestamptz not null default now(),
  check ((kind = 'text' and char_length(trim(text)) > 0) or (kind = 'photo' and photo is not null))
);
create index if not exists chat_messages_family_created_idx on public.chat_messages (family_id, created_at);

-- ---------- チャット：メッセージへの ❤️ ----------
create table if not exists public.message_likes (
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  family_id uuid not null default public.my_family_id() references public.families (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

-- ---------- チャット：どこまで読んだか（未読の数の計算に使う） ----------
create table if not exists public.chat_reads (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  conversation text not null, -- 'group' または DM 相手のID
  last_read_at timestamptz not null default now(),
  primary key (user_id, conversation)
);

-- ---------- 安全設定（Row Level Security） ----------
alter table public.posts enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_reactions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.message_likes enable row level security;
alter table public.chat_reads enable row level security;

-- 投稿：同じ家族だけ見られる／自分として投稿／自分の投稿だけ削除
drop policy if exists "posts: read family" on public.posts;
create policy "posts: read family" on public.posts for select to authenticated
  using (family_id = public.my_family_id());
drop policy if exists "posts: create own" on public.posts;
create policy "posts: create own" on public.posts for insert to authenticated
  with check (author_id = auth.uid() and family_id = public.my_family_id());
drop policy if exists "posts: delete own" on public.posts;
create policy "posts: delete own" on public.posts for delete to authenticated
  using (author_id = auth.uid());

-- コメント
drop policy if exists "comments: read family" on public.post_comments;
create policy "comments: read family" on public.post_comments for select to authenticated
  using (family_id = public.my_family_id());
drop policy if exists "comments: create own" on public.post_comments;
create policy "comments: create own" on public.post_comments for insert to authenticated
  with check (
    author_id = auth.uid() and family_id = public.my_family_id()
    and exists (select 1 from public.posts p where p.id = post_id and p.family_id = public.my_family_id())
  );
drop policy if exists "comments: delete own" on public.post_comments;
create policy "comments: delete own" on public.post_comments for delete to authenticated
  using (author_id = auth.uid());

-- リアクション
drop policy if exists "reactions: read family" on public.post_reactions;
create policy "reactions: read family" on public.post_reactions for select to authenticated
  using (family_id = public.my_family_id());
drop policy if exists "reactions: create own" on public.post_reactions;
create policy "reactions: create own" on public.post_reactions for insert to authenticated
  with check (
    user_id = auth.uid() and family_id = public.my_family_id()
    and exists (select 1 from public.posts p where p.id = post_id and p.family_id = public.my_family_id())
  );
drop policy if exists "reactions: delete own" on public.post_reactions;
create policy "reactions: delete own" on public.post_reactions for delete to authenticated
  using (user_id = auth.uid());

-- チャット：家族グループは家族全員、DMは送った人と受け取った人だけが見られる
drop policy if exists "messages: read" on public.chat_messages;
create policy "messages: read" on public.chat_messages for select to authenticated
  using (
    family_id = public.my_family_id()
    and (recipient_id is null or sender_id = auth.uid() or recipient_id = auth.uid())
  );
drop policy if exists "messages: send" on public.chat_messages;
create policy "messages: send" on public.chat_messages for insert to authenticated
  with check (
    sender_id = auth.uid() and family_id = public.my_family_id()
    and (
      recipient_id is null
      or (recipient_id <> auth.uid()
          and exists (select 1 from public.profiles r where r.id = recipient_id and r.family_id = public.my_family_id()))
    )
  );

-- ❤️：見られるメッセージにだけ付けられる
drop policy if exists "likes: read" on public.message_likes;
create policy "likes: read" on public.message_likes for select to authenticated
  using (family_id = public.my_family_id() and exists (select 1 from public.chat_messages m where m.id = message_id));
drop policy if exists "likes: create own" on public.message_likes;
create policy "likes: create own" on public.message_likes for insert to authenticated
  with check (
    user_id = auth.uid() and family_id = public.my_family_id()
    and exists (select 1 from public.chat_messages m where m.id = message_id)
  );
drop policy if exists "likes: delete own" on public.message_likes;
create policy "likes: delete own" on public.message_likes for delete to authenticated
  using (user_id = auth.uid());

-- 既読：自分の分だけ
drop policy if exists "reads: own" on public.chat_reads;
create policy "reads: own" on public.chat_reads for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 投稿・コメント・メッセージは後から書き換えられないようにする（削除のみ可）
revoke update on public.posts, public.post_comments, public.post_reactions, public.chat_messages, public.message_likes
  from anon, authenticated;
revoke all on public.posts, public.post_comments, public.post_reactions, public.chat_messages, public.message_likes, public.chat_reads
  from anon;

-- ---------- リアルタイム更新（家族の画面にすぐ届くように） ----------
do $$
declare
  t text;
begin
  foreach t in array array['posts', 'post_comments', 'post_reactions', 'chat_messages', 'message_likes'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;
