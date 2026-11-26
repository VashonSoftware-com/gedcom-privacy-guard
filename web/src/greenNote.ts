// Vashon Software's renewable-energy note, as at the foot of its other
// sites, with the same globe icon. Used by the app's footer (App.tsx) and
// the pages made from the docs (scripts/doc-pages.ts). Fixed text, no
// user data, so it's safe to insert as HTML.

export const GLOBE_SVG =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/>' +
  '<path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';

export const GREEN_NOTE_HTML =
  "Vashon Software's own servers have run on wind and hydro power since 2001. This site is hosted on " +
  '<a href="https://www.cloudflare.com/impact/" target="_blank" rel="noreferrer">Cloudflare</a>, ' +
  "which buys renewable energy to match all the electricity its network uses each year. " +
  "And 0.5% of every payment to Vashon Software goes to carbon removal through " +
  '<a href="https://stripe.com/climate" target="_blank" rel="noreferrer">Stripe Climate</a>.';
