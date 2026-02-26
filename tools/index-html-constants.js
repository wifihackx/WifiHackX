export const SITE_ORIGIN = 'https://wifihackx.com';
const SCANNER_URL = 'scanner.html';
const DEFAULT_LOCALE_PATH = '/es/';
const CANONICAL_URL = `${SITE_ORIGIN}${DEFAULT_LOCALE_PATH}`;
export const LANGUAGE_SEO = [
  { lang: 'es', locale: 'es_ES', path: '/es/' },
  { lang: 'en', locale: 'en_US', path: '/en/' },
  { lang: 'fr', locale: 'fr_FR', path: '/fr/' },
  { lang: 'de', locale: 'de_DE', path: '/de/' },
  { lang: 'it', locale: 'it_IT', path: '/it/' },
  { lang: 'pt', locale: 'pt_PT', path: '/pt/' },
  { lang: 'ru', locale: 'ru_RU', path: '/ru/' },
  { lang: 'zh', locale: 'zh_CN', path: '/zh/' },
  { lang: 'ja', locale: 'ja_JP', path: '/ja/' },
  { lang: 'ko', locale: 'ko_KR', path: '/ko/' },
];

export function buildHrefLangTags() {
  const lines = LANGUAGE_SEO.map(
    item => `    <link rel="alternate" href="${SITE_ORIGIN}${item.path}" hreflang="${item.lang}">`
  );
  lines.push(`    <link rel="alternate" href="${SITE_ORIGIN}/" hreflang="x-default">`);
  return lines.join('\n');
}

export function buildOgLocaleAlternateTags() {
  return LANGUAGE_SEO.filter(item => item.locale !== 'es_ES')
    .map(item => `    <meta property="og:locale:alternate" content="${item.locale}">`)
    .join('\n');
}

export function applyIndexHtmlConstants(html) {
  const hreflangRegex = /<!-- SEO_HREFLANG_START -->[\s\S]*?<!-- SEO_HREFLANG_END -->/;
  const ogLocaleRegex =
    /<!-- SEO_OG_LOCALE_ALTERNATES_START -->[\s\S]*?<!-- SEO_OG_LOCALE_ALTERNATES_END -->/;

  let next = html.replace(
    hreflangRegex,
    `<!-- SEO_HREFLANG_START -->\n${buildHrefLangTags()}\n    <!-- SEO_HREFLANG_END -->`
  );
  next = next.replace(
    ogLocaleRegex,
    `<!-- SEO_OG_LOCALE_ALTERNATES_START -->\n${buildOgLocaleAlternateTags()}\n    <!-- SEO_OG_LOCALE_ALTERNATES_END -->`
  );
  next = next.replaceAll('__SCANNER_URL__', SCANNER_URL);
  next = next.replaceAll('__CANONICAL_URL__', CANONICAL_URL);
  next = next.replaceAll('__OG_URL__', CANONICAL_URL);
  return next;
}
