/** Cliente HTTP de VIBE. Todas las escrituras llevan X-Vibe (protección CSRF del servidor). */
export class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

async function request(method, url, body, { form, signal } = {}) {
  const headers = { 'X-Vibe': '1' };
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`/api${url}`, { method, headers, body: payload, credentials: 'same-origin', signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'Sin conexión. Revisa tu internet e inténtalo de nuevo.', 'network');
  }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) {
    if (res.status === 401 && data?.code === 'unauthenticated') onUnauthorized();
    throw new ApiError(res.status, data?.error || 'Algo salió mal', data?.code);
  }
  return data;
}

export const api = {
  get: (url, opts) => request('GET', url, undefined, opts),
  post: (url, body) => request('POST', url, body),
  put: (url, body) => request('PUT', url, body),
  patch: (url, body) => request('PATCH', url, body),
  del: (url, body) => request('DELETE', url, body),
  /** Sube un archivo y devuelve { id, kind, url }. */
  async upload(blob, extra = {}) {
    const form = new FormData();
    form.append('file', blob, blob.name || 'archivo');
    for (const [k, v] of Object.entries(extra)) if (v !== undefined) form.append(k, typeof v === 'string' ? v : JSON.stringify(v));
    const { media } = await request('POST', '/media', undefined, { form });
    return media;
  },
};
