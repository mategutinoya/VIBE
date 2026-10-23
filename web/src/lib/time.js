const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

export function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return 'ahora';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return 'ayer';
  if (d < 7) return `${d} d`;
  return new Date(ts).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

export function timeLeft(ts) {
  const ms = ts - Date.now();
  if (ms <= 0) return 'terminado';
  const h = Math.floor(ms / 3600_000);
  if (h >= 1) return `quedan ${h} h`;
  return `quedan ${Math.max(1, Math.round(ms / 60_000))} min`;
}

export const relative = (ts) => rtf.format(-Math.round((Date.now() - ts) / 86400_000), 'day');

export function formatDuration(ms) {
  const s = Math.max(0, Math.round((ms || 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
