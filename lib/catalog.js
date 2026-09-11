export async function catalogJSON(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    next: { revalidate: 3600 },
    headers: { "User-Agent": "Cabinet/1.0 (personal media library)" },
  });
  if (!response.ok)
    throw new Error(
      "The catalog is temporarily unavailable. Please try again.",
    );
  return response.json();
}
const plain = (value) => (value || "").replace(/<[^>]*>/g, "").trim();
export function appleItem(item, type) {
  const movie = type === "movie";
  return {
    type,
    title: movie ? item.trackName : item.collectionName,
    creator: item.artistName || null,
    year: item.releaseDate?.slice(0, 4),
    image_url: item.artworkUrl100?.replace("100x100bb", "600x600bb") || null,
    external_url: movie ? item.trackViewUrl : item.collectionViewUrl,
    external_id: `apple:${movie ? item.trackId : item.collectionId}`,
    metadata: {
      year: item.releaseDate?.slice(0, 4),
      description:
        plain(item.longDescription || item.shortDescription) || undefined,
      genre: item.primaryGenreName,
      track_count: movie ? undefined : item.trackCount,
      duration_mins:
        movie && item.trackTimeMillis
          ? Math.round(item.trackTimeMillis / 60000)
          : undefined,
      content_rating: movie ? item.contentAdvisoryRating : undefined,
      catalog_id: String(movie ? item.trackId : item.collectionId),
      catalog: "apple",
    },
  };
}
export async function searchCatalog(type, query) {
  if (type === "movie") {
    // Search film infobox pages, not arbitrary pages containing the word film.
    // The public Apple movie search currently returns empty responses even for
    // known titles; Wikipedia supplies a working keyless film catalog.
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      generator: "search",
      gsrsearch: `${query.replace(/[\"\\]/g, " ")} hastemplate:\"Infobox film\"`,
      gsrlimit: "10",
      prop: "pageimages|description|extracts",
      piprop: "original",
      pilicense: "any",
      exintro: "1",
      explaintext: "1",
      exsentences: "3",
      exlimit: "10",
    });
    const data = await catalogJSON(
      `https://en.wikipedia.org/w/api.php?${params}`,
    );
    return Object.values(data.query?.pages || {})
      .sort((a, b) => a.index - b.index)
      .map((page) => {
        const year = page.description?.match(/\b(18|19|20)\d{2}\b/)?.[0];
        const director =
          page.description?.match(
            /(?:film|documentary)(?:\s+directed)?\s+by\s+(.+)$/i,
          )?.[1] || null;
        return {
          type: "movie",
          title: page.title.replace(
            /\s*\((?:\d{4} )?(?:[^)]* )?film\)\s*$/i,
            "",
          ),
          creator: director,
          year,
          image_url: page.original?.source || null,
          external_url: `https://en.wikipedia.org/?curid=${page.pageid}`,
          external_id: `wikipedia:${page.pageid}`,
          metadata: {
            year,
            description: page.extract || page.description,
            catalog: "wikipedia",
          },
        };
      });
  }
  if (type === "book") {
    const json = await catalogJSON(
      `https://openlibrary.org/search.json?${new URLSearchParams({ q: query, limit: "10", fields: "key,title,author_name,first_publish_year,cover_i,edition_key,number_of_pages_median,subject" })}`,
    );
    return (json.docs || []).map((book) => ({
      type,
      title: book.title,
      creator: book.author_name?.[0] || null,
      year: book.first_publish_year ? String(book.first_publish_year) : null,
      image_url: book.cover_i
        ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`
        : null,
      external_url: `https://openlibrary.org${book.key}`,
      external_id: book.key,
      metadata: {
        year: book.first_publish_year
          ? String(book.first_publish_year)
          : undefined,
        pages: book.number_of_pages_median,
        subjects: book.subject?.slice(0, 3),
        work_key: book.key,
      },
    }));
  }
  const json = await catalogJSON(
    `https://itunes.apple.com/search?${new URLSearchParams({ term: query, entity: type === "movie" ? "movie" : "album", limit: "12" })}`,
  );
  // Entity-specific results prevent books/disambiguation pages appearing as films.
  return (json.results || [])
    .filter((item) =>
      type === "movie"
        ? item.kind === "feature-movie"
        : item.collectionType === "Album",
    )
    .map((item) => appleItem(item, type));
}
export async function resolveLink(type, input) {
  const url = new URL(input);
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new Error("Paste a valid website link.");
  const host = url.hostname.replace(/^www\./, "");
  if (["music.apple.com", "itunes.apple.com", "tv.apple.com"].includes(host)) {
    const id = url.pathname.match(/(?:id)?(\d{6,})(?:\/|$)/)?.[1];
    if (!id)
      throw new Error("Use the album or movie page link, or search by title.");
    const data = await catalogJSON(`https://itunes.apple.com/lookup?id=${id}`);
    return (data.results || [])
      .filter(
        (item) =>
          item.collectionType === "Album" || item.kind === "feature-movie",
      )
      .map((item) =>
        appleItem(item, item.kind === "feature-movie" ? "movie" : "album"),
      );
  }
  if (host === "open.spotify.com") {
    if (!/\/album\/[a-zA-Z0-9]+/.test(url.pathname))
      throw new Error(
        "Paste a Spotify album link, or search for an album by name.",
      );
    const embed = await catalogJSON(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(url.href)}`,
    );
    // Only use oEmbed's plain data. Its HTML is never rendered.
    const matches = await searchCatalog("album", embed.title);
    const match = matches.find(
      (item) => item.title.toLowerCase() === embed.title.toLowerCase(),
    );
    return [
      {
        ...(match || {}),
        type: "album",
        title: embed.title,
        image_url: embed.thumbnail_url || match?.image_url,
        external_url: url.href,
        external_id: url.pathname.split("/").pop(),
        metadata: { ...match?.metadata },
      },
    ];
  }
  if (host === "openlibrary.org") {
    const path = url.pathname.match(/^\/(works|books)\/OL\d+[WM]/)?.[0];
    if (!path)
      throw new Error(
        "Paste a book page from Open Library, or search by title.",
      );
    const book = await catalogJSON(`https://openlibrary.org${path}.json`);
    const authorKey = book.authors?.[0]?.author?.key || book.authors?.[0]?.key;
    const author = /^\/authors\/OL\d+A$/.test(authorKey || "")
      ? await catalogJSON(`https://openlibrary.org${authorKey}.json`).catch(
          () => null,
        )
      : null;
    return [
      {
        type: "book",
        title: book.title,
        creator: author?.name || null,
        image_url:
          book.covers?.[0] > 0
            ? `https://covers.openlibrary.org/b/id/${book.covers[0]}-L.jpg`
            : null,
        external_url: `https://openlibrary.org${path}`,
        external_id: path,
        metadata: {
          description:
            typeof book.description === "string"
              ? book.description
              : book.description?.value,
          year: book.first_publish_date || book.publish_date,
          pages: book.number_of_pages,
          work_key: path,
          subjects: book.subjects?.slice(0, 3),
        },
      },
    ];
  }
  if (host === "en.wikipedia.org") {
    const pageid = url.searchParams.get("curid");
    const title = url.pathname.startsWith("/wiki/")
      ? decodeURIComponent(url.pathname.slice(6)).replace(/_/g, " ")
      : null;
    if (title) {
      const results = await searchCatalog(
        "movie",
        title.replace(/\s*\([^)]*film\)$/, ""),
      );
      const exact = results.find(
        (item) =>
          item.title.toLowerCase() ===
          title.replace(/\s*\([^)]*film\)$/, "").toLowerCase(),
      );
      if (exact) return [exact];
    }
    if (pageid && /^\d+$/.test(pageid)) {
      const data = await catalogJSON(
        `https://en.wikipedia.org/w/api.php?${new URLSearchParams({ action: "query", format: "json", pageids: pageid, prop: "info" })}`,
      );
      const page = Object.values(data.query?.pages || {})[0];
      if (page?.title) {
        const results = await searchCatalog("movie", page.title);
        return results.filter(
          (item) => item.external_id === `wikipedia:${pageid}`,
        );
      }
    }
    throw new Error("Use a Wikipedia film page, or search by title.");
  }
  throw new Error(
    "This link needs a title. Choose “Add by hand” below to save it, or search the catalog by name.",
  );
}
