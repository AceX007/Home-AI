import { parentPort, workerData } from 'node:worker_threads'
import { TsIntelligence, takeTsCallMethod, takeTsQuery, takeTsRequest } from './index.mjs'

function own(raw, key) {
  return Boolean(raw && typeof raw === 'object' && !Array.isArray(raw) && Object.prototype.hasOwnProperty.call(raw, key))
}

const root = typeof workerData?.root === 'string' ? workerData.root : ''
const host = new TsIntelligence(root)

parentPort.on('message', (msg) => {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return
  const op = own(msg, 'op') ? String(msg.op) : ''
  if (op === 'cancel') {
    host.setGeneration(own(msg, 'gen') ? msg.gen : msg.seq)
    return
  }
  if (op === 'overlay') {
    if (typeof msg.path === 'string' && typeof msg.text === 'string') {
      host.update(msg.path, msg.text, own(msg, 'version') ? msg.version : undefined)
    }
    return
  }
  if (op === 'close') {
    if (typeof msg.path === 'string') host.close(msg.path)
    return
  }
  if (op === 'dispose') {
    host.dispose()
    return
  }
  if (op === 'call') {
    const seq = Number(msg.seq) || 0
    const method = takeTsCallMethod(own(msg, 'method') ? msg.method : '')
    const req = takeTsRequest(own(msg, 'request') ? msg.request : null)
    if (!method || !req) {
      parentPort.postMessage({ seq, result: method === 'hover' ? null : [] })
      return
    }
    let result
    try {
      result = host[method](req)
    } catch {
      result = method === 'hover' ? null : []
    }
    parentPort.postMessage({ seq, result })
    return
  }
  if (op !== 'workspaceSymbols') return
  const seq = Number(msg.seq) || 0
  const gen = Number.isFinite(msg.gen) ? Math.floor(Number(msg.gen)) : seq
  host.setGeneration(gen)
  const query = takeTsQuery(own(msg, 'query') ? msg.query : '')
  let rows = []
  try {
    rows = host.workspaceSymbols(query, { seq: gen })
  } catch {
    rows = []
  }
  parentPort.postMessage({
    seq,
    cancelled: host.cancelled(gen),
    rows: host.cancelled(gen) ? [] : rows
  })
})
