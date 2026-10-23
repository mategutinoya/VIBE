import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, FlaskConical, LogOut, Moon, Share2, Sun, Trash2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { prepareImage } from '../lib/image.js';
import { useSession } from '../lib/session.jsx';
import { inviteUrl, shareOrCopy } from '../lib/share.js';
import { applyTheme, getTheme } from '../lib/theme.js';
import { useAsync } from '../lib/useAsync.js';
import { Avatar, Button, ConfirmSheet, Segmented, Sheet, Switch, TopBar, useToast } from '../ui/index.jsx';
import UserRow from '../components/UserRow.jsx';

const BIO_MAX = 160;

function ProfileEditor() {
  const { user, setUser } = useSession();
  const toast = useToast();
  const fileInput = useRef(null);
  const [form, setForm] = useState({ displayName: user.displayName, bio: user.bio });
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [error, setError] = useState(null);
  const dirty = form.displayName !== user.displayName || form.bio !== user.bio;

  const save = async () => {
    if (!form.displayName.trim()) return setError('El nombre no puede estar vacío');
    setBusy(true);
    setError(null);
    try {
      const r = await api.patch('/me', form);
      setUser(r.user);
      toast('Perfil actualizado');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const pickAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarBusy(true);
    try {
      const img = await prepareImage(file, { max: 512 });
      const media = await api.upload(img);
      const r = await api.patch('/me', { avatarMediaId: media.id });
      setUser(r.user);
      toast('Foto actualizada');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setAvatarBusy(false);
    }
  };

  return (
    <section className="card pad stack" style={{ gap: 16 }}>
      <div className="row" style={{ gap: 16 }}>
        <button onClick={() => fileInput.current.click()} aria-label="Cambiar foto de perfil" style={{ position: 'relative' }} disabled={avatarBusy}>
          <Avatar user={user} size={72} />
          <span className="audio-play" style={{ position: 'absolute', right: -4, bottom: -4, width: 28, height: 28 }}>
            {avatarBusy ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Camera size={14} />}
          </span>
        </button>
        <input ref={fileInput} type="file" accept="image/*" hidden onChange={pickAvatar} />
        <div className="grow">
          <p style={{ fontWeight: 700 }}>@{user.username}</p>
          {user.avatarUrl && (
            <button
              className="small muted"
              onClick={async () => {
                const r = await api.patch('/me', { avatarMediaId: null });
                setUser(r.user);
              }}
            >
              Quitar foto
            </button>
          )}
        </div>
      </div>
      <div className="field">
        <label className="label" htmlFor="dn">Nombre</label>
        <input id="dn" className="input" maxLength={40} value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} />
      </div>
      <div className="field">
        <label className="label" htmlFor="bio">Biografía</label>
        <textarea id="bio" className="textarea" style={{ minHeight: 76 }} maxLength={BIO_MAX} placeholder="Algo breve sobre ti" value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
        <span className="hint">{BIO_MAX - [...form.bio].length} caracteres restantes</span>
      </div>
      {error && <p className="form-error">{error}</p>}
      <Button disabled={!dirty} loading={busy} onClick={save}>Guardar cambios</Button>
    </section>
  );
}

function Privacy() {
  const { user, setUser } = useSession();
  const toast = useToast();
  const update = async (patch) => {
    const prev = user;
    setUser({ ...user, ...patch });
    try {
      const r = await api.patch('/me', patch);
      setUser(r.user);
    } catch (err) {
      setUser(prev);
      toast(err.message, 'error');
    }
  };
  return (
    <section className="card pad" style={{ paddingTop: 4, paddingBottom: 4 }}>
      <Switch
        label="Cuenta privada"
        description="Solo tus amigos ven tus vibes y tu lista de amigos. Nada tuyo aparece en Descubrir."
        checked={user.isPrivate}
        onChange={(v) => update({ isPrivate: v })}
      />
      <Switch
        label="Aparecer en búsquedas y sugerencias"
        description="Si lo desactivas, solo te encontrarán escribiendo tu @usuario exacto."
        checked={user.discoverable}
        onChange={(v) => update({ discoverable: v })}
      />
      <Switch
        label="Solo amigos de amigos pueden enviarme solicitudes"
        description="Evita solicitudes de desconocidos."
        checked={user.allowRequests === 'fof'}
        onChange={(v) => update({ allowRequests: v ? 'fof' : 'everyone' })}
      />
      <p className="small faint" style={{ padding: '12px 0' }}>
        VIBE no usa tu ubicación. Las fotos se suben sin metadatos (GPS, modelo de móvil, fecha).
      </p>
    </section>
  );
}

