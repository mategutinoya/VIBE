import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, MessageCircle, MoreHorizontal, Plus, Trash2, UserMinus, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.jsx';
import { useAsync } from '../lib/useAsync.js';
import { Avatar, Button, ConfirmSheet, Empty, ErrorState, RowSkeleton, Segmented, Sheet, TopBar, useToast } from '../ui/index.jsx';
import FriendButton from '../components/FriendButton.jsx';
import InviteCard from '../components/InviteCard.jsx';
import UserRow, { mutualsText } from '../components/UserRow.jsx';
import UserSearch from '../components/UserSearch.jsx';

function FriendsTab() {
  const toast = useToast();
  const friends = useAsync(() => api.get('/friends'), []);
  const suggestions = useAsync(() => api.get('/friends/suggestions'), []);
  const [menu, setMenu] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const remove = async (u) => {
    await api.del(`/friends/${u.id}`);
    friends.setData((d) => ({ users: d.users.filter((x) => x.id !== u.id) }));
    toast(`${u.displayName} ya no está en tus amigos`);
  };

  return (
    <>
      {friends.loading && <RowSkeleton />}
      {friends.error && <ErrorState error={friends.error} onRetry={friends.reload} />}
      {friends.data && !friends.data.users.length && (
        <div style={{ marginTop: 16 }}>
          <InviteCard />
        </div>
      )}
      {friends.data?.users.map((u) => (
        <UserRow
          key={u.id}
          user={u}
          action={
            <button className="icon-btn" aria-label={`Opciones para ${u.displayName}`} onClick={() => setMenu(u)}>
              <MoreHorizontal size={20} />
            </button>
          }
        />
      ))}

      {suggestions.data?.users.length > 0 && (
        <>
          <h2 className="section-title">Quizá conozcas</h2>
          {suggestions.data.users.map((u) => (
            <UserRow key={u.id} user={u} subtitle={mutualsText(u.mutuals)} action={<FriendButton user={u} relationship={{ status: 'none' }} />} />
          ))}
        </>
      )}
      {friends.data?.users.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <InviteCard compact />
        </div>
      )}

      <Sheet open={!!menu} onClose={() => setMenu(null)} label="Opciones">
        {menu && (
          <>
            <Link className="menu-item" to={`/mensajes/${menu.id}`}>
              <MessageCircle size={20} /> Enviar mensaje
            </Link>
            <button
              className="menu-item danger"
              onClick={() => {
                setConfirm(menu);
                setMenu(null);
              }}
            >
              <UserMinus size={20} /> Eliminar de amigos
            </button>
          </>
        )}
      </Sheet>
      <ConfirmSheet
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={`¿Eliminar a ${confirm?.displayName}?`}
        body="Dejaréis de ver los vibes que son solo para amigos y no volveréis a coincidir en un dúo. No se le notificará."
        confirmLabel="Eliminar"
        danger
        onConfirm={() => remove(confirm)}
      />
    </>
  );
}

