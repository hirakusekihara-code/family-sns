import type { FamilyMember } from "@/lib/mockData";

type Props = {
  member: FamilyMember;
  size?: "sm" | "md";
};

export default function Avatar({ member, size = "md" }: Props) {
  const sizeClass = size === "sm" ? "h-8 w-8 text-base" : "h-10 w-10 text-xl";
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full ${member.color} ${sizeClass}`}
      aria-label={member.name}
    >
      {member.emoji}
    </span>
  );
}
