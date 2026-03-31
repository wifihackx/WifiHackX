export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function escapeAttr(value) {
  return escapeHtml(value);
}

export function sanitizeHttpUrl(value, fallback = '', baseOrigin = window.location.origin) {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;

  try {
    const parsed = new URL(raw, baseOrigin);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch (_e) {}

  return fallback;
}

export function findByDataAttr(attrName, expectedValue, selector = `[${attrName}]`) {
  if (expectedValue == null) return null;
  const normalized = String(expectedValue);
  return (
    Array.from(document.querySelectorAll(selector)).find(
      node => node.getAttribute(attrName) === normalized
    ) || null
  );
}

export function findAllByDataAttr(attrName, expectedValue, selector = `[${attrName}]`) {
  if (expectedValue == null) return [];
  const normalized = String(expectedValue);
  return Array.from(document.querySelectorAll(selector)).filter(
    node => node.getAttribute(attrName) === normalized
  );
}

export function findAllByDataAttrs(selector, expectedAttrs) {
  const entries = Object.entries(expectedAttrs || {}).map(([key, value]) => [key, String(value)]);
  return Array.from(document.querySelectorAll(selector)).filter(node =>
    entries.every(([key, value]) => node.getAttribute(key) === value)
  );
}
