import { searchCatalog, resolveLink } from "../../../lib/catalog";
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const query = (searchParams.get("q") || "").trim().slice(0, 500);
  if (!query || !["book", "movie", "album"].includes(type))
    return Response.json({ results: [] });
  try {
    const results = /^https?:\/\//i.test(query)
      ? await resolveLink(type, query)
      : await searchCatalog(type, query);
    return Response.json({ results });
  } catch (error) {
    return Response.json(
      { results: [], error: error.message || "Could not search the catalog." },
      { status: 502 },
    );
  }
}
