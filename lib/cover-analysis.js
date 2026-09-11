// Color buckets and the left-edge sampling come from Stacks' src/color.js.
// Cache by URL so the shelf and the shared detail object use identical geometry.
const cache = new Map();
const resolved = new Map();
export const knownCover = (url) => resolved.get(url);
export function fallbackCover(seed = "") {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return {
    aspectRatio: 2 / 3,
    spine: `hsl(${hash % 360} 18% 49%)`,
    top: `hsl(${hash % 360} 18% 44%)`,
    ink: "#fff",
  };
}
const hex = ({ r, g, b }) =>
  "#" +
  [r, g, b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("");
function dominant(data, width, x0, y0, w, h) {
  const buckets = new Map();
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      const [r, g, b] = data.slice(i, i + 3);
      const key = `${r >> 5},${g >> 5},${b >> 5}`;
      const entry = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
      entry.count++;
      entry.r += r;
      entry.g += g;
      entry.b += b;
      buckets.set(key, entry);
    }
  const best = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
  return best
    ? { r: best.r / best.count, g: best.g / best.count, b: best.b / best.count }
    : { r: 100, g: 100, b: 100 };
}
export function artworkSource(url) {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    if (
      host === "covers.openlibrary.org" ||
      host === "upload.wikimedia.org" ||
      host.endsWith(".mzstatic.com") ||
      host === "i.scdn.co" ||
      host === "image.tmdb.org"
    )
      return `/api/artwork?url=${encodeURIComponent(url)}`;
  } catch {
    /* Local assets need no proxy. */
  }
  return url;
}
export function analyzeCover(url, seed) {
  if (!url) return Promise.resolve(fallbackCover(seed));
  if (cache.has(url)) return cache.get(url);
  const promise = new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    let settled = false;
    const finish = (result) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolved.set(url, result);
        resolve(result);
      }
    };
    const timer = setTimeout(() => finish(fallbackCover(seed)), 12000);
    image.onerror = () => finish(fallbackCover(seed));
    image.onload = () => {
      const aspectRatio = Math.max(
        0.48,
        Math.min(0.95, image.naturalWidth / image.naturalHeight),
      );
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 80;
        canvas.height = 100;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(image, 0, 0, 80, 100);
        const pixels = ctx.getImageData(0, 0, 80, 100).data;
        const spine = dominant(pixels, 80, 0, 0, 8, 100);
        const top = dominant(pixels, 80, 0, 0, 80, 8);
        const light =
          (spine.r * 0.299 + spine.g * 0.587 + spine.b * 0.114) / 255;
        finish({
          aspectRatio,
          spine: hex(spine),
          top: hex(top),
          ink: light > 0.55 ? "#262623" : "#ffffff",
        });
      } catch {
        finish({ ...fallbackCover(seed), aspectRatio });
      }
    };
    image.src = artworkSource(url);
  });
  cache.set(url, promise);
  return promise;
}
