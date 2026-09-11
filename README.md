# Cabinet — agent handoff

This archive contains the current application after the Cabinet redesign and follow-up refinements. Start here when integrating it with an existing deployment, ingest agent, or frontend. The API contracts below were checked against the included route handlers.

The archive includes application code, the dependency lockfile, sample cover artwork, fonts, and browser-check scripts. It excludes dependencies, build output, credentials, local collection data, generated screenshots/videos, and the obsolete numbered copies of the original root files. Existing project notes are in [docs/PROJECT_README.md](docs/PROJECT_README.md). The route inventory is in [docs/api-routes.json](docs/api-routes.json).

## 1. Run the local version

The lockfile pins Next.js **16.3.4**, React **19.2.8**, and puppeteer-core **25.9.0**. Next requires Node **20.9 or newer**; the working machine used Node 25.3.0. Keep `package-lock.json` and use `npm ci`, because several dependency ranges in `package.json` are `latest`.

```sh
npm ci
CABINET_OPEN=1 npm run dev -- --port 3000
```

Open `http://localhost:3000/`. For this database-free preview, leave `POSTGRES_URL` and `VERCEL` unset. The app starts with the bundled sample collection. Local writes create `.data/preview-collection.json`; no user collection or database export is included in this archive.

```sh
npm run build
```

`npm start` is a production server and does not use the sample-data fallback. Configure the database and authentication before using it.

Read [AGENTS.md](AGENTS.md) before editing code. It directs the next agent to the version-specific Next.js guides under `node_modules/next/dist/docs/` after installation.

## 2. Product decisions implemented

- Three collections: **Music**, **Books**, and **Movies**. Queue/Kept and the old Keep it/Not for me workflow are removed from the main UI.
- Desktop uses the supplied prototypes: Vinyl coverflow, Stacks bookshelf geometry and sampled edge colours, and VHS cases. Books and movies support Coverflow, Shelf, and Stack layouts, plus library/colour/creator/title ordering.
- Mobile defaults to a two-column grid with flat artwork, titles, and creators. A floating bottom bar switches collections. Grid scroll position is remembered per tab during the session.
- Clicking **Cabinet** opens the hidden settings menu. **3D carousel on mobile** restores the galleries on mobile and keeps the bottom bar. It applies to all three media types and remembers the preference on the device.
- Header search is an icon. It searches saved items across all three collections; it does not search external catalogs. The heart opens a searchable list of liked items. The title reads **Cabinet**.
- Catalog lookup, pasted-link adding, and manual adding live in Cabinet settings. There is no main-header plus button.
- Detail dialogs share the same structure, approximately the search dialog's width. The selected object sits at the top, followed by details and collection actions. Desktop source/completion/Like buttons sit together where space permits.
- Music's primary action defaults to **Spotify**. Stored source URLs and Apple-derived catalog metadata are preserved.
- Details support independent **Liked** and **Listened / Read / Watched** states, and Remove with Undo. Notes and ratings are outside this implementation.
- Covers animate from the gallery or grid into details and back. Tapping the detail object performs a 950ms 360° turn. Repeated taps do not queue turns; closing mid-turn finishes the rotation during the return. Reduced-motion mode uses a small press effect.
- The glossy controls share a surface/shadow treatment. The bottom Previous/View details/Next controls have been removed. Desktop objects still support drag, scroll, and keyboard navigation.

Mobile detection is `(max-width: 720px), (max-width: 1024px) and (pointer: coarse)`. This includes touch-phone landscape. Desktop layouts are retained when switching between viewport sizes.

## 3. The most important integration change: collection state

The database's legacy `state` enum is unchanged: `queued`, `tried`, `loved`, `dropped`. New UI actions use **JSONB metadata flags** instead of overloading that enum:

| PATCH field | Stored metadata field | Meaning |
| --- | --- | --- |
| `liked` | `cabinet_liked` | User likes the item |
| `completed` | `cabinet_completed` | Listened, Read, or Watched according to media type |
| `archived` | `cabinet_archived` | Removed from the visible collection |

All three fields accept JSON booleans. `false` explicitly overrides legacy defaults; check for null/undefined rather than truthiness when reading them.

Current compatibility rules in `lib/media.js`:

```js
visible = item.state !== "dropped" && !item.metadata?.cabinet_archived;
liked = item.metadata?.cabinet_liked ?? (item.state === "loved");
completed = item.metadata?.cabinet_completed ?? ["tried", "loved"].includes(item.state);
```

