export const inviteUrl = (code) => `${window.location.origin}/i/${code}`;

/** Comparte con la hoja nativa del sistema si existe; si no, copia al portapapeles. */
export async function shareOrCopy({ title, text, url }) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
