export default function Loading() {
  return (
    <section className="space-y-4">
      <div>
        <div className="h-8 w-32 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white"
          />
        ))}
      </div>
    </section>
  );
}
