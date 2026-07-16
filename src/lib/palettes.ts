// Named color palettes for the paint layer. Each is a curated set of swatches
// (black is deliberately excluded — that's reserved for the line-art layer).
// The picker in ColorPalette lets the user switch between them; the default is
// "Basic".

export type Palette = {
  id: string
  name: string
  colors: readonly string[]
}

export const PALETTES: readonly Palette[] = [
  {
    id: "basic",
    name: "Basic",
    colors: [
      "#D91F26", // Crimson Red
      "#E8388C", // Hot Pink
      "#C97B8B", // Dusty Rose
      "#F2731A", // Vivid Orange
      "#FAD126", // Sunshine Yellow
      "#219959", // Emerald Green
      "#266633", // Forest Green
      "#2E8CD9", // Sky Blue
      "#8033A6", // Royal Purple
      "#8C5426", // Warm Brown
      "#1F1F21", // Dark Charcoal
      "#F8F2EB", // Warm White — kept last
    ],
  },
  {
    id: "traditional-chinese",
    name: "传统中国色",
    // Traditional Chinese art pigments.
    colors: [
      "#FF4D00", // 朱红 Vermilion
      "#9B2335", // 胭脂 Rouge
      "#F0C239", // 缃色 Pale Yellow
      "#B4884D", // 雌黄 Orpiment
      "#45465E", // 青黛 Indigo Grey
      "#206864", // 石绿 Malachite
      "#5F7956", // 砂绿 Sand Green
      "#5AA4AE", // 天水碧 Sky-Water Cyan
      "#7BCFA6", // 石青 Azurite Green
      "#51626D", // 墨色 Ink Grey
      "#95553A", // 赭色 Ochre
      "#D6EDF1", // 月白 Moon White
    ],
  },
  {
    id: "pastel",
    name: "Pastel",
    colors: [
      "#F4AFA6", // Coral Blush
      "#F5D3B8", // Peach Cream
      "#F5E6C0", // Vanilla Custard
      "#EEE8A9", // Lemon Chiffon
      "#D5DDAB", // Pistachio
      "#C0D3C3", // Sage Mist
      "#B0CFC9", // Seafoam
      "#B5D0E8", // Powder Blue
      "#A8B6D9", // Periwinkle
      "#C9B8D9", // Lavender Haze
      "#E8C3CF", // Rose Quartz
      "#D8D4CE", // Warm Gray
    ],
  },
]

export const DEFAULT_PALETTE_ID = "basic"

export const DEFAULT_PALETTE: Palette =
  PALETTES.find((p) => p.id === DEFAULT_PALETTE_ID) ?? PALETTES[0]
