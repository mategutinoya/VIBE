import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUp, Trash2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { timeAgo } from '../lib/time.js';
import { Avatar, DemoTag, ErrorState, Spinner, TopBar, useToast } from '../ui/index.jsx';
import PostCard from '../components/PostCard.jsx';

const MAX = 300;

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const post = useAsync(() => api.get(`/posts/${id}`), [id]);
  const comments = useAsync(() => api.get(`/posts/${id}/comments`), [id]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/'));

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await api.post(`/posts/${id}/comments`, { body: text });
      comments.setData((d) => ({ comments: [...d.comments, r.comment] }));
      post.setData((d) => ({ post: { ...d.post, commentCount: d.post.commentCount + 1 } }));
      setText('');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c) => {
    try {
      await api.del(`/comments/${c.id}`);
      comments.setData((d) => ({ comments: d.comments.filter((x) => x.id !== c.id) }));
      post.setData((d) => ({ post: { ...d.post, commentCount: Math.max(0, d.post.commentCount - 1) } }));
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <main className="chat">
      <div style={{ padding: '0 16px', flex: 1 }}>
        <TopBar>
          <button className="icon-btn" onClick={back} aria-label="Volver"><ArrowLeft size={22} /></button>
          <span className="topbar-title">Vibe</span>
        </TopBar>
        {post.loading && <Spinner />}
        {post.error && <ErrorState error={post.error} onRetry={post.reload} />}
        {post.data && (
          <>
            <PostCard post={post.data.post} linkComments={false} onChange={(p) => post.setData({ post: p })} onRemove={back} />
            <h2 className="section-title">Respuestas</h2>
            {comments.loading && <Spinner />}
            {comments.data && !comments.data.comments.length && <p className="small muted">Sé la primera persona en responder.</p>}
            {comments.data?.comments.map((c) => (
              <div key={c.id} className="comment">
                <Link to={`/u/${c.author.username}`}><Avatar user={c.author} size={34} /></Link>
                <div className="comment-body">
                  <p className="small">
                    <Link to={`/u/${c.author.username}`} style={{ fontWeight: 700 }}>{c.author.displayName}</Link> {c.author.isDemo && <DemoTag />}{' '}
                    <span className="faint">{timeAgo(c.createdAt)}</span>
                  </p>
                  <p>{c.body}</p>
                </div>
                {c.canDelete && (
                  <button className="icon-btn" aria-label="Eliminar respuesta" onClick={() => remove(c)}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </div>
      {post.data && (
        <form className="chat-input" onSubmit={send}>
          <textarea rows={1} placeholder="Responde…" value={text} maxLength={MAX} onChange={(e) => setText(e.target.value)} aria-label="Escribe una respuesta" />
          <button className="send-btn" type="submit" disabled={!text.trim() || busy} aria-label="Enviar respuesta">
            <ArrowUp size={20} />
          </button>
        </form>
      )}
    </main>
  );
}
