import { useEffect } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Compass, House, Plus, Users } from 'lucide-react';
import { useSession } from './lib/session.jsx';
import { Avatar, DuoMark } from './ui/index.jsx';
import Welcome from './screens/Welcome.jsx';
import { Login, Signup } from './screens/Auth.jsx';
import Invite from './screens/Invite.jsx';
import FindFriends from './screens/FindFriends.jsx';
import Home from './screens/Home.jsx';
import Create from './screens/Create.jsx';
import Duo, { DuoHistory } from './screens/Duo.jsx';
import Friends from './screens/Friends.jsx';
import Discover from './screens/Discover.jsx';
import Profile from './screens/Profile.jsx';
import Settings from './screens/Settings.jsx';
import Notifications from './screens/Notifications.jsx';
import { Conversations, Chat } from './screens/Messages.jsx';
import PostDetail from './screens/PostDetail.jsx';

function BottomNav() {
  const { user, badges } = useSession();
  const item = (to, label, icon, extra) => (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      {icon}
      <span>{label}</span>
      {extra}
    </NavLink>
  );
  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      {item('/', 'Inicio', <House size={23} />, badges.pendingDuo && <span className="dot" aria-label="Dúo pendiente" />)}
      {item('/descubrir', 'Descubrir', <Compass size={23} />)}
      <NavLink to="/crear" className="nav-create" aria-label="Crear un vibe">
        <Plus size={24} strokeWidth={2.4} />
      </NavLink>
      {item('/amigos', 'Amigos', <Users size={23} />, badges.requests > 0 && <span className="dot" aria-label="Solicitudes pendientes" />)}
      {item(`/u/${user.username}`, 'Perfil', <span className="nav-avatar"><Avatar user={user} size={25} /></span>)}
    </nav>
  );
}

const NAV_ROUTES = [/^\/$/, /^\/descubrir$/, /^\/amigos$/, /^\/u\//, /^\/notificaciones$/, /^\/duos$/];

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

/** Tras iniciar sesión o registrarse, el árbol con sesión decide adónde ir (evita carreras de navegación). */
function AfterAuth() {
  const { user } = useSession();
  const location = useLocation();
  if (user.justSignedUp) return <Navigate to="/bienvenida" replace state={{ invited: user.invited }} />;
  return <Navigate to={location.state?.from || '/'} replace />;
}

function Splash() {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
      <DuoMark size={44} />
    </div>
  );
}

export default function App() {
  const { user } = useSession();
  const { pathname } = useLocation();

  if (user === undefined) return <Splash />;

  if (!user) {
    return (
      <div className="app">
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/entrar" element={<Login />} />
          <Route path="/registro" element={<Signup />} />
          <Route path="/i/:code" element={<Invite />} />
          <Route path="*" element={<Navigate to="/" replace state={{ from: pathname }} />} />
        </Routes>
      </div>
    );
  }

  const showNav = NAV_ROUTES.some((r) => r.test(pathname));
  return (
    <div className="app">
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/bienvenida" element={<FindFriends />} />
        <Route path="/crear" element={<Create />} />
        <Route path="/duo/:id" element={<Duo />} />
        <Route path="/duos" element={<DuoHistory />} />
        <Route path="/amigos" element={<Friends />} />
        <Route path="/descubrir" element={<Discover />} />
        <Route path="/u/:username" element={<Profile />} />
        <Route path="/ajustes" element={<Settings />} />
        <Route path="/notificaciones" element={<Notifications />} />
        <Route path="/mensajes" element={<Conversations />} />
        <Route path="/mensajes/:userId" element={<Chat />} />
        <Route path="/p/:id" element={<PostDetail />} />
        <Route path="/i/:code" element={<Invite />} />
        <Route path="/entrar" element={<AfterAuth />} />
        <Route path="/registro" element={<AfterAuth />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showNav && <BottomNav />}
    </div>
  );
}
