"use client";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import MediaObject from "./components/media-object";

// Vinyl's normalized pose and native scroll-snap; VHS uses its case dimensions.
// Stacks' shelf law adds space around the featured book and turns neighbors to spines.
export function flowPose(
  distance,
  type,
  size,
  narrow,
  layout = type === "book" ? "shelf" : "coverflow",
) {
  const d = Math.max(-8, Math.min(8, distance));
  const amount = Math.min(1, Math.abs(d));
  if (layout === "stack")
    return {
      rotate: 90,
      roll: 90,
      x: 0,
      z: 18 * (1 - amount),
      scale: 1 - 0.08 * amount,
      lift: 0,
    };
  if (layout === "shelf")
    return {
      rotate: 88 * amount,
      x: Math.sign(d) * (size * 0.34 + (narrow ? 20 : 35)) * amount,
      z: -22 * amount,
      scale: 1 - 0.07 * amount,
      lift: 0,
    };
  return {
    rotate: Math.max(-52, Math.min(52, -d * 44)),
    x: 0,
    z: (-Math.min(150, Math.abs(d) * 78) * size) / 300,
    scale: 1,
    lift: Math.max(0, 0.5 - Math.abs(d)) * 12,
  };
}
export function flowStep(type, size, narrow, layout) {
  if (layout === "stack")
    return size * (type === "movie" ? 0.131 : 0.088) + (narrow ? 12 : 16);
  if (layout === "shelf") return size * 0.155;
  return size * (type === "album" ? 0.573 : 0.66 * 0.651);
}
const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const Flow = forwardRef(function Flow(
  {
    items,
    type,
    initialId,
    onActive,
    onPick,
    layout = type === "book" ? "shelf" : "coverflow",
  },
  ref,
) {
  const row = useRef(null);
  const frame = useRef(0);
  const drag = useRef(null);
  const start = initialId
    ? Math.max(
        0,
        items.findIndex((item) => item.id === initialId),
      )
    : Math.floor((items.length - 1) / 2);
  const activeRef = useRef(start);
  const remembered = useRef(items[start]?.id);
  const onActiveRef = useRef(onActive);
  onActiveRef.current = onActive;
  const [active, setActive] = useState(start);
  const [dims, setDims] = useState({ height: 300, narrow: false });
  const size = type === "album" ? dims.height * 0.87 : dims.height;
  const vertical = layout === "stack";
  const step = flowStep(type, size, dims.narrow, layout);

  const paint = useCallback(() => {
    const el = row.current;
    if (!el || !step) return;
    const position = (vertical ? el.scrollTop : el.scrollLeft) / step;
    const nearest = Math.max(
      0,
      Math.min(items.length - 1, Math.round(position)),
    );
    for (const slot of el.children) {
      const index = Number(slot.dataset.index);
      const card = slot.firstElementChild;
      if (!card) continue;
      const d = index - position;
      const p = flowPose(d, type, size, dims.narrow, layout);
      slot.style.zIndex = String(100 - Math.round(Math.abs(d) * 8));
      card.style.transform = `translate(-50%, -50%) perspective(1200px) translateX(${p.x}px) translateZ(${p.z}px) rotateZ(${p.roll || 0}deg) rotateY(${p.rotate}deg) translateY(${-p.lift}px) scale(${p.scale})`;
    }
    if (activeRef.current !== nearest) {
      activeRef.current = nearest;
      remembered.current = items[nearest]?.id;
      setActive(nearest);
      onActiveRef.current?.(nearest, items[nearest]);
    }
  }, [items, step, type, size, dims.narrow, layout, vertical]);
  const scroll = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(paint);
  }, [paint]);
  const goTo = useCallback(
    (index, instant = false) => {
      const target = Math.max(0, Math.min(items.length - 1, index));
      row.current?.scrollTo({
        [vertical ? "top" : "left"]: target * step,
        behavior: instant || reducedMotion() ? "instant" : "smooth",
      });
    },
    [items.length, step, vertical],
  );
  useImperativeHandle(
    ref,
    () => ({
      move: (delta) => goTo(activeRef.current + delta),
      open: () => {
        const item = items[activeRef.current];
        const el = row.current?.querySelector(
          `[data-index="${activeRef.current}"] .media-front`,
        );
        if (item) onPick(item, el);
      },
    }),
    [items, goTo, onPick],
  );

  useLayoutEffect(() => {
    const el = row.current;
    const measure = () => {
      // The scroll padding deliberately consumes all but one pitch. Measure
      // the viewport, not contentRect, which excludes that centering padding.
      const w = el.clientWidth,
        h = el.clientHeight;
      const narrow = w < 640;
      setDims({
        height: Math.round(
          Math.max(
            80,
            Math.min(narrow ? 310 : 390, h * 0.76, w * (narrow ? 0.75 : 0.4)),
          ),
        ),
        narrow,
      });
      el.style.setProperty("--flow-height", `${h}px`);
    };
    // Set the vertical centering padding before the first scroll-snap position.
    // A placeholder height can otherwise snap a search pick onto its neighbour.
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const found = items.findIndex((item) => item.id === remembered.current);
    const index =
      found >= 0 ? found : Math.min(activeRef.current, items.length - 1);
    activeRef.current = Math.max(0, index);
    remembered.current = items[activeRef.current]?.id;
    setActive(activeRef.current);
    if (row.current) {
      row.current[vertical ? "scrollLeft" : "scrollTop"] = 0;
      row.current[vertical ? "scrollTop" : "scrollLeft"] =
        activeRef.current * step;
    }
    paint();
    onActiveRef.current?.(activeRef.current, items[activeRef.current]);
  }, [items, step, paint, vertical]);
  useLayoutEffect(() => {
    paint();
  }, [active, paint]);
  useEffect(() => {
    const el = row.current;
    const wheel = (e) => {
      if (vertical) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || e.ctrlKey) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY * (e.deltaMode === 1 ? 16 : 1);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", wheel);
      cancelAnimationFrame(frame.current);
    };
  }, [vertical]);

  function pointerDown(e) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    drag.current = {
      x: vertical ? e.clientY : e.clientX,
      scroll: vertical ? row.current.scrollTop : row.current.scrollLeft,
      moved: false,
      pointer: e.pointerId,
    };
  }
  function pointerMove(e) {
    const d = drag.current;
    if (!d) return;
    const pointer = vertical ? e.clientY : e.clientX;
    if (Math.abs(pointer - d.x) > 5) {
      d.moved = true;
      row.current.setPointerCapture(e.pointerId);
      row.current.style.scrollSnapType = "none";
      row.current[vertical ? "scrollTop" : "scrollLeft"] =
        d.scroll - (pointer - d.x);
    }
  }
  function pointerUp(e) {
    const d = drag.current;
    if (!d) return;
    if (d.moved) {
      row.current.style.scrollSnapType = "";
      if (row.current.hasPointerCapture(e.pointerId))
        row.current.releasePointerCapture(e.pointerId);
      goTo(
        Math.round(row.current[vertical ? "scrollTop" : "scrollLeft"] / step),
      );
    }
    // Click is dispatched after pointerup. Retain its drag flag through that event.
    setTimeout(() => {
      if (drag.current === d) drag.current = null;
    }, 0);
  }
  return (
    <div
      className={`flow-row flow-${type}${vertical ? " is-stack" : ""}`}
      data-layout={layout}
      ref={row}
      role="region"
      aria-roledescription="carousel"
      aria-label={`${type === "album" ? "Music" : type === "book" ? "Books" : "Movies"} collection`}
      style={{ "--flow-step": `${step}px` }}
      onScroll={scroll}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={() => {
        drag.current = null;
        if (row.current) row.current.style.scrollSnapType = "";
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const item = items[activeRef.current];
          const source = row.current?.querySelector(
            `[data-index="${activeRef.current}"] .media-front`,
          );
          if (item) onPick(item, source);
        } else if (
          [
            "ArrowRight",
            "ArrowLeft",
            "ArrowDown",
            "ArrowUp",
            "Home",
            "End",
          ].includes(e.key)
        ) {
          e.preventDefault();
          goTo(
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? items.length - 1
                : activeRef.current +
                  (["ArrowRight", "ArrowDown"].includes(e.key) ? 1 : -1),
          );
        }
      }}
    >
      {items.map((item, index) => (
        <div
          className="flow-slot"
          key={item.id}
          data-index={index}
          style={vertical ? { height: step, width: "100%" } : { width: step }}
        >
          {Math.abs(index - active) <= 9 && (
            <button
              className="flow-card"
              tabIndex={index === active ? 0 : -1}
              aria-label={`${item.title}${item.creator ? ` by ${item.creator}` : ""}${index === active ? ", open details" : ", bring to front"}`}
              aria-current={index === active ? "true" : undefined}
              onClick={(e) => {
                if (drag.current?.moved) return;
                if (index === activeRef.current)
                  onPick(item, e.currentTarget.querySelector(".media-front"));
                else goTo(index);
              }}
            >
              <MediaObject
                item={item}
                height={size}
                active={index === active}
              />
            </button>
          )}
        </div>
      ))}
    </div>
  );
});
export default Flow;
