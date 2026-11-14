/**
 * Shimmer skeletons used by every route's loading.tsx. They match the shell
 * of the real page (header + card stack) so there is no layout shift when
 * the server finishes rendering.
 */
export function HeaderSkeleton() {
  return (
    <div className="flex flex-col gap-3 pt-[max(env(safe-area-inset-top),1rem)] pb-2">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="sk h-7 w-40" />
          <div className="sk mt-2 h-3 w-24" />
        </div>
        <div className="sk h-11 w-11 rounded-full" />
      </div>
    </div>
  );
}

export function HeroSkeleton({ height = 220 }: { height?: number }) {
  return <div className="sk mt-4" style={{ height, borderRadius: 28 }} />;
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="mt-5 space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 rounded-[22px] border border-line bg-surface p-4">
          <div className="sk h-10 w-10 shrink-0 rounded-[12px]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="sk h-4 w-5/6" />
            <div className="sk h-3 w-3/6" />
          </div>
          <div className="sk h-6 w-16 rounded-full" />
        </li>
      ))}
    </ul>
  );
}
