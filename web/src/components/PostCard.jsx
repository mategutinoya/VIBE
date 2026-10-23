import { memo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Ban, Flag, Globe, Lock, MessageCircle, MoreHorizontal, SmilePlus, Trash2, User, Users } from 'lucide-react';
import { api } from '../lib/api.js';
import { timeAgo } from '../lib/time.js';
import { Avatar, ConfirmSheet, DemoTag, Sheet, hueFor, useToast } from '../ui/index.jsx';
import AudioPlayer from './AudioPlayer.jsx';
import ReportSheet from './ReportSheet.jsx';

export const REACTIONS = ['💜', '🔥', '😂', '🥹', '😮', '🫶'];

export const thoughtStyle = (seed) => {
  const h = hueFor(seed);
  return { '--thought-bg': `linear-gradient(140deg, hsl(${h} 80% 62% / 0.20), hsl(${h + 45} 85% 58% / 0.08) 70%)` };
};

export function AudienceLabel({ post }) {
  if (post.audience === 'public') return <span className="audience-pill"><Globe size={11} /> Público</span>;
  if (post.audience === 'circle') return <span className="audience-pill"><Lock size={11} /> {post.circle?.name || 'Círculo'}</span>;
  return <span className="audience-pill"><Users size={11} /> Amigos</span>;
}

export function PostContent({ post }) {
  if (post.kind === 'photo') {
    const ratio = post.media?.width && post.media?.height ? Math.max(0.8, Math.min(1.25, post.media.width / post.media.height)) : 0.8;
    return (
      <>
        <div className="post-photo" style={{ aspectRatio: ratio }}>
          <img src={post.media?.url} alt={post.body ? `Foto: ${post.body}` : `Foto de ${post.author.displayName}`} loading="lazy" style={{ height: '100%' }} />
        </div>
        {post.body && <p className="post-caption">{post.body}</p>}
      </>
    );
  }
  if (post.kind === 'audio') {
    return (
      <>
        <AudioPlayer src={post.media?.url} durationMs={post.media?.durationMs} waveform={post.media?.waveform} />
        {post.body && <p className="post-caption">{post.body}</p>}
      </>
    );
  }
  return (
    <div className={`post-thought ${post.body.length > 140 ? 'long' : ''}`} style={thoughtStyle(post.author.id + post.id)}>
      <p>{post.body}</p>
    </div>
  );
}

