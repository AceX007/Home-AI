/** Whole-path glob. Star stays in one segment. Star-star slash may match zero directories. */
const META = /[.+^$()|{}[\]\\?]/g

function toRegExp(pat) {
  const body = pat
    .replace(META, function (ch) {
      return '\\' + ch
    })
    .replace(/\*\*\//g, '(?:.*/)?' )
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\\\?/g, '[^/]')
  return new RegExp('^' + body + '$')
}

export function matchGlob(path, glob) {
  const p = String(path || '').split('\\').join('/')
  const g = String(glob || '').split('\\').join('/').replace(/^\.\//, '')
  if (!p || !g || g.length > 200 || p.indexOf('\0') >= 0 || g.indexOf('\0') >= 0) return false
  const patterns = g.startsWith('**/') ? [g, g.slice(3)] : [g]
  return patterns.some(function (pat) {
    return toRegExp(pat).test(p)
  })
}
