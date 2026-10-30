// The parts of the page shown before a file is chosen: what the tool is
// for, in plain words, and a picture of what happens to a tree file.
// No inline styles anywhere: the CSP (public/_headers) blocks them.

import type { ReactElement } from "react";

const DOCS = "https://github.com/VashonSoftware-com/gedcom-privacy-guard/blob/main/docs";

export function Features() {
  return (
    <ul className="features">
      <li>
        <strong>Free.</strong> No account, no ads, no catch.
      </li>
      <li>
        <strong>Open source.</strong> Anyone can read the code.
      </li>
      <li>
        <strong>Your tree never leaves your computer.</strong> Nothing is uploaded.
      </li>
      <li>
        <strong>Works with Wi-Fi off.</strong> Once this page has loaded, you can switch off the internet.
      </li>
      <li>
        <strong>Any family tree program.</strong> Legacy, RootsMagic, Family Tree Maker, Gramps, Ancestry and more.
      </li>
      <li>
        <strong>Clean it before you share it.</strong> Before you publish your tree online, give a copy to your children, or
        bring in someone else's research.
      </li>
    </ul>
  );
}

/** The kinds of note the guard turns away, each with a small picture. */
const OUSTED: { label: string; example: string; icon: ReactElement }[] = [
  {
    label: "Crime and prison",
    example: "“arrested for bootlegging”",
    icon: (
      // A jailbird: a round bird in prison stripes.
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <ellipse cx="24" cy="28" rx="15" ry="13" fill="#fffdf8" stroke="#20221f" strokeWidth="2.5" />
        <path d="M11 24h26M10 30h28M12 36h24" stroke="#20221f" strokeWidth="3" />
        <circle cx="30" cy="20" r="2.2" fill="#20221f" />
        <path d="M38 22l7 2-7 3z" fill="#e2b73d" stroke="#20221f" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M14 16l4-6 4 6" fill="none" stroke="#20221f" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Drinking and drugs",
    example: "“a notorious drunkard”",
    icon: (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path
          d="M20 4h8v10c0 3 6 6 6 12v16c0 2-2 3-3 3H17c-1 0-3-1-3-3V26c0-6 6-9 6-12z"
          fill="#8fb39a"
          stroke="#20221f"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <rect x="16" y="26" width="16" height="10" fill="#fffdf8" stroke="#20221f" strokeWidth="2" />
        <path d="M19 29l10 4M29 29l-10 4" stroke="#9b2c2c" strokeWidth="2" />
      </svg>
    ),
  },
  {
    label: "Mental illness",
    example: "“sent to the insane asylum”",
    icon: (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path
          d="M12 30c-6-2-6-12 0-14 0-8 10-10 13-5 4-4 13-2 13 5 6 2 6 12 0 14-1 6-9 8-13 4-4 4-12 2-13-4z"
          fill="#d8cde8"
          stroke="#20221f"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path d="M25 12v24" stroke="#20221f" strokeWidth="2" />
      </svg>
    ),
  },
  {
    label: "Family rumors",
    example: "“rumored to have a second family”",
    icon: (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path
          d="M6 10h36v22H22l-9 8v-8H6z"
          fill="#ffe28a"
          stroke="#20221f"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <text x="24" y="26" textAnchor="middle" fontSize="11" fontFamily="Georgia, serif" fill="#20221f">
          psst…
        </text>
      </svg>
    ),
  },
  {
    label: "ID numbers",
    example: "“SSN 123-45-6789”",
    icon: (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <rect x="4" y="11" width="40" height="26" rx="4" fill="#cfe0f0" stroke="#20221f" strokeWidth="2.5" />
        <circle cx="15" cy="22" r="4" fill="#20221f" />
        <path d="M9 31c1-4 11-4 12 0M25 19h14M25 25h14M25 31h10" stroke="#20221f" strokeWidth="2.5" />
      </svg>
    ),
  },
  {
    label: "Phones, emails, your address",
    example: "“call me at 206-555-0100”",
    icon: (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <rect x="5" y="12" width="38" height="26" rx="3" fill="#fffdf8" stroke="#20221f" strokeWidth="2.5" />
        <path d="M5 14l19 14 19-14" fill="none" stroke="#20221f" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
    ),
  },
];

function TreeFile({ clean }: { clean?: boolean }) {
  return (
    <svg viewBox="0 0 64 80" aria-hidden="true" className="filepic">
      <path d="M6 4h38l14 14v58H6z" fill="#fffdf8" stroke="#20221f" strokeWidth="3" strokeLinejoin="round" />
      <path d="M44 4v14h14" fill="none" stroke="#20221f" strokeWidth="3" strokeLinejoin="round" />
      {/* a little family tree */}
      <path d="M32 26v10M20 36h24M20 36v8M44 36v8M32 44v-8" stroke="#2c4a3e" strokeWidth="2.5" fill="none" />
      <circle cx="32" cy="24" r="4" fill="#2c4a3e" />
      <circle cx="20" cy="47" r="4" fill="#2c4a3e" />
      <circle cx="44" cy="47" r="4" fill="#2c4a3e" />
      {clean ? (
        <>
          <circle cx="46" cy="64" r="11" fill="#2c4a3e" />
          <path d="M40 64l4 4 8-8" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <path d="M14 58h36M14 64h30M14 70h34" stroke="#9b2c2c" strokeWidth="3" strokeDasharray="5 3" />
      )}
    </svg>
  );
}

export function HowItWorks() {
  return (
    <section className="how">
      <h2>How it works</h2>
      <figure className="flow">
        <div className="flow-row">
          <div className="flow-step">
            <TreeFile />
            <span>Your tree file</span>
          </div>
          <div className="flow-arrow" aria-hidden="true">
            ➜
          </div>
          <div className="flow-step guard">
            <img src="/logo.svg" alt="" width="130" height="130" />
            <span>The guard reads every note</span>
          </div>
          <div className="flow-arrow" aria-hidden="true">
            ➜
          </div>
          <div className="flow-step">
            <TreeFile clean />
            <span>A cleaned copy, ready to share</span>
          </div>
        </div>
        <figcaption>
          <span className="ousted-title">…and shows these notes the door, if you say so:</span>
          <ul className="ousted">
            {OUSTED.map((o) => (
              <li key={o.label}>
                {o.icon}
                <span>
                  <strong>{o.label}</strong>
                  <em>{o.example}</em>
                </span>
              </li>
            ))}
          </ul>
        </figcaption>
      </figure>
      <ol className="steps">
        <li>
          <strong>Choose your file.</strong> It's opened right here in your browser, not sent anywhere.
        </li>
        <li>
          <strong>Look at what it found.</strong> Each note that might be sensitive is shown with the worrying words
          highlighted. For each one, choose <em>keep</em>, <em>remove</em> or <em>rewrite</em>.
        </li>
        <li>
          <strong>Save the cleaned copy.</strong> Your original file is never changed.
        </li>
      </ol>
      <p>
        It looks for words, not meaning, so it can miss things ("she took her own life" isn't flagged; "suicide" is).
        It doesn't yet warn about living people; that's coming. Names, dates and places are never changed.{" "}
        <a href={`${DOCS}/what-it-can-do.md`} target="_blank" rel="noreferrer">
          What it can and can't do, in detail
        </a>
      </p>
    </section>
  );
}

export function Offline() {
  return (
    <section className="offline">
      <h2>Use it with no internet at all</h2>
      <p>
        After your first visit, this page keeps a copy of itself on your computer, so it opens and works even in
        airplane mode. That's an easy way to see for yourself that your tree goes nowhere.
      </p>
      <p>
        To keep it handy like a program, <strong>install it</strong>: in Chrome or Edge, click the install button at
        the right end of the address bar. On an iPhone or iPad, tap Share, then <em>Add to Home Screen</em>.
      </p>
    </section>
  );
}
