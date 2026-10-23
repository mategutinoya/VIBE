import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Lista paginada por cursor. `fetchPage(cursor)` devuelve { items, nextCursor, extra }.
 */
export function usePaged(fetchPage, deps = []) {
  const [state, setState] = useState({ items: [], cursor: null, loading: true, error: null, done: false, extra: null });
  const busy = useRef(false);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const load = useCallback(async (reset) => {
    if (busy.current) return;
    busy.current = true;
    setState((s) => ({ ...s, loading: true, error: null, ...(reset ? { items: [], cursor: null, done: false } : {}) }));
    try {
      const page = await fetchRef.current(reset ? null : stateRef.current.cursor);
      setState((s) => ({
        items: reset ? page.items : [...s.items, ...page.items],
        cursor: page.nextCursor,
        done: !page.nextCursor,
        loading: false,
        error: null,
        extra: reset ? page.extra ?? null : s.extra,
      }));
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error }));
    } finally {
      busy.current = false;
    }
  }, []);

  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setItems = useCallback((fn) => setState((s) => ({ ...s, items: fn(s.items) })), []);
  const more = useCallback(() => {
    const s = stateRef.current;
    if (!s.done && !s.loading && !s.error) load(false);
  }, [load]);

  return { ...state, refresh: () => load(true), more, setItems };
}

/** Llama a `onVisible` cuando el elemento centinela entra en pantalla (scroll infinito). */
export function useSentinel(onVisible) {
  const ref = useRef(null);
  const cb = useRef(onVisible);
  cb.current = onVisible;
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && cb.current(), { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  });
  return ref;
}
