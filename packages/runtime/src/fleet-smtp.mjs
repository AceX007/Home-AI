import { createConnection } from 'node:net'
import { connect as tlsConnect } from 'node:tls'
import { takeEmail, takePlainLine, takeSmtpHop } from './fleet.mjs'

function b64(s) {
  return Buffer.from(s, 'utf8').toString('base64')
}

function connectHop(hop) {
  if (hop.host === '127.0.0.1') {
    return createConnection({ host: hop.host, port: hop.port })
  }
  return tlsConnect({ host: hop.host, port: hop.port, servername: hop.host })
}

/** Allowlisted Proton Bridge / Tuta only. No renderer-chosen hosts. */
export async function sendAllowlistedSmtp(opts) {
  const hop = takeSmtpHop(opts?.host, opts?.port)
  if (!hop) throw new Error('smtp host not allowlisted')
  const from = takeEmail(opts?.from)
  const to = takeEmail(opts?.to)
  const user = takeEmail(opts?.user)
  const pass = String(opts?.pass || '')
  const subject = takePlainLine(opts?.subject, 80) || 'Notice'
  const body = String(opts?.body || '').replace(/\r/g, '').slice(0, 4000)
  if (!from || !to || !user || pass.length < 4 || !body) throw new Error('bad smtp mail')

  const sock = connectHop(hop)
  sock.setTimeout(12_000)
  const lines = []
  let buf = ''
  const read = () =>
    new Promise((resolve, reject) => {
      const onData = (d) => {
        buf += String(d)
        const parts = buf.split(/\r?\n/)
        buf = parts.pop() ?? ''
        for (const line of parts) {
          lines.push(line)
          if (/^\d{3} /.test(line)) {
            sock.off('data', onData)
            resolve(line)
            return
          }
        }
      }
      sock.on('data', onData)
      sock.once('error', reject)
      sock.once('timeout', () => reject(new Error('smtp timeout')))
    })
  const write = (s) =>
    new Promise((resolve, reject) => {
      sock.write(s, (err) => (err ? reject(err) : resolve()))
    })

  try {
    await read()
    await write('EHLO homeai.local\r\n')
    await read()
    await write('AUTH PLAIN ' + b64(`\u0000${user}\u0000${pass}`) + '\r\n')
    const auth = await read()
    if (!/^235/.test(auth)) throw new Error('smtp auth failed')
    await write(`MAIL FROM:<${from}>\r\n`)
    await read()
    await write(`RCPT TO:<${to}>\r\n`)
    await read()
    await write('DATA\r\n')
    await read()
    const msg = `From: ${from}\r\nTo: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}\r\n.\r\n`
    await write(msg)
    await read()
    await write('QUIT\r\n')
  } finally {
    sock.destroy()
  }
  return { ok: true }
}
