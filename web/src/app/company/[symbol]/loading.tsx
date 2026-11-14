import { CardSkeleton, HeaderSkeleton, HeroSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <HeroSkeleton height={140} />
      <CardSkeleton rows={5} />
    </>
  );
}
