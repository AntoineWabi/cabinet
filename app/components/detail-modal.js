"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDialog, isBackdrop } from "./dialog";
import MediaObject, { useCover } from "./media-object";
import Icon from "./icons";
import {
  mediaType,
  safeLink,
  sourceName,
  primaryMediaLink,
  isLiked,
  isCompleted,
} from "../../lib/media";

const detailsCache = new Map();
const duration = (ms) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
export default function DetailModal({
  item,
  source,
  onClose,
  onRemove,
  onChange,
}) {
  const dialog = useDialog();
  const hero = useRef(null);
  const flight = useRef(null);
  const recordSlide = useRef(null);
  const turn = useRef(null);
  const closing = useRef(false);
  const colors = useCover(item);
  const [height, setHeight] = useState(300);
  const [extra, setExtra] = useState(() => detailsCache.get(item.id) || {});
  const [loading, setLoading] = useState(!detailsCache.has(item.id));
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const meta = {
    ...item.metadata,
    ...Object.fromEntries(
      Object.entries(extra).filter(
        ([, value]) => value !== undefined && value !== null,
      ),
    ),
  };
  const cfg = mediaType(item.type);
  const url = safeLink(item.external_url);
  const primaryUrl = primaryMediaLink(item);
  const description = meta.description || meta.blurb;
  const liked = isLiked(item);
  const completed = isCompleted(item);
  async function mark(patch) {
    if (saving || closing.current) return;
    setSaving(true);
    setActionError("");
    try {
      await onChange(item, patch);
    } catch (error) {
      setActionError(error.message);
    } finally {
      setSaving(false);
    }
  }
  function spin() {
    if (
      closing.current ||
      flight.current?.playState === "running" ||
      turn.current?.playState === "running"
    )
      return;
    const object = hero.current?.querySelector(".media-object");
    if (!object) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const rest = "translateZ(var(--spin-depth))";
    const animation = object.animate(
      reduce
        ? [
            { transform: rest },
            { transform: `${rest} scale(.98)` },
            { transform: rest },
          ]
        : [
            { transform: `${rest} rotateY(0deg)` },
            { transform: `${rest} rotateY(360deg)` },
          ],
      { duration: reduce ? 160 : 950, easing: "cubic-bezier(.45,0,.2,1)" },
    );
    turn.current = animation;
    animation.finished
      .then(() => {
        if (turn.current === animation) turn.current = null;
        animation.cancel();
      })
      .catch(() => {});
  }
  useEffect(() => () => turn.current?.cancel(), []);

  useLayoutEffect(() => {
    const narrow = window.innerWidth <= 600;
    setHeight(
      item.type === "album" ? (narrow ? 214 : 240) : narrow ? 246 : 270,
    );
  }, [item.type]);
  useLayoutEffect(() => {
    const element = hero.current;
    if (!element || !source?.isConnected) return;
    const from = sourceRect(source);
    const to = element.getBoundingClientRect();
    if (!from.width || !to.width) return;
    const sourceObject = source.closest(".media-object") || source;
    // A fixed hero can travel outside the scrolling detail body. Its slot
    // keeps the layout stable until the shared object lands back inside it.
    pinHero(element, to);
    sourceObject.style.visibility = "hidden";
    let live = true;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    // Carry the visible record with the shared sleeve, then tuck it inside.
    // Use a relative offset because the gallery and detail covers differ in size.
    const record = element.querySelector(".record-disc");
    const sourceRecord = sourceObject.querySelector(".record-disc");
    if (record && sourceRecord && !reduce) {
      recordSlide.current = slideRecord(record, recordOffset(sourceRecord), 0, 420);
    }
    flight.current = element.animate(
      [
        {
          transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`,
        },
        { transform: "translate(0, 0) scale(1)" },
      ],
      {
        duration: reduce ? 1 : 520,
        easing: "cubic-bezier(.22,.7,.16,1)",
        fill: "both",
      },
    );
    flight.current.finished
      .then(() => {
        if (live && !closing.current) {
          releaseHero(element);
          recordSlide.current?.cancel();
        }
      })
      .catch(() => {});
    return () => {
      live = false;
      flight.current?.cancel();
      recordSlide.current?.cancel();
      releaseHero(element);
      sourceObject.style.visibility = "";
    };
  }, [height, source]);

  useEffect(() => {
    if (detailsCache.has(item.id)) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (item.metadata?.work_key) params.set("work", item.metadata.work_key);
    else if (item.external_url?.includes("openlibrary.org/works/"))
      params.set("work", new URL(item.external_url).pathname);
    if (item.metadata?.catalog_id)
      params.set("catalog_id", item.metadata.catalog_id);
    if (url) params.set("source", url);
    params.set("type", item.type);
    params.set("title", item.title);
    if (item.creator) params.set("creator", item.creator);
    fetch(`/api/details?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        detailsCache.set(item.id, data);
        setExtra(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [item, url]);

  async function close(remove = false) {
    if (closing.current) return;
    closing.current = true;
    // Finish an in-flight turn before the cover lands back in the collection.
    // Its rotation is separate from the shared element's travel animation.
    if (turn.current?.playState === "running") {
      const remaining =
        turn.current.effect.getTiming().duration -
        Number(turn.current.currentTime || 0);
      turn.current.updatePlaybackRate(Math.max(1, remaining / 300));
    }
    const element = hero.current;
    const record = element.querySelector(".record-disc");
    const recordFrom = recordOffset(record);
    recordSlide.current?.cancel();
    // Reverse from the currently displayed frame, including an interrupted open.
    const from = element.getBoundingClientRect();
    flight.current?.cancel();
    pinHero(element, from);
    const to = source?.isConnected ? sourceRect(source) : null;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const sourceRecord = source?.isConnected
      ? source.closest(".media-object")?.querySelector(".record-disc")
      : null;
    if (record && sourceRecord && !remove && !reduce) {
      recordSlide.current = slideRecord(
        record,
        recordFrom,
        recordOffset(sourceRecord),
        420,
      );
    }
    // Take over from entrance animations: their filled opacity otherwise keeps
    // the copy visible after the panel has disappeared.
    for (const selector of [
      ".detail-text",
      ".detail-heading",
      ".detail-surface",
    ]) {
      const panel = dialog.current.querySelector(selector);
      const { opacity, transform } = getComputedStyle(panel);
      panel.getAnimations().forEach((animation) => animation.cancel());
      panel.animate(
        [
          { opacity, transform },
          { opacity: 0, transform },
        ],
        {
          duration: reduce ? 1 : selector === ".detail-surface" ? 180 : 120,
          easing: "ease-out",
          fill: "forwards",
        },
      );
    }
    dialog.current.classList.add("is-closing");
    const animation = element.animate(
      to && !remove
        ? [
            { transform: "translate(0, 0) scale(1)", opacity: 1 },
            {
              transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`,
              opacity: 1,
            },
          ]
        : [{ opacity: 1 }, { opacity: 0 }],
      {
        duration: reduce ? 1 : 420,
        easing: "cubic-bezier(.4,.06,.2,1)",
        fill: "both",
      },
    );
    await animation.finished.catch(() => {});
    if (source)
      (source.closest(".media-object") || source).style.visibility = "";
    onClose();
    if (remove) onRemove(item);
  }
  const year = meta.year || item.year;
  const facts = [
    [item.type === "book" ? "Published" : "Released", year],
    [
      item.type === "book" ? "Pages" : "Length",
      item.type === "book"
        ? meta.pages
        : meta.duration_mins
          ? `${meta.duration_mins} min`
          : null,
    ],
    ["Genre", meta.genre],
    ["Tracks", meta.track_count],
  ].filter(([, value]) => value);
  return (
    <dialog
      ref={dialog}
      className={`cb-dialog detail-dialog detail-${item.type}`}
      aria-labelledby="detail-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (isBackdrop(e)) close();
      }}
      style={{ "--detail-tint": colors.spine }}
    >
      <div className="detail-surface" />
      <header className="dialog-heading detail-heading">
        <span className="eyebrow">
          <Icon name={item.type} size={16} /> In your {cfg.label.toLowerCase()}{" "}
          collection
        </span>
        <button
          className="glass icon-button"
          autoFocus
          aria-label="Close details"
          onClick={() => close()}
        >
          <Icon name="close" />
        </button>
      </header>
      <div className="detail-layout">
        <div className="detail-art-column">
          <div
            className="detail-art-slot"
            style={{
              width:
                height *
                (item.type === "album"
                  ? 1
                  : item.type === "movie"
                    ? 0.66
                    : colors.aspectRatio),
              height,
            }}
          >
            <div className="detail-art" ref={hero}>
              <button
                className="detail-spin"
                aria-label={`Spin ${item.title} 360 degrees`}
                onClick={spin}
              >
                <MediaObject item={item} height={height} flat />
              </button>
            </div>
          </div>
        </div>
        <div className="detail-text">
          <span className="eyebrow detail-kind">
            {cfg.singular}
            {year ? ` · ${year}` : ""}
          </span>
          <h1 id="detail-title">{item.title}</h1>
          {item.creator && <p className="detail-creator">{item.creator}</p>}
          <div
            className="detail-actions"
            aria-label="Item actions"
            aria-busy={saving}
          >
            {primaryUrl && (
              <a
                className="glass source-button"
                href={primaryUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open in {sourceName(primaryUrl)}
                <Icon name="arrow" size={17} />
              </a>
            )}
            <div className="detail-marks">
              <button
                className="glass status-toggle"
                aria-pressed={completed}
                disabled={saving}
                onClick={() => mark({ completed: !completed })}
              >
                <Icon name="check" size={17} />
                {completed
                  ? cfg.completed
                  : `Mark as ${cfg.completed.toLowerCase()}`}
              </button>
              <button
                className="glass like-toggle"
                aria-pressed={liked}
                disabled={saving}
                onClick={() => mark({ liked: !liked })}
              >
                <Icon
                  name="heart"
                  size={17}
                  fill={liked ? "currentColor" : "none"}
                />
                {liked ? "Liked" : "Like"}
              </button>
            </div>
          </div>
          {actionError && (
            <p className="form-error" role="alert">
              {actionError}
            </p>
          )}
          {facts.length > 0 && (
            <dl className="detail-facts">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
          <section className="detail-about">
            <h2>About this {cfg.singular.toLowerCase()}</h2>
            {description ? (
              <p>{description}</p>
            ) : (
              <p className="muted">
                {loading
                  ? "Finding a little more about this one…"
                  : "No description available for this edition."}
              </p>
            )}
            {meta.subjects?.length > 0 && (
              <div className="detail-subjects">
                {meta.subjects.slice(0, 3).map((subject) => (
                  <span key={subject}>{subject}</span>
                ))}
              </div>
            )}
            {meta.note && <p className="saved-context">{meta.note}</p>}
          </section>
          {meta.tracks?.length > 0 && (
            <section className="detail-tracks">
              <h2>Track list</h2>
              <ol>
                {meta.tracks.map((track, index) => (
                  <li key={`${track.number}-${index}`}>
                    <span>{track.number || index + 1}</span>
                    <strong>{track.title}</strong>
                    <span>
                      {track.duration_ms ? duration(track.duration_ms) : ""}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
          <footer className="detail-footer">
            <span>
              {item.created_at
                ? `Added ${new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                : "Saved in Cabinet"}
            </span>
            <button
              className="text-button remove-button"
              disabled={saving}
              onClick={() => close(true)}
            >
              <Icon name="trash" size={15} /> Dismiss
            </button>
          </footer>
        </div>
      </div>
    </dialog>
  );
}

function recordOffset(record) {
  if (!record?.offsetHeight) return 0;
  const transform = getComputedStyle(record).transform;
  return transform === "none"
    ? 0
    : (new DOMMatrixReadOnly(transform).m42 / record.offsetHeight) * 100;
}

function slideRecord(record, from, to, duration) {
  return record.animate(
    [
      { transform: `translateY(${from}%)`, visibility: "visible" },
      { transform: `translateY(${to}%)`, visibility: "visible" },
    ],
    {
      duration,
      easing: "cubic-bezier(.4,.06,.2,1)",
      fill: "both",
    },
  );
}

function sourceRect(source) {
  const stack = source.closest('.flow-row[data-layout="stack"]');
  if (!stack) return source.getBoundingClientRect();
  // Stacks presents a horizontal spine. Emerge a cover from its centre rather
  // than stretching the nearly edge-on face into the detail object.
  const object = source.closest(".media-object");
  const centre = stack.getBoundingClientRect();
  const width = object.offsetWidth * 0.94,
    height = object.offsetHeight * 0.94;
  return {
    left: centre.left + (centre.width - width) / 2,
    top: centre.top + (centre.height - height) / 2,
    width,
    height,
  };
}

function pinHero(element, rect) {
  Object.assign(element.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
}
function releaseHero(element) {
  for (const key of ["position", "left", "top", "width", "height"])
    element.style[key] = "";
}