function Blocked() {
  const toast = useToast();
  const { data, setData } = useAsync(() => api.get('/me/blocked'), []);
  if (!data?.users.length) return <p className="small muted">No has bloqueado a nadie.</p>;
  return data.users.map((u) => (
    <UserRow
      key={u.id}
      user={u}
      to="#"
      action={
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            await api.del(`/blocks/${u.id}`);
            setData((d) => ({ users: d.users.filter((x) => x.id !== u.id) }));
            toast(`Has desbloqueado a ${u.displayName}`);
          }}
        >
          Desbloquear
        </Button>
      }
    />
  ));
}

function DemoToggle() {
  const toast = useToast();
  const { data, setData, loading } = useAsync(() => api.get('/demo'), []);
  if (loading || !data?.available) return null;
  return (
    <>
    <h2 className="section-title">
      <span className="row" style={{ gap: 6 }}><FlaskConical size={16} /> Demostración</span>
    </h2>
    <section className="card pad" style={{ paddingTop: 4, paddingBottom: 4 }}>
      <Switch
        label="Cuentas de demostración"
        description="6 cuentas marcadas como DEMO para probar VIBE. No son personas reales."
        checked={data.connected}
        onChange={async (v) => {
          try {
            const r = v ? await api.post('/demo') : await api.del('/demo');
            setData({ ...data, connected: r.connected });
            toast(v ? 'Cuentas demo añadidas' : 'Cuentas demo eliminadas');
          } catch (err) {
            toast(err.message, 'error');
          }
        }}
      />
    </section>
    </>
  );
}

function DeleteAccount() {
  const { setUser } = useSession();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  return (
    <>
      <button className="menu-item danger" onClick={() => setOpen(true)}>
        <Trash2 size={20} /> Eliminar mi cuenta
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label="Eliminar cuenta">
        <h3>Eliminar tu cuenta</h3>
        <p className="muted" style={{ marginBottom: 16 }}>
          Se borrarán para siempre tu perfil, tus vibes, fotos, audios, dúos y mensajes. Escribe tu contraseña para confirmar.
        </p>
        <input className="input" type="password" autoComplete="current-password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}
        <div className="stack" style={{ marginTop: 16 }}>
          <Button
            variant="danger"
            block
            loading={busy}
            disabled={!password}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await api.del('/me', { password });
                setUser(null);
              } catch (err) {
                setError(err.message);
                setBusy(false);
              }
            }}
          >
            Eliminar definitivamente
          </Button>
          <Button variant="ghost" block onClick={() => setOpen(false)}>Cancelar</Button>
        </div>
      </Sheet>
    </>
  );
}

export default function Settings() {
  const { user, logout } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const [theme, setTheme] = useState(getTheme());
  const [confirmLogout, setConfirmLogout] = useState(false);

  return (
    <main className="page page--bare">
      <TopBar>
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Volver"><ArrowLeft size={22} /></button>
        <span className="topbar-title">Ajustes</span>
      </TopBar>
      <div className="stack" style={{ gap: 12 }}>
        <h2 className="section-title" style={{ marginTop: 8 }}>Perfil</h2>
        <ProfileEditor />

        <h2 className="section-title">Privacidad</h2>
        <Privacy />

        <h2 className="section-title">Apariencia</h2>
        <Segmented
          label="Tema"
          value={theme}
          onChange={(t) => {
            setTheme(t);
            applyTheme(t);
          }}
          options={[
            { value: 'dark', label: 'Oscuro', icon: <Moon size={15} /> },
            { value: 'light', label: 'Claro', icon: <Sun size={15} /> },
          ]}
        />

        <h2 className="section-title">Invitar</h2>
        <button
          className="audience-button"
          onClick={async () => {
            const r = await shareOrCopy({ title: 'VIBE', text: 'Sé mi dúo en VIBE', url: inviteUrl(user.inviteCode) });
            if (r === 'copied') toast('Enlace copiado');
          }}
        >
          <span className="audience-icon"><Share2 size={18} /></span>
          <span className="grow">
            <span style={{ display: 'block', fontWeight: 700 }}>Tu enlace personal</span>
            <span className="small muted ellipsis" style={{ display: 'block' }}>{inviteUrl(user.inviteCode)}</span>
          </span>
        </button>

        <DemoToggle />

        <h2 className="section-title">Bloqueados</h2>
        <Blocked />

        <h2 className="section-title">Cuenta</h2>
        <section className="card" style={{ padding: 6 }}>
          <button className="menu-item" onClick={() => setConfirmLogout(true)}>
            <LogOut size={20} /> Cerrar sesión
          </button>
          <DeleteAccount />
        </section>
        <p className="xs faint center" style={{ marginTop: 16 }}>VIBE · versión MVP 0.1</p>
      </div>
      <ConfirmSheet open={confirmLogout} onClose={() => setConfirmLogout(false)} title="¿Cerrar sesión?" confirmLabel="Cerrar sesión" onConfirm={logout} />
    </main>
  );
}

