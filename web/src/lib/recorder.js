import { useCallback, useEffect, useRef, useState } from 'react';

export const MAX_AUDIO_MS = 30_000;
const BARS = 40;

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    if (MediaRecorder.isTypeSupported?.(t)) return t;
  }
  return '';
}

function downsample(levels, bars = BARS) {
  if (!levels.length) return Array(bars).fill(0.1);
  const out = [];
  for (let i = 0; i < bars; i++) {
    const a = Math.floor((i * levels.length) / bars);
    const b = Math.max(a + 1, Math.floor(((i + 1) * levels.length) / bars));
    out.push(Math.max(...levels.slice(a, b)));
  }
  const max = Math.max(...out) || 1;
  return out.map((v) => Math.round((0.12 + 0.88 * (v / max)) * 100) / 100);
}

/** Graba notas de voz de hasta 30 s con MediaRecorder y calcula una forma de onda para mostrarla. */
export function useRecorder() {
  const [state, setState] = useState('idle'); // idle | recording | done | error
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const refs = useRef({});

  const cleanup = useCallback(() => {
    const r = refs.current;
    clearInterval(r.timer);
    r.stream?.getTracks().forEach((t) => t.stop());
    r.ctx?.close().catch(() => {});
    refs.current = {};
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(() => {
    const rec = refs.current.recorder;
    if (rec && rec.state !== 'inactive') rec.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    const mime = pickMime();
    if (mime === null || !navigator.mediaDevices?.getUserMedia) {
      setError('Tu navegador no permite grabar audio. Prueba con Chrome, Safari o Firefox actualizados.');
      setState('error');
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
      setError(
        err.name === 'NotAllowedError'
          ? 'Necesitamos permiso para usar el micrófono. Actívalo en los ajustes del navegador.'
          : 'No encontramos ningún micrófono disponible.',
      );
      setState('error');
      return;
    }
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : undefined);
    const chunks = [];
    const all = [];
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    const started = performance.now();
    refs.current = { stream, recorder, ctx };

    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      const durationMs = Math.min(MAX_AUDIO_MS, Math.round(performance.now() - started));
      const type = recorder.mimeType || mime || 'audio/webm';
      const blob = new Blob(chunks, { type });
      const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
      cleanup();
      setResult({ blob: new File([blob], `nota.${ext}`, { type }), url: URL.createObjectURL(blob), durationMs, waveform: downsample(all) });
      setState('done');
    };

    refs.current.timer = setInterval(() => {
      analyser.getByteTimeDomainData(buf);
      let peak = 0;
      for (const v of buf) peak = Math.max(peak, Math.abs(v - 128) / 128);
      all.push(peak);
      setLevels((l) => [...l.slice(-31), peak]);
      const ms = performance.now() - started;
      setElapsed(ms);
      if (ms >= MAX_AUDIO_MS) stop();
    }, 80);

    recorder.start(250);
    setLevels([]);
    setElapsed(0);
    setResult(null);
    setState('recording');
  }, [cleanup, stop]);

  const reset = useCallback(() => {
    cleanup();
    if (result?.url) URL.revokeObjectURL(result.url);
    setResult(null);
    setLevels([]);
    setElapsed(0);
    setError(null);
    setState('idle');
  }, [cleanup, result]);

  return { state, elapsed, levels, result, error, start, stop, reset };
}
