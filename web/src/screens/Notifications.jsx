import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, MessageCircle, Sparkles, UserPlus, UserCheck } from 'lucide-react';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.jsx';
import { useAsync } from '../lib/useAsync.js';
import { timeAgo } from '../lib/time.js';
import { Avatar, DemoTag, DuoMark, Empty, ErrorState, RowSkeleton, TopBar } from '../ui/index.jsx';

function describe(n) {
  const name = <strong>{n.actor?.displayName || 'Alguien'}</strong>;
  const excerpt = n.postExcerpt ? <span className="faint"> «{n.postExcerpt.length > 40 ? `${n.postExcerpt.slice(0, 40)}…` : n.postExcerpt}»</span> : null;
  switch (n.type) {
    case 'reaction':
      return { text: <>{name} reaccionó a tu vibe{excerpt}</>, icon: <Heart size={11} fill="currentColor" />, to: `/p/${n.postId}` };
    case 'comment':
      return { text: <>{name} respondió a tu vibe{excerpt}</>, icon: <MessageCircle size={11} />, to: `/p/${n.postId}` };
    case 'friend_request':
      return { text: <>{name} quiere conectar contigo</>, icon: <UserPlus size={11} />, to: '/amigos?tab=solicitudes' };
    case 'friend_accept':
      return { text: <>{name} aceptó tu solicitud</>, icon: <UserCheck size={11} />, to: `/u/${n.actor?.username}` };
    case 'invite_joined':
      return { text: <>{name} se unió con tu enlace. Ya podéis ser dúo</>, icon: <UserCheck size={11} />, to: `/u/${n.actor?.username}` };
    case 'duo_new':
      return { text: <>Hoy {name} y tú sois dúo. Responde a la pregunta</>, icon: <Sparkles size={11} />, accent: true, to: `/duo/${n.duoId}` };
    case 'duo_answered':
      return { text: <>{name} ya respondió vuestro dúo. Te toca</>, icon: <Sparkles size={11} />, accent: true, to: `/duo/${n.duoId}` };
    case 'duo_revealed':
      return { text: <>¡Vuestro dúo con {name} se ha revelado!</>, icon: <Sparkles size={11} />, accent: true, to: `/duo/${n.duoId}` };
    case 'duo_reaction':
      return { text: <>{name} reaccionó a tu respuesta del dúo</>, icon: <Heart size={11} fill="currentColor" />, accent: true, to: `/duo/${n.duoId}` };
    default:
      return { text: <>Nueva actividad de {name}</>, icon: null, to: '/' };
  }
}

export default function Notifications() {
  const navigate = useNavigate();
  const { refreshBadges } = useSession();
  const { data, loading, error, reload } = useAsync(() => api.get('/notifications'), []);

  // Al abrir la pantalla, marcamos todo como leído (el resaltado se mantiene en esta visita)
  useEffect(() => {
    if (data?.notifications.some((n) => !n.read)) api.post('/notifications/read').then(refreshBadges).catch(() => {});
  }, [data, refreshBadges]);

  const list = data?.notifications || [];
  const today = list.filter((n) => Date.now() - n.createdAt < 86400_000);
  const earlier = list.filter((n) => Date.now() - n.createdAt >= 86400_000);

  const renderList = (items) =>
    items.map((n) => {
      const d = describe(n);
      return (
        <button key={n.id} className={`notif ${n.read ? '' : 'unread'}`} style={{ width: '100%', textAlign: 'left' }} onClick={() => navigate(d.to)}>
          <span style={{ position: 'relative' }}>
            <Avatar user={n.actor} size={44} />
            {d.icon && <span className={`notif-icon ${d.accent ? 'accent' : ''}`}>{d.icon}</span>}
          </span>
          <span className="grow notif-text">
            {d.text} {n.actor?.isDemo && <DemoTag />}
            <span className="faint" style={{ display: 'block' }}>{timeAgo(n.createdAt)}</span>
          </span>
        </button>
      );
    });

  return (
    <main className="page">
      <TopBar>
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Volver"><ArrowLeft size={22} /></button>
        <span className="topbar-title">Notificaciones</span>
      </TopBar>
      {loading && <RowSkeleton count={5} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && !list.length && (
        <Empty art={<DuoMark size={36} />} title="Sin novedades">
          Aquí verás reacciones, respuestas, solicitudes y tus dúos.
        </Empty>
      )}
      {today.length > 0 && <h2 className="section-title" style={{ marginTop: 8 }}>Hoy</h2>}
      {renderList(today)}
      {earlier.length > 0 && <h2 className="section-title">Antes</h2>}
      {renderList(earlier)}
    </main>
  );
}
