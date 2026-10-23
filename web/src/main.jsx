import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/manrope';
import './styles/tokens.css';
import './styles/app.css';
import { applyTheme, getTheme } from './lib/theme.js';
import { SessionProvider } from './lib/session.jsx';
import { ToastProvider } from './ui/index.jsx';
import App from './App.jsx';

applyTheme(getTheme());

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
);
