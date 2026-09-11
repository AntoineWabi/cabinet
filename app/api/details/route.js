import { catalogJSON, appleItem, searchCatalog } from "../../../lib/catalog";
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  try {
    let work = params.get("work");
    let catalogId = params.get("catalog_id");
    const type = params.get("type");
    const title = params.get("title");
    const creator = params.get("creator");
    const sourceURL = params.get("source");
    // For older imports without catalog metadata, enrich only an exact title
    // and creator match. A vaguely similar search hit is never shown as fact.
    if (
      !work &&
      !catalogId &&
      title &&
      creator &&
      ["album", "book"].includes(type)
    ) {
      const normalize = (value) =>
        (value || "")
          .normalize("NFKD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
      const primaryCreator = creator.split(/\s+(?:with|&|and)\s+|,\s*/i)[0];
      const results = await searchCatalog(
        type,
        `${title} ${type === "book" ? primaryCreator : creator}`,
      );
      const normalizeCreator = (value) =>
        normalize(
          (value || "").replace(/\s*\((?:editor|author|translator)\)\s*/gi, ""),
        );
      const creditedCreators = creator
        .split(/\s+(?:with|&|and)\s+|,\s*/i)
        .map(normalizeCreator);
      const match = results.find(
        (entry) =>
          normalize(entry.title) === normalize(title) &&
          (normalize(entry.creator) === normalize(creator) ||
            (type === "book" &&
              creditedCreators.includes(normalizeCreator(entry.creator)))),
      );
      if (match) {
        work = match.metadata?.work_key;
        catalogId = match.metadata?.catalog_id;
      }
    }
    if (/^\/(works|books)\/OL\d+[WM]$/.test(work || "")) {
      const book = await catalogJSON(`https://openlibrary.org${work}.json`);
      return Response.json({
        description:
          typeof book.description === "string"
            ? book.description
            : book.description?.value,
        subjects: book.subjects?.slice(0, 4),
        pages: book.number_of_pages,
      });
    }
    if (/^\d+$/.test(catalogId || "")) {
      const data = await catalogJSON(
        `https://itunes.apple.com/lookup?id=${catalogId}&entity=song&limit=200`,
      );
      const album = data.results?.find(
        (item) => item.collectionType === "Album",
      );
      const film = data.results?.find((item) => item.kind === "feature-movie");
      const tracks =
        data.results?.filter(
          (item) => item.wrapperType === "track" && item.kind === "song",
        ) || [];
      return Response.json({
        ...(album || film
          ? appleItem(album || film, album ? "album" : "movie").metadata
          : {}),
        ...(tracks.length
          ? {
              tracks: tracks.map((track) => ({
                title: track.trackName,
                number: track.trackNumber,
                duration_ms: track.trackTimeMillis,
              })),
              duration_mins: Math.round(
                tracks.reduce(
                  (sum, track) => sum + (track.trackTimeMillis || 0),
                  0,
                ) / 60000,
              ),
            }
          : {}),
      });
    }
    // Existing Wikipedia-backed items retain their exact page, never a fuzzy match.
    const source = sourceURL;
    if (source) {
      const url = new URL(source);
      if (url.hostname === "en.wikipedia.org") {
        const pageid = url.searchParams.get("curid");
        const title = url.pathname.startsWith("/wiki/")
          ? decodeURIComponent(url.pathname.slice(6))
          : null;
        if ((pageid && /^\d+$/.test(pageid)) || title) {
          const query = new URLSearchParams({
            action: "query",
            format: "json",
            prop: "extracts",
            exintro: "1",
            explaintext: "1",
            exsentences: "4",
            redirects: "1",
            ...(pageid ? { pageids: pageid } : { titles: title }),
          });
          const data = await catalogJSON(
            `https://en.wikipedia.org/w/api.php?${query}`,
          );
          return Response.json({
            description:
              Object.values(data.query?.pages || {})[0]?.extract || undefined,
          });
        }
      }
    }
    return Response.json({});
  } catch {
    return Response.json(
      { error: "Additional details are unavailable right now." },
      { status: 502 },
    );
  }
}
