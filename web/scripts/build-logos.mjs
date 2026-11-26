// Makes the site's logo images from the crest artwork, in two versions:
//   - with the ribbon, lettered "GEDCOMTools.com" (brand/ribbon-lettering.svg)
//   - plain: no ribbon, the shield drawn to its point
// The source (brand/orca-crest-source.svg) is layered: background, the
// orca and shield, the family shield, the ribbon, its lettering and
// rounded corners. This removes or replaces layers; it never edits pixels.
// The ribbon hid the bottom of the shield, so the plain version draws that
// part (rim, gold band and point) along the shield's own measured edges.
//
//   node scripts/build-logos.mjs
//
// Writes public/logo.webp, public/logo-plain.webp, the favicon and app
// icons, and full-size PNGs of both versions in brand/.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BRAND = join(WEB, "brand");
const PUBLIC = join(WEB, "public");

let src = readFileSync(join(BRAND, "orca-crest-source.svg"), "utf8");

// Layers of the source, by the clip path each one starts with.
const MAIN = '<g clip-path="url(#7737ca1e73)">'; // orca and big shield
const FAMILY = '<g clip-path="url(#4bd8ac9fa4)">'; // small family shield
const RIBBON = '<g clip-path="url(#f52de0acd6)">';
const CORNERS = '<g clip-path="url(#275d1bbeb3)">'; // rounded corners, then the lettering
for (const layer of [MAIN, FAMILY, RIBBON, CORNERS]) {
  if (!src.includes(layer)) throw new Error(`orca-crest-source.svg has changed: no layer ${layer}`);
}

const NAVY = "rgb(22,43,64)";
const TEAL = "rgb(24,56,80)";
const CREAM = "rgb(247,242,226)";
const GOLD = "rgb(193,146,74)";

// Square corners, navy to the edge: drop the corner and lettering layers,
// and paint the canvas navy instead of white.
src = src.slice(0, src.indexOf(CORNERS)) + "</svg>";
src = src.replaceAll('fill="#ffffff"', `fill="${NAVY}"`);

// The middle of the shield's gold band (930 x 930 units), measured on the
// artwork down to where the ribbon covered it (y 708), then carried on to
// the point.
const LEFT = [
  [202, 448], [204.5, 464], [208, 484], [212.5, 500], [217.5, 516], [224.5, 532], [231.5, 548], [240, 564], [249.5, 580],
  [262, 596], [274.5, 612], [287, 628], [295.5, 636], [303.5, 644], [312, 652], [321, 660],
  [331, 668], [341, 676], [352, 684], [363.5, 692], [376, 700], [388, 708],
  [401.5, 716], [416, 724], [432, 732], [449, 741], [465, 750],
];
const RIGHT = [
  [728.5, 448], [725.5, 464], [721.5, 484], [717, 500], [711.5, 516], [705.5, 532], [698, 548], [689.5, 564], [679.5, 580],
  [668.5, 596], [656, 612], [641.5, 628], [634.5, 636], [626, 644], [618, 652], [608.5, 660],
  [599, 668], [588.5, 676], [577, 684], [565.5, 692], [553, 700], [540.5, 708],
  [527, 716], [513, 724], [497, 732], [481, 741],
];
const edge = "M" + [...LEFT, ...RIGHT.reverse()].map((p) => p.join(" ")).join(" L");
const around = "M100 448H830V870H100Z"; // the area round the shield's lower half

function plain() {
  let svg = src.slice(0, src.indexOf(RIBBON)) + "</svg>";
  // Under the artwork: cover the ribbon's shadow in the background, and
  // fill the shield's point.
  const under = `<rect x="30" y="480" width="870" height="380" fill="${NAVY}"/><path d="${edge}Z" fill="${TEAL}"/>`;
  // Over it: clear what stuck out below the shield (cut off flat where the
  // ribbon began), then the cream rim outside the band, then the band.
  // It fades in from y 452 to 490, so there's no seam where it meets the
  // drawn border above.
  const over =
    `<g mask="url(#pg-fade)">` +
    `<path d="${around} ${edge}Z" fill-rule="evenodd" fill="${NAVY}"/>` +
    `<path d="${edge}" fill="none" stroke="${CREAM}" stroke-width="50" stroke-linejoin="round" clip-path="url(#pg-outside)"/>` +
    `<path d="${edge}" fill="none" stroke="${GOLD}" stroke-width="16" stroke-linejoin="round"/>` +
    `</g>`;
  const defs =
    `<linearGradient id="pg-ramp" gradientUnits="userSpaceOnUse" x1="0" y1="452" x2="0" y2="490">` +
    `<stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient>` +
    `<mask id="pg-fade" maskUnits="userSpaceOnUse" x="0" y="0" width="930" height="930">` +
    `<rect x="0" y="448" width="930" height="482" fill="url(#pg-ramp)"/></mask>` +
    `<clipPath id="pg-outside"><path clip-rule="evenodd" d="${around} ${edge}Z"/></clipPath>`;
  return svg.replace("</defs>", defs + "</defs>").replace(MAIN, under + MAIN).replace(FAMILY, over + FAMILY);
}

function ribbon() {
  const lettering = readFileSync(join(BRAND, "ribbon-lettering.svg"), "utf8").match(/<path[^>]*\/>/)[0];
  return src.replace(/<\/svg>$/, lettering + "</svg>");
}

const render = (svg) => sharp(Buffer.from(svg), { limitInputPixels: false });
const VERSIONS = { scroll: ribbon(), plain: plain() };

for (const [name, svg] of Object.entries(VERSIONS)) {
  await render(svg).resize(1024).png({ palette: true, quality: 95, compressionLevel: 9 }).toFile(join(BRAND, `logo-${name}.png`));
}

const webp = { quality: 88, effort: 6 };
await render(VERSIONS.scroll).resize(320).webp(webp).toFile(join(PUBLIC, "logo.webp"));
await render(VERSIONS.plain).resize(320).webp(webp).toFile(join(PUBLIC, "logo-plain.webp"));

// Icons use the plain crest: the lettering can't be read that small. The
// favicon is cropped closer, so the orca still shows at 16 pixels.
const icons = [
  ["apple-touch-icon.png", 180],
  ["icon-192.png", 192],
  ["icon-512.png", 512],
];
for (const [file, size] of icons) {
  await render(VERSIONS.plain).resize(size).png({ palette: true, quality: 95, compressionLevel: 9 }).toFile(join(PUBLIC, file));
}
const full = await render(VERSIONS.plain).resize(930).png().toBuffer();
await sharp(full).extract({ left: 95, top: 50, width: 740, height: 740 }).resize(64).png({ palette: true, quality: 95, compressionLevel: 9 }).toFile(join(PUBLIC, "favicon.png"));

console.log("logos written");
