// Landing page enhancements.
// Modes are placeholders for now — each card links back here until built.

// Build a small mandala preview: mirror the base petal around the center.
const mandala = document.querySelector(".thumb-mandala .petals");
if (mandala) {
  const base = mandala.innerHTML;
  const spokes = 8;
  let out = "";
  for (let i = 0; i < spokes; i++) {
    out += `<g transform="rotate(${(360 / spokes) * i})">${base}</g>`;
  }
  mandala.innerHTML = out;
}

// Build a repetitive-tiles preview grid.
const tiles = document.querySelector(".thumb-tiles .tile-grid");
if (tiles) {
  const cols = 3;
  const rows = 3;
  const size = 120 / cols;
  let out = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * size;
      const y = r * size;
      out += `<path d="M${x + 6},${y + size - 6} q${size / 2 - 6},-${size} ${size - 12},0" />`;
    }
  }
  tiles.innerHTML = out;
}

// Placeholder interaction: announce the mode instead of navigating.
document.querySelectorAll(".mode-card").forEach((card) => {
  card.addEventListener("click", (e) => {
    e.preventDefault();
    const mode = card.dataset.mode.replace(/-/g, " ");
    card.classList.add("pulse");
    setTimeout(() => card.classList.remove("pulse"), 300);
    console.log(`Mode "${mode}" coming soon.`);
  });
});
