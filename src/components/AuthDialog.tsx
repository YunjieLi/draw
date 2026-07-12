import { useEffect, useState } from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"

type Props = {
  open: boolean
  onClose: () => void
  // Called once the user is authenticated (sign in succeeded).
  onAuthed?: () => void
}

export function AuthDialog({ open, onClose, onAuthed }: Props) {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Reset transient state whenever the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      setError(null)
      setNotice(null)
      setBusy(false)
    }
  }, [open])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === "signin") {
        await signIn(email, password)
        onAuthed?.()
        onClose()
      } else {
        await signUp(email, password)
        // Depending on project settings the user may need to confirm email.
        onAuthed?.()
        setNotice(
          "Account created. If email confirmation is enabled, check your inbox to finish."
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border bg-background p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">
            {mode === "signin" ? "Sign in" : "Create account"}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Password
            <input
              type="password"
              required
              minLength={6}
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {notice && <p className="text-sm text-emerald-600">{notice}</p>}

          <Button type="submit" disabled={busy} className="mt-1">
            {busy
              ? "Please wait…"
              : mode === "signin"
                ? "Sign in"
                : "Sign up"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
          <button
            type="button"
            className="font-medium text-foreground underline-offset-4 hover:underline"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin")
              setError(null)
              setNotice(null)
            }}
          >
            {mode === "signin" ? "Create one" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  )
}

const inputClass = cn(
  "h-9 rounded-md border border-input bg-background px-3 text-sm font-normal",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background"
)
