import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, FlaskConical, MessageCircle, Search } from 'lucide-react';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.jsx';
import { useAsync } from '../lib/useAsync.js';
import { usePaged } from '../lib/usePaged.js';
import { DuoMark, Empty, Logo, TopBar, useToast } from '../ui/index.jsx';
import DuoCard from '../components/DuoCard.jsx';
import Feed from '../components/Feed.jsx';
import InviteCard from '../components/InviteCard.jsx';

function NoDuo({ onConnected }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <section className="duo-card" style={{ cursor: 'default' }}>
      <span className="duo-eyebrow">
        <span className="live" /> Tu dúo de hoy
      </span>
      <p className="duo-prompt">Tu primer dúo empieza con un amigo.</p>
      <p className="duo-status-text" style={{ marginBottom: 16 }}>
        Cada día os haremos la misma pregunta. Nadie ve la respuesta del otro hasta que los dos contestáis.
      </p>
      <InviteCard compact />
      <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
        <Link to="/amigos" className="btn btn-secondary btn-sm">
          <Search size={15} /> Buscar amigos
        </Link>
        <button
          className="btn btn-ghost btn-sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api.post('/demo');
              toast('Cuentas demo añadidas');
              onConnected();
            } catch (err) {
              toast(err.message, 'error');
            } finally {
              setBusy(false);
            }
          }}
        >
          <FlaskConical size={15} /> Probar con cuentas demo
        </button>
      </div>
    </section>
  );
}

function DuoSection({ onFriendsChanged }) {
  const { data, loading, error, reload } = useAsync(() => api.get('/duo'), []);
  if (loading) return <div className="skeleton" style={{ height: 210, borderRadius: 32, margin: '8px 0 16px' }} />;
  if (error) {
    return (
      <div className="notice" style={{ margin: '8px 0 16px' }}>
        <span className="grow">No pudimos cargar tu dúo.</span>
        <button className="btn btn-ghost btn-sm" onClick={() => reload()}>Reintentar</button>
      </div>
    );
  }
  if (!data.duos.length) {
    return (
      <NoDuo
        onConnected={() => {
          reload();
          onFriendsChanged();
        }}
      />
    );
  }
  return data.duos.map((d) => <DuoCard key={d.id} duo={d} />);
}

export default function Home() {
  const { badges, refreshBadges } = useSession();
  const feed = usePaged(async (cursor) => {
    const r = await api.get(`/feed${cursor ? `?before=${cursor}` : ''}`);
    return { items: r.posts, nextCursor: r.nextCursor };
  }, []);

  useEffect(() => {
    refreshBadges();
  }, [refreshBadges]);

  return (
    <main className="page">
      <TopBar>
        <Logo size={24} />
        <span className="grow" />
        <Link to="/mensajes" className="icon-btn" aria-label={`Mensajes${badges.messages ? `, ${badges.messages} sin leer` : ''}`}>
          <MessageCircle size={22} />
          {badges.messages > 0 && <span className="count-badge">{badges.messages > 9 ? '9+' : badges.messages}</span>}
        </Link>
        <Link to="/notificaciones" className="icon-btn" aria-label={`Notificaciones${badges.notifications ? `, ${badges.notifications} sin leer` : ''}`}>
          <Bell size={22} />
          {badges.notifications > 0 && <span className="count-badge">{badges.notifications > 9 ? '9+' : badges.notifications}</span>}
        </Link>
      </TopBar>

      <DuoSection onFriendsChanged={() => { feed.refresh(); refreshBadges(); }} />

      <h2 className="section-title">
        Tus amigos <small>en orden, sin algoritmo</small>
      </h2>
      <Feed
        paged={feed}
        empty={
          <Empty art={<DuoMark size={40} />} title="Todo tranquilo por aquí" action={<Link to="/crear" className="btn btn-primary btn-sm">Comparte tu primer vibe</Link>}>
            Cuando tus amigos compartan algo, aparecerá aquí en orden cronológico.
          </Empty>
        }
      />
      {feed.done && feed.items.length > 0 && <p className="center small faint" style={{ padding: '24px 0' }}>Estás al día ✨</p>}
    </main>
  );
}
