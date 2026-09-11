"use client";
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { Artwork } from "./media-object";
import { mediaType, bookShelfOf, BOOK_SHELVES } from "../../lib/media";

const CollectionGrid = forwardRef(function CollectionGrid(
  { items, type, shelf, onPick, scrollPositions },
  ref,
) {
  const grid = useRef(null);
  const cards = useRef(new Map());
  const cover = (card) =>
    card.querySelector(".grid-art > img, .grid-art > .art-fallback");

  useLayoutEffect(() => {
    const element = grid.current;
    element.scrollTop = scrollPositions.current[type] || 0;
  }, [type, scrollPositions]);

  useImperativeHandle(
    ref,
    () => ({
      open(id) {
        const item = items.find((entry) => entry.id === id);
        const card = cards.current.get(id);
        if (!item || !card) return;
        // Search may target a card below the fold. Reveal it before measuring
        // the cover, and return focus here when details close.
        card.scrollIntoView({ block: "center", behavior: "instant" });
        card.focus({ preventScroll: true });
        onPick(item, cover(card));
      },
    }),
    [items, onPick],
  );

  return (
    <div
      className="collection-grid-scroll"
      ref={grid}
      onScroll={(event) => {
        scrollPositions.current[type] = event.currentTarget.scrollTop;
      }}
    >
      {(type === "book" && shelf === "all"
        ? BOOK_SHELVES.map((entry) => ({
            ...entry,
            items: items.filter((item) => bookShelfOf(item) === entry.id),
          })).filter((entry) => entry.items.length)
        : [{ id: shelf || type, label: "", items }]
      ).map((group) => (
        <section className="grid-shelf" key={group.id}>
          {group.label && <header><h2>{group.label}</h2><span>{group.items.length}</span></header>}
          <ul className={`collection-grid grid-${type}`} aria-label={`${mediaType(type).label} collection`}>
            {group.items.map((item, index) => (
              <li key={item.id}>
                <button
                  ref={(element) => {
                    if (element) cards.current.set(item.id, element);
                    else cards.current.delete(item.id);
                  }}
                  className="grid-card"
                  data-item-id={item.id}
                  aria-label={`${item.title}${item.creator ? ` by ${item.creator}` : ""}. View details`}
                  onClick={(event) => {
                    event.currentTarget.focus({ preventScroll: true });
                    onPick(item, cover(event.currentTarget));
                  }}
                >
                  <span className="grid-art" aria-hidden="true">
                    <Artwork item={item} loading={index < 6 ? "eager" : "lazy"} />
                  </span>
                  <span className="grid-copy"><strong>{item.title}</strong><span>{item.creator || item.metadata?.year || item.year}</span></span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
});

export default CollectionGrid;
