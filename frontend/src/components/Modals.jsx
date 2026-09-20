import { useEffect, useRef } from 'react'
import { useUI } from '../store/useUI.js'

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
const focusablesIn = el => Array.from(el.querySelectorAll(FOCUSABLE)).filter(x => x.getClientRects().length > 0)

// One bottom sheet (or centered dialog) with swipe-to-dismiss.
function Sheet({ sheet, isTop }) {
  const { closeSheet } = useUI()
  const ref = useRef(null)
  const drag = useRef({ startY: null, delta: 0 })

  // FR-020/T083: move focus into the dialog, trap Tab/Shift+Tab inside it while it's the
  // topmost sheet, and hand focus back to whatever triggered it once it closes — a sheet
  // opened from inside another sheet restores to that sheet's own last-focused control, not
  // all the way back to the page.
  const restoreTo = useRef(null)
  useEffect(() => {
    restoreTo.current = document.activeElement
    return () => {
      const el = restoreTo.current
      if (el && document.contains(el) && typeof el.focus === 'function') el.focus()
    }
  }, [])
  useEffect(() => {
    if (!isTop) return
    const el = ref.current
    if (!el) return
    const items = focusablesIn(el)
    ;(items[0] || el).focus()
    const onKeyDown = e => {
      if (e.key === 'Escape') { if (!sheet.locked) closeSheet(sheet.id); return }
      if (e.key !== 'Tab') return
      const cur = focusablesIn(el)
      if (!cur.length) { e.preventDefault(); return }
      const first = cur[0], last = cur[cur.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    el.addEventListener('keydown', onKeyDown)
    return () => el.removeEventListener('keydown', onKeyDown)
  }, [isTop])

  const onTouchStart = e => {
    const el = ref.current
    // a gesture that begins on a slider (or opted-out control) belongs to that control,
    // not to the sheet's swipe-to-dismiss — so it keeps working while you drag
    if (e.target.closest && e.target.closest('input[type=range], [data-nodrag]')) {
      drag.current = { startY: null, delta: 0 }
      return
    }
    drag.current = { startY: el.scrollTop <= 0 ? e.touches[0].clientY : null, delta: 0 }
  }
  const onTouchMove = e => {
    const el = ref.current, d = drag.current
    if (d.startY === null) return
    d.delta = e.touches[0].clientY - d.startY
    if (d.delta > 0 && el.scrollTop <= 0) {
      e.preventDefault()
      el.style.transition = 'none'
      el.style.transform = `translateY(${d.delta}px)`
    } else d.delta = 0
  }
  const onTouchEnd = () => {
    const el = ref.current, d = drag.current
    if (d.startY === null) return
    el.style.transition = 'transform .2s'
    if (d.delta > 90 && !sheet.locked) { el.style.transform = 'translateY(110%)'; setTimeout(() => closeSheet(sheet.id), 180) }
    else el.style.transform = ''
    d.startY = null
  }

  // non-passive touchmove so preventDefault works (only fires for bottom sheets — centered
  // dialogs never get a touchstart to seed drag.current.startY)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => el.removeEventListener('touchmove', onTouchMove)
  }, [])

  const close = () => closeSheet(sheet.id)
  if (sheet.kind === 'center') {
    return (
      <div>
        <div className="mback" onClick={() => { if (!sheet.locked) close() }} />
        <div className="center" ref={ref} role="dialog" aria-modal="true" tabIndex={-1}>{sheet.render(close)}</div>
      </div>
    )
  }
  return (
    <div>
      <div className="mback" onClick={() => { if (!sheet.locked) close() }} />
      <div className="sheet" ref={ref} role="dialog" aria-modal="true" tabIndex={-1} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="grab" />
        {sheet.render(close)}
      </div>
    </div>
  )
}

export default function Modals() {
  const sheets = useUI(s => s.sheets)

  // lock the page behind any open sheet (iOS-safe)
  useEffect(() => {
    if (!sheets.length) return
    const y = window.scrollY || 0
    const b = document.body.style
    b.position = 'fixed'; b.top = -y + 'px'; b.left = '0'; b.right = '0'; b.width = '100%'
    return () => {
      b.position = b.top = b.left = b.right = b.width = ''
      window.scrollTo(0, y)
    }
  }, [sheets.length > 0])

  if (!sheets.length) return null
  return (
    <div id="modal-root" className="open">
      {sheets.map((s, i) => <Sheet key={s.id} sheet={s} isTop={i === sheets.length - 1} />)}
    </div>
  )
}
