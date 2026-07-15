import type { DrawingMode } from "@/lib/drawings"
import { defaultParams, type SymParams } from "@/lib/symmetry"

// A one-shot hand-off for loading a template into a coloring mode. Picking a
// template in the "From template" modal publishes it here and navigates to the
// target mode; that mode (via useDrawingCanvas) consumes it — on mount if we
// navigated to a different mode, or via the subscription if it was already the
// active one. The template carries its symmetry settings so coloring lines up
// with the drawn lines. Bundled/imported assets default to free-form.

type PendingTemplate = { src: string; mode: DrawingMode; params: SymParams }

export type ConsumedTemplate = { src: string; params: SymParams }

let pending: PendingTemplate | null = null
const listeners = new Set<() => void>()

// Publish a template for `mode` and route there. If already on that mode the
// component won't remount, so subscribers are notified to consume it.
export function publishTemplate(
  src: string,
  mode: DrawingMode,
  params: SymParams = defaultParams()
) {
  pending = { src, mode, params }
  window.location.hash = `#/${mode}`
  listeners.forEach((fn) => fn())
}

// If a template is waiting for `mode`, hand it over and clear it; else null.
export function consumeTemplateFor(mode: DrawingMode): ConsumedTemplate | null {
  if (pending && pending.mode === mode) {
    const { src, params } = pending
    pending = null
    return { src, params }
  }
  return null
}

export function subscribeTemplate(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
