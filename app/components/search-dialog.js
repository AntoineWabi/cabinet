"use client";
import { useMemo, useState } from "react";
import { useDialog, isBackdrop } from "./dialog";
import { MEDIA_TYPES, searchCollection } from "../../lib/media";
import { Artwork } from "./media-object";
import Icon from "./icons";
export default function SearchDialog({
  items,
  onClose,
  onPick,
  liked = false,
}) {
  const dialog = useDialog();
  const [query, setQuery] = useState("");
  const results = useMemo(
    () =>
      query.trim()
        ? searchCollection(items, query)
        : liked
          ? items
          : items.slice(0, 6),
    [items, query, liked],
  );
  return (
    <dialog
      ref={dialog}
      className={`cb-dialog search-dialog${liked ? " liked-dialog" : ""}`}
      aria-labelledby="search-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (isBackdrop(e)) onClose();
      }}
    >
      <header className="dialog-heading">
        <div>
          <span className="eyebrow">ALL THREE COLLECTIONS</span>
          <h1 id="search-title">
            {liked ? "The ones you love" : "Find something you saved"}
          </h1>
        </div>
        <button
          className="glass icon-button"
          aria-label={liked ? "Close liked items" : "Close search"}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </header>
      <div className="collection-search-field input-with-icon">
        <Icon name={liked ? "heart" : "search"} />
        <input
          aria-label={liked ? "Search liked items" : "Search your collection"}
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            liked ? "Find something you liked…" : "A title, creator, or year…"
          }
        />
        <button
          className="clear-input"
          aria-label="Clear search"
          hidden={!query}
          onClick={() => setQuery("")}
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      <div className="saved-results" aria-live="polite">
        <span className="eyebrow results-label">
          {query.trim()
            ? `${results.length} ${results.length === 1 ? "MATCH" : "MATCHES"}`
            : liked
              ? `${items.length} LIKED ${items.length === 1 ? "ITEM" : "ITEMS"}`
              : "RECENTLY ADDED"}
        </span>
        {results.length ? (
          MEDIA_TYPES.map((entry) => {
            const group = results.filter((item) => item.type === entry.id);
            return (
              group.length > 0 && (
                <section key={entry.id}>
                  <h2>
                    <Icon name={entry.id} size={15} />
                    {entry.label}
                    <span>{group.length}</span>
                  </h2>
                  {group.map((item) => (
                    <button
                      key={item.id}
                      className="result-row"
                      onClick={() => onPick(item)}
                    >
                      <span className={`result-art result-${item.type}`}>
                        <Artwork item={item} />
                      </span>
                      <span className="result-copy">
                        <strong>{item.title}</strong>
                        <small>
                          {[item.creator, item.metadata?.year]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      </span>
                      <Icon name="right" size={17} />
                    </button>
                  ))}
                </section>
              )
            );
          })
        ) : (
          <div className="dialog-empty">
            <Icon name={liked && !query ? "heart" : "search"} size={28} />
            <h2>
              {liked && !query
                ? "Nothing liked yet."
                : "Nothing here by that name."}
            </h2>
            <p>
              {liked && !query
                ? "Open an album, book, or movie and tap Like."
                : "Try another title or creator."}
            </p>
          </div>
        )}
      </div>
      <footer className="add-footer">
        <span>
          {liked
            ? "Your favourites, all in one place."
            : "Music, books, and movies. All in one place."}
        </span>
      </footer>
    </dialog>
  );
}
