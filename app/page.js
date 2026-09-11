"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Flow from "./flow";
import CollectionGrid from "./components/collection-grid";
import Icon from "./components/icons";
import DetailModal from "./components/detail-modal";
import AddDialog from "./components/add-dialog";
import SearchDialog from "./components/search-dialog";
import SettingsDialog from "./components/settings-dialog";
import { MEDIA_TYPES, mediaType, inCollection, isLiked, bookShelfOf, BOOK_SHELVES } from "../lib/media";
import {
  DEFAULT_DISPLAY,
  DISPLAY_KEY,
  normalizeDisplay,
  arrangeCollection,
} from "../lib/display-settings";
import { analyzeCover } from "../lib/cover-analysis";

export default function Home() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [type, setType] = useState("album");
  const [bookShelf, setBookShelf] = useState("want-to-read");
  const [active, setActive] = useState(null);
  const [overlay, setOverlay] = useState(null);
  const [detail, setDetail] = useState(null);
  const [toast, setToast] = useState(null);
  const [jump, setJump] = useState(0);
  const [pendingPick, setPendingPick] = useState(null);
  const [display, setDisplay] = useState(DEFAULT_DISPLAY);
  const [displayError, setDisplayError] = useState("");
  const [palette, setPalette] = useState({});
  const [mobile, setMobile] = useState(false);
  const useGrid = mobile && !display.mobile3D;
  const flow = useRef(null);
  const gridScroll = useRef({});
  const selected = useRef({});
  const toastTimer = useRef(null);
  const pendingActions = useRef(new Set());
  const cfg = mediaType(type);
  const collection = useMemo(
    () =>
      items.filter(
        (item) =>
          inCollection(item) &&
          MEDIA_TYPES.some((entry) => entry.id === item.type),
      ),
    [items],
  );
  const list = useMemo(
    () =>
      arrangeCollection(
        collection.filter(
          (item) =>
            item.type === type &&
            (type !== "book" || bookShelf === "all" || bookShelfOf(item) === bookShelf),
        ),
        display[type]?.sort,
        palette,
      ),
    [collection, type, bookShelf, display, palette],
  );
  const likedItems = useMemo(() => collection.filter(isLiked), [collection]);
  const bookShelfCounts = useMemo(() => {
    const books = collection.filter((item) => item.type === "book");
    return Object.fromEntries([
      ["all", books.length],
      ...BOOK_SHELVES.map((shelf) => [
        shelf.id,
        books.filter((item) => bookShelfOf(item) === shelf.id).length,
      ]),
    ]);
  }, [collection]);
  const current = list.find((item) => item.id === active?.id) || list[0];
  const index = current ? list.findIndex((item) => item.id === current.id) : 0;
  const counts = useMemo(
    () =>
      Object.fromEntries(
        MEDIA_TYPES.map((entry) => [
          entry.id,
          collection.filter((item) => item.type === entry.id).length,
        ]),
      ),
    [collection],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/items");
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Sign in to open your collection."
            : "Your collection couldn’t be loaded. Please try again.",
        );
      setPreview(response.headers.get("X-Cabinet-Preview") === "true");
      setItems(await response.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const query = window.matchMedia(
      "(max-width: 720px), (max-width: 1024px) and (pointer: coarse)",
    );
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("type");
    if (MEDIA_TYPES.some((entry) => entry.id === requested)) setType(requested);
    try {
      setDisplay(
        normalizeDisplay(JSON.parse(localStorage.getItem(DISPLAY_KEY))),
      );
    } catch {}
    load();
    return () => clearTimeout(toastTimer.current);
  }, [load]);
  useEffect(() => {
    if (display[type]?.sort !== "spectrum") return;
    let live = true;
    Promise.all(
      collection
        .filter((item) => item.type === type)
        .map(async (item) => [
          item.id,
          await analyzeCover(item.image_url, item.title),
        ]),
    ).then((entries) => {
      if (live) setPalette(Object.fromEntries(entries));
    });
    return () => {
      live = false;
    };
  }, [collection, type, display]);
  function changeDisplay(value) {
    const next = normalizeDisplay(value);
    setDisplay(next);
    setDisplayError("");
    try {
      localStorage.setItem(DISPLAY_KEY, JSON.stringify(next));
    } catch {
      setDisplayError(
        "The display changed, but this browser couldn’t remember it for next time.",
      );
    }
  }
  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!detail && !["add", "manual"].includes(overlay))
          setOverlay((value) => (value === "search" ? null : "search"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail, overlay]);
  useEffect(() => {
    if (pendingPick && (useGrid || current?.id === pendingPick)) {
      const frame = requestAnimationFrame(() => {
        flow.current?.open(pendingPick);
        setPendingPick(null);
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [pendingPick, current, jump, useGrid]);
  const onActive = useCallback((i, item) => {
    setActive(item || null);
    if (item) selected.current[item.type] = item.id;
  }, []);
  const openDetail = useCallback(
    (item, source) => {
      selected.current[item.type] = item.id;
      setActive(item);
      setDetail({ item, source });
    },
    [],
  );
  function notify(message, undo) {
    clearTimeout(toastTimer.current);
    setToast({ message, undo });
    toastTimer.current = setTimeout(() => setToast(null), undo ? 8000 : 3600);
  }
  function changeType(next) {
    if (next === type) return;
    setType(next);
    setActive(null);
    const url = new URL(window.location.href);
    url.searchParams.set("type", next);
    window.history.replaceState(null, "", url);
  }
  async function archive(item, archived = true) {
    if (pendingActions.current.has(item.id)) return;
    pendingActions.current.add(item.id);
    const previous = item.metadata?.cabinet_archived || false;
    setItems((old) =>
      old.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              metadata: { ...entry.metadata, cabinet_archived: archived },
            }
          : entry,
      ),
    );
    try {
      const response = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      if (!response.ok) throw new Error();
      const updated = await response.json();
      setItems((old) =>
        old.map((entry) => (entry.id === item.id ? updated : entry)),
      );
      notify(
        archived ? "Removed from your collection" : "Back in your collection",
        archived ? () => archive(updated, false) : undefined,
      );
    } catch {
      setItems((old) =>
        old.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                metadata: { ...entry.metadata, cabinet_archived: previous },
              }
            : entry,
        ),
      );
      notify("Couldn’t save that change. Please try again.");
    } finally {
      pendingActions.current.delete(item.id);
    }
  }
  async function updateItem(item, patch) {
    if (pendingActions.current.has(item.id))
      throw new Error("This item is still saving. Please try again.");
    pendingActions.current.add(item.id);
    const metadata = Object.fromEntries(
      Object.entries(patch).map(([key, value]) => [`cabinet_${key}`, value]),
    );
    const previous = Object.fromEntries(
      Object.keys(metadata).map((key) => [key, item.metadata?.[key]]),
    );
    setItems((old) =>
      old.map((entry) =>
        entry.id === item.id
          ? { ...entry, metadata: { ...entry.metadata, ...metadata } }
          : entry,
      ),
    );
    try {
      const response = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error();
      const updated = await response.json();
      setItems((old) =>
        old.map((entry) => (entry.id === item.id ? updated : entry)),
      );
    } catch {
      setItems((old) =>
        old.map((entry) =>
          entry.id === item.id
            ? { ...entry, metadata: { ...entry.metadata, ...previous } }
            : entry,
        ),
      );
      throw new Error("Couldn’t save that change. Please try again.");
    } finally {
      pendingActions.current.delete(item.id);
    }
  }
  function added(item) {
    gridScroll.current[item.type] = 0;
    selected.current[item.type] = item.id;
    setItems((old) => [item, ...old.filter((entry) => entry.id !== item.id)]);
    changeType(item.type);
    setJump((value) => value + 1);
    setOverlay(null);
    notify(`Added to your ${mediaType(item.type).label.toLowerCase()}`);
  }
  function pickSearch(item) {
    selected.current[item.type] = item.id;
    setOverlay(null);
    changeType(item.type);
    setJump((value) => value + 1);
    setPendingPick(item.id);
  }
  const mediaNavigation = (
    <nav className="collection-nav" aria-label="Media collections">
      <div className="media-tabs" role="tablist" aria-label="Media type">
        {MEDIA_TYPES.map((entry, i) => (
          <button
            key={entry.id}
            id={`tab-${entry.id}`}
            role="tab"
            aria-selected={type === entry.id}
            aria-controls="collection-panel"
            tabIndex={type === entry.id ? 0 : -1}
            onClick={() => changeType(entry.id)}
            onKeyDown={(event) => {
              if (
                ["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                  event.key,
                )
              ) {
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? 2
                      : (i + (event.key === "ArrowRight" ? 1 : 2)) % 3;
                changeType(MEDIA_TYPES[next].id);
                document
                  .getElementById(`tab-${MEDIA_TYPES[next].id}`)
                  .focus();
              }
            }}
          >
            <Icon name={entry.id} size={17} />
            <span>{entry.label}</span>
            <b>{loading ? "–" : counts[entry.id]}</b>
          </button>
        ))}
      </div>
    </nav>
  );
  return (
    <main className={`cabinet${mobile ? " is-mobile" : ""}${mobile && !useGrid ? " is-mobile-carousel" : ""}`}>
      <header className="cabinet-header">
        <button
          className="cabinet-brand"
          aria-label="Cabinet menu"
          aria-haspopup="dialog"
          onClick={() => setOverlay("settings")}
        >
          Cabinet
          <span />
        </button>
        {!mobile && mediaNavigation}
        <div className="header-tools">
          <button
            className="glass icon-button search-launch"
            aria-label="Search collection"
            aria-keyshortcuts="Meta+K Control+K"
            onClick={() => setOverlay("search")}
          >
            <Icon name="search" size={19} />
          </button>
          <button
            className={`glass icon-button liked-launch${likedItems.length ? " has-likes" : ""}`}
            aria-label={`Liked items${likedItems.length ? `, ${likedItems.length} saved` : ""}`}
            onClick={() => setOverlay("liked")}
          >
            <Icon
              name="heart"
              size={21}
              fill={likedItems.length ? "currentColor" : "none"}
            />
          </button>
        </div>
      </header>

      {type === "book" && !loading && !error && (
        <nav className="book-shelves" aria-label="Book shelves">
          {[{ id: "all", label: "All books" }, ...BOOK_SHELVES].map((shelf) => (
            <button
              key={shelf.id}
              className={bookShelf === shelf.id ? "on" : ""}
              aria-pressed={bookShelf === shelf.id}
              onClick={() => setBookShelf(shelf.id)}
            >
              <span>{shelf.label}</span><b>{bookShelfCounts[shelf.id] || 0}</b>
            </button>
          ))}
        </nav>
      )}

      <section
        id="collection-panel"
        className="collection-panel"
        role="tabpanel"
        aria-labelledby={`tab-${type}`}
      >
        {loading ? (
          <div className="collection-empty">
            <span className="spinner" />
            <p>Opening your cabinet…</p>
          </div>
        ) : error ? (
          <div className="collection-empty">
            <Icon name="album" size={32} />
            <h1>A little trouble opening the cabinet.</h1>
            <p>{error}</p>
            <button className="glass" onClick={load}>
              Try again
            </button>
          </div>
        ) : list.length && useGrid ? (
          <CollectionGrid
            ref={flow}
            key={`${type}-${jump}`}
            items={list}
            type={type}
            shelf={bookShelf}
            scrollPositions={gridScroll}
            onPick={openDetail}
          />
        ) : list.length ? (
          <>
            <div className="collection-stage">
              <Flow
                ref={flow}
                key={`${type}-${jump}`}
                items={list}
                type={type}
                layout={display[type]?.layout || "coverflow"}
                initialId={selected.current[type]}
                onActive={onActive}
                onPick={openDetail}
              />
            </div>
            <div
              className="collection-caption"
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="eyebrow">
                {String(index + 1).padStart(2, "0")}{" "}
                <span className="caption-slash">/</span>{" "}
                {String(list.length).padStart(2, "0")}
                <span className="caption-dot">·</span>
                {cfg.singular}
              </span>
              <h1>{current?.title}</h1>
              <p>
                {[current?.creator, current?.metadata?.year || current?.year]
                  .filter(Boolean)
                  .join(" · ") ||
                  `In your ${cfg.label.toLowerCase()} collection`}
              </p>
            </div>
          </>
        ) : (
          <div className="collection-empty">
            <span className="empty-icon">
              <Icon name={type} size={32} />
            </span>
            <span className="eyebrow">A LITTLE SPACE FOR WHAT’S NEXT</span>
            <h1>Your {cfg.label.toLowerCase()} collection starts here.</h1>
            <p>Save a {cfg.singular.toLowerCase()} you want to come back to.</p>
            <button className="glass" onClick={() => setOverlay("settings")}>
              Open Cabinet settings
            </button>
          </div>
        )}
      </section>
      {mobile && mediaNavigation}
      {!mobile && <footer className="cabinet-footer">
        <span>
          {preview
            ? "Sample collection · local preview"
            : "A place for your next favorite."}
        </span>
        {list.length > 1 && (
          <span className="browse-hint">
            <span className="desktop-hint">Scroll or drag to browse</span>
            <span className="mobile-hint">Swipe to browse</span>
            <span>·</span>Tap to explore
          </span>
        )}
      </footer>}
      {detail && (
        <DetailModal
          item={items.find((item) => item.id === detail.item.id) || detail.item}
          source={detail.source}
          onClose={() => setDetail(null)}
          onRemove={archive}
          onChange={updateItem}
        />
      )}
      {["add", "manual"].includes(overlay) && (
        <AddDialog
          key={overlay}
          initialManual={overlay === "manual"}
          defaultType={type}
          items={collection}
          onClose={() => setOverlay("settings")}
          onAdded={added}
        />
      )}
      {["search", "liked"].includes(overlay) && (
        <SearchDialog
          key={overlay}
          liked={overlay === "liked"}
          items={overlay === "liked" ? likedItems : collection}
          onClose={() => setOverlay(null)}
          onPick={pickSearch}
        />
      )}
      {overlay === "settings" && (
        <SettingsDialog
          settings={display}
          items={collection}
          defaultType={type}
          onChange={changeDisplay}
          onClose={() => setOverlay(null)}
          onAdd={(manual) => setOverlay(manual ? "manual" : "add")}
          error={displayError}
        />
      )}
      {toast && (
        <aside className="cabinet-toast" role="status">
          <Icon name="check" size={17} />
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              onClick={() => {
                toast.undo();
                setToast(null);
              }}
            >
              Undo
            </button>
          )}
        </aside>
      )}
    </main>
  );
}
