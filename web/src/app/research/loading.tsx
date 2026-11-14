import { CardSkeleton, HeaderSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <div className="mt-6 space-y-2">
        <div className="sk h-6 w-3/4" />
        <div className="sk h-4 w-5/6" />
      </div>
      <CardSkeleton rows={5} />
    </>
  );
}
