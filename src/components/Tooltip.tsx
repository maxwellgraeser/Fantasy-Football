import { useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  /** Trigger content. */
  children: ReactNode
  /** Tooltip / popover content. */
  content: ReactNode
  width?: number
  className?: string
}

/**
 * Hover/focus tooltip rendered in a portal with fixed positioning,
 * so it isn't clipped by scrolling table containers. Keyboard-accessible:
 * the trigger is focusable and Esc dismisses.
 */
export function Tooltip({ children, content, width = 260, className = '' }: TooltipProps) {
  const id = useId()
  const ref = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null)

  function show() {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const left = Math.min(Math.max(8, r.left + r.width / 2 - width / 2), window.innerWidth - width - 8)
    // Flip above when there isn't room below
    const above = r.bottom + 166 > window.innerHeight && r.top > 180
    setPos({ top: above ? r.top - 6 : r.bottom + 6, left, above })
  }

  const hide = () => setPos(null)

  return (
    <>
      <span
        ref={ref}
        tabIndex={0}
        aria-describedby={pos ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onKeyDown={(e) => { if (e.key === 'Escape') hide() }}
        className={`focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500 rounded-sm ${className}`}
      >
        {children}
      </span>
      {pos && createPortal(
        <div
          id={id}
          role="tooltip"
          style={{ top: pos.top, left: pos.left, width, transform: pos.above ? 'translateY(-100%)' : undefined }}
          className="fixed z-[60] pointer-events-none rounded-lg border border-slate-700 bg-[#1a1d27]
            px-3 py-2 text-xs font-normal normal-case tracking-normal text-left text-slate-300 shadow-xl"
        >
          {content}
        </div>,
        document.body,
      )}
    </>
  )
}

/** Column header label with a dotted underline and an explanatory tooltip. */
export function HeaderTooltip({ label, tip, width }: { label: ReactNode; tip: ReactNode; width?: number }) {
  return (
    <Tooltip content={tip} width={width} className="cursor-help underline decoration-dotted decoration-slate-600 underline-offset-4">
      {label}
    </Tooltip>
  )
}
