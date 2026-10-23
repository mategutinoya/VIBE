import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FlaskConical } from 'lucide-react';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.jsx';
import { Button, Logo, useToast } from '../ui/index.jsx';
import InviteCard from '../components/InviteCard.jsx';
import UserSearch from '../components/UserSearch.jsx';

/** Paso final del onboarding: conseguir el primer amigo. Sin él, el Dúo no puede empezar. */
export default function FindFriends() {
  const { user, setUser } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (user.justSignedUp) setUser(({ justSignedUp, invited, ...rest }) => rest); // eslint-disable-line no-unused-vars
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const location = useLocation();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [demoBusy, setDemoBusy] = useState(false);

  const addDemo = async () => {
    setDemoBusy(true);
    try {
      await api.post('/demo');
      toast('Cuentas de demostración añadidas');
      navigate('/', { replace: true });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setDemoBusy(false);
    }
  };

  return (
    <main className="auth">
      <div className="row" style={{ justifyContent: 'space-between', minHeight: 52 }}>
        <Logo size={20} />
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/', { replace: true })}>
          Ahora no
        </button>
      </div>
      <h1>Hola, {user.displayName.split(' ')[0]}</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        {location.state?.invited
          ? 'Ya tienes conexión con quien te invitó. Tu primer dúo te espera en Inicio.'
          : 'VIBE empieza con una sola persona. En cuanto tengas un amigo, tendrás tu primer dúo.'}
      </p>

      <div className="stack" style={{ gap: 28 }}>
        <InviteCard />

        <section className="stack" style={{ gap: 12 }}>
          <h2 style={{ fontSize: 'var(--text-lg)' }}>¿Ya están en VIBE?</h2>
          <UserSearch query={query} setQuery={setQuery} />
        </section>

        <section className="notice demo">
          <FlaskConical size={18} />
          <div className="stack" style={{ gap: 10 }}>
            <p>
              <strong style={{ color: 'var(--text)' }}>¿Quieres probar antes?</strong> Añade 6 cuentas de demostración. Están marcadas como DEMO,
              no son personas reales y puedes quitarlas cuando quieras en Ajustes.
            </p>
            <Button variant="secondary" size="sm" loading={demoBusy} onClick={addDemo} style={{ alignSelf: 'flex-start' }}>
              Explorar con cuentas demo
            </Button>
          </div>
        </section>

        <Button block onClick={() => navigate('/', { replace: true })}>
          Ir a VIBE
        </Button>
      </div>
    </main>
  );
}
