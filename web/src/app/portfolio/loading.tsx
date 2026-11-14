import { CardSkeleton, HeaderSkeleton, HeroSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <HeroSkeleton height={160} />
      <CardSkeleton rows={6} />
    </>
  );
}
