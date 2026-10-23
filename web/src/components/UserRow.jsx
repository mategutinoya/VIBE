import { Link } from 'react-router-dom';
import { Avatar, DemoTag } from '../ui/index.jsx';

export default function UserRow({ user, subtitle, action, to }) {
  return (
    <div className="user-row">
      <Link to={to || `/u/${user.username}`} className="row grow" style={{ gap: 12, minWidth: 0 }}>
        <Avatar user={user} size={44} />
        <span className="names">
          <span className="name ellipsis" style={{ display: 'block' }}>
            {user.displayName} {user.isDemo && <DemoTag />}
          </span>
          <span className="handle ellipsis" style={{ display: 'block' }}>
            {subtitle ?? `@${user.username}`}
          </span>
        </span>
      </Link>
      {action}
    </div>
  );
}

export const mutualsText = (n) => (n ? `${n} ${n === 1 ? 'amigo' : 'amigos'} en común` : null);
