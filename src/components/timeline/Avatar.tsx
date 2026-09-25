import type { FamilyMember } from "@/lib/mockData";

type Props = {
  member: FamilyMember;
  size?: "sm" | "md" | "lg" | "xl";
};

const sizeClasses = {
  sm: "h-8 w-8 text-base",
  md: "h-10 w-10 text-xl",
  lg: "h-14 w-14 text-3xl",
  xl: "h-28 w-28 text-6xl",
};

export default function Avatar({ member, size = "md" }: Props) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full ${member.color} ${sizeClasses[size]}`}
      aria-label={member.name}
    >
      {member.emoji}
    </span>
  );
}
