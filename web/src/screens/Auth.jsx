import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.jsx';
import { Button, Logo } from '../ui/index.jsx';

const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;

function PasswordInput({ value, onChange, autoComplete, invalid }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        className="input"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        aria-invalid={invalid}
        style={{ paddingRight: 48 }}
        required
      />
      <button
        type="button"
        className="icon-btn"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        style={{ position: 'absolute', right: 4, top: 4 }}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

function AuthHeader() {
  const navigate = useNavigate();
  return (
    <div className="row" style={{ justifyContent: 'space-between', minHeight: 52 }}>
      <button className="icon-btn" onClick={() => navigate('/')} aria-label="Volver">
        <ArrowLeft size={22} />
      </button>
      <Logo size={20} />
      <span style={{ width: 40 }} />
    </div>
  );
}

export function Signup() {
  const { setUser } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const inviteCode = params.get('invitacion') || location.state?.inviteCode || null;
  const [form, setForm] = useState({ displayName: '', username: '', password: '', age: false });
  const [check, setCheck] = useState({ state: 'idle' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState({});

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const username = form.username.trim().toLowerCase().replace(/^@/, '');

  useEffect(() => {
    if (!username) return setCheck({ state: 'idle' });
    if (!USERNAME_RE.test(username)) return setCheck({ state: 'bad', reason: '3–20 caracteres: minúsculas, números, punto o guion bajo' });
    setCheck({ state: 'checking' });
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api
        .get(`/auth/username-available?u=${encodeURIComponent(username)}`, { signal: ctrl.signal })
        .then((r) => setCheck(r.available ? { state: 'ok' } : { state: 'bad', reason: r.reason }))
        .catch(() => setCheck({ state: 'idle' }));
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [username]);

  const problems = {
    displayName: !form.displayName.trim() ? 'Escribe tu nombre' : null,
    username: check.state === 'bad' ? check.reason : !username ? 'Elige un nombre de usuario' : null,
    password:
      form.password.length < 8
        ? 'Mínimo 8 caracteres'
        : username && form.password.toLowerCase().includes(username)
          ? 'No incluyas tu usuario en la contraseña'
          : null,
    age: !form.age ? 'Debes tener 13 años o más para usar VIBE' : null,
  };
  const valid = !Object.values(problems).some(Boolean) && check.state === 'ok';

  const submit = async (e) => {
    e.preventDefault();
    setTouched({ displayName: true, username: true, password: true, age: true });
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const { user } = await api.post('/auth/signup', {
        displayName: form.displayName,
        username,
        password: form.password,
        ageConfirmed: form.age,
        inviteCode,
      });
      // El árbol con sesión redirige a /bienvenida al ver justSignedUp
      setUser({ ...user, justSignedUp: true, invited: !!inviteCode });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const blur = (k) => () => setTouched((t) => ({ ...t, [k]: true }));

  return (
    <main className="auth">
      <AuthHeader />
      <h1>Crea tu cuenta</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        {inviteCode ? 'Al terminar, quien te invitó aparecerá como tu amigo.' : 'Tardas 20 segundos. Solo pedimos lo imprescindible.'}
      </p>
      <form className="stack" style={{ gap: 18 }} onSubmit={submit} noValidate>
        <div className="field">
          <label className="label" htmlFor="name">Nombre</label>
          <input id="name" className="input" value={form.displayName} onChange={set('displayName')} onBlur={blur('displayName')} maxLength={40} autoComplete="name" aria-invalid={touched.displayName && !!problems.displayName} />
          {touched.displayName && problems.displayName && <span className="error-text">{problems.displayName}</span>}
        </div>
        <div className="field">
          <label className="label" htmlFor="username">Nombre de usuario</label>
          <div className="input-prefix">
            <span>@</span>
            <input id="username" className="input" value={form.username} onChange={set('username')} onBlur={blur('username')} maxLength={21} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" aria-invalid={check.state === 'bad'} />
          </div>
          {check.state === 'checking' && <span className="hint">Comprobando…</span>}
          {check.state === 'ok' && <span className="hint ok">@{username} está libre</span>}
          {check.state === 'bad' && <span className="error-text">{check.reason}</span>}
        </div>
        <div className="field">
          <label className="label" htmlFor="password">Contraseña</label>
          <PasswordInput value={form.password} onChange={set('password')} autoComplete="new-password" invalid={touched.password && !!problems.password} />
          <span className={touched.password && problems.password ? 'error-text' : 'hint'}>{problems.password || 'Perfecto'}</span>
        </div>
        <label className="check">
          <input type="checkbox" checked={form.age} onChange={set('age')} />
          <span>Tengo 13 años o más. Mis vibes son solo para amigos salvo que yo elija otra cosa, y VIBE nunca usa mi ubicación.</span>
        </label>
        {touched.age && problems.age && <span className="error-text">{problems.age}</span>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" block loading={busy}>
          Crear cuenta
        </Button>
        <p className="small muted center">
          ¿Ya tienes cuenta? <Link to="/entrar" style={{ color: 'var(--text)', fontWeight: 700 }}>Inicia sesión</Link>
        </p>
      </form>
    </main>
  );
}

export function Login() {
  const { setUser } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password) {
      setError('Escribe tu usuario y tu contraseña');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { user } = await api.post('/auth/login', form);
      // El árbol con sesión redirige a location.state.from (ver AfterAuth en App.jsx)
      setUser(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth">
      <AuthHeader />
      <h1>Hola de nuevo</h1>
      <p className="muted" style={{ marginBottom: 24 }}>Tu dúo te está esperando.</p>
      <form className="stack" style={{ gap: 18 }} onSubmit={submit} noValidate>
        <div className="field">
          <label className="label" htmlFor="lu">Usuario</label>
          <div className="input-prefix">
            <span>@</span>
            <input id="lu" className="input" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" />
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="lp">Contraseña</label>
          <PasswordInput value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} autoComplete="current-password" />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" block loading={busy}>
          Entrar
        </Button>
        <p className="small muted center">
          ¿Nuevo en VIBE? <Link to="/registro" style={{ color: 'var(--text)', fontWeight: 700 }}>Crea una cuenta</Link>
        </p>
      </form>
    </main>
  );
}
