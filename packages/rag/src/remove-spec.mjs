/** Exact document path plus its `#chunk:` rows. Never a raw LIKE prefix. */
export function takeRagRemoveSpec(rel) {
  const s = String(rel ?? '')
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
  if (!s || s.startsWith('/') || s.split('/').includes('..')) return null
  const like = `${s.replace(/[%_\\]/g, (ch) => `\\${ch}`)}#chunk:%`
  return { path: s, like }
}
