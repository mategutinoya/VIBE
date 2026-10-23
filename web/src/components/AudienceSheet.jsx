import { Link } from 'react-router-dom';
import { Globe, Lock, Plus, Users } from 'lucide-react';
import { Sheet } from '../ui/index.jsx';

export function audienceInfo(audience, circle) {
  if (audience === 'public') return { icon: <Globe size={18} />, title: 'Público', sub: 'Tus amigos y cualquiera en Descubrir' };
  if (audience === 'circle') return { icon: <Lock size={18} />, title: circle?.name || 'Círculo', sub: `${circle?.members?.length ?? 0} personas de tu círculo privado` };
  return { icon: <Users size={18} />, title: 'Amigos', sub: 'Solo tus amigos' };
}

/** Selector de quién puede ver un vibe. */
export default function AudienceSheet({ open, onClose, value, onChange, circles, isPrivate }) {
  const pick = (audience, circle = null) => {
    onChange({ audience, circle });
    onClose();
  };
  const option = (checked, info, onClick, disabled) => (
    <button type="button" role="radio" aria-checked={checked} className="option" onClick={onClick} disabled={disabled}>
      <span className="audience-icon">{info.icon}</span>
      <span className="grow">
        <span style={{ display: 'block', fontWeight: 700 }}>{info.title}</span>
        <span className="small muted">{info.sub}</span>
      </span>
    </button>
  );
  return (
    <Sheet open={open} onClose={onClose} label="¿Quién puede verlo?">
      <h3>¿Quién puede verlo?</h3>
      <div role="radiogroup" className="stack" style={{ gap: 6, marginTop: 8 }}>
        {option(value.audience === 'friends', audienceInfo('friends'), () => pick('friends'))}
        {circles.map((c) => (
          <div key={c.id}>{option(value.audience === 'circle' && value.circle?.id === c.id, audienceInfo('circle', c), () => pick('circle', c), !c.members.length)}</div>
        ))}
        {option(
          value.audience === 'public',
          isPrivate ? { ...audienceInfo('public'), sub: 'Tu cuenta es privada. Cámbiala en Ajustes para publicar en abierto.' } : audienceInfo('public'),
          () => pick('public'),
          isPrivate,
        )}
        <Link to="/amigos?tab=circulos" className="option" onClick={onClose}>
          <span className="audience-icon"><Plus size={18} /></span>
          <span className="grow" style={{ fontWeight: 700 }}>Crear un círculo privado</span>
        </Link>
      </div>
    </Sheet>
  );
}
