import type { Profile } from "@/lib/profile/types";

type Props = {
  profile: Pick<Profile, "photo" | "color" | "name" | "displayName">;
  label: string; // 写真がないときに頭文字を出す名前
  size?: "sm" | "md" | "lg" | "xl";
};

const sizes = {
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-base",
  lg: "h-14 w-14 text-xl",
  xl: "h-24 w-24 text-3xl",
};

// 顔写真（未設定ならテーマカラーの丸に頭文字）
export default function ProfilePhoto({ profile, label, size = "md" }: Props) {
  return profile.photo ? (
    // eslint-disable-next-line @next/next/no-img-element -- 端末内で縮小した画像を表示するため
    <img src={profile.photo} alt={label} className={`${sizes[size]} shrink-0 rounded-full object-cover`} />
  ) : (
    <span
      className={`${sizes[size]} ${profile.color} flex shrink-0 items-center justify-center rounded-full font-bold text-white`}
      aria-label={label}
    >
      {label.slice(0, 1)}
    </span>
  );
}
