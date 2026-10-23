import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert, CircleCheck, RefreshCw } from 'lucide-react';

/* ---------- Marca ---------- */

/** El símbolo de VIBE: dos círculos que se cruzan. Dos personas, un mismo momento. */
export function DuoMark({ size = 28, animated = false }) {
  const id = useRef(`m${Math.random().toString(36).slice(2, 8)}`).current;
  return (
    <svg width={size * 1.45} height={size} viewBox="0 0 58 40" aria-hidden="true" className={animated ? 'duo-mark-anim' : undefined}>
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a48bff" />
          <stop offset="1" stopColor="#7452ff" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#62a6ff" />
          <stop offset="1" stopColor="#3d6bff" />
        </linearGradient>
        <clipPath id={`${id}c`}>
          <circle cx="20" cy="20" r="18" />
        </clipPath>
      </defs>
      <circle cx="20" cy="20" r="18" fill={`url(#${id}a)`} />
      <circle cx="38" cy="20" r="18" fill={`url(#${id}b)`} />
      <circle cx="38" cy="20" r="18" fill="#e9e4ff" clipPath={`url(#${id}c)`} />
    </svg>
  );
}

export function Logo({ size = 24 }) {
  return (
    <span className="logo" style={{ fontSize: size }}>
      <DuoMark size={size * 0.9} />
      vibe
    </span>
  );
}

/* ---------- Avatar ---------- */

const HUES = [262, 222, 292, 200, 330, 245, 180, 12];
export const hueFor = (id = 0) => HUES[Math.abs(Number(id) || 0) % HUES.length];

export function Avatar({ user, size = 40, ring = false }) {
  const [failed, setFailed] = useState(false);
  const initials = (user?.displayName || user?.username || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  const hue = hueFor(user?.id);
  const el = (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, hsl(${hue} 70% 62%), hsl(${hue + 40} 75% 52%))`,
      }}
    >
      {user?.avatarUrl && !failed ? (
        <img src={user.avatarUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
  return ring ? <span className="avatar-ring">{el}</span> : el;
}

export const DemoTag = () => (
  <span className="demo-tag" title="Cuenta de demostración: no es una persona real">
    DEMO
  </span>
);

export function UserName({ user, className = '' }) {
  return (
    <span className={className}>
      {user.displayName} {user.isDemo && <DemoTag />}
    </span>
  );
}

/* ---------- Botones e inputs ---------- */

export function Button({ variant = 'primary', size, block, loading, children, className = '', ...props }) {
  const cls = ['btn', `btn-${variant}`, size === 'sm' && 'btn-sm', block && 'btn-block', className].filter(Boolean).join(' ');
  return (
    <button className={cls} disabled={loading || props.disabled} {...props}>
      {loading ? <span className="spinner" aria-label="Cargando" /> : children}
    </button>
  );
}

export function Switch({ checked, onChange, label, description, disabled }) {
  return (
    <label className="switch-row">
      <span className="grow">
        <span style={{ fontWeight: 650, display: 'block' }}>{label}</span>
        {description && <span className="small muted">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className="switch"
        disabled={disabled}
        onClick={() => onChange(!checked)}
      />
    </label>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}>
          {o.icon}
          {o.label}
          {o.count ? <span className="count">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* ---------- Hoja inferior ---------- */

export function Sheet({ open, onClose, children, label }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        <div className="sheet-handle" />
        {children}
      </div>
    </>,
    document.body,
  );
}

export function ConfirmSheet({ open, onClose, title, body, confirmLabel, danger, onConfirm }) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} label={title}>
      <h3>{title}</h3>
      {body && <p className="muted" style={{ marginBottom: 20 }}>{body}</p>}
      <div className="stack">
        <Button
          variant={danger ? 'danger' : 'primary'}
          block
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onClose();
            } finally {
              setBusy(false);
            }
          }}
        >
          {confirmLabel}
        </Button>
        <Button variant="ghost" block onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </Sheet>
  );
}

/* ---------- Toasts ---------- */

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((message, type = 'success') => {
    const id = Math.random();
    setToasts((t) => [...t.slice(-2), { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {createPortal(
        <div className="toasts" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.type}`}>
              {t.type === 'error' ? <CircleAlert size={18} /> : <CircleCheck size={18} />}
              {t.message}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/* ---------- Estados ---------- */

export function Empty({ art, title, children, action }) {
  return (
    <div className="empty">
      {art && <div className="art">{art}</div>}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <Empty
      art={<CircleAlert size={36} color="var(--danger)" />}
      title={error?.status === 404 ? 'No encontrado' : 'No se pudo cargar'}
      action={
        onRetry && (
          <Button variant="secondary" size="sm" onClick={() => onRetry()}>
            <RefreshCw size={15} /> Reintentar
          </Button>
        )
      }
    >
      {error?.message || 'Algo salió mal.'}
    </Empty>
  );
}

export function PostSkeleton() {
  return (
    <div className="post" aria-hidden="true">
      <div className="post-head">
        <div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%' }} />
        <div className="stack" style={{ gap: 6, flex: 1 }}>
          <div className="skeleton" style={{ width: '40%', height: 12 }} />
          <div className="skeleton" style={{ width: '22%', height: 10 }} />
        </div>
      </div>
      <div className="skeleton" style={{ height: 180, borderRadius: 24 }} />
    </div>
  );
}

export function RowSkeleton({ count = 4 }) {
  return Array.from({ length: count }, (_, i) => (
    <div key={i} className="user-row" aria-hidden="true">
      <div className="skeleton" style={{ width: 44, height: 44, borderRadius: '50%' }} />
      <div className="stack" style={{ gap: 6, flex: 1 }}>
        <div className="skeleton" style={{ width: '45%', height: 12 }} />
        <div className="skeleton" style={{ width: '25%', height: 10 }} />
      </div>
    </div>
  ));
}

export function Spinner() {
  return (
    <div className="load-more">
      <span className="spinner" aria-label="Cargando" />
    </div>
  );
}

/* ---------- Barra superior ---------- */

export function TopBar({ children, className = '' }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return <header className={`topbar ${scrolled ? 'scrolled' : ''} ${className}`}>{children}</header>;
}
