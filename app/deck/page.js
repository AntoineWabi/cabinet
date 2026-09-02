'use client';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Flow from '../flow';

// Music with the turntable kept: pick a record from the shelf, it lands on
// the platter, the arm swings over, and a 30-second preview (Apple's keyless
// iTunes API) plays while the label spins at 33⅓.
export default function Deck() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  const [preview, setPreview] = useState(null);   // {url, name} | null | 'none'
  const [playing, setPlaying] = useState(false);
  const [toast, setToast] = useState('');
  const audio = useRef(null);
  const gestured = useRef(false);

  useEffect(() => {
    fetch('/api/items').then((r) => r.json()).then(setItems).catch(() => {}).finally(() => setLoading(false));
    const g = () => { gestured.current = true; };
    window.addEventListener('pointerdown', g, { once: true });
    return () => window.removeEventListener('pointerdown', g);
  }, []);

  const list = useMemo(() => items.filter((x) => x.type === 'album' && x.state === 'queued'), [items]);
  const onActive = useCallback((i, item) => setActive(item || null), []);

  // Resolve a preview whenever the centered record changes.
  useEffect(() => {
    setPreview(null);
    setPlaying(false);
    audio.current?.pause();
    if (!active) return;
    let dead = false;
    findPreview(active).then((p) => { if (!dead) setPreview(p || 'none'); });
    return () => { dead = true; };
  }, [active]);

  // Autoplay once a preview exists and the page has seen a gesture.
  useEffect(() => {
    if (preview && preview !== 'none' && gestured.current) play();
  }, [preview]);

  function play() {
    const a = audio.current;
    if (!a || !preview || preview === 'none') return;
    if (a.src !== preview.url) a.src = preview.url;
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }
  function toggle() {
    const a = audio.current;
    if (!a || !preview || preview === 'none') return;
    if (playing) { a.pause(); setPlaying(false); } else play();
  }

  const say = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2000); }, []);
  async function go(state) {
    if (!active) return;
    const old = items;
    setItems((v) => v.map((y) => (y.id === active.id ? { ...y, state } : y)));
    try {
      const r = await fetch(`/api/items/${active.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state }),
      });
      if (!r.ok) throw Error();
      say(state === 'loved' ? 'Saved to Music I love' : 'Dropped from the queue');
    } catch { setItems(old); say('Could not save. Try again.'); }
  }

  return (
    <main className="deck-page">
      <header className="hub-top">
        <a className="brand" href="/" style={{ textDecoration: 'none' }}><i>‹</i> CABINET</a>
        <span className="deck-flag">THE DECK</span>
      </header>

      <section className="deck-table">
        <div className="deck-box">
          <div className="platter">
            <button className={`disc${playing ? ' spin' : ''}`} onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
              {active?.image_url && <img className="disc-label" src={active.image_url} alt="" draggable={false} onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
            </button>
          </div>
          <img className={`tonearm${playing ? ' on' : ''}`} src="/deck/tonearm.svg" alt="" draggable={false} />
        </div>
      </section>

      <section className="hub-caption deck-caption">
        {active && (
          <>
            <small>{preview === 'none' ? 'NO PREVIEW FOUND' : playing ? 'NOW PLAYING · 30-SECOND PREVIEW' : preview ? 'PREVIEW READY — TAP THE RECORD' : 'FINDING A PREVIEW…'}</small>
            <h1>{active.title}</h1>
            <b>{[active.creator, active.metadata?.year].filter(Boolean).join(' · ')}</b>
          </>
        )}
        {!loading && !list.length && <h1>The shelf is empty.</h1>}
      </section>

      <section className="hub-actions">
        {active && (
          <>
            <button className="ghost" onClick={() => go('dropped')}>Not for me</button>
            <button className="solid" onClick={() => go('loved')}>Keep it ♥</button>
          </>
        )}
      </section>

      <section className="deck-shelf">
        {list.length > 0 && (
          <Flow items={list} cardW={132} ratio="1/1" overlap={46} onActive={onActive} onPick={play} />
        )}
      </section>

      <audio ref={audio} onEnded={() => setPlaying(false)} />
      {toast && <aside className="toast">{toast}</aside>}
    </main>
  );
}

async function findPreview(item) {
  try {
    const term = `${item.title} ${item.creator || ''}`.trim();
    const s = await fetch(`https://itunes.apple.com/search?${new URLSearchParams({ term, entity: 'album', limit: '3' })}`).then((r) => r.json());
    const norm = (s) => (s || '').toLowerCase();
    const hit = (s.results || []).find((a) => norm(a.collectionName).includes(norm(item.title).slice(0, 12))) || s.results?.[0];
    if (!hit) return null;
    const t = await fetch(`https://itunes.apple.com/lookup?id=${hit.collectionId}&entity=song&limit=1`).then((r) => r.json());
    const tr = (t.results || []).find((x) => x.wrapperType === 'track' && x.previewUrl);
    return tr ? { url: tr.previewUrl, name: tr.trackName } : null;
  } catch { return null; }
}
