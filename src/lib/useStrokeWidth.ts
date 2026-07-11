import { useEffect, useRef } from "react"

// Stroke width in device-independent pixels: thinner on small screens (below
// Tailwind's `sm` breakpoint) where fingers are the input, thicker on desktop.
// Returns a ref so drawing code can read the current value without re-rendering.
export function useStrokeWidth() {
  const ref = useRef(8)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)")
    const update = () => {
      ref.current = mq.matches ? 4 : 8
    }
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return ref
}
