import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mic, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.jsx';
import { usePaged, useSentinel } from '../lib/usePaged.js';
import { timeAgo } from '../lib/time.js';
import { Avatar, DemoTag, DuoMark, Empty, ErrorState, Spinner, TopBar } from '../ui/index.jsx';
import FriendButton from '../components/FriendButton.jsx';
import { thoughtStyle } from '../components/PostCard.jsx';
import { mutualsText } from '../components/UserRow.jsx';

const FILTERS = [
  { value: 'all', label: 'Todo' },
  { value: 'photo', label: 'Fotos' },
  { value: 'text', label: 'Pensamientos' },
  { value: 'audio', label: 'Audios' },
];

function Tile({ post, index }) {
  const style = { animationDelay: `${Math.min(index, 10) * 40}ms` };
  let body;
  if (post.kind === 'photo') body = <img src={post.media?.url} alt={post.body || `Foto de ${post.author.displayName}`} loading="lazy" />;
  else if (post.kind === 'audio') {
    const bars = post.media?.waveform || [];
    body = (
      <div className="tile-audio">
        <span className="row small" style={{ fontWeight: 700 }}>
          <span className="audio-play" style={{ width: 32, height: 32 }}><Mic size={15} /></span>
          Nota de voz
        </span>
        <div className="wave" aria-hidden="true">
          {bars.map((v, i) => <span key={i} style={{ height: `${Math.max(10, v * 100)}%` }} />)}
        </div>
        {post.body && <span className="small">{post.body}</span>}
      </div>
    );
  } else body = <div className="tile-text" style={thoughtStyle(post.author.id + post.id)}>{post.body}</div>;

  return (
    <Link to={`/p/${post.id}`} className="tile" style={style} aria-label={`Vibe de ${post.author.displayName}`}>
      {body}
      <div className="tile-foot">
        <Avatar user={post.author} size={20} />
        <span className="ellipsis grow">{post.author.displayName}</span>
        {post.author.isDemo && <DemoTag />}
        <span className="faint">{timeAgo(post.createdAt)}</span>
      </div>
    </Link>
  );
}

export default function Discover() {
  const { user } = useSession();
  const [filter, setFilter] = useState('all');
  const paged = usePaged(async (cursor) => {
    const r = await api.get(`/discover${cursor ? `?before=${cursor}` : ''}`);
    return { items: r.posts, nextCursor: r.nextCursor, extra: r.people };
  }, []);
  const sentinel = useSentinel(paged.more);
  const people = paged.extra || [];
  const posts = useMemo(() => (filter === 'all' ? paged.items : paged.items.filter((p) => p.kind === filter)), [paged.items, filter]);

  return (
    <main className="page">
      <TopBar>
        <h1 className="topbar-title topbar-big">Descubrir</h1>
      </TopBar>

      <div className="notice" style={{ marginBottom: 8 }}>
        <ShieldCheck size={18} />
        <span>
          Solo ves lo que sus autores marcaron como <strong style={{ color: 'var(--text)' }}>Público</strong>.{' '}
          {user.isPrivate ? 'Tu cuenta es privada: lo tuyo no aparece aquí.' : 'Lo tuyo solo aparece si eliges “Público” al compartir.'}{' '}
          <Link to="/ajustes" style={{ color: 'var(--text)', fontWeight: 700 }}>Ajustes</Link>
        </span>
      </div>

      {people.length > 0 && (
        <>
          <h2 className="section-title">Personas</h2>
          <div className="people-scroller">
            {people.map((p) => (
              <div key={p.id} className="person-card">
                <Link to={`/u/${p.username}`} className="stack" style={{ alignItems: 'center', gap: 6, width: '100%' }}>
                  <Avatar user={p} size={56} />
                  <span className="name ellipsis">{p.displayName}</span>
                  {p.isDemo ? <DemoTag /> : null}
                  <span className="meta">{mutualsText(p.mutuals) || p.bio || `@${p.username}`}</span>
                </Link>
                <FriendButton user={p} relationship={{ status: 'none' }} />
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="section-title">Vibes públicos</h2>
      <div className="chips" style={{ marginBottom: 14 }}>
        {FILTERS.map((f) => (
          <button key={f.value} className="chip" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
            {f.label}
          </button>
        ))}
      </div>

      {paged.loading && !paged.items.length && (
        <div className="mosaic">
          {[220, 140, 180, 240].map((h, i) => <div key={i} className="skeleton tile" style={{ height: h }} />)}
        </div>
      )}
      {paged.error && !paged.items.length && <ErrorState error={paged.error} onRetry={paged.refresh} />}
      {!paged.loading && !paged.error && !posts.length && (
        <Empty art={<DuoMark size={36} />} title="Nada por aquí todavía">
          {filter === 'all' ? 'Cuando alguien comparta un vibe público, aparecerá aquí.' : 'Prueba con otro filtro.'}
        </Empty>
      )}
      <div className="mosaic">
        {posts.map((p, i) => <Tile key={p.id} post={p} index={i} />)}
      </div>
      {!paged.done && <div ref={sentinel}>{paged.loading && paged.items.length > 0 && <Spinner />}</div>}
    </main>
  );
}
