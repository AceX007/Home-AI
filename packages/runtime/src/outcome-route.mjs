/** Browser-safe provider routing. Never import Node-only runtime modules here. */

export function outcomeRoute(input) {
  const o = input && typeof input === 'object' ? input : {}
  const localOk = o.localOk === true
  const hasCloud = o.hasCloud === true
  const hasSidecar = o.hasSidecar === true
  const verifyOk = o.verifyOk !== false
  if (!localOk && hasCloud) return 'cloud'
  if (!verifyOk && hasSidecar) return 'sidecar'
  if (!verifyOk && hasCloud) return 'cloud'
  return 'local'
}
