import { useEffect, useRef, useState } from 'react'
import { HxEmpty } from '../layout/HxPage'
import { useWorkbench } from '../store/useWorkbench'

export default function BrowserPane() {
  const w = useWorkbench()
  const frame = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState('https://docs.cursor.com')
  const [saved, setSaved] = useState('')
  const [navErr, setNavErr] = useState('')
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false)

  const report = () => {
    const el = frame.current
    if (!el) return
    const r = el.getBoundingClientRect()
    void window.homeai.browserShow({
      x: Math.round(r.x),
      y: Math.round(r.y),
      width: Math.max(100, Math.round(r.width)),
      height: Math.max(100, Math.round(r.height))
    })
  }

  useEffect(() => {
    report()
    const ro = new ResizeObserver(report)
    if (frame.current) ro.observe(frame.current)
    window.addEventListener('resize', report)
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', report)
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
      void window.homeai.browserHide()
    }
  }, [])

  const go = async () => {
    setNavErr('')
    try {
      await window.homeai.browserNavigate(url)
      report()
    } catch (e) {
      setNavErr(String(e instanceof Error ? e.message : e).replace(/[<>]/g, '').slice(0, 160))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div className="hx-toolbar">
        <input value={url} onChange={(e) => setUrl(e.target.value)} aria-label="URL" />
        <button type="button" className="ghost" onClick={() => void go()}>
          Go
        </button>
        <button
          type="button"
          className="ghost"
          onClick={async () => {
            const cap = await window.homeai.browserExtract()
            setSaved(cap.saved)
            await w.refreshGrounds()
          }}
        >
          Capture → RAG
        </button>
      </div>
      {offline ? <div className="warn-banner">This PC is offline. Go waits until a network is back.</div> : null}
      {navErr ? <div className="warn-banner">{navErr}</div> : null}
      {saved ? <div className="warn-banner">Saved {saved}</div> : null}
      <div ref={frame} className="browser-host">
        <HxEmpty
          title={navErr ? 'Page did not load' : offline ? 'Browser is offline' : 'No page yet'}
          body={
            navErr
              ? 'The address stayed text. Native BrowserView stays on the last good page, if any.'
              : offline
                ? 'Paste an http(s) URL. Go runs when this PC is online.'
                : 'Paste a URL and hit Go. Native BrowserView attaches here. Capture writes the page into RAG. Leave Browser to hide the overlay so other panes are not covered.'
          }
        />
      </div>
    </div>
  )
}
