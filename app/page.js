'use client';
import { useEffect, useMemo, useState, useCallback } from 'react';
import Flow from './flow';

const TYPES = [
  { id: 'album', label: 'Music', cardW: 228, ratio: '1/1', overlap: 76 },
  { id: 'book', label: 'Books', cardW: 184, ratio: '2/3', overlap: 62 },
  { id: 'movie', label: 'Movies', cardW: 184, ratio: '2/3', overlap: 62 },
];
const TYPE_LABEL = { album: 'ALBUM', book: 'BOOK', movie: 'FILM' };

export default function Home() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState(() => {
    if (typeof window === 'undefined') return 'album';
    const t = new URLSearchParams(window.location.search).get('type');
    return TYPES.some((x) => x.id === t) ? t : 'album';
  });
  const [tab, setTab] = useState('queued');
  const [toast, setToast] = useState('');
  const [active, setActive] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    fetch('/api/items')
      .then(async (r) => { if (!r.ok) throw Error(); return r.json(); })
      .then(setItems)
      .catch(() => say('Could not load your queue. Refresh to try again.'))
      .finally(() => setLoading(false));
  }, []);

  const say = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2000); }, []);
  const cfg = TYPES.find((t) => t.id === type);
  const list = useMemo(() => items.filter((x) => x.type === type && x.state === tab), [items, type, tab]);
  const counts = useMemo(() => {
    const c = {};
    for (const x of items) if (x.state === 'queued') c[x.type] = (c[x.type] || 0) + 1;
    return c;
  }, [items]);

  const onActive = useCallback((i, item) => setActive(item || null), []);

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
      say(state === 'loved' ? (active.type === 'album' ? 'Saved to Music I love' : 'Kept') : 'Dropped from the queue');
    } catch {
      setItems(old);
      say('Could not save. Try again.');
    }
  }

  return (
    <main className="hub">
      <Backdrop item={active} />
      <header className="hub-top">
        <b className="brand">CABINET<i>•</i></b>
        <div className="hub-top-right">
          <div className="seg">
            <button className={tab === 'queued' ? 'on' : ''} onClick={() => setTab('queued')}>Queue</button>
            <button className={tab === 'loved' ? 'on' : ''} onClick={() => setTab('loved')}>Kept</button>
          </div>
          <button className="add-btn" aria-label="Add" onClick={() => setAddOpen(true)}>+</button>
        </div>
      </header>
      <nav className="hub-typenav">
        {TYPES.map((t) => (
          <button key={t.id} className={type === t.id ? 'on' : ''} onClick={() => setType(t.id)}>
            {t.label}{counts[t.id] ? <b>{counts[t.id]}</b> : null}
          </button>
        ))}
        {type === 'album' && <a className="deck-link" href="/deck" title="Turntable">◉</a>}
      </nav>

      <section className="hub-stage">
        {loading ? (
          <div className="hub-empty"><p>Loading your cabinet…</p></div>
        ) : list.length ? (
          <Flow
            items={list}
            cardW={cfg.cardW}
            ratio={cfg.ratio}
            overlap={cfg.overlap}
            onActive={onActive}
            onPick={() => {}}
          />
        ) : (
          <div className="hub-empty">
            <i>✳</i>
            <h2>{tab === 'queued' ? 'Nothing waiting here.' : 'Nothing kept yet.'}</h2>
            <p>{tab === 'queued' ? `Add the first ${cfg.label.toLowerCase().replace(/s$/, '')} — it takes ten seconds.` : 'Things you keep land here.'}</p>
            {tab === 'queued' && <button className="ghost" onClick={() => setAddOpen(true)}>Add one</button>}
          </div>
        )}
      </section>

      <section className="hub-caption">
        {active && (
          <>
            <small>{String(list.indexOf(active) + 1).padStart(2, '0')} / {String(list.length).padStart(2, '0')} · {TYPE_LABEL[active.type] || 'ITEM'}</small>
            <h1>{active.title}</h1>
            <b>{[active.creator, active.metadata?.year].filter(Boolean).join(' · ')}</b>
            {active.metadata?.note && <p>{active.metadata.note}</p>}
          </>
        )}
      </section>

      <section className="hub-actions">
        {active && tab === 'queued' && (
          <>
            <button className="ghost" onClick={() => go('dropped')}>Not for me</button>
            <button className="solid" onClick={() => go('loved')}>Keep it ♥</button>
          </>
        )}
        {active && tab === 'loved' && active.external_url && (
          <a className="solid link" href={active.external_url} target="_blank" rel="noreferrer">
            Open {active.type === 'album' ? 'in Spotify' : 'the reference'} ↗
          </a>
        )}
      </section>


      {addOpen && <AddSheet defaultType={type} onClose={() => setAddOpen(false)} onAdded={(x) => { setItems((v) => [x, ...v]); setAddOpen(false); setType(x.type); setTab('queued'); say('Added to the queue'); }} />}
      {toast && <aside className="toast">{toast}</aside>}
    </main>
  );
}

function Backdrop({ item }) {
  return (
    <div className="backdrop" aria-hidden>
      {item?.image_url && <img key={item.id} src={item.image_url} alt="" />}
    </div>
  );
}

function AddSheet({ defaultType, onClose, onAdded }) {
  const [type, setType] = useState(defaultType);
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState('');

  async function search(e) {
    e?.preventDefault();
    if (!q.trim()) return;
    setBusy(true); setResults(null);
    try {
      const r = await fetch(`/api/lookup?type=${type}&q=${encodeURIComponent(q)}`);
      const j = await r.json();
      setResults(j.results || []);
    } catch { setResults([]); }
    setBusy(false);
  }

  async function add(x) {
    setAdding(x.title);
    const r = await fetch('/api/items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...x, metadata: { year: x.year || undefined } }),
    });
    if (r.ok) onAdded(await r.json());
    else setAdding('');
  }

  return (
    <div className="sheet-veil" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet">
        <div className="sheet-head">
          <div className="seg">
            {TYPES.map((t) => (
              <button key={t.id} className={type === t.id ? 'on' : ''} onClick={() => { setType(t.id); setResults(null); }}>{t.label}</button>
            ))}
          </div>
          <button className="add-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={search} className="sheet-search">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={type === 'book' ? 'A book title…' : type === 'movie' ? 'A film…' : 'An album…'} />
          <button className="solid" disabled={busy}>{busy ? '…' : 'Find'}</button>
        </form>
        <div className="sheet-results">
          {results && !results.length && <p className="sheet-none">Nothing found. Try the full title.</p>}
          {(results || []).map((x, i) => (
            <button key={i} className="sheet-row" disabled={!!adding} onClick={() => add(x)}>
              <span className="sr-thumb">{x.image_url ? <img src={x.image_url} alt="" /> : null}</span>
              <span className="sr-info">
                <span className="sr-title">{x.title}</span>
                <span className="sr-sub">{[x.creator, x.year].filter(Boolean).join(' · ')}</span>
              </span>
              <span className="sr-plus">{adding === x.title ? '…' : '+'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
