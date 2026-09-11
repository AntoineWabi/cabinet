export const MEDIA_TYPES = [
  {
    id: "album",
    label: "Music",
    singular: "Album",
    verb: "Listen",
    noun: "albums",
    completed: "Listened",
  },
  {
    id: "book",
    label: "Books",
    singular: "Book",
    verb: "Read more",
    noun: "books",
    completed: "Read",
  },
  {
    id: "movie",
    label: "Movies",
    singular: "Film",
    verb: "View film",
    noun: "films",
    completed: "Watched",
  },
];
export const mediaType = (type) =>
  MEDIA_TYPES.find((entry) => entry.id === type) || MEDIA_TYPES[0];
export const inCollection = (item) =>
  item.state !== "dropped" && !item.metadata?.cabinet_archived;
export const isLiked = (item) =>
  item.metadata?.cabinet_liked ?? item.state === "loved";
export const isCompleted = (item) =>
  item.metadata?.cabinet_completed ?? ["tried", "loved"].includes(item.state);
export function safeLink(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
export function primaryMediaLink(item) {
  const original = safeLink(item.external_url);
  if (item.type !== "album") return original;
  for (const candidate of [item.metadata?.spotify_url, original]) {
    const link = safeLink(candidate);
    if (link && new URL(link).hostname === "open.spotify.com") return link;
  }
  const albumId =
    item.metadata?.spotify_id ||
    item.metadata?.spotify_uri?.match(
      /^spotify:album:([a-zA-Z0-9]{22})$/,
    )?.[1] ||
    item.external_id;
  if (typeof albumId === "string" && /^[a-zA-Z0-9]{22}$/.test(albumId))
    return `https://open.spotify.com/album/${albumId}`;
  return `https://open.spotify.com/search/${encodeURIComponent([item.title, item.creator].filter(Boolean).join(" "))}`;
}
export function sourceName(value) {
  try {
    const host = new URL(value).hostname.replace(/^www\./, "");
    if (host.endsWith("spotify.com")) return "Spotify";
    if (host === "music.apple.com") return "Apple Music";
    if (host.endsWith("apple.com")) return "Apple";
    if (host === "openlibrary.org") return "Open Library";
    if (host.endsWith("wikipedia.org")) return "Wikipedia";
    return host;
  } catch {
    return "source";
  }
}
export function sameItem(a, b) {
  if (a.type !== b.type) return false;
  if (a.external_url && a.external_url === b.external_url) return true;
  const normalize = (s) =>
    (s || "")
      .normalize("NFKD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  return (
    normalize(a.title) === normalize(b.title) &&
    normalize(a.creator) === normalize(b.creator)
  );
}
export function searchCollection(items, query) {
  const norm = (s) =>
    s
      .normalize("NFKD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  const terms = norm(query).trim().split(/\s+/);
  return items.filter((item) =>
    terms.every((term) =>
      norm(
        [
          item.title,
          item.creator,
          item.metadata?.year,
          mediaType(item.type).label,
        ]
          .filter(Boolean)
          .join(" "),
      ).includes(term),
    ),
  );
}


export const BOOK_SHELVES = [
  { id: "want-to-read", label: "Want to read" },
  { id: "classics-ladder", label: "Classics ladder" },
  { id: "author-paths", label: "Author paths" },
  { id: "one-off-picks", label: "One-off picks" },
  { id: "library", label: "Library" },
];
export const bookShelfOf = (item) =>
  item?.metadata?.cabinet_shelf || "library";
