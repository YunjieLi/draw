import { createClient } from "@supabase/supabase-js"

// These are safe to expose in the client bundle: the anon key only grants the
// access allowed by the database's Row Level Security policies (see
// supabase/schema.sql). Configure them in a local .env.local file.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// A missing config shouldn't crash the whole app — the drawing modes work
// offline. `isSupabaseConfigured` lets the UI degrade gracefully instead.
export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    "Supabase is not configured. Copy .env.example to .env.local and fill in " +
      "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable saving drawings."
  )
}

// When unconfigured we still create a client with placeholder values so imports
// don't throw; any call will simply fail and is guarded by isSupabaseConfigured.
export const supabase = createClient(
  url ?? "http://localhost:54321",
  anonKey ?? "public-anon-key"
)

// Storage bucket that holds the rendered PNGs.
export const DRAWINGS_BUCKET = "drawings"

// Storage bucket that holds the shared library's template PNGs.
export const LINEARTS_BUCKET = "linearts"
