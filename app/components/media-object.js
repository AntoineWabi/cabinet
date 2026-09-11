"use client";
import { useEffect, useState } from "react";
import {
  analyzeCover,
  artworkSource,
  fallbackCover,
  knownCover,
} from "../../lib/cover-analysis";
import Icon from "./icons";

export function useCover(item) {
  const [result, setResult] = useState(
    () => knownCover(item.image_url) || fallbackCover(item.title),
  );
  useEffect(() => {
    let live = true;
    analyzeCover(item.image_url, item.title).then((data) => {
      if (live) setResult(data);
    });
    return () => {
      live = false;
    };
  }, [item.image_url, item.title]);
  return result;
}
export function Artwork({ item, className = "", ...props }) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [item.image_url]);
  return item.image_url && !bad ? (
    <img
      className={className}
      src={artworkSource(item.image_url)}
      alt=""
      draggable={false}
      decoding="async"
      onError={() => setBad(true)}
      {...props}
    />
  ) : (
    <span
      className={`art-fallback ${className}`}
      style={{ "--fallback": fallbackCover(item.title).spine }}
    >
      <Icon name={item.type} size={32} />
      <strong>{item.title}</strong>
      <small>{item.creator}</small>
    </span>
  );
}
export default function MediaObject({
  item,
  height,
  active = false,
  flat = false,
}) {
  const colors = useCover(item);
  const type = item.type;
  const ratio =
    type === "album" ? 1 : type === "movie" ? 0.66 : colors.aspectRatio;
  const pageCount = Number(item.metadata?.pages);
  // Books grow from a slim 18px paperback to a 46px tome. The square-root
  // curve keeps ordinary novels distinct without letting very long books
  // overwhelm the shelf. Unknown editions use a neutral 280-page depth.
  const bookDepth = Math.max(
    18,
    Math.min(46, 11 + Math.sqrt(pageCount || 280) * 1.12),
  );
  const depth = type === "movie" ? height * 0.131 : bookDepth;
  const style = {
    width: height * ratio,
    height,
    "--depth": `${depth}px`,
    "--half-depth": `${depth / 2}px`,
    "--spine": colors.spine,
    "--top-color": colors.top,
    "--spine-ink": colors.ink,
  };
  return (
    <div
      aria-hidden="true"
      className={`media-object object-${type}${active ? " is-active" : ""}${flat ? " is-flat" : ""}`}
      style={style}
    >
      {type === "album" ? (
        <>
          {flat && (
            <div className="record-back">
              <strong>{item.title}</strong>
              <small>{item.creator}</small>
            </div>
          )}
          <div className="record-disc">
            <i className="record-label">
              <Artwork item={item} />
            </i>
            <i className="record-hole" />
          </div>
          <div className="media-front record-sleeve">
            <Artwork item={item} />
            <i className="cover-sheen" />
          </div>
        </>
      ) : (
        <>
          <div className="object-face object-back" />
          <div className="object-face object-spine">
            <span className="spine-author">{item.creator}</span>
            <strong>{item.title}</strong>
            <i>{type === "movie" ? "VHS" : "●"}</i>
          </div>
          <div className="object-face object-fore" />
          <div className="object-face object-top" />
          <div className="object-face object-bottom" />
          {type === "book" && (
            <>
              <div className="book-board board-top" />
              <div className="book-board board-bottom" />
              <div className="book-board board-fore" />
              <div className="book-board board-top is-rear" />
              <div className="book-board board-bottom is-rear" />
              <div className="book-board board-fore is-rear" />
            </>
          )}
          <div className="media-front object-face">
            <Artwork item={item} />
            <i className="cover-sheen" />
            {type === "movie" && (
              <>
                <span className="tape-seam" />
                <span className="vhs-label">
                  <small>Cabinet Video</small>
                  <b>{item.metadata?.year || item.year || "VHS"}</b>
                  <i>SP</i>
                </span>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
