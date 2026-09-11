"use client";
import { useEffect, useRef, useState } from "react";
import { useDialog, isBackdrop } from "./dialog";
import { MEDIA_TYPES, mediaType, safeLink, sameItem } from "../../lib/media";
import { Artwork } from "./media-object";
import Icon from "./icons";
export default function AddDialog({
  defaultType,
  items,
  onClose,
  onAdded,
  initialManual = false,
}) {
  const dialog = useDialog();
  const [type, setType] = useState(defaultType);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(null);
  const manual = initialManual;
  const controller = useRef(null);
  const saving = useRef(false);
  const cfg = mediaType(type);
  useEffect(() => () => controller.current?.abort(), []);
  function changeType(next) {
    controller.current?.abort();
    setType(next);
    setResults(null);
    setError("");
    setBusy(false);
  }
  async function search(event) {
    event?.preventDefault();
    const q = query.trim();
    if (!q) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setResults(null);
    setError("");
    try {
      const response = await fetch(
        `/api/lookup?${new URLSearchParams({ type, q })}`,
        { signal: request.signal },
      );
      const json = await response.json();
      if (!response.ok)
        throw new Error(json.error || "Could not search. Try again.");
      setResults(json.results || []);
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message);
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }
  async function save(item, key) {
    if (saving.current) return;
    saving.current = true;
    setAdding(key);
    setError("");
    try {
      const response = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...item,
          metadata: {
            ...item.metadata,
            ...(item.year ? { year: item.year } : {}),
          },
        }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Your session has expired. Sign in again to add this item."
            : "This item could not be saved. Please try again.",
        );
      onAdded(await response.json());
    } catch (err) {
      setError(err.message);
    } finally {
      saving.current = false;
      setAdding(null);
    }
  }
  function addManually(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    save(
      {
        type,
        title: String(data.get("title")).trim(),
        creator: String(data.get("creator")).trim(),
        external_url: safeLink(data.get("url")),
        year: String(data.get("year")).trim(),
      },
      "manual",
    );
  }
  return (
    <dialog
      ref={dialog}
      className="cb-dialog add-dialog"
      aria-labelledby="add-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!saving.current) onClose();
      }}
      onClick={(e) => {
        if (!saving.current && isBackdrop(e)) onClose();
      }}
    >
      <header className="dialog-heading">
        <div>
          <span className="eyebrow">MAKE ROOM FOR SOMETHING GOOD</span>
          <h1 id="add-title">Add to your cabinet</h1>
        </div>
        <button
          className="glass icon-button"
          disabled={!!adding}
          onClick={onClose}
          aria-label="Close add dialog"
        >
          <Icon name="close" />
        </button>
      </header>
      <div className="add-body">
        <div
          className="media-tabs compact-tabs"
          role="tablist"
          aria-label="Type to add"
        >
          {MEDIA_TYPES.map((entry) => (
            <button
              type="button"
              role="tab"
              aria-selected={type === entry.id}
              key={entry.id}
              disabled={!!adding}
              onClick={() => changeType(entry.id)}
            >
              <Icon name={entry.id} size={17} />
              {entry.label}
            </button>
          ))}
        </div>
        {manual ? (
          <form className="manual-form" onSubmit={addManually}>
            <label>
              Title
              <input
                name="title"
                autoFocus
                required
                maxLength={500}
                placeholder={`The ${cfg.singular.toLowerCase()} title`}
                defaultValue={/^https?:/.test(query) ? "" : query}
              />
            </label>
            <div className="form-columns">
              <label>
                {type === "album"
                  ? "Artist"
                  : type === "book"
                    ? "Author"
                    : "Director"}
                <input name="creator" maxLength={500} placeholder="Name" />
              </label>
              <label>
                Year
                <input
                  name="year"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  placeholder="Optional"
                />
              </label>
            </div>
            <label>
              Source link
              <input
                name="url"
                type="url"
                placeholder="https://…"
                defaultValue={safeLink(query) || ""}
              />
            </label>
            <button className="glass manual-submit" disabled={!!adding}>
              {adding ? "Adding…" : `Add ${cfg.singular.toLowerCase()}`}
              <Icon name="plus" size={18} />
            </button>
          </form>
        ) : (
          <>
            <form className="catalog-search" onSubmit={search}>
              <div className="input-with-icon">
                <Icon name="search" />
                <input
                  autoFocus
                  aria-label="Search catalog or paste a link"
                  placeholder={`Search ${cfg.noun}, or paste a link…`}
                  value={query}
                  onChange={(e) => {
                    controller.current?.abort();
                    setBusy(false);
                    setResults(null);
                    setError("");
                    setQuery(e.target.value);
                  }}
                  disabled={!!adding}
                />
                <button
                  type="button"
                  className="clear-input"
                  aria-label="Clear catalog search"
                  onClick={() => {
                    controller.current?.abort();
                    setBusy(false);
                    setQuery("");
                    setResults(null);
                    setError("");
                  }}
                  hidden={!query}
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
              <button
                className="glass find-button"
                disabled={busy || !query.trim() || !!adding}
              >
                {busy ? <span className="spinner" /> : "Find"}
              </button>
            </form>
            <div
              className="catalog-results"
              aria-live="polite"
              aria-busy={busy}
            >
              {busy && (
                <div className="dialog-empty">
                  <span className="spinner" />
                  <p>Looking through the catalog…</p>
                </div>
              )}
              {!busy && results === null && !error && (
                <div className="dialog-empty">
                  <span className="empty-icon">
                    <Icon name={type} size={30} />
                  </span>
                  <h2>What caught your attention?</h2>
                  <p>
                    Find something by title or creator.
                    <br />
                    Or paste{" "}
                    {type === "album"
                      ? "a Spotify or Apple Music"
                      : type === "book"
                        ? "an Open Library"
                        : "a Wikipedia film"}{" "}
                    link.
                  </p>
                </div>
              )}
              {results?.length === 0 && (
                <div className="dialog-empty">
                  <Icon name="search" size={28} />
                  <h2>No matches this time.</h2>
                  <p>
                    Try the title and creator, or add it by hand in Cabinet
                    settings.
                  </p>
                </div>
              )}
              {results?.map((result, index) => {
                const saved = items.some((item) => sameItem(item, result));
                return (
                  <button
                    className="result-row"
                    key={`${result.external_id || result.title}-${index}`}
                    onClick={() => save(result, index)}
                    disabled={saved || !!adding}
                    aria-label={
                      saved
                        ? `${result.title}, already in your collection`
                        : `Add ${result.title}`
                    }
                  >
                    <span className={`result-art result-${result.type}`}>
                      <Artwork item={result} />
                    </span>
                    <span className="result-copy">
                      <strong>{result.title}</strong>
                      <small>
                        {[result.creator, result.year]
                          .filter(Boolean)
                          .join(" · ") || mediaType(result.type).singular}
                      </small>
                    </span>
                    <span
                      className={`result-action${saved ? " is-saved" : ""}`}
                    >
                      {adding === index ? (
                        <span className="spinner" />
                      ) : (
                        <Icon name={saved ? "check" : "plus"} size={19} />
                      )}
                      <span>{saved ? "Added" : "Add"}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <footer className="add-footer">
        <button className="text-button" disabled={!!adding} onClick={onClose}>
          <Icon name="left" size={14} /> Back to settings
        </button>
      </footer>
    </dialog>
  );
}
