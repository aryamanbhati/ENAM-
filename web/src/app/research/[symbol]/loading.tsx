import { CardSkeleton, HeaderSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <div className="mt-6 grid grid-cols-2 gap-2">
        <div className="sk h-20" />
        <div className="sk h-20" />
        <div className="sk h-20" />
        <div className="sk h-20" />
      </div>
      <CardSkeleton rows={3} />
    </>
  );
}
