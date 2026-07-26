/**
 * Brand fonts for Satori (next/og). Satori needs raw TTF data — woff2 is
 * unsupported — so we ask the Google Fonts css2 API with a legacy user agent
 * (no woff2 support) and pull the TTF URL out of the returned CSS. Fetched
 * once per server process.
 */

const LEGACY_UA = "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:1.0)";

async function fetchGoogleFontTtf(family: string, weight: number): Promise<ArrayBuffer> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`;
  const css = await (
    await fetch(cssUrl, { headers: { "User-Agent": LEGACY_UA } })
  ).text();
  const match = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/);
  if (!match?.[1]) throw new Error(`no ttf url in css2 response for ${family}`);
  const res = await fetch(match[1]);
  if (!res.ok) throw new Error(`font fetch failed for ${family}: ${res.status}`);
  return res.arrayBuffer();
}

let cached: Promise<{ grotesk: ArrayBuffer; mono: ArrayBuffer }> | null = null;

export function loadOgFonts() {
  cached ??= (async () => {
    const [grotesk, mono] = await Promise.all([
      fetchGoogleFontTtf("Space Grotesk", 700),
      fetchGoogleFontTtf("Space Mono", 700),
    ]);
    return { grotesk, mono };
  })();
  return cached;
}
