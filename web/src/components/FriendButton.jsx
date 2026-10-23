import { useState } from 'react';
import { Check, Clock, UserPlus } from 'lucide-react';
import { api } from '../lib/api.js';
import { Button, useToast } from '../ui/index.jsx';

/** Botón de amistad que refleja y cambia la relación con otra persona. */
export default function FriendButton({ user, relationship, onChange, size = 'sm' }) {
  const [rel, setRel] = useState(relationship || { status: 'none' });
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const update = (next) => {
    setRel(next);
    onChange?.(next);
  };

  const act = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  switch (rel.status) {
    case 'self':
      return null;
    case 'friends':
      return (
        <Button variant="secondary" size={size} disabled>
          <Check size={15} /> Amigos
        </Button>
      );
    case 'outgoing':
      return (
        <Button
          variant="secondary"
          size={size}
          loading={busy}
          onClick={() =>
            act(async () => {
              await api.del(`/friends/requests/${rel.requestId}`);
              update({ status: 'none' });
            })
          }
          aria-label="Solicitud enviada. Toca para cancelar"
        >
          <Clock size={15} /> Enviada
        </Button>
      );
    case 'incoming':
      return (
        <Button
          size={size}
          loading={busy}
          onClick={() =>
            act(async () => {
              await api.post(`/friends/requests/${rel.requestId}/accept`);
              update({ status: 'friends' });
              toast(`Nueva amistad con ${user.displayName}`);
            })
          }
        >
          Aceptar
        </Button>
      );
    case 'blocked':
      return (
        <Button variant="secondary" size={size} disabled>
          Bloqueado
        </Button>
      );
    default:
      return (
        <Button
          size={size}
          loading={busy}
          onClick={() =>
            act(async () => {
              const res = await api.post('/friends/requests', { userId: user.id });
              if (res.status === 'friends') {
                update({ status: 'friends' });
                toast(`Nueva amistad con ${user.displayName}`);
              } else {
                // Recuperamos el id de la solicitud para poder cancelarla
                const reqs = await api.get('/friends/requests');
                const r = reqs.outgoing.find((x) => x.id === user.id);
                update({ status: 'outgoing', requestId: r?.requestId });
              }
            })
          }
        >
          <UserPlus size={15} /> Añadir
        </Button>
      );
  }
}
