"use client"

import * as React from "react"
import { Toaster as Sonner } from "sonner"

import { useTheme } from "@/app/theme"

type ToasterProps = React.ComponentProps<typeof Sonner>

/** Toast host. Follows the app theme (app/theme), not next-themes. */
const Toaster = ({ ...props }: ToasterProps) => {
  const { resolved } = useTheme()

  return (
    <Sonner
      theme={resolved}
      className="toaster group"
      position="bottom-right"
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
