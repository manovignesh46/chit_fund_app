"use client"

import * as React from "react"
import { Toaster as Sonner } from "sonner"

import { useTheme } from "@/app/theme"

type ToasterProps = React.ComponentProps<typeof Sonner>

/** True while a dialog or sheet is open (Radix sets data-state="open" on it). */
function useDialogOpen() {
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => {
    const check = () => setOpen(!!document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'))
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state'] })
    return () => observer.disconnect()
  }, [])
  return open
}

/**
 * Toast host. Follows the app theme (app/theme), not next-themes.
 * Bottom right, kept above the phone/tablet bottom bar (--bottom-nav-height, 0 from
 * lg). While a dialog or bottom sheet is open, toasts move to the top so they never
 * cover the sheet's buttons.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { resolved } = useTheme()
  const dialogOpen = useDialogOpen()

  return (
    <Sonner
      theme={resolved}
      className="toaster group"
      position={dialogOpen ? "top-center" : "bottom-right"}
      offset={{ bottom: "calc(var(--bottom-nav-height, 0px) + 16px)", right: 16, top: 16, left: 16 }}
      mobileOffset={{ bottom: "calc(var(--bottom-nav-height, 0px) + 12px)", top: "calc(env(safe-area-inset-top, 0px) + 12px)", left: 12, right: 12 }}
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:[&_[data-icon]]:text-success-text",
          error: "group-[.toaster]:[&_[data-icon]]:text-destructive-text",
          warning: "group-[.toaster]:[&_[data-icon]]:text-warning-text",
          info: "group-[.toaster]:[&_[data-icon]]:text-info-text",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
