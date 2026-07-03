import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'sonner';
import App from './App';
import { StevoAdminPage } from './pages/stevo/StevoAdminPage';
import { StevoSetupPage } from './pages/stevo/StevoSetupPage';
import './index.css';

// Páginas isoladas do middleware Stevo DND (funcionalidade à parte do painel
// principal). Roteamento por query param para funcionar em qualquer host
// estático sem rewrite de rotas: /?page=stevo (admin) e
// /?page=stevo-setup&token=... (setup do cliente).
const params = new URLSearchParams(window.location.search);
const page = params.get('page');

let root: React.ReactNode;
if (page === 'stevo') {
  root = <StevoAdminPage />;
} else if (page === 'stevo-setup') {
  root = <StevoSetupPage token={params.get('token') ?? ''} />;
} else {
  root = <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {root}
    <Toaster position="top-right" richColors closeButton />
  </React.StrictMode>,
);
