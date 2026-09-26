-- =====================================================================
-- テスト用データの削除（Claude がテストで作ったアカウント・家族・投稿など）
-- メールアドレスが「claude-test-...@example.com」のアカウントだけを削除します。
-- あなたや家族のアカウントには影響しません。
-- =====================================================================

-- テスト用アカウントを削除（プロフィール・投稿・コメント・メッセージも一緒に消えます）
delete from auth.users where email like 'claude-test-%@example.com';

-- メンバーがいなくなった家族グループを削除
delete from public.families f
where not exists (select 1 from public.profiles p where p.family_id = f.id);