function RequestsTab() {
  const { refreshBadges } = useSession();
  const toast = useToast();
  const { data, loading, error, reload, setData } = useAsync(() => api.get('/friends/requests'), []);
  const [busy, setBusy] = useState(null);

  const act = async (r, kind) => {
    setBusy(r.requestId);
    try {
      if (kind === 'accept') {
        await api.post(`/friends/requests/${r.requestId}/accept`);
        toast(`Nueva amistad con ${r.displayName}`);
      } else {
        await api.del(`/friends/requests/${r.requestId}`);
      }
      setData((d) => ({ incoming: d.incoming.filter((x) => x.requestId !== r.requestId), outgoing: d.outgoing.filter((x) => x.requestId !== r.requestId) }));
      refreshBadges();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <RowSkeleton />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data.incoming.length && !data.outgoing.length) {
    return <Empty title="Sin solicitudes">Cuando alguien quiera conectar contigo, aparecerá aquí.</Empty>;
  }
  return (
    <>
      {data.incoming.length > 0 && <h2 className="section-title">Para ti</h2>}
      {data.incoming.map((r) => (
        <UserRow
          key={r.requestId}
          user={r}
          subtitle={mutualsText(r.mutuals) || `@${r.username}`}
          action={
            <div className="row" style={{ gap: 6 }}>
              <Button size="sm" loading={busy === r.requestId} onClick={() => act(r, 'accept')}>
                Aceptar
              </Button>
              <button className="icon-btn" aria-label={`Rechazar a ${r.displayName}`} onClick={() => act(r, 'decline')} disabled={busy === r.requestId}>
                <X size={18} />
              </button>
            </div>
          }
        />
      ))}
      {data.outgoing.length > 0 && <h2 className="section-title">Enviadas</h2>}
      {data.outgoing.map((r) => (
        <UserRow
          key={r.requestId}
          user={r}
          action={
            <Button variant="secondary" size="sm" loading={busy === r.requestId} onClick={() => act(r, 'cancel')}>
              Cancelar
            </Button>
          }
        />
      ))}
    </>
  );
}

function CircleEditor({ circle, friends, onClose, onSaved }) {
  const [name, setName] = useState(circle?.name || '');
  const [members, setMembers] = useState(() => new Set(circle?.members.map((m) => m.id) || []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const toggle = (id) =>
    setMembers((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const save = async () => {
    if (!name.trim()) return setError('Ponle nombre al círculo');
    setBusy(true);
    setError(null);
    try {
      const body = { name, memberIds: [...members] };
      const r = circle ? await api.patch(`/friends/circles/${circle.id}`, body) : await api.post('/friends/circles', body);
      onSaved(r.circle);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} label={circle ? 'Editar círculo' : 'Nuevo círculo'}>
      <h3>{circle ? 'Editar círculo' : 'Nuevo círculo'}</h3>
      <p className="small muted" style={{ marginBottom: 16 }}>Nadie sabe que está en un círculo ni ve quién más está.</p>
      <div className="field" style={{ marginBottom: 16 }}>
        <input className="input" placeholder="Nombre (p. ej. Mejores amigos)" maxLength={30} value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre del círculo" />
      </div>
      <p className="label" style={{ marginBottom: 4 }}>{members.size} seleccionados</p>
      {!friends.length && <p className="small muted">Primero añade amigos para crear círculos.</p>}
      {friends.map((f) => (
        <label key={f.id} className="user-row" style={{ cursor: 'pointer' }}>
          <Avatar user={f} size={36} />
          <span className="names name">{f.displayName}</span>
          <input type="checkbox" checked={members.has(f.id)} onChange={() => toggle(f.id)} style={{ width: 20, height: 20, accentColor: 'var(--violet)' }} />
        </label>
      ))}
      {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}
      <div style={{ marginTop: 16 }}>
        <Button block loading={busy} onClick={save}>Guardar</Button>
      </div>
    </Sheet>
  );
}

function CirclesTab() {
  const toast = useToast();
  const circles = useAsync(() => api.get('/friends/circles'), []);
  const friends = useAsync(() => api.get('/friends'), []);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);

  if (circles.loading) return <RowSkeleton count={2} />;
  if (circles.error) return <ErrorState error={circles.error} onRetry={circles.reload} />;
  const list = circles.data.circles;

  return (
    <>
      <p className="small muted" style={{ margin: '16px 0' }}>
        Los círculos son listas privadas de amigos. Elige un círculo al publicar y solo esas personas lo verán.
      </p>
      <div className="stack" style={{ gap: 10 }}>
        {list.map((c) => (
          <div key={c.id} className="card pad row" style={{ gap: 12 }}>
            <span className="audience-icon"><Lock size={18} /></span>
            <button className="grow" style={{ textAlign: 'left' }} onClick={() => setEditing(c)}>
              <span style={{ display: 'block', fontWeight: 700 }}>{c.name}</span>
              <span className="small muted">{c.members.length} {c.members.length === 1 ? 'persona' : 'personas'}</span>
            </button>
            <button className="icon-btn" aria-label={`Eliminar ${c.name}`} onClick={() => setConfirm(c)}>
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
      <Button variant="secondary" block style={{ marginTop: 14 }} onClick={() => setEditing('new')}>
        <Plus size={18} /> Nuevo círculo
      </Button>
      {editing && (
        <CircleEditor
          circle={editing === 'new' ? null : editing}
          friends={friends.data?.users || []}
          onClose={() => setEditing(null)}
          onSaved={(c) => {
            circles.setData((d) => ({ circles: editing === 'new' ? [...d.circles, c] : d.circles.map((x) => (x.id === c.id ? c : x)) }));
            setEditing(null);
            toast('Círculo guardado');
          }}
        />
      )}
      <ConfirmSheet
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={`¿Eliminar «${confirm?.name}»?`}
        body="Los vibes que compartiste con este círculo dejarán de verse para sus miembros."
        confirmLabel="Eliminar círculo"
        danger
        onConfirm={async () => {
          await api.del(`/friends/circles/${confirm.id}`);
          circles.setData((d) => ({ circles: d.circles.filter((x) => x.id !== confirm.id) }));
        }}
      />
    </>
  );
}

export default function Friends() {
  const { badges } = useSession();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'amigos';
  const [query, setQuery] = useState('');

  return (
    <main className="page">
      <TopBar>
        <h1 className="topbar-title topbar-big">Amigos</h1>
      </TopBar>
      <UserSearch query={query} setQuery={setQuery} />
      {query.trim().length < 2 && (
        <>
          <div style={{ margin: '16px 0 4px' }}>
            <Segmented
              label="Secciones"
              value={tab}
              onChange={(v) => setParams({ tab: v }, { replace: true })}
              options={[
                { value: 'amigos', label: 'Amigos' },
                { value: 'solicitudes', label: 'Solicitudes', count: badges.requests },
                { value: 'circulos', label: 'Círculos' },
              ]}
            />
          </div>
          {tab === 'amigos' && <FriendsTab />}
          {tab === 'solicitudes' && <RequestsTab />}
          {tab === 'circulos' && <CirclesTab />}
        </>
      )}
    </main>
  );
}
