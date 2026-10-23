import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Flag, Lock, MessageCircle, MoreHorizontal, Settings as SettingsIcon, Share2, UserMinus, History } from 'lucide-react';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.jsx';
import { useAsync } from '../lib/useAsync.js';
import { usePaged } from '../lib/usePaged.js';
import { inviteUrl, shareOrCopy } from '../lib/share.js';
import { Avatar, Button, ConfirmSheet, DemoTag, DuoMark, Empty, ErrorState, Sheet, Spinner, TopBar, useToast } from '../ui/index.jsx';
import Feed from '../components/Feed.jsx';
import FriendButton from '../components/FriendButton.jsx';
import ReportSheet from '../components/ReportSheet.jsx';

export default function Profile() {
  const { username } = useParams();
  const { user: me } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const profile = useAsync(() => api.get(`/users/${encodeURIComponent(username)}`), [username]);
  const posts = usePaged(async (cursor) => {
    const r = await api.get(`/users/${encodeURIComponent(username)}/posts${cursor ? `?before=${cursor}` : ''}`);
    return { items: r.posts, nextCursor: r.nextCursor };
  }, [username]);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [report, setReport] = useState(false);

  const isMe = me.username.toLowerCase() === username.toLowerCase();

  if (profile.loading) return <main className="page"><Spinner /></main>;
  if (profile.error) {
    return (
      <main className="page">
        <TopBar>
          <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Volver"><ArrowLeft size={22} /></button>
        </TopBar>
        <ErrorState error={profile.error} onRetry={profile.reload} />
      </main>
    );
  }

  const { user, relationship, stats, canMessage, postsHidden } = profile.data;
  const u = isMe ? { ...user, ...me } : user;

  const share = async () => {
    const r = await shareOrCopy({ title: 'VIBE', text: `Conecta conmigo en VIBE`, url: inviteUrl(me.inviteCode) });
    if (r === 'copied') toast('Enlace copiado');
  };

  const block = async () => {
    await api.post('/blocks', { userId: user.id });
    toast(`Has bloqueado a ${user.displayName}`);
    navigate('/', { replace: true });
  };

  const unfriend = async () => {
    await api.del(`/friends/${user.id}`);
    toast(`${user.displayName} ya no está en tus amigos`);
    profile.reload({ silent: true });
    posts.refresh();
  };

  return (
    <main className="page">
      <TopBar>
        {!isMe && (
          <button className="icon-btn" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} aria-label="Volver">
            <ArrowLeft size={22} />
          </button>
        )}
        <span className="topbar-title grow">@{u.username}</span>
        {isMe ? (
          <>
            <Link to="/duos" className="icon-btn" aria-label="Dúos anteriores"><History size={21} /></Link>
            <Link to="/ajustes" className="icon-btn" aria-label="Ajustes"><SettingsIcon size={21} /></Link>
          </>
        ) : (
          <button className="icon-btn" aria-label="Más opciones" onClick={() => setMenu(true)}>
            <MoreHorizontal size={22} />
          </button>
        )}
      </TopBar>

      <section className="profile-head">
        <Avatar user={u} size={96} ring />
        <h1 className="profile-name">{u.displayName}</h1>
        <p className="row small faint" style={{ gap: 6 }}>
          @{u.username} {u.isDemo && <DemoTag />} {u.isPrivate && <span className="row" style={{ gap: 3 }}><Lock size={12} /> Privada</span>}
        </p>
        {u.bio && <p className="profile-bio">{u.bio}</p>}
        <div className="stats">
          {stats.friends !== null && (
            <div className="stat"><b>{stats.friends}</b><span>amigos</span></div>
          )}
          {stats.mutuals !== null && (
            <div className="stat"><b>{stats.mutuals}</b><span>en común</span></div>
          )}
          {stats.duosTogether !== null && (
            <div className="stat"><b>{stats.duosTogether}</b><span>dúos juntos</span></div>
          )}
        </div>
        <div className="row" style={{ gap: 8 }}>
          {isMe ? (
            <>
              <Link to="/ajustes" className="btn btn-secondary btn-sm">Editar perfil</Link>
              <Button variant="secondary" size="sm" onClick={share}><Share2 size={15} /> Invitar</Button>
            </>
          ) : (
            <>
              <FriendButton
                user={user}
                relationship={relationship}
                onChange={() => {
                  profile.reload({ silent: true });
                  posts.refresh();
                }}
              />
              {canMessage && (
                <Link to={`/mensajes/${user.id}`} className="btn btn-secondary btn-sm">
                  <MessageCircle size={15} /> Mensaje
                </Link>
              )}
            </>
          )}
        </div>
      </section>

      {u.isDemo && (
        <p className="notice demo" style={{ marginBottom: 12 }}>
          Esta es una cuenta de demostración creada por VIBE para que puedas probar la app. No es una persona real.
        </p>
      )}

      {postsHidden ? (
        <Empty art={<Lock size={30} />} title="Cuenta privada">
          Cuando seáis amigos podrás ver sus vibes.
        </Empty>
      ) : (
        <Feed
          paged={posts}
          empty={
            <Empty art={<DuoMark size={36} />} title={isMe ? 'Aún no has compartido nada' : 'Nada que ver todavía'} action={isMe && <Link to="/crear" className="btn btn-primary btn-sm">Crear un vibe</Link>}>
              {isMe ? 'Tus vibes aparecerán aquí. Tú decides quién ve cada uno.' : 'Aquí verás los vibes que comparta contigo.'}
            </Empty>
          }
        />
      )}

      <Sheet open={menu} onClose={() => setMenu(false)} label="Opciones">
        {relationship.status === 'friends' && (
          <button className="menu-item" onClick={() => { setMenu(false); setConfirm('unfriend'); }}>
            <UserMinus size={20} /> Eliminar de amigos
          </button>
        )}
        <button className="menu-item" onClick={() => { setMenu(false); setReport(true); }}>
          <Flag size={20} /> Reportar
        </button>
        <button className="menu-item danger" onClick={() => { setMenu(false); setConfirm('block'); }}>
          <Ban size={20} /> Bloquear
        </button>
      </Sheet>
      <ConfirmSheet
        open={confirm === 'block'}
        onClose={() => setConfirm(null)}
        title={`¿Bloquear a ${user.displayName}?`}
        body="No podrá ver tu perfil, encontrarte ni escribirte, y no verás su contenido. No se le notificará. Puedes desbloquear en Ajustes."
        confirmLabel="Bloquear"
        danger
        onConfirm={block}
      />
      <ConfirmSheet
        open={confirm === 'unfriend'}
        onClose={() => setConfirm(null)}
        title={`¿Eliminar a ${user.displayName}?`}
        body="Dejaréis de ver los vibes que son solo para amigos. No se le notificará."
        confirmLabel="Eliminar"
        danger
        onConfirm={unfriend}
      />
      <ReportSheet open={report} onClose={() => setReport(false)} userId={user.id} name={user.displayName} onBlocked={() => navigate('/', { replace: true })} />
    </main>
  );
}
