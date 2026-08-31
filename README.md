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
