// Registry of the read-only line-art coloring pages shipped in src/linearts.
//
// The SVGs are bundled as separate, cache-friendly asset files (import.meta.glob
// with `?url`) rather than inlined, so they load lazily and don't bloat the app
// bundle. They're served from the app's own origin, so drawing one onto a canvas
// doesn't taint it — the colored result can still be exported via toBlob() on
// save. Aspect ratios aren't known here; the coloring view reads them from the
// decoded image at runtime.

type UrlMap = Record<string, string>

const urls = import.meta.glob("../linearts/*.svg", {
  query: "?url",
  import: "default",
  eager: true,
}) as UrlMap

export type LineArt = {
  id: string
  label: string
  src: string
}

// "rainbow-balloon" -> "Rainbow balloon"
function toLabel(id: string): string {
  const spaced = id.replace(/[-_]+/g, " ")
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export const LINEARTS: LineArt[] = Object.entries(urls)
  .map(([path, src]) => {
    const id = path.split("/").pop()!.replace(/\.svg$/, "")
    return { id, label: toLabel(id), src }
  })
  .sort((a, b) => a.label.localeCompare(b.label))
