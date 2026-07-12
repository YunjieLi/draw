import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { Session, User } from "@supabase/supabase-js"

import { isSupabaseConfigured, supabase } from "@/lib/supabase"

type AuthContextValue = {
  session: Session | null
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    // Subscribe first so we catch the session from the guest sign-in below.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      if (data.session) {
        setSession(data.session)
        setLoading(false)
        return
      }
      // No session yet. Sign the visitor in as an anonymous guest so saving and
      // the gallery work without a login step. Requires "Anonymous sign-ins" to
      // be enabled in the Supabase dashboard (Authentication → Sign In / Providers).
      if (!isSupabaseConfigured) {
        setLoading(false)
        return
      }
      const { error } = await supabase.auth.signInAnonymously()
      if (error) {
        // eslint-disable-next-line no-console
        console.warn(
          "Guest sign-in failed — enable Anonymous sign-ins in the Supabase " +
            `dashboard to allow saving. (${error.message})`
        )
        setLoading(false)
      }
      // On success, onAuthStateChange delivers the new session.
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
      },
      async signUp(email, password) {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
      },
      async signOut() {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
      },
    }),
    [session, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}
