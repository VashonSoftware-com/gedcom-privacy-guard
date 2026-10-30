// The overview above a long list of flagged notes: a bar per category,
// each a button that shows only that category's notes.
// SVG attributes only (no inline styles): the CSP blocks them.

/** Plain names for the rule categories (rules.yaml). */
export const CATEGORY_LABELS: Record<string, string> = {
  identity_numbers: "ID numbers",
  contact_details: "Phones and emails",
  submitter: "Your own details",
  local_path: "Paths on your computer",
  already_private: "Already marked private",
  mental_health: "Mental health",
  substance_use: "Drinking and drugs",
  legal_sensitive: "Crime and scandal",
  unverified_claims: "Rumors",
  family_secrets: "Family secrets",
  medical: "Illness",
  security_questions: "Security answers",
  street_address: "Street addresses",
};

export const categoryLabel = (c: string) => CATEGORY_LABELS[c] ?? c.replace(/_/g, " ");

export function CategoryChart({
  counts,
  active,
  onPick,
}: {
  counts: [string, number][];
  active: string | null;
  onPick: (category: string | null) => void;
}) {
  const max = Math.max(1, ...counts.map(([, n]) => n));
  return (
    <figure className="chart">
      <figcaption>Notes flagged in each category. Click one to see only those notes.</figcaption>
      {counts.map(([cat, n]) => {
        const on = active === cat;
        const label = categoryLabel(cat);
        return (
          <button
            key={cat}
            className={`bar ${on ? "on" : ""}`}
            aria-pressed={on}
            title={`${n.toLocaleString()} ${n === 1 ? "note" : "notes"} flagged for ${label.toLowerCase()}`}
            onClick={() => onPick(on ? null : cat)}
          >
            <span className="bar-label">{label}</span>
            <svg viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true">
              <rect x="0" y="1" width={Math.max(1, (n / max) * 100)} height="10" rx="1" />
            </svg>
            <span className="bar-count">{n.toLocaleString()}</span>
          </button>
        );
      })}
    </figure>
  );
}
