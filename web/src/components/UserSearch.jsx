import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../lib/api.js';
import { RowSkeleton } from '../ui/index.jsx';
import FriendButton from './FriendButton.jsx';
import UserRow, { mutualsText } from './UserRow.jsx';

/** Buscador de personas por nombre o @usuario. Muestra resultados bajo el campo. */
export default function UserSearch({ query, setQuery, autoFocus }) {
  const [state, setState] = useState({ loading: false, users: [], error: null });
  const q = query.trim();

  useEffect(() => {
    if (q.replace(/^@/, '').length < 2) {
      setState({ loading: false, users: [], error: null });
      return undefined;
    }
    setState((s) => ({ ...s, loading: true }));
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api
        .get(`/users/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => setState({ loading: false, users: r.users, error: null }))
        .catch((err) => err.name !== 'AbortError' && setState({ loading: false, users: [], error: err.message }));
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="search">
        <Search size={18} />
        <input
          className="input"
          type="search"
          placeholder="Busca por nombre o @usuario"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus={autoFocus}
          autoCapitalize="none"
          autoCorrect="off"
          aria-label="Buscar personas"
        />
      </div>
      {q.replace(/^@/, '').length >= 2 && (
        <div>
          {state.loading && !state.users.length && <RowSkeleton count={2} />}
          {state.error && <p className="error-text">{state.error}</p>}
          {!state.loading && !state.error && !state.users.length && (
            <p className="small muted" style={{ padding: '12px 0' }}>
              Nadie con ese nombre todavía. Invítale con tu enlace.
            </p>
          )}
          {state.users.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              subtitle={[`@${u.username}`, mutualsText(u.mutuals)].filter(Boolean).join(' · ')}
              action={<FriendButton user={u} relationship={u.relationship} />}
            />
          ))}
        </div>
      )}
    </div>
  );
}
