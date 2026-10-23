import { Link2, Share2 } from 'lucide-react';
import { useSession } from '../lib/session.jsx';
import { inviteUrl, shareOrCopy } from '../lib/share.js';
import { Button, useToast } from '../ui/index.jsx';

/** Invitación personal: un enlace, sin acceso a contactos ni mensajes masivos. */
export default function InviteCard({ compact = false }) {
  const { user } = useSession();
  const toast = useToast();
  const url = inviteUrl(user.inviteCode);

  const share = async () => {
    const r = await shareOrCopy({
      title: 'VIBE',
      text: `Sé mi dúo en VIBE. Cada día, una pregunta para los dos y nadie ve la respuesta del otro hasta que ambos contestamos.`,
      url,
    });
    if (r === 'copied') toast('Enlace copiado');
    if (r === 'failed') toast('No se pudo copiar el enlace', 'error');
  };

  return (
    <div className="card pad stack" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 12 }}>
        <span className="audience-icon">
          <Link2 size={18} />
        </span>
        <div className="grow">
          <p style={{ fontWeight: 700 }}>Invita a tu primer dúo</p>
          {!compact && <p className="small muted">Quien entre con tu enlace se conecta contigo automáticamente.</p>}
        </div>
      </div>
      <Button block onClick={share}>
        <Share2 size={17} /> Compartir mi enlace
      </Button>
    </div>
  );
}
