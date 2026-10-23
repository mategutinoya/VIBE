import { useCallback } from 'react';
import { Button, ErrorState, PostSkeleton, Spinner } from '../ui/index.jsx';
import { useSentinel } from '../lib/usePaged.js';
import PostCard from './PostCard.jsx';

/** Lista de publicaciones con carga incremental, errores y estado vacío. */
export default function Feed({ paged, empty }) {
  const { items, loading, error, done, more, setItems, refresh } = paged;
  const sentinel = useSentinel(more);

  const onChange = useCallback((post) => setItems((list) => list.map((p) => (p.id === post.id ? post : p))), [setItems]);
  const onRemove = useCallback(
    (id, opts) => setItems((list) => list.filter((p) => p.id !== id && (!opts?.blockedAuthor || p.author.id !== opts.blockedAuthor))),
    [setItems],
  );

  if (loading && !items.length) return [0, 1, 2].map((i) => <PostSkeleton key={i} />);
  if (error && !items.length) return <ErrorState error={error} onRetry={refresh} />;
  if (!items.length) return empty;

  return (
    <div className="feed">
      {items.map((p) => (
        <PostCard key={p.id} post={p} onChange={onChange} onRemove={onRemove} />
      ))}
      {!done && <div ref={sentinel}>{loading && <Spinner />}</div>}
      {error && (
        <div className="load-more">
          <Button variant="secondary" size="sm" onClick={more}>
            Reintentar
          </Button>
        </div>
      )}
    </div>
  );
}
