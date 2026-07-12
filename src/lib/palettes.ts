// Named color palettes for the paint layer. Each is a curated set of swatches
// (black is deliberately excluded — that's reserved for the line-art layer).
// The picker in ColorPalette lets the user switch between them; the default is
// "Jianing Rainbow" (the pure & bright spectrum).

export type Palette = {
  id: string
  name: string
  colors: readonly string[]
}

export const PALETTES: readonly Palette[] = [
  {
    id: "jianing-rainbow",
    name: "Jianing Rainbow",
    // Vibrant Spectrum — pure & bright. Kept full; only the pink is softened.
    colors: [
      "#e8202a", // Scarlet Red
      "#f47b20", // Tangerine Orange
      "#ffd200", // Sunny Yellow
      "#00a651", // Emerald Green
      "#3b82f6", // Blue (lighter)
      "#7b3fa0", // Amethyst Purple
      "#f0569c", // Pink (softened)
    ],
  },
  {
    id: "minimalist-calm",
    name: "Minimalist Calm",
    // Serene.
    colors: [
      "#a9bcc4", // Dusty Blue
      "#efe6d0", // Cream
      "#6b7c85", // Slate
      "#a99a86", // Taupe
      "#b96a4f", // Terracotta
    ],
  },
  {
    id: "cosmic-fantasy",
    name: "Cosmic Fantasy",
    // Dreamy.
    colors: [
      "#7b3fb5", // Violet
      "#1f7a8c", // Teal
      "#d4a72c", // Gold
      "#d98ba5", // Rose
      "#b3a0d6", // Lavender
      "#3a2e7a", // deep Indigo
    ],
  },
  {
    id: "dunhuang-oasis",
    name: "Dunhuang Oasis",
    // Grotto Pigments.
    colors: [
      "#c48a3a", // Cave Ochre
      "#7a9b86", // Grotto Celadon
      "#c8321f", // Cinnabar Red
      "#6b7f92", // Lead Grey-Blue
      "#2f7a52", // Malachite Green
      "#2b2620", // Temple Black
    ],
  },
]

export const DEFAULT_PALETTE_ID = "jianing-rainbow"

export const DEFAULT_PALETTE: Palette =
  PALETTES.find((p) => p.id === DEFAULT_PALETTE_ID) ?? PALETTES[0]
