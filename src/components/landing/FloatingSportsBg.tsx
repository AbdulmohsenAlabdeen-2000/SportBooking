// Decorative drifting sports icons behind the landing-page hero. Pure
// SVG + CSS keyframes — no extra runtime, no JS. Hidden under
// `motion-reduce` so users with the OS-level reduced-motion preference
// see a static gradient.

const ICONS = [
  // Padel / tennis racket-ish abstract: a rounded rectangle with a
  // grid of strings. Distinct enough to read as "racket".
  {
    key: "padel",
    style:
      "left-[6%] top-[12%] h-16 w-16 md:h-24 md:w-24 animate-float-slow [animation-delay:0s]",
    path: (
      <g>
        <rect
          x="22"
          y="6"
          width="20"
          height="40"
          rx="10"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <line x1="22" y1="14" x2="42" y2="14" stroke="currentColor" strokeWidth="1" />
        <line x1="22" y1="22" x2="42" y2="22" stroke="currentColor" strokeWidth="1" />
        <line x1="22" y1="30" x2="42" y2="30" stroke="currentColor" strokeWidth="1" />
        <line x1="22" y1="38" x2="42" y2="38" stroke="currentColor" strokeWidth="1" />
        <line x1="28" y1="6" x2="28" y2="46" stroke="currentColor" strokeWidth="1" />
        <line x1="36" y1="6" x2="36" y2="46" stroke="currentColor" strokeWidth="1" />
        <line x1="32" y1="46" x2="32" y2="58" stroke="currentColor" strokeWidth="3" />
      </g>
    ),
  },
  // Tennis ball — circle with the curved seam.
  {
    key: "tennis",
    style:
      "right-[8%] top-[18%] h-12 w-12 md:h-20 md:w-20 animate-float-medium [animation-delay:1s]",
    path: (
      <g>
        <circle
          cx="32"
          cy="32"
          r="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <path
          d="M 12 24 Q 32 32 52 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M 12 40 Q 32 32 52 40"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </g>
    ),
  },
  // Football — a hexagon-pentagon pattern circle, classic.
  {
    key: "football",
    style:
      "left-[14%] bottom-[18%] h-14 w-14 md:h-20 md:w-20 animate-float-fast [animation-delay:0.5s]",
    path: (
      <g>
        <circle
          cx="32"
          cy="32"
          r="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <polygon
          points="32,16 41,22 38,32 26,32 23,22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <line x1="32" y1="16" x2="32" y2="10" stroke="currentColor" strokeWidth="1.5" />
        <line x1="41" y1="22" x2="48" y2="20" stroke="currentColor" strokeWidth="1.5" />
        <line x1="23" y1="22" x2="16" y2="20" stroke="currentColor" strokeWidth="1.5" />
        <line x1="38" y1="32" x2="44" y2="40" stroke="currentColor" strokeWidth="1.5" />
        <line x1="26" y1="32" x2="20" y2="40" stroke="currentColor" strokeWidth="1.5" />
      </g>
    ),
  },
  // Shuttlecock — a triangle-feather body with a head.
  {
    key: "shuttle",
    style:
      "right-[14%] bottom-[14%] h-12 w-12 md:h-20 md:w-20 animate-float-medium [animation-delay:1.5s]",
    path: (
      <g>
        <circle
          cx="32"
          cy="46"
          r="6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <path
          d="M 26 42 L 12 12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M 30 40 L 22 8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M 34 40 L 42 8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M 38 42 L 52 12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>
    ),
  },
  // Bonus padel mid-right
  {
    key: "padel-2",
    style:
      "right-[40%] top-[6%] h-10 w-10 md:h-14 md:w-14 animate-float-slow [animation-delay:2s]",
    path: (
      <g>
        <rect
          x="22"
          y="6"
          width="20"
          height="40"
          rx="10"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <line x1="22" y1="14" x2="42" y2="14" stroke="currentColor" strokeWidth="1" />
        <line x1="22" y1="22" x2="42" y2="22" stroke="currentColor" strokeWidth="1" />
        <line x1="22" y1="30" x2="42" y2="30" stroke="currentColor" strokeWidth="1" />
        <line x1="22" y1="38" x2="42" y2="38" stroke="currentColor" strokeWidth="1" />
        <line x1="28" y1="6" x2="28" y2="46" stroke="currentColor" strokeWidth="1" />
        <line x1="36" y1="6" x2="36" y2="46" stroke="currentColor" strokeWidth="1" />
        <line x1="32" y1="46" x2="32" y2="58" stroke="currentColor" strokeWidth="3" />
      </g>
    ),
  },
];

export function FloatingSportsBg() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden text-white/15 motion-reduce:hidden"
    >
      {ICONS.map((icon) => (
        <svg
          key={icon.key}
          viewBox="0 0 64 64"
          className={`absolute ${icon.style}`}
          fill="none"
        >
          {icon.path}
        </svg>
      ))}
    </div>
  );
}
