import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Lock, Sparkles } from 'lucide-react';
import { useSession } from '../lib/session.jsx';
import { timeLeft } from '../lib/time.js';
import { Avatar, DemoTag } from '../ui/index.jsx';

export function DuoPair({ a, b, size = 40 }) {
  return (
    <span className="duo-pair">
      <Avatar user={a} size={size} />
      <Avatar user={b} size={size} />
    </span>
  );
}

function statusOf(duo) {
  if (duo.revealed) return { text: <><strong>¡Revelado!</strong> Mira qué respondió {duo.partner.displayName}.</>, cta: 'Ver el dúo', icon: <Sparkles size={16} /> };
  if (duo.mine && !duo.partnerAnswered) return { text: <>Tu respuesta está guardada. Se revela cuando <strong>{duo.partner.displayName}</strong> conteste.</>, cta: 'Ver', icon: <Lock size={16} /> };
  if (!duo.mine && duo.partnerAnswered) return { text: <><strong>{duo.partner.displayName}</strong> ya respondió. Te toca para ver su respuesta.</>, cta: 'Responder', icon: null };
  return { text: <>Respondes tú, responde <strong>{duo.partner.displayName}</strong>. Nadie ve nada hasta que los dos contestéis.</>, cta: 'Responder', icon: null };
}

/** Tarjeta principal del Inicio: el motivo para abrir VIBE cada día. */
export default function DuoCard({ duo }) {
  const { user } = useSession();
  const s = statusOf(duo);
  return (
    <Link to={`/duo/${duo.id}`} className="duo-card" aria-label={`Tu dúo de hoy con ${duo.partner.displayName}: ${duo.prompt.text}`}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="duo-eyebrow">
          <span className="live" /> Tu dúo de hoy
        </span>
        <span className="duo-timer">
          <Clock size={12} /> {timeLeft(duo.expiresAt)}
        </span>
      </div>
      <p className="duo-prompt">{duo.prompt.text}</p>
      <p className="duo-status-text" style={{ marginBottom: 16 }}>{s.text}</p>
      <div className="duo-status">
        <DuoPair a={user} b={duo.partner} size={38} />
        <span className="grow small" style={{ fontWeight: 650 }}>
          Tú y {duo.partner.displayName.split(' ')[0]} {duo.partner.isDemo && <DemoTag />}
        </span>
        <span className="btn btn-primary btn-sm" aria-hidden="true">
          {s.icon}
          {s.cta}
          {!s.icon && <ArrowRight size={15} />}
        </span>
      </div>
    </Link>
  );
}
