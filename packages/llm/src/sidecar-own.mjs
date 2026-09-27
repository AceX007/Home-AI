/** Sidecar never claims a leftover /health. 2B may still attach to its own port on restart. */
export function shouldAttachExistingListener(opts) {
  const o = opts && typeof opts === 'object' ? opts : {}
  if (o.sidecar) return false
  return Boolean(o.portOpen)
}

/** Running + integer port from a manager we started. Foreign listeners must not look owned. */
export function ownedLlamaPort(status) {
  if (!status || status.running !== true) return null
  const port = Number(status.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null
  return port
}

/** Tab/FIM prefers an owned coder sidecar; renderer never chooses the port. */
export function pickInfillPort(coder, orchestrator, fallback = 8765) {
  const coderPort = ownedLlamaPort(coder)
  if (coderPort != null) return coderPort
  const orch = ownedLlamaPort(orchestrator)
  if (orch != null) return orch
  const fb = Number(fallback)
  if (Number.isInteger(fb) && fb > 0 && fb <= 65535) return fb
  return 8765
}
