import type { DesignLayout } from '@homeai/core'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { applyHandleDelta } from '@homeai/runtime/browser'

export default function SelFrame({
  hostRef,
  sel,
  interact,
  tick,
  layout,
  onResize
}: {
  hostRef: { current: HTMLElement | null }
  sel: string | null
  interact: boolean
  tick: unknown
  layout?: DesignLayout
  onResize?: (next: DesignLayout, commit: boolean) => void
}) {
  const [box, setBox] = useState<{ t: number; l: number; w: number; h: number } | null>(null)
  const drag = useRef<{ k: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'; x: number; y: number; lay: DesignLayout } | null>(
    null
  )
  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host || !sel || interact || !/^[\w.-]{1,80}$/.test(sel)) {
      setBox(null)
      return
    }
    const el = host.querySelector(`[data-nid="${sel}"]`)
    const measure = () => {
      const h = hostRef.current
      if (!el || !h?.isConnected) {
        setBox(null)
        return
      }
      const a = el.getBoundingClientRect()
      const b = h.getBoundingClientRect()
      if (a.width < 4 || a.height < 4) {
        setBox(null)
        return
      }
      setBox({ t: a.top - b.top, l: a.left - b.left, w: a.width, h: a.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(host)
    if (el) ro.observe(el)
    return () => ro.disconnect()
  }, [hostRef, sel, interact, tick])
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current
      if (!d || !onResize) return
      onResize(applyHandleDelta(d.lay, d.k, e.clientX - d.x, e.clientY - d.y) as DesignLayout, false)
    }
    const up = () => {
      drag.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [onResize])
  if (!box) return null
  return (
    <div className="qs-sel-frame" style={{ top: box.t, left: box.l, width: box.w, height: box.h }} aria-hidden>
      {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const).map((k) => (
        <i
          key={k}
          className={`qs-h ${k}`}
          onPointerDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            drag.current = { k, x: e.clientX, y: e.clientY, lay: layout ?? { width: box.w, height: box.h } }
            onResize?.(applyHandleDelta(drag.current.lay, k, 0, 0) as DesignLayout, true)
          }}
        />
      ))}
    </div>
  )
}
