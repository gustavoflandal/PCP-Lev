import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ComIdioma } from './i18n/ComIdioma';
import './index.css';

const raiz = document.getElementById('root');
if (!raiz) {
  throw new Error('elemento #root nao encontrado no index.html');
}

createRoot(raiz).render(
  <StrictMode>
    <BrowserRouter>
      <ComIdioma>
        <App />
      </ComIdioma>
    </BrowserRouter>
  </StrictMode>,
);
