import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { useSession } from '../lib/session.jsx';
import { Avatar, Button, DuoMark, ErrorState, Logo, Spinner, useToast } from '../ui/index.jsx';

/** Página de un enlace de invitación (/i/:code). Funciona con o sin sesión. */
export default function Invite() {
  const { code } = useParams();
  const { user } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const { data, error, loading, reload } = useAsync(() => api.get(`/auth/invite/${encodeURIComponent(code)}`), [code]);

  if (loading) return <Spinner />;
  if (error) return <main className="welcome"><Logo /><ErrorState error={error} onRetry={reload} /></main>;
  const inviter = data.inviter;
  const own = user && user.username === inviter.username;

  const accept = async () => {
    setBusy(true);
    try {
      await api.post(`/auth/invite/${encodeURIComponent(code)}/accept`);
      toast(`Nueva amistad con ${inviter.displayName}`);
      navigate('/', { replace: true });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="welcome">
      <Logo size={24} />
      <div className="welcome-stage" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div className="row" style={{ gap: 0 }}>
          <span className="avatar-ring"><Avatar user={{ ...inviter, id: inviter.username.length }} size={84} /></span>
        </div>
        <DuoMark size={30} />
        <h1 style={{ fontSize: 'clamp(2rem, 8vw, 2.6rem)' }}>{inviter.displayName} quiere ser tu dúo</h1>
        <p className="lead" style={{ margin: '0 auto' }}>
          En VIBE, cada día os toca la misma pregunta. Ninguno ve la respuesta del otro hasta que ambos contestáis.
        </p>
      </div>
      <div className="stack" style={{ gap: 12 }}>
        {own ? (
          <Button block onClick={() => navigate('/')}>Este es tu propio enlace</Button>
        ) : user ? (
          <Button block loading={busy} onClick={accept}>Conectar con {inviter.displayName}</Button>
        ) : (
          <>
            <Button block onClick={() => navigate(`/registro?invitacion=${encodeURIComponent(code)}`)}>Crear cuenta y conectar</Button>
            <Button variant="ghost" block onClick={() => navigate('/entrar', { state: { from: `/i/${code}` } })}>Ya tengo cuenta</Button>
          </>
        )}
      </div>
    </main>
  );
}
