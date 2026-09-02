'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

// Apple-Cover-Flow carousel on a native scroll-snap row. The pose law comes
// from the Vinyl/Stacks prototypes: rotY ±52°, translateZ to -150, and only
// the centered card lifts. Scrolling drives every card's transform directly
// (no React re-render); React only learns the active index for the caption.
export default function Flow({ items, cardW, ratio, overlap, onActive, onPick, footer }) {
  const row = useRef(null);
  const raf = useRef(0);
  const [active, setActive] = useState(-1);
  const STEP = cardW - overlap * 2;

  const paint = useCallback(() => {
    const el = row.current;
    if (!el) return;
    const mid = el.scrollLeft + el.clientWidth / 2;
    const slots = el.children;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const center = slot.offsetLeft + cardW / 2;
      const c = (center - mid) / STEP;
      if (Math.abs(c) < bestD) { bestD = Math.abs(c); best = i; }
      const cc = Math.max(-4, Math.min(4, c));
      const rotY = Math.max(-52, Math.min(52, -cc * 44));
      const z = -Math.min(150, Math.abs(cc) * 78);
      const lift = Math.abs(cc) < 0.5 ? (0.5 - Math.abs(cc)) * 12 : 0;
      const inner = slot.firstChild;
      inner.style.transform = `perspective(1000px) translateZ(${z}px) rotateY(${rotY}deg) translateY(${-lift}px)`;
      inner.style.zIndex = String(100 - Math.round(Math.abs(cc) * 10));
    }
    setActive((a) => (a === best ? a : best));
  }, [STEP, cardW]);

  const onScroll = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(paint);
  }, [paint]);

  // Park on the middle card whenever a new list arrives.
  useEffect(() => {
    const el = row.current;
    if (!el || !items.length) return;
    el.scrollLeft = Math.floor((items.length - 1) / 2) * STEP;
    paint();
  }, [items, STEP, paint]);

  useEffect(() => { onActive?.(active, items[active] || null); }, [active, items, onActive]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const goTo = useCallback((i) => {
    const el = row.current;
    if (!el) return;
    el.scrollTo({ left: i * STEP, behavior: 'smooth' });
  }, [STEP]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') goTo(Math.min(items.length - 1, active + 1));
      if (e.key === 'ArrowLeft') goTo(Math.max(0, active - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, items.length, goTo]);

  if (!items.length) return null;

  return (
    <div
      className="cf-row"
      ref={row}
      onScroll={onScroll}
      style={{ '--step': `${STEP}px`, '--half': `${STEP / 2}px` }}
    >
      {items.map((it, i) => (
        <div
          className="cf-slot"
          key={it.id}
          style={{ width: cardW, margin: `0 ${-overlap}px` }}
          onClick={() => (i === active ? onPick?.(it) : goTo(i))}
        >
          <div className="cf-3d">
            <Cover item={it} cardW={cardW} ratio={ratio} />
            {footer?.(it, i === active)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Cover({ item, cardW, ratio }) {
  const [bad, setBad] = useState(false);
  return (
    <div className="cf-card" style={{ width: cardW, aspectRatio: ratio }}>
      {item.image_url && !bad ? (
        <img src={item.image_url} alt="" draggable={false} onError={() => setBad(true)} />
      ) : (
        <div className="cf-blank" style={{ background: blankTint(item.title) }}>
          <strong>{item.title}</strong>
          <span>{item.creator || item.type}</span>
        </div>
      )}
    </div>
  );
}

// Deterministic pastel tint for coverless items, so a fan of blanks still
// reads as separate records.
export function blankTint(title = '') {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) % 360;
  return `linear-gradient(160deg, hsl(${h}, 26%, 88%), hsl(${(h + 24) % 360}, 22%, 74%))`;
}
