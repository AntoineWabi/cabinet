"use client";
import { useState } from "react";
import { useDialog, isBackdrop } from "./dialog";
import Icon from "./icons";
import MediaObject from "./media-object";
import { flowPose, flowStep } from "../flow";
import { DEFAULT_DISPLAY, LAYOUTS } from "../../lib/display-settings";

export default function SettingsDialog({
  settings,
  items,
  defaultType,
  onChange,
  onClose,
  onAdd,
  error,
}) {
  const dialog = useDialog();
  const [type, setType] = useState(defaultType === "movie" ? "movie" : "book");
  const [message, setMessage] = useState("");
  const value = settings[type];
  const preview = items.filter((item) => item.type === type).slice(0, 3);
  function update(patch) {
    setMessage("");
    onChange({ ...settings, [type]: { ...value, ...patch } });
  }
  return (
    <dialog
      ref={dialog}
      className="cb-dialog settings-dialog"
      aria-labelledby="settings-title"
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
          <span className="eyebrow">MAKE YOURSELF AT HOME</span>
          <h1 id="settings-title">Cabinet settings</h1>
        </div>
        <button
          className="glass icon-button"
          autoFocus
          aria-label="Close settings"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </header>
      <div className="settings-body">
        <button
          className="settings-toggle-row"
          role="switch"
          aria-checked={settings.mobile3D}
          aria-labelledby="mobile-carousel-label"
          aria-describedby="mobile-carousel-description"
          onClick={() => onChange({ ...settings, mobile3D: !settings.mobile3D })}
        >
          <span>
            <strong id="mobile-carousel-label">3D carousel on mobile</strong>
            <small id="mobile-carousel-description">Music, books, and movies.</small>
          </span>
          <span className="settings-switch" aria-hidden="true" />
        </button>
        <section aria-labelledby="display-title">
          <div className="settings-section-heading">
            <h2 id="display-title">Display & arrangement</h2>
            <button
              className="text-button"
              onClick={() => {
                onChange({ ...settings, [type]: DEFAULT_DISPLAY[type] });
                setMessage("Default display restored.");
              }}
            >
              Reset
            </button>
          </div>
          <div
            className="media-tabs compact-tabs settings-type"
            aria-label="Display settings for"
          >
            {["book", "movie"].map((entry) => (
              <button
                key={entry}
                aria-pressed={type === entry}
                onClick={() => {
                  setType(entry);
                  setMessage("");
                }}
              >
                <Icon name={entry} />
                {entry === "book" ? "Books" : "Movies"}
              </button>
            ))}
          </div>
          <div
            className="settings-preview"
            aria-hidden="true"
            data-layout={value.layout}
          >
            {preview.length ? (
              preview.map((item, index) => {
                const position = index - Math.floor(preview.length / 2),
                  size = 116;
                const pose = flowPose(position, type, size, true, value.layout);
                const step = flowStep(type, size, true, value.layout);
                const x =
                  value.layout === "stack" ? 0 : position * step + pose.x;
                const y =
                  value.layout === "stack" ? position * step : -pose.lift;
                return (
                  <div
                    className="settings-preview-object"
                    key={item.id}
                    style={{
                      zIndex: 10 - Math.abs(position),
                      transform: `translate(-50%, -50%) translate(${x}px, ${y}px) perspective(1200px) translateZ(${pose.z}px) rotateZ(${pose.roll || 0}deg) rotateY(${pose.rotate}deg) scale(${pose.scale})`,
                    }}
                  >
                    <MediaObject
                      item={item}
                      height={size}
                      active={position === 0}
                    />
                  </div>
                );
              })
            ) : (
              <Icon name={value.layout} size={58} />
            )}
          </div>
          <p className="settings-layout-note">
            {settings.mobile3D
              ? "Layouts apply on desktop and mobile."
              : "Layouts apply on desktop. Mobile uses a grid."}
          </p>
          <div
            className="layout-options"
            aria-label={`${type === "book" ? "Book" : "Movie"} layout`}
          >
            {LAYOUTS.map((layout) => (
              <button
                key={layout}
                className="layout-option"
                aria-pressed={value.layout === layout}
                onClick={() => update({ layout })}
              >
                <Icon name={layout} size={21} />
                <span>{layout[0].toUpperCase() + layout.slice(1)}</span>
              </button>
            ))}
          </div>
          <label className="settings-sort">
            <span>Arrange by</span>
            <select
              value={value.sort}
              onChange={(e) => update({ sort: e.target.value })}
              aria-label="Arrange by"
            >
              <option value="library">Library order</option>
              <option value="spectrum">Colour</option>
              <option value="creator">
                {type === "book" ? "Author" : "Director"}
              </option>
              <option value="title">Title</option>
            </select>
            <Icon name="right" size={14} />
          </label>
          <div className="settings-apply">
            <button
              className="text-button"
              onClick={() => {
                onChange({ ...settings, book: { ...value }, movie: { ...value } });
                setMessage("Applied to books and movies.");
              }}
            >
              Apply to books & movies <Icon name="check" size={15} />
            </button>
            <span role="status">{message}</span>
          </div>
        </section>
        <section className="settings-add" aria-labelledby="settings-add-title">
          <h2 id="settings-add-title">Add to your collection</h2>
          <button className="settings-menu-row" onClick={() => onAdd(false)}>
            <span className="settings-menu-icon">
              <Icon name="search" />
            </span>
            <span>
              <strong>Find something to add</strong>
              <small>Search a catalog or paste a link.</small>
            </span>
            <Icon name="right" size={16} />
          </button>
          <button className="settings-menu-row" onClick={() => onAdd(true)}>
            <span className="settings-menu-icon">
              <Icon name="plus" />
            </span>
            <span>
              <strong>Add by hand</strong>
              <small>A title, a creator, and a link.</small>
            </span>
            <Icon name="right" size={16} />
          </button>
        </section>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <footer className="add-footer">
        <span>Display preferences are saved on this device.</span>
      </footer>
    </dialog>
  );
}
