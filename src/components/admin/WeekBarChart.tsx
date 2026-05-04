import { formatKuwaitWeekday } from "@/lib/time";

type Day = { date: string; bookings: number };

export function WeekBarChart({
  days,
  todayIso,
}: {
  days: Day[];
  todayIso: string;
}) {
  if (days.length === 0) {
    return (
      <div className="h-20 rounded-xl border border-dashed border-slate-200 bg-white" />
    );
  }

  const max = Math.max(1, ...days.map((d) => d.bookings));
  const W = 280;
  const H = 80;
  const PAD = 4;
  const colW = (W - PAD * 2) / days.length;
  const barW = Math.max(8, colW - 8);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <p className="px-1 text-xs font-medium text-slate-500">
        Bookings · last 7 days
      </p>
      <svg
        viewBox={`0 0 ${W} ${H + 18}`}
        className="mt-2 h-24 w-full"
        role="img"
        aria-label="Bookings over the last 7 days"
        preserveAspectRatio="none"
      >
        {days.map((d, i) => {
          const isToday = d.date === todayIso;
          const h = (d.bookings / max) * (H - 4);
          const x = PAD + i * colW + (colW - barW) / 2;
          const y = H - h;
          return (
            <g key={d.date}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(2, h)}
                rx={3}
                className={isToday ? "fill-brand" : "fill-slate-300"}
              >
                <title>{`${d.date}: ${d.bookings} bookings`}</title>
              </rect>
              <text
                x={x + barW / 2}
                y={H + 12}
                textAnchor="middle"
                className={`fill-slate-500 text-[8px] ${isToday ? "font-semibold" : ""}`}
              >
                {formatKuwaitWeekday(d.date)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
