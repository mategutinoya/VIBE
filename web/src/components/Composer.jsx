import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Mic, PenLine, RotateCcw, Square, X, Image as ImageIcon } from 'lucide-react';
import { api } from '../lib/api.js';
import { prepareImage } from '../lib/image.js';
import { MAX_AUDIO_MS, useRecorder } from '../lib/recorder.js';
import { formatDuration } from '../lib/time.js';
import { Button, Segmented } from '../ui/index.jsx';
import AudioPlayer from './AudioPlayer.jsx';

export const TEXT_MAX = 280;
export const CAPTION_MAX = 200;

export const KINDS = [
  { value: 'photo', label: 'Foto', icon: <ImageIcon size={16} /> },
  { value: 'text', label: 'Pensamiento', icon: <PenLine size={16} /> },
  { value: 'audio', label: 'Audio', icon: <Mic size={16} /> },
];

export const emptyDraft = (kind = 'text') => ({ kind, text: '', caption: '', photo: null, audio: null });

export function draftReady(d) {
  if (d.kind === 'text') return d.text.trim().length > 0 && [...d.text.trim()].length <= TEXT_MAX;
  if (d.kind === 'photo') return !!d.photo && [...d.caption].length <= CAPTION_MAX;
  return !!d.audio && [...d.caption].length <= CAPTION_MAX;
}

/** Sube el archivo del borrador (si lo hay) y devuelve el cuerpo listo para la API. */
export async function uploadDraft(d) {
  if (d.kind === 'text') return { kind: 'text', body: d.text.trim() };
  if (d.kind === 'photo') {
    const media = await api.upload(d.photo.file);
    return { kind: 'photo', body: d.caption.trim(), mediaId: media.id };
  }
  const media = await api.upload(d.audio.file, { durationMs: String(d.audio.durationMs), waveform: d.audio.waveform });
  return { kind: 'audio', body: d.caption.trim(), mediaId: media.id };
}

/** Convierte un borrador en un objeto con forma de publicación para la vista previa. */
export function draftAsPost(d, user, audience = 'friends', circle = null) {
  return {
    id: 0,
    kind: d.kind,
    body: d.kind === 'text' ? d.text.trim() : d.caption.trim(),
    audience,
    circle,
    createdAt: Date.now(),
    author: user,
    media:
      d.kind === 'photo'
        ? { url: d.photo.url, width: d.photo.width, height: d.photo.height }
        : d.kind === 'audio'
          ? { url: d.audio.url, durationMs: d.audio.durationMs, waveform: d.audio.waveform }
          : null,
    reactions: [],
    myReaction: null,
    commentCount: 0,
    isMine: true,
  };
}

