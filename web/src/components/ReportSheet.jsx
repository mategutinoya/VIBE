import { useState } from 'react';
import { api } from '../lib/api.js';
import { Button, Sheet, useToast } from '../ui/index.jsx';

const REASONS = [
  ['spam', 'Spam o publicidad'],
  ['acoso', 'Acoso o intimidación'],
  ['contenido_inapropiado', 'Contenido inapropiado'],
  ['suplantacion', 'Se hace pasar por otra persona'],
  ['menor_en_riesgo', 'Un menor podría estar en riesgo'],
  ['otro', 'Otro motivo'],
];

/** Reportar a un usuario o una publicación. Opcionalmente bloquear a la vez. */
export default function ReportSheet({ open, onClose, userId, postId, name, onBlocked }) {
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/reports', { userId, postId, reason, details });
      if (alsoBlock && userId) {
        await api.post('/blocks', { userId });
        onBlocked?.();
      }
      toast('Gracias. Revisaremos tu reporte.');
      setReason(null);
      setDetails('');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} label="Reportar">
      <h3>{postId ? 'Reportar publicación' : `Reportar a ${name}`}</h3>
      <p className="small muted" style={{ marginBottom: 12 }}>
        Tu reporte es anónimo: {name} no sabrá que fuiste tú.
      </p>
      <div role="radiogroup" className="stack" style={{ gap: 4 }}>
        {REASONS.map(([value, label]) => (
          <button key={value} type="button" role="radio" aria-checked={reason === value} className="option" onClick={() => setReason(value)}>
            {label}
          </button>
        ))}
      </div>
      {reason && (
        <div className="stack" style={{ marginTop: 16 }}>
          <textarea
            className="textarea"
            placeholder="Cuéntanos más (opcional)"
            maxLength={500}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
          {userId && (
            <label className="check">
              <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} />
              <span>Bloquear también a {name}. No podrá ver tu perfil ni contactarte.</span>
            </label>
          )}
          {error && <p className="form-error">{error}</p>}
          <Button block loading={busy} onClick={submit}>
            Enviar reporte
          </Button>
        </div>
      )}
    </Sheet>
  );
}
