import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { formatDuration } from '../lib/time.js';

let current = null; // solo suena un audio a la vez

const FALLBACK_WAVE = Array.from({ length: 40 }, (_, i) => 0.25 + 0.6 * Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.23)));

export default function AudioPlayer({ src, durationMs, waveform, compact = false }) {
  const audio = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(false);
  const bars = waveform?.length ? waveform : FALLBACK_WAVE;
  const total = durationMs || 0;

  useEffect(() => {
    const a = audio.current;
    if (!a) return undefined;
    const onTime = () => {
      const d = Number.isFinite(a.duration) && a.duration > 0 ? a.duration * 1000 : total;
      setProgress(d ? Math.min(1, (a.currentTime * 1000) / d) : 0);
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
    };
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);
    a.addEventListener('pause', onPause);
    a.addEventListener('play', onPlay);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('play', onPlay);
      if (current === a) current = null;
      a.pause();
    };
  }, [total]);

  const toggle = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    const a = audio.current;
    if (playing) return a.pause();
    if (current && current !== a) current.pause();
    current = a;
    try {
      await a.play();
    } catch {
      setError(true);
    }
  };

  const seek = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const a = audio.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const d = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : total / 1000;
    if (d) a.currentTime = ratio * d;
    if (!playing) toggle();
  };

  const playedBars = Math.round(progress * bars.length);
  const shown = playing || progress > 0 ? progress * total : total;

  return (
    <div className="audio" style={compact ? { padding: 8, gap: 10 } : undefined}>
      <audio ref={audio} src={src} preload="metadata" onError={() => setError(true)} />
      <button type="button" className="audio-play" onClick={toggle} aria-label={playing ? 'Pausar' : 'Reproducir nota de voz'} style={compact ? { width: 36, height: 36 } : undefined}>
        {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" style={{ marginLeft: 2 }} />}
      </button>
      {error ? (
        <span className="small muted grow">No se pudo reproducir este audio en tu navegador.</span>
      ) : (
        <div className="wave" onClick={seek} role="slider" aria-label="Posición del audio" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} tabIndex={-1}>
          {bars.map((v, i) => (
            <span key={i} className={i < playedBars ? 'played' : ''} style={{ height: `${Math.max(10, v * 100)}%` }} />
          ))}
        </div>
      )}
      <span className="audio-time">{formatDuration(shown)}</span>
    </div>
  );
}
