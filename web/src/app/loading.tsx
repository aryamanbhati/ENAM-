import { CardSkeleton, HeaderSkeleton, HeroSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <HeroSkeleton />
      <CardSkeleton rows={4} />
    </>
  );
}
