import { useCallback, useEffect, useRef, useState } from 'react';

/** Carga datos con estados de carga/error y permite recargar. */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const alive = useRef(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      if (alive.current) setState({ loading: false, error: null, data });
      return data;
    } catch (error) {
      if (alive.current) setState((s) => ({ loading: false, error, data: silent ? s.data : null }));
      return undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    alive.current = true;
    load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), []);
  return { ...state, reload: load, setData };
}
