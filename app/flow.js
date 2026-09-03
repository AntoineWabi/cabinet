'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

// Apple-Cover-Flow carousel on a native scroll-snap row. The pose law comes
// from the Vinyl/Stacks prototypes: rotY ±52°, translateZ to -150, and only
// the centered card lifts. Scrolling drives every card's transform directly
// (no React re-render); React only learns the active index for the caption.
export default function Flow({ items, cardW, ratio, overlap, onActive, onPick, footer, kind }) {
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
    // Books take Stacks' fan: 55deg on narrow screens, 70deg on desktop, so
    // spines and page blocks swing out from behind the foreshortened cover.
    const maxRot = kind === 'book' ? (el.clientWidth < 640 ? 55 : 70) : 44;
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const center = slot.offsetLeft + cardW / 2;
      const c = (center - mid) / STEP;
      if (Math.abs(c) < bestD) { bestD = Math.abs(c); best = i; }
      const cc = Math.max(-4, Math.min(4, c));
      const rotY = Math.max(-(maxRot + 8), Math.min(maxRot + 8, -cc * maxRot));
      const z = -Math.min(150, Math.abs(cc) * 78);
      const lift = Math.abs(cc) < 0.5 ? (0.5 - Math.abs(cc)) * 12 : 0;
      const inner = slot.firstChild;
      inner.style.transform = `perspective(1000px) translateZ(${z}px) rotateY(${rotY}deg) translateY(${-lift}px)`;
      inner.style.zIndex = String(100 - Math.round(Math.abs(cc) * 10));
      // Rear planes: hidden only near head-on, where the front cover fully
      // occludes them and Blink can mis-sort a rear plane over the front;
      // visible once the card angles, so fanned books/tapes stay solid.
      // Angle-driven (not React state) so it tracks mid-swipe poses.
      const rw = inner.querySelector('.bk-back, .tp-back-inner');
      if (rw) rw.style.visibility = Math.abs(rotY) < 12 ? 'hidden' : '';
      const disc = inner.querySelector('.vy-disc');
      if (disc) disc.style.transform = `translateX(-50%) translateY(${Math.abs(cc) < 0.5 ? -46 : 2}%)`;
    }
    setActive((a) => (a === best ? a : best));
  }, [STEP, cardW, kind]);

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
      style={{
        '--step': `${STEP}px`,
        '--half': `${STEP / 2}px`,
        // Sleeves need vertical room: the row's overflow-x clips vertically
        // too, so pad for the disc peeking above and the reflection below.
        ...(kind === 'sleeve'
          ? { '--padT': `${Math.round(cardW * 0.48)}px` }
          : {}),
      }}
    >
      {items.map((it, i) => (
        <div
          className="cf-slot"
          key={it.id}
          style={{ width: cardW, margin: `0 ${-overlap}px` }}
          onClick={() => (i === active ? onPick?.(it) : goTo(i))}
        >
          <div className="cf-3d">
            <Cover item={it} cardW={cardW} ratio={ratio} kind={kind} flat={i === active} />
            {footer?.(it, i === active)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Cover({ item, cardW, ratio, kind, flat }) {
  const [bad, setBad] = useState(false);
  const art = item.image_url && !bad
    ? <img src={item.image_url} alt="" draggable={false} onError={() => setBad(true)} />
    : <div className="cf-blank" style={{ background: blankTint(item.title) }}>
        <strong>{item.title}</strong>
        <span>{item.creator || item.type}</span>
      </div>;

  if (kind === 'book') {
    const bd = Math.max(24, Math.round(cardW * 0.14));
    const tint = blankTint(item.title);
    const author = (item.creator || '').toUpperCase();
    return (
      <div className="cf-card bk" style={{ width: cardW, aspectRatio: ratio, '--bd': `${bd}px` }}>
        <div className="bk-pages" />
        <div className="bk-pages-t" />
        <div className="bk-pages-b" />
        <div className="bk-edge bk-edge-r" style={{ background: tint }} />
        <div className="bk-edge bk-edge-l" style={{ background: tint }} />
        <div className="bk-edge bk-edge-t" style={{ background: tint }} />
        <div className="bk-edge bk-edge-b" style={{ background: tint }} />
        <div className="bk-spine" style={{ background: tint }}>
          <span className="bk-spine-text">
            <span className="bk-spine-author">{author}</span>
            <span className="bk-spine-title">{item.title}</span>
          </span>
          <i />
        </div>
        <div className="bk-back" style={{ background: tint }}>
          <span className="bk-back-author">{author}</span>
          <span className="bk-back-title">{item.title}</span>
        </div>
        <div className="bk-front" style={{ background: tint }}>
          <i className="bk-sheen" />
          {art}
        </div>
      </div>
    );
  }

  if (kind === 'tape') {
    const bd = Math.max(22, Math.round(cardW * 0.14));
    return (
      <div className="cf-card tp" style={{ width: cardW, aspectRatio: ratio, '--bd': `${bd}px` }}>
        <div className="tp-spine"><span>{(item.title || '').toUpperCase()}</span></div>
        <div className="tp-top"><i /><i /><i /></div>
        <div className="tp-side" />
        <div className="tp-back-inner" />
        <div className="tp-front">
          <div className="tp-sticker">{art}</div>
          <div className="tp-label"><b>{item.title}</b><span>{[item.creator, item.metadata?.year].filter(Boolean).join(' · ')}</span></div>
        </div>
      </div>
    );
  }

  if (kind === 'sleeve') {
    return (
      <>
        <div className="vy-disc" style={item.image_url && !bad ? { backgroundImage: `url(${item.image_url})` } : {}} />
        <div className="cf-card vy" style={{ width: cardW, aspectRatio: ratio }}>
          {art}
          <div className="vy-sheen" />
        </div>
      </>
    );
  }

  return (
    <div className="cf-card" style={{ width: cardW, aspectRatio: ratio }}>{art}</div>
  );
}

// Deterministic pastel tint for coverless items, so a fan of blanks still
// reads as separate records.
export function blankTint(title = '') {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) % 360;
  return `linear-gradient(160deg, hsl(${h}, 26%, 88%), hsl(${(h + 24) % 360}, 22%, 74%))`;
}
