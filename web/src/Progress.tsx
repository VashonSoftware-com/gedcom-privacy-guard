// A progress ring with an orca swimming round it. With a fraction, the
// orca sits at the leading edge and the ring fills behind it; without
// one (while the checker itself loads), it just swims round and round.
// SVG attributes only: the CSP blocks inline styles.

const R = 50;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** A small orca, side on, facing right: the way it swims at the top of a clockwise ring. */
function Orca() {
  return (
    <g className="orca">
      <path d="M-16 1c4-8 20-10 30-4 4 2 4 6 0 7-9 5-23 5-30-3z" fill="#20221f" />
      <path d="M-3-5l-3-12 9 11z" fill="#20221f" />
      <path d="M-15 1l-8-6 2 6-2 6z" fill="#20221f" />
      <path d="M-6 5c6 3 14 2 19-2-6 0-13 0-19 2z" fill="#fff" />
      <ellipse cx="8" cy="-2" rx="3.2" ry="1.4" fill="#fff" />
      <path d="M1 4l-3 6 7-4z" fill="#20221f" />
    </g>
  );
}

export function Progress({ fraction, label }: { fraction?: number; label: string }) {
  const known = fraction !== undefined;
  const pct = known ? Math.round(fraction * 100) : undefined;
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="track" cx="60" cy="60" r={R} />
        {known && (
          <circle
            className="fill"
            cx="60"
            cy="60"
            r={R}
            strokeDasharray={`${(fraction * CIRCUMFERENCE).toFixed(1)} ${CIRCUMFERENCE.toFixed(1)}`}
            transform="rotate(-90 60 60)"
          />
        )}
        <g className={known ? undefined : "swim"} transform={known ? `rotate(${(fraction * 360).toFixed(1)} 60 60)` : undefined}>
          <g transform={`translate(60 ${60 - R}) scale(1.5)`}>
            <Orca />
          </g>
        </g>
        {known && (
          <text x="60" y="67" textAnchor="middle" className="pct">
            {pct}%
          </text>
        )}
      </svg>
      <span>{label}</span>
    </div>
  );
}
