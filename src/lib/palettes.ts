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
    // Vibrant Spectrum — pure & bright.
    colors: [
      "#e8202a", // Scarlet Red
      "#f47b20", // Tangerine Orange
      "#ffd200", // Sunny Yellow
      "#00a651", // Emerald Green
      "#2244bb", // Sapphire Blue
      "#7b3fa0", // Amethyst Purple
      "#e5007e", // Fuchsia Pink
    ],
  },
  {
    id: "vibrant-jungle",
    name: "Vibrant Jungle",
    // Tropical.
    colors: [
      "#1a9c5b", // Emerald
      "#17a2a0", // Turquoise
      "#b5348a", // Magenta
      "#c9a227", // Gold
      "#8bc34a", // Lime
      "#f57c00", // Orange
      "#303f9f", // Indigo
    ],
  },
  {
    id: "organic-blossom",
    name: "Organic Blossom",
    // Natural.
    colors: [
      "#a3b18a", // Sage Green
      "#dda0a0", // Blush Pink
      "#b05c3b", // Rust
      "#f2c6a0", // Peach
      "#6b7a3a", // Moss Green
      "#a97c86", // Mauve
      "#c98a2e", // Ochre
    ],
  },
  {
    id: "minimalist-calm",
    name: "Minimalist Calm",
    // Serene.
    colors: [
      "#a9bcc4", // Dusty Blue
      "#d3d3d0", // Light Gray
      "#efe6d0", // Cream
      "#cbb79a", // Warm Beige
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
      "#2a3b6b", // Night Blue
      "#d98ba5", // Rose
      "#b3a0d6", // Lavender
      "#3a2e7a", // deep Indigo
    ],
  },
  {
    id: "desert-harmony",
    name: "Desert Harmony",
    // Earth Tones.
    colors: [
      "#b3591f", // Burnt Sienna
      "#d9b98c", // Sand
      "#b56a4f", // Clay
      "#6e7038", // Olive
      "#c9a227", // Mustard
      "#b5624a", // Adobe
      "#2f7a70", // Teal
    ],
  },
  {
    id: "oceanic-breeze",
    name: "Oceanic Breeze",
    // Cool.
    colors: [
      "#4bbfc4", // Aqua
      "#9ed6c0", // Seafoam
      "#7fb5e0", // Sky Blue
      "#1f3a5f", // Navy
      "#e88a70", // Coral
      "#b8e0c8", // Mint
      "#9aa6e0", // Periwinkle
    ],
  },
  {
    id: "dunhuang-oasis",
    name: "Dunhuang Oasis",
    // Grotto Pigments.
    colors: [
      "#c48a3a", // Cave Ochre
      "#7a9b86", // Grotto Celadon
      "#b5533f", // Mural Copper-Red
      "#6b7f92", // Lead Grey-Blue
      "#c8321f", // Cinnabar Red
      "#2f7a52", // Malachite Green
      "#8a5a3c", // Apsara Brown
      "#2b2620", // Temple Black
    ],
  },
]

export const DEFAULT_PALETTE_ID = "jianing-rainbow"

export const DEFAULT_PALETTE: Palette =
  PALETTES.find((p) => p.id === DEFAULT_PALETTE_ID) ?? PALETTES[0]
