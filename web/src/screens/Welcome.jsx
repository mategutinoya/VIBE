import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Logo } from '../ui/index.jsx';

function HeroMoments() {
  return (
    <svg className="hero-mark" viewBox="0 0 340 250" aria-hidden="true">
      <defs>
        <linearGradient id="wg1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8a6bff" />
          <stop offset="1" stopColor="#4f8bff" />
        </linearGradient>
      </defs>
      <g transform="rotate(-7 110 120)">
        <rect x="40" y="40" width="130" height="165" rx="22" fill="#151830" stroke="rgba(255,255,255,.08)" />
        <rect x="52" y="52" width="106" height="118" rx="14" fill="url(#wg1)" opacity=".85" />
        <circle cx="128" cy="86" r="14" fill="#e9e4ff" opacity=".9" />
        <rect x="52" y="180" width="70" height="8" rx="4" fill="rgba(255,255,255,.18)" />
      </g>
      <g transform="rotate(5 250 90)">
        <rect x="178" y="22" width="140" height="96" rx="22" fill="#1d2140" stroke="rgba(255,255,255,.08)" />
        <rect x="196" y="46" width="96" height="10" rx="5" fill="#eef0ff" opacity=".9" />
        <rect x="196" y="64" width="72" height="10" rx="5" fill="#eef0ff" opacity=".6" />
        <rect x="196" y="82" width="84" height="10" rx="5" fill="#eef0ff" opacity=".35" />
      </g>
      <g transform="rotate(-3 255 190)">
        <rect x="184" y="150" width="140" height="62" rx="31" fill="#151830" stroke="rgba(255,255,255,.08)" />
        <circle cx="215" cy="181" r="18" fill="url(#wg1)" />
        <path d="M210 172 l13 9 -13 9z" fill="#fff" />
        {[10, 22, 14, 28, 18, 24, 12, 20, 9, 16].map((h, i) => (
          <rect key={i} x={244 + i * 7} y={181 - h / 2} width="4" height={h} rx="2" fill="#a5aacb" opacity={i < 4 ? 1 : 0.5} />
        ))}
      </g>
    </svg>
  );
}

function HeroDuo() {
  return (
    <svg className="hero-mark" viewBox="0 0 340 250" aria-hidden="true">
      <defs>
        <linearGradient id="dg1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a48bff" />
          <stop offset="1" stopColor="#7452ff" />
        </linearGradient>
        <linearGradient id="dg2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#62a6ff" />
          <stop offset="1" stopColor="#3d6bff" />
        </linearGradient>
        <clipPath id="dclip">
          <circle cx="135" cy="125" r="88" />
        </clipPath>
      </defs>
      <circle cx="135" cy="125" r="88" fill="url(#dg1)">
        <animate attributeName="cx" values="118;135;135" keyTimes="0;0.5;1" dur="1.6s" fill="freeze" />
      </circle>
      <circle cx="205" cy="125" r="88" fill="url(#dg2)">
        <animate attributeName="cx" values="222;205;205" keyTimes="0;0.5;1" dur="1.6s" fill="freeze" />
      </circle>
      <circle cx="205" cy="125" r="88" fill="#e9e4ff" clipPath="url(#dclip)" />
      <text x="88" y="132" fill="#fff" fontFamily="Bricolage Grotesque Variable" fontWeight="700" fontSize="20" textAnchor="middle">tú</text>
      <text x="254" y="132" fill="#fff" fontFamily="Bricolage Grotesque Variable" fontWeight="700" fontSize="20" textAnchor="middle">tu dúo</text>
      <text x="170" y="140" fill="#2a1f66" fontFamily="Bricolage Grotesque Variable" fontWeight="800" fontSize="44" textAnchor="middle">?</text>
    </svg>
  );
}

function HeroCircles() {
  return (
    <svg className="hero-mark" viewBox="0 0 340 250" aria-hidden="true">
      <circle cx="170" cy="125" r="115" fill="none" stroke="rgba(255,255,255,.08)" strokeDasharray="4 8" />
      <circle cx="170" cy="125" r="80" fill="rgba(79,139,255,.08)" stroke="rgba(79,139,255,.35)" />
      <circle cx="170" cy="125" r="44" fill="rgba(138,107,255,.22)" stroke="rgba(138,107,255,.6)" />
      <circle cx="170" cy="125" r="16" fill="#e9e4ff" />
      {[[170, 45], [100, 160], [242, 150], [128, 92], [212, 96], [170, 205]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i < 3 ? 9 : 7} fill={i < 3 ? '#4f8bff' : '#8a6bff'} />
      ))}
      <text x="296" y="34" fill="#6d7299" fontFamily="Manrope Variable" fontWeight="700" fontSize="12" textAnchor="end">público</text>
      <text x="268" y="70" fill="#a5aacb" fontFamily="Manrope Variable" fontWeight="700" fontSize="12" textAnchor="end">amigos</text>
      <text x="214" y="122" fill="#eef0ff" fontFamily="Manrope Variable" fontWeight="700" fontSize="12">círculo</text>
    </svg>
  );
}

const SLIDES = [
  {
    hero: <HeroMoments />,
    title: 'Momentos reales. Sin pose.',
    lead: 'Fotos, pensamientos y notas de voz para tus amigos. Sin filtros, sin likes públicos y sin algoritmo.',
  },
  {
    hero: <HeroDuo />,
    title: 'Cada día, un dúo.',
    lead: 'Te emparejamos con un amigo y os hacemos la misma pregunta. Nadie ve la respuesta del otro hasta que los dos contestáis.',
  },
  {
    hero: <HeroCircles />,
    title: 'Tus amigos, tus reglas.',
    lead: 'Decide quién ve cada vibe: amigos, un círculo privado o todo el mundo. Bloquear y reportar está a un toque.',
  },
];

export default function Welcome() {
  const [i, setI] = useState(0);
  const navigate = useNavigate();
  const last = i === SLIDES.length - 1;
  const s = SLIDES[i];
  return (
    <main className="welcome">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <Logo size={26} />
        {!last && (
          <button className="btn btn-ghost btn-sm" onClick={() => setI(SLIDES.length - 1)}>
            Saltar
          </button>
        )}
      </div>
      <div className="welcome-stage slide" key={i}>
        {s.hero}
        <div className="stack" style={{ gap: 14 }}>
          <h1>{s.title}</h1>
          <p className="lead">{s.lead}</p>
        </div>
      </div>
      <div className="stack" style={{ gap: 16 }}>
        <div className="dots" aria-label={`Paso ${i + 1} de ${SLIDES.length}`}>
          {SLIDES.map((_, k) => (
            <span key={k} className={k === i ? 'on' : ''} />
          ))}
        </div>
        <Button block onClick={() => (last ? navigate('/registro') : setI(i + 1))}>
          {last ? 'Crear cuenta' : 'Siguiente'}
        </Button>
        <Link to="/entrar" className="btn btn-ghost btn-block">
          Ya tengo cuenta
        </Link>
      </div>
    </main>
  );
}
