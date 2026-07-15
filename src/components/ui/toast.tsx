import { useSyncExternalStore } from "react"
import { AlertCircle, Check, X } from "lucide-react"

import { cn } from "@/lib/utils"

type Toast = {
  id: number
  message: string
  variant: "success" | "error"
  // Optional trailing link (e.g. "View" → the gallery).
  action?: { label: string; href: string }
}

// Minimal single-toast store: fire-and-forget from anywhere via toast(); the
// one <Toaster /> at the app root renders whatever is current. A new toast
// replaces the previous one, so there's no stacking to manage.
let current: Toast | null = null
let nextId = 1
let hideTimer: number | undefined
const listeners = new Set<() => void>()

const emit = () => listeners.forEach((l) => l())

export function toast(t: Omit<Toast, "id">) {
  current = { ...t, id: nextId++ }
  emit()
  window.clearTimeout(hideTimer)
  // Errors linger longer so the message can actually be read.
  hideTimer = window.setTimeout(dismiss, t.variant === "error" ? 5000 : 3000)
}

function dismiss() {
  current = null
  emit()
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const getSnapshot = () => current

// Renders the active toast as a floating pill under the header. Mount once at
// the app root.
export function Toaster() {
  const t = useSyncExternalStore(subscribe, getSnapshot)
  if (!t) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center px-4 sm:top-20">
      <div
        // Re-keying on id restarts the entrance animation when one toast
        // replaces another.
        key={t.id}
        role={t.variant === "error" ? "alert" : "status"}
        className={cn(
          // Always dark, so it reads as an overlay regardless of the app theme.
          "pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-zinc-900 py-2 pl-3 pr-1.5 text-sm text-zinc-50 shadow-lg",
          "animate-in fade-in slide-in-from-top-2 duration-200"
        )}
      >
        {t.variant === "success" ? (
          <Check className="h-4 w-4 shrink-0 text-emerald-400" />
        ) : (
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
        )}
        <span className="truncate">{t.message}</span>
        {t.action && (
          <a
            href={t.action.href}
            onClick={dismiss}
            className="shrink-0 font-medium text-zinc-100 underline underline-offset-2 hover:text-white"
          >
            {t.action.label}
          </a>
        )}
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismiss}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