function PhotoEditor({ draft, setDraft }) {
  const cameraInput = useRef(null);
  const galleryInput = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const prepared = await prepareImage(file);
      const url = URL.createObjectURL(prepared);
      const dims = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve({});
        img.src = url;
      });
      setDraft((d) => ({ ...d, photo: { file: prepared, url, ...dims } }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (draft.photo) {
    return (
      <div className="photo-preview">
        <img src={draft.photo.url} alt="Vista previa de tu foto" />
        <button className="icon-btn" aria-label="Quitar foto" onClick={() => setDraft((d) => ({ ...d, photo: null }))}>
          <X size={18} />
        </button>
      </div>
    );
  }
  return (
    <div className="photo-picker">
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      <input ref={galleryInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden onChange={pick} />
      <div>
        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 650, fontSize: 'var(--text-lg)' }}>Una foto, sin filtros</p>
        <p className="small muted">Quitamos la ubicación y los metadatos antes de subirla.</p>
      </div>
      <div className="row">
        <Button onClick={() => cameraInput.current.click()} loading={busy}>
          <Camera size={18} /> Cámara
        </Button>
        <Button variant="secondary" onClick={() => galleryInput.current.click()} disabled={busy}>
          <ImagePlus size={18} /> Galería
        </Button>
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

function ThoughtEditor({ draft, setDraft, placeholder }) {
  const len = [...draft.text].length;
  return (
    <div style={{ position: 'relative' }}>
      <textarea
        className="thought-input"
        autoFocus
        placeholder={placeholder || '¿Qué se te pasa por la cabeza?'}
        value={draft.text}
        maxLength={TEXT_MAX + 20}
        onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
        aria-label="Escribe tu pensamiento"
      />
      <span className={`counter ${len > TEXT_MAX - 20 ? 'warn' : ''}`}>{TEXT_MAX - len}</span>
    </div>
  );
}

function AudioEditor({ draft, setDraft }) {
  const rec = useRecorder();

  useEffect(() => {
    if (rec.state === 'done' && rec.result) setDraft((d) => ({ ...d, audio: rec.result }));
  }, [rec.state, rec.result, setDraft]);

  if (draft.audio && rec.state !== 'recording') {
    return (
      <div className="recorder">
        <div style={{ width: '100%' }}>
          <AudioPlayer src={draft.audio.url} durationMs={draft.audio.durationMs} waveform={draft.audio.waveform} />
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            rec.reset();
            setDraft((d) => ({ ...d, audio: null }));
          }}
        >
          <RotateCcw size={15} /> Grabar de nuevo
        </Button>
      </div>
    );
  }

  const recording = rec.state === 'recording';
  const bars = Array.from({ length: 32 }, (_, i) => rec.levels[i] ?? 0);
  return (
    <div className="recorder">
      {recording ? (
        <div className="live-wave" aria-hidden="true">
          {bars.map((v, i) => (
            <span key={i} style={{ height: `${Math.max(8, Math.min(100, v * 260))}%` }} />
          ))}
        </div>
      ) : (
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 650, fontSize: 'var(--text-lg)' }}>Nota de voz</p>
          <p className="small muted">Hasta 30 segundos. Di lo que quieras, como quieras.</p>
        </div>
      )}
      <div className="rec-time" aria-live="polite">
        {formatDuration(rec.elapsed)} <span className="faint" style={{ fontSize: 'var(--text-md)' }}>/ {formatDuration(MAX_AUDIO_MS)}</span>
      </div>
      <button
        type="button"
        className={`rec-button ${recording ? 'recording' : ''}`}
        onClick={recording ? rec.stop : rec.start}
        aria-label={recording ? 'Detener grabación' : 'Empezar a grabar'}
      >
        {recording ? <Square size={28} fill="currentColor" /> : <Mic size={32} />}
      </button>
      <p className="small faint">{recording ? 'Toca para terminar' : 'Toca para grabar'}</p>
      {rec.error && <p className="error-text" style={{ maxWidth: 320 }}>{rec.error}</p>}
    </div>
  );
}

/** Editor de un vibe en cualquiera de sus tres formatos. Se usa para publicar y para responder al Dúo. */
export default function Composer({ draft, setDraft, textPlaceholder, showKinds = true }) {
  const setKind = (kind) => setDraft((d) => ({ ...d, kind }));
  const captionLen = [...draft.caption].length;
  return (
    <div className="stack" style={{ gap: 14 }}>
      {showKinds && <Segmented label="Formato" options={KINDS} value={draft.kind} onChange={setKind} />}
      <div className="composer-stage">
        {draft.kind === 'photo' && <PhotoEditor draft={draft} setDraft={setDraft} />}
        {draft.kind === 'text' && <ThoughtEditor draft={draft} setDraft={setDraft} placeholder={textPlaceholder} />}
        {draft.kind === 'audio' && <AudioEditor draft={draft} setDraft={setDraft} />}
      </div>
      {draft.kind !== 'text' && (
        <div className="field">
          <input
            className="input"
            placeholder="Añade un texto (opcional)"
            value={draft.caption}
            maxLength={CAPTION_MAX + 10}
            onChange={(e) => setDraft((d) => ({ ...d, caption: e.target.value }))}
            aria-label="Texto opcional"
            aria-invalid={captionLen > CAPTION_MAX}
          />
          {captionLen > CAPTION_MAX - 30 && <span className="hint">{CAPTION_MAX - captionLen} caracteres restantes</span>}
        </div>
      )}
    </div>
  );
}
