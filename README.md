# Draw

A playground for symmetry, pattern, and freeform sketching.

The landing page presents a gallery of drawing modes (placeholders for now):

- **Free Form** — an open canvas with no rules.
- **Mandala** — radial symmetry that blooms every stroke around a center.
- **Repetitive Tiles** — draw once, repeat across a seamless grid.
- **Mirror** — reflect every line across an axis for instant balance.

## Stack

- [Vite](https://vitejs.dev/) + React + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) with [shadcn/ui](https://ui.shadcn.com/) components (light, minimalist theme)

## Develop

```bash
npm install
npm run dev      # start the dev server
npm run build    # typecheck + production build to dist/
npm run preview  # preview the production build
```

## Backend (Supabase)

Anyone can save a drawing to a gallery — no login. On first load the app signs
each visitor in as an anonymous **guest** (Supabase Anonymous Auth), so every
browser gets its own gallery. This is optional: the drawing modes work fully
offline, and the Save / Gallery UI only appears once Supabase is configured.

> **Login is intentionally punted.** A real email/account flow can be layered on
> later; the anonymous guest can be upgraded to a permanent account in place. The
> unused [`src/components/AuthDialog.tsx`](src/components/AuthDialog.tsx) and the
> `signIn`/`signUp` helpers in [`src/lib/auth.tsx`](src/lib/auth.tsx) are left as
> scaffolding for that.

Data model:

- **Auth** — anonymous guest sessions (each browser = one guest user).
- **`drawings` table** — one row per saved drawing (`mode`, `title`, `storage_path`), protected by Row Level Security so each guest only sees their own.
- **`drawings` storage bucket** — the rendered PNGs, written under `<user_id>/<uuid>.png`.

### Setup

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. In the dashboard, open **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql), and **Run**. This creates the
   table, storage bucket, and access policies.
3. Enable guest sessions: **Authentication → Sign In / Providers → Anonymous
   sign-ins → on**. (Without this, drawing still works but saving is disabled.)
4. Copy your project credentials from **Project Settings → API**:

   ```bash
   cp .env.example .env.local
   # then edit .env.local — use the plain Project URL, NOT the REST URL:
   #   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   #   VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
   ```

5. Restart `npm run dev` (Vite reads env vars at startup). The **Gallery** and
   **Save** controls now appear.

The anon key and URL are safe to expose in the client bundle — all access is
enforced server-side by the RLS policies in `supabase/schema.sql`.

## Status

The four drawing modes are functional. Saving to a per-guest gallery is wired up
through Supabase (see above); real user accounts are a future addition.
