// プロフィール・家族グループの型と選択肢
// （Supabase につなぐときは、この形のままデータベースの表になります）

// 続柄（属性）：家族の中での自分の立場を、本人が選びます
export const relations = [
  "father",
  "mother",
  "son",
  "daughter",
  "grandfather",
  "grandmother",
  "cousin",
  "uncle",
  "aunt",
  "olderBrother",
  "olderSister",
  "youngerBrother",
  "youngerSister",
  "other",
] as const;

export type Relation = (typeof relations)[number];

// 権限：続柄から自動で決まります
// parent = 家計簿を管理・子どものアカウントを作成できる
// child  = 自分のお小遣い帳を管理
// relative = カレンダー・チャット・マップなどを利用（家計簿はなし）
export type Role = "parent" | "child" | "relative";

export function roleOf(relation: Relation): Role {
  if (relation === "father" || relation === "mother") return "parent";
  if (relation === "son" || relation === "daughter") return "child";
  return "relative";
}

// 表示名を入れなかったときの呼び名
export const defaultDisplayNames: Partial<Record<Relation, { ja: string; en: string }>> = {
  father: { ja: "パパ", en: "Dad" },
  mother: { ja: "ママ", en: "Mom" },
  grandfather: { ja: "じいじ", en: "Grandpa" },
  grandmother: { ja: "ばあば", en: "Grandma" },
};

// テーマカラー（Tailwind のクラス名はそのまま書いておく必要があります）
export const themeColors = [
  "bg-sky-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-teal-500",
  "bg-orange-500",
  "bg-pink-500",
] as const;

export type Family = {
  id: string;
  name: string; // 例：関原家
  inviteCode: string; // 家族に参加するためのコード
  createdBy: string; // 作成した人のプロフィールID
};

export type Profile = {
  id: string;
  familyId: string | null; // 家族グループに参加するまでは null
  relation: Relation;
  relationNote: string; // 「その他」を選んだときの補足
  name: string; // 本名
  displayName: string; // アプリ内の呼び名（空なら続柄から自動）
  photo: string | null; // 顔写真（縮小した画像）
  phone: string;
  birthday: string; // "2015-04-01"
  color: (typeof themeColors)[number];
  shareLocation: boolean;
  loginId: string | null; // 保護者が作った子どものアカウントのログインID
  createdBy: string | null; // 保護者が作った子どものアカウントなら、その保護者のプロフィールID
};

// ログイン中のアカウント（Supabase のユーザー）
export type Account = {
  id: string;
  email: string | null;
};

// アプリ内での呼び名：表示名 → 続柄の呼び名（パパ など）→ 名前 の順に使う
export function displayNameOf(p: Pick<Profile, "displayName" | "relation" | "name">, lang: "ja" | "en"): string {
  return p.displayName.trim() || defaultDisplayNames[p.relation]?.[lang] || p.name;
}
