import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Eye, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.jsx';
import { Button, ConfirmSheet, TopBar, useToast } from '../ui/index.jsx';
import Composer, { draftAsPost, draftReady, emptyDraft, uploadDraft } from '../components/Composer.jsx';
import AudienceSheet, { audienceInfo } from '../components/AudienceSheet.jsx';
import PostCard from '../components/PostCard.jsx';

export default function Create() {
  const { user } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const [draft, setDraft] = useState(() => emptyDraft('text'));
  const [audience, setAudience] = useState({ audience: 'friends', circle: null });
  const [circles, setCircles] = useState([]);
  const [sheet, setSheet] = useState(false);
  const [step, setStep] = useState('edit');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/friends/circles').then((r) => setCircles(r.circles)).catch(() => {});
  }, []);

  const ready = draftReady(draft);
  const info = audienceInfo(audience.audience, audience.circle);

  const publish = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = await uploadDraft(draft);
      await api.post('/posts', { ...body, audience: audience.audience, circleId: audience.circle?.id });
      toast('Vibe compartido');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const [discard, setDiscard] = useState(false);
  const leave = () => (window.history.length > 1 ? navigate(-1) : navigate('/'));
  const close = () => {
    const dirty = draft.text || draft.photo || draft.audio || draft.caption;
    if (dirty) setDiscard(true);
    else leave();
  };

  return (
    <main className="page page--bare">
      <TopBar>
        <button className="icon-btn" onClick={step === 'preview' ? () => setStep('edit') : close} aria-label={step === 'preview' ? 'Volver a editar' : 'Cerrar'}>
          <X size={22} />
        </button>
        <span className="topbar-title grow center">{step === 'preview' ? 'Vista previa' : 'Nuevo vibe'}</span>
        <span style={{ width: 40 }} />
      </TopBar>

      {step === 'edit' ? (
        <div className="stack" style={{ gap: 14 }}>
          <Composer draft={draft} setDraft={setDraft} />
          <button type="button" className="audience-button" onClick={() => setSheet(true)}>
            <span className="audience-icon">{info.icon}</span>
            <span className="grow">
              <span className="small muted" style={{ display: 'block' }}>Quién puede verlo</span>
              <span style={{ fontWeight: 700 }}>{info.title}</span>
            </span>
            <ChevronDown size={18} className="faint" />
          </button>
          <div className="sticky-actions">
            <Button block disabled={!ready} onClick={() => setStep('preview')}>
              <Eye size={18} /> Previsualizar
            </Button>
          </div>
        </div>
      ) : (
        <div className="stack" style={{ gap: 16 }}>
          <div className="preview-frame">
            <span className="preview-label">Así lo verán · {info.sub}</span>
            <PostCard post={draftAsPost(draft, user, audience.audience, audience.circle)} preview />
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="sticky-actions">
            <Button variant="secondary" onClick={() => setStep('edit')} disabled={busy}>
              Editar
            </Button>
            <Button block loading={busy} onClick={publish}>
              Compartir
            </Button>
          </div>
        </div>
      )}

      <ConfirmSheet
        open={discard}
        onClose={() => setDiscard(false)}
        title="¿Descartar este vibe?"
        body="Perderás lo que has escrito, grabado o elegido."
        confirmLabel="Descartar"
        danger
        onConfirm={leave}
      />
      <AudienceSheet open={sheet} onClose={() => setSheet(false)} value={audience} onChange={setAudience} circles={circles} isPrivate={user.isPrivate} />
    </main>
  );
}
