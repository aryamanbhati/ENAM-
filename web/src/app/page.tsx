// Day 1 skeleton. The real Today screen (window picker, three tiers, swipe stack) lands on Friday.
export default function Today() {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-[max(env(safe-area-inset-top),2rem)]">
      <header className="flex items-baseline justify-between border-b border-line pb-3">
        <h1 className="font-serif text-2xl tracking-tight">FINN</h1>
        <span className="text-xs text-muted">{today}</span>
      </header>

      <section className="flex flex-1 flex-col justify-center gap-3 pb-24">
        <p className="font-serif text-3xl leading-tight">Nothing needs you yet.</p>
        <p className="text-sm text-muted">
          Your portfolio digest is being wired up. Filings are already being read and sorted into what needs you, what
          is worth knowing, and what is routine.
        </p>
      </section>

      <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-bg/90 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto flex max-w-md justify-around py-3 text-xs">
          <li className="font-medium">Today</li>
          <li className="text-muted">Portfolio</li>
          <li className="text-muted">Research</li>
        </ul>
      </nav>
    </main>
  );
}
