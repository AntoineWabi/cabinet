// Same-origin image bytes let Stacks' color sampler read remote covers safely.
const allowed = (url) =>
  url.protocol === "https:" &&
  !url.port &&
  !url.username &&
  !url.password &&
  ([
    "covers.openlibrary.org",
    "archive.org",
    "upload.wikimedia.org",
    "i.scdn.co",
    "image.tmdb.org",
  ].includes(url.hostname) ||
    url.hostname.endsWith(".mzstatic.com") ||
    /^ia\d+\.us\.archive\.org$/.test(url.hostname));
export async function GET(request) {
  try {
    let url = new URL(new URL(request.url).searchParams.get("url"));
    let response;
    for (let i = 0; i < 4; i++) {
      if (!allowed(url))
        return new Response("Unsupported artwork host", { status: 400 });
      response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
        next: { revalidate: 86400 },
      });
      if (
        response.status >= 300 &&
        response.status < 400 &&
        response.headers.get("location")
      ) {
        url = new URL(response.headers.get("location"), url);
        continue;
      }
      break;
    }
    const type = response.headers.get("content-type") || "";
    if (!response.ok || !/^image\/(jpeg|png|webp|gif|avif)/.test(type))
      return new Response("Artwork unavailable", { status: 404 });
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8 * 1024 * 1024) {
        await reader.cancel();
        return new Response("Artwork too large", { status: 413 });
      }
      chunks.push(value);
    }
    return new Response(Buffer.concat(chunks), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Artwork unavailable", { status: 502 });
  }
}
