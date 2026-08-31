# Cabinet
Music-first personal queue with a generic item model for books, articles and products.

## Security
The repository is safe to publish. It contains no credentials. Never commit `.env*`, Vercel metadata, database exports, refresh tokens, or ingest credentials. Runtime secrets belong only in Vercel environment variables.

The app and read/write APIs are protected with HTTP Basic auth (`HUB_USERNAME`, `HUB_PASSWORD`). The assistant-only `POST /api/items` route also accepts a separate long random bearer credential (`INGEST_TOKEN`). Comparisons are timing-safe. Responses add frame, MIME, referrer and permissions protections. Spotify OAuth uses PKCE, checks a short-lived HttpOnly/Secure/SameSite state cookie, and marks the one-time token screen no-store/noindex.

## Setup
1. Create Vercel Postgres and run `schema.sql`.
2. Generate independent high-entropy values for `HUB_PASSWORD` and `INGEST_TOKEN`; set every variable in `.env.example` in Vercel for Production only.
3. Add `https://YOUR_DOMAIN/api/spotify/callback` to the Spotify app's redirect URIs.
4. Open `/api/spotify/connect` while authenticated. Copy the returned refresh token directly into the Vercel `SPOTIFY_REFRESH_TOKEN` environment variable, redeploy, and close the token page. Never send it through chat.


## Authenticated seed diagnostic

`POST /api/admin/seed` is an exact-path, bearer-authenticated maintenance route using `INGEST_TOKEN`. It verifies the Spotify refresh token carries all three required playlist scopes, reads Cabinet's queue/learning/love playlists to avoid album duplicates, writes selected candidate albums to the queue, and inserts matching database rows. It returns no credentials and is not accessible without the server-held ingest token.

## Assistant item ingest

`POST /api/items` is the normal assistant ingest route. It accepts only `Authorization: Bearer <INGEST_TOKEN>` and JSON shaped like:

```json
{
  "type": "album",
  "title": "Album title",
  "creator": "Artist",
  "external_url": "https://open.spotify.com/album/...",
  "external_id": "Spotify album ID",
  "image_url": "https://...",
  "metadata": {
    "year": "2026",
    "note": "Short reason this fits",
    "track_uris": ["spotify:track:..."]
  }
}
```

For an album to behave correctly when liked or dropped, `metadata.track_uris` must contain every Spotify track URI. Before ingesting, check the album is absent from the queue, learning, and love playlists. The server-held ingest token is stored in the secure vault under `Cabinet assistant ingest`; use secure browser filling or the authenticated maintenance route rather than exposing it in chat.

The deployed seed diagnostic currently lives at `POST /api/admin/seed/app/api/admin/seed` because its first GitHub web commit created a nested route path. It is exact-path bearer-authenticated in `proxy.js`. It verifies the refresh-token scopes and account, checks all three playlist memberships, writes selected non-duplicate albums to the queue using Spotify's current `/playlists/{id}/items` endpoint, and inserts matching Neon rows. It is idempotent. A future cleanup should move this file to `app/api/admin/seed/route.js`, update the proxy allowlist to `/api/admin/seed`, verify the new route, then delete the nested path.

## Remaining v1 stubs

- The Books tab is disabled and labeled `soon`.
- `book`, `article`, and `product` exist in the database model but have no ingest-specific UI, cards, or actions yet.
- The header `+` button is visual only; items enter through the authenticated assistant route.
- Music is the only type with Spotify write actions. Liking adds all album tracks to `Music I love` and removes them from the queue. Dropping removes them from the queue.
