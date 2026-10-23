import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, History, Lock, MessageCircle, Send, Sparkles } from 'lucide-react';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.jsx';
import { useAsync } from '../lib/useAsync.js';
import { timeAgo, timeLeft } from '../lib/time.js';
import { usePaged, useSentinel } from '../lib/usePaged.js';
import { Avatar, Button, DemoTag, DuoMark, Empty, ErrorState, Spinner, TopBar, useToast } from '../ui/index.jsx';
import Composer, { draftReady, emptyDraft, uploadDraft } from '../components/Composer.jsx';
import { PostContent, REACTIONS } from '../components/PostCard.jsx';
import { DuoPair } from '../components/DuoCard.jsx';

function Answer({ answer, author, seed }) {
  return <PostContent post={{ id: seed, kind: answer.kind, body: answer.body, media: answer.media, author }} />;
}

function HalfHead({ user, label, extra }) {
  return (
    <div className="duo-half-head">
      <Avatar user={user} size={26} />
      <span className="grow">
        {label} {user.isDemo && <DemoTag />}
      </span>
      {extra}
    </div>
  );
}

export default function Duo() {
  const { id } = useParams();
  const { user, refreshBadges } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload, setData } = useAsync(() => api.get(`/duo/${id}`), [id]);
  const duo = data?.duo;
  const [draft, setDraft] = useState(() => emptyDraft('text'));
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [revealAnim, setRevealAnim] = useState(false);

  // El formato sugerido por la pregunta es el inicial (pero se puede cambiar)
  useEffect(() => {
    if (duo && !duo.mine) setDraft((d) => (d.text || d.photo || d.audio ? d : emptyDraft(duo.prompt.hint)));
  }, [duo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mientras esperas al otro, comprobamos de vez en cuando si ya respondió
  useEffect(() => {
    if (!duo || duo.revealed || !duo.mine || duo.expired) return undefined;
    const t = setInterval(async () => {
      try {
        const r = await api.get(`/duo/${id}`);
        if (r.duo.revealed) setRevealAnim(true);
        setData(r);
      } catch {
        /* reintentará en el siguiente ciclo */
      }
    }, 15_000);
    return () => clearInterval(t);
  }, [duo, id, setData]);

  if (loading) return <main className="page page--bare"><Spinner /></main>;
  if (error) return <main className="page page--bare"><ErrorState error={error} onRetry={reload} /></main>;

  const partner = duo.partner;

  const submit = async () => {
    setBusy(true);
    setSubmitError(null);
    try {
      const body = await uploadDraft(draft);
      const r = await api.post(`/duo/${duo.id}/answer`, body);
      if (r.duo.revealed) setRevealAnim(true);
      setData(r);
      refreshBadges();
      toast(r.duo.revealed ? '¡Dúo revelado!' : 'Respuesta guardada');
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const react = async (emoji) => {
    const next = duo.theirs.reaction === emoji ? null : emoji;
    setData({ duo: { ...duo, theirs: { ...duo.theirs, reaction: next } } });
    try {
      await api.put(`/duo/${duo.id}/reaction`, { emoji: next });
    } catch (err) {
      toast(err.message, 'error');
      reload({ silent: true });
    }
  };

  return (
    <main className="page page--bare">
      <TopBar>
        <button className="icon-btn" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} aria-label="Volver">
          <ArrowLeft size={22} />
        </button>
        <span className="topbar-title grow">Dúo</span>
        <span className="duo-timer">
          <Clock size={12} /> {duo.expired ? new Date(duo.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'short' }) : timeLeft(duo.expiresAt)}
        </span>
      </TopBar>

      <section style={{ padding: '8px 0 20px' }}>
        <div className="row" style={{ gap: 12 }}>
          <DuoPair a={user} b={partner} size={36} />
          <p className="small muted">
            Tú y <Link to={`/u/${partner.username}`} style={{ color: 'var(--text)', fontWeight: 700 }}>{partner.displayName}</Link>
            {duo.togetherCount > 0 && <> · {duo.togetherCount} {duo.togetherCount === 1 ? 'dúo revelado' : 'dúos revelados'} juntos</>}
          </p>
        </div>
        <h1 className="duo-prompt" style={{ fontSize: 'clamp(1.7rem, 7vw, 2.2rem)', marginBottom: 0 }}>{duo.prompt.text}</h1>
      </section>

      <div className="duo-halves">
        {/* Tu lado */}
        <section className="duo-half" aria-label="Tu respuesta">
          <HalfHead user={user} label="Tú" extra={duo.mine && <span className="xs faint">{timeAgo(duo.mine.createdAt)}</span>} />
          {duo.mine ? (
            <>
              <Answer answer={duo.mine} author={user} seed={duo.id * 2} />
              {duo.mine.reaction && (
                <p className="small muted" style={{ marginTop: 10 }}>
                  {partner.displayName} reaccionó <span style={{ fontSize: 18 }}>{duo.mine.reaction}</span>
                </p>
              )}
            </>
          ) : duo.expired ? (
            <p className="muted">No respondiste a tiempo.</p>
          ) : (
            <div className="stack" style={{ gap: 14 }}>
              <Composer draft={draft} setDraft={setDraft} textPlaceholder="Tu respuesta…" />
              {submitError && <p className="form-error" role="alert">{submitError}</p>}
              <Button block disabled={!draftReady(draft)} loading={busy} onClick={submit}>
                <Send size={17} /> Enviar mi respuesta
              </Button>
              <p className="xs faint center">
                {duo.partnerAnswered
                  ? `${partner.displayName} ya respondió: verás su respuesta al enviar la tuya.`
                  : `Solo ${partner.displayName} la verá, y solo cuando también responda.`}
              </p>
            </div>
          )}
        </section>

        {/* Su lado */}
        <section className="duo-half theirs" aria-label={`Respuesta de ${partner.displayName}`}>
          <HalfHead user={partner} label={partner.displayName} extra={duo.theirs && <span className="xs faint">{timeAgo(duo.theirs.createdAt)}</span>} />
          {duo.revealed && duo.theirs ? (
            <div className={revealAnim ? 'duo-reveal' : ''}>
              <Answer answer={duo.theirs} author={partner} seed={duo.id * 2 + 1} />
              {duo.theirs.auto && <p className="xs faint" style={{ marginTop: 8 }}>Respuesta automática de una cuenta de demostración.</p>}
              <div className="reaction-tray" style={{ marginTop: 14, boxShadow: 'none' }} role="group" aria-label="Reacciona a su respuesta">
                {REACTIONS.map((e) => (
                  <button key={e} aria-pressed={duo.theirs.reaction === e} onClick={() => react(e)} aria-label={`Reaccionar con ${e}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="duo-locked">
              <Lock size={22} />
              <span>
                {duo.expired
                  ? 'Este dúo terminó sin revelarse.'
                  : duo.partnerAnswered
                    ? <><strong style={{ color: 'var(--text)' }}>Ya respondió.</strong><br />Responde para desbloquearlo.</>
                    : duo.mine
                      ? <>Esperando a {partner.displayName}.<br />Te avisaremos cuando se revele.</>
                      : <>Todavía no ha respondido.</>}
              </span>
            </div>
          )}
        </section>
      </div>

      {duo.revealed && (
        <div className="stack" style={{ marginTop: 20 }}>
          <Link to={`/mensajes/${partner.id}`} className="btn btn-secondary btn-block">
            <MessageCircle size={18} /> Comentarlo con {partner.displayName}
          </Link>
        </div>
      )}
      <Link to="/duos" className="btn btn-ghost btn-block" style={{ marginTop: 12 }}>
        <History size={17} /> Dúos anteriores
      </Link>
    </main>
  );
}

export function DuoHistory() {
  const navigate = useNavigate();
  const { user } = useSession();
  const paged = usePaged(async (cursor) => {
    const r = await api.get(`/duo/history${cursor ? `?before=${cursor}` : ''}`);
    return { items: r.duos, nextCursor: r.nextCursor };
  }, []);
  const sentinel = useSentinel(paged.more);

  return (
    <main className="page">
      <TopBar>
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Volver">
          <ArrowLeft size={22} />
        </button>
        <span className="topbar-title">Dúos anteriores</span>
      </TopBar>
      {paged.loading && !paged.items.length && <Spinner />}
      {paged.error && !paged.items.length && <ErrorState error={paged.error} onRetry={paged.refresh} />}
      {!paged.loading && !paged.error && !paged.items.length && (
        <Empty art={<DuoMark size={40} />} title="Aún no hay historial">
          Cuando termine tu primer dúo, quedará guardado aquí. Solo lo veis vosotros dos.
        </Empty>
      )}
      <div className="stack" style={{ gap: 10 }}>
        {paged.items.map((d) => (
          <Link key={d.id} to={`/duo/${d.id}`} className="card pad row" style={{ gap: 14, alignItems: 'flex-start' }}>
            <DuoPair a={user} b={d.partner} size={30} />
            <span className="grow">
              <span style={{ display: 'block', fontWeight: 700, lineHeight: 1.3 }}>{d.prompt.text}</span>
              <span className="small muted">
                con {d.partner.displayName} · {new Date(d.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
              </span>
            </span>
            {d.revealed ? <Sparkles size={18} color="var(--violet)" aria-label="Revelado" /> : <Lock size={16} className="faint" aria-label="Sin revelar" />}
          </Link>
        ))}
      </div>
      {!paged.done && <div ref={sentinel}>{paged.loading && paged.items.length > 0 && <Spinner />}</div>}
    </main>
  );
}