function PostCard({ post, onChange, onRemove, preview = false, linkComments = true }) {
  const [tray, setTray] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [report, setReport] = useState(false);
  const [who, setWho] = useState(null);
  const [bump, setBump] = useState(0);
  const toast = useToast();
  const navigate = useNavigate();

  const total = post.reactions.reduce((n, r) => n + r.count, 0);

  const react = async (emoji) => {
    setTray(false);
    setBump((b) => b + 1);
    const removing = post.myReaction === emoji;
    // Actualización optimista
    const reactions = post.reactions
      .map((r) => {
        let count = r.count;
        if (r.emoji === post.myReaction) count -= 1;
        if (r.emoji === emoji && !removing) count += 1;
        return { ...r, count, mine: !removing && r.emoji === emoji };
      })
      .filter((r) => r.count > 0);
    if (!removing && !reactions.some((r) => r.emoji === emoji)) reactions.push({ emoji, count: 1, mine: true });
    const prev = post;
    onChange?.({ ...post, reactions, myReaction: removing ? null : emoji });
    try {
      const res = removing ? await api.del(`/posts/${post.id}/reaction`) : await api.put(`/posts/${post.id}/reaction`, { emoji });
      onChange?.(res.post);
    } catch (err) {
      onChange?.(prev);
      toast(err.message, 'error');
    }
  };

  const showReactors = async () => {
    setWho({ loading: true, list: [] });
    try {
      const res = await api.get(`/posts/${post.id}/reactions`);
      setWho({ loading: false, list: res.reactions });
    } catch (err) {
      setWho(null);
      toast(err.message, 'error');
    }
  };

  const remove = async () => {
    await api.del(`/posts/${post.id}`);
    toast('Publicación eliminada');
    onRemove?.(post.id);
  };

  const block = async () => {
    await api.post('/blocks', { userId: post.author.id });
    toast(`Has bloqueado a ${post.author.displayName}`);
    onRemove?.(post.id, { blockedAuthor: post.author.id });
  };

  const profile = `/u/${post.author.username}`;

  return (
    <article className="post" aria-label={`Publicación de ${post.author.displayName}`}>
      <header className="post-head">
        <Link to={profile} aria-label={`Perfil de ${post.author.displayName}`}>
          <Avatar user={post.author} size={40} />
        </Link>
        <div className="grow">
          <Link to={profile} className="post-author">
            {post.author.displayName} {post.author.isDemo && <DemoTag />}
          </Link>
          <div className="post-meta">
            <span>{preview ? 'ahora' : timeAgo(post.createdAt)}</span>·<AudienceLabel post={post} />
          </div>
        </div>
        {!preview && (
          <button className="icon-btn" aria-label="Más opciones" onClick={() => setMenu(true)}>
            <MoreHorizontal size={20} />
          </button>
        )}
      </header>

      <PostContent post={post} />

      {!preview && (
        <>
          <div className="post-actions">
            <button
              className={`action ${post.myReaction ? 'on' : ''}`}
              onClick={() => setTray((t) => !t)}
              aria-expanded={tray}
              aria-label={post.myReaction ? `Tu reacción: ${post.myReaction}. Cambiar` : 'Reaccionar'}
            >
              {post.myReaction ? (
                <span key={bump} className="pop" style={{ fontSize: 17 }}>{post.myReaction}</span>
              ) : (
                <SmilePlus size={19} />
              )}
            </button>
            {linkComments ? (
              <button className="action" onClick={() => navigate(`/p/${post.id}`)} aria-label="Responder">
                <MessageCircle size={19} />
                {post.commentCount > 0 && post.commentCount}
              </button>
            ) : (
              <span className="action" aria-hidden="true">
                <MessageCircle size={19} />
                {post.commentCount > 0 && post.commentCount}
              </span>
            )}
            <span className="grow" />
            {total > 0 && (
              <button className="action reaction-summary" onClick={showReactors} aria-label={`${total} reacciones. Ver quién reaccionó`}>
                <span className="emojis">{post.reactions.slice(0, 3).map((r) => r.emoji).join('')}</span>
                {total}
              </button>
            )}
          </div>
          {tray && (
            <div className="reaction-tray" role="group" aria-label="Elige una reacción">
              {REACTIONS.map((e) => (
                <button key={e} aria-pressed={post.myReaction === e} onClick={() => react(e)} aria-label={`Reaccionar con ${e}`}>
                  {e}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <Sheet open={menu} onClose={() => setMenu(false)} label="Opciones">
        <Link className="menu-item" to={profile} onClick={() => setMenu(false)}>
          <User size={20} /> Ver perfil
        </Link>
        {post.isMine ? (
          <button className="menu-item danger" onClick={() => { setMenu(false); setConfirm('delete'); }}>
            <Trash2 size={20} /> Eliminar publicación
          </button>
        ) : (
          <>
            <button className="menu-item" onClick={() => { setMenu(false); setReport(true); }}>
              <Flag size={20} /> Reportar
            </button>
            <button className="menu-item danger" onClick={() => { setMenu(false); setConfirm('block'); }}>
              <Ban size={20} /> Bloquear a {post.author.displayName}
            </button>
          </>
        )}
      </Sheet>

      <ConfirmSheet
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        title="¿Eliminar esta publicación?"
        body="Se borrará junto con sus reacciones y respuestas. No se puede deshacer."
        confirmLabel="Eliminar"
        danger
        onConfirm={remove}
      />
      <ConfirmSheet
        open={confirm === 'block'}
        onClose={() => setConfirm(null)}
        title={`¿Bloquear a ${post.author.displayName}?`}
        body="Dejaréis de ser amigos, no podrá ver tu perfil ni escribirte y no verás su contenido. No se le notificará."
        confirmLabel="Bloquear"
        danger
        onConfirm={block}
      />
      <ReportSheet
        open={report}
        onClose={() => setReport(false)}
        postId={post.id}
        userId={post.author.id}
        name={post.author.displayName}
        onBlocked={() => onRemove?.(post.id, { blockedAuthor: post.author.id })}
      />
      <Sheet open={!!who} onClose={() => setWho(null)} label="Reacciones">
        <h3>Reacciones</h3>
        {who?.loading && <span className="spinner" />}
        {who?.list.map((r) => (
          <Link key={r.user.id} to={`/u/${r.user.username}`} className="user-row" onClick={() => setWho(null)}>
            <Avatar user={r.user} size={40} />
            <span className="names">
              <span className="name">{r.user.displayName}</span>
              <span className="handle"> @{r.user.username}</span>
            </span>
            <span style={{ fontSize: 22 }}>{r.emoji}</span>
          </Link>
        ))}
      </Sheet>
    </article>
  );
}

export default memo(PostCard);
