import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUp, Lock } from 'lucide-react';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.jsx';
import { useAsync } from '../lib/useAsync.js';
import { timeAgo } from '../lib/time.js';
import { Avatar, DemoTag, Empty, ErrorState, RowSkeleton, Spinner, TopBar, useToast } from '../ui/index.jsx';

export function Conversations() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(() => api.get('/messages'), []);
  return (
    <main className="page page--bare">
      <TopBar>
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Volver"><ArrowLeft size={22} /></button>
        <span className="topbar-title">Mensajes</span>
      </TopBar>
      <p className="small faint" style={{ marginBottom: 8 }}>Conversaciones privadas, solo entre amigos.</p>
      {loading && <RowSkeleton />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && !data.conversations.length && (
        <Empty title="Sin mensajes todavía" action={<Link to="/amigos" className="btn btn-secondary btn-sm">Ver amigos</Link>}>
          Escribe a un amigo desde su perfil o comenta un dúo revelado.
        </Empty>
      )}
      {data?.conversations.map((c) => (
        <Link key={c.user.id} to={`/mensajes/${c.user.id}`} className="user-row">
          <Avatar user={c.user} size={48} />
          <span className="names">
            <span className="name row" style={{ gap: 6 }}>
              <span className="ellipsis">{c.user.displayName}</span> {c.user.isDemo && <DemoTag />}
              <span className="faint xs" style={{ marginLeft: 'auto', fontWeight: 500 }}>{timeAgo(c.lastMessage.createdAt)}</span>
            </span>
            <span className="handle ellipsis" style={{ display: 'block', color: c.unread ? 'var(--text)' : undefined, fontWeight: c.unread ? 700 : 400 }}>
              {c.lastMessage.mine ? 'Tú: ' : ''}{c.lastMessage.body}
            </span>
          </span>
          {c.unread > 0 && <span className="count-badge" style={{ position: 'static' }}>{c.unread}</span>}
        </Link>
      ))}
    </main>
  );
}

const dayLabel = (ts) => {
  const d = new Date(ts);
  const today = new Date();
  const y = new Date(Date.now() - 86400_000);
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  if (d.toDateString() === y.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'short' });
};

export function Chat() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { refreshBadges } = useSession();
  const { data, loading, error, reload, setData } = useAsync(() => api.get(`/messages/${userId}`), [userId]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottom = useRef(null);
  const input = useRef(null);
  const lastId = data?.messages.at(-1)?.id || 0;

  useEffect(() => {
    if (data) refreshBadges();
  }, [data?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mensajes nuevos: sondeo cada 4 s mientras la conversación está abierta
  useEffect(() => {
    if (!data) return undefined;
    const t = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const r = await api.get(`/messages/${userId}?after=${lastId}`);
        if (r.messages.length) setData((d) => ({ ...d, messages: [...d.messages, ...r.messages.filter((m) => !d.messages.some((x) => x.id === m.id))] }));
      } catch {
        /* siguiente intento */
      }
    }, 4000);
    return () => clearInterval(t);
  }, [data, userId, lastId, setData]);

  useLayoutEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [lastId]);

  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(120, el.scrollHeight)}px`;
  }, [text]);

  if (loading) return <Spinner />;
  if (error) return <main className="page"><ErrorState error={error} onRetry={reload} /></main>;

  const send = async (e) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const r = await api.post(`/messages/${userId}`, { body });
      setData((d) => ({ ...d, messages: [...d.messages, r.message] }));
      setText('');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSending(false);
      input.current?.focus();
    }
  };

  let lastDay = null;
  return (
    <main className="chat">
      <TopBar className="" >
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Volver"><ArrowLeft size={22} /></button>
        <Link to={`/u/${data.user.username}`} className="row grow" style={{ gap: 10 }}>
          <Avatar user={data.user} size={34} />
          <span className="topbar-title">{data.user.displayName}</span>
          {data.user.isDemo && <DemoTag />}
        </Link>
      </TopBar>
      <div className="chat-scroll">
        {!data.messages.length && (
          <Empty title={`Escribe a ${data.user.displayName}`}>Los mensajes son privados entre vosotros dos.</Empty>
        )}
        {data.messages.map((m) => {
          const day = dayLabel(m.createdAt);
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.id} style={{ display: 'contents' }}>
              {showDay && <span className="chat-day">{day}</span>}
              <div className={`bubble ${m.mine ? 'mine' : 'theirs'}`} title={new Date(m.createdAt).toLocaleString('es')}>
                {m.body}
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      {data.canReply ? (
        <form className="chat-input" onSubmit={send}>
          <textarea
            ref={input}
            rows={1}
            placeholder="Mensaje"
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) send(e);
            }}
            aria-label="Escribe un mensaje"
          />
          <button className="send-btn" type="submit" disabled={!text.trim() || sending} aria-label="Enviar">
            <ArrowUp size={20} />
          </button>
        </form>
      ) : (
        <div className="chat-input" style={{ justifyContent: 'center' }}>
          <span className="small muted row"><Lock size={14} /> Solo puedes escribir a tus amigos.</span>
        </div>
      )}
    </main>
  );
}
