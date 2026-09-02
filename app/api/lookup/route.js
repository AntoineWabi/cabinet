// Keyless cover lookup for the add sheet. Books from Open Library, movies
// from Wikipedia, albums from the iTunes Search API. Server-side so the
// client never juggles three upstreams.
export async function GET(r) {
  const { searchParams } = new URL(r.url);
  const type = searchParams.get('type');
  const q = (searchParams.get('q') || '').trim();
  if (!q || !['book', 'movie', 'album'].includes(type)) return Response.json({ results: [] });
  try {
    if (type === 'book') return Response.json({ results: await books(q) });
    if (type === 'movie') return Response.json({ results: await movies(q) });
    return Response.json({ results: await albums(q) });
  } catch {
    return Response.json({ results: [], error: 'lookup failed' }, { status: 502 });
  }
}

async function books(q) {
  const u = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=6&fields=key,title,author_name,first_publish_year,cover_i`;
  const j = await fetch(u, { next: { revalidate: 3600 } }).then((r) => r.json());
  return (j.docs || []).map((d) => ({
    type: 'book',
    title: d.title,
    creator: (d.author_name || [])[0] || null,
    year: d.first_publish_year ? String(d.first_publish_year) : null,
    image_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : null,
    external_url: `https://openlibrary.org${d.key}`,
  }));
}

async function movies(q) {
  const u = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(q + ' film')}&gsrlimit=6&prop=pageimages%7Cdescription&piprop=original&pilicense=any`;
  const j = await fetch(u, { next: { revalidate: 3600 } }).then((r) => r.json());
  return Object.values(j.query?.pages || {}).map((p) => {
    const year = (p.description || '').match(/\b(19|20)\d{2}\b/)?.[0] || null;
    return {
      type: 'movie',
      title: p.title.replace(/\s*\((film|\d{4} film|\d{4}.*)\)\s*$/i, ''),
      creator: p.description || null,
      year,
      image_url: p.original?.source?.replace(/\?utm_.*$/, '') || null,
      external_url: `https://en.wikipedia.org/?curid=${p.pageid}`,
    };
  });
}

async function albums(q) {
  const u = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=album&limit=6`;
  const j = await fetch(u, { next: { revalidate: 3600 } }).then((r) => r.json());
  return (j.results || []).map((a) => ({
    type: 'album',
    title: a.collectionName,
    creator: a.artistName,
    year: (a.releaseDate || '').slice(0, 4) || null,
    image_url: (a.artworkUrl100 || '').replace('100x100bb', '600x600bb') || null,
    external_url: a.collectionViewUrl,
    external_id: String(a.collectionId),
  }));
}
