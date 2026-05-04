export default function Loading() {
  return (
    <section className="space-y-6">
      <div>
        <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-40 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white"
          />
        ))}
      </div>
      <div className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-2xl border border-slate-200 bg-white"
          />
        ))}
      </div>
    </section>
  );
}
