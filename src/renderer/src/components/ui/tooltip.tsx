"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Tooltip as TooltipPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function CursorTooltip({
  children,
  content,
  className,
  contentClassName,
  focusable = true,
}: {
  children: React.ReactNode
  content: React.ReactNode
  className?: string
  contentClassName?: string
  focusable?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const pointRef = React.useRef({ x: 0, y: 0 })
  const tooltipId = React.useId()

  const positionAt = React.useCallback((x: number, y: number) => {
    pointRef.current = { x, y }
    const element = contentRef.current
    if (!element) return
    const gap = 34
    const margin = 8
    const width = element.offsetWidth
    const height = element.offsetHeight
    let left = x + gap
    let top = y + gap
    if (left + width > window.innerWidth - margin) left = x - width - gap
    if (top + height > window.innerHeight - margin) top = window.innerHeight - height - margin
    element.style.transform = `translate3d(${Math.max(margin, left)}px, ${Math.max(margin, top)}px, 0)`
  }, [])

  React.useLayoutEffect(() => {
    if (open) positionAt(pointRef.current.x, pointRef.current.y)
  }, [open, positionAt])

  return (
    <>
      <span
        tabIndex={focusable ? 0 : undefined}
        data-game-cursor="detail"
        aria-describedby={open ? tooltipId : undefined}
        className={cn("inline-block outline-none", className)}
        onMouseEnter={(event) => {
          pointRef.current = { x: event.clientX, y: event.clientY }
          setOpen(true)
        }}
        onMouseMove={(event) => positionAt(event.clientX, event.clientY)}
        onMouseLeave={() => {
          setOpen(false)
        }}
        onFocus={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          pointRef.current = { x: rect.right, y: rect.bottom }
          setOpen(true)
        }}
        onBlur={() => setOpen(false)}
      >
        {children}
      </span>
      {open ? createPortal(
        <div
          ref={contentRef}
          id={tooltipId}
          role="tooltip"
          className={cn(
            "pointer-events-none fixed top-0 left-0 z-50 max-w-72 rounded-lg border border-border/80 bg-popover/95 px-3.5 py-2.5 text-xs leading-5 text-pretty text-popover-foreground shadow-xl shadow-black/25 backdrop-blur-md",
            contentClassName
          )}
        >
          {content}
        </div>,
        document.body
      ) : null}
    </>
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 8,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-fit origin-(--radix-tooltip-content-transform-origin) animate-in rounded-lg border border-border/80 bg-popover/95 px-3.5 py-2.5 text-xs leading-5 text-pretty text-popover-foreground shadow-xl shadow-black/25 backdrop-blur-md fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-popover fill-popover" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { CursorTooltip, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
