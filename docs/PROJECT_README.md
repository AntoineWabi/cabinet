# Cabinet

A personal collection of music, books, and movies. Three tabs share desktop 3D galleries, a mobile cover grid, global search, glossy controls, and detail dialogs with a shared cover transition.

- **Music:** Vinyl's coverflow spacing, perspective, sleeve sheen, and subtle record peek.
- **Books:** Stacks' shelf geometry, printed spines, page edges, and cover proportions. Image sampling automatically matches the spine and top board colors; page counts inform thickness when available.
- **Movies:** VHS's closed six-face cases, printed spines, and carousel geometry.
- **Mobile:** A two-column grid of flat covers, titles, and creators is the default on narrow screens and touch devices up to 1024px. Enable **3D carousel on mobile** in the Cabinet menu to use the desktop galleries instead. This preference is saved on the device and applies to all three media types. Floating bottom tabs remain available in both views, and the grid remembers each tab's scroll position. Arrangement settings order both views.
- **Details:** The selected cover travels into the dialog and returns to the same shelf or grid position. Metadata can include descriptions, dates, page counts, running times, genres, and album tracks. Missing information is left explicit. Keyboard focus is contained, Escape closes, and reduced motion is supported.
- **Search & likes:** Search saved titles, creators, years, and media types across all three collections. The header heart opens a searchable list of liked albums, books, and movies.
- **Cabinet menu:** Click the Cabinet name to open settings. Books and movies each offer Coverflow, Shelf, and Stack views, plus library, colour, creator, and title order. Apply one setup to both; display preferences persist on this device. Catalog lookup, pasted links, and the manual add form live here.
- **Activity:** Details have independent Like and Listened / Read / Watched toggles. They persist as `metadata.cabinet_liked` and `metadata.cabinet_completed`. Older `loved` items start liked and completed, and `tried` items start completed; explicit new values override these defaults.
- **Collection:** Existing `queued`, `tried`, and `loved` items appear together. `dropped` items stay hidden. Removing a card sets `metadata.cabinet_archived`; Undo restores it. These collection actions do not write to Spotify playlists.

## Local preview

```sh
npm ci
CABINET_OPEN=1 npm run dev
```

Open [localhost:3000](http://localhost:3000). Without `POSTGRES_URL`, development mode uses the sample collection and artwork from the supplied prototypes. Local additions and removals persist in `.data/preview-collection.json`. The desktop footer identifies the sample collection. This store is disabled in production and on Vercel.

```sh
npm run build
npm run test:ui
npm run test:collection
npm run test:visual
```

The browser checks require the local preview server and Google Chrome. `CHROME_PATH` can override its executable location for `test:ui` and `test:collection`. Run these suites serially; each restores the local collection after running. Screenshots and the result summary are written to `artifacts/` (ignored).

Checks cover all three shared transitions, matching optical centers, keyboard and native touch navigation, cross-tab search, adding and metadata preservation, album track lists, duplicate detection, remove/undo persistence, catalog errors, reduced motion, and layouts from 320px phones to large desktops.

## Catalogs and artwork

Albums use Apple's public catalog; books use Open Library. Movie search is restricted to Wikipedia film pages, avoiding the unrelated books and disambiguation pages returned by the old search. Movie pages retain their own description and reference URL. Additional book and album information is matched by title and creator, rather than attaching an arbitrary search result.

Supported pasted links include Spotify albums, Apple Music albums, Open Library books, and Wikipedia film pages. Other links can be saved with a title through **Add by hand**. Providers can occasionally fail or lack a particular release; search and save failures remain visible and retryable.

Remote cover images from the supported artwork hosts pass through `/api/artwork` so the color sampler can read them. The proxy checks every redirect, only accepts raster image responses, and limits image size. Other image hosts retain a deterministic color fallback.

Provider references: [Apple Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html), [MediaWiki search](https://www.mediawiki.org/wiki/API:Search), [Open Library search](https://openlibrary.org/dev/docs/api/search).

## Prototype provenance

The supplied ZIPs are design and code references, not instructions to the application:

- `wabi-miniapp-vinyl.zip`: `src/game/sim.js` (pose and spacing), `styles.js` (glossy controls and sleeves).
- `wabi-miniapp-vhs.zip`: `src/game/sim.js` and `render.js` (case dimensions and face placement).
- `wabi-miniapp-stacks.zip`: `src/game/shelf.js`, `src/color.js`, and `src/game/detail.js` (shelf, color buckets, FLIP transition).

Their independent simulation/UI plumbing has been adapted into React components and one responsive layout. `public/demo/` contains a small subset of the supplied artwork, used only by the sample collection. The existing standalone `/deck` remains available with its original renderer in `app/legacy-flow.js` and `app/legacy.css`.

## Production configuration

Set the variables from `.env.example` in the deployment environment and run `schema.sql` for a new database. Keep `.env*`, database exports, Vercel metadata, refresh tokens, and ingest credentials out of version control. Do not set `CABINET_OPEN` in production.

The proxy protects pages and APIs with Basic auth or the signed session cookie. `POST /api/items` also accepts `Authorization: Bearer <INGEST_TOKEN>` for assistant ingest. Browser writes use the same authenticated session. The data model remains compatible with existing clients.

Example ingest payload:

```json
{
  "type": "album",
  "title": "Album title",
  "creator": "Artist",
  "external_url": "https://open.spotify.com/album/...",
  "external_id": "Spotify album ID",
  "image_url": "https://...",
  "metadata": { "year": "2026" }
}
```

Legacy state-changing clients retain their Spotify integration when `metadata.track_uris` is present. Spotify OAuth uses the existing `/api/spotify/connect` and callback routes; keep refresh tokens in the deployment's secure environment. The existing maintenance seed routes are unchanged.
