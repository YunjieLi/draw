// Decode a template image for drawing onto a canvas.
//
// The bundled coloring pages are SVGs authored with only a `viewBox` and no
// width/height. Chromium infers a size, but iOS/Safari refuses to rasterize
// such an SVG via `drawImage` (it comes back 0×0 and paints nothing) — which is
// why bundled templates failed to load on iPad. We work around it by fetching
// the SVG, injecting explicit width/height from its viewBox, and loading that.
// PNG data-URL templates (from the creator) already have intrinsic dimensions
// and pass straight through.
export async function decodeTemplateImage(
  src: string
): Promise<HTMLImageElement> {
  let resolvedSrc = src
  let objectUrl: string | null = null

  if (isSvgSource(src)) {
    try {
      const text = await fetch(src).then((r) => r.text())
      const sized = ensureSvgIntrinsicSize(text)
      objectUrl = URL.createObjectURL(
        new Blob([sized], { type: "image/svg+xml" })
      )
      resolvedSrc = objectUrl
    } catch {
      // Fall back to the original URL if the fetch/patch fails.
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      resolve(img)
    }
    img.onerror = (e) => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      reject(e)
    }
    img.src = resolvedSrc
  })
}

function isSvgSource(src: string): boolean {
  return /\.svg(\?|#|$)/i.test(src) || src.startsWith("data:image/svg")
}

// Give an SVG explicit width/height (from its viewBox) if it lacks them, so it
// has an intrinsic size every browser will rasterize.
function ensureSvgIntrinsicSize(svg: string): string {
  const tag = svg.match(/<svg[^>]*>/i)?.[0]
  if (!tag) return svg
  if (/\bwidth\s*=/.test(tag) && /\bheight\s*=/.test(tag)) return svg
  const vb = tag.match(
    /viewBox\s*=\s*["']\s*[\d.+-]+\s+[\d.+-]+\s+([\d.+-]+)\s+([\d.+-]+)\s*["']/i
  )
  if (!vb) return svg
  const sized = tag.replace(/<svg/i, `<svg width="${vb[1]}" height="${vb[2]}"`)
  return svg.replace(tag, sized)
}
