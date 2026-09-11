import { fallbackCover, knownCover } from "./cover-analysis";

export const DISPLAY_KEY = "cabinet.display.v1";
export const LAYOUTS = ["coverflow", "shelf", "stack"];
export const SORTS = ["library", "spectrum", "creator", "title"];
export const DEFAULT_DISPLAY = {
  book: { layout: "shelf", sort: "library" },
  movie: { layout: "coverflow", sort: "library" },
  mobile3D: false,
};
export function normalizeDisplay(value) {
  return {
    ...Object.fromEntries(
      ["book", "movie"].map((type) => [
        type,
        {
          layout: LAYOUTS.includes(value?.[type]?.layout)
            ? value[type].layout
            : DEFAULT_DISPLAY[type].layout,
          sort: SORTS.includes(value?.[type]?.sort)
            ? value[type].sort
            : DEFAULT_DISPLAY[type].sort,
        },
      ]),
    ),
    mobile3D: value?.mobile3D === true,
  };
}
// Stacks' spectrum order: saturated colours by hue, then neutrals by lightness.
function spectrumKey(color) {
  if (color.startsWith("hsl")) return Number(color.match(/[\d.]+/)?.[0] || 0);
  const rgb = color
    .match(/[a-f\d]{2}/gi)
    ?.map((part) => parseInt(part, 16) / 255);
  if (!rgb || rgb.length !== 3) return 1000;
  const [r, g, b] = rgb,
    high = Math.max(...rgb),
    low = Math.min(...rgb);
  const delta = high - low,
    light = (high + low) / 2;
  const saturation = delta ? delta / (1 - Math.abs(2 * light - 1)) : 0;
  if (saturation < 0.14) return 1000 + light;
  const hue =
    high === r
      ? ((g - b) / delta + 6) % 6
      : high === g
        ? (b - r) / delta + 2
        : (r - g) / delta + 4;
  return hue * 60;
}
export function arrangeCollection(items, sort, palette = {}) {
  if (!sort || sort === "library") return items;
  const titleOrder = (a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  return [...items].sort((a, b) => {
    if (sort === "title") return titleOrder(a, b);
    if (sort === "creator")
      return (
        (a.creator || "").localeCompare(b.creator || "", undefined, {
          sensitivity: "base",
        }) || titleOrder(a, b)
      );
    const color = (item) =>
      (
        palette[item.id] ||
        knownCover(item.image_url) ||
        fallbackCover(item.title)
      ).spine;
    return spectrumKey(color(a)) - spectrumKey(color(b)) || titleOrder(a, b);
  });
}
