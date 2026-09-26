import type { Member } from "@/lib/family";

const sizes = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-base",
  lg: "h-14 w-14 text-xl",
  xl: "h-24 w-24 text-3xl",
};

// 家族の丸いアイコン（顔写真があれば写真、なければテーマカラーに頭文字）
export default function MemberAvatar({ member, size = "md" }: { member: Member; size?: keyof typeof sizes }) {
  return member.photo ? (
    // eslint-disable-next-line @next/next/no-img-element -- データベースに保存した縮小画像を表示するため
    <img src={member.photo} alt={member.name} className={`${sizes[size]} shrink-0 rounded-full object-cover`} />
  ) : (
    <span
      role="img"
      aria-label={member.name}
      className={`${sizes[size]} ${member.color} flex shrink-0 items-center justify-center rounded-full font-bold text-white`}
    >
      {member.name.slice(0, 1)}
    </span>
  );
}