The frontend further limits visible types to `album`, `book`, and `movie`. API/model support for `article` and `product` remains for older clients; those types have no main UI tab.

**Use `liked`, `completed`, and `archived` for the new collection workflow.** A legacy `state: "loved"` or `state: "dropped"` update can still trigger Spotify playlist writes in production. The three new boolean actions do not trigger those writes. Liking does not imply completion; completion does not imply liking. Remove archives the item; Undo sends `archived: false`.

## 4. Authentication and environment

Relevant files: `proxy.js`, `lib/session.js`, `lib/model.js`, and `app/api/login/route.js`.

| Setting | Purpose |
| --- | --- |
| `POSTGRES_URL` | Database connection for normal operation |
| `HUB_USERNAME`, `HUB_PASSWORD` | Basic auth and browser login; password also signs sessions |
| `INGEST_TOKEN` | Bearer credential accepted by `POST /api/items` and legacy seed handlers |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_REFRESH_TOKEN` | Existing Spotify OAuth/playlist integration |
| `CABINET_OPEN=1` | Local preview entry point described above |

`.env.example` contains blank secret fields and an existing public Spotify client identifier. Configure the appropriate values for the target deployment. Spotify playlist IDs are currently fixed in `lib/spotify.js` and the legacy seed handlers; review them before enabling that integration for another account.

Normal browser requests use HTTP Basic authentication or the signed `cabinet_session` cookie. The login cookie lasts 30 days and is `HttpOnly; Secure; SameSite=Lax`. Unauthenticated page navigation redirects to `/login`; API requests receive HTTP 401.

**Bearer ingest is not general API authorization.** `POST /api/items` accepts `Authorization: Bearer <INGEST_TOKEN>`. `GET /api/items`, `PATCH /api/items/{id}`, lookup, details, and artwork require the browser session or Basic auth outside preview mode. The bearer exception in `proxy.js` is restricted by path and method.

There is an important existing difference between the preview guards: `lib/local-collection.js` requires development mode, `CABINET_OPEN === "1"`, no `POSTGRES_URL`, and no `VERCEL`. In contrast, the proxy bypasses auth for **any truthy `CABINET_OPEN` value**, without its own production check. Leave `CABINET_OPEN` completely unset in production; setting it to the string `"0"` still bypasses the proxy. The local sample-store guard alone does not protect the read routes.

## 5. Endpoint map

These are the actual implemented methods and paths. Errors are not uniformly JSON: lookup/details use JSON errors; several item/auth/artwork errors are plain text. Check status and content type before parsing an error body.

| Method and path | Purpose / response |
| --- | --- |
| `GET /api/items` | Array of stored item rows; includes archived/dropped items and legacy media types |
| `POST /api/items` | Add or restore a saved reference; returns one item object |
| `PATCH /api/items/{id}` | Collection flags, legacy state changes, and selected basic edits; returns one item object |
| `GET /api/lookup?type=…&q=…` | External catalog search or supported-link resolution; `{ results: [...] }` |
| `GET /api/details?…` | Additional metadata for one reference; metadata object, or `{}` if no enrichment path |
| `GET /api/artwork?url=…` | Allowlisted raster image bytes for display and canvas colour sampling |
| `POST /api/login` | `{ username, password }` → `{ ok: true }` plus session cookie |
| `GET /api/spotify/connect` | Existing OAuth PKCE redirect flow |
| `GET /api/spotify/callback` | Existing OAuth callback; HTML page displaying the refresh token for configuration |
| `POST /api/admin/seed/admin/seed` | Legacy seed routine; can modify Spotify playlists and database rows |
| `POST /api/admin/seed/app/api/admin/seed` | Legacy seed/check routine; can modify Spotify playlists and database rows |

There is no implemented `GET /api/items/{id}`, DELETE item endpoint, server-side saved-search endpoint, liked-items endpoint, or settings endpoint. Saved search and liked filtering run against the `/api/items` data in the browser. Display preferences use localStorage.

### GET /api/items

Normal operation calls `migrate()` and queries all rows by `created_at desc`. The local preview returns the file-backed collection or fixture and sets `X-Cabinet-Preview: true`.

Response shape is a **raw array**, not `{ items: [...] }`. This handler has no pagination or filtering parameters. Apply collection visibility rules on the client if recreating the main UI.

### POST /api/items

The request must be a JSON object. Required: nonblank string `title`, and a `type` from `album`, `book`, `movie`, `article`, `product`. Optional: `creator`, `image_url`, `external_url`, `external_id`, and object `metadata`.

```json
{
  "type": "album",
  "title": "Example album",
  "creator": "Example artist",
  "external_url": "https://open.spotify.com/search/Example%20album",
  "external_id": "example-provider:album-123",
  "image_url": "https://example.com/cover.jpg",
  "metadata": {
    "year": "2026",
    "cabinet_liked": false,
    "cabinet_completed": false
  }
}
```

Supply `metadata.year`: **top-level `year` is not persisted by POST**. The add dialog explicitly copies lookup results' top-level year into metadata before posting. New rows start at `state: "queued"`; POST ignores a caller-supplied `state`. New metadata always forces `cabinet_archived: false`.

Title/creator/external ID are limited to 500 characters. URLs are accepted only as absolute HTTP(S) URLs; invalid or relative URLs become null. Artwork from other hosts can display directly, but may not be eligible for the same-origin sampler proxy.

Database duplicate detection uses matching type plus external ID, or case-insensitive title and creator. An existing row is unarchived, and a dropped row returns to queued. It retains its other metadata and basic fields; reposting is not a metadata upsert. The partial unique index also handles matching `(type, external_id)` inserts.

Status: new insert/conflict path generally **201**; the explicit existing-row database path returns **200**. The local preview returns **201** for both new and existing references. Errors include **400** validation and **401** authorization.

Local duplicate detection differs slightly: `sameItem()` compares external URL or accent/punctuation-normalized title and creator, and resets an existing match to queued. Production duplicate matching does not use the URL directly.

### PATCH /api/items/{id}

New collection actions:

```json
{ "liked": true, "completed": true }
```

```json
{ "archived": true }
```

```json
{ "archived": false }
```

Supported fields also include `state`, nonblank string `title`, `creator`, `image_url`, and `year` (stored as `metadata.year`). Known flags and year are merged into existing metadata, preserving unrelated provider fields.

An arbitrary `metadata` object, `external_url`, `external_id`, or `type` is **not** applied by this PATCH handler. Unknown fields are ignored. There is no full arbitrary item-edit API in this snapshot.

Returns **200** with the updated item; **400** for invalid JSON/body/known action values; **401** for auth failure; **404** for a missing item. Use real database UUIDs in production; malformed IDs are not normalized into a friendly validation response.

Legacy side effect: in database mode, a supplied `state` of `loved` or `dropped`, on an album with `metadata.track_uris`, calls `updateAlbum()` before saving. Loved adds tracks to the configured love playlist; loved and dropped remove them from the queue playlist. Local preview does not call Spotify.

### GET /api/lookup

Required query parameters are `type` (`album`, `book`, `movie`) and `q` (title/creator search text or an HTTP(S) URL). Queries are trimmed and limited to 500 characters. Missing text or an invalid type returns **200** with `{ "results": [] }`. Provider/resolution failures return **502** with `{ "results": [], "error": "…" }`.

Result objects contain `type`, `title`, optional `creator`, `year`, `image_url`, `external_url`, `external_id`, and `metadata`. They are candidates for POST and are not automatically saved.

Catalog behavior in `lib/catalog.js`:

- Albums use the public Apple/iTunes album search, with `apple:<collectionId>` identifiers and metadata such as `catalog_id`, `catalog`, year, genre, and track count.
- Books use Open Library search, work references such as `/works/OL…W`, cover URLs, author, year, and optional page counts/subjects.
- Movies use Wikipedia search constrained to **Infobox film** pages, avoiding generic articles and disambiguation results. IDs are `wikipedia:<pageid>`; the exact reference URL is retained. Director/year extraction from page descriptions can be absent or incomplete.
- Link resolution supports Spotify album URLs, Apple Music/iTunes/TV album or movie URLs, Open Library work/edition URLs, and English Wikipedia film URLs. Arbitrary links need manual adding with a title.
- A supported link can determine its own media type even if the selected `type` differs. Read the returned result's `type`.
- Spotify links use oEmbed and optionally an exact-title Apple search match for enrichment; they do not require the OAuth playlist integration. oEmbed HTML is never rendered.

Provider JSON requests use a 12-second timeout and a one-hour revalidation setting. Live results depend on those external services.

### GET /api/details

Inputs: `type`, `title`, `creator`, and optional `work`, `catalog_id`, `source`.

Resolution order:

1. For album/book references lacking a work or catalog ID, search by title/creator and accept an exact normalized title/creator match. Book matching also accommodates split author/editor credits.
2. Valid Open Library `/works/OL…W` or `/books/OL…M` references return description, subjects, and pages when supplied.
3. Numeric Apple catalog IDs return metadata and, for albums, `tracks: [{ title, number, duration_ms }]` and calculated `duration_mins`.
4. An English Wikipedia `source` URL with `/wiki/...` or a numeric `curid` returns an extract from that exact page.

Returns **200** with a partial metadata object, possibly `{}`. Unavailable upstream details return **502** with `{ "error": "Additional details are unavailable right now." }`.

Enrichment is read-only. `DetailModal` merges defined enrichment values over the saved metadata and caches results by item ID in memory; it does not persist that extra metadata with a PATCH. Do not expect a newly displayed track list to appear in subsequent `/api/items` responses.

The music CTA is computed separately by `primaryMediaLink()` in `lib/media.js`: use a known Spotify URL/ID when available, otherwise open a Spotify search for title and creator. This does not replace the stored Apple/Wikipedia/Open Library source.

### GET /api/artwork

`url` must be an HTTPS image URL on the allowlist: `covers.openlibrary.org`, `archive.org`, `upload.wikimedia.org`, `i.scdn.co`, `image.tmdb.org`, subdomains of `mzstatic.com`, or `ia<digits>.us.archive.org`. Custom ports and embedded URL credentials are rejected. Redirect destinations are checked as well, with at most four fetch attempts.

Allowed content types: JPEG, PNG, WebP, GIF, AVIF. Maximum streamed body size: **8 MiB**. Fetch timeout: **10 seconds**. Successful image responses use a one-day public cache header and `nosniff`.

Errors: **400** unsupported host, **404** unavailable/non-raster response, **413** oversized body, **502** malformed URL/fetch failure. This is an artwork proxy, not an arbitrary URL-fetch endpoint. `lib/cover-analysis.js` routes supported cover hosts through it so canvas edge sampling can read the pixels.

### Legacy authentication, OAuth, and seed routes

`POST /api/login` receives `{ "username": "…", "password": "…" }`. Success sets the signed cookie and returns `{ "ok": true }`; credential mismatch returns 401. Configure both credentials for real use.

The Spotify connect route redirects with PKCE and a short-lived `spotify_oauth` cookie. The callback validates state/verifier, exchanges the code, and displays a refresh token in an uncached HTML page for environment configuration. It does not automatically store the token in the database.

The two deeply nested seed route paths in the table are inherited source paths. **A route at `/api/admin/seed` does not exist**, despite an entry in the proxy allowlist. The `/api/admin/seed/app/api/admin/seed` path is bearer-allowlisted; `/api/admin/seed/admin/seed` is not. Both handlers require an ingest bearer internally. The latter therefore also encounters the normal proxy gate unless a session or preview bypass is present.

These routines contain fixed playlist/candidate IDs and can perform real writes. They are not used by the redesigned browser UI or required for local preview. They were retained rather than invoked or revalidated during this work. The second handler also has `X-Cabinet-Action` values `check-ids` and `check-pool` for its existing diagnostic paths.

## 6. Database compatibility and known gaps

- There is no new table or column for liked/completed/archive. Those flags live in existing `metadata jsonb`.
- `lib/db.js` performs idempotent runtime bring-up for item routes and expands the type constraint to include `movie`. The included static `schema.sql` still reflects the older constraint without movie. If copying SQL into another backend, use the current runtime constraint: `album`, `book`, `movie`, `article`, `product`.
- Preserve existing `metadata` when implementing the PATCH contract elsewhere. It may contain catalog IDs, descriptions, work keys, or legacy Spotify `track_uris`.
- POST currently assumes parsed JSON is non-null before reading `item.title`; a JSON `null` payload can throw instead of returning the intended 400. Send an object. PATCH has explicit null/array body validation.
- Plain item/auth errors and JSON lookup/details errors use different formats; do not assume all failures have a `.error` JSON field.
- Live Postgres migration behavior and legacy Spotify writes were not exercised against production. Browser checks use the isolated local collection. Provider metadata and artwork can be incomplete; the UI falls back rather than inventing them.
- Installation reports that `@vercel/postgres` is deprecated. This snapshot retains the existing adapter; it does not migrate the deployment to a new database SDK.
- This is a complete source snapshot without Git history. The supplied prototype ZIP files and historical screenshots are not required to run it; the relevant sample assets and adapted implementation are included.

## 7. Where the changes live

| File | Responsibility |
| --- | --- |
| `app/page.js` | Shared chrome, tabs, overlays, collection state, optimistic mutations, viewport/view selection |
| `app/flow.js` | Native scroll-snap galleries, Coverflow/Shelf/Stack poses, pointer/touch/keyboard navigation |
| `app/components/collection-grid.js` | Mobile grid, lazy artwork, per-tab scroll position, exact search-result opening |
| `app/components/media-object.js` | Album/book/VHS geometry, artwork fallback, sampled dimensions and colours |
| `app/components/detail-modal.js` | Shared open/close animation, enrichment, independent actions, object spin |
| `app/components/dialog.js` | Native dialog, scroll lock, viewport fitting, focus return |
| `app/components/search-dialog.js` | Global saved search and liked-item list |
| `app/components/add-dialog.js` | Catalog search, link resolution, manual entry, POST integration |
| `app/components/settings-dialog.js` | Hidden menu, mobile 3D switch, layouts/sorts, adding entry points |
| `app/style.css` | Responsive layouts, floating mobile tabs, shared glossy controls, physical media surfaces |
| `lib/media.js` | Visibility/liked/completed rules, Spotify CTA, dedupe and saved search helpers |
| `lib/display-settings.js` | Defaults, settings validation, collection ordering |
| `lib/catalog.js` | Provider normalization and supported-link resolution |
| `lib/cover-analysis.js` | Artwork proxy selection, dominant edge colours, aspect-ratio cache |
| `lib/local-collection.js` | Isolated development fixture/file store |
| `app/api/**/route.js` | Endpoint implementations described above |

The standalone `/deck` route retains its older implementation in `app/legacy-flow.js` and `app/legacy.css`.

Display preferences are local to the browser under `cabinet.display.v1`:

```json
{
  "book": { "layout": "shelf", "sort": "library" },
  "movie": { "layout": "coverflow", "sort": "library" },
  "mobile3D": false
}
```

Valid layouts: `coverflow`, `shelf`, `stack`. Valid sorts: `library`, `spectrum`, `creator`, `title`. Music uses Vinyl coverflow when in 3D mode. Defaults/missing or invalid preferences normalize through `normalizeDisplay()`.

## 8. Motion details worth preserving

The `.detail-art` wrapper owns the shared travel animation. The inner `.media-object` owns the tap-to-spin rotation, keeping those transforms independent. Opening hides the complete originating object; closing returns it to its measured position. Stack views use a synthetic cover rectangle because the displayed source is an edge-on spine. Grid sources use the actual artwork element.

The detail panel has stable dimensions while asynchronous metadata loads. Closing takes over the entrance animations so text/header elements fade before the cover lands, avoiding the earlier lingering-panel issue. Focus is trapped in the native dialog and restored on close. Avoid reintroducing a transform/perspective ancestor around the fixed travelling hero that changes its coordinate system.

## 9. Validation and working on the next revision

Start the isolated local preview in one terminal. In another:

```sh
mkdir -p artifacts
npm run test:ui
npm run test:collection
npm run test:visual
```

Run the suites serially. The first two can add/remove/mark fixture items and restore the previous local collection in `finally`. They check `X-Cabinet-Preview: true` before their normal mutation flows. The scripts require Google Chrome; `CHROME_PATH` is supported by the UI/collection scripts. The visual script currently uses the macOS Chrome path directly and the scripts default to localhost:3000 (`CABINET_TEST_URL` is available on the UI suite).

The 14-group UI suite and collection suite passed during the redesign. Subsequent focused browser checks covered the floating mobile tabs, mobile 3D preference persistence, all three detail spins, repeated taps, keyboard activation, interrupted closing, reduced motion, phone/landscape layouts, and missing artwork. The production build passed after the final spin change. These focused one-off scripts and generated captures are not bundled as permanent regression tests.

For this handoff, a separate copy of the packaged source passed a fresh `npm ci --no-audit --no-fund` and `npm run build`. Installed dependencies and build output from that check are excluded from the ZIP.

For another backend or ingest agent, prioritize matching the raw item response shape, POST year/metadata behavior, PATCH boolean flags, auth method restrictions, and the separation between saved search, external lookup, and read-only detail enrichment.
